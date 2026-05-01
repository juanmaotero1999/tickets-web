import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadDotEnv() {
  if (!existsSync('.env')) return
  const lines = readFileSync('.env', 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const [key, ...rest] = trimmed.split('=')
    if (!process.env[key]) process.env[key] = rest.join('=').replace(/^["']|["']$/g, '')
  }
}

loadDotEnv()

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Faltan SUPABASE_URL/VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
})

const ids = Array.from({ length: 14 }, (_, index) =>
  `00000000-2026-4000-8000-${String(index + 1).padStart(12, '0')}`
)

const users = [
  ['Fernando', 'Arocena', 'demo+fernando.arocena@entradas-fifa.store', '1988-03-14', 'Argentina', 'DNI', '32478190', 'Argentina', 'Masculino', '+54 9 3446 410231', 'Argentina', 'Entre Rios', 'Gualeguaychu', 'Costanera 122', 'America/Argentina/Cordoba', 'es', 5, 1, 2, '/seed-avatars/fernando-arocena.jpeg'],
  ['Franco', 'Casaretto', 'demo+franco.casaretto@entradas-fifa.store', '1995-07-22', 'Argentina', 'DNI', '38170542', 'Argentina', 'Masculino', '+54 9 11 5721 9084', 'Argentina', 'Buenos Aires', 'CABA', 'Av. Corrientes 1840', 'America/Argentina/Buenos_Aires', 'es', 4.5, 2, 1, '/seed-avatars/franco-casaretto.jpeg'],
  ['Jazmin', 'Farias', 'demo+jazmin.farias@entradas-fifa.store', '1998-11-03', 'Uruguay', 'CI', '51638472', 'Uruguay', 'Femenino', '+598 94 218 774', 'Uruguay', 'Montevideo', 'Pocitos', 'Bulevar Espana 2441', 'America/Montevideo', 'es', 5, 1, 0, '/seed-avatars/jazmin-farias.jpeg'],
  ['Milagros', 'Cardinaux Farabello', 'demo+milagros.cardinaux@entradas-fifa.store', '1993-05-18', 'Argentina', 'DNI', '36590218', 'Argentina', 'Femenino', '+54 9 261 625 4310', 'Argentina', 'Mendoza', 'Mendoza', 'Sarmiento 606', 'America/Argentina/Mendoza', 'es', 4.5, 2, 2, '/seed-avatars/milagros-cardinaux-farabello.jpeg'],
  ['Nadia', 'Insaurralde', 'demo+nadia.insaurralde@entradas-fifa.store', '1990-09-27', 'Paraguay', 'CI', '4429158', 'Paraguay', 'Femenino', '+595 981 405 226', 'Paraguay', 'Central', 'San Lorenzo', 'Defensores del Chaco 901', 'America/Asuncion', 'es', 4, 1, 0, '/seed-avatars/nadia-insaurralde.jpeg'],
  ['Paula Jorgelina', 'Orrego', 'demo+paula.orrego@entradas-fifa.store', '1989-12-08', 'Argentina', 'DNI', '33721906', 'Argentina', 'Femenino', '+54 9 299 583 0192', 'Argentina', 'Neuquen', 'Neuquen', 'Leloir 455', 'America/Argentina/Salta', 'es', 5, 2, 1, '/seed-avatars/paula-jorgelina-orrego.jpeg'],
  ['Anabella', 'Tonetti', 'demo+anabella.tonetti@entradas-fifa.store', '1994-02-11', 'Argentina', 'DNI', '37284011', 'Argentina', 'Femenino', '+54 9 343 507 4498', 'Argentina', 'Entre Rios', 'Parana', 'Urquiza 1370', 'America/Argentina/Cordoba', 'es', 4.5, 2, 2, '/seed-avatars/anabella-tonetti.jpeg'],
  ['Carolina', 'Loss Schneider', 'demo+carolina.loss@entradas-fifa.store', '1991-06-30', 'Brasil', 'RG', 'MG-1827364', 'Brasil', 'Femenino', '+55 11 97642 1148', 'Brasil', 'Sao Paulo', 'Sao Paulo', 'Rua Augusta 914', 'America/Sao_Paulo', 'pt', 4, 1, 0, '/seed-avatars/carolina-loss-schneider.jpeg'],
  ['Juan Manuel', 'Costa', 'demo+juan.costa@entradas-fifa.store', '1992-04-25', 'Argentina', 'DNI', '35190842', 'Argentina', 'Masculino', '+54 9 341 642 9158', 'Argentina', 'Santa Fe', 'Rosario', 'Pellegrini 1882', 'America/Argentina/Cordoba', 'es', 5, 1, 1, '/seed-avatars/juan-manuel-costa.jpeg'],
  ['Juan Manuel', 'Otero', 'demo+juan.otero@entradas-fifa.store', '1996-01-09', 'Argentina', 'DNI', '39440721', 'Argentina', 'Masculino', '+54 9 3446 552870', 'Argentina', 'Entre Rios', 'Gualeguaychu', '25 de Mayo 742', 'America/Argentina/Cordoba', 'es', 4.5, 2, 2, '/seed-avatars/juan-manuel-otero.jpeg'],
  ['Veronica', 'Penalva', 'demo+veronica.penalva@entradas-fifa.store', '1979-08-19', 'Argentina', 'DNI', '28164037', 'Argentina', 'Femenino', '+54 9 223 561 7342', 'Argentina', 'Buenos Aires', 'Mar del Plata', 'Guemes 3051', 'America/Argentina/Buenos_Aires', 'es', 5, 1, 1, '/seed-avatars/veronica-penalva.jpeg'],
  ['Tadeo', 'Collazo', 'demo+tadeo.collazo@entradas-fifa.store', '2000-10-02', 'Argentina', 'DNI', '42197056', 'Argentina', 'Masculino', '+54 9 11 3891 6025', 'Argentina', 'Buenos Aires', 'La Plata', 'Calle 54 711', 'America/Argentina/Buenos_Aires', 'es', 4, 1, 0, '/seed-avatars/tadeo-collazo.jpeg'],
  ['Santiago', 'Alonso Quiroga', 'demo+santiago.quiroga@entradas-fifa.store', '1997-03-06', 'Colombia', 'CC', '1029384756', 'Colombia', 'Masculino', '+57 300 418 2291', 'Colombia', 'Antioquia', 'Medellin', 'Carrera 43A 19-17', 'America/Bogota', 'es', 4.5, 2, 1, '/seed-avatars/santiago-alonso-quiroga.jpeg'],
  ['Ricardo', 'Otero', 'demo+ricardo.otero@entradas-fifa.store', '1974-07-15', 'Argentina', 'DNI', '23650492', 'Argentina', 'Masculino', '+54 9 3446 447903', 'Argentina', 'Entre Rios', 'Gualeguaychu', 'San Martin 155', 'America/Argentina/Cordoba', 'es', 5, 1, 2, '/seed-avatars/ricardo-otero.jpeg']
].map((u, index) => ({
  id: ids[index],
  first_name: u[0],
  last_name: u[1],
  email: u[2],
  birth_date: u[3],
  nationality: u[4],
  document_type: u[5],
  document_number: u[6],
  document_country: u[7],
  sex: u[8],
  phone: u[9],
  country: u[10],
  state: u[11],
  city: u[12],
  address: u[13],
  timezone: u[14],
  preferred_language: u[15],
  seller_rating: u[16],
  seller_reviews_count: u[17],
  seller_sales_count: u[18],
  avatar_url: u[19],
  preferred_currency: 'USD',
  two_factor_enabled: false,
  account_status: 'active',
  verification_status: 'verified',
  identity_document_status: 'approved',
  identity_document_back_status: 'approved',
  liveness_status: 'approved',
  role: 'user',
  created_at: new Date(Date.now() - (42 - index * 2) * 86400000).toISOString()
}))

