
import { supabase, supabaseConfigMissing } from '../lib/supabase.js'
import './styles.css'

const app = document.getElementById('app')
let activeCameraStream = null
let operationRefreshTimer = null
let loadingTimer = null
let backgroundRefreshTimer = null
let pendingAuthNotice = null

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
  reviews: [],
  emailTemplates: [],
  siteSettings: [],
  theme: localStorage.getItem('theme') || 'light',
  authMode: 'login',
  adminSection: 'users',
  adminSettingsSection: 'matches',
  adminMenuOpen: true,
  operationFilters: { active:true, waiting:true, completed:true, cancelled:true, issue:true },
  publicationFilters: { available:true, finished:true },
  homeOfferType: 'all',
  homeShowNoOffers: false,
  notificationsOpen: false,
  prefMatchId: '',
  selectedMatch: null,
  selectedMatchId: null,
  openMatchTabs: [],
  selectedOrder: null
}

document.body.classList.toggle('dark', state.theme === 'dark')

const ADMIN_EMAILS = ['admin@demo.com', 'juanmaotero1999@gmail.com']
const PLATFORM_TRANSFER_EMAIL = 'transferencias@entradas-fifa.store'
const APP_NAME = 'Entradas Mundial 2026'
const seenMessagesStorageKey = () => `seenMessages:${state.user?.id || 'guest'}`
const readSeenMessages = () => {
  try { return JSON.parse(localStorage.getItem(seenMessagesStorageKey()) || '{}') } catch (_) { return {} }
}
const writeSeenMessages = (value) => localStorage.setItem(seenMessagesStorageKey(), JSON.stringify(value || {}))
const viewRoutes = {
  home: '/comprar',
  auth: '/ingresar',
  sell: '/vender',
  my: '/operaciones',
  profile: '/perfil',
  admin: '/admin',
  notifications: '/notificaciones'
}
const routeViews = Object.fromEntries(Object.entries(viewRoutes).map(([view, path]) => [path, view]))

function viewFromPath(pathname = window.location.pathname) {
  if (pathname === '/' || pathname === '') return 'home'
  return routeViews[pathname] || 'home'
}

function routeForView(view) {
  return viewRoutes[view] || '/'
}

function updateRoute(view, replace = false) {
  const nextPath = routeForView(view)
  if (!nextPath || window.location.pathname === nextPath) return
  const method = replace ? 'replaceState' : 'pushState'
  window.history[method]({ view }, '', nextPath)
}

function cleanAuthUrl(view = state.view || 'home') {
  const nextPath = routeForView(view)
  window.history.replaceState({ view }, '', nextPath)
}

async function consumeAuthRedirect() {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error') || url.searchParams.get('error_code')
  const errorDescription = url.searchParams.get('error_description')
  const hasTokenHash = window.location.hash.includes('access_token') || window.location.hash.includes('refresh_token')

  if (error || errorDescription) {
    pendingAuthNotice = {
      title: 'No se pudo confirmar',
      message: errorDescription || error || 'El enlace de confirmación no pudo procesarse.',
      tone: 'error'
    }
    cleanAuthUrl('auth')
    state.view = 'auth'
    return
  }

  if (code) {
    try {
      const { error: exchangeError } = await withTimeout(supabase.auth.exchangeCodeForSession(code), 9000, 'Confirmación de cuenta')
      if (exchangeError) throw exchangeError
      pendingAuthNotice = {
        title: 'Cuenta confirmada',
        message: 'Tu email fue confirmado correctamente. Ya podés completar tu perfil y verificación.',
        tone: 'success'
      }
      state.view = 'home'
      cleanAuthUrl('home')
    } catch (err) {
      pendingAuthNotice = {
        title: 'No se pudo confirmar',
        message: err.message || 'El enlace de confirmación venció o no es válido.',
        tone: 'error'
      }
      state.view = 'auth'
      cleanAuthUrl('auth')
    }
  } else if (hasTokenHash) {
    pendingAuthNotice = {
      title: 'Cuenta confirmada',
      message: 'Tu email fue confirmado correctamente.',
      tone: 'success'
    }
    state.view = 'home'
    cleanAuthUrl('home')
  }
}

function missingConfigView() {
  app.innerHTML = `
    <div class="app-shell">
      <div class="container">
        <div class="panel config-missing">
          <h1>Falta conectar Supabase</h1>
          <p class="meta">La app cargó bien, pero no puede iniciar sesión, registrar usuarios ni comprar hasta que existan estas variables de entorno de Vite:</p>
          <code>VITE_SUPABASE_URL</code>
          <code>VITE_SUPABASE_KEY</code>
          <p class="meta">En local van en un archivo <strong>.env.local</strong>. En Vercel/hosting van en Environment Variables y después hay que redeployar.</p>
        </div>
      </div>
    </div>`
}

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

const orderStatusGroup = (status = '') => {
  if (status === 'completed') return 'completed'
  if (status === 'cancelled') return 'cancelled'
  if (status === 'issue') return 'issue'
  if (['pending_payment','awaiting_buyer_payment','buyer_payment_sent','payment_sent','payment_confirmed'].includes(status)) return 'waiting'
  return 'active'
}

const listingStatusGroup = (listing = {}) => listing.status === 'active' && Number(listing.quantity || 0) > 0 ? 'available' : 'finished'

const orderFilterLabels = {
  active: 'En curso',
  waiting: 'Pago / validación',
  completed: 'Completadas',
  cancelled: 'Canceladas',
  issue: 'Con problema'
}

const publicationFilterLabels = {
  available: 'Disponibles',
  finished: 'Finalizadas'
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

const withTimeout = (promise, ms = 8500, label = 'Operación') => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} tardó demasiado. Probá de nuevo en unos segundos.`)), ms))
])

const userTimeZone = () => state.profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Argentina/Buenos_Aires'
const fmtDate = (d) => {
  if (!d) return 'Fecha a confirmar'
  const date = new Date(d)
  if (isNaN(date)) return d
  return date.toLocaleString('es-AR', { timeZone:userTimeZone(), day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
}
const fmtMatchDate = (d) => {
  if (!d) return 'Fecha a confirmar'
  const date = new Date(d)
  if (isNaN(date)) return d
  return date.toLocaleString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

const countryRows = [
  ['AR','Argentina','+54'],['BR','Brasil','+55'],['CO','Colombia','+57'],['MX','México','+52'],['PY','Paraguay','+595'],['UY','Uruguay','+598'],
  ['AF','Afganistán','+93'],['AL','Albania','+355'],['DE','Alemania','+49'],['AD','Andorra','+376'],['AO','Angola','+244'],['AI','Anguila','+1'],['AQ','Antártida','+672'],['AG','Antigua y Barbuda','+1'],['SA','Arabia Saudita','+966'],['DZ','Argelia','+213'],['AM','Armenia','+374'],['AW','Aruba','+297'],['AU','Australia','+61'],['AT','Austria','+43'],['AZ','Azerbaiyán','+994'],
  ['BS','Bahamas','+1'],['BH','Baréin','+973'],['BD','Bangladés','+880'],['BB','Barbados','+1'],['BE','Bélgica','+32'],['BZ','Belice','+501'],['BJ','Benín','+229'],['BM','Bermudas','+1'],['BY','Bielorrusia','+375'],['BO','Bolivia','+591'],['BA','Bosnia y Herzegovina','+387'],['BW','Botsuana','+267'],['BG','Bulgaria','+359'],['BF','Burkina Faso','+226'],['BI','Burundi','+257'],['BT','Bután','+975'],
  ['CV','Cabo Verde','+238'],['KH','Camboya','+855'],['CM','Camerún','+237'],['CA','Canadá','+1'],['BQ','Caribe Neerlandés','+599'],['QA','Catar','+974'],['TD','Chad','+235'],['CL','Chile','+56'],['CN','China','+86'],['CY','Chipre','+357'],['VA','Ciudad del Vaticano','+39'],['KM','Comoras','+269'],['CG','Congo','+242'],['CD','Congo, República Democrática','+243'],['KR','Corea del Sur','+82'],['KP','Corea del Norte','+850'],['CI','Costa de Marfil','+225'],['CR','Costa Rica','+506'],['HR','Croacia','+385'],['CU','Cuba','+53'],['CW','Curazao','+599'],
  ['DK','Dinamarca','+45'],['DM','Dominica','+1'],['EC','Ecuador','+593'],['EG','Egipto','+20'],['SV','El Salvador','+503'],['AE','Emiratos Árabes Unidos','+971'],['ER','Eritrea','+291'],['SK','Eslovaquia','+421'],['SI','Eslovenia','+386'],['ES','España','+34'],['US','Estados Unidos','+1'],['EE','Estonia','+372'],['SZ','Esuatini','+268'],['ET','Etiopía','+251'],
  ['PH','Filipinas','+63'],['FI','Finlandia','+358'],['FJ','Fiyi','+679'],['FR','Francia','+33'],['GA','Gabón','+241'],['GM','Gambia','+220'],['GE','Georgia','+995'],['GH','Ghana','+233'],['GI','Gibraltar','+350'],['GD','Granada','+1'],['GR','Grecia','+30'],['GL','Groenlandia','+299'],['GP','Guadalupe','+590'],['GU','Guam','+1'],['GT','Guatemala','+502'],['GF','Guayana Francesa','+594'],['GG','Guernsey','+44'],['GN','Guinea','+224'],['GQ','Guinea Ecuatorial','+240'],['GW','Guinea-Bisáu','+245'],['GY','Guyana','+592'],
  ['HT','Haití','+509'],['HN','Honduras','+504'],['HK','Hong Kong','+852'],['HU','Hungría','+36'],['IN','India','+91'],['ID','Indonesia','+62'],['IQ','Irak','+964'],['IR','Irán','+98'],['IE','Irlanda','+353'],['IM','Isla de Man','+44'],['IS','Islandia','+354'],['KY','Islas Caimán','+1'],['CK','Islas Cook','+682'],['FO','Islas Feroe','+298'],['FK','Islas Malvinas','+500'],['MP','Islas Marianas del Norte','+1'],['MH','Islas Marshall','+692'],['SB','Islas Salomón','+677'],['TC','Islas Turcas y Caicos','+1'],['VG','Islas Vírgenes Británicas','+1'],['VI','Islas Vírgenes de EE.UU.','+1'],['IL','Israel','+972'],['IT','Italia','+39'],
  ['JM','Jamaica','+1'],['JP','Japón','+81'],['JE','Jersey','+44'],['JO','Jordania','+962'],['KZ','Kazajistán','+7'],['KE','Kenia','+254'],['KG','Kirguistán','+996'],['KI','Kiribati','+686'],['KW','Kuwait','+965'],['LA','Laos','+856'],['LS','Lesoto','+266'],['LV','Letonia','+371'],['LB','Líbano','+961'],['LR','Liberia','+231'],['LY','Libia','+218'],['LI','Liechtenstein','+423'],['LT','Lituania','+370'],['LU','Luxemburgo','+352'],
  ['MO','Macao','+853'],['MK','Macedonia del Norte','+389'],['MG','Madagascar','+261'],['MY','Malasia','+60'],['MW','Malaui','+265'],['MV','Maldivas','+960'],['ML','Malí','+223'],['MT','Malta','+356'],['MA','Marruecos','+212'],['MQ','Martinica','+596'],['MU','Mauricio','+230'],['MR','Mauritania','+222'],['YT','Mayotte','+262'],['FM','Micronesia','+691'],['MD','Moldavia','+373'],['MC','Mónaco','+377'],['MN','Mongolia','+976'],['ME','Montenegro','+382'],['MS','Montserrat','+1'],['MZ','Mozambique','+258'],['MM','Myanmar','+95'],
  ['NA','Namibia','+264'],['NR','Nauru','+674'],['NP','Nepal','+977'],['NI','Nicaragua','+505'],['NE','Níger','+227'],['NG','Nigeria','+234'],['NU','Niue','+683'],['NO','Noruega','+47'],['NC','Nueva Caledonia','+687'],['NZ','Nueva Zelanda','+64'],['OM','Omán','+968'],['NL','Países Bajos','+31'],['PK','Pakistán','+92'],['PW','Palaos','+680'],['PS','Palestina','+970'],['PA','Panamá','+507'],['PG','Papúa Nueva Guinea','+675'],['PE','Perú','+51'],['PF','Polinesia Francesa','+689'],['PL','Polonia','+48'],['PT','Portugal','+351'],['PR','Puerto Rico','+1'],
  ['GB','Reino Unido','+44'],['CF','República Centroafricana','+236'],['CZ','República Checa','+420'],['DO','República Dominicana','+1'],['RE','Reunión','+262'],['RW','Ruanda','+250'],['RO','Rumania','+40'],['RU','Rusia','+7'],['EH','Sahara Occidental','+212'],['WS','Samoa','+685'],['AS','Samoa Americana','+1'],['BL','San Bartolomé','+590'],['KN','San Cristóbal y Nieves','+1'],['SM','San Marino','+378'],['MF','San Martín','+590'],['PM','San Pedro y Miquelón','+508'],['VC','San Vicente y las Granadinas','+1'],['SH','Santa Elena','+290'],['LC','Santa Lucía','+1'],['ST','Santo Tomé y Príncipe','+239'],['SN','Senegal','+221'],['RS','Serbia','+381'],['SC','Seychelles','+248'],['SL','Sierra Leona','+232'],['SG','Singapur','+65'],['SX','Sint Maarten','+1'],['SY','Siria','+963'],['SO','Somalia','+252'],['LK','Sri Lanka','+94'],['ZA','Sudáfrica','+27'],['SD','Sudán','+249'],['SS','Sudán del Sur','+211'],['SE','Suecia','+46'],['CH','Suiza','+41'],['SR','Surinam','+597'],
  ['TH','Tailandia','+66'],['TW','Taiwán','+886'],['TZ','Tanzania','+255'],['TJ','Tayikistán','+992'],['TL','Timor Oriental','+670'],['TG','Togo','+228'],['TK','Tokelau','+690'],['TO','Tonga','+676'],['TT','Trinidad y Tobago','+1'],['TN','Túnez','+216'],['TM','Turkmenistán','+993'],['TR','Turquía','+90'],['TV','Tuvalu','+688'],['UA','Ucrania','+380'],['UG','Uganda','+256'],['UZ','Uzbekistán','+998'],['VU','Vanuatu','+678'],['VE','Venezuela','+58'],['VN','Vietnam','+84'],['WF','Wallis y Futuna','+681'],['YE','Yemen','+967'],['DJ','Yibuti','+253'],['ZM','Zambia','+260'],['ZW','Zimbabue','+263']
]
const priorityCountryCodes = new Set(['AR','BR','CO','MX','PY','UY'])
const countryOptionRows = () => [
  ...countryRows.filter(([code]) => priorityCountryCodes.has(code)).sort((a,b)=>a[1].localeCompare(b[1], 'es')),
  ['','──────────','', true],
  ...countryRows.filter(([code]) => !priorityCountryCodes.has(code)).sort((a,b)=>a[1].localeCompare(b[1], 'es'))
]
const countryOptionsHtml = (selected = '') => countryOptionRows().map(([code, name,, disabled]) => disabled
  ? `<option disabled>${name}</option>`
  : `<option value="${code}" ${String(selected || '') === code || String(selected || '').toLowerCase() === name.toLowerCase() ? 'selected' : ''}>${name}</option>`
).join('')
const appCountryName = (value = '') => countryRows.find(([code, name]) => code === value || name.toLowerCase() === String(value || '').toLowerCase())?.[1] || value || ''
const phoneOptionsHtml = (selected = '+54') => countryOptionRows().map(([code, name, dial, disabled]) => disabled
  ? `<option disabled>${name}</option>`
  : `<option value="${dial}" ${String(selected || '') === dial ? 'selected' : ''}>${name} ${dial}</option>`
).join('')
const phoneParts = (value = '') => {
  const text = String(value || '').trim()
  const match = text.match(/^(\+\d{1,4})\s*(.*)$/)
  return { code: match?.[1] || '+54', number: match?.[2] || text }
}
const languageOptionsHtml = (selected = 'es') => [
  ['es','Español'],['en','Inglés'],['pt','Portugués']
].map(([value,label]) => `<option value="${value}" ${String(selected || '').toLowerCase().startsWith(value) ? 'selected' : ''}>${label}</option>`).join('')
const sexOptionsHtml = (selected = '') => [
  ['','Seleccionar'],['masculino','Masculino'],['femenino','Femenino']
].map(([value,label]) => `<option value="${value}" ${String(selected || '').toLowerCase() === value ? 'selected' : ''}>${label}</option>`).join('')
const formatOffset = (timeZone) => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName:'shortOffset' }).formatToParts(new Date())
    return (parts.find(p => p.type === 'timeZoneName')?.value || 'GMT').replace(/^GMT$/, 'GMT+00:00')
  } catch (_) { return 'GMT' }
}
const timeZoneOptionsHtml = (selected = userTimeZone()) => {
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['America/Argentina/Buenos_Aires','America/Montevideo','America/Sao_Paulo','America/Asuncion','America/Mexico_City','America/Bogota','Europe/Madrid','Europe/London','America/New_York']
  const priority = ['America/Argentina/Buenos_Aires','America/Montevideo','America/Sao_Paulo','America/Asuncion','America/Mexico_City','America/Bogota']
  const rows = [...priority.filter(z => zones.includes(z)), '', ...zones.filter(z => !priority.includes(z))]
  return rows.map(zone => zone
    ? `<option value="${zone}" ${selected === zone ? 'selected' : ''}>${formatOffset(zone)} - ${zone.replaceAll('_', ' ')}</option>`
    : '<option disabled>──────────</option>'
  ).join('')
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

const countryNames = {
  ARG:'Argentina', MEX:'México', RSA:'Sudáfrica', KOR:'Corea del Sur', CZE:'República Checa', CAN:'Canadá', BIH:'Bosnia y Herzegovina',
  USA:'Estados Unidos', PAR:'Paraguay', HAI:'Haití', SCO:'Escocia', AUS:'Australia', TUR:'Turquía', BRA:'Brasil',
  MAR:'Marruecos', QAT:'Qatar', SUI:'Suiza', CIV:'Costa de Marfil', ECU:'Ecuador', GER:'Alemania', CUR:'Curazao',
  NED:'Países Bajos', JPN:'Japón', SWE:'Suecia', TUN:'Túnez', KSA:'Arabia Saudita', URU:'Uruguay', ESP:'España',
  CPV:'Cabo Verde', IRN:'Irán', NZL:'Nueva Zelanda', BEL:'Bélgica', EGY:'Egipto', FRA:'Francia', SEN:'Senegal',
  IRQ:'Irak', NOR:'Noruega', ALG:'Argelia', AUT:'Austria', JOR:'Jordania', GHA:'Ghana', PAN:'Panamá',
  ENG:'Inglaterra', CRO:'Croacia', POR:'Portugal', COD:'República Democrática del Congo', UZB:'Uzbekistán', COL:'Colombia'
}

const countryName = (code, fallback = '') => countryNames[code] || fallback || code || ''

const flagImg = (code, className = 'flag-thumb') => {
  const file = flagFiles[code]
  if (!file) return `<span class="${className} flag-placeholder"></span>`
  return `<img class="${className}" src="/flags/${file}" alt="${escapeHtml(code)}" loading="lazy">`
}

const isAdmin = () => ADMIN_EMAILS.includes(state.user?.email) || state.profile?.role === 'admin'
const isVerified = () => state.profile?.verification_status === 'verified'
const canOperate = () => Boolean(state.user && isVerified())
const siteSetting = (key, fallback) => state.siteSettings.find(s => s.key === key)?.value || fallback
const verificationDisclaimer = () => state.user && !isVerified() ? `
  <div class="verification-disclaimer">
    <strong>Verificá tu identidad para operar</strong>
    <span>${escapeHtml(siteSetting('verification_disclaimer', 'Hasta que completes la verificación enviando la documentación solicitada y sea aprobada, no vas a poder comprar, vender ni intercambiar entradas.'))}</span>
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
const verifiedLabel = (sellerId) => sellerProfile(sellerId).verification_status === 'verified' ? `${verifiedBadge(sellerId)} <span class="verified-label">Verificado</span>` : ''
const sellerReputation = (sellerId) => {
  const seller = sellerProfile(sellerId)
  const sales = Number(seller.seller_sales_count || 0)
  const reviews = Number(seller.seller_reviews_count || 0)
  if (!sales && !reviews) return 'Sin ventas todavía'
  const rating = seller.seller_rating ? Number(seller.seller_rating).toFixed(1) : 'Sin calificar'
  return `★ ${rating} · ${sales} ventas · ${reviews} opiniones`
}

