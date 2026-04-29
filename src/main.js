
import { supabase } from '../lib/supabase.js'
import './styles.css'

const app = document.getElementById('app')

let state = {
  session: null,
  user: null,
  profile: null,
  view: 'home',
  matches: [],
  listings: [],
  orders: [],
  messages: [],
  notifications: [],
  theme: localStorage.getItem('theme') || 'light',
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
  payment_sent: 'Pago informado',
  under_review: 'Pendiente validación',
  completed: 'Completada',
  cancelled: 'Cancelada',
  exchange_pending: 'Intercambio pendiente',
  exchange_accepted: 'Intercambio aceptado',
  issue: 'Con problema'
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
    await supabase.from('users').insert({
      id: state.user.id,
      email: state.user.email,
      first_name: meta.first_name || '',
      last_name: meta.last_name || '',
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
  state.matches = m.data || []
  state.listings = l.data || []
  if (state.user) {
    const [orders, notifs] = await Promise.all([
      supabase.from('orders').select('*').or(`buyer_id.eq.${state.user.id},seller_id.eq.${state.user.id}`).order('created_at', { ascending:false }),
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
        <div class="brand-badge">🏆</div>
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
        <h1>Compra, vende e intercambia entradas del Mundial 2026</h1>
        <p>Buscá partidos por país o sede. Las operaciones quedan registradas y custodiadas dentro de la plataforma.</p>
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
  return `
  <div class="container">
    <div class="grid-2">
      <div class="panel">
        <h2>Ingresar</h2>
        <div class="field"><label>Email</label><input id="loginEmail" class="input"></div><br>
        <div class="field"><label>Contraseña</label><input id="loginPass" type="password" class="input"></div><br>
        <button class="pill-btn primary" onclick="window.appActions.login()">Ingresar</button>
      </div>
      <div class="panel">
        <h2>Registrarse</h2>
        <div class="form-grid">
          <div class="field"><label>Nombre</label><input id="regFirst" class="input"></div>
          <div class="field"><label>Apellido</label><input id="regLast" class="input"></div>
          <div class="field"><label>Email</label><input id="regEmail" class="input"></div>
          <div class="field"><label>Contraseña</label><input id="regPass" type="password" class="input"></div>
          <div class="field"><label>Tipo documento</label><select id="regDocType" class="select"><option>DNI</option><option>Pasaporte</option><option>CI</option></select></div>
          <div class="field"><label>Número documento</label><input id="regDoc" class="input"></div>
        </div>
        <br><button class="pill-btn primary" onclick="window.appActions.register()">Crear cuenta</button>
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

function listingCard(l, canBuy) {
  return `<div class="item">
    <strong>${l.type==='exchange'?'Intercambio':'Venta'} · Categoría ${l.category}</strong>
    <p class="meta">Cantidad: ${l.quantity} · ${l.price ? money(l.price,l.currency) : 'Sin precio'} ${l.type==='exchange' && l.exchange_targets ? `<br>Busca: ${JSON.stringify(l.exchange_targets)}`:''}</p>
    ${canBuy?`<button class="price-btn" onclick="window.appActions.startBuy('${l.id}')">Comprar</button>`:`<button class="secondary-btn" onclick="window.appActions.startExchange('${l.id}')">Ofrecer intercambio</button>`}
  </div>`
}

function sellView(prefMatchId='') {
  const mine = state.listings.filter(l=>l.seller_id === state.user?.id)
  return `
  <div class="container">
    <div class="grid-2">
      <div class="panel">
        <h2>Publicar entrada</h2>
        <div class="form-grid">
          <div class="field"><label>Tipo</label><select id="sellType" class="select" onchange="window.appActions.toggleExchangeFields()"><option value="sale">Vender</option><option value="exchange">Intercambiar</option></select></div>
          <div class="field"><label>Partido</label><select id="sellMatch" class="select">${state.matches.map(m=>`<option value="${m.id}" ${String(m.id)===String(prefMatchId)?'selected':''}>#${m.match_number} ${m.home_code} vs ${m.away_code} · ${m.city}</option>`).join('')}</select></div>
          <div class="field"><label>Categoría</label><select id="sellCat" class="select"><option>1</option><option>2</option><option>3</option><option>4</option></select></div>
          <div class="field"><label>Cantidad</label><input id="sellQty" type="number" min="1" class="input" value="1"></div>
          <div class="field"><label>Precio por entrada</label><input id="sellPrice" type="number" class="input" placeholder="Ej: 390000"></div>
          <div class="field"><label>Moneda</label><select id="sellCurrency" class="select"><option>ARS</option><option>USD</option></select></div>
          <div class="field"><label>Método de cobro</label><select id="payMethod" class="select"><option>Alias</option><option>CBU</option><option>USD</option><option>Wallet</option></select></div>
          <div class="field"><label>Alias / CBU / dato de cobro</label><input id="payValue" class="input"></div>
        </div>
        <div id="exchangeFields" style="display:none;margin-top:14px">
          <div class="field"><label>Partidos que buscás para intercambio</label><textarea id="exchangeTargets" rows="3" placeholder="Ej: Partido 86 Categoría 1, Partido 95 Categoría 2"></textarea></div>
        </div>
        <br><button class="pill-btn primary" onclick="window.appActions.createListing()">Publicar</button>
      </div>
      <div class="panel">
        <h2>Mis publicaciones</h2>
        <div class="list">${mine.length ? mine.map(l=>listingCard(l,false)).join('') : `<div class="empty">Usted no tiene ninguna entrada a la venta o intercambio.</div>`}</div>
      </div>
    </div>
  </div>`
}

function profileView() {
  const p = state.profile || {}
  const fields = [
    ['first_name','Nombre'],['last_name','Apellido'],['birth_date','Fecha de nacimiento'],['nationality','Nacionalidad'],
    ['document_type','Tipo de documento'],['document_number','Número de documento'],['document_country','País emisión documento'],
    ['sex','Sexo'],['phone','Teléfono'],['country','País'],['state','Provincia/Estado'],['city','Ciudad'],
    ['address','Dirección'],['timezone','Timezone'],['preferred_language','Idioma preferido'],['preferred_currency','Divisa preferida']
  ]
  return `<div class="container"><div class="panel"><h2>Mi perfil</h2><p class="meta">Completá tus datos para operar con mayor seguridad.</p>
    <div class="form-grid">
      ${fields.map(([k,label])=>`<div class="field"><label>${label}</label><input class="input" id="profile_${k}" value="${p[k] || ''}"></div>`).join('')}
      <div class="field"><label>2FA habilitado</label><select id="profile_two_factor_enabled" class="select"><option value="false" ${!p.two_factor_enabled?'selected':''}>NO</option><option value="true" ${p.two_factor_enabled?'selected':''}>SÍ</option></select></div>
      <div class="field"><label>Estado verificación</label><input disabled class="input" value="${p.verification_status || 'not_verified'}"></div>
    </div>
    <br><button class="pill-btn primary" onclick="window.appActions.saveProfile()">Guardar perfil</button>
  </div></div>`
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

function adminView() {
  if (!isAdmin()) return `<div class="container"><div class="empty">No tenés permisos de admin.</div></div>`
  const pending = state.orders.filter(o=>o.status !== 'completed').length
  return `<div class="container">
    <h1>Dashboard admin</h1>
    <div class="stats-grid">
      <div class="stat"><strong>${state.matches.length}</strong><span>Partidos</span></div>
      <div class="stat"><strong>${state.listings.length}</strong><span>Publicaciones</span></div>
      <div class="stat"><strong>${state.orders.length}</strong><span>Órdenes</span></div>
      <div class="stat"><strong>${pending}</strong><span>A validar</span></div>
    </div>
    <div class="panel">
      <h2>Centro de operaciones</h2>
      <table class="admin-table"><thead><tr><th>ID</th><th>Tipo</th><th>Partido</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
        ${state.orders.map(o=>{
          const l = state.listings.find(x=>x.id===o.listing_id)
          const m = state.matches.find(x=>Number(x.id)===Number(l?.match_id))
          return `<tr><td>#${String(o.id).slice(0,8)}</td><td>${l?.type || 'venta'}</td><td>${m?`${m.home_code} vs ${m.away_code}`:'-'}</td><td>${statusLabel[o.status] || o.status}</td><td><button class="secondary-btn" onclick="window.appActions.openOrder('${o.id}')">Abrir</button></td></tr>`
        }).join('')}
      </tbody></table>
    </div>
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
  const html = `
    <div class="modal-backdrop show" onclick="if(event.target.classList.contains('modal-backdrop')) window.appActions.closeModal()">
      <div class="modal">
        <div class="modal-header"><h2>Operación #${String(o.id).slice(0,8)}</h2><button class="secondary-btn" onclick="window.appActions.closeModal()">Cerrar</button></div>
        <div class="modal-body">
          <div class="grid-2">
            <div class="panel" style="box-shadow:none"><h3>Detalle</h3>
              <p><strong>Partido:</strong> #${m.match_number || ''} ${m.home_code || ''} vs ${m.away_code || ''}</p>
              <p><strong>Categoría:</strong> ${l.category || '-'}</p>
              <p><strong>Cantidad:</strong> ${o.quantity || 1}</p>
              <p><strong>Total:</strong> ${money(o.total || l.price || 0, l.currency || 'ARS')}</p>
              <p><strong>Estado:</strong> <span class="badge warn">${statusLabel[o.status] || o.status}</span></p>
              ${isAdmin()?`<div class="footer-actions"><button class="pill-btn primary" onclick="window.appActions.updateOrder('${o.id}','under_review')">En revisión</button><button class="pill-btn primary" onclick="window.appActions.updateOrder('${o.id}','completed')">Completar</button><button class="pill-btn danger" onclick="window.appActions.updateOrder('${o.id}','issue')">Problema</button></div>`:''}
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
  app.innerHTML = `<div class="app-shell">${nav()}${body}</div>`
}

window.appActions = {
  setView,
  toggleTheme: setTheme,
  requireLogin(view, matchId='') {
    if (!state.user) { state.view = 'auth'; render(); return }
    state.prefMatchId = matchId
    state.view = view
    render()
  },
  async logout(){ await supabase.auth.signOut(); state.view='home'; render() },
  async login(){
    const email = document.getElementById('loginEmail').value.trim()
    const password = document.getElementById('loginPass').value
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) await showMessage(error.message, { title: 'No se pudo ingresar', tone: 'error' })
    else { state.view='home'; await init() }
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
  toggleExchangeFields(){
    const el = document.getElementById('exchangeFields')
    el.style.display = document.getElementById('sellType').value === 'exchange' ? 'block' : 'none'
  },
  async createListing(){
    if (!state.user) return showMessage('Tenés que ingresar para publicar entradas.', { title: 'Ingresá a tu cuenta' })
    const type = document.getElementById('sellType').value
    const payload = {
      type,
      match_id: Number(document.getElementById('sellMatch').value),
      category: Number(document.getElementById('sellCat').value),
      quantity: Number(document.getElementById('sellQty').value),
      price: Number(document.getElementById('sellPrice').value || 0),
      currency: document.getElementById('sellCurrency').value,
      seller_id: state.user.id,
      status:'active',
      seller_payment_method: document.getElementById('payMethod').value,
      seller_payment_value: document.getElementById('payValue').value,
      exchange_targets: type==='exchange' ? { text: document.getElementById('exchangeTargets').value } : null
    }
    const { error } = await supabase.from('listings').insert(payload)
    if (error) await showMessage(error.message, { title: 'No se pudo publicar', tone: 'error' })
    else { await showMessage('Tu publicación ya está disponible en el marketplace.', { title: 'Publicación creada', tone: 'success' }); await loadAll(); render() }
  },
  async startBuy(listingId){
    if (!state.user) { state.view='auth'; render(); return }
    const l = state.listings.find(x=>x.id===listingId)
    if (l.seller_id === state.user.id) return showMessage('No podés comprar tus propias entradas.', { title: 'Operación no permitida' })
    const qty = Number(await askQuantity(l.quantity))
    if (!qty) return
    if (qty > Number(l.quantity)) return showMessage('No hay suficientes entradas disponibles.', { title: 'Cantidad no disponible', tone: 'error' })
    const { data, error } = await supabase.from('orders').insert({
      listing_id: l.id, buyer_id: state.user.id, seller_id: l.seller_id, quantity: qty, total: qty * Number(l.price || 0), status:'pending_payment'
    }).select().single()
    if (error) { await showMessage(error.message, { title: 'No se pudo iniciar la compra', tone: 'error' }); return }
    await supabase.from('listings').update({ quantity: Number(l.quantity)-qty, status: Number(l.quantity)-qty <= 0 ? 'sold' : 'active' }).eq('id', l.id)
    await supabase.from('notifications').insert([{user_id:l.seller_id,message:'Tenés una nueva venta pendiente.'},{user_id:state.user.id,message:'Compra iniciada. Revisá tus operaciones para avanzar.'}])
    await showMessage('Vas a ver la operación en Mis operaciones para continuar el proceso.', { title: 'Compra iniciada', tone: 'success' })
    await loadAll(); state.view='my'; render()
  },
  async startExchange(listingId){
    if (!state.user) { state.view='auth'; render(); return }
    const l = state.listings.find(x=>x.id===listingId)
    if (l.seller_id === state.user.id) return showMessage('No podés ofertar sobre tu propia publicación.', { title: 'Operación no permitida' })
    const { error } = await supabase.from('orders').insert({
      listing_id:l.id,buyer_id:state.user.id,seller_id:l.seller_id,quantity:1,total:0,status:'exchange_pending'
    })
    if (error) await showMessage(error.message, { title: 'No se pudo enviar la oferta', tone: 'error' })
    else { await showMessage('La oferta de intercambio fue enviada.', { title: 'Oferta enviada', tone: 'success' }); await loadAll(); state.view='my'; render() }
  },
  async saveProfile(){
    const fields = ['first_name','last_name','birth_date','nationality','document_type','document_number','document_country','sex','phone','country','state','city','address','timezone','preferred_language','preferred_currency']
    const payload = { id:state.user.id, email:state.user.email }
    fields.forEach(k => payload[k] = document.getElementById(`profile_${k}`).value)
    payload.two_factor_enabled = document.getElementById('profile_two_factor_enabled').value === 'true'
    const { error } = await supabase.from('users').upsert(payload)
    if (error) await showMessage(error.message, { title: 'No se pudo guardar', tone: 'error' })
    else { await showMessage('Tus datos fueron actualizados.', { title: 'Perfil actualizado', tone: 'success' }); await ensureProfile(); render() }
  },
  async openOrder(id){ await openOrder(id) },
  closeModal(){ document.getElementById('modalRoot')?.remove(); state.selectedOrder=null },
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
  }
}

init()