const reviews = [
  [1, 0, 5, 'Muy claro con los tiempos y envio todo rapido.'],
  [2, 1, 5, 'Operacion prolija y comunicacion excelente.'],
  [3, 1, 4, 'Todo bien, solo tardo un poco en responder.'],
  [4, 2, 5, 'Muy buena predisposicion y datos completos.'],
  [5, 3, 5, 'Excelente experiencia, todo tal cual lo publicado.'],
  [6, 3, 4, 'Muy confiable, volveria a operar.'],
  [7, 4, 4, 'Cumplio con lo acordado.'],
  [8, 5, 5, 'Rapida y muy ordenada con la informacion.'],
  [9, 5, 5, 'Todo perfecto y sin vueltas.'],
  [10, 6, 5, 'Publicacion clara y operacion segura.'],
  [11, 6, 4, 'Muy buena atencion durante todo el proceso.'],
  [12, 7, 4, 'Respondio rapido y fue amable.'],
  [13, 8, 5, 'Datos completos y entrega sin problemas.'],
  [0, 9, 5, 'Muy buena comunicacion y todo correcto.'],
  [2, 9, 4, 'Confiable, proceso ordenado.'],
  [3, 10, 5, 'Excelente trato y respuesta inmediata.'],
  [4, 11, 4, 'Todo bien documentado.'],
  [5, 12, 5, 'Muy atento y responsable.'],
  [6, 12, 4, 'Buena experiencia general.'],
  [7, 13, 5, 'Operacion rapida y sin inconvenientes.']
].map(([reviewer, reviewed, rating, comment], index) => ({
  order_id: null,
  reviewer_id: ids[reviewer],
  reviewed_user_id: ids[reviewed],
  rating,
  comment,
  created_at: new Date(Date.now() - (20 - index) * 86400000).toISOString()
}))