const sellerReviews = (sellerId) => state.reviews.filter(r => r.reviewed_user_id === sellerId)
const messageSortValue = (msg = {}) => new Date(msg.created_at || 0).getTime() || 0
const latestMessageValue = (messages = []) => messages.reduce((max, msg) => Math.max(max, messageSortValue(msg)), 0)
const orderUnreadMessages = (orderId) => {
  if (!orderId) return 0
  const seen = Number(readSeenMessages()[orderId] || 0)
  return state.messages.filter(msg => msg.order_id === orderId && messageSortValue(msg) > seen && msg.sender_id !== state.user?.id).length
}
const markOrderMessagesSeen = (orderId, messages = state.messages) => {
  if (!orderId) return
  const latest = latestMessageValue(messages)
  if (!latest) return
  const seen = readSeenMessages()
  seen[orderId] = Math.max(Number(seen[orderId] || 0), latest)
  writeSeenMessages(seen)
}
const replaceOrderMessages = (orderId, messages = []) => {
  state.messages = [
    ...state.messages.filter(msg => msg.order_id !== orderId),
    ...messages
  ].sort((a, b) => messageSortValue(a) - messageSortValue(b))
}
const avatarHtml = (userId, className = 'seller-avatar') => {
  const u = userProfile(userId)
  const initial = escapeHtml((u.first_name || u.email || 'U').slice(0,1).toUpperCase())
  return u.avatar_url ? `<img class="${className}" src="${escapeHtml(u.avatar_url)}" alt="Foto de ${escapeHtml(userName(userId))}">` : `<span class="${className} avatar-fallback">${initial}</span>`
}
const starsHtml = (rating = 0) => {
  const value = Math.round(Number(rating || 0))
  return `<span class="stars">${[1,2,3,4,5].map(n => n <= value ? '★' : '☆').join('')}</span>`
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
    <span><strong>${matchLabel(m)}</strong><small>${m.group_name || phaseLabels[m.phase] || ''} · ${fmtMatchDate(m.match_date)}</small></span>
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
  if (loadingTimer) clearTimeout(loadingTimer)
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
  loadingTimer = setTimeout(() => {
    const current = document.getElementById('loadingRoot')
    if (!current) return
    current.remove()
    loadingTimer = null
    showMessage('La acción tardó más de lo esperado. Ya liberé la pantalla; si no ves el cambio, volvé a intentar o refrescá la página.', { title:'Tiempo de espera agotado', tone:'error' })
  }, 25000)
}

function hideLoading() {
  if (loadingTimer) clearTimeout(loadingTimer)
  loadingTimer = null
  document.getElementById('loadingRoot')?.remove()
}

async function sendEmailNotice(userId, subject, message, actionUrl = window.location.origin) {
  if (!userId || !subject || !message) return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const response = await withTimeout(fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
      },
      body: JSON.stringify({ user_id: userId, subject, message, action_url: actionUrl })
    }), 6000, 'Envío de email')
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}))
      console.warn('No se pudo enviar email', detail)
    }
  } catch (error) {
    console.warn('No se pudo enviar email', error)
  }
}

function renderTemplate(template = '', vars = {}) {
  return String(template || '').replace(/\{\{\s*([\w_]+)\s*\}\}/g, (_, key) => vars[key] ?? '')
}

function emailCopy(eventKey, fallbackSubject, fallbackMessage, vars = {}) {
  const tpl = state.emailTemplates.find(t => t.event_key === eventKey && t.enabled !== false)
  if (!tpl) return { subject: fallbackSubject, message: fallbackMessage }
  return {
    subject: renderTemplate(tpl.subject || fallbackSubject, vars),
    message: renderTemplate(tpl.body || fallbackMessage, vars)
  }
}

async function notifyUser(userId, message, subject = `Nuevo aviso en ${APP_NAME}`, action = {}) {
  if (!userId || !message) return
  try {
    const copy = emailCopy(action.template, subject, message, action.vars || {})
    const payload = {
      user_id: userId,
      message: copy.message,
      subject: copy.subject,
      action_view: action.view || null,
      action_id: action.id ? String(action.id) : null
    }
    let { error } = await withTimeout(supabase.from('notifications').insert(payload), 4500, 'Notificación')
    if (error && (error.message?.includes('action_view') || error.message?.includes('subject'))) {
      const retry = await withTimeout(supabase.from('notifications').insert({ user_id:userId, message }), 4500, 'Notificación')
      error = retry.error
    }
    if (error) {
      console.warn('No se pudo crear la notificación', error)
      return
    }
    sendEmailNotice(userId, copy.subject, copy.message)
  } catch (error) {
    console.warn('No se pudo crear la notificación', error)
  }
}

async function notifyUsers(notices) {
  await Promise.allSettled((notices || []).map(notice => notifyUser(notice.user_id, notice.message, notice.subject, notice.action)))
}

async function insertOrderWithFallback(payload) {
  let result = await supabase.from('orders').insert(payload).select().single()
  if (result.error && /schema cache|column|seller_delivery_status|buyer_delivery_status|admin_/i.test(result.error.message || '')) {
    const legacyPayload = {
      listing_id: payload.listing_id,
      buyer_id: payload.buyer_id,
      seller_id: payload.seller_id,
      quantity: payload.quantity,
      total: payload.total,
      status: payload.status
    }
    result = await supabase.from('orders').insert(legacyPayload).select().single()
  }
  return result
}

function askQuantity(max, unitPrice = 0, currency = 'ARS') {
  const options = Array.from({ length: Number(max) || 0 }, (_, i) => i + 1)
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
          <p>Disponibles: ${Number(max)}. Elegí una cantidad para reservar.</p>
          <select id="quantityPrompt" class="select" onchange="window.appActions.updateQuantityTotal(${Number(unitPrice || 0)}, '${currency}')">${options.map(value => `<option value="${value}">${value}</option>`).join('')}</select>
          <div id="quantityTotal" class="quantity-total">${Number(unitPrice || 0) > 0 ? `${money(unitPrice, currency)} x 1 = ${money(unitPrice, currency)}` : 'Intercambio 1 a 1: elegí cuántas entradas querés intercambiar.'}</div>
          <div class="footer-actions">
            <button class="secondary-btn" onclick="window.appActions.closeMessageModal(null)">Cancelar</button>
            <button class="pill-btn primary" onclick="window.appActions.resolveQuantityPrompt()">Continuar</button>
          </div>
        </div>
      </div>`
    setTimeout(() => document.getElementById('quantityPrompt')?.focus(), 0)
  })
}

async function init({ respectPath = true } = {}) {
  if (supabaseConfigMissing) {
    missingConfigView()
    return
  }
  if (respectPath) state.view = viewFromPath()
  await consumeAuthRedirect()
  const { data: { session } } = await withTimeout(supabase.auth.getSession(), 8000, 'Sesión')
  state.session = session
  state.user = session?.user || null
  if (state.user) await ensureProfile()
  try {
    await loadAll()
  } catch (error) {
    console.warn('Carga inicial incompleta', error)
  }
  render()
  if (pendingAuthNotice) {
    const notice = pendingAuthNotice
    pendingAuthNotice = null
    setTimeout(() => showMessage(notice.message, { title: notice.title, tone: notice.tone }), 0)
  }
  supabase.auth.onAuthStateChange(async (_event, session) => {
    state.session = session
    state.user = session?.user || null
    if (state.user) {
      try { await ensureProfile() } catch (error) { console.warn('Perfil incompleto', error) }
    }
    try { await loadAll() } catch (error) { console.warn('Carga tras auth incompleta', error) }
    render()
  })
  updateRoute(state.view, true)
}

async function ensureProfile() {
  const { data } = await withTimeout(supabase.from('users').select('*').eq('id', state.user.id).maybeSingle(), 8000, 'Perfil')
  if (!data) {
    const meta = state.user.user_metadata || {}
    const fullName = (meta.full_name || meta.name || '').trim().split(' ')
    await supabase.from('users').insert({
      id: state.user.id,
      email: state.user.email,
      first_name: meta.first_name || fullName[0] || '',
      last_name: meta.last_name || fullName.slice(1).join(' ') || '',
      country: meta.country || '',
      document_type: meta.document_type || '',
      document_number: meta.document_number || '',
      document_country: meta.document_country || '',
      account_status: 'active',
      verification_status: 'not_verified',
      timezone: 'America/Argentina/Buenos_Aires',
      preferred_language: 'es',
      preferred_currency: 'ARS',
      role: ADMIN_EMAILS.includes(state.user.email) ? 'admin' : 'user'
    })
  }
  const { data: profile } = await withTimeout(supabase.from('users').select('*').eq('id', state.user.id).maybeSingle(), 8000, 'Perfil')
  state.profile = profile
}

async function loadAll() {
  const [m, l, usersResult, reviewsResult, templatesResult, settingsResult] = await withTimeout(Promise.all([
    supabase.from('matches').select('*').order('match_number', { ascending:true }),
    supabase.from('listings').select('*').order('created_at', { ascending:false }),
    supabase.from('users').select('*'),
    supabase.from('reviews').select('*').order('created_at', { ascending:false }).limit(300),
    isAdmin() ? supabase.from('email_templates').select('*').order('event_key') : Promise.resolve({ data: [] }),
    supabase.from('site_settings').select('*').order('key')
  ]), 9000, 'Carga de datos')
  let users = usersResult
  if (users.error) users = await withTimeout(supabase.from('users').select('id,first_name,last_name,verification_status,avatar_url,seller_rating,seller_reviews_count,seller_sales_count,city,country'), 6500, 'Usuarios')
  let reviews = reviewsResult
  if (reviews.error) reviews = { data: [] }
  let templates = templatesResult
  if (templates.error) templates = { data: [] }
  let settings = settingsResult
  if (settings.error) settings = { data: [] }
  state.matches = m.data || []
  state.listings = l.data || []
  state.users = users.data || []
  state.reviews = reviews.data || []
  state.emailTemplates = templates.data || []
  state.siteSettings = settings.data || []
  if (state.user) {
    const ordersQuery = isAdmin()
      ? supabase.from('orders').select('*').order('created_at', { ascending:false })
      : supabase.from('orders').select('*').or(`buyer_id.eq.${state.user.id},seller_id.eq.${state.user.id}`).order('created_at', { ascending:false })
    const [orders, notifs] = await withTimeout(Promise.all([
      ordersQuery,
      supabase.from('notifications').select('*').eq('user_id', state.user.id).order('created_at', { ascending:false }).limit(80)
    ]), 8000, 'Operaciones')
    state.orders = orders.data || []
    state.notifications = notifs.data || []
    const ids = state.orders.map(order => order.id).filter(Boolean)
    if (ids.length) {
      const orderMessages = await withTimeout(supabase.from('messages').select('*').in('order_id', ids).order('created_at', { ascending:true }).limit(500), 7000, 'Mensajes')
      if (!orderMessages.error) state.messages = orderMessages.data || []
    } else {
      state.messages = []
    }
  } else {
    state.orders = []
    state.notifications = []
    state.messages = []
  }
}

function scheduleBackgroundRefresh(delay = 120) {
  if (supabaseConfigMissing) return
  if (backgroundRefreshTimer) clearTimeout(backgroundRefreshTimer)
  backgroundRefreshTimer = setTimeout(async () => {
    try {
      await loadAll()
      render()
    } catch (error) {
      console.warn('No se pudo refrescar en segundo plano', error)
    }
  }, delay)
}

function minPrice(matchId) {
  const arr = state.listings.filter(l => Number(l.match_id) === Number(matchId) && l.status === 'active' && l.type !== 'exchange' && Number(l.quantity) > 0)
  if (!arr.length) return null
  const min = Math.min(...arr.map(l => Number(l.price || 0)))
  const c = arr.find(l => Number(l.price) === min)?.currency || 'ARS'
  return money(min, c)
}

function activeOffers(matchId, type = 'all') {
  return state.listings.filter(l =>
    Number(l.match_id) === Number(matchId) &&
    l.status === 'active' &&
    Number(l.quantity || 0) > 0 &&
    (type === 'all' || (type === 'sale' ? l.type !== 'exchange' : l.type === 'exchange'))
  )
}

function hasActiveOffers(matchId, type = 'all') {
  return activeOffers(matchId, type).length > 0
}

async function setView(v, options = {}) {
  state.view = v
  if (v !== 'match') {
    state.selectedMatch = null
    state.selectedMatchId = null
  }
  if (options.route !== false) updateRoute(v, Boolean(options.replace))
  render()
  scheduleBackgroundRefresh()
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
        <button class="pill-btn ghost theme-toggle" title="${state.theme==='dark'?'Modo claro':'Modo oscuro'}" onclick="window.appActions.toggleTheme()">${state.theme==='dark'?'☀️':'🌙'}</button>
        ${state.user?`<button class="pill-btn ghost notification-trigger" onclick="window.appActions.toggleNotifications()">🔔 ${unread}</button><button class="pill-btn ghost" onclick="window.appActions.logout()">Salir</button>`:`<button class="pill-btn primary" onclick="window.appActions.setView('auth')">Ingresar</button>`}
      </div>
    </div>
    ${state.user && state.notificationsOpen ? notificationsMini() : ''}
  </div>`
}

function notificationsMini() {
  const items = state.notifications.slice(0, 8)
  return `<div class="notifications-popover">
    <div class="notifications-head">
      <strong>Notificaciones</strong>
      <button class="link-btn" onclick="window.appActions.markAllNotificationsRead()">Marcar todas vistas</button>
    </div>
    <div class="notifications-list">
      ${items.length ? items.map(n=>`
        <div class="notification-item ${n.read ? '' : 'unread'}" onclick="window.appActions.openNotification('${n.id}')">
          <div>
            <strong>${escapeHtml(n.subject || 'Aviso')}</strong>
            <p>${escapeHtml(n.message)}</p>
            <small>${fmtDate(n.created_at)}</small>
          </div>
          <button class="secondary-btn" onclick="event.stopPropagation(); window.appActions.markNotificationRead('${n.id}')">Vista</button>
        </div>
      `).join('') : '<div class="empty">No tenés notificaciones.</div>'}
    </div>
    <button class="pill-btn primary message-action" onclick="window.appActions.setView('notifications')">Ver todas</button>
  </div>`
}

