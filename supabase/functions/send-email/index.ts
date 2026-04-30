import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[ch] || ch))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const emailFrom = Deno.env.get('EMAIL_FROM') || 'Entradas Mundial 2026 <transferencias@entradas-fifa.store>'
  const appUrl = Deno.env.get('APP_URL') || 'https://entradas-fifa.store'

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !resendApiKey) {
    return new Response(JSON.stringify({ error: 'Email service is not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const authHeader = req.headers.get('Authorization') || ''
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  })
  const { data: authData } = await userClient.auth.getUser()
  if (!authData.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const { user_id, subject, message, action_url } = await req.json().catch(() => ({}))
  if (!user_id || !subject || !message) {
    return new Response(JSON.stringify({ error: 'Missing user_id, subject or message' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { data: targetUser, error: userError } = await adminClient
    .from('users')
    .select('email, first_name, email_notifications')
    .eq('id', user_id)
    .maybeSingle()

  if (userError || !targetUser?.email) {
    return new Response(JSON.stringify({ error: 'Recipient not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  if (targetUser.email_notifications === false) {
    return new Response(JSON.stringify({ skipped: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const safeSubject = String(subject).slice(0, 120)
  const safeMessage = String(message).slice(0, 2000)
  const actionUrl = String(action_url || appUrl).startsWith('http') ? String(action_url || appUrl) : appUrl
  const greeting = targetUser.first_name ? `Hola ${escapeHtml(targetUser.first_name)},` : 'Hola,'

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:620px;margin:0 auto;padding:28px;color:#10151f">
      <h1 style="margin:0 0 14px;font-size:26px;letter-spacing:-.03em">Entradas Mundial 2026</h1>
      <div style="border:1px solid #d9dee8;border-radius:20px;padding:22px;background:#ffffff">
        <p style="margin:0 0 12px;font-weight:700">${greeting}</p>
        <h2 style="margin:0 0 12px;font-size:22px">${escapeHtml(safeSubject)}</h2>
        <p style="margin:0 0 20px;line-height:1.55;color:#475467">${escapeHtml(safeMessage)}</p>
        <a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:800">Abrir plataforma</a>
      </div>
      <p style="margin:18px 0 0;color:#667085;font-size:12px">Recibiste este aviso porque tenés una cuenta en Entradas Mundial 2026.</p>
    </div>`

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [targetUser.email],
      subject: safeSubject,
      html,
      text: `${safeSubject}\n\n${safeMessage}\n\n${actionUrl}`
    })
  })

  const result = await resendResponse.json().catch(() => ({}))
  if (!resendResponse.ok) {
    return new Response(JSON.stringify({ error: result }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ ok: true, result }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