const offerPlan = [
  [0, 'sale', 3, 2, 1215, '118', '12, 13', null, 'Alias', 'fernando.arocena.usd'],
  [1, 'sale', 2, 3, 1320, '125', '5, 6, 7', null, 'CBU', '0000003100090000011122'],
  [2, 'sale', 3, 1, 1230, '132', '18', null, 'Alias', 'jazmin.farias.usd'],
  [3, 'exchange', 2, 2, 0, '104', '22, 23', { matches: ['Otro partido de fase de grupos'], text: 'Busco intercambio equivalente, misma categoria.' }, null, null],
  [4, 'sale', 3, 4, 1205, '141', '8, 9, 10, 11', null, 'USD', 'Cuenta USD a coordinar por la plataforma'],
  [5, 'sale', 1, 2, 1390, '210', '3, 4', null, 'Alias', 'paula.orrego.usd'],
  [6, 'sale', 2, 2, 1345, '126', '16, 17', null, 'CBU', '0000003100090000013344'],
  [7, 'sale', 3, 3, 1225, '137', '20, 21, 22', null, 'Wallet', 'carolina.loss@wallet'],
  [8, 'exchange', 1, 1, 0, '109', '14', { matches: ['Partido de Argentina, Brasil o Mexico'], text: 'Busco intercambio 1 a 1 por partido de alta demanda.' }, null, null],
  [9, 'sale', 2, 2, 1315, '122', '1, 2', null, 'Alias', 'juan.otero.usd'],
  [10, 'sale', 3, 2, 1240, '144', '30, 31', null, 'CBU', '0000003100090000015566'],
  [11, 'sale', 1, 1, 1385, '215', '9', null, 'Alias', 'tadeo.collazo.usd'],
  [12, 'sale', 2, 3, 1295, '119', '24, 25, 26', null, 'Wallet', 'santiago.quiroga@wallet'],
  [13, 'exchange', 3, 2, 0, '150', '6, 7', { matches: ['Octavos o fase de grupos'], text: 'Acepto intercambio por partido similar, sector lateral.' }, null, null],
  [0, 'sale', 2, 1, 1360, '127', '15', null, 'Alias', 'fernando.arocena.usd'],
  [1, 'sale', 3, 2, 1220, '139', '4, 5', null, 'CBU', '0000003100090000011122'],
  [2, 'sale', 1, 2, 1400, '208', '18, 19', null, 'Alias', 'jazmin.farias.usd'],
  [3, 'sale', 2, 4, 1305, '116', '10, 11, 12, 13', null, 'Alias', 'milagros.cardinaux.usd'],
  [4, 'exchange', 2, 1, 0, '123', '7', { matches: ['Partido en fin de semana'], text: 'Busco partido de fecha cercana para intercambio simple.' }, null, null],
  [5, 'sale', 3, 3, 1265, '146', '33, 34, 35', null, 'Alias', 'paula.orrego.usd'],
  [6, 'sale', 1, 2, 1375, '203', '2, 3', null, 'CBU', '0000003100090000013344'],
  [7, 'sale', 2, 1, 1335, '121', '28', null, 'Wallet', 'carolina.loss@wallet'],
  [8, 'sale', 3, 2, 1255, '148', '19, 20', null, 'Alias', 'juan.costa.usd'],
  [9, 'exchange', 1, 2, 0, '206', '11, 12', { matches: ['Argentina, Brasil, Colombia o Alemania'], text: 'Busco intercambio 1 a 1 por partido de seleccion fuerte.' }, null, null],
  [10, 'sale', 2, 3, 1325, '120', '6, 7, 8', null, 'CBU', '0000003100090000015566'],
  [11, 'sale', 3, 1, 1270, '151', '41', null, 'Alias', 'tadeo.collazo.usd'],
  [12, 'sale', 1, 2, 1395, '211', '5, 6', null, 'Wallet', 'santiago.quiroga@wallet'],
  [13, 'sale', 2, 2, 1285, '117', '27, 28', null, 'Alias', 'ricardo.otero.usd'],
  [0, 'exchange', 3, 3, 0, '142', '1, 2, 3', { matches: ['Cualquier partido con sede en USA'], text: 'Intercambio 1 a 1 por entradas de sede USA.' }, null, null],
  [1, 'sale', 1, 1, 1380, '214', '21', null, 'CBU', '0000003100090000011122']
]