function home() {
  const phases = [...new Set(state.matches.map(m => normalizedPhase(m.phase || 'groups')))].sort((a,b) => phaseRank(a) - phaseRank(b))
  const venues = [...new Set(state.matches.map(m => `${m.city || ''} - ${m.stadium || ''}`))]
  const countries = [...new Map(state.matches.flatMap(m => [
    [m.home_code, countryName(m.home_code, m.home_team)],
    [m.away_code, countryName(m.away_code, m.away_team)]
  ]).filter(([code]) => Boolean(code))).entries()].sort((a,b) => a[1].localeCompare(b[1], 'es'))
  const visibleMatches = filterHomeMatches()
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
        <button class="pill-btn primary" onclick="window.appActions.openHowItWorks()">Cómo funciona</button>
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
      <select class="select" id="countryFilter" onchange="window.appActions.applyFilters()"><option value="">Todos los países</option>${countries.map(([code,name])=>`<option value="${code}">${escapeHtml(name)}</option>`).join('')}</select>
      <select class="select" id="offerTypeFilter" onchange="window.appActions.applyFilters()"><option value="all" ${state.homeOfferType==='all'?'selected':''}>Ventas e intercambios</option><option value="sale" ${state.homeOfferType==='sale'?'selected':''}>Solo ventas</option><option value="exchange" ${state.homeOfferType==='exchange'?'selected':''}>Solo intercambios</option></select>
      <label class="filter-check"><input type="checkbox" id="showNoOffersFilter" onchange="window.appActions.applyFilters()" ${state.homeShowNoOffers ? 'checked' : ''}> Mostrar partidos sin ofertas</label>
    </div>
    <div id="matchesWrap">${matchesHtml(visibleMatches)}</div>
  </div>`
}

function filterHomeMatches() {
  const q = document.getElementById('q')?.value.toLowerCase() || ''
  const phase = document.getElementById('phaseFilter')?.value || ''
  const venue = document.getElementById('venueFilter')?.value || ''
  const country = document.getElementById('countryFilter')?.value || ''
  const offerType = document.getElementById('offerTypeFilter')?.value || state.homeOfferType
  const showNoOffers = document.getElementById('showNoOffersFilter')?.checked ?? state.homeShowNoOffers
  state.homeOfferType = offerType
  state.homeShowNoOffers = showNoOffers
  return state.matches.filter(m => {
    const text = `${m.home_team} ${m.away_team} ${countryName(m.home_code)} ${countryName(m.away_code)} ${m.home_code} ${m.away_code} ${m.city} ${m.stadium}`.toLowerCase()
    return (!q || text.includes(q)) &&
      (!phase || normalizedPhase(m.phase) === phase) &&
      (!venue || `${m.city || ''} - ${m.stadium || ''}` === venue) &&
      (!country || m.home_code === country || m.away_code === country) &&
      (showNoOffers || hasActiveOffers(m.id, offerType))
  })
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
  const offers = hasActiveOffers(m.id, state.homeOfferType)
  return `
  <article class="match-card ${offers ? '' : 'no-offers'}">
    <div class="match-number">${m.match_number || m.id}</div>
    <div class="match-info">
      <h3 class="teams-line">
        <span class="team-chip">${flagImg(m.home_code)}<span>${m.home_code || m.home_team}</span></span>
        <span class="vs-text">vs</span>
        <span class="team-chip">${flagImg(m.away_code)}<span>${m.away_code || m.away_team}</span></span>
      </h3>
      <div class="meta">${m.group_name || phaseLabels[m.phase] || ''}</div>
      <div class="meta">📍 ${m.city || ''} - ${m.stadium || ''}</div>
      <div class="meta">🗓️ ${fmtMatchDate(m.match_date)}</div>
      <div class="match-actions">
        <button class="price-btn" onclick="window.appActions.openMatch('${m.id}')" ${offers ? '' : 'disabled'}>${offers ? (price ? `Desde ${price}` : 'Ver ofertas') : 'Sin ofertas'}</button>
        <button class="secondary-btn" onclick="window.appActions.requireLogin('sell','${m.id}')">Vender</button>
      </div>
    </div>
  </article>`
}

function authView() {
  const isRegister = state.authMode === 'register'
  const isReset = state.authMode === 'reset'
  return `
  <div class="container">
    <div class="auth-shell">
      <div class="panel auth-panel">
        <h2>${isRegister ? 'Crear cuenta' : isReset ? 'Recuperar contraseña' : 'Ingresar'}</h2>
        <p class="meta">${isRegister ? 'Completá tus datos para publicar, comprar e intercambiar entradas.' : isReset ? 'Ingresá tu email o documento y te enviaremos un enlace para renovar la contraseña.' : 'Entrá con tu email o con Google.'}</p>
        ${isRegister ? `
        <div class="form-grid">
          <div class="field"><label>Nombre</label><input id="regFirst" class="input"></div>
          <div class="field"><label>Apellido</label><input id="regLast" class="input"></div>
          <div class="field"><label>Email</label><input id="regEmail" class="input"></div>
          <div class="field"><label>Contraseña</label><input id="regPass" type="password" class="input"></div>
          <div class="field"><label>País</label><select id="regCountry" class="select">${countryOptionsHtml('AR')}</select></div>
          <div class="field"><label>Tipo documento</label><select id="regDocType" class="select"><option>DNI</option><option>Pasaporte</option><option>CI</option></select></div>
          <div class="field"><label>Número documento</label><input id="regDoc" class="input"></div>
          <div class="field"><label>País emisión documento</label><select id="regDocCountry" class="select">${countryOptionsHtml('AR')}</select></div>
        </div>
        <div class="auth-actions"><button class="pill-btn primary" onclick="window.appActions.register()">Crear cuenta</button></div>
        <button class="link-btn" onclick="window.appActions.setAuthMode('login')">Ya tengo cuenta</button>
        ` : isReset ? `
        <div class="field"><label>Email o número de documento</label><input id="resetIdentifier" class="input" placeholder="tu@email.com o DNI"></div>
        <div class="auth-actions"><button class="pill-btn primary" onclick="window.appActions.resetPassword()">Enviar enlace de recuperación</button></div>
        <button class="link-btn" onclick="window.appActions.setAuthMode('login')">Volver al ingreso</button>
        ` : `
        <div class="field"><label>Email</label><input id="loginEmail" class="input"></div>
        <div class="field"><label>Contraseña</label><input id="loginPass" type="password" class="input"></div>
        <div class="auth-actions"><button class="pill-btn primary" onclick="window.appActions.login()">Ingresar</button></div>
        <div class="social-login">
          <button class="oauth-btn google-btn" onclick="window.appActions.oauthLogin('google')"><img class="google-icon" src="/google-login-icon.avif" alt=""> <span>Iniciar sesión con Google</span></button>
        </div>
        <button class="link-btn" onclick="window.appActions.setAuthMode('reset')">Olvidé mi contraseña</button>
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
          <span>🗓️ ${fmtMatchDate(m.match_date)}</span>
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
  const statusGroup = listingStatusGroup(l)
  return `<div class="item listing-item status-${statusGroup}">
    <div class="listing-head">
      <div><span class="listing-price">${l.price ? money(l.price,l.currency) : 'Intercambio'}</span><strong>${l.type==='exchange'?'Intercambio':'Venta'} · Categoría ${l.category}</strong></div>
      <span class="seller-rating">${sellerReputation(l.seller_id)}</span>
    </div>
    <div class="seller-line">
      <button class="seller-profile-button" onclick="window.appActions.openSellerProfile('${l.seller_id}')">${avatarHtml(l.seller_id)}<span>${escapeHtml(sellerName(l.seller_id))}</span></button>
      ${verifiedLabel(l.seller_id)}
    </div>
    <div class="listing-facts">
      <span><strong>${Number(l.quantity || 0)}</strong> disponibles</span>
      ${l.sector ? `<span>Sector ${escapeHtml(l.sector)}</span>` : ''}
      ${l.seats ? `<span>Asientos ${escapeHtml(l.seats)}</span>` : ''}
    </div>
    ${l.type==='exchange' && exchangeTargets ? `<p class="meta">Busca: ${escapeHtml(exchangeTargets)}</p>`:''}
    ${ownerView ? `<div class="listing-owner-actions"><span class="badge ${statusGroup === 'available' ? 'ok' : 'warn'}">${statusGroup === 'available' ? 'Disponible' : 'Finalizada'}</span>${statusGroup === 'available' ? `<button class="secondary-btn" onclick="window.appActions.openListingModal('', '${l.id}')">Editar</button><button class="pill-btn danger" onclick="window.appActions.deleteListing('${l.id}')">Eliminar</button>` : ''}</div>` : (canBuy?`<button class="price-btn" onclick="window.appActions.startBuy('${l.id}')">Comprar</button>`:`<button class="secondary-btn" onclick="window.appActions.startExchange('${l.id}')">Ofrecer intercambio</button>`)}
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

function listingForm(prefMatchId='', listing = null) {
  const selectedMatchId = listing?.match_id || prefMatchId || ''
  return `
    <input id="editingListingId" type="hidden" value="${listing?.id || ''}">
    <div class="form-grid">
      <div class="field"><label>Tipo</label><select id="sellType" class="select" onchange="window.appActions.toggleExchangeFields()"><option value="sale" ${listing?.type !== 'exchange' ? 'selected' : ''}>Vender</option><option value="exchange" ${listing?.type === 'exchange' ? 'selected' : ''}>Intercambiar</option></select></div>
      ${matchPicker('sellMatch', 'Partido de tu entrada', selectedMatchId)}
      <div class="field"><label>Categoría</label><select id="sellCat" class="select">${[1,2,3,4].map(cat => `<option ${Number(listing?.category || 1) === cat ? 'selected' : ''}>${cat}</option>`).join('')}</select></div>
      <div class="field"><label>Cantidad</label><input id="sellQty" type="number" min="1" class="input" value="${Number(listing?.quantity || 1)}"></div>
      <div class="field sale-only-field"><label>Precio por entrada</label><input id="sellPrice" type="number" class="input" placeholder="Ej: 390000" value="${listing?.price || ''}"></div>
      <div class="field"><label>Sector</label><input id="sellSector" class="input" placeholder="Ej: 120" value="${escapeHtml(listing?.sector || '')}"></div>
      <div class="field"><label>Asientos</label><input id="sellSeats" class="input" placeholder="Ej: 5, 6 y 7" value="${escapeHtml(listing?.seats || '')}"></div>
      <div class="field sale-only-field"><label>Moneda</label><select id="sellCurrency" class="select"><option ${listing?.currency !== 'USD' ? 'selected' : ''}>ARS</option><option ${listing?.currency === 'USD' ? 'selected' : ''}>USD</option></select></div>
      <div class="field sale-only-field"><label>Método de cobro</label><select id="payMethod" class="select">${['Alias','CBU','USD','Wallet'].map(method => `<option ${listing?.seller_payment_method === method ? 'selected' : ''}>${method}</option>`).join('')}</select></div>
      <div class="field sale-only-field"><label>Alias / CBU / dato de cobro</label><input id="payValue" class="input" value="${escapeHtml(listing?.seller_payment_value || '')}"></div>
    </div>
    <div id="exchangeFields" style="display:${listing?.type === 'exchange' ? 'block' : 'none'};margin-top:14px">
      ${matchPicker('exchangeMatchIds', 'Partido que querés recibir', listing?.exchange_targets?.match_ids?.[0] || '', false)}
      <div class="operation-disclaimer">El intercambio es 1 a 1: publicás tus entradas e indicás qué partido querés recibir a cambio. No se pide precio ni datos de cobro.</div>
    </div>
    <div class="footer-actions"><button class="pill-btn primary" onclick="window.appActions.createListing()">${listing ? 'Guardar cambios' : 'Publicar'}</button></div>`
}

function verificationRejectReason(userId) {
  return `
    <div class="field rejection-reason">
      <label>Motivo para el usuario</label>
      <textarea id="verificationReason_${userId}" class="input" rows="3" placeholder="Ej: La imagen del documento no se ve nítida. Por favor volvé a subirla con mejor luz."></textarea>
      <small>Este mensaje le aparecerá al usuario como notificación.</small>
    </div>`
}

function openListingModalHtml(prefMatchId='', listing = null) {
  return `
    <div class="modal-backdrop show" onclick="if(event.target.classList.contains('modal-backdrop')) window.appActions.closeVerificationModal()">
      <div class="modal listing-modal">
        <div class="modal-header"><h2>${listing ? 'Editar publicación' : 'Nueva publicación'}</h2><button class="secondary-btn" onclick="window.appActions.closeVerificationModal()">Cerrar</button></div>
        <div class="modal-body">
          ${listingForm(prefMatchId, listing)}
        </div>
      </div>
    </div>`
}

function sellerProfileModalHtml(userId) {
  const u = userProfile(userId)
  const reviews = sellerReviews(userId)
  const rating = Number(u.seller_rating || 0)
  const publications = state.listings
    .filter(l => l.seller_id === userId && l.status === 'active' && Number(l.quantity || 0) > 0)
    .sort((a,b) => String(a.type || '').localeCompare(String(b.type || '')) || Number(a.price || 0) - Number(b.price || 0))
  const publicationHtml = publications.map(l => {
    const m = state.matches.find(match => Number(match.id) === Number(l.match_id)) || {}
    return `<div class="seller-publication">
      <div>
        <strong>${l.type === 'exchange' ? 'Intercambio' : 'Venta'} · ${escapeHtml(matchLabel(m) || `Partido #${l.match_id}`)}</strong>
        <p class="meta">Categoría ${escapeHtml(l.category || '-')} · ${Number(l.quantity || 0)} disponible${Number(l.quantity || 0) === 1 ? '' : 's'}${l.sector ? ` · Sector ${escapeHtml(l.sector)}` : ''}${l.seats ? ` · Asientos ${escapeHtml(l.seats)}` : ''}</p>
      </div>
      <span class="seller-publication-price">${l.type === 'exchange' ? 'Intercambio' : money(l.price || 0, l.currency || 'ARS')}</span>
    </div>`
  }).join('')
  return `
    <div class="modal-backdrop show" onclick="if(event.target.classList.contains('modal-backdrop')) window.appActions.closeVerificationModal()">
      <div class="modal seller-modal">
        <div class="modal-header"><h2>Perfil del vendedor</h2><button class="secondary-btn" onclick="window.appActions.closeVerificationModal()">Cerrar</button></div>
        <div class="modal-body">
          <div class="seller-profile-card">
            ${avatarHtml(userId, 'seller-avatar large')}
            <div>
              <h2>${escapeHtml(userName(userId))} ${verificationBadgeHtml(u.verification_status === 'verified')}</h2>
              <p class="meta">${u.verification_status === 'verified' ? 'Cuenta verificada' : 'Cuenta no verificada'}${u.city ? ` · ${escapeHtml(u.city)}` : ''}${u.country ? ` · ${escapeHtml(appCountryName(u.country))}` : ''}</p>
              <p>${starsHtml(rating)} <strong>${rating ? rating.toFixed(1) : 'Sin puntuación'}</strong></p>
              <p class="meta">${Number(u.seller_sales_count || 0)} transacciones positivas · ${Number(u.seller_reviews_count || 0)} reseñas</p>
            </div>
          </div>
          <div class="seller-reviews">
            <h3>Reseñas</h3>
            ${reviews.length ? reviews.slice(0,5).map(r=>`<div class="review-text"><strong>${starsHtml(r.rating)} ${escapeHtml(userName(r.reviewer_id))}</strong><p>${escapeHtml(r.comment || 'Sin comentario')}</p></div>`).join('') : '<div class="empty">Este usuario todavía no tiene reseñas escritas.</div>'}
          </div>
          <div class="seller-reviews">
            <h3>Publicaciones activas</h3>
            ${publicationHtml || '<div class="empty">Este usuario no tiene publicaciones activas en este momento.</div>'}
          </div>
        </div>
      </div>
    </div>`
}

function profileView() {
  const p = state.profile || {}
  const personalFields = [['first_name','Nombre'],['last_name','Apellido'],['birth_date','Fecha de nacimiento'],['nationality','Nacionalidad'],['sex','Sexo']]
  const documentFields = [['document_type','Tipo de documento'],['document_number','Número de documento'],['document_country','País emisión documento']]
  const contactFields = [['phone','Teléfono'],['country','País'],['state','Provincia/Estado'],['city','Ciudad'],['address','Dirección']]
  const preferenceFields = [['timezone','Zona horaria'],['preferred_language','Idioma preferido'],['preferred_currency','Divisa preferida']]
  const locked = isVerified()
  const lockedAttrs = locked ? 'disabled title="Este dato queda bloqueado después de verificar tu identidad."' : ''
  const phone = phoneParts(p.phone)
  const fieldHtml = (fields, lockSensitive = false) => fields.map(([k,label])=>{
    const lockedAttr = lockSensitive ? lockedAttrs : ''
    if (k === 'birth_date') return `<div class="field"><label>${label}</label><input class="input" id="profile_${k}" type="date" lang="es-AR" value="${escapeHtml(p[k] ? String(p[k]).slice(0,10) : '')}" placeholder="dd/mm/aaaa" ${lockedAttr}><small class="field-hint">Seleccioná desde el calendario.</small></div>`
    if (k === 'nationality' || k === 'document_country' || k === 'country') return `<div class="field"><label>${label}</label><select class="select" id="profile_${k}" ${lockedAttr}>${countryOptionsHtml(p[k] || 'AR')}</select></div>`
    if (k === 'sex') return `<div class="field"><label>Género</label><select class="select" id="profile_${k}" ${lockedAttr}>${sexOptionsHtml(p[k] || '')}</select></div>`
    if (k === 'phone') return `<div class="field full-field"><label>${label}</label><div class="phone-row"><select class="select phone-code" id="profile_phone_country_code">${phoneOptionsHtml(phone.code)}</select><input class="input" id="profile_phone" inputmode="tel" value="${escapeHtml(phone.number)}" placeholder="Número sin código de país"></div></div>`
    if (k === 'timezone') return `<div class="field"><label>${label}</label><select class="select" id="profile_${k}">${timeZoneOptionsHtml(p[k] || userTimeZone())}</select></div>`
    if (k === 'preferred_language') return `<div class="field"><label>${label}</label><select class="select" id="profile_${k}">${languageOptionsHtml(p[k] || 'es')}</select></div>`
    return `<div class="field"><label>${label}</label><input class="input" id="profile_${k}" value="${escapeHtml(p[k] || '')}" ${lockedAttr}></div>`
  }).join('')
  const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim()
  const uploadLockCopy = 'Cuenta verificada: este paso queda bloqueado para proteger tu identidad.'
  const canUploadAvatar = !locked
  const canUploadDocumentFront = !locked && Boolean(p.avatar_url)
  const canUploadDocumentBack = !locked && Boolean(p.identity_document_path)
  const canStartFace = !locked && Boolean(p.identity_document_path && p.identity_document_back_path)
  const stepStatus = (done, enabled) => locked ? 'locked' : done ? 'done' : enabled ? 'active' : 'blocked'
  const stepCopy = (done, enabled, readyText, blockedText) => locked ? uploadLockCopy : done ? readyText : enabled ? blockedText.ready : blockedText.locked
  return `<div class="container">
    <div class="profile-header">
      <div class="avatar-frame">${p.avatar_url ? `<img src="${escapeHtml(p.avatar_url)}" alt="Foto de perfil">` : `<span>${escapeHtml((p.first_name || state.user?.email || 'U').slice(0,1).toUpperCase())}</span>`}</div>
      <div>
        <h1>${escapeHtml(fullName || 'Mi perfil')} ${verificationBadgeHtml(locked)} ${locked ? '<span class="verified-label">Verificado</span>' : ''}</h1>
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
        <p class="meta">Subí tu foto de perfil, el frente y dorso de tu documento, y completá un reconocimiento facial con cámara. Un administrador revisará que nombre, foto y número de documento coincidan.</p>
        <div class="form-grid">${fieldHtml(documentFields, true)}</div>
        <div class="document-warning">
          El documento debe verse nítido y con buena luz. Podés tapar datos sensibles que no necesitamos, como número de trámite, códigos secundarios o domicilio. Deben quedar visibles foto, nombres y número de DNI/documento.
        </div>
        <div class="verification-steps vertical">
          <button class="upload-card step-${stepStatus(p.avatar_url, canUploadAvatar)}" type="button" onclick="window.appActions.openUploadModal('avatar')" ${canUploadAvatar ? '' : 'disabled'}>
            <strong>1. Foto de perfil</strong>
            <span>${locked ? uploadLockCopy : (p.avatar_url ? 'Foto cargada' : 'Buena luz, rostro visible, JPG/PNG/WebP hasta 8 MB.')}</span>
          </button>
          <button class="upload-card step-${stepStatus(p.identity_document_path, canUploadDocumentFront)}" type="button" onclick="window.appActions.openUploadModal('documentFront')" ${canUploadDocumentFront ? '' : 'disabled'}>
            <strong>2. Documento frente</strong>
            <span>${stepCopy(p.identity_document_path, canUploadDocumentFront, `Frente recibido · ${p.identity_document_status || 'pending_review'}`, { ready:'Imagen o PDF, máximo 8 MB.', locked:'Primero cargá tu foto de perfil.' })}</span>
          </button>
          <button class="upload-card step-${stepStatus(p.identity_document_back_path, canUploadDocumentBack)}" type="button" onclick="window.appActions.openUploadModal('documentBack')" ${canUploadDocumentBack ? '' : 'disabled'}>
            <strong>3. Documento dorso</strong>
            <span>${stepCopy(p.identity_document_back_path, canUploadDocumentBack, `Dorso recibido · ${p.identity_document_back_status || 'pending_review'}`, { ready:'Imagen o PDF, máximo 8 MB.', locked:'Primero cargá el frente del documento.' })}</span>
          </button>
          <button class="upload-card camera-card step-${stepStatus(p.liveness_side_path && p.liveness_front_path, canStartFace)}" type="button" onclick="window.appActions.startLivenessCheck()" ${canStartFace ? '' : 'disabled'}>
            <strong>4. Reconocimiento facial</strong>
            <span>${stepCopy(p.liveness_side_path && p.liveness_front_path, canStartFace, `2 tomas recibidas · ${p.liveness_status || 'submitted'}`, { ready:'Captura automática: perfil y frente.', locked:'Primero cargá frente y dorso del documento.' })}</span>
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
  const filteredListings = listings.filter(l => state.publicationFilters[listingStatusGroup(l)])
  const orders = state.orders
  const filteredOrders = orders.filter(o => state.operationFilters[orderStatusGroup(o.status)])
  const filterButton = (type, key, label, active) => `<button class="filter-chip ${active ? 'active' : ''}" onclick="window.appActions.toggleFilter('${type}','${key}')">${label}</button>`
  return `<div class="container"><div class="grid-2">
    <div class="panel">
      <div class="section-head compact-head"><div><h2>Mis compras / operaciones</h2><p class="meta">Filtrá por estado para encontrar rápido lo que necesitás revisar.</p></div></div>
      <div class="filter-row">${Object.entries(orderFilterLabels).map(([key,label]) => filterButton('operation', key, label, state.operationFilters[key])).join('')}</div>
      <div class="list">${filteredOrders.length?filteredOrders.map(orderCard).join(''):`<div class="empty">No hay operaciones visibles con estos filtros.</div>`}</div>
    </div>
    <div class="panel">
      <div class="section-head compact-head"><div><h2>Mis publicaciones</h2><p class="meta">Disponibles son las que todavía tienen stock activo; finalizadas ya no están a la venta.</p></div></div>
      <div class="filter-row">${Object.entries(publicationFilterLabels).map(([key,label]) => filterButton('publication', key, label, state.publicationFilters[key])).join('')}</div>
      <div class="list">${filteredListings.length?filteredListings.map(l=>listingCard(l,false,true)).join(''):`<div class="empty">No hay publicaciones visibles con estos filtros.</div>`}</div>
    </div>
  </div></div>`
}

function orderCard(o) {
  const l = state.listings.find(x=>x.id===o.listing_id)
  const m = state.matches.find(x=>Number(x.id)===Number(l?.match_id))
  const unread = orderUnreadMessages(o.id)
  const group = orderStatusGroup(o.status)
  return `<div class="item order-item status-${group}">
    <strong>Operación #${String(o.id).slice(0,8)} · ${statusLabel[o.status] || o.status} ${unread ? `<span class="message-alert">● ${unread} mensaje${unread === 1 ? '' : 's'} nuevo${unread === 1 ? '' : 's'}</span>` : ''}</strong>
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
  const verificationQueue = state.users.filter(u => u.verification_status === 'pending_review' && u.identity_document_path && (u.identity_document_back_path || u.identity_document_back_status === 'legacy_not_required') && u.liveness_side_path && u.liveness_front_path)
  const sales = state.orders.filter(o => {
    const l = state.listings.find(x=>x.id===o.listing_id)
    return l?.type !== 'exchange' && !String(o.status || '').startsWith('exchange')
  })
  const exchanges = state.orders.filter(o => {
    const l = state.listings.find(x=>x.id===o.listing_id)
    return l?.type === 'exchange' || String(o.status || '').startsWith('exchange')
  })
  const userRows = [...state.users].sort((a,b)=>`${a.first_name || ''} ${a.last_name || ''}`.localeCompare(`${b.first_name || ''} ${b.last_name || ''}`)).map(u=>`
    <tr>
      <td>${escapeHtml(`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'Usuario')} ${verificationBadgeHtml(u.verification_status === 'verified')}<p class="meta">${escapeHtml(u.email || '')}</p></td>
      <td>${escapeHtml(u.verification_status || 'not_verified')}</td>
      <td>${Number(u.seller_sales_count || 0)} ventas</td>
      <td>★ ${u.seller_rating ? Number(u.seller_rating).toFixed(1) : '0.0'} · ${Number(u.seller_reviews_count || 0)} reseñas</td>
      <td><button class="secondary-btn" onclick="window.appActions.openUserEditor('${u.id}')">Editar</button></td>
    </tr>`).join('')
  const templateRows = state.emailTemplates.map(t=>`
    <div class="email-template-card">
      <div><strong>${escapeHtml(t.event_key)}</strong><p class="meta">Variables: {{partido}}, {{precio}}, {{sector}}, {{asientos}}, {{cantidad}}, {{categoria}}, {{comprador}}, {{vendedor}}</p></div>
      <div class="form-grid">
        <div class="field"><label>Asunto</label><input id="tpl_subject_${t.id}" class="input" value="${escapeHtml(t.subject || '')}"></div>
        <div class="field"><label>Activo</label><select id="tpl_enabled_${t.id}" class="select"><option value="true" ${t.enabled !== false ? 'selected' : ''}>Sí</option><option value="false" ${t.enabled === false ? 'selected' : ''}>No</option></select></div>
        <div class="field full-field"><label>Cuerpo</label><textarea id="tpl_body_${t.id}" rows="4">${escapeHtml(t.body || '')}</textarea></div>
      </div>
      <div class="footer-actions"><button class="secondary-btn" onclick="window.appActions.saveEmailTemplate('${t.id}')">Guardar plantilla</button></div>
    </div>`).join('')
  const settingsRows = state.siteSettings.map(s=>`
    <div class="email-template-card">
      <strong>${escapeHtml(s.key)}</strong>
      <div class="field" style="margin-top:10px"><label>Texto editable</label><textarea id="setting_${s.id}" rows="4">${escapeHtml(s.value || '')}</textarea></div>
      <div class="footer-actions"><button class="secondary-btn" onclick="window.appActions.saveSiteSetting('${s.id}')">Guardar mensaje</button></div>
    </div>`).join('')
  const section = state.adminSection || 'users'
  const settingsSection = state.adminSettingsSection || 'matches'
  const matchSettingsRows = state.matches.map(m=>`
    <div class="email-template-card match-config-card">
      <div><strong>#${m.match_number || m.id} ${escapeHtml(m.home_team || m.home_code || '')} vs ${escapeHtml(m.away_team || m.away_code || '')}</strong><p class="meta">${escapeHtml(m.city || '')} · ${escapeHtml(m.stadium || '')}</p></div>
      <div class="form-grid">
        <div class="field"><label>Local</label><input id="match_home_team_${m.id}" class="input" value="${escapeHtml(m.home_team || '')}"></div>
        <div class="field"><label>Visitante</label><input id="match_away_team_${m.id}" class="input" value="${escapeHtml(m.away_team || '')}"></div>
        <div class="field"><label>Ciudad</label><input id="match_city_${m.id}" class="input" value="${escapeHtml(m.city || '')}"></div>
        <div class="field"><label>Estadio</label><input id="match_stadium_${m.id}" class="input" value="${escapeHtml(m.stadium || '')}"></div>
        <div class="field"><label>Fecha y hora local del partido</label><input id="match_date_${m.id}" class="input" type="datetime-local" value="${m.match_date ? escapeHtml(String(m.match_date).slice(0,16)) : ''}"></div>
        <div class="field"><label>Fase</label><input id="match_phase_${m.id}" class="input" value="${escapeHtml(m.phase || '')}"></div>
      </div>
      <div class="footer-actions"><button class="secondary-btn" onclick="window.appActions.saveMatchConfig('${m.id}')">Guardar partido</button></div>
    </div>`).join('')
  const menu = [
    ['users','Usuarios',state.users.length],
    ['verifications','Verificaciones',verificationQueue.length],
    ['exchanges','Intercambios',exchanges.length],
    ['sales','Ventas',sales.length],
    ['settings','Configuración',state.emailTemplates.length + state.siteSettings.length]
  ]
  const content = {
    users: `<section class="admin-module panel">
      <div class="section-head"><div><h2>Usuarios</h2><p class="meta">Editá datos, reputación, transacciones y verificación manual.</p></div></div>
      <table class="admin-table"><thead><tr><th>Usuario</th><th>Verificación</th><th>Transacciones</th><th>Reputación</th><th>Acción</th></tr></thead><tbody>
        ${userRows || `<tr><td colspan="5">No hay usuarios cargados.</td></tr>`}
      </tbody></table>
    </section>`,
    verifications: `<section class="admin-module panel">
      <div class="section-head"><div><h2>Verificaciones</h2><p class="meta">Revisá documento, foto y reconocimiento facial antes de habilitar operaciones.</p></div>${verificationQueue.length ? '<span class="module-dot">!</span>' : ''}</div>
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
    </section>`,
    exchanges: `<section class="admin-module panel">
      <div class="section-head"><div><h2>Intercambios</h2><p class="meta">Quién entrega qué, a quién se libera y qué falta confirmar.</p></div></div>
      <div class="operation-disclaimer">${escapeHtml(siteSetting('exchange_disclaimer', 'Cada parte debe enviar sus entradas al admin. El intercambio se libera cuando ambos lotes estén recibidos.'))}</div>
      <div class="operations-list">${exchanges.length ? exchanges.map(operationFlowCard).join('') : '<div class="empty">No hay intercambios todavía.</div>'}</div>
    </section>`,
    sales: `<section class="admin-module panel">
      <div class="section-head"><div><h2>Ventas</h2><p class="meta">Seguimiento de entradas, pagos y liberación al comprador.</p></div></div>
      <div class="operation-disclaimer">${escapeHtml(siteSetting('seller_disclaimer', 'El vendedor envía entradas al admin. El admin confirma recepción y avisa al comprador para pagar. Luego el vendedor confirma pago y el admin libera entradas.'))}</div>
      <div class="operations-list">${sales.length ? sales.map(operationFlowCard).join('') : '<div class="empty">No hay ventas todavía.</div>'}</div>
    </section>`,
    settings: `<section class="admin-module panel">
      <div class="section-head"><div><h2>Configuración</h2><p class="meta">Plantillas de email, disclaimers y mensajes editables.</p></div></div>
      <div class="settings-submenu">
        <button class="${settingsSection === 'matches' ? 'active' : ''}" onclick="window.appActions.setAdminSettingsSection('matches')">Partidos</button>
        <button class="${settingsSection === 'mails' ? 'active' : ''}" onclick="window.appActions.setAdminSettingsSection('mails')">Mails</button>
        <button class="${settingsSection === 'messages' ? 'active' : ''}" onclick="window.appActions.setAdminSettingsSection('messages')">Mensajes y alertas</button>
      </div>
      ${settingsSection === 'matches' ? `<h3>Configurar partidos</h3><p class="meta">Usalo solo si necesitás corregir sede, fecha, fase o nombres. Los horarios de partidos se mantienen como hora local del evento.</p><div class="operations-list">${matchSettingsRows || '<div class="empty">No hay partidos cargados.</div>'}</div>` : ''}
      ${settingsSection === 'mails' ? `<h3>Plantillas de emails</h3><div class="operations-list">${templateRows || '<div class="empty">No hay plantillas cargadas. Ejecutá el schema para crear las plantillas base.</div>'}</div>` : ''}
      ${settingsSection === 'messages' ? `<h3>Disclaimers y mensajes</h3><div class="operations-list">${settingsRows || '<div class="empty">No hay mensajes configurables. Ejecutá el schema para crear los mensajes base.</div>'}</div>` : ''}
    </section>
    `
  }[section]
  return `<div class="container admin-shell">
    <aside class="admin-sidebar ${state.adminMenuOpen ? 'open' : ''}">
      <button class="hamburger-btn" onclick="window.appActions.toggleAdminMenu()">☰</button>
      <div class="admin-menu-list">
        ${menu.map(([key,label,count])=>`<button class="${section===key?'active':''}" onclick="window.appActions.setAdminSection('${key}')"><span>${label}</span>${count ? `<b>${count}</b>` : ''}</button>`).join('')}
      </div>
    </aside>
    <main class="admin-content">
      <div class="admin-title">
        <div><h1>Dashboard admin</h1><p class="meta">Control operativo de usuarios, verificaciones y entrega de entradas.</p></div>
        ${verificationQueue.length ? `<span class="admin-alert">! ${verificationQueue.length} verificación${verificationQueue.length === 1 ? '' : 'es'} pendiente${verificationQueue.length === 1 ? '' : 's'}</span>` : '<span class="badge ok">Sin verificaciones pendientes</span>'}
      </div>
      <div class="stats-grid">
        <div class="stat"><strong>${state.users.length}</strong><span>Usuarios</span></div>
        <div class="stat"><strong>${verificationQueue.length}</strong><span>Verificaciones</span></div>
        <div class="stat"><strong>${sales.length}</strong><span>Ventas</span></div>
        <div class="stat"><strong>${exchanges.length}</strong><span>Intercambios</span></div>
      </div>
      ${content}
    </main>
  </div>`
}

function notificationsView() {
  return `<div class="container"><div class="panel">
    <div class="section-head"><div><h2>Notificaciones</h2><p class="meta">Tocá una notificación para abrir la operación o la verificación correspondiente.</p></div><button class="secondary-btn" onclick="window.appActions.markAllNotificationsRead()">Marcar todas vistas</button></div>
    <div class="list">${state.notifications.length?state.notifications.map(n=>`
      <div class="item notification-row ${n.read ? '' : 'unread'}" onclick="window.appActions.openNotification('${n.id}')">
        <strong>${n.read?'':'● '}${escapeHtml(n.subject || 'Aviso')}</strong>
        <p class="meta">${escapeHtml(n.message)}</p>
        <p class="meta">${fmtDate(n.created_at)}</p>
        <button class="secondary-btn" onclick="event.stopPropagation(); window.appActions.markNotificationRead('${n.id}')">Marcar vista</button>
      </div>`).join(''):`<div class="empty">No tenés notificaciones.</div>`}</div>
  </div></div>`
}

async function openOrder(id) {
  const localOrder = state.orders.find(x=>x.id===id)
  if (!localOrder && !isAdmin()) return
  const [fresh, messages] = await withTimeout(Promise.all([
    supabase.from('orders').select('*').eq('id', id).maybeSingle(),
    supabase.from('messages').select('*').eq('order_id', id).order('created_at', { ascending:true }).limit(250)
  ]), 8500, 'Detalle de operación')
  const order = fresh.data || localOrder
  state.selectedOrder = order
  replaceOrderMessages(id, messages.data || [])
  markOrderMessagesSeen(id, messages.data || [])
  renderModal({ autoChatBottom:true })
  startOperationAutoRefresh()
}

function startOperationAutoRefresh() {
  if (operationRefreshTimer) clearInterval(operationRefreshTimer)
  operationRefreshTimer = setInterval(async () => {
    if (!state.selectedOrder?.id || supabaseConfigMissing) return
    const modal = document.getElementById('modalRoot')
    if (!modal?.querySelector('.operation-modal')) return
    const chatInput = document.getElementById('chatText')
    if (document.activeElement === chatInput) return
    if (['reviewComment', 'reviewRating'].includes(document.activeElement?.id)) return
    const previousOrderMessages = state.messages.filter(msg => msg.order_id === state.selectedOrder.id)
    const previousLatest = latestMessageValue(previousOrderMessages)
    let orderResult
    let messagesResult
    try {
      ;[orderResult, messagesResult] = await withTimeout(Promise.all([
        supabase.from('orders').select('*').eq('id', state.selectedOrder.id).maybeSingle(),
        supabase.from('messages').select('*').eq('order_id', state.selectedOrder.id).order('created_at', { ascending:true }).limit(250)
      ]), 6500, 'Actualización de operación')
    } catch (error) {
      console.warn('No se pudo actualizar la operación', error)
      return
    }
    if (orderResult.data) state.selectedOrder = orderResult.data
    const nextMessages = messagesResult.error ? previousOrderMessages : (messagesResult.data || [])
    const hasNewMessage = latestMessageValue(nextMessages) > previousLatest
    replaceOrderMessages(state.selectedOrder.id, nextMessages)
    if (hasNewMessage) markOrderMessagesSeen(state.selectedOrder.id, nextMessages)
    renderModal({ preserveScroll:!hasNewMessage, preserveModalScroll:hasNewMessage, autoChatBottom:hasNewMessage })
  }, 5000)
}

function stopOperationAutoRefresh() {
  if (operationRefreshTimer) clearInterval(operationRefreshTimer)
  operationRefreshTimer = null
}

function timelineStepHtml(step) {
  return `<div class="timeline-step ${step.done ? 'done' : ''} ${step.active ? 'active' : ''}">
    <span class="timeline-dot">${step.done ? '✓' : ''}</span>
    <div>
      <strong>${escapeHtml(step.title)}</strong>
      <p>${escapeHtml(step.copy)}</p>
      ${step.meta ? `<em>${escapeHtml(step.meta)}</em>` : ''}
    </div>
  </div>`
}

function saleTimeline(o, l, seller, buyer) {
  const sellerSent = ['sent','received_by_admin','released'].includes(o.seller_delivery_status)
  const adminReceived = o.admin_seller_delivery_status === 'received_by_admin'
  const buyerPaid = o.buyer_payment_status === 'sent'
  const sellerConfirmed = o.seller_payment_status === 'received' || ['payment_confirmed','completed'].includes(o.status)
  const released = o.buyer_delivery_status === 'released' || o.status === 'completed'
  return [
    { title:'1. Vendedor envía entradas', copy:`${seller} debe transferir las entradas a la cuenta de la plataforma.`, meta:`Cuenta: ${PLATFORM_TRANSFER_EMAIL}`, done:sellerSent, active:!sellerSent },
    { title:'2. Verificación de entradas', copy:'El administrador revisa que las entradas recibidas sean correctas antes de habilitar el pago.', done:adminReceived, active:sellerSent && !adminReceived },
    { title:'3. Comprador transfiere al vendedor', copy:`${buyer} puede pagar recién cuando la plataforma confirma que tiene las entradas.`, meta:`Método del vendedor: ${l.seller_payment_method || '-'} ${l.seller_payment_value || ''}`.trim(), done:buyerPaid, active:adminReceived && !buyerPaid },
    { title:'4. Vendedor confirma pago', copy:`${seller} confirma cuando el dinero impactó correctamente.`, done:sellerConfirmed, active:buyerPaid && !sellerConfirmed },
    { title:'5. Admin libera entradas', copy:'La plataforma libera las entradas al comprador y finaliza la operación.', done:released, active:sellerConfirmed && !released }
  ]
}

function exchangeTimeline(o, seller, buyer) {
  const sellerSent = ['sent','released'].includes(o.seller_delivery_status) || o.admin_seller_delivery_status === 'received_by_admin'
  const buyerSent = ['sent','released'].includes(o.buyer_delivery_status) || o.admin_buyer_delivery_status === 'received_by_admin'
  const adminSeller = o.admin_seller_delivery_status === 'received_by_admin'
  const adminBuyer = o.admin_buyer_delivery_status === 'received_by_admin'
  const completed = o.status === 'completed'
  return [
    { title:`1. ${seller} envía sus entradas`, copy:'Debe transferir sus entradas a la cuenta de la plataforma.', meta:`Cuenta: ${PLATFORM_TRANSFER_EMAIL}`, done:sellerSent, active:!sellerSent },
    { title:`2. ${buyer} envía sus entradas`, copy:'Debe transferir sus entradas a la misma cuenta de la plataforma.', meta:`Cuenta: ${PLATFORM_TRANSFER_EMAIL}`, done:buyerSent, active:sellerSent && !buyerSent },
    { title:'3. Admin verifica ambos lotes', copy:'La plataforma confirma que recibió correctamente las entradas de las dos partes.', done:adminSeller && adminBuyer, active:(sellerSent || buyerSent) && !(adminSeller && adminBuyer) },
    { title:'4. Admin libera el intercambio', copy:'Cuando ambos lotes están verificados, cada usuario recibe las entradas acordadas.', done:completed, active:adminSeller && adminBuyer && !completed }
  ]
}

function roleActionsHtml(o, l, isExchange) {
  const isSeller = state.user?.id === o.seller_id
  const isBuyer = state.user?.id === o.buyer_id
  if (isAdmin()) {
    return `<div class="footer-actions">
      ${!isExchange ? `
        <button class="pill-btn primary" ${o.seller_delivery_status === 'sent' && o.admin_seller_delivery_status !== 'received_by_admin' ? '' : 'disabled'} onclick="window.appActions.updateOrderFlow('${o.id}','admin_seller_delivery_status','received_by_admin','awaiting_buyer_payment')">Entradas recibidas</button>
        <button class="pill-btn primary" ${o.seller_payment_status === 'received' && o.buyer_delivery_status !== 'released' ? '' : 'disabled'} onclick="window.appActions.updateOrderFlow('${o.id}','buyer_delivery_status','released','completed')">Liberar entradas al comprador</button>
      ` : `
        <button class="pill-btn primary" ${o.seller_delivery_status === 'sent' && o.admin_seller_delivery_status !== 'received_by_admin' ? '' : 'disabled'} onclick="window.appActions.updateOrderFlow('${o.id}','admin_seller_delivery_status','received_by_admin','exchange_in_progress')">Recibí entradas de usuario 1</button>
        <button class="pill-btn primary" ${o.buyer_delivery_status === 'sent' && o.admin_buyer_delivery_status !== 'received_by_admin' ? '' : 'disabled'} onclick="window.appActions.updateOrderFlow('${o.id}','admin_buyer_delivery_status','received_by_admin','exchange_ready_to_release')">Recibí entradas de usuario 2</button>
        <button class="pill-btn primary" ${o.admin_seller_delivery_status === 'received_by_admin' && o.admin_buyer_delivery_status === 'received_by_admin' && o.status !== 'completed' ? '' : 'disabled'} onclick="window.appActions.completeExchange('${o.id}')">Liberar ambos lotes</button>
      `}
      <button class="secondary-btn" onclick="window.appActions.updateOrder('${o.id}','cancelled')">Cancelar y devolver stock</button>
      <button class="pill-btn danger" onclick="window.appActions.updateOrder('${o.id}','issue')">Marcar problema</button>
    </div>`
  }
  if (isExchange) {
    return `<div class="footer-actions">
      ${isSeller ? `<button class="pill-btn primary" ${o.seller_delivery_status === 'pending' ? '' : 'disabled'} onclick="window.appActions.updateOrderFlow('${o.id}','seller_delivery_status','sent','exchange_in_progress')">Ya envié mis entradas</button>` : ''}
      ${isBuyer ? `<button class="pill-btn primary" ${o.buyer_delivery_status === 'pending' ? '' : 'disabled'} onclick="window.appActions.updateOrderFlow('${o.id}','buyer_delivery_status','sent','exchange_in_progress')">Ya envié mis entradas</button>` : ''}
    </div>`
  }
  return `<div class="footer-actions">
    ${isSeller ? `<button class="pill-btn primary" ${o.seller_delivery_status === 'pending' ? '' : 'disabled'} onclick="window.appActions.updateOrderFlow('${o.id}','seller_delivery_status','sent','seller_ticket_sent')">Ya envié las entradas</button>` : ''}
    ${isBuyer ? `<button class="pill-btn primary" ${o.admin_seller_delivery_status === 'received_by_admin' && o.buyer_payment_status !== 'sent' ? '' : 'disabled'} onclick="window.appActions.openPaymentProofModal('${o.id}')">Ya transferí el dinero</button>` : ''}
    ${isSeller ? `<button class="pill-btn primary" ${o.buyer_payment_status === 'sent' && o.seller_payment_status !== 'received' ? '' : 'disabled'} onclick="window.appActions.updateOrderFlow('${o.id}','seller_payment_status','received','payment_confirmed')">Confirmo pago recibido</button>` : ''}
  </div>`
}

async function addSystemMessage(orderId, text) {
  if (!orderId || !text) return
  try {
    await supabase.from('messages').insert({ order_id:orderId, sender_id:null, text })
  } catch (_) {}
}

function renderModal(options = {}) {
  const o = state.selectedOrder
  if (!o) return
  const previousModal = document.querySelector('#modalRoot .operation-modal')
  const previousChat = document.querySelector('#modalRoot .chat-box')
  const previousReviewComment = document.getElementById('reviewComment')?.value || ''
  const previousReviewRating = document.getElementById('reviewRating')?.value || ''
  const scrollState = options.preserveScroll || options.preserveModalScroll ? {
    modalTop: previousModal?.scrollTop || 0,
    chatTop: options.preserveScroll ? (previousChat?.scrollTop || 0) : null
  } : null
  const l = state.listings.find(x=>x.id===o.listing_id) || {}
  const m = state.matches.find(x=>Number(x.id)===Number(l.match_id)) || {}
  const isExchange = l.type === 'exchange' || String(o.status || '').startsWith('exchange')
  const seller = userName(o.seller_id)
  const buyer = userName(o.buyer_id)
  const sellerTicket = listingTicketSummary(l)
  const buyerTicket = exchangeWantedSummary(l)
  const timeline = isExchange ? exchangeTimeline(o, seller, buyer) : saleTimeline(o, l, seller, buyer)
  const timelineHtml = `
    <div class="operation-disclaimer">${escapeHtml(isExchange
      ? siteSetting('exchange_disclaimer', `Ambos usuarios deben enviar sus entradas a ${PLATFORM_TRANSFER_EMAIL}. La plataforma libera el intercambio solo cuando verificó ambos lotes.`)
      : siteSetting('seller_disclaimer', `El vendedor envía las entradas a ${PLATFORM_TRANSFER_EMAIL}. El comprador solo paga cuando el administrador confirma que las recibió.`)
    )}</div>
    <div class="operation-timeline">${timeline.map(timelineStepHtml).join('')}</div>
    ${roleActionsHtml(o, l, isExchange)}`
  const reviewTarget = state.user?.id === o.seller_id ? o.buyer_id : o.seller_id
  const orderReviews = state.reviews.filter(r => r.order_id === o.id)
  const myReview = orderReviews.find(r => r.reviewer_id === state.user?.id)
  const canReview = state.user && !isAdmin() && o.status === 'completed' && reviewTarget && !myReview
  const reviewBox = canReview ? `
    <div class="panel" style="box-shadow:none;margin-top:14px">
      <h3>Dejar reseña</h3>
      <p class="meta">Calificá a ${escapeHtml(userName(reviewTarget))} por esta operación.</p>
      <div class="form-grid">
        <div class="field"><label>Puntuación</label><select id="reviewRating" class="select"><option value="5">5 estrellas</option><option value="4">4 estrellas</option><option value="3">3 estrellas</option><option value="2">2 estrellas</option><option value="1">1 estrella</option></select></div>
        <div class="field"><label>Comentario</label><textarea id="reviewComment" rows="3" placeholder="Contá cómo fue la operación"></textarea></div>
      </div>
      <div class="footer-actions"><button class="pill-btn primary" onclick="window.appActions.submitReview('${o.id}','${reviewTarget}')">Enviar reseña</button></div>
    </div>` : ''
  const fixedReviewBox = myReview ? `
    <div class="review-text fixed-review">
      <strong>Tu reseña quedó publicada · ${starsHtml(myReview.rating)}</strong>
      <p>${escapeHtml(myReview.comment || 'Sin comentario')}</p>
    </div>` : ''
  const operationReviewsHtml = orderReviews.length ? `
    <div class="panel" style="box-shadow:none;margin-top:14px">
      <h3>Reseñas de la operación</h3>
      <div class="seller-reviews">
        ${orderReviews.map(r=>`<div class="review-text"><strong>${escapeHtml(userName(r.reviewer_id))} → ${escapeHtml(userName(r.reviewed_user_id))} · ${starsHtml(r.rating)}</strong><p>${escapeHtml(r.comment || 'Sin comentario')}</p></div>`).join('')}
      </div>
    </div>` : ''
  const chatMessages = state.messages.filter(msg => msg.order_id === o.id)
  const html = `
    <div class="modal-backdrop show" onclick="if(event.target.classList.contains('modal-backdrop')) window.appActions.closeModal()">
      <div class="modal operation-modal">
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
              ${!isExchange && (o.buyer_payment_proof_path || o.buyer_payment_proof_name) ? `<p><strong>Comprobante:</strong> ${escapeHtml(o.buyer_payment_proof_name || o.buyer_payment_proof_path)} ${o.buyer_payment_proof_path ? `<button class="link-btn inline-link" onclick="window.appActions.viewPaymentProof('${escapeHtml(o.buyer_payment_proof_path)}')">Ver archivo</button>` : ''}</p>` : ''}
              ${timelineHtml}
              ${operationReviewsHtml}
              ${fixedReviewBox}
              ${reviewBox}
            </div>
            <div class="panel" style="box-shadow:none"><h3>Chat</h3>
              <div class="chat-box">${chatMessages.map(msg=>`<div class="msg ${msg.sender_id===state.user?.id?'me':(!msg.sender_id?'system':'')}">${escapeHtml(msg.text || '')}${msg.attachment_path ? `<div class="message-attachment"><button class="link-btn inline-link" onclick="window.appActions.viewChatAttachment('${escapeHtml(msg.attachment_path)}')">📎 ${escapeHtml(msg.attachment_name || 'Archivo adjunto')}</button></div>` : ''}<br><small>${!msg.sender_id ? 'Administrador automático · ' : ''}${fmtDate(msg.created_at)}</small></div>`).join('')}</div>
              <div class="chat-composer">
                <input class="input" id="chatText" placeholder="Escribir mensaje..." onkeydown="window.appActions.handleChatKey(event, '${o.id}')" />
                <label class="attach-icon-btn" title="Adjuntar imagen o PDF">📎<input type="file" accept="image/*,.pdf" onchange="window.appActions.uploadChatAttachment('${o.id}', this.files?.[0])"></label>
                <button class="pill-btn primary" onclick="window.appActions.sendMessage('${o.id}')">Enviar</button>
              </div>
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
  if (scrollState) {
    requestAnimationFrame(() => {
      const nextModal = document.querySelector('#modalRoot .operation-modal')
      const nextChat = document.querySelector('#modalRoot .chat-box')
      if (nextModal) nextModal.scrollTop = scrollState.modalTop
      if (nextChat && scrollState.chatTop !== null) nextChat.scrollTop = scrollState.chatTop
      if (nextChat && options.autoChatBottom) nextChat.scrollTop = nextChat.scrollHeight
      if (previousReviewComment) {
        const reviewComment = document.getElementById('reviewComment')
        if (reviewComment) reviewComment.value = previousReviewComment
      }
      if (previousReviewRating) {
        const reviewRating = document.getElementById('reviewRating')
        if (reviewRating) reviewRating.value = previousReviewRating
      }
    })
  } else if (options.autoChatBottom) {
    requestAnimationFrame(() => {
      const nextChat = document.querySelector('#modalRoot .chat-box')
      if (nextChat) nextChat.scrollTop = nextChat.scrollHeight
    })
  }
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
  async setAdminSection(section){
    state.adminSection = section
    state.adminMenuOpen = true
    render()
    scheduleBackgroundRefresh()
  },
  toggleAdminMenu(){
    state.adminMenuOpen = !state.adminMenuOpen
    render()
  },
  setAdminSettingsSection(section){
    state.adminSettingsSection = section
    render()
  },
  toggleNotifications(){
    state.notificationsOpen = !state.notificationsOpen
    render()
  },
  toggleFilter(type, key){
    if (type === 'operation' && key in state.operationFilters) state.operationFilters[key] = !state.operationFilters[key]
    if (type === 'publication' && key in state.publicationFilters) state.publicationFilters[key] = !state.publicationFilters[key]
    render()
  },
  openHowItWorks(){
    let modal = document.getElementById('modalRoot')
    if (!modal) {
      modal = document.createElement('div')
      modal.id = 'modalRoot'
      document.body.appendChild(modal)
    }
    modal.innerHTML = `
      <div class="modal-backdrop show" onclick="if(event.target.classList.contains('modal-backdrop')) window.appActions.closeVerificationModal()">
        <div class="modal how-modal">
          <div class="modal-header"><h2>Cómo funciona</h2><button class="secondary-btn" onclick="window.appActions.closeVerificationModal()">Cerrar</button></div>
          <div class="modal-body">
            <div class="how-grid">
              <section class="how-card">
                <h3>Comprar entradas</h3>
                <ol>
                  <li>Elegís el partido, categoría, sector y cantidad.</li>
                  <li>La operación reserva esas entradas y el vendedor debe enviarlas a la cuenta segura de la plataforma.</li>
                  <li>El administrador verifica que las entradas recibidas coincidan con la publicación.</li>
                  <li>Recién cuando las entradas están verificadas, el comprador transfiere al vendedor y sube el comprobante.</li>
                  <li>El vendedor confirma el pago recibido y el administrador libera las entradas al comprador.</li>
                </ol>
              </section>
              <section class="how-card">
                <h3>Intercambiar entradas</h3>
                <ol>
                  <li>Elegís la publicación de intercambio y la cantidad 1 a 1.</li>
                  <li>Ambas partes envían sus entradas a ${PLATFORM_TRANSFER_EMAIL}.</li>
                  <li>El administrador revisa los dos lotes para evitar confusiones.</li>
                  <li>Cuando ambos lotes están verificados, la plataforma libera cada entrada a la contraparte.</li>
                </ol>
              </section>
            </div>
            <div class="operation-disclaimer">Importante: Entradas Mundial 2026 no gestiona ni retiene pagos. Nuestro rol es ordenar el proceso, verificar que las entradas estén disponibles antes del pago y dejar trazabilidad de cada paso para que comprador y vendedor operen con mayor confianza.</div>
          </div>
        </div>
      </div>`
  },
  async markNotificationRead(id){
    await supabase.from('notifications').update({ read:true }).eq('id', id)
    const notification = state.notifications.find(n => n.id === id)
    if (notification) notification.read = true
    render()
  },
  async markAllNotificationsRead(){
    if (!state.user) return
    await supabase.from('notifications').update({ read:true }).eq('user_id', state.user.id).eq('read', false)
    state.notifications = state.notifications.map(n => ({ ...n, read:true }))
    render()
  },
  async openNotification(id){
    const notification = state.notifications.find(n => n.id === id)
    if (!notification) return
    await supabase.from('notifications').update({ read:true }).eq('id', id)
    notification.read = true
    state.notificationsOpen = false
    if (notification.action_view === 'order' && notification.action_id) {
      await loadAll()
      await openOrder(notification.action_id)
      render()
      return
    }
    if (notification.action_view === 'profile' || /verificaci/i.test(notification.message || '')) {
      await setView('profile')
      return
    }
    if (notification.action_view === 'admin') {
      await setView('admin')
      return
    }
    await setView('notifications')
  },
  async requireLogin(view, matchId='') {
    if (!state.user) { await setView('auth'); return }
    state.prefMatchId = matchId
    await setView(view)
    if (view === 'sell' && matchId && canOperate()) setTimeout(() => this.openListingModal(matchId), 0)
  },
  async logout(){
    showLoading('Cerrando sesión...')
    try {
      const { error } = await withTimeout(supabase.auth.signOut({ scope: 'local' }), 6000, 'Cerrar sesión')
      if (error) throw error
    } catch (error) {
      console.warn('Cierre de sesión local forzado', error)
    } finally {
      state.session = null
      state.user = null
      state.profile = null
      state.orders = []
      state.notifications = []
      state.messages = []
      state.selectedOrder = null
      state.notificationsOpen = false
      state.view = 'home'
      updateRoute('home', true)
      render()
      hideLoading()
    }
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
    let error = null
    try {
      ;({ error } = await withTimeout(supabase.auth.signInWithPassword({ email, password }), 9000, 'Inicio de sesión'))
    } catch (err) {
      error = err
    } finally {
      hideLoading()
    }
    if (error) await showMessage(error.message, { title: 'No se pudo ingresar', tone: 'error' })
    else {
      showLoading('Preparando tu cuenta...')
      try {
        state.view='home'
        updateRoute('home', true)
        await init({ respectPath:false })
      } finally {
        hideLoading()
      }
    }
  },
  async resetPassword(){
    const identifier = document.getElementById('resetIdentifier')?.value.trim()
    if (!identifier) return showMessage('Ingresá tu email o número de documento.', { title: 'Falta un dato', tone: 'error' })
    showLoading('Preparando recuperación...')
    try {
      let email = identifier
      if (!identifier.includes('@')) {
        const { data } = await withTimeout(supabase.from('users').select('email').eq('document_number', identifier).maybeSingle(), 7000, 'Búsqueda de cuenta')
        email = data?.email || ''
      }
      if (!email) {
        hideLoading()
        return showMessage('No encontramos una cuenta con ese documento. Probá ingresando tu email.', { title: 'Cuenta no encontrada', tone: 'error' })
      }
      const { error } = await withTimeout(supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/ingresar` }), 9000, 'Recuperación')
      hideLoading()
      if (error) return showMessage(error.message, { title: 'No se pudo enviar el email', tone: 'error' })
      await showMessage('Te enviamos un email con el enlace para renovar la contraseña.', { title: 'Revisá tu correo', tone: 'success' })
      state.authMode = 'login'
      render()
    } catch (error) {
      await showMessage(error.message || 'No se pudo preparar la recuperación.', { title: 'No se pudo continuar', tone: 'error' })
    } finally {
      hideLoading()
    }
  },
  async register(){
    const email = document.getElementById('regEmail').value.trim()
    const password = document.getElementById('regPass').value
    const first_name = document.getElementById('regFirst').value.trim()
    const last_name = document.getElementById('regLast').value.trim()
    const country = document.getElementById('regCountry').value
    const document_type = document.getElementById('regDocType').value
    const document_number = document.getElementById('regDoc').value.trim()
    const document_country = document.getElementById('regDocCountry').value
    let data = null
    let error = null
    try {
      ;({ data, error } = await withTimeout(supabase.auth.signUp({
        email,
        password,
        options:{
          emailRedirectTo: `${window.location.origin}/ingresar`,
          data:{ first_name,last_name,country,document_type,document_number,document_country }
        }
      }), 10000, 'Registro'))
    } catch (err) {
      error = err
    }
    if (error) { await showMessage(error.message, { title: 'No se pudo crear la cuenta', tone: 'error' }); return }
    if (data.user) {
      try {
        await withTimeout(supabase.from('users').upsert({ id:data.user.id,email,first_name,last_name,country,document_type,document_number,document_country,account_status:'active',verification_status:'not_verified',preferred_currency:'ARS',preferred_language:'es',timezone:'America/Argentina/Buenos_Aires' }), 8000, 'Perfil inicial')
      } catch (err) {
        console.warn('No se pudo crear el perfil inicial', err)
      }
      notifyUser(data.user.id, 'Tu cuenta fue creada. Verificá tu identidad para poder comprar, vender e intercambiar.', `Bienvenido a ${APP_NAME}`, { view:'profile', template:'registro', vars:{ nombre:first_name } })
    }
    await showMessage('Usuario creado. Iniciá sesión.', { title: 'Cuenta lista', tone: 'success' })
  },
  applyFilters(){
    document.getElementById('matchesWrap').innerHTML = matchesHtml(filterHomeMatches())
  },
  openMatch(id){
    if (!state.openMatchTabs.some(tabId => String(tabId) === String(id))) state.openMatchTabs.push(id)
    state.selectedMatchId = id
    state.selectedMatch = state.matches.find(m=>String(m.id)===String(id))
    state.view='match'
    updateRoute('home')
    render()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  },
  switchMatchTab(id){
    state.selectedMatchId = id
    state.selectedMatch = state.matches.find(m=>String(m.id)===String(id))
    state.view = 'match'
    updateRoute('home')
    render()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  },
  async closeMatchTab(id){
    state.openMatchTabs = state.openMatchTabs.filter(tabId => String(tabId) !== String(id))
    if (String(state.selectedMatchId) === String(id)) {
      const nextId = state.openMatchTabs[state.openMatchTabs.length - 1]
      if (nextId) {
        state.selectedMatchId = nextId
        state.selectedMatch = state.matches.find(m=>String(m.id)===String(nextId))
      } else {
        state.selectedMatchId = null
        state.selectedMatch = null
        await setView('home')
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
      input.value = String(id)
      selected.innerHTML = `<span class="match-chip">${flagImg(match.home_code, 'flag-mini')}${flagImg(match.away_code, 'flag-mini')} ${matchLabel(match)} <button type="button" onclick="window.appActions.removeExchangeMatch('${match.id}')">×</button></span>`
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
    selected.innerHTML = '<span class="meta">Seleccioná el partido que querés recibir</span>'
  },
  toggleExchangeFields(){
    const el = document.getElementById('exchangeFields')
    const isExchange = document.getElementById('sellType').value === 'exchange'
    el.style.display = isExchange ? 'block' : 'none'
    document.querySelectorAll('.sale-only-field').forEach(field => field.style.display = isExchange ? 'none' : 'block')
  },
  openListingModal(prefMatchId='', listingId=''){
    if (!state.user) { state.view='auth'; render(); return }
    if (!canOperate()) {
      return showMessage('Para comprar, vender o intercambiar entradas primero tenés que completar la verificación de identidad y esperar la aprobación.', { title: 'Verificación requerida', tone: 'error' })
    }
    const listing = listingId ? state.listings.find(l => l.id === listingId && l.seller_id === state.user.id) : null
    let modal = document.getElementById('modalRoot')
    if (!modal) {
      modal = document.createElement('div')
      modal.id = 'modalRoot'
      document.body.appendChild(modal)
    }
    modal.innerHTML = openListingModalHtml(prefMatchId, listing)
    this.toggleExchangeFields()
    if (listing?.type === 'exchange') {
      const ids = listing.exchange_targets?.match_ids?.map(String) || []
      const input = document.getElementById('exchangeMatchIds')
      const selected = document.getElementById('exchangeMatchIdsSelected')
      const firstId = ids[0] || ''
      const item = state.matches.find(m => String(m.id) === String(firstId))
      if (input) input.value = firstId
      if (selected) selected.innerHTML = item
        ? `<span class="match-chip">${flagImg(item.home_code, 'flag-mini')}${flagImg(item.away_code, 'flag-mini')} ${matchLabel(item)} <button type="button" onclick="window.appActions.removeExchangeMatch('${item.id}')">×</button></span>`
        : '<span class="meta">Seleccioná el partido que querés recibir</span>'
    }
  },
  openSellerProfile(userId){
    let modal = document.getElementById('modalRoot')
    if (!modal) {
      modal = document.createElement('div')
      modal.id = 'modalRoot'
      document.body.appendChild(modal)
    }
    modal.innerHTML = sellerProfileModalHtml(userId)
  },
  async createListing(){
    if (!state.user) return showMessage('Tenés que ingresar para publicar entradas.', { title: 'Ingresá a tu cuenta' })
    if (!canOperate()) return showMessage('Tu cuenta debe estar verificada para publicar entradas.', { title: 'Verificación requerida', tone: 'error' })
    const editingId = document.getElementById('editingListingId')?.value || ''
    const type = document.getElementById('sellType').value
    const selectedMatch = Number(document.getElementById('sellMatch').value)
    if (!selectedMatch) return showMessage('Seleccioná el partido de tu entrada.', { title: 'Falta el partido', tone: 'error' })
    const exchangeMatchIds = document.getElementById('exchangeMatchIds')?.value.split(',').filter(Boolean) || []
    const exchangeMatches = exchangeMatchIds.map(id => {
      const match = state.matches.find(m => String(m.id) === String(id))
      return match ? matchLabel(match) : null
    }).filter(Boolean)
    if (type === 'exchange' && !exchangeMatchIds.length) return showMessage('Seleccioná el partido que querés recibir a cambio.', { title: 'Falta el partido buscado', tone: 'error' })
    const payload = {
      type,
      match_id: selectedMatch,
      category: Number(document.getElementById('sellCat').value),
      quantity: Number(document.getElementById('sellQty').value),
      price: type === 'exchange' ? 0 : Number(document.getElementById('sellPrice').value || 0),
      currency: type === 'exchange' ? 'USD' : document.getElementById('sellCurrency').value,
      seller_id: state.user.id,
      status:'active',
      seller_payment_method: type === 'exchange' ? null : document.getElementById('payMethod').value,
      seller_payment_value: type === 'exchange' ? null : document.getElementById('payValue').value,
      sector: document.getElementById('sellSector').value.trim(),
      seats: document.getElementById('sellSeats').value.trim(),
      exchange_targets: type==='exchange' ? { match_ids: exchangeMatchIds.slice(0, 1), matches: exchangeMatches.slice(0, 1), text: '' } : null
    }
    const request = editingId
      ? supabase.from('listings').update(payload).eq('id', editingId).eq('seller_id', state.user.id)
      : supabase.from('listings').insert(payload)
    const { error } = await request
    if (error) await showMessage(error.message, { title: 'No se pudo publicar', tone: 'error' })
    else { this.closeVerificationModal(); await showMessage(editingId ? 'Tu publicación fue actualizada.' : 'Tu publicación ya está disponible en el marketplace.', { title: editingId ? 'Publicación actualizada' : 'Publicación creada', tone: 'success' }); await loadAll(); render() }
  },
  async deleteListing(listingId){
    const ok = await showMessage('La publicación dejará de estar disponible para otros usuarios. Si ya tiene operaciones abiertas, esas operaciones no se modifican.', { title: 'Eliminar publicación', tone: 'info' })
    if (!ok) return
    const { error } = await supabase.from('listings').update({ status:'cancelled' }).eq('id', listingId).eq('seller_id', state.user.id)
    if (error) return showMessage(error.message, { title: 'No se pudo eliminar', tone: 'error' })
    await showMessage('La publicación fue eliminada de la disponibilidad.', { title: 'Publicación eliminada', tone: 'success' })
    await loadAll()
    render()
  },
  async startBuy(listingId){
    if (!state.user) { state.view='auth'; render(); return }
    if (!canOperate()) return showMessage('Para comprar entradas primero tenés que completar la verificación de identidad y esperar la aprobación.', { title: 'Verificación requerida', tone: 'error' })
    const l = state.listings.find(x=>x.id===listingId)
    if (!l || l.status !== 'active' || Number(l.quantity || 0) <= 0) return showMessage('Esta oferta ya no tiene entradas disponibles.', { title: 'Sin disponibilidad', tone: 'error' })
    if (l.seller_id === state.user.id) return showMessage('No podés comprar tus propias entradas.', { title: 'Operación no permitida' })
    const qty = Number(await askQuantity(l.quantity, Number(l.price || 0), l.currency || 'ARS'))
    if (!qty) return
    if (qty > Number(l.quantity)) return showMessage('No hay suficientes entradas disponibles.', { title: 'Cantidad no disponible', tone: 'error' })
    showLoading('Reservando entradas...')
    let data
    try {
      const result = await insertOrderWithFallback({
        listing_id: l.id, buyer_id: state.user.id, seller_id: l.seller_id, quantity: qty, total: qty * Number(l.price || 0), status:'pending_payment',
        seller_delivery_status:'pending', buyer_delivery_status:'pending', admin_seller_delivery_status:'pending', buyer_payment_status:'pending', seller_payment_status:'pending'
      })
      if (result.error) { await showMessage(result.error.message, { title: 'No se pudo iniciar la compra', tone: 'error' }); return }
      data = result.data
      await supabase.from('listings').update({ quantity: Number(l.quantity)-qty, status: Number(l.quantity)-qty <= 0 ? 'sold' : 'active' }).eq('id', l.id)
      await addSystemMessage(data.id, `Recordatorio de seguridad: no transfieras dinero hasta que el administrador confirme en esta operación que recibió las entradas. El vendedor debe enviar las entradas a ${PLATFORM_TRANSFER_EMAIL}.`)
      notifyUsers([
        { user_id:l.seller_id, message:'Tenés una nueva venta pendiente.', subject:'Nueva venta pendiente', action:{ view:'order', id:data.id, template:'venta_pendiente', vars:{ partido:listingTicketSummary(l), precio:money(data.total || 0, l.currency), sector:l.sector || '', asientos:l.seats || '', cantidad:qty, categoria:l.category, comprador:userName(state.user.id), vendedor:userName(l.seller_id) } } },
        { user_id:state.user.id, message:'Compra iniciada. Revisá tus operaciones para avanzar.', subject:'Compra iniciada', action:{ view:'order', id:data.id, template:'compra_iniciada', vars:{ partido:listingTicketSummary(l), precio:money(data.total || 0, l.currency), sector:l.sector || '', asientos:l.seats || '', cantidad:qty, categoria:l.category, comprador:userName(state.user.id), vendedor:userName(l.seller_id) } } }
      ])
    } catch (error) {
      await showMessage(error.message || 'No se pudo iniciar la compra.', { title: 'No se pudo iniciar la compra', tone: 'error' })
      return
    } finally {
      hideLoading()
    }
    await showMessage(siteSetting('buyer_disclaimer', 'Seguí los pasos del proceso seguro dentro del detalle de la operación. Usá el chat para coordinar y no hagas pagos ni entregas por fuera de la plataforma.'), { title: 'Compra iniciada', tone: 'success' })
    showLoading('Abriendo detalle de la compra...')
    try {
      await loadAll()
      state.view='my'
      updateRoute('my')
      render()
      await openOrder(data.id)
    } finally {
      hideLoading()
    }
  },
  async startExchange(listingId){
    if (!state.user) { state.view='auth'; render(); return }
    if (!canOperate()) return showMessage('Para intercambiar entradas primero tenés que completar la verificación de identidad y esperar la aprobación.', { title: 'Verificación requerida', tone: 'error' })
    const l = state.listings.find(x=>x.id===listingId)
    if (!l || l.status !== 'active' || Number(l.quantity || 0) <= 0) return showMessage('Esta oferta de intercambio ya no tiene entradas disponibles.', { title: 'Sin disponibilidad', tone: 'error' })
    if (l.seller_id === state.user.id) return showMessage('No podés ofertar sobre tu propia publicación.', { title: 'Operación no permitida' })
    const qty = Number(await askQuantity(l.quantity, 0, l.currency || 'USD'))
    if (!qty) return
    if (qty > Number(l.quantity)) return showMessage('No hay suficientes entradas disponibles para intercambiar.', { title: 'Cantidad no disponible', tone: 'error' })
    const accepted = await showMessage(`Vas a ofrecer un intercambio 1 a 1 por ${qty} entrada${qty === 1 ? '' : 's'}. Ambas partes deberán enviar sus entradas a ${PLATFORM_TRANSFER_EMAIL}; el administrador libera el intercambio cuando verifique ambos lotes.`, { title: 'Confirmar intercambio', tone: 'info' })
    if (!accepted) return
    showLoading('Creando oferta de intercambio...')
    try {
      const { data, error } = await insertOrderWithFallback({
        listing_id:l.id,buyer_id:state.user.id,seller_id:l.seller_id,quantity:qty,total:0,status:'exchange_pending',
        seller_delivery_status:'pending', buyer_delivery_status:'pending', admin_seller_delivery_status:'pending', admin_buyer_delivery_status:'pending'
      })
      if (error) {
        await showMessage(error.message, { title: 'No se pudo enviar la oferta', tone: 'error' })
        return
      }
      await addSystemMessage(data.id, `Recordatorio de seguridad: ambas partes deben enviar sus entradas a ${PLATFORM_TRANSFER_EMAIL}. El administrador verificará ambos lotes antes de liberar el intercambio.`)
      notifyUser(l.seller_id, 'Recibiste una nueva oferta de intercambio.', 'Nueva oferta de intercambio', { view:'order', id:data.id, template:'intercambio_oferta', vars:{ partido:listingTicketSummary(l), comprador:userName(state.user.id), vendedor:userName(l.seller_id) } })
      await showMessage('La oferta de intercambio fue enviada.', { title: 'Oferta enviada', tone: 'success' }); await loadAll(); state.view='my'; updateRoute('my'); render()
    } finally {
      hideLoading()
    }
  },
  async saveProfile(){
    const fields = ['first_name','last_name','birth_date','nationality','document_type','document_number','document_country','sex','phone','country','state','city','address','timezone','preferred_language','preferred_currency']
    const lockedFields = ['first_name','last_name','birth_date','nationality','document_type','document_number','document_country','sex']
    const editableFields = isVerified() ? fields.filter(k => !lockedFields.includes(k)) : fields
    const payload = { id:state.user.id, email:state.user.email }
    editableFields.forEach(k => payload[k] = document.getElementById(`profile_${k}`).value)
    const phoneCode = document.getElementById('profile_phone_country_code')?.value || ''
    const phoneNumber = document.getElementById('profile_phone')?.value.trim() || ''
    if (editableFields.includes('phone')) payload.phone = `${phoneCode} ${phoneNumber}`.trim()
    payload.two_factor_enabled = document.getElementById('profile_two_factor_enabled').value === 'true'
    payload.email_notifications = document.getElementById('profile_email_notifications').value === 'true'
    const { error } = await supabase.from('users').upsert(payload)
    if (error) await showMessage(error.message, { title: 'No se pudo guardar', tone: 'error' })
    else { await showMessage('Tus datos fueron actualizados.', { title: 'Perfil actualizado', tone: 'success' }); await ensureProfile(); render() }
  },
  openUploadModal(kind){
    if (isVerified()) {
      return showMessage('Tu cuenta ya está verificada. Para proteger tu identidad, la foto de perfil, documento y reconocimiento facial quedan bloqueados.', { title: 'Cuenta verificada', tone: 'info' })
    }
    if (kind === 'documentFront' && !state.profile?.avatar_url) {
      return showMessage('Primero subí tu foto de perfil. Después se habilita la carga del frente del documento.', { title: 'Paso pendiente', tone: 'info' })
    }
    if (kind === 'documentBack' && !state.profile?.identity_document_path) {
      return showMessage('Primero subí el frente del documento. Después se habilita el dorso.', { title: 'Paso pendiente', tone: 'info' })
    }
    const isAvatar = kind === 'avatar'
    const isBack = kind === 'documentBack'
    const isDocument = kind === 'documentFront' || kind === 'documentBack' || kind === 'document'
    const title = isAvatar ? 'Subir foto de perfil' : isBack ? 'Subir dorso del documento' : 'Subir frente del documento'
    let modal = document.getElementById('modalRoot')
    if (!modal) {
      modal = document.createElement('div')
      modal.id = 'modalRoot'
      document.body.appendChild(modal)
    }
    modal.innerHTML = `
      <div class="modal-backdrop show" onclick="if(event.target.classList.contains('modal-backdrop')) window.appActions.closeVerificationModal()">
        <div class="modal upload-modal">
          <div class="modal-header"><h2>${title}</h2><button class="secondary-btn" onclick="window.appActions.closeVerificationModal()">Cerrar</button></div>
          <div class="modal-body">
            <div class="upload-disclaimer">
              <strong>${isAvatar ? 'Indicaciones para una foto confiable' : 'Protegé tus datos antes de subir'}</strong>
              <p>${isAvatar ? 'Usá una imagen clara, reciente, con buena luz y el rostro visible. Formatos permitidos: JPG, PNG o WebP. Tamaño máximo: 8 MB.' : isBack ? 'Subí el dorso nítido del DNI/documento, sin reflejos y completo dentro del cuadro. Podés tapar códigos o datos secundarios que no sean necesarios. Formatos permitidos: imagen o PDF. Tamaño máximo: 8 MB.' : 'Subí el frente nítido del DNI/documento, con foto, nombres y número visibles. Podés tapar número de trámite, domicilio, códigos secundarios y datos no necesarios. Formatos permitidos: imagen o PDF. Tamaño máximo: 8 MB.'}</p>
              ${isDocument ? '<p><strong>Importante:</strong> para aprobar la cuenta necesitamos frente, dorso y reconocimiento facial. Si una imagen está borrosa, el administrador puede rechazarla y pedir una nueva carga.</p>' : ''}
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
    } else if (kind === 'documentBack') {
      payload.identity_document_back_path = path
      payload.identity_document_back_status = 'pending_review'
      payload.identity_document_back_uploaded_at = new Date().toISOString()
      payload.verification_status = state.profile?.identity_document_path && state.profile?.liveness_side_path && state.profile?.liveness_front_path ? 'pending_review' : 'not_verified'
    } else {
      payload.identity_document_path = path
      payload.identity_document_status = 'pending_review'
      payload.identity_document_uploaded_at = new Date().toISOString()
      payload.verification_status = state.profile?.identity_document_back_path && state.profile?.liveness_side_path && state.profile?.liveness_front_path ? 'pending_review' : 'not_verified'
    }
    const { error:updateError } = await supabase.from('users').upsert(payload)
    if (updateError) {
      const needsSql = /identity_document_back|schema cache|column/i.test(updateError.message || '')
      return showMessage(needsSql ? 'Falta agregar las columnas nuevas del dorso del documento en Supabase. Ejecutá el SQL actualizado y volvé a intentar.' : updateError.message, { title: 'No se pudo actualizar el perfil', tone: 'error' })
    }
    this.closeVerificationModal()
    await ensureProfile()
    const hasDocs = state.profile?.identity_document_path && state.profile?.identity_document_back_path
    const hasFace = state.profile?.liveness_side_path && state.profile?.liveness_front_path
    await showMessage(kind === 'avatar' ? 'Tu foto de perfil fue actualizada.' : (hasDocs && hasFace ? 'Documento recibido. Tu verificación quedó pendiente de revisión.' : 'Documento recibido. Para enviar la verificación, completá frente, dorso y reconocimiento facial.'), { title: kind === 'avatar' ? 'Foto actualizada' : 'Documento recibido', tone: 'success' })
    render()
  },
  openPaymentProofModal(orderId){
    const o = state.orders.find(order => order.id === orderId) || state.selectedOrder
    const l = state.listings.find(x=>x.id===o?.listing_id) || {}
    let modal = document.getElementById('modalRoot')
    if (!modal) {
      modal = document.createElement('div')
      modal.id = 'modalRoot'
      document.body.appendChild(modal)
    }
    modal.innerHTML = `
      <div class="modal-backdrop show">
        <div class="modal upload-modal">
          <div class="modal-header"><h2>Informar transferencia</h2><button class="secondary-btn" onclick="window.appActions.openOrder('${orderId}')">Volver</button></div>
          <div class="modal-body">
            <div class="upload-disclaimer">
              <strong>Subí el comprobante solo después de transferir</strong>
              <p>Verificá que el administrador ya confirmó las entradas. Transferí al método informado por el vendedor y subí una imagen o PDF del comprobante para que comprador, vendedor y admin lo puedan revisar.</p>
              <p><strong>Datos del vendedor:</strong> ${escapeHtml(l.seller_payment_method || '-')} ${escapeHtml(l.seller_payment_value || '')}</p>
            </div>
            <label class="dropzone" ondragover="event.preventDefault()" ondrop="window.appActions.handlePaymentProofDrop('${orderId}', event)">
              <input id="paymentProofInput" type="file" accept="image/*,.pdf" onchange="window.appActions.uploadPaymentProof('${orderId}', this.files?.[0])">
              <strong>Arrastrá el comprobante acá</strong>
              <span>o hacé click para seleccionarlo</span>
            </label>
          </div>
        </div>
      </div>`
  },
  handlePaymentProofDrop(orderId, event){
    event.preventDefault()
    const file = event.dataTransfer?.files?.[0]
    if (file) this.uploadPaymentProof(orderId, file)
  },
  async uploadPaymentProof(orderId, file){
    if (!file || !state.user) return
    if (file.size > 8 * 1024 * 1024) return showMessage('El comprobante no puede superar los 8 MB.', { title: 'Archivo demasiado grande', tone: 'error' })
    showLoading('Subiendo comprobante...')
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${orderId}/${state.user.id}-${Date.now()}.${ext}`
    const upload = await supabase.storage.from('payment-proofs').upload(path, file, { upsert:false, contentType:file.type })
    if (upload.error) {
      hideLoading()
      return showMessage(upload.error.message, { title: 'No se pudo subir el comprobante', tone: 'error' })
    }
    let update = await supabase.from('orders').update({ buyer_payment_status:'sent', status:'buyer_payment_sent', buyer_payment_proof_path:path, buyer_payment_proof_name:file.name }).eq('id', orderId)
    if (update.error && /schema cache|column|buyer_payment_proof/i.test(update.error.message || '')) {
      update = await supabase.from('orders').update({ buyer_payment_status:'sent', status:'buyer_payment_sent' }).eq('id', orderId)
    }
    if (update.error) {
      hideLoading()
      return showMessage(update.error.message, { title: 'No se pudo informar el pago', tone: 'error' })
    }
    await addSystemMessage(orderId, `El comprador informó la transferencia y subió el comprobante: ${file.name}. El vendedor debe revisar su cuenta y confirmar cuando el pago esté acreditado.`)
    const order = state.orders.find(o => o.id === orderId) || state.selectedOrder
    await notifyUser(order?.seller_id, 'El comprador informó que realizó el pago y subió un comprobante. Revisá tu cuenta y confirmá cuando esté acreditado.', 'Pago informado por comprador', { view:'order', id:orderId })
    await loadAll()
    await openOrder(orderId)
    hideLoading()
  },
  async viewPaymentProof(path){
    if (!path) return
    const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 60 * 5)
    if (error) return showMessage(error.message, { title: 'No se pudo abrir el comprobante', tone: 'error' })
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  },
  async openOrder(id){ await openOrder(id) },
  async closeModal(){
    stopOperationAutoRefresh()
    document.getElementById('modalRoot')?.remove()
    state.selectedOrder=null
    await loadAll()
    render()
  },
  closeVerificationModal(){
    stopCameraStream()
    document.getElementById('modalRoot')?.remove()
  },
  closeMessageModal,
  updateQuantityTotal(unitPrice, currency){
    const qty = Number(document.getElementById('quantityPrompt')?.value || 1)
    const total = document.getElementById('quantityTotal')
    if (total) total.textContent = Number(unitPrice || 0) > 0
      ? `${money(unitPrice, currency)} x ${qty} = ${money(unitPrice * qty, currency)}`
      : `Intercambio 1 a 1 por ${qty} entrada${qty === 1 ? '' : 's'}.`
  },
  resolveQuantityPrompt(){
    const input = document.getElementById('quantityPrompt')
    const value = Number(input?.value || 0)
    closeMessageModal(value > 0 ? value : null)
  },
  async sendMessage(orderId){
    const text = document.getElementById('chatText').value.trim()
    if (!text) return
    await supabase.from('messages').insert({ order_id:orderId, sender_id:state.user.id, text })
    const { data } = await supabase.from('messages').select('*').eq('order_id', orderId).order('created_at', { ascending:true })
    replaceOrderMessages(orderId, data || [])
    markOrderMessagesSeen(orderId, data || [])
    renderModal({ preserveModalScroll:true, autoChatBottom:true })
  },
  handleChatKey(event, orderId){
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    this.sendMessage(orderId)
  },
  async uploadChatAttachment(orderId, file){
    if (!file || !state.user) return
    if (file.size > 10 * 1024 * 1024) return showMessage('El archivo no puede superar los 10 MB.', { title: 'Archivo demasiado grande', tone: 'error' })
    showLoading('Subiendo archivo...')
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const path = `${orderId}/${state.user.id}-${Date.now()}.${ext}`
    const upload = await supabase.storage.from('chat-attachments').upload(path, file, { upsert:false, contentType:file.type })
    if (upload.error) {
      hideLoading()
      return showMessage(upload.error.message, { title: 'No se pudo subir el archivo', tone: 'error' })
    }
    const text = document.getElementById('chatText')?.value.trim() || ''
    let insert = await supabase.from('messages').insert({ order_id:orderId, sender_id:state.user.id, text, attachment_path:path, attachment_name:file.name, attachment_type:file.type })
    if (insert.error && /schema cache|column|attachment_/i.test(insert.error.message || '')) {
      insert = await supabase.from('messages').insert({ order_id:orderId, sender_id:state.user.id, text: text || `Archivo adjunto: ${file.name}` })
    }
    hideLoading()
    if (insert.error) return showMessage(insert.error.message, { title: 'No se pudo enviar el archivo', tone: 'error' })
    const { data } = await supabase.from('messages').select('*').eq('order_id', orderId).order('created_at', { ascending:true })
    replaceOrderMessages(orderId, data || [])
    markOrderMessagesSeen(orderId, data || [])
    renderModal({ preserveModalScroll:true, autoChatBottom:true })
  },
  async viewChatAttachment(path){
    if (!path) return
    const { data, error } = await supabase.storage.from('chat-attachments').createSignedUrl(path, 60 * 5)
    if (error) return showMessage(error.message, { title: 'No se pudo abrir el archivo', tone: 'error' })
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  },
  async updateOrder(id,status){
    const order = state.orders.find(o => o.id === id) || (await supabase.from('orders').select('*').eq('id', id).maybeSingle()).data
    if (status === 'cancelled' && order && !['cancelled','completed'].includes(order.status)) {
      const listing = state.listings.find(l => l.id === order.listing_id) || (await supabase.from('listings').select('*').eq('id', order.listing_id).maybeSingle()).data
      if (listing && listing.type !== 'exchange') {
        const restoredQty = Number(listing.quantity || 0) + Number(order.quantity || 0)
        await supabase.from('listings').update({ quantity: restoredQty, status:'active' }).eq('id', listing.id)
      }
      await notifyUsers([
        { user_id:order.buyer_id, message:'La operación fue cancelada. Las entradas volvieron a estar disponibles.', subject:'Operación cancelada', action:{ view:'order', id } },
        { user_id:order.seller_id, message:'La operación fue cancelada. Las entradas volvieron a estar disponibles.', subject:'Operación cancelada', action:{ view:'order', id } }
      ])
    }
    await supabase.from('orders').update({ status }).eq('id', id)
    await loadAll()
    await openOrder(id)
    render()
  },
  async updateOrderFlow(id, field, value, status){
    const allowed = ['seller_delivery_status','buyer_delivery_status','admin_seller_delivery_status','admin_buyer_delivery_status','buyer_payment_status','seller_payment_status']
    if (!allowed.includes(field)) return
    const order = state.orders.find(o => o.id === id) || (await supabase.from('orders').select('*').eq('id', id).maybeSingle()).data
    const payload = { [field]: value }
    if (status) payload.status = status
    showLoading('Actualizando operación...')
    try {
      const { error } = await supabase.from('orders').update(payload).eq('id', id)
      if (error) { await showMessage(error.message, { title: 'No se pudo actualizar', tone: 'error' }); return }
      if (field === 'seller_delivery_status' && value === 'sent') await addSystemMessage(id, `El vendedor informó que envió las entradas a ${PLATFORM_TRANSFER_EMAIL}. El administrador ahora debe verificar recepción y validez.`)
      if (field === 'buyer_delivery_status' && value === 'sent') await addSystemMessage(id, `El usuario 2 informó que envió sus entradas a ${PLATFORM_TRANSFER_EMAIL}. El administrador debe verificar ese lote.`)
      if (field === 'admin_seller_delivery_status' && value === 'received_by_admin') await addSystemMessage(id, 'El administrador confirmó que recibió las entradas del usuario 1/vendedor.')
      if (field === 'admin_buyer_delivery_status' && value === 'received_by_admin') await addSystemMessage(id, 'El administrador confirmó que recibió las entradas del usuario 2/comprador.')
      if (status === 'awaiting_buyer_payment') {
        await addSystemMessage(id, 'El administrador confirmó las entradas. El comprador ya puede transferir al vendedor usando los datos indicados en esta operación.')
        await notifyUser(order?.buyer_id, 'El admin confirmó que recibió las entradas del vendedor. Ya podés realizar el pago y subir el comprobante en la operación.', 'Entradas recibidas por admin', { view:'order', id })
      }
      if (status === 'payment_confirmed') {
        await addSystemMessage(id, 'El vendedor confirmó que recibió el pago. El administrador debe liberar las entradas al comprador.')
        await notifyUsers([{ user_id:order?.buyer_id, message:'El vendedor confirmó que recibió el pago. El admin liberará las entradas.', subject:'Pago confirmado', action:{ view:'order', id } }])
      }
      if (status === 'completed') {
        await addSystemMessage(id, 'Operación completada. El administrador liberó las entradas y ambas partes ya pueden calificarse.')
        await notifyUser(order?.buyer_id, 'El admin liberó las entradas para vos. Revisá el detalle de la operación.', 'Entradas liberadas', { view:'order', id })
      }
      await loadAll()
      await openOrder(id)
      render()
    } finally {
      hideLoading()
    }
  },
  async completeExchange(id){
    const order = state.orders.find(o => o.id === id) || (await supabase.from('orders').select('*').eq('id', id).maybeSingle()).data
    if (!order || order.status === 'completed') return
    showLoading('Liberando intercambio...')
    try {
      const { error } = await supabase.from('orders').update({
        status:'completed',
        seller_delivery_status:'released',
        buyer_delivery_status:'released',
        admin_seller_delivery_status:'received_by_admin',
        admin_buyer_delivery_status:'received_by_admin'
      }).eq('id', id)
      if (error) { await showMessage(error.message, { title: 'No se pudo completar', tone: 'error' }); return }
      const listing = state.listings.find(l => l.id === order.listing_id) || (await supabase.from('listings').select('*').eq('id', order.listing_id).maybeSingle()).data
      if (listing) {
        const nextQty = Math.max(0, Number(listing.quantity || 0) - Number(order.quantity || 1))
        await supabase.from('listings').update({ quantity: nextQty, status: nextQty <= 0 ? 'sold' : 'active' }).eq('id', listing.id)
      }
      await addSystemMessage(id, 'Intercambio completado. El administrador liberó ambos lotes a las partes correspondientes.')
      await notifyUsers([
        { user_id:order?.seller_id, message:'El intercambio fue completado. El admin liberó las entradas acordadas para vos.', subject:'Intercambio completado', action:{ view:'order', id } },
        { user_id:order?.buyer_id, message:'El intercambio fue completado. El admin liberó las entradas acordadas para vos.', subject:'Intercambio completado', action:{ view:'order', id } }
      ])
      await loadAll()
      await openOrder(id)
      render()
    } finally {
      hideLoading()
    }
  },
  async submitReview(orderId, reviewedUserId){
    const rating = Number(document.getElementById('reviewRating')?.value || 5)
    const comment = document.getElementById('reviewComment')?.value.trim() || ''
    const { data: existingReview } = await supabase.from('reviews').select('id').eq('order_id', orderId).eq('reviewer_id', state.user.id).eq('reviewed_user_id', reviewedUserId).maybeSingle()
    if (existingReview?.id) return showMessage('Ya dejaste tu reseña para esta operación. Para mantener la confianza, no se puede editar ni enviar otra.', { title: 'Reseña ya enviada', tone: 'info' })
    const { error } = await supabase.from('reviews').insert({ order_id: orderId, reviewer_id: state.user.id, reviewed_user_id: reviewedUserId, rating, comment })
    if (error) return showMessage(error.message, { title: 'No se pudo guardar la reseña', tone: 'error' })
    await addSystemMessage(orderId, `${userName(state.user.id)} dejó una reseña para ${userName(reviewedUserId)}. Ya quedó fijada en esta operación.`)
    const existing = sellerReviews(reviewedUserId).filter(r => !(r.order_id === orderId && r.reviewer_id === state.user.id))
    const nextReviews = [...existing, { reviewed_user_id: reviewedUserId, rating }]
    const avg = nextReviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / nextReviews.length
    await supabase.from('users').update({ seller_rating: avg, seller_reviews_count: nextReviews.length }).eq('id', reviewedUserId)
    await showMessage('Gracias. Tu reseña ya quedó publicada en el perfil del usuario.', { title: 'Reseña guardada', tone: 'success' })
    await loadAll()
    await openOrder(orderId)
    render()
  },
  async startLivenessCheck(){
    if (isVerified()) {
      return showMessage('Tu cuenta ya está verificada. El reconocimiento facial queda bloqueado para evitar cambios de identidad.', { title: 'Cuenta verificada', tone: 'info' })
    }
    if (!state.profile?.identity_document_path || !state.profile?.identity_document_back_path) {
      return showMessage('Para hacer el reconocimiento facial primero necesitás cargar frente y dorso del documento.', { title: 'Documentación pendiente', tone: 'info' })
    }
    await showMessage('Vamos a tomar dos fotos automáticamente: primero con la cabeza girada levemente hacia un costado y después mirando al frente. Usá buena luz y mantené el rostro dentro del cuadro.', { title: 'Reconocimiento facial', tone: 'info' })
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
          <div class="modal-header"><h2>Reconocimiento facial</h2><button class="secondary-btn" onclick="window.appActions.closeVerificationModal()">Cerrar</button></div>
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
              <aside class="pose-guide">
                <strong>Modelo de pose</strong>
                <div id="posePreview" class="pose-preview front"><span></span></div>
                <p>Primero girá el rostro 60° hacia un costado. Después mirá al frente, con buena luz y sin taparte la cara.</p>
              </aside>
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
    const preview = document.getElementById('posePreview')
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))
    const guidedCapture = async (label, text, pose) => {
      if (step) step.textContent = label
      if (instruction) instruction.textContent = text
      if (guide) guide.className = `face-guide ${pose}`
      if (preview) preview.className = `pose-preview ${pose}`
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
      const hasDocument = Boolean(state.profile?.identity_document_path && state.profile?.identity_document_back_path)
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
      await showMessage(hasDocument ? 'Las dos tomas fueron recibidas. Tu verificación quedó pendiente de revisión.' : 'Las dos tomas fueron recibidas. Para enviar la verificación, subí también frente y dorso del documento.', { title: 'Reconocimiento facial recibido', tone: 'success' })
      render()
    } catch (error) {
      this.closeVerificationModal()
      await showMessage(error.message || 'No se pudo completar el reconocimiento facial.', { title: 'Intentá de nuevo', tone: 'error' })
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
    const documentBackUrl = await signed('identity-documents', u.identity_document_back_path)
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
              ${filePreview(documentUrl, 'Documento frente')}
              ${filePreview(documentBackUrl, 'Documento dorso')}
              ${filePreview(sideUrl, 'Reconocimiento facial: costado')}
              ${filePreview(frontUrl, 'Reconocimiento facial: frente')}
            </div>
            <div class="document-warning">Verificá que frente y dorso del documento sean nítidos, que nombre y número coincidan con los datos del perfil, y que las dos tomas faciales correspondan a la misma persona.</div>
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
    const verificationFiles = [
      ['Foto de perfil', u.avatar_url, '', true],
      ['Documento frente', u.identity_document_path, 'identity-documents'],
      ['Documento dorso', u.identity_document_back_path, 'identity-documents'],
      ['Reconocimiento costado', u.liveness_side_path, 'verification-selfies'],
      ['Reconocimiento frente', u.liveness_front_path || u.identity_selfie_path, 'verification-selfies']
    ]
    const verificationFilesHtml = verificationFiles.map(([label, path, bucket, isPublic]) => {
      if (!path) return `<div class="verification-file-card missing"><strong>${label}</strong><span>No cargado</span></div>`
      const safePath = escapeHtml(path)
      return `<div class="verification-file-card">
        <strong>${label}</strong>
        ${isPublic ? `<img src="${safePath}" alt="${label}">` : '<span>Archivo privado guardado en Supabase</span>'}
        ${isPublic ? '' : `<button class="secondary-btn" onclick="window.appActions.viewVerificationFile('${bucket}','${safePath}')">Ver archivo</button>`}
      </div>`
    }).join('')
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
            <div class="admin-avatar-uploader">
              <div>
                <strong>Foto de perfil</strong>
                <p class="meta">Podés cargar o reemplazar la foto del usuario desde el administrador. La imagen se guarda como avatar público.</p>
              </div>
              <label class="compact-upload">
                <input type="file" accept="image/*" onchange="window.appActions.adminUploadUserAvatar('${u.id}', this.files?.[0])">
                <span>Subir foto</span>
              </label>
            </div>
            <div class="form-grid admin-user-grid">
              <div class="field"><label>Nombre</label><input id="admin_first_name" class="input" value="${value('first_name')}"></div>
              <div class="field"><label>Apellido</label><input id="admin_last_name" class="input" value="${value('last_name')}"></div>
              <div class="field"><label>Email</label><input id="admin_email" class="input" value="${value('email')}"></div>
              <div class="field"><label>Rol</label><select id="admin_role" class="select"><option value="user" ${selected('role','user')}>Usuario</option><option value="admin" ${selected('role','admin')}>Admin</option></select></div>
              <div class="field"><label>Estado de cuenta</label><select id="admin_account_status" class="select"><option value="active" ${selected('account_status','active')}>Activa</option><option value="suspended" ${selected('account_status','suspended')}>Suspendida</option><option value="blocked" ${selected('account_status','blocked')}>Bloqueada</option></select></div>
              <div class="field"><label>Fecha de nacimiento</label><input id="admin_birth_date" class="input" type="date" value="${escapeHtml(u.birth_date ? String(u.birth_date).slice(0,10) : '')}"></div>
              <div class="field"><label>Nacionalidad</label><select id="admin_nationality" class="select">${countryOptionsHtml(u.nationality || 'AR')}</select></div>
              <div class="field"><label>Género</label><select id="admin_sex" class="select">${sexOptionsHtml(u.sex || '')}</select></div>
              <div class="field"><label>Tipo documento</label><input id="admin_document_type" class="input" value="${value('document_type')}"></div>
              <div class="field"><label>Número documento</label><input id="admin_document_number" class="input" value="${value('document_number')}"></div>
              <div class="field"><label>País documento</label><select id="admin_document_country" class="select">${countryOptionsHtml(u.document_country || 'AR')}</select></div>
              <div class="field"><label>Teléfono</label><input id="admin_phone" class="input" value="${value('phone')}"></div>
              <div class="field"><label>País</label><select id="admin_country" class="select">${countryOptionsHtml(u.country || 'AR')}</select></div>
              <div class="field"><label>Provincia/Estado</label><input id="admin_state" class="input" value="${value('state')}"></div>
              <div class="field"><label>Ciudad</label><input id="admin_city" class="input" value="${value('city')}"></div>
              <div class="field full-field"><label>Dirección</label><input id="admin_address" class="input" value="${value('address')}"></div>
              <div class="field"><label>Zona horaria</label><select id="admin_timezone" class="select">${timeZoneOptionsHtml(u.timezone || userTimeZone())}</select></div>
              <div class="field"><label>Idioma preferido</label><select id="admin_preferred_language" class="select">${languageOptionsHtml(u.preferred_language || 'es')}</select></div>
              <div class="field"><label>Divisa preferida</label><select id="admin_preferred_currency" class="select"><option value="ARS" ${selected('preferred_currency','ARS')}>ARS</option><option value="USD" ${selected('preferred_currency','USD')}>USD</option></select></div>
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
            <div class="profile-module admin-verification-files">
              <h3>Archivos de verificación guardados</h3>
              <p class="meta">Estos son los archivos que el usuario cargó para verificar su identidad. Quedan asociados a su perfil para revisión futura.</p>
              <div class="verification-file-grid">${verificationFilesHtml}</div>
            </div>
            <div class="document-warning">Los cambios hechos por un administrador impactan inmediatamente en publicaciones, perfil y estado de verificación del usuario.</div>
            <div class="footer-actions"><button class="pill-btn primary" onclick="window.appActions.saveAdminUser('${u.id}')">Guardar cambios</button></div>
          </div>
        </div>
      </div>`
  },
  async adminUploadUserAvatar(userId, file){
    if (!isAdmin() || !file) return
    if (!file.type?.startsWith('image/')) {
      return showMessage('La foto de perfil debe ser una imagen.', { title: 'Archivo inválido', tone: 'error' })
    }
    if (file.size > 8 * 1024 * 1024) {
      return showMessage('La imagen no puede superar los 8 MB.', { title: 'Archivo demasiado grande', tone: 'error' })
    }
    showLoading('Subiendo foto...')
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${userId}/admin-avatar-${Date.now()}.${ext}`
      const upload = await withTimeout(supabase.storage.from('profile-photos').upload(path, file, { upsert:false, contentType:file.type }), 12000, 'Subida de foto')
      if (upload.error) throw upload.error
      const { data } = supabase.storage.from('profile-photos').getPublicUrl(path)
      const update = await withTimeout(supabase.from('users').update({ avatar_url: data.publicUrl }).eq('id', userId), 8000, 'Actualización de avatar')
      if (update.error) throw update.error
      await loadAll()
      hideLoading()
      this.openUserEditor(userId)
      await showMessage('La foto de perfil fue actualizada.', { title: 'Foto cargada', tone: 'success' })
    } catch (error) {
      hideLoading()
      await showMessage(error.message || 'No se pudo subir la foto.', { title: 'Error al subir', tone: 'error' })
    }
  },
  async saveAdminUser(userId){
    if (!isAdmin()) return
    const currentUser = state.users.find(u => u.id === userId) || {}
    const textFields = ['first_name','last_name','email','role','account_status','birth_date','nationality','sex','document_type','document_number','document_country','phone','country','state','city','address','timezone','preferred_language','preferred_currency','verification_status']
    const payload = {}
    textFields.forEach(k => payload[k] = document.getElementById(`admin_${k}`)?.value || '')
    payload.seller_sales_count = Number(document.getElementById('admin_seller_sales_count')?.value || 0)
    payload.seller_reviews_count = Number(document.getElementById('admin_seller_reviews_count')?.value || 0)
    payload.seller_rating = Number(document.getElementById('admin_seller_rating')?.value || 0)
    if (payload.verification_status === 'verified') {
      payload.identity_document_status = 'approved'
      payload.identity_document_back_status = 'approved'
      payload.liveness_status = 'approved'
    }
    if (payload.verification_status === 'rejected') {
      payload.identity_document_status = 'rejected'
      payload.identity_document_back_status = 'rejected'
      payload.liveness_status = 'rejected'
    }
    let { error } = await supabase.from('users').update(payload).eq('id', userId)
    if (error && /identity_document_back_status|schema cache|column/i.test(error.message || '')) {
      delete payload.identity_document_back_status
      const retry = await supabase.from('users').update(payload).eq('id', userId)
      error = retry.error
    }
    if (error) return showMessage(error.message, { title: 'No se pudo guardar', tone: 'error' })
    if (payload.verification_status !== currentUser.verification_status && ['verified','rejected'].includes(payload.verification_status)) {
      await notifyUser(
        userId,
        payload.verification_status === 'verified'
          ? 'Tu verificación fue aprobada. Ya podés comprar, vender e intercambiar entradas.'
          : 'Tu verificación fue rechazada. Podés volver a cargar la documentación desde Mi perfil.',
        payload.verification_status === 'verified' ? 'Verificación aprobada' : 'Verificación rechazada',
        { view:'profile', template: payload.verification_status === 'verified' ? 'verificacion_aprobada' : 'verificacion_rechazada', vars:{ motivo:'' } }
      )
    }
    await loadAll()
    this.closeVerificationModal()
    await showMessage('Los datos del usuario fueron actualizados.', { title: 'Usuario actualizado', tone: 'success' })
    render()
  },
  async saveEmailTemplate(id){
    const payload = {
      subject: document.getElementById(`tpl_subject_${id}`)?.value || '',
      body: document.getElementById(`tpl_body_${id}`)?.value || '',
      enabled: document.getElementById(`tpl_enabled_${id}`)?.value === 'true'
    }
    const { error } = await supabase.from('email_templates').update(payload).eq('id', id)
    if (error) return showMessage(error.message, { title: 'No se pudo guardar', tone: 'error' })
    await showMessage('La plantilla fue actualizada.', { title: 'Plantilla guardada', tone: 'success' })
    await loadAll()
    render()
  },
  async saveSiteSetting(id){
    const value = document.getElementById(`setting_${id}`)?.value || ''
    const { error } = await supabase.from('site_settings').update({ value }).eq('id', id)
    if (error) return showMessage(error.message, { title: 'No se pudo guardar', tone: 'error' })
    await showMessage('El mensaje fue actualizado.', { title: 'Configuración guardada', tone: 'success' })
    await loadAll()
    render()
  },
  async saveMatchConfig(id){
    if (!isAdmin()) return
    const payload = {
      home_team: document.getElementById(`match_home_team_${id}`)?.value || '',
      away_team: document.getElementById(`match_away_team_${id}`)?.value || '',
      city: document.getElementById(`match_city_${id}`)?.value || '',
      stadium: document.getElementById(`match_stadium_${id}`)?.value || '',
      match_date: document.getElementById(`match_date_${id}`)?.value || null,
      phase: document.getElementById(`match_phase_${id}`)?.value || ''
    }
    const { error } = await supabase.from('matches').update(payload).eq('id', id)
    if (error) return showMessage(error.message, { title: 'No se pudo guardar el partido', tone: 'error' })
    await showMessage('El partido fue actualizado.', { title: 'Partido guardado', tone: 'success' })
    await loadAll()
    render()
  },
  async updateUserVerification(userId, status){
    const reason = document.getElementById(`verificationReason_${userId}`)?.value.trim() || ''
    const updatePayload = {
      verification_status: status,
      identity_document_status: status === 'verified' ? 'approved' : 'rejected',
      identity_document_back_status: status === 'verified' ? 'approved' : 'rejected',
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
    if (error && /identity_document_back_status|schema cache|column/i.test(error.message || '')) {
      delete updatePayload.identity_document_back_status
      const retry = await supabase.from('users').update(updatePayload).eq('id', userId)
      error = retry.error
    }
    if (error) return showMessage(error.message, { title: 'No se pudo actualizar', tone: 'error' })
    const message = status === 'verified'
      ? 'Tu verificación fue aprobada. Ya podés comprar, vender e intercambiar entradas.'
      : `Tu verificación fue rechazada.${reason ? ` Motivo: ${reason}` : ' Podés volver a cargar la documentación desde Mi perfil.'}`
    await notifyUser(userId, message, status === 'verified' ? 'Verificación aprobada' : 'Verificación rechazada', { view:'profile', template: status === 'verified' ? 'verificacion_aprobada' : 'verificacion_rechazada', vars:{ motivo:reason } })
    await loadAll()
    this.closeVerificationModal()
    await showMessage(status === 'verified' ? 'Usuario verificado.' : 'Verificación rechazada.', { title: 'Estado actualizado', tone: 'success' })
    render()
  }
}

window.addEventListener('popstate', async () => {
  await setView(viewFromPath(), { route:false })
})

init()
