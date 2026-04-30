import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, ch => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[ch]))

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const smtpHost = process.env.SMTP_HOST || 'smtp.hostinger.com'
  const smtpPort = Number(process.env.SMTP_PORT || 465)
  const smtpUser = process.env.SMTP_USER || 'transferencias@entradas-fifa.store'
  const smtpPass = process.env.SMTP_PASS
  const emailFrom = process.env.EMAIL_FROM || `Entradas Mundial 2026 <${smtpUser}>`
  const appUrl = process.env.APP_URL || 'https://entradas-fifa.store'

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !smtpUser || !smtpPass) {
    res.status(500).json({ error: 'Email service is not configured' })
    return
  }

  const authHeader = req.headers.authorization || ''
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  })
  const { data: authData } = await userClient.auth.getUser()
  if (!authData.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { user_id, subject, message, action_url } = req.body || {}
  if (!user_id || !subject || !message) {
    res.status(400).json({ error: 'Missing user_id, subject or message' })
    return
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { data: targetUser, error: userError } = await adminClient
    .from('users')
    .select('email, first_name, email_notifications')
    .eq('id', user_id)
    .maybeSingle()

  if (userError || !targetUser?.email) {
    res.status(404).json({ error: 'Recipient not found' })
    return
  }

  if (targetUser.email_notifications === false) {
    res.status(200).json({ skipped: true })
    return
  }

  const safeSubject = String(subject).slice(0, 120)
  const safeMessage = String(message).slice(0, 2000)
  const actionUrl = String(action_url || appUrl).startsWith('http') ? String(action_url || appUrl) : appUrl
  const greeting = targetUser.first_name ? `Hola ${escapeHtml(targetUser.first_name)},` : 'Hola,'
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass }
  })

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

  await transporter.sendMail({
    from: emailFrom,
    to: targetUser.email,
    subject: safeSubject,
    html,
    text: `${safeSubject}\n\n${safeMessage}\n\n${actionUrl}`
  })

  res.status(200).json({ ok: true })
}