function ensureOk(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
}

function matchScore(match) {
  return createHash('md5')
    .update(`${match.match_number ?? match.id}-seed-demo-v1`)
    .digest('hex')
}

const finalLike = ['final', 'semi', '4t', 'cuarto', 'quarter']

async function main() {
  console.log('Cargando usuarios demo...')
  ensureOk(await supabase.from('reviews').delete().in('reviewer_id', ids), 'Limpiar reseñas como autor')
  ensureOk(await supabase.from('reviews').delete().in('reviewed_user_id', ids), 'Limpiar reseñas recibidas')
  ensureOk(await supabase.from('listings').delete().in('seller_id', ids), 'Limpiar publicaciones demo')
  ensureOk(await supabase.from('users').upsert(users, { onConflict: 'id' }), 'Upsert usuarios')
  ensureOk(await supabase.from('reviews').insert(reviews), 'Insertar reseñas')

  const matches = ensureOk(
    await supabase.from('matches').select('id, match_number, phase').order('match_number', { ascending: true }),
    'Leer partidos'
  )
    .filter((match) => !finalLike.some((word) => String(match.phase || '').toLowerCase().includes(word)))
    .sort((a, b) => matchScore(a).localeCompare(matchScore(b)))
    .slice(0, 30)

  if (matches.length < 30) {
    throw new Error(`Solo encontre ${matches.length} partidos elegibles. Necesito 30 sin final/semis/cuartos.`)
  }

  const listings = offerPlan.map((plan, index) => {
    const [sellerIndex, type, category, quantity, price, sector, seats, exchangeTargets, sellerPaymentMethod, sellerPaymentValue] = plan
    return {
      match_id: matches[index].id,
      seller_id: ids[sellerIndex],
      type,
      category,
      quantity,
      price,
      currency: 'USD',
      status: 'active',
      seller_payment_method: sellerPaymentMethod,
      seller_payment_value: sellerPaymentValue,
      sector,
      seats,
      exchange_targets: exchangeTargets,
      created_at: new Date(Date.now() - (31 - index) * 3600000).toISOString()
    }
  })

  ensureOk(await supabase.from('listings').insert(listings), 'Insertar publicaciones')

  console.log('Seed demo cargado correctamente.')
  console.table({
    usuarios: users.length,
    resenas: reviews.length,
    publicaciones: listings.length,
    ventas: listings.filter((listing) => listing.type === 'sale').length,
    intercambios: listings.filter((listing) => listing.type === 'exchange').length
  })
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
