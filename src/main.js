
import { supabase } from '../lib/supabase.js'
import './styles.css'

const app = document.getElementById('app')
let activeCameraStream = null

let state = {
  session: null,
  user: null,
  profile: null,
  view: 'home',
  matches: [],
  listings: [],
  users: [],
  orders: [],
  messages: [],
  notifications: [],
  theme: localStorage.getItem('theme') || 'light',
  authMode: 'login',
  prefMatchId: '',
  selectedMatch: null,
  selectedMatchId: null,
  openMatchTabs: [],
  selectedOrder: null
}

document.body.classList.toggle('dark', state.theme === 'dark')

const ADMIN_EMAILS = ['admin@demo.com', 'juanmaotero1999@gmail.com']

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, ch => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[ch]))

const phaseLabels = {
  groups: 'Fase de grupos',
  group: 'Fase de grupos',
  round32: '16avos',
  round16: '8vos',
  r16: '8vos',
  round_of_16: '8vos',
  quarterfinals: '4tos',
  qf: '4tos',
  semifinals: 'Semi',
  sf: 'Semi',
  third_place: '3er puesto',
  final: 'Final'
}

const phaseOrder = ['groups', 'group', 'round32', 'round16', 'round_of_16', 'r16', 'quarterfinals', 'qf', 'semifinals', 'sf', 'third_place', 'final']
const normalizedPhase = (phase = 'groups') => phase === 'third_place' ? 'final' : phase
const phaseRank = (phase = 'groups') => {
  const index = phaseOrder.indexOf(normalizedPhase(phase))
  return index === -1 ? 99 : index
}

const statusLabel = {
  active: 'Activa',
  pending_payment: 'Esperando pago',
  seller_ticket_sent: 'Vendedor informó envío',
  awaiting_buyer_payment: 'Esperando pago del comprador',
  buyer_payment_sent: 'Comprador informó pago',
  payment_confirmed: 'Pago confirmado por vendedor',
  tickets_released: 'Entradas liberadas',
  payment_sent: 'Pago informado',
  under_review: 'Pendiente validación',
  completed: 'Completada',
  cancelled: 'Cancelada',
  exchange_pending: 'Intercambio pendiente',
  exchange_in_progress: 'Intercambio en curso',
  exchange_ready_to_release: 'Intercambio listo para liberar',
  exchange_accepted: 'Intercambio aceptado',
  issue: 'Con problema'
}

const deliveryLabel = {
  pending: 'Pendiente',
  sent: 'Informó envío',
  received_by_admin: 'Recibido por admin',
  released: 'Liberado',
  not_applicable: 'No aplica'
}

const paymentLabel = {
  pending: 'Pendiente',
  requested: 'Pago solicitado',
  sent: 'Pago informado',
  received: 'Pago recibido',
  not_applicable: 'No aplica'
}

const money = (n, c = 'ARS') => {
  if (n === null || n === undefined) return 'Sin precio'
  return new Intl.NumberFormat('es-AR', { style:'currency', currency:c === 'USD' ? 'USD' : 'ARS', maximumFractionDigits:0 }).format(Number(n))
}

const fmtDate = (d) => {
  if (!d) return 'Fecha a confirmar'
  const date = new Date(d)
  if (isNaN(date)) return d
  return date.toLocaleString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

const flagFiles = {
  ARG:'ar.png', MEX:'mx.png', RSA:'za.png', KOR:'kr.png', CZE:'cz.png', CAN:'ca.png', BIH:'ba.png',
  USA:'us.png', PAR:'py.png', HAI:'ht.png', SCO:'gb-sct.png', AUS:'au.png', TUR:'tr.png', BRA:'br.png',
  MAR:'ma.png', QAT:'qa.png', SUI:'ch.png', CIV:'ci.png', ECU:'ec.png', GER:'de.png', CUR:'cw.png',
  NED:'nl.png', JPN:'jp.png', SWE:'se.png', TUN:'tn.png', KSA:'sa.png', URU:'uy.png', ESP:'es.png',
  CPV:'cv.png', IRN:'ir.png', NZL:'nz.png', BEL:'be.png', EGY:'eg.png', FRA:'fr.png', SEN:'sn.png',
  IRQ:'iq.png', NOR:'no.png', ALG:'dz.png', AUT:'at.png', JOR:'jo.png', GHA:'gh.png', PAN:'pa.png',
  ENG:'gb-eng.png', CRO:'hr.png', POR:'pt.png', COD:'cd.png', UZB:'uz.png', COL:'co.png'
}

const flagImg = (code, className = 'flag-thumb') => {
  const file = flagFiles[code]
  if (!file) return `<span class="${className} flag-placeholder"></span>`
  return `<img class="${className}" src="/flags/${file}" alt="${escapeHtml(code)}" loading="lazy">`
}

const isAdmin = () => ADMIN_EMAILS.includes(state.user?.email) || state.profile?.role === 'admin'
const isVerified = () => state.profile?.verification_status === 'verified'
const canOperate = () => Boolean(state.user && isVerified())
const verificationDisclaimer = () => state.user && !isVerified() ? `
  <div class="verification-disclaimer">
    <strong>Verificá tu identidad para operar</strong>
    <span>Hasta que completes la verificación enviando la documentación solicitada y sea aprobada, no vas a poder comprar, vender ni intercambiar entradas.</span>
    <button class="secondary-btn" onclick="window.appActions.setView('profile')">Ir a verificación</button>
  </div>` : ''

const sellerProfile = (sellerId) => state.users.find(u => u.id === sellerId) || {}
const userProfile = (userId) => state.users.find(u => u.id === userId) || {}
const userName = (userId) => {
  const u = userProfile(userId)
  return `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'Usuario'
}
const sellerName = (sellerId) => {
  const seller = sellerProfile(sellerId)
  const name = `${seller.first_name || ''} ${seller.last_name || ''}`.trim()
  return name || 'Vendedor verificado'
}
const verificationBadgeHtml = (verified) => verified ? '<img class="verified-badge" src="/verified-badge.png" alt="Cuenta verificada" loading="lazy">' : ''
const verifiedBadge = (sellerId) => verificationBadgeHtml(sellerProfile(sellerId).verification_status === 'verified')
const sellerReputation = (sellerId) => {
  const seller = sellerProfile(sellerId)
  const sales = Number(seller.seller_sales_count || 0)
  const reviews = Number(seller.seller_reviews_count || 0)
  if (!sales && !reviews) return 'Sin ventas todavía'
  const rating = seller.seller_rating ? Number(seller.seller_rating).toFixed(1) : 'Sin calificar'
  return `★ ${rating} · ${sales} ventas · ${reviews} opiniones`
}

function stopCameraStream() {
  activeCameraStream?.getTracks().forEach(track => track.stop())
  activeCameraStream = null
}

const matchLabel = (m) => `#${m.match_number} ${m.home_code || m.home_team} vs ${m.away_code || m.away_team} · ${m.city || ''}`
const listingTicketSummary = (l = {}) => {
  const m = state.matches.find(match => Number(match.id) === Number(l.match_id)) || {}
  return `${m.match_number ? `#${m.match_number} ` : ''}${m.home_code || m.home_team || '-'} vs ${m.away_code || m.away_team || '-'} · Cat. ${l.category || '-'} · Cant. ${l.quantity || 1}${l.sector ? ` · Sector ${l.sector}` : ''}${l.seats ? ` · Asientos ${l.seats}` : ''}`
}

const exchangeWantedSummary = (l = {}) => {
  const matches = l.exchange_targets?.matches?.length ? l.exchange_targets.matches.join(' / ') : ''
  const text = l.exchange_targets?.text || ''
  return [matches, text].filter(Boolean).join(' · ') || 'Entradas a coordinar en el chat'
}

const matchPickerOption = (m, target) => `
  <button class="match-option" type="button" data-search="${escapeHtml(`${m.match_number} ${m.home_team} ${m.away_team} ${m.home_code} ${m.away_code} ${m.city} ${m.stadium}`.toLowerCase())}" onclick="window.appActions.pickMatch('${target}','${m.id}')">
    <span class="match-option-flags">${flagImg(m.home_code, 'flag-mini')}${flagImg(m.away_code, 'flag-mini')}</span>
    <span><strong>${matchLabel(m)}</strong><small>${m.group_name || phaseLabels[m.phase] || ''} · ${fmtDate(m.match_date)}</small></span>
  </button>`

function matchPicker(target, label, selectedId = '', multiple = false) {
  const selected = state.matches.find(m => String(m.id) === String(selectedId))
  return `
    <div class="field match-picker" data-target="${target}">
      <label>${label}</label>
      <input id="${target}Search" class="input" placeholder="Buscar por partido, país, ciudad o estadio..." oninput="window.appActions.filterMatchPicker('${target}')" onfocus="window.appActions.openMatchPicker('${target}')" autocomplete="off">
      <input id="${target}" type="hidden" value="${selectedId || ''}">
      <div id="${target}Selected" class="${multiple ? 'selected-matches' : 'selected-match'}">${selected ? matchPickerOption(selected, target) : `<span class="meta">${multiple ? 'Seleccioná uno o más partidos' : 'Seleccioná un partido'}</span>`}</div>
      <div id="${target}Options" class="match-options">${state.matches.map(m => matchPickerOption(m, target)).join('')}</div>
    </div>`
}

function closeMessageModal(result = true) {
  const modal = document.getElementById('messageRoot')
  const resolver = modal?._resolver
  modal?.remove()
  if (resolver) resolver(result)
}

function showMessage(message, { title = 'Aviso', tone = 'info' } = {}) {
  return new Promise(resolve => {
    let root = document.getElementById('messageRoot')
    if (!root) {
      root = document.createElement('div')
      root.id = 'messageRoot'
      document.body.appendChild(root)
    }
    root._resolver = resolve
    root.innerHTML = `
      <div class="modal-backdrop show message-backdrop" onclick="if(event.target.classList.contains('message-backdrop')) window.appActions.closeMessageModal()">
        <div class="message-modal ${tone}">
          <div class="message-topline"></div>
          <div class="message-icon">${tone === 'success' ? '✓' : tone === 'error' ? '!' : 'i'}</div>
          <div class="message-copy">
            <h2>${escapeHtml(title)}</h2>
            <p>${escapeHtml(message)}</p>
          </div>
          <button class="pill-btn primary message-action" onclick="window.appActions.closeMessageModal()">Aceptar</button>
        </div>
      </div>`
  })
}

function showLoading(message = 'Cargando...') {
  let root = document.getElementById('loadingRoot')
  if (!root) {
    root = document.createElement('div')
    root.id = 'loadingRoot'
    document.body.appendChild(root)
  }
  root.innerHTML = `
    <div class="loading-backdrop">
      <div class="loading-card">
        <img src="/mundial_2026.png" alt="Copa del Mundo" class="loading-cup">
        <strong>${escapeHtml(message)}</strong>
      </div>
    </div>`
}

function hideLoading() {
  document.getElementById('loadingRoot')?.remove()
}

async function sendEmailNotice(userId, subject, message, actionUrl = window.location.origin) {
  if (!userId || !subject || !message) return
  try {
    const { error } = await supabase.functions.invoke('send-email', {
      body: { user_id: userId, subject, message, action_url: actionUrl }
    })
    if (error) console.warn('No se pudo enviar email', error)
  } catch (error) {
    console.warn('No se pudo enviar email', error)
  }
}

async function notifyUser(userId, message, subject = 'Nuevo aviso en Digital Guale') {
  if (!userId || !message) return
  const { error } = await supabase.from('notifications').insert({ user_id:userId, message })
  if (error) {
    console.warn('No se pudo crear la notificación', error)
    return
  }
  await sendEmailNotice(userId, subject, message)
}

async function notifyUsers(notices) {
  await Promise.all((notices || []).map(notice => notifyUser(notice.user_id, notice.message, notice.subject)))
}

function askQuantity(max) {
  return new Promise(resolve => {
    let root = document.getElementById('messageRoot')
    if (!root) {
      root = document.createElement('div')
      root.id = 'messageRoot'
      document.body.appendChild(root)
    }
    root._resolver = resolve
    root.innerHTML = `
      <div class="modal-backdrop show message-backdrop">
        <div class="message-modal">
          <div class="message-icon">#</div>
          <h2>Cantidad de entradas</h2>
          <p>Disponibles: ${Number(max)}</p>
          <input id="quantityPrompt" class="input" type="number" min="1" max="${Number(max)}" value="1" />
          <div class="footer-actions">
            <button class="secondary-btn" onclick="window.appActions.closeMessageModal(null)">Cancelar</button>
            <button class="pill-btn primary" onclick="window.appActions.resolveQuantityPrompt()">Continuar</button>
          </div>
        </div>
      </div>`
    setTimeout(() => document.getElementById('quantityPrompt')?.focus(), 0)
  })
}

async function init() {
  const { data: { session } } = await supabase.auth.getSession()
  state.session = session
  state.user = session?.user || null
  if (state.user) await ensureProfile()
  await loadAll()
  render()
  supabase.auth.onAuthStateChange(async (_event, session) => {
    state.session = session
    state.user = session?.user || null
    if (state.user) await ensureProfile()
    await loadAll()
    render()
  })
}

async function ensureProfile() {
  const { data } = await supabase.from('users').select('*').eq('id', state.user.id).maybeSingle()
  if (!data) {
    const meta = state.user.user_metadata || {}
    const fullName = (meta.full_name || meta.name || '').trim().split(' ')
    await supabase.from('users').insert({
      id: state.user.id,
      email: state.user.email,
      first_name: meta.first_name || fullName[0] || '',
      last_name: meta.last_name || fullName.slice(1).join(' ') || '',
      document_type: meta.document_type || '',
      document_number: meta.document_number || '',
      account_status: 'active',
      verification_status: 'not_verified',
      preferred_currency: 'ARS',
      role: ADMIN_EMAILS.includes(state.user.email) ? 'admin' : 'user'
    })
  }
  const { data: profile } = await supabase.from('users').select('*').eq('id', state.user.id).maybeSingle()
  state.profile = profile
}

async function loadAll() {
  const [m, l] = await Promise.all([
    supabase.from('matches').select('*').order('match_number', { ascending:true }),
    supabase.from('listings').select('*').order('created_at', { ascending:false })
  ])
  let users = await supabase.from('users').select('*')
  if (users.error) users = await supabase.from('users').select('id,first_name,last_name,verification_status')
  state.matches = m.data || []
  state.listings = l.data || []
  state.users = users.data || []
  if (state.user) {
    const ordersQuery = isAdmin()
      ? supabase.from('orders').select('*').order('created_at', { ascending:false })
      : supabase.from('orders').select('*').or(`buyer_id.eq.${state.user.id},seller_id.eq.${state.user.id}`).order('created_at', { ascending:false })
    const [orders, notifs] = await Promise.all([
      ordersQuery,
      supabase.from('notifications').select('*').eq('user_id', state.user.id).order('created_at', { ascending:false })
    ])
    state.orders = orders.data || []
    state.notifications = notifs.data || []
  } else {
    state.orders = []
    state.notifications = []
  }
}

function minPrice(matchId) {
  const arr = state.listings.filter(l => Number(l.match_id) === Number(matchId) && l.status === 'active' && l.type !== 'exchange' && Number(l.quantity) > 0)
  if (!arr.length) return null
  const min = Math.min(...arr.map(l => Number(l.price || 0)))
  const c = arr.find(l => Number(l.price) === min)?.currency || 'ARS'
  return money(min, c)
}

function setView(v) {
  state.view = v
  if (v !== 'match') {
    state.selectedMatch = null
    state.selectedMatchId = null
  }
  render()
}

function setTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark'
  localStorage.setItem('theme', state.theme)
  document.body.classList.toggle('dark', state.theme === 'dark')
  render()
}

function nav() {
  const unread = state.notifications.filter(n=>!n.read).length
  return `
  <div class="topbar">
    <div class="topbar-inner">
      <div class="brand" onclick="window.appActions.setView('home')">
        <div class="brand-badge"><img src="/mundial_2026.png" alt="Mundial 2026"></div>
        <div><span>Tickets 2026</span><small style="color:var(--muted);font-weight:800">Marketplace seguro</small></div>
      </div>
      <div class="nav">
        <button class="${state.view==='home'?'active':''}" onclick="window.appActions.setView('home')">Comprar</button>
        <button class="${state.view==='sell'?'active':''}" onclick="window.appActions.requireLogin('sell')">Vender / Intercambiar</button>
        <button class="${state.view==='my'?'active':''}" onclick="window.appActions.requireLogin('my')">Mis operaciones</button>
        <button class="${state.view==='profile'?'active':''}" onclick="window.appActions.requireLogin('profile')">Mi perfil</button>
        ${isAdmin()?`<button class="${state.view==='admin'?'active':''}" onclick="window.appActions.setView('admin')">Admin</button>`:''}
        <button class="pill-btn ghost" onclick="window.appActions.toggleTheme()">${state.theme==='dark'?'☀️ Claro':'🌙 Oscuro'}</button>
        ${state.user?`<button class="pill-btn ghost" onclick="window.appActions.setView('notifications')">🔔 ${unread}</button><button class="pill-btn ghost" onclick="window.appActions.logout()">Salir</button>`:`<button class="pill-btn primary" onclick="window.appActions.setView('auth')">Ingresar</button>`}
      </div>
    </div>
  </div>`
}

function home() {
  const phases = [...new Set(state.matches.map(m => normalizedPhase(m.phase || 'groups')))].sort((a,b) => phaseRank(a) - phaseRank(b))
  const venues = [...new Set(state.matches.map(m => `${m.city || ''} - ${m.stadium || ''}`))]
  return `
  <div class="container">
    <section class="hero">
      <div class="hero-main">
        <img class="hero-art" src="/logo_fifa_2026_0.png" alt="FIFA World Cup 2026">
        <div class="hero-overlay">
          <h1>Compra, vende e intercambia entradas del Mundial 2026</h1>
          <p>Buscá partidos por país o sede. Las operaciones quedan registradas y custodiadas dentro de la plataforma.</p>
        </div>
      </div>
      <div class="hero-side">
        <h3>Operación segura</h3>
        <p class="meta">El vendedor informa el medio de cobro, el comprador avisa el pago y el administrador puede validar el proceso desde el panel.</p>
        <div class="stats-grid" style="grid-template-columns:1fr 1fr;margin-bottom:0">
          <div class="stat"><strong>${state.matches.length}</strong><span>Partidos</span></div>
          <div class="stat"><strong>${state.listings.filter(l=>l.status==='active').length}</strong><span>Ofertas</span></div>
        </div>
      </div>
    </section>
    <div class="filters">
      <input class="input" id="q" placeholder="Buscar por país, código, ciudad o estadio..." oninput="window.appActions.applyFilters()" />
      <select class="select" id="phaseFilter" onchange="window.appActions.applyFilters()"><option value="">Todas las fases</option>${phases.map(p=>`<option value="${p}">${phaseLabels[p]||p}</option>`).join('')}</select>
      <select class="select" id="venueFilter" onchange="window.appActions.applyFilters()"><option value="">Todas las sedes</option>${venues.map(v=>`<option value="${v}">${v}</option>`).join('')}</select>
      <select class="select" id="countryFilter" onchange="window.appActions.applyFilters()"><option value="">Todos los países</option>${[...new Set(state.matches.flatMap(m=>[m.home_code,m.away_code]).filter(Boolean))].sort().map(c=>`<option value="${c}">${c}</option>`).join('')}</select>
    </div>
    <div id="matchesWrap">${matchesHtml(state.matches)}</div>
  </div>`
}

function matchesHtml(matches) {
  if (!matches.length) return `<div class="empty">No hay partidos cargados todavía.</div>`
  const grouped = {}
  matches.forEach(m => {
    const key = normalizedPhase(m.phase || 'groups')
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(m)
  })
  return Object.entries(grouped).sort(([a], [b]) => phaseRank(a) - phaseRank(b)).map(([phase, arr]) => `
    <section class="phase-section">
      <div class="phase-title"><h2>${phaseLabels[phase] || phase}</h2><span class="badge phase-badge">${arr.length} partidos</span></div>
      <div class="match-grid">
        ${arr.map(matchCard).join('')}
      </div>
    </section>
  `).join('')
}

function matchCard(m) {
  const price = minPrice(m.id)
  return `
  <article class="match-card">
    <div class="match-number">${m.match_number || m.id}</div>
    <div class="match-info">
      <h3 class="teams-line">
        <span class="team-chip">${flagImg(m.home_code)}<span>${m.home_code || m.home_team}</span></span>
        <span class="vs-text">vs</span>
        <span class="team-chip">${flagImg(m.away_code)}<span>${m.away_code || m.away_team}</span></span>
      </h3>
      <div class="meta">${m.group_name || phaseLabels[m.phase] || ''}</div>
      <div class="meta">📍 ${m.city || ''} - ${m.stadium || ''}</div>
      <div class="meta">🗓️ ${fmtDate(m.match_date)}</div>
      <div class="match-actions">
        <button class="price-btn" onclick="window.appActions.openMatch('${m.id}')">${price ? `Desde ${price}` : 'Ver partido'}</button>
        <button class="secondary-btn" onclick="window.appActions.requireLogin('sell','${m.id}')">Vender</button>
      </div>
    </div>
  </article>`
}

function authView() {
  const isRegister = state.authMode === 'register'
  return `
  <div class="container">
    <div class="auth-shell">
      <div class="panel auth-panel">
        <h2>${isRegister ? 'Crear cuenta' : 'Ingresar'}</h2>
        <p class="meta">${isRegister ? 'Completá tus datos para publicar, comprar e intercambiar entradas.' : 'Entrá con tu email o con una cuenta social.'}</p>
        ${isRegister ? `
        <div class="form-grid">
          <div class="field"><label>Nombre</label><input id="regFirst" class="input"></div>
          <div class="field"><label>Apellido</label><input id="regLast" class="input"></div>
          <div class="field"><label>Email</label><input id="regEmail" class="input"></div>
          <div class="field"><label>Contraseña</label><input id="regPass" type="password" class="input"></div>
          <div class="field"><label>Tipo documento</label><select id="regDocType" class="select"><option>DNI</option><option>Pasaporte</option><option>CI</option></select></div>
          <div class="field"><label>Número documento</label><input id="regDoc" class="input"></div>
        </div>
        <div class="auth-actions"><button class="pill-btn primary" onclick="window.appActions.register()">Crear cuenta</button></div>
        <button class="link-btn" onclick="window.appActions.setAuthMode('login')">Ya tengo cuenta</button>
        ` : `
        <div class="field"><label>Email</label><input id="loginEmail" class="input"></div>
        <div class="field"><label>Contraseña</label><input id="loginPass" type="password" class="input"></div>
        <div class="auth-actions"><button class="pill-btn primary" onclick="window.appActions.login()">Ingresar</button></div>
        <div class="social-login">
          <button class="oauth-btn" onclick="window.appActions.oauthLogin('google')">Google</button>
          <button class="oauth-btn" onclick="window.appActions.oauthLogin('apple')">Apple</button>
          <button class="oauth-btn" onclick="window.appActions.oauthLogin('facebook')">Facebook</button>
        </div>
        <button class="link-btn" onclick="window.appActions.setAuthMode('register')">No tengo cuenta, registrarme</button>
        `}
      </div>
    </div>
  </div>`
}

function matchDetail() {
  const m = state.matches.find(match => String(match.id) === String(state.selectedMatchId)) || state.selectedMatch
  if (!m) return `<div class="container"><div class="empty">Seleccioná un partido para ver el detalle.</div></div>`
  const listings = state.listings.filter(l => Number(l.match_id) === Number(m.id) && l.status === 'active')
  const sale = listings.filter(l=>l.type !== 'exchange')
  const exch = listings.filter(l=>l.type === 'exchange')
  const tabs = state.openMatchTabs.map(id => state.matches.find(match => String(match.id) === String(id))).filter(Boolean)
  return `
  <div class="container">
    <div class="match-workspace">
      <div class="match-toolbar">
        <button class="secondary-btn" onclick="window.appActions.setView('home')">← Volver</button>
        <div class="match-tabs" role="tablist">
          ${tabs.map(tab => `
            <button class="match-tab ${String(tab.id)===String(m.id)?'active':''}" onclick="window.appActions.switchMatchTab('${tab.id}')">
              ${flagImg(tab.home_code, 'flag-mini')}<span>#${tab.match_number} ${tab.home_code} vs ${tab.away_code}</span>${flagImg(tab.away_code, 'flag-mini')}
              <span class="tab-close" onclick="event.stopPropagation(); window.appActions.closeMatchTab('${tab.id}')">×</span>
            </button>
          `).join('')}
        </div>
      </div>
      <div class="match-detail-panel">
        <div class="ticket-match-hero">
          <div class="team-large">
            ${flagImg(m.home_code, 'flag-large')}
            <h2>${m.home_team || m.home_code}</h2>
            <span>${m.home_code || ''}</span>
          </div>
          <div class="match-center">
            <div class="match-number">${m.match_number}</div>
            <strong>vs</strong>
            <p>${m.group_name || phaseLabels[m.phase] || ''}</p>
          </div>
          <div class="team-large">
            ${flagImg(m.away_code, 'flag-large')}
            <h2>${m.away_team || m.away_code}</h2>
            <span>${m.away_code || ''}</span>
          </div>
        </div>
        <div class="match-event-meta">
          <span>📍 ${m.city} - ${m.stadium}</span>
          <span>🗓️ ${fmtDate(m.match_date)}</span>
        </div>
      </div>
    </div>
    </div>
    <br>
    <div class="grid-2">
      <div class="panel">
        <h2>Entradas disponibles</h2>
        <div class="list">
          ${sale.length ? sale.map(l=>listingCard(l,true)).join('') : `<div class="empty">No hay entradas publicadas para compra.</div>`}
        </div>
      </div>
      <div class="panel">
        <h2>Ofertas de intercambio</h2>
        <div class="list">
          ${exch.length ? exch.map(l=>listingCard(l,false)).join('') : `<div class="empty">No hay intercambios publicados.</div>`}
        </div>
      </div>
    </div>
  </div>`
}

function listingCard(l, canBuy, ownerView = false) {
  const exchangeTargets = l.exchange_targets?.matches?.length
    ? l.exchange_targets.matches.join(', ')
    : l.exchange_targets?.text
  return `<div class="item">
    <div class="listing-head">
      <strong>${l.type==='exchange'?'Intercambio':'Venta'} · Categoría ${l.category}</strong>
      <span class="seller-rating">${sellerReputation(l.seller_id)}</span>
    </div>
    <p class="meta">Vendedor: ${escapeHtml(sellerName(l.seller_id))} ${verifiedBadge(l.seller_id)}</p>
    <p class="meta">Cantidad: ${l.quantity} · ${l.price ? money(l.price,l.currency) : 'Sin precio'}${l.sector ? ` · Sector ${escapeHtml(l.sector)}` : ''}${l.seats ? ` · Asientos ${escapeHtml(l.seats)}` : ''} ${l.type==='exchange' && exchangeTargets ? `<br>Busca: ${escapeHtml(exchangeTargets)}`:''}</p>
    ${ownerView ? '<span class="badge ok">Activa</span>' : (canBuy?`<button class="price-btn" onclick="window.appActions.startBuy('${l.id}')">Comprar</button>`:`<button class="secondary-btn" onclick="window.appActions.startExchange('${l.id}')">Ofrecer intercambio</button>`)}
  </div>`
}

function sellView(prefMatchId='') {
  const mine = state.listings.filter(l=>l.seller_id === state.user?.id && l.status === 'active')
  return `
  <div class="container">
    <div class="panel sell-dashboard">
      <div class="section-head">
        <div>
          <h1>Vender / Intercambiar</h1>
          <p class="meta">Acá ves únicamente tus publicaciones activas.</p>
        </div>
        <button class="pill-btn primary" onclick="window.appActions.openListingModal('${prefMatchId || ''}')" ${canOperate() ? '' : 'disabled'}>Nueva publicación</button>
      </div>
      <div class="list">${mine.length ? mine.map(l=>listingCard(l,false,true)).join('') : `<div class="empty">No tenés publicaciones activas en este momento.</div>`}</div>
    </div>
  </div>`
}

function listingForm(prefMatchId='') {
  return `
    <div class="form-grid">
      <div class="field"><label>Tipo</label><select id="sellType" class="select" onchange="window.appActions.toggleExchangeFields()"><option value="sale">Vender</option><option value="exchange">Intercambiar</option></select></div>
      ${matchPicker('sellMatch', 'Partido de tu entrada', prefMatchId)}
      <div class="field"><label>Categoría</label><select id="sellCat" class="select"><option>1</option><option>2</option><option>3</option><option>4</option></select></div>
      <div class="field"><label>Cantidad</label><input id="sellQty" type="number" min="1" class="input" value="1"></div>
      <div class="field"><label>Precio por entrada</label><input id="sellPrice" type="number" class="input" placeholder="Ej: 390000"></div>
      <div class="field"><label>Sector</label><input id="sellSector" class="input" placeholder="Ej: 120"></div>
      <div class="field"><label>Asientos</label><input id="sellSeats" class="input" placeholder="Ej: 5, 6 y 7"></div>
      <div class="field"><label>Moneda</label><select id="sellCurrency" class="select"><option>ARS</option><option>USD</option></select></div>
      <div class="field"><label>Método de cobro</label><select id="payMethod" class="select"><option>Alias</option><option>CBU</option><option>USD</option><option>Wallet</option></select></div>
      <div class="field"><label>Alias / CBU / dato de cobro</label><input id="payValue" class="input"></div>
    </div>
    <div id="exchangeFields" style="display:none;margin-top:14px">
      ${matchPicker('exchangeMatchIds', 'Partidos que buscás', '', true)}
      <div class="field" style="margin-top:14px"><label>Detalle adicional del intercambio</label><textarea id="exchangeTargets" rows="3" placeholder="Ej: Categoría 1 o 2, preferentemente cerca del sector 120"></textarea></div>
    </div>
    <div class="footer-actions"><button class="pill-btn primary" onclick="window.appActions.createListing()">Publicar</button></div>`
}

function verificationRejectReason(userId) {
  return `
    <div class="field rejection-reason">
      <label>Motivo para el usuario</label>
      <textarea id="verificationReason_${userId}" class="input" rows="3" placeholder="Ej: La imagen del documento no se ve nítida. Por favor volvé a subirla con mejor luz."></textarea>
      <small>Este mensaje le aparecerá al usuario como notificación.</small>
    </div>`
}

function openListingModalHtml(prefMatchId='') {
  return `
    <div class="modal-backdrop show" onclick="if(event.target.classList.contains('modal-backdrop')) window.appActions.closeVerificationModal()">
      <div class="modal listing-modal">
        <div class="modal-header"><h2>Nueva publicación</h2><button class="secondary-btn" onclick="window.appActions.closeVerificationModal()">Cerrar</button></div>
        <div class="modal-body">
          ${listingForm(prefMatchId)}
        </div>
      </div>
    </div>`
}

function profileView() {
  const p = state.profile || {}
  const personalFields = [['first_name','Nombre'],['last_name','Apellido'],['birth_date','Fecha de nacimiento'],['nationality','Nacionalidad'],['sex','Sexo']]
  const documentFields = [['document_type','Tipo de documento'],['document_number','Número de documento'],['document_country','País emisión documento']]
  const contactFields = [['phone','Teléfono'],['country','País'],['state','Provincia/Estado'],['city','Ciudad'],['address','Dirección']]
  const preferenceFields = [['timezone','Timezone'],['preferred_language','Idioma preferido'],['preferred_currency','Divisa preferida']]
  const locked = isVerified()
  const lockedAttrs = locked ? 'disabled title="Este dato queda bloqueado después de verificar tu identidad."' : ''
  const fieldHtml = (fields, lockSensitive = false) => fields.map(([k,label])=>`<div class="field"><label>${label}</label><input class="input" id="profile_${k}" value="${escapeHtml(p[k] || '')}" ${lockSensitive ? lockedAttrs : ''}></div>`).join('')
  const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim()
  const uploadLockCopy = 'Cuenta verificada: este paso queda bloqueado para proteger tu identidad.'
  return `<div class="container">
    <div class="profile-header">
      <div class="avatar-frame">${p.avatar_url ? `<img src="${escapeHtml(p.avatar_url)}" alt="Foto de perfil">` : `<span>${escapeHtml((p.first_name || state.user?.email || 'U').slice(0,1).toUpperCase())}</span>`}</div>
      <div>
        <h1>${escapeHtml(fullName || 'Mi perfil')} ${verificationBadgeHtml(locked)}</h1>
        <p class="meta">Completá tus datos y verificá tu identidad para operar con mayor confianza.</p>
        <span class="badge ${p.verification_status === 'verified' ? 'ok' : 'warn'}">${p.verification_status === 'verified' ? `Cuenta verificada ${verificationBadgeHtml(true)}` : 'Verificación pendiente'}</span>
      </div>
    </div>
    <div class="profile-grid">
      <section class="profile-module">
        <h2>Identidad</h2>
        <div class="form-grid">${fieldHtml(personalFields, true)}</div>
      </section>
      <section class="profile-module">
        <h2>Verificación</h2>
        <p class="meta">Subí tu foto de perfil, el frente de tu documento y completá una prueba de vida con cámara. Un administrador revisará que nombre, foto y número de documento coincidan.</p>
        <div class="form-grid">${fieldHtml(documentFields, true)}</div>
        <div class="document-warning">
          El documento debe verse nítido y con buena luz. Podés tapar datos sensibles que no necesitamos, como número de trámite, códigos secundarios o domicilio. Deben quedar visibles foto, nombres y número de DNI/documento.
        </div>
        <div class="verification-steps">
          <button class="upload-card" type="button" onclick="window.appActions.openUploadModal('avatar')" ${locked ? 'disabled' : ''}>
            <strong>1. Foto de perfil</strong>
            <span>${locked ? uploadLockCopy : (p.avatar_url ? 'Foto cargada' : 'Buena luz, rostro visible, JPG/PNG/WebP hasta 8 MB.')}</span>
          </button>
          <button class="upload-card" type="button" onclick="window.appActions.openUploadModal('document')" ${locked ? 'disabled' : ''}>
            <strong>2. Documento</strong>
            <span>${locked ? uploadLockCopy : (p.identity_document_path ? `Documento recibido · ${p.identity_document_status || 'pending_review'}` : 'Imagen o PDF, máximo 8 MB')}</span>
          </button>
          <button class="upload-card camera-card" type="button" onclick="window.appActions.startLivenessCheck()" ${locked ? 'disabled' : ''}>
            <strong>3. Prueba de vida</strong>
            <span>${locked ? uploadLockCopy : (p.liveness_side_path && p.liveness_front_path ? `2 tomas recibidas · ${p.liveness_status || 'submitted'}` : 'Captura automática: perfil y frente.')}</span>
          </button>
        </div>
      </section>
      <section class="profile-module">
        <h2>Contacto</h2>
        <div class="form-grid">${fieldHtml(contactFields)}</div>
      </section>
      <section class="profile-module">
        <h2>Preferencias y seguridad</h2>
        <div class="form-grid">
          ${fieldHtml(preferenceFields)}
          <div class="field"><label>2FA habilitado</label><select id="profile_two_factor_enabled" class="select"><option value="false" ${!p.two_factor_enabled?'selected':''}>NO</option><option value="true" ${p.two_factor_enabled?'selected':''}>SÍ</option></select></div>
          <div class="field"><label>Avisos por email</label><select id="profile_email_notifications" class="select"><option value="true" ${p.email_notifications !== false?'selected':''}>SÍ</option><option value="false" ${p.email_notifications === false?'selected':''}>NO</option></select></div>
          <div class="field"><label>Estado verificación</label><input disabled class="input" value="${p.verification_status || 'not_verified'}"></div>
        </div>
      </section>
    </div>
    <div class="profile-save"><button class="pill-btn primary" onclick="window.appActions.saveProfile()">Guardar perfil</button></div>
  </div>`
}

function myView() {
  const listings = state.listings.filter(l=>l.seller_id === state.user?.id)
  const orders = state.orders
  return `<div class="container"><div class="grid-2">
    <div class="panel"><h2>Mis compras / operaciones</h2><div class="list">${orders.length?orders.map(orderCard).join(''):`<div class="empty">Todavía no tenés operaciones.</div>`}</div></div>
    <div class="panel"><h2>Mis publicaciones</h2><div class="list">${listings.length?listings.map(l=>listingCard(l,false)).join(''):`<div class="empty">No tenés publicaciones.</div>`}</div></div>
  </div></div>`
}

function orderCard(o) {
  const l = state.listings.find(x=>x.id===o.listing_id)
  const m = state.matches.find(x=>Number(x.id)===Number(l?.match_id))
  return `<div class="item">
    <strong>Operación #${String(o.id).slice(0,8)} · ${statusLabel[o.status] || o.status}</strong>
    <p class="meta">${m?`#${m.match_number} ${m.home_code} vs ${m.away_code}`:'Partido'} · Cantidad ${o.quantity || 1} · Total ${money(o.total || l?.price || 0, l?.currency || 'ARS')}</p>
    <button class="secondary-btn" onclick="window.appActions.openOrder('${o.id}')">Ver detalle / chat</button>
  </div>`
}

function operationFlowCard(o) {
  const l = state.listings.find(x=>x.id===o.listing_id) || {}
  const isExchange = l.type === 'exchange' || String(o.status || '').startsWith('exchange')
  const seller = userName(o.seller_id)
  const buyer = userName(o.buyer_id)
  const ticket = listingTicketSummary(l)
  const wanted = exchangeWantedSummary(l)
  if (isExchange) {
    return `<div class="operation-card">
      <div class="operation-head">
        <div><strong>Intercambio #${String(o.id).slice(0,8)}</strong><p class="meta">${statusLabel[o.status] || o.status}</p></div>
        <button class="secondary-btn" onclick="window.appActions.openOrder('${o.id}')">Gestionar</button>
      </div>
      <div class="flow-grid">
        <div class="flow-leg"><span>Entrega ${escapeHtml(seller)} a ${escapeHtml(buyer)}</span><strong>${escapeHtml(ticket)}</strong><em>${deliveryLabel[o.seller_delivery_status || 'pending']} · Admin: ${deliveryLabel[o.admin_seller_delivery_status || 'pending']}</em></div>
        <div class="flow-leg"><span>Entrega ${escapeHtml(buyer)} a ${escapeHtml(seller)}</span><strong>${escapeHtml(wanted)}</strong><em>${deliveryLabel[o.buyer_delivery_status || 'pending']} · Admin: ${deliveryLabel[o.admin_buyer_delivery_status || 'pending']}</em></div>
      </div>
    </div>`
  }
  return `<div class="operation-card">
    <div class="operation-head">
      <div><strong>Venta #${String(o.id).slice(0,8)}</strong><p class="meta">${statusLabel[o.status] || o.status}</p></div>
      <button class="secondary-btn" onclick="window.appActions.openOrder('${o.id}')">Gestionar</button>
    </div>
    <div class="flow-grid">
      <div class="flow-leg"><span>Vendedor</span><strong>${escapeHtml(seller)}</strong><em>Entrada: ${deliveryLabel[o.seller_delivery_status || 'pending']} · Admin: ${deliveryLabel[o.admin_seller_delivery_status || 'pending']}</em></div>
      <div class="flow-leg"><span>Comprador</span><strong>${escapeHtml(buyer)}</strong><em>Pago: ${paymentLabel[o.buyer_payment_status || 'pending']} · Entrega final: ${deliveryLabel[o.buyer_delivery_status || 'pending']}</em></div>
      <div class="flow-leg full"><span>Entradas que administra la plataforma</span><strong>${escapeHtml(ticket)}</strong><em>Total: ${money(o.total || l.price || 0, l.currency || 'ARS')}</em></div>
    </div>
  </div>`
}

function adminView() {
  if (!isAdmin()) return `<div class="container"><div class="empty">No tenés permisos de admin.</div></div>`
  const pending = state.orders.filter(o=>!['completed','cancelled'].includes(o.status)).length
  const verificationQueue = state.users.filter(u => u.verification_status === 'pending_review' && u.identity_document_path && u.liveness_side_path && u.liveness_front_path)
  const operations = state.orders
  const userRows = [...state.users].sort((a,b)=>`${a.first_name || ''} ${a.last_name || ''}`.localeCompare(`${b.first_name || ''} ${b.last_name || ''}`)).map(u=>`
    <tr>
      <td>${escapeHtml(`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'Usuario')} ${verificationBadgeHtml(u.verification_status === 'verified')}<p class="meta">${escapeHtml(u.email || '')}</p></td>
      <td>${escapeHtml(u.verification_status || 'not_verified')}</td>
      <td>${Number(u.seller_sales_count || 0)} ventas</td>
      <td>★ ${u.seller_rating ? Number(u.seller_rating).toFixed(1) : '0.0'} · ${Number(u.seller_reviews_count || 0)} reseñas</td>
      <td><button class="secondary-btn" onclick="window.appActions.openUserEditor('${u.id}')">Editar</button></td>
    </tr>`).join('')
  return `<div class="container">
    <div class="admin-title">
      <div><h1>Dashboard admin</h1><p class="meta">Control operativo de usuarios, verificaciones y entrega de entradas.</p></div>
      ${verificationQueue.length ? `<span class="admin-alert">! ${verificationQueue.length} verificación${verificationQueue.length === 1 ? '' : 'es'} pendiente${verificationQueue.length === 1 ? '' : 's'}</span>` : '<span class="badge ok">Sin verificaciones pendientes</span>'}
    </div>
    <div class="stats-grid">
      <div class="stat"><strong>${state.matches.length}</strong><span>Partidos</span></div>
      <div class="stat"><strong>${state.listings.length}</strong><span>Publicaciones</span></div>
      <div class="stat"><strong>${state.orders.length}</strong><span>Órdenes</span></div>
      <div class="stat"><strong>${pending}</strong><span>A validar</span></div>
    </div>
    <section class="admin-module panel">
      <div class="section-head"><div><h2>Verificaciones de identidad</h2><p class="meta">Revisá documento, foto y prueba de vida antes de habilitar operaciones.</p></div>${verificationQueue.length ? '<span class="module-dot">!</span>' : ''}</div>
      <table class="admin-table"><thead><tr><th>Usuario</th><th>Documento</th><th>Estado</th><th>Revisión</th></tr></thead><tbody>
        ${verificationQueue.length ? verificationQueue.map(u=>`
          <tr>
            <td>${escapeHtml(`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'Usuario')} ${verificationBadgeHtml(u.verification_status === 'verified')}</td>
            <td>${escapeHtml(u.document_type || '-')} ${escapeHtml(u.document_number || '')}</td>
            <td>${escapeHtml(u.verification_status || 'not_verified')}</td>
            <td><button class="pill-btn primary" onclick="window.appActions.reviewVerification('${u.id}')">Revisar verificación</button></td>
          </tr>
        `).join('') : `<tr><td colspan="4">No hay verificaciones pendientes.</td></tr>`}
      </tbody></table>
    </section>
    <section class="admin-module panel">
      <div class="section-head"><div><h2>Administrador de usuarios</h2><p class="meta">Editá datos, reputación, transacciones y verificación manual.</p></div></div>
      <table class="admin-table"><thead><tr><th>Usuario</th><th>Verificación</th><th>Transacciones</th><th>Reputación</th><th>Acción</th></tr></thead><tbody>
        ${userRows || `<tr><td colspan="5">No hay usuarios cargados.</td></tr>`}
      </tbody></table>
    </section>
    <section class="admin-module panel">
      <div class="section-head"><div><h2>Gestión de ventas e intercambios</h2><p class="meta">Cada tarjeta indica quién envía entradas, quién paga, qué debe recibir el admin y qué se libera a cada usuario.</p></div></div>
      <div class="operation-disclaimer">Venta: el vendedor envía primero las entradas al admin. Cuando el admin confirma recepción, se avisa al comprador para pagar. Cuando el vendedor confirma pago recibido, el admin libera las entradas al comprador. Intercambio: cada usuario envía sus entradas al admin; cuando ambos lados están recibidos, el admin libera cada lote a la contraparte.</div>
      <div class="operations-list">${operations.length ? operations.map(operationFlowCard).join('') : '<div class="empty">No hay operaciones todavía.</div>'}</div>
    </section>
  </div>`
}

function notificationsView() {
  return `<div class="container"><div class="panel"><h2>Notificaciones</h2><div class="list">${state.notifications.length?state.notifications.map(n=>`<div class="item"><strong>${n.read?'':'🔴 '}${n.message}</strong><p class="meta">${fmtDate(n.created_at)}</p></div>`).join(''):`<div class="empty">No tenés notificaciones.</div>`}</div></div></div>`
}

async function openOrder(id) {
  const o = state.orders.find(x=>x.id===id)
  if (!o && !isAdmin()) return
  const order = o || (await supabase.from('orders').select('*').eq('id', id).maybeSingle()).data
  state.selectedOrder = order
  const { data } = await supabase.from('messages').select('*').eq('order_id', id).order('created_at', { ascending:true })
  state.messages = data || []
  renderModal()
}

function renderModal() {
  const o = state.selectedOrder
  if (!o) return
  const l = state.listings.find(x=>x.id===o.listing_id) || {}
  const m = state.matches.find(x=>Number(x.id)===Number(l.match_id)) || {}
  const isExchange = l.type === 'exchange' || String(o.status || '').startsWith('exchange')
  const seller = userName(o.seller_id)
  const buyer = userName(o.buyer_id)
  const sellerTicket = listingTicketSummary(l)
  const buyerTicket = exchangeWantedSummary(l)
  const saleSteps = `
    <div class="operation-disclaimer">Flujo de venta: 1. El vendedor envía las entradas al admin. 2. El admin confirma recepción y avisa al comprador que puede pagar. 3. El comprador informa pago. 4. El vendedor confirma que recibió el pago. 5. El admin libera las entradas al comprador.</div>
    <div class="flow-grid">
      <div class="flow-leg"><span>Debe enviar entradas al admin</span><strong>${escapeHtml(seller)}</strong><em>${escapeHtml(sellerTicket)} · Estado: ${deliveryLabel[o.seller_delivery_status || 'pending']}</em></div>
      <div class="flow-leg"><span>Debe pagar al vendedor cuando el admin confirme entradas</span><strong>${escapeHtml(buyer)}</strong><em>Pago: ${paymentLabel[o.buyer_payment_status || 'pending']} · Recibe: ${deliveryLabel[o.buyer_delivery_status || 'pending']}</em></div>
    </div>`
  const exchangeSteps = `
    <div class="operation-disclaimer">Flujo de intercambio: cada usuario envía sus entradas al admin. Cuando el admin tenga ambos lotes, libera las entradas del usuario 1 al usuario 2 y las del usuario 2 al usuario 1.</div>
    <div class="flow-grid">
      <div class="flow-leg"><span>${escapeHtml(seller)} entrega a ${escapeHtml(buyer)}</span><strong>${escapeHtml(sellerTicket)}</strong><em>Usuario: ${deliveryLabel[o.seller_delivery_status || 'pending']} · Admin: ${deliveryLabel[o.admin_seller_delivery_status || 'pending']}</em></div>
      <div class="flow-leg"><span>${escapeHtml(buyer)} entrega a ${escapeHtml(seller)}</span><strong>${escapeHtml(buyerTicket)}</strong><em>Usuario: ${deliveryLabel[o.buyer_delivery_status || 'pending']} · Admin: ${deliveryLabel[o.admin_buyer_delivery_status || 'pending']}</em></div>
    </div>`
  const userActions = !isAdmin() ? `
    <div class="footer-actions">
      ${!isExchange && state.user?.id === o.seller_id ? `<button class="pill-btn primary" onclick="window.appActions.updateOrderFlow('${o.id}','seller_delivery_status','sent','seller_ticket_sent')">Ya envié las entradas al admin</button><button class="pill-btn primary" onclick="window.appActions.updateOrderFlow('${o.id}','seller_payment_status','received','payment_confirmed')">Confirmo pago recibido</button>` : ''}
      ${!isExchange && state.user?.id === o.buyer_id ? `<button class="pill-btn primary" onclick="window.appActions.updateOrderFlow('${o.id}','buyer_payment_status','sent','buyer_payment_sent')">Ya realicé el pago</button>` : ''}
      ${isExchange && state.user?.id === o.seller_id ? `<button class="pill-btn primary" onclick="window.appActions.updateOrderFlow('${o.id}','seller_delivery_status','sent','exchange_in_progress')">Ya envié mis entradas al admin</button>` : ''}
      ${isExchange && state.user?.id === o.buyer_id ? `<button class="pill-btn primary" onclick="window.appActions.updateOrderFlow('${o.id}','buyer_delivery_status','sent','exchange_in_progress')">Ya envié mis entradas al admin</button>` : ''}
    </div>` : ''
  const adminActions = isAdmin() ? `
    <div class="footer-actions">
      ${!isExchange ? `<button class="pill-btn primary" onclick="window.appActions.updateOrderFlow('${o.id}','admin_seller_delivery_status','received_by_admin','awaiting_buyer_payment')">Confirmar entradas recibidas y avisar pago</button><button class="pill-btn primary" onclick="window.appActions.updateOrderFlow('${o.id}','buyer_delivery_status','released','completed')">Liberar entradas al comprador</button>` : ''}
      ${isExchange ? `<button class="pill-btn primary" onclick="window.appActions.updateOrderFlow('${o.id}','admin_seller_delivery_status','received_by_admin','exchange_in_progress')">Recibí entradas de ${escapeHtml(seller)}</button><button class="pill-btn primary" onclick="window.appActions.updateOrderFlow('${o.id}','admin_buyer_delivery_status','received_by_admin','exchange_ready_to_release')">Recibí entradas de ${escapeHtml(buyer)}</button><button class="pill-btn primary" onclick="window.appActions.completeExchange('${o.id}')">Liberar ambos lotes</button>` : ''}
      <button class="pill-btn danger" onclick="window.appActions.updateOrder('${o.id}','issue')">Marcar problema</button>
    </div>` : ''
  const html = `
    <div class="modal-backdrop show" onclick="if(event.target.classList.contains('modal-backdrop')) window.appActions.closeModal()">
      <div class="modal">
        <div class="modal-header"><h2>Operación #${String(o.id).slice(0,8)}</h2><button class="secondary-btn" onclick="window.appActions.closeModal()">Cerrar</button></div>
        <div class="modal-body">
          <div class="grid-2">
            <div class="panel" style="box-shadow:none"><h3>Detalle</h3>
              <p><strong>Tipo:</strong> ${isExchange ? 'Intercambio' : 'Venta'}</p>
              <p><strong>Vendedor / usuario 1:</strong> ${escapeHtml(seller)}</p>
              <p><strong>Comprador / usuario 2:</strong> ${escapeHtml(buyer)}</p>
              <p><strong>Partido:</strong> #${m.match_number || ''} ${m.home_code || ''} vs ${m.away_code || ''}</p>
              <p><strong>Categoría:</strong> ${l.category || '-'}</p>
              <p><strong>Sector:</strong> ${l.sector || '-'}</p>
              <p><strong>Asientos:</strong> ${l.seats || '-'}</p>
              <p><strong>Cantidad:</strong> ${o.quantity || 1}</p>
              <p><strong>Total:</strong> ${money(o.total || l.price || 0, l.currency || 'ARS')}</p>
              <p><strong>Estado:</strong> <span class="badge warn">${statusLabel[o.status] || o.status}</span></p>
              ${isExchange ? exchangeSteps : saleSteps}
              ${userActions}
              ${adminActions}
            </div>
            <div class="panel" style="box-shadow:none"><h3>Chat</h3>
              <div class="chat-box">${state.messages.map(msg=>`<div class="msg ${msg.sender_id===state.user?.id?'me':''}">${msg.text}<br><small>${fmtDate(msg.created_at)}</small></div>`).join('')}</div>
              <div class="footer-actions"><input class="input" id="chatText" placeholder="Escribir mensaje..." /><button class="pill-btn primary" onclick="window.appActions.sendMessage('${o.id}')">Enviar</button></div>
            </div>
          </div>
        </div>
      </div>
    </div>`
  let modal = document.getElementById('modalRoot')
  if (!modal) {
    modal = document.createElement('div')
    modal.id = 'modalRoot'
    document.body.appendChild(modal)
  }
  modal.innerHTML = html
}

function render() {
  let body = ''
  if (state.view === 'home') body = home()
  if (state.view === 'auth') body = authView()
  if (state.view === 'match') body = matchDetail()
  if (state.view === 'sell') body = sellView(state.prefMatchId)
  if (state.view === 'profile') body = profileView()
  if (state.view === 'my') body = myView()
  if (state.view === 'admin') body = adminView()
  if (state.view === 'notifications') body = notificationsView()
  app.innerHTML = `<div class="app-shell">${nav()}${verificationDisclaimer()}${body}</div>`
}

window.appActions = {
  setView,
  setAuthMode(mode){ state.authMode = mode; render() },
  toggleTheme: setTheme,
  requireLogin(view, matchId='') {
    if (!state.user) { state.view = 'auth'; render(); return }
    state.prefMatchId = matchId
    state.view = view
    render()
    if (view === 'sell' && matchId && canOperate()) setTimeout(() => this.openListingModal(matchId), 0)
  },
  async logout(){
    showLoading('Cerrando sesión...')
    const { error } = await supabase.auth.signOut()
    hideLoading()
    if (error) return showMessage(error.message, { title: 'No se pudo salir', tone: 'error' })
    state.session = null
    state.user = null
    state.profile = null
    state.orders = []
    state.notifications = []
    state.view = 'home'
    render()
  },
  async oauthLogin(provider){
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin }
    })
    if (error) await showMessage(error.message, { title: 'No se pudo ingresar', tone: 'error' })
  },
  async login(){
    const email = document.getElementById('loginEmail').value.trim()
    const password = document.getElementById('loginPass').value
    showLoading('Iniciando sesión...')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    hideLoading()
    if (error) await showMessage(error.message, { title: 'No se pudo ingresar', tone: 'error' })
    else {
      showLoading('Preparando tu cuenta...')
      state.view='home'
      await init()
      hideLoading()
    }
  },
  async register(){
    const email = document.getElementById('regEmail').value.trim()
    const password = document.getElementById('regPass').value
    const first_name = document.getElementById('regFirst').value.trim()
    const last_name = document.getElementById('regLast').value.trim()
    const document_type = document.getElementById('regDocType').value
    const document_number = document.getElementById('regDoc').value.trim()
    const { data, error } = await supabase.auth.signUp({ email, password, options:{ data:{ first_name,last_name,document_type,document_number } } })
    if (error) { await showMessage(error.message, { title: 'No se pudo crear la cuenta', tone: 'error' }); return }
    if (data.user) {
      await supabase.from('users').upsert({ id:data.user.id,email,first_name,last_name,document_type,document_number,account_status:'active',verification_status:'not_verified',preferred_currency:'ARS' })
    }
    await showMessage('Usuario creado. Iniciá sesión.', { title: 'Cuenta lista', tone: 'success' })
  },
  applyFilters(){
    const q = document.getElementById('q').value.toLowerCase()
    const phase = document.getElementById('phaseFilter').value
    const venue = document.getElementById('venueFilter').value
    const country = document.getElementById('countryFilter').value
    const filtered = state.matches.filter(m => {
      const text = `${m.home_team} ${m.away_team} ${m.home_code} ${m.away_code} ${m.city} ${m.stadium}`.toLowerCase()
      return (!q || text.includes(q)) &&
        (!phase || normalizedPhase(m.phase) === phase) &&
        (!venue || `${m.city || ''} - ${m.stadium || ''}` === venue) &&
        (!country || m.home_code === country || m.away_code === country)
    })
    document.getElementById('matchesWrap').innerHTML = matchesHtml(filtered)
  },
  openMatch(id){
    if (!state.openMatchTabs.some(tabId => String(tabId) === String(id))) state.openMatchTabs.push(id)
    state.selectedMatchId = id
    state.selectedMatch = state.matches.find(m=>String(m.id)===String(id))
    state.view='match'
    render()
  },
  switchMatchTab(id){
    state.selectedMatchId = id
    state.selectedMatch = state.matches.find(m=>String(m.id)===String(id))
    state.view = 'match'
    render()
  },
  closeMatchTab(id){
    state.openMatchTabs = state.openMatchTabs.filter(tabId => String(tabId) !== String(id))
    if (String(state.selectedMatchId) === String(id)) {
      const nextId = state.openMatchTabs[state.openMatchTabs.length - 1]
      if (nextId) {
        state.selectedMatchId = nextId
        state.selectedMatch = state.matches.find(m=>String(m.id)===String(nextId))
      } else {
        state.selectedMatchId = null
        state.selectedMatch = null
        state.view = 'home'
      }
    }
    render()
  },
  openMatchPicker(target){
    document.getElementById(`${target}Options`)?.classList.add('open')
  },
  filterMatchPicker(target){
    const q = document.getElementById(`${target}Search`).value.toLowerCase()
    document.getElementById(`${target}Options`)?.classList.add('open')
    document.querySelectorAll(`#${target}Options .match-option`).forEach(option => {
      option.style.display = option.dataset.search.includes(q) ? 'flex' : 'none'
    })
  },
  pickMatch(target, id){
    const input = document.getElementById(target)
    const selected = document.getElementById(`${target}Selected`)
    const search = document.getElementById(`${target}Search`)
    const options = document.getElementById(`${target}Options`)
    const match = state.matches.find(m => String(m.id) === String(id))
    if (!input || !selected || !match) return
    if (target === 'exchangeMatchIds') {
      const ids = input.value ? input.value.split(',').filter(Boolean) : []
      if (!ids.includes(String(id))) ids.push(String(id))
      input.value = ids.join(',')
      selected.innerHTML = ids.map(matchId => {
        const item = state.matches.find(m => String(m.id) === String(matchId))
        if (!item) return ''
        return `<span class="match-chip">${flagImg(item.home_code, 'flag-mini')}${flagImg(item.away_code, 'flag-mini')} ${matchLabel(item)} <button type="button" onclick="window.appActions.removeExchangeMatch('${item.id}')">×</button></span>`
      }).join('')
    } else {
      input.value = id
      selected.innerHTML = matchPickerOption(match, target)
    }
    if (search) search.value = ''
    options?.classList.remove('open')
  },
  removeExchangeMatch(id){
    const input = document.getElementById('exchangeMatchIds')
    const selected = document.getElementById('exchangeMatchIdsSelected')
    if (!input || !selected) return
    const ids = input.value.split(',').filter(value => value && String(value) !== String(id))
    input.value = ids.join(',')
    selected.innerHTML = ids.length ? ids.map(matchId => {
      const item = state.matches.find(m => String(m.id) === String(matchId))
      if (!item) return ''
      return `<span class="match-chip">${flagImg(item.home_code, 'flag-mini')}${flagImg(item.away_code, 'flag-mini')} ${matchLabel(item)} <button type="button" onclick="window.appActions.removeExchangeMatch('${item.id}')">×</button></span>`
    }).join('') : '<span class="meta">Seleccioná uno o más partidos</span>'
  },
  toggleExchangeFields(){
    const el = document.getElementById('exchangeFields')
    el.style.display = document.getElementById('sellType').value === 'exchange' ? 'block' : 'none'
  },
  openListingModal(prefMatchId=''){
    if (!state.user) { state.view='auth'; render(); return }
    if (!canOperate()) {
      return showMessage('Para comprar, vender o intercambiar entradas primero tenés que completar la verificación de identidad y esperar la aprobación.', { title: 'Verificación requerida', tone: 'error' })
    }
    let modal = document.getElementById('modalRoot')
    if (!modal) {
      modal = document.createElement('div')
      modal.id = 'modalRoot'
      document.body.appendChild(modal)
    }
    modal.innerHTML = openListingModalHtml(prefMatchId)
  },
  async createListing(){
    if (!state.user) return showMessage('Tenés que ingresar para publicar entradas.', { title: 'Ingresá a tu cuenta' })
    if (!canOperate()) return showMessage('Tu cuenta debe estar verificada para publicar entradas.', { title: 'Verificación requerida', tone: 'error' })
    const type = document.getElementById('sellType').value
    const selectedMatch = Number(document.getElementById('sellMatch').value)
    if (!selectedMatch) return showMessage('Seleccioná el partido de tu entrada.', { title: 'Falta el partido', tone: 'error' })
    const exchangeMatchIds = document.getElementById('exchangeMatchIds')?.value.split(',').filter(Boolean) || []
    const exchangeMatches = exchangeMatchIds.map(id => {
      const match = state.matches.find(m => String(m.id) === String(id))
      return match ? matchLabel(match) : null
    }).filter(Boolean)
    const payload = {
      type,
      match_id: selectedMatch,
      category: Number(document.getElementById('sellCat').value),
      quantity: Number(document.getElementById('sellQty').value),
      price: Number(document.getElementById('sellPrice').value || 0),
      currency: document.getElementById('sellCurrency').value,
      seller_id: state.user.id,
      status:'active',
      seller_payment_method: document.getElementById('payMethod').value,
      seller_payment_value: document.getElementById('payValue').value,
      sector: document.getElementById('sellSector').value.trim(),
      seats: document.getElementById('sellSeats').value.trim(),
      exchange_targets: type==='exchange' ? { match_ids: exchangeMatchIds, matches: exchangeMatches, text: document.getElementById('exchangeTargets').value } : null
    }
    const { error } = await supabase.from('listings').insert(payload)
    if (error) await showMessage(error.message, { title: 'No se pudo publicar', tone: 'error' })
    else { this.closeVerificationModal(); await showMessage('Tu publicación ya está disponible en el marketplace.', { title: 'Publicación creada', tone: 'success' }); await loadAll(); render() }
  },
  async startBuy(listingId){
    if (!state.user) { state.view='auth'; render(); return }
    if (!canOperate()) return showMessage('Para comprar entradas primero tenés que completar la verificación de identidad y esperar la aprobación.', { title: 'Verificación requerida', tone: 'error' })
    const l = state.listings.find(x=>x.id===listingId)
    if (l.seller_id === state.user.id) return showMessage('No podés comprar tus propias entradas.', { title: 'Operación no permitida' })
    const qty = Number(await askQuantity(l.quantity))
    if (!qty) return
    if (qty > Number(l.quantity)) return showMessage('No hay suficientes entradas disponibles.', { title: 'Cantidad no disponible', tone: 'error' })
    const { data, error } = await supabase.from('orders').insert({
      listing_id: l.id, buyer_id: state.user.id, seller_id: l.seller_id, quantity: qty, total: qty * Number(l.price || 0), status:'pending_payment',
      seller_delivery_status:'pending', buyer_delivery_status:'pending', admin_seller_delivery_status:'pending', buyer_payment_status:'pending', seller_payment_status:'pending'
    }).select().single()
    if (error) { await showMessage(error.message, { title: 'No se pudo iniciar la compra', tone: 'error' }); return }
    await supabase.from('listings').update({ quantity: Number(l.quantity)-qty, status: Number(l.quantity)-qty <= 0 ? 'sold' : 'active' }).eq('id', l.id)
    await notifyUsers([
      { user_id:l.seller_id, message:'Tenés una nueva venta pendiente.', subject:'Nueva venta pendiente' },
      { user_id:state.user.id, message:'Compra iniciada. Revisá tus operaciones para avanzar.', subject:'Compra iniciada' }
    ])
    await showMessage('Vas a ver la operación en Mis operaciones para continuar el proceso.', { title: 'Compra iniciada', tone: 'success' })
    await loadAll(); state.view='my'; render()
  },
  async startExchange(listingId){
    if (!state.user) { state.view='auth'; render(); return }
    if (!canOperate()) return showMessage('Para intercambiar entradas primero tenés que completar la verificación de identidad y esperar la aprobación.', { title: 'Verificación requerida', tone: 'error' })
    const l = state.listings.find(x=>x.id===listingId)
    if (l.seller_id === state.user.id) return showMessage('No podés ofertar sobre tu propia publicación.', { title: 'Operación no permitida' })
    const { error } = await supabase.from('orders').insert({
      listing_id:l.id,buyer_id:state.user.id,seller_id:l.seller_id,quantity:1,total:0,status:'exchange_pending',
      seller_delivery_status:'pending', buyer_delivery_status:'pending', admin_seller_delivery_status:'pending', admin_buyer_delivery_status:'pending'
    })
    if (error) await showMessage(error.message, { title: 'No se pudo enviar la oferta', tone: 'error' })
    else {
      await notifyUser(l.seller_id, 'Recibiste una nueva oferta de intercambio.', 'Nueva oferta de intercambio')
      await showMessage('La oferta de intercambio fue enviada.', { title: 'Oferta enviada', tone: 'success' }); await loadAll(); state.view='my'; render()
    }
  },
  async saveProfile(){
    const fields = ['first_name','last_name','birth_date','nationality','document_type','document_number','document_country','sex','phone','country','state','city','address','timezone','preferred_language','preferred_currency']
    const lockedFields = ['first_name','last_name','birth_date','nationality','document_type','document_number','document_country','sex']
    const editableFields = isVerified() ? fields.filter(k => !lockedFields.includes(k)) : fields
    const payload = { id:state.user.id, email:state.user.email }
    editableFields.forEach(k => payload[k] = document.getElementById(`profile_${k}`).value)
    payload.two_factor_enabled = document.getElementById('profile_two_factor_enabled').value === 'true'
    payload.email_notifications = document.getElementById('profile_email_notifications').value === 'true'
    const { error } = await supabase.from('users').upsert(payload)
    if (error) await showMessage(error.message, { title: 'No se pudo guardar', tone: 'error' })
    else { await showMessage('Tus datos fueron actualizados.', { title: 'Perfil actualizado', tone: 'success' }); await ensureProfile(); render() }
  },
  openUploadModal(kind){
    if (isVerified()) {
      return showMessage('Tu cuenta ya está verificada. Para proteger tu identidad, la foto de perfil, documento y prueba de vida quedan bloqueados.', { title: 'Cuenta verificada', tone: 'info' })
    }
    const isAvatar = kind === 'avatar'
    let modal = document.getElementById('modalRoot')
    if (!modal) {
      modal = document.createElement('div')
      modal.id = 'modalRoot'
      document.body.appendChild(modal)
    }
    modal.innerHTML = `
      <div class="modal-backdrop show" onclick="if(event.target.classList.contains('modal-backdrop')) window.appActions.closeVerificationModal()">
        <div class="modal upload-modal">
          <div class="modal-header"><h2>${isAvatar ? 'Subir foto de perfil' : 'Subir documento'}</h2><button class="secondary-btn" onclick="window.appActions.closeVerificationModal()">Cerrar</button></div>
          <div class="modal-body">
            <div class="upload-disclaimer">
              <strong>${isAvatar ? 'Indicaciones para una foto confiable' : 'Protegé tus datos antes de subir'}</strong>
              <p>${isAvatar ? 'Usá una imagen clara, reciente, con buena luz y el rostro visible. Formatos permitidos: JPG, PNG o WebP. Tamaño máximo: 8 MB.' : 'El documento debe verse nítido, sin reflejos y con foto, nombres y número de DNI/documento visibles. Podés tapar número de trámite, domicilio, códigos secundarios y datos no necesarios. Formatos permitidos: imagen o PDF. Tamaño máximo: 8 MB.'}</p>
            </div>
            <label class="dropzone" ondragover="event.preventDefault()" ondrop="window.appActions.handleUploadDrop('${kind}', event)">
              <input id="uploadInput" type="file" accept="${isAvatar ? 'image/*' : 'image/*,.pdf'}" onchange="window.appActions.uploadProfileFile('${kind}', this.files?.[0])">
              <strong>Arrastrá el archivo acá</strong>
              <span>o hacé click para seleccionarlo</span>
            </label>
          </div>
        </div>
      </div>`
  },
  handleUploadDrop(kind, event){
    event.preventDefault()
    const file = event.dataTransfer?.files?.[0]
    if (file) this.uploadProfileFile(kind, file)
  },
  async uploadProfileFile(kind, file){
    if (!file || !state.user) return
    if (isVerified()) {
      return showMessage('Tu cuenta ya está verificada. No se pueden reemplazar estos archivos desde el perfil.', { title: 'Cuenta verificada', tone: 'info' })
    }
    if (file.size > 8 * 1024 * 1024) {
      return showMessage('El archivo no puede superar los 8 MB.', { title: 'Archivo demasiado grande', tone: 'error' })
    }
    const bucket = kind === 'avatar' ? 'profile-photos' : 'identity-documents'
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${state.user.id}/${kind}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert:false, contentType:file.type })
    if (error) {
      return showMessage(error.message, { title: 'No se pudo subir el archivo', tone: 'error' })
    }
    const payload = { id:state.user.id, email:state.user.email }
    if (kind === 'avatar') {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path)
      payload.avatar_url = data.publicUrl
    } else {
      payload.identity_document_path = path
      payload.identity_document_status = 'pending_review'
      payload.identity_document_uploaded_at = new Date().toISOString()
      payload.verification_status = state.profile?.identity_selfie_path ? 'pending_review' : 'not_verified'
    }
    const { error:updateError } = await supabase.from('users').upsert(payload)
    if (updateError) return showMessage(updateError.message, { title: 'No se pudo actualizar el perfil', tone: 'error' })
    this.closeVerificationModal()
    await ensureProfile()
    await showMessage(kind === 'avatar' ? 'Tu foto de perfil fue actualizada.' : (state.profile?.identity_selfie_path ? 'Documento recibido. Tu verificación quedó pendiente de revisión.' : 'Documento recibido. Para enviar la verificación, completá también la prueba de vida.'), { title: kind === 'avatar' ? 'Foto actualizada' : 'Documento recibido', tone: 'success' })
    render()
  },
  async openOrder(id){ await openOrder(id) },
  closeModal(){ document.getElementById('modalRoot')?.remove(); state.selectedOrder=null },
  closeVerificationModal(){
    stopCameraStream()
    document.getElementById('modalRoot')?.remove()
  },
  closeMessageModal,
  resolveQuantityPrompt(){
    const input = document.getElementById('quantityPrompt')
    const value = Number(input?.value || 0)
    closeMessageModal(value > 0 ? value : null)
  },
  async sendMessage(orderId){
    const text = document.getElementById('chatText').value.trim()
    if (!text) return
    await supabase.from('messages').insert({ order_id:orderId, sender_id:state.user.id, text })
    await openOrder(orderId)
  },
  async updateOrder(id,status){
    await supabase.from('orders').update({ status }).eq('id', id)
    await loadAll()
    await openOrder(id)
    render()
  },
  async updateOrderFlow(id, field, value, status){
    const allowed = ['seller_delivery_status','buyer_delivery_status','admin_seller_delivery_status','admin_buyer_delivery_status','buyer_payment_status','seller_payment_status']
    if (!allowed.includes(field)) return
    const order = state.orders.find(o => o.id === id)
    const payload = { [field]: value }
    if (status) payload.status = status
    const { error } = await supabase.from('orders').update(payload).eq('id', id)
    if (error) return showMessage(error.message, { title: 'No se pudo actualizar', tone: 'error' })
    if (status === 'awaiting_buyer_payment') await notifyUser(order?.buyer_id, 'El admin confirmó que recibió las entradas del vendedor. Ya podés realizar el pago y avisarlo en la operación.', 'Entradas recibidas por admin')
    if (status === 'buyer_payment_sent') await notifyUser(order?.seller_id, 'El comprador informó que realizó el pago. Revisá tu cuenta y confirmá cuando lo hayas recibido.', 'Pago informado por comprador')
    if (status === 'payment_confirmed') await notifyUsers([{ user_id:order?.buyer_id, message:'El vendedor confirmó que recibió el pago. El admin liberará las entradas.', subject:'Pago confirmado' }])
    if (status === 'completed') await notifyUser(order?.buyer_id, 'El admin liberó las entradas para vos. Revisá el detalle de la operación.', 'Entradas liberadas')
    await loadAll()
    await openOrder(id)
    render()
  },
  async completeExchange(id){
    const order = state.orders.find(o => o.id === id)
    const { error } = await supabase.from('orders').update({
      status:'completed',
      seller_delivery_status:'released',
      buyer_delivery_status:'released',
      admin_seller_delivery_status:'received_by_admin',
      admin_buyer_delivery_status:'received_by_admin'
    }).eq('id', id)
    if (error) return showMessage(error.message, { title: 'No se pudo completar', tone: 'error' })
    await notifyUsers([
      { user_id:order?.seller_id, message:'El intercambio fue completado. El admin liberó las entradas acordadas para vos.', subject:'Intercambio completado' },
      { user_id:order?.buyer_id, message:'El intercambio fue completado. El admin liberó las entradas acordadas para vos.', subject:'Intercambio completado' }
    ])
    await loadAll()
    await openOrder(id)
    render()
  },
  async startLivenessCheck(){
    if (isVerified()) {
      return showMessage('Tu cuenta ya está verificada. La prueba de vida queda bloqueada para evitar cambios de identidad.', { title: 'Cuenta verificada', tone: 'info' })
    }
    await showMessage('Vamos a tomar dos fotos automáticamente: primero con la cabeza girada levemente hacia un costado y después mirando al frente. Usá buena luz y mantené el rostro dentro del cuadro.', { title: 'Prueba de vida', tone: 'info' })
    if (!navigator.mediaDevices?.getUserMedia) return showMessage('Tu navegador no permite usar la cámara desde esta página.', { title: 'Cámara no disponible', tone: 'error' })
    let modal = document.getElementById('modalRoot')
    if (!modal) {
      modal = document.createElement('div')
      modal.id = 'modalRoot'
      document.body.appendChild(modal)
    }
    modal.innerHTML = `
      <div class="modal-backdrop show">
        <div class="modal camera-modal">
          <div class="modal-header"><h2>Prueba de vida</h2><button class="secondary-btn" onclick="window.appActions.closeVerificationModal()">Cerrar</button></div>
          <div class="modal-body">
            <div class="camera-layout">
              <div class="camera-stage">
                <video id="livenessVideo" autoplay playsinline muted></video>
                <div id="faceGuide" class="face-guide front" aria-hidden="true"><span></span></div>
                <div class="camera-overlay">
                  <span id="livenessStep">Iniciando</span>
                  <strong id="livenessCountdown">3</strong>
                  <p id="livenessInstruction">Prepará la cámara...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`
    try {
      activeCameraStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user' }, audio:false })
      document.getElementById('livenessVideo').srcObject = activeCameraStream
      setTimeout(() => this.runLivenessCapture(), 900)
    } catch (error) {
      this.closeVerificationModal()
      await showMessage(error.message || 'No se pudo acceder a la cámara.', { title: 'Permiso de cámara', tone: 'error' })
    }
  },
  captureVideoBlob(video){
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 960
    canvas.height = video.videoHeight || 720
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9))
  },
  async runLivenessCapture(){
    const video = document.getElementById('livenessVideo')
    if (!video || !state.user) return
    const instruction = document.getElementById('livenessInstruction')
    const step = document.getElementById('livenessStep')
    const countdown = document.getElementById('livenessCountdown')
    const guide = document.getElementById('faceGuide')
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))
    const guidedCapture = async (label, text, pose) => {
      if (step) step.textContent = label
      if (instruction) instruction.textContent = text
      if (guide) guide.className = `face-guide ${pose}`
      for (let i = 3; i > 0; i--) {
        if (countdown) countdown.textContent = String(i)
        await wait(1000)
      }
      if (countdown) countdown.textContent = '✓'
      const blob = await this.captureVideoBlob(video)
      if (!blob) throw new Error('No se pudo capturar la imagen.')
      return blob
    }
    try {
      const sideBlob = await guidedCapture('Toma 1 de 2', 'Girate hacia un costado y alineá la cabeza con la silueta.', 'side')
      await wait(600)
      const frontBlob = await guidedCapture('Toma 2 de 2', 'Ahora mirá al frente y mantené el rostro dentro del molde.', 'front')
      const sidePath = `${state.user.id}/side-${Date.now()}.jpg`
      const frontPath = `${state.user.id}/front-${Date.now()}.jpg`
      const sideUpload = await supabase.storage.from('verification-selfies').upload(sidePath, sideBlob, { contentType:'image/jpeg' })
      if (sideUpload.error) throw sideUpload.error
      const frontUpload = await supabase.storage.from('verification-selfies').upload(frontPath, frontBlob, { contentType:'image/jpeg' })
      if (frontUpload.error) throw frontUpload.error
      const hasDocument = Boolean(state.profile?.identity_document_path)
      const { error:updateError } = await supabase.from('users').upsert({
        id: state.user.id,
        email: state.user.email,
        identity_selfie_path: frontPath,
        liveness_side_path: sidePath,
        liveness_front_path: frontPath,
        identity_selfie_uploaded_at: new Date().toISOString(),
        liveness_status: 'submitted',
        verification_status: hasDocument ? 'pending_review' : state.profile?.verification_status || 'not_verified'
      })
      if (updateError) throw updateError
      this.closeVerificationModal()
      await ensureProfile()
      await showMessage(hasDocument ? 'Las dos tomas fueron recibidas. Tu verificación quedó pendiente de revisión.' : 'Las dos tomas fueron recibidas. Para enviar la verificación, subí también tu documento.', { title: 'Prueba de vida recibida', tone: 'success' })
      render()
    } catch (error) {
      this.closeVerificationModal()
      await showMessage(error.message || 'No se pudo completar la prueba de vida.', { title: 'Intentá de nuevo', tone: 'error' })
    }
  },
  async captureLivenessSelfie(){
    return this.runLivenessCapture()
  },
  async reviewVerification(userId){
    const u = state.users.find(user => user.id === userId)
    if (!u) return
    const signed = async (bucket, path) => {
      if (!path) return ''
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 180)
      return data?.signedUrl || ''
    }
    const documentUrl = await signed('identity-documents', u.identity_document_path)
    const sideUrl = await signed('verification-selfies', u.liveness_side_path)
    const frontUrl = await signed('verification-selfies', u.liveness_front_path || u.identity_selfie_path)
    const filePreview = (url, label) => url ? `<div class="review-asset"><strong>${label}</strong>${url.includes('.pdf') ? `<iframe src="${url}"></iframe>` : `<img src="${url}" alt="${label}">`}</div>` : `<div class="review-asset missing"><strong>${label}</strong><span>No cargado</span></div>`
    let modal = document.getElementById('modalRoot')
    if (!modal) {
      modal = document.createElement('div')
      modal.id = 'modalRoot'
      document.body.appendChild(modal)
    }
    modal.innerHTML = `
      <div class="modal-backdrop show" onclick="if(event.target.classList.contains('modal-backdrop')) window.appActions.closeVerificationModal()">
        <div class="modal review-modal">
          <div class="modal-header"><h2>Revisión de identidad</h2><button class="secondary-btn" onclick="window.appActions.closeVerificationModal()">Cerrar</button></div>
          <div class="modal-body">
            <div class="review-summary">
              <div class="avatar-frame small">${u.avatar_url ? `<img src="${escapeHtml(u.avatar_url)}" alt="Foto de perfil">` : `<span>${escapeHtml((u.first_name || 'U').slice(0,1).toUpperCase())}</span>`}</div>
              <div>
                <h3>${escapeHtml(`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'Usuario')}</h3>
                <p class="meta">${escapeHtml(u.document_type || '-')} ${escapeHtml(u.document_number || '')} · ${escapeHtml(u.document_country || '')}</p>
                <p class="meta">${escapeHtml([u.nationality, u.country, u.city].filter(Boolean).join(' · '))}</p>
              </div>
            </div>
            <div class="review-grid">
              ${filePreview(u.avatar_url, 'Foto de perfil')}
              ${filePreview(documentUrl, 'Documento')}
              ${filePreview(sideUrl, 'Prueba de vida: costado')}
              ${filePreview(frontUrl, 'Prueba de vida: frente')}
            </div>
            <div class="document-warning">Verificá que el documento sea nítido, que nombre y número coincidan con los datos del perfil, y que las dos tomas de vida correspondan a la misma persona.</div>
            ${verificationRejectReason(u.id)}
            <div class="footer-actions"><button class="pill-btn danger" onclick="window.appActions.updateUserVerification('${u.id}','rejected')">Rechazar</button><button class="pill-btn primary" onclick="window.appActions.updateUserVerification('${u.id}','verified')">Verificar cuenta</button></div>
          </div>
        </div>
      </div>`
  },
  async viewVerificationFile(bucket, path){
    if (!path) return showMessage('Todavía no hay archivo cargado.', { title: 'Sin archivo', tone: 'error' })
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 120)
    if (error) return showMessage(error.message, { title: 'No se pudo abrir el archivo', tone: 'error' })
    let modal = document.getElementById('modalRoot')
    if (!modal) {
      modal = document.createElement('div')
      modal.id = 'modalRoot'
      document.body.appendChild(modal)
    }
    modal.innerHTML = `
      <div class="modal-backdrop show" onclick="if(event.target.classList.contains('modal-backdrop')) window.appActions.closeVerificationModal()">
        <div class="modal">
          <div class="modal-header"><h2>Archivo de verificación</h2><button class="secondary-btn" onclick="window.appActions.closeVerificationModal()">Cerrar</button></div>
          <div class="modal-body"><iframe class="verification-preview" src="${data.signedUrl}"></iframe></div>
        </div>
      </div>`
  },
  openUserEditor(userId){
    if (!isAdmin()) return showMessage('No tenés permisos para administrar usuarios.', { title: 'Acceso restringido', tone: 'error' })
    const u = state.users.find(user => user.id === userId)
    if (!u) return
    const value = (key) => escapeHtml(u[key] ?? '')
    const selected = (key, option) => String(u[key] ?? '') === option ? 'selected' : ''
    let modal = document.getElementById('modalRoot')
    if (!modal) {
      modal = document.createElement('div')
      modal.id = 'modalRoot'
      document.body.appendChild(modal)
    }
    modal.innerHTML = `
      <div class="modal-backdrop show" onclick="if(event.target.classList.contains('modal-backdrop')) window.appActions.closeVerificationModal()">
        <div class="modal user-admin-modal">
          <div class="modal-header"><h2>Editar usuario</h2><button class="secondary-btn" onclick="window.appActions.closeVerificationModal()">Cerrar</button></div>
          <div class="modal-body">
            <div class="review-summary">
              <div class="avatar-frame small">${u.avatar_url ? `<img src="${escapeHtml(u.avatar_url)}" alt="Foto de perfil">` : `<span>${escapeHtml((u.first_name || 'U').slice(0,1).toUpperCase())}</span>`}</div>
              <div>
                <h3>${escapeHtml(`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'Usuario')} ${verificationBadgeHtml(u.verification_status === 'verified')}</h3>
                <p class="meta">${escapeHtml(u.email || '')}</p>
              </div>
            </div>
            <div class="form-grid admin-user-grid">
              <div class="field"><label>Nombre</label><input id="admin_first_name" class="input" value="${value('first_name')}"></div>
              <div class="field"><label>Apellido</label><input id="admin_last_name" class="input" value="${value('last_name')}"></div>
              <div class="field"><label>Email</label><input id="admin_email" class="input" value="${value('email')}"></div>
              <div class="field"><label>Rol</label><select id="admin_role" class="select"><option value="user" ${selected('role','user')}>Usuario</option><option value="admin" ${selected('role','admin')}>Admin</option></select></div>
              <div class="field"><label>Tipo documento</label><input id="admin_document_type" class="input" value="${value('document_type')}"></div>
              <div class="field"><label>Número documento</label><input id="admin_document_number" class="input" value="${value('document_number')}"></div>
              <div class="field"><label>País documento</label><input id="admin_document_country" class="input" value="${value('document_country')}"></div>
              <div class="field"><label>Teléfono</label><input id="admin_phone" class="input" value="${value('phone')}"></div>
              <div class="field"><label>País</label><input id="admin_country" class="input" value="${value('country')}"></div>
              <div class="field"><label>Provincia/Estado</label><input id="admin_state" class="input" value="${value('state')}"></div>
              <div class="field"><label>Ciudad</label><input id="admin_city" class="input" value="${value('city')}"></div>
              <div class="field"><label>Verificación</label><select id="admin_verification_status" class="select">
                <option value="not_verified" ${selected('verification_status','not_verified')}>No verificado</option>
                <option value="pending_review" ${selected('verification_status','pending_review')}>Pendiente</option>
                <option value="verified" ${selected('verification_status','verified')}>Verificado</option>
                <option value="rejected" ${selected('verification_status','rejected')}>Rechazado</option>
              </select></div>
              <div class="field"><label>Transacciones completadas</label><input id="admin_seller_sales_count" class="input" type="number" min="0" value="${Number(u.seller_sales_count || 0)}"></div>
              <div class="field"><label>Cantidad de reseñas</label><input id="admin_seller_reviews_count" class="input" type="number" min="0" value="${Number(u.seller_reviews_count || 0)}"></div>
              <div class="field"><label>Rating vendedor</label><input id="admin_seller_rating" class="input" type="number" min="0" max="5" step="0.1" value="${Number(u.seller_rating || 0)}"></div>
            </div>
            <div class="document-warning">Los cambios hechos por un administrador impactan inmediatamente en publicaciones, perfil y estado de verificación del usuario.</div>
            <div class="footer-actions"><button class="pill-btn primary" onclick="window.appActions.saveAdminUser('${u.id}')">Guardar cambios</button></div>
          </div>
        </div>
      </div>`
  },
  async saveAdminUser(userId){
    if (!isAdmin()) return
    const currentUser = state.users.find(u => u.id === userId) || {}
    const textFields = ['first_name','last_name','email','role','document_type','document_number','document_country','phone','country','state','city','verification_status']
    const payload = {}
    textFields.forEach(k => payload[k] = document.getElementById(`admin_${k}`)?.value || '')
    payload.seller_sales_count = Number(document.getElementById('admin_seller_sales_count')?.value || 0)
    payload.seller_reviews_count = Number(document.getElementById('admin_seller_reviews_count')?.value || 0)
    payload.seller_rating = Number(document.getElementById('admin_seller_rating')?.value || 0)
    if (payload.verification_status === 'verified') {
      payload.identity_document_status = 'approved'
      payload.liveness_status = 'approved'
    }
    if (payload.verification_status === 'rejected') {
      payload.identity_document_status = 'rejected'
      payload.liveness_status = 'rejected'
    }
    const { error } = await supabase.from('users').update(payload).eq('id', userId)
    if (error) return showMessage(error.message, { title: 'No se pudo guardar', tone: 'error' })
    if (payload.verification_status !== currentUser.verification_status && ['verified','rejected'].includes(payload.verification_status)) {
      await notifyUser(
        userId,
        payload.verification_status === 'verified'
          ? 'Tu verificación fue aprobada. Ya podés comprar, vender e intercambiar entradas.'
          : 'Tu verificación fue rechazada. Podés volver a cargar la documentación desde Mi perfil.',
        payload.verification_status === 'verified' ? 'Verificación aprobada' : 'Verificación rechazada'
      )
    }
    await loadAll()
    this.closeVerificationModal()
    await showMessage('Los datos del usuario fueron actualizados.', { title: 'Usuario actualizado', tone: 'success' })
    render()
  },
  async updateUserVerification(userId, status){
    const reason = document.getElementById(`verificationReason_${userId}`)?.value.trim() || ''
    const updatePayload = {
      verification_status: status,
      identity_document_status: status === 'verified' ? 'approved' : 'rejected',
      liveness_status: status === 'verified' ? 'approved' : 'rejected'
    }
    if (status === 'rejected') updatePayload.verification_rejection_reason = reason
    if (status === 'verified') updatePayload.verification_rejection_reason = null
    let { error } = await supabase.from('users').update(updatePayload).eq('id', userId)
    if (error && error.message?.includes('verification_rejection_reason')) {
      delete updatePayload.verification_rejection_reason
      const retry = await supabase.from('users').update(updatePayload).eq('id', userId)
      error = retry.error
    }
    if (error) return showMessage(error.message, { title: 'No se pudo actualizar', tone: 'error' })
    const message = status === 'verified'
      ? 'Tu verificación fue aprobada. Ya podés comprar, vender e intercambiar entradas.'
      : `Tu verificación fue rechazada.${reason ? ` Motivo: ${reason}` : ' Podés volver a cargar la documentación desde Mi perfil.'}`
    await notifyUser(userId, message, status === 'verified' ? 'Verificación aprobada' : 'Verificación rechazada')
    await loadAll()
    this.closeVerificationModal()
    await showMessage(status === 'verified' ? 'Usuario verificado.' : 'Verificación rechazada.', { title: 'Estado actualizado', tone: 'success' })
    render()
  }
}

init()
