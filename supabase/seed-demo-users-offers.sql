-- Seed demo: 14 usuarios verificados, reseñas y 30 publicaciones activas.
-- Ejecutar en Supabase SQL Editor despues de tener cargados los partidos.
-- Las fotos estan en public/seed-avatars y se referencian como assets del sitio.

begin;

with seed_users(id) as (
  values
    ('00000000-2026-4000-8000-000000000001'::uuid),
    ('00000000-2026-4000-8000-000000000002'::uuid),
    ('00000000-2026-4000-8000-000000000003'::uuid),
    ('00000000-2026-4000-8000-000000000004'::uuid),
    ('00000000-2026-4000-8000-000000000005'::uuid),
    ('00000000-2026-4000-8000-000000000006'::uuid),
    ('00000000-2026-4000-8000-000000000007'::uuid),
    ('00000000-2026-4000-8000-000000000008'::uuid),
    ('00000000-2026-4000-8000-000000000009'::uuid),
    ('00000000-2026-4000-8000-000000000010'::uuid),
    ('00000000-2026-4000-8000-000000000011'::uuid),
    ('00000000-2026-4000-8000-000000000012'::uuid),
    ('00000000-2026-4000-8000-000000000013'::uuid),
    ('00000000-2026-4000-8000-000000000014'::uuid)
)
delete from reviews
where reviewer_id in (select id from seed_users)
   or reviewed_user_id in (select id from seed_users);

with seed_users(id) as (
  values
    ('00000000-2026-4000-8000-000000000001'::uuid),
    ('00000000-2026-4000-8000-000000000002'::uuid),
    ('00000000-2026-4000-8000-000000000003'::uuid),
    ('00000000-2026-4000-8000-000000000004'::uuid),
    ('00000000-2026-4000-8000-000000000005'::uuid),
    ('00000000-2026-4000-8000-000000000006'::uuid),
    ('00000000-2026-4000-8000-000000000007'::uuid),
    ('00000000-2026-4000-8000-000000000008'::uuid),
    ('00000000-2026-4000-8000-000000000009'::uuid),
    ('00000000-2026-4000-8000-000000000010'::uuid),
    ('00000000-2026-4000-8000-000000000011'::uuid),
    ('00000000-2026-4000-8000-000000000012'::uuid),
    ('00000000-2026-4000-8000-000000000013'::uuid),
    ('00000000-2026-4000-8000-000000000014'::uuid)
)
delete from listings
where seller_id in (select id from seed_users);

insert into users (
  id, email, first_name, last_name, birth_date, nationality,
  document_type, document_number, document_country, sex, phone,
  country, state, city, address, timezone, preferred_language,
  preferred_currency, two_factor_enabled, account_status, verification_status,
  seller_rating, seller_reviews_count, seller_sales_count, avatar_url,
  identity_document_status, identity_document_back_status, liveness_status,
  role, created_at
) values
  ('00000000-2026-4000-8000-000000000001', 'demo+fernando.arocena@entradas-fifa.store', 'Fernando', 'Arocena', '1988-03-14', 'Argentina', 'DNI', '32478190', 'Argentina', 'Masculino', '+54 9 3446 410231', 'Argentina', 'Entre Rios', 'Gualeguaychu', 'Costanera 122', 'America/Argentina/Cordoba', 'es', 'USD', false, 'active', 'verified', 5.0, 1, 2, '/seed-avatars/fernando-arocena.jpeg', 'approved', 'approved', 'approved', 'user', now() - interval '42 days'),
  ('00000000-2026-4000-8000-000000000002', 'demo+franco.casaretto@entradas-fifa.store', 'Franco', 'Casaretto', '1995-07-22', 'Argentina', 'DNI', '38170542', 'Argentina', 'Masculino', '+54 9 11 5721 9084', 'Argentina', 'Buenos Aires', 'CABA', 'Av. Corrientes 1840', 'America/Argentina/Buenos_Aires', 'es', 'USD', false, 'active', 'verified', 4.5, 2, 1, '/seed-avatars/franco-casaretto.jpeg', 'approved', 'approved', 'approved', 'user', now() - interval '37 days'),
  ('00000000-2026-4000-8000-000000000003', 'demo+jazmin.farias@entradas-fifa.store', 'Jazmin', 'Farias', '1998-11-03', 'Uruguay', 'CI', '51638472', 'Uruguay', 'Femenino', '+598 94 218 774', 'Uruguay', 'Montevideo', 'Pocitos', 'Bulevar Espana 2441', 'America/Montevideo', 'es', 'USD', false, 'active', 'verified', 5.0, 1, 0, '/seed-avatars/jazmin-farias.jpeg', 'approved', 'approved', 'approved', 'user', now() - interval '31 days'),
  ('00000000-2026-4000-8000-000000000004', 'demo+milagros.cardinaux@entradas-fifa.store', 'Milagros', 'Cardinaux Farabello', '1993-05-18', 'Argentina', 'DNI', '36590218', 'Argentina', 'Femenino', '+54 9 261 625 4310', 'Argentina', 'Mendoza', 'Mendoza', 'Sarmiento 606', 'America/Argentina/Mendoza', 'es', 'USD', false, 'active', 'verified', 4.5, 2, 2, '/seed-avatars/milagros-cardinaux-farabello.jpeg', 'approved', 'approved', 'approved', 'user', now() - interval '29 days'),
  ('00000000-2026-4000-8000-000000000005', 'demo+nadia.insaurralde@entradas-fifa.store', 'Nadia', 'Insaurralde', '1990-09-27', 'Paraguay', 'CI', '4429158', 'Paraguay', 'Femenino', '+595 981 405 226', 'Paraguay', 'Central', 'San Lorenzo', 'Defensores del Chaco 901', 'America/Asuncion', 'es', 'USD', false, 'active', 'verified', 4.0, 1, 0, '/seed-avatars/nadia-insaurralde.jpeg', 'approved', 'approved', 'approved', 'user', now() - interval '26 days'),
  ('00000000-2026-4000-8000-000000000006', 'demo+paula.orrego@entradas-fifa.store', 'Paula Jorgelina', 'Orrego', '1989-12-08', 'Argentina', 'DNI', '33721906', 'Argentina', 'Femenino', '+54 9 299 583 0192', 'Argentina', 'Neuquen', 'Neuquen', 'Leloir 455', 'America/Argentina/Salta', 'es', 'USD', false, 'active', 'verified', 5.0, 2, 1, '/seed-avatars/paula-jorgelina-orrego.jpeg', 'approved', 'approved', 'approved', 'user', now() - interval '24 days'),
  ('00000000-2026-4000-8000-000000000007', 'demo+anabella.tonetti@entradas-fifa.store', 'Anabella', 'Tonetti', '1994-02-11', 'Argentina', 'DNI', '37284011', 'Argentina', 'Femenino', '+54 9 343 507 4498', 'Argentina', 'Entre Rios', 'Parana', 'Urquiza 1370', 'America/Argentina/Cordoba', 'es', 'USD', false, 'active', 'verified', 4.5, 2, 2, '/seed-avatars/anabella-tonetti.jpeg', 'approved', 'approved', 'approved', 'user', now() - interval '22 days'),
  ('00000000-2026-4000-8000-000000000008', 'demo+carolina.loss@entradas-fifa.store', 'Carolina', 'Loss Schneider', '1991-06-30', 'Brasil', 'RG', 'MG-1827364', 'Brasil', 'Femenino', '+55 11 97642 1148', 'Brasil', 'Sao Paulo', 'Sao Paulo', 'Rua Augusta 914', 'America/Sao_Paulo', 'pt', 'USD', false, 'active', 'verified', 4.0, 1, 0, '/seed-avatars/carolina-loss-schneider.jpeg', 'approved', 'approved', 'approved', 'user', now() - interval '20 days'),
  ('00000000-2026-4000-8000-000000000009', 'demo+juan.costa@entradas-fifa.store', 'Juan Manuel', 'Costa', '1992-04-25', 'Argentina', 'DNI', '35190842', 'Argentina', 'Masculino', '+54 9 341 642 9158', 'Argentina', 'Santa Fe', 'Rosario', 'Pellegrini 1882', 'America/Argentina/Cordoba', 'es', 'USD', false, 'active', 'verified', 5.0, 1, 1, '/seed-avatars/juan-manuel-costa.jpeg', 'approved', 'approved', 'approved', 'user', now() - interval '18 days'),
  ('00000000-2026-4000-8000-000000000010', 'demo+juan.otero@entradas-fifa.store', 'Juan Manuel', 'Otero', '1996-01-09', 'Argentina', 'DNI', '39440721', 'Argentina', 'Masculino', '+54 9 3446 552870', 'Argentina', 'Entre Rios', 'Gualeguaychu', '25 de Mayo 742', 'America/Argentina/Cordoba', 'es', 'USD', false, 'active', 'verified', 4.5, 2, 2, '/seed-avatars/juan-manuel-otero.jpeg', 'approved', 'approved', 'approved', 'user', now() - interval '16 days'),
  ('00000000-2026-4000-8000-000000000011', 'demo+veronica.penalva@entradas-fifa.store', 'Veronica', 'Penalva', '1979-08-19', 'Argentina', 'DNI', '28164037', 'Argentina', 'Femenino', '+54 9 223 561 7342', 'Argentina', 'Buenos Aires', 'Mar del Plata', 'Guemes 3051', 'America/Argentina/Buenos_Aires', 'es', 'USD', false, 'active', 'verified', 5.0, 1, 1, '/seed-avatars/veronica-penalva.jpeg', 'approved', 'approved', 'approved', 'user', now() - interval '14 days'),
  ('00000000-2026-4000-8000-000000000012', 'demo+tadeo.collazo@entradas-fifa.store', 'Tadeo', 'Collazo', '2000-10-02', 'Argentina', 'DNI', '42197056', 'Argentina', 'Masculino', '+54 9 11 3891 6025', 'Argentina', 'Buenos Aires', 'La Plata', 'Calle 54 711', 'America/Argentina/Buenos_Aires', 'es', 'USD', false, 'active', 'verified', 4.0, 1, 0, '/seed-avatars/tadeo-collazo.jpeg', 'approved', 'approved', 'approved', 'user', now() - interval '12 days'),
  ('00000000-2026-4000-8000-000000000013', 'demo+santiago.quiroga@entradas-fifa.store', 'Santiago', 'Alonso Quiroga', '1997-03-06', 'Colombia', 'CC', '1029384756', 'Colombia', 'Masculino', '+57 300 418 2291', 'Colombia', 'Antioquia', 'Medellin', 'Carrera 43A 19-17', 'America/Bogota', 'es', 'USD', false, 'active', 'verified', 4.5, 2, 1, '/seed-avatars/santiago-alonso-quiroga.jpeg', 'approved', 'approved', 'approved', 'user', now() - interval '9 days'),
  ('00000000-2026-4000-8000-000000000014', 'demo+ricardo.otero@entradas-fifa.store', 'Ricardo', 'Otero', '1974-07-15', 'Argentina', 'DNI', '23650492', 'Argentina', 'Masculino', '+54 9 3446 447903', 'Argentina', 'Entre Rios', 'Gualeguaychu', 'San Martin 155', 'America/Argentina/Cordoba', 'es', 'USD', false, 'active', 'verified', 5.0, 1, 2, '/seed-avatars/ricardo-otero.jpeg', 'approved', 'approved', 'approved', 'user', now() - interval '7 days')
on conflict (id) do update set
  email = excluded.email,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  birth_date = excluded.birth_date,
  nationality = excluded.nationality,
  document_type = excluded.document_type,
  document_number = excluded.document_number,
  document_country = excluded.document_country,
  sex = excluded.sex,
  phone = excluded.phone,
  country = excluded.country,
  state = excluded.state,
  city = excluded.city,
  address = excluded.address,
  timezone = excluded.timezone,
  preferred_language = excluded.preferred_language,
  preferred_currency = excluded.preferred_currency,
  account_status = excluded.account_status,
  verification_status = excluded.verification_status,
  seller_rating = excluded.seller_rating,
  seller_reviews_count = excluded.seller_reviews_count,
  seller_sales_count = excluded.seller_sales_count,
  avatar_url = excluded.avatar_url,
  identity_document_status = excluded.identity_document_status,
  identity_document_back_status = excluded.identity_document_back_status,
  liveness_status = excluded.liveness_status,
  role = excluded.role;

insert into reviews (order_id, reviewer_id, reviewed_user_id, rating, comment, created_at) values
  (null, '00000000-2026-4000-8000-000000000002', '00000000-2026-4000-8000-000000000001', 5, 'Muy claro con los tiempos y envio todo rapido.', now() - interval '19 days'),
  (null, '00000000-2026-4000-8000-000000000003', '00000000-2026-4000-8000-000000000002', 5, 'Operacion prolija y comunicacion excelente.', now() - interval '18 days'),
  (null, '00000000-2026-4000-8000-000000000004', '00000000-2026-4000-8000-000000000002', 4, 'Todo bien, solo tardo un poco en responder.', now() - interval '17 days'),
  (null, '00000000-2026-4000-8000-000000000005', '00000000-2026-4000-8000-000000000003', 5, 'Muy buena predisposicion y datos completos.', now() - interval '16 days'),
  (null, '00000000-2026-4000-8000-000000000006', '00000000-2026-4000-8000-000000000004', 5, 'Excelente experiencia, todo tal cual lo publicado.', now() - interval '15 days'),
  (null, '00000000-2026-4000-8000-000000000007', '00000000-2026-4000-8000-000000000004', 4, 'Muy confiable, volveria a operar.', now() - interval '14 days'),
  (null, '00000000-2026-4000-8000-000000000008', '00000000-2026-4000-8000-000000000005', 4, 'Cumplio con lo acordado.', now() - interval '13 days'),
  (null, '00000000-2026-4000-8000-000000000009', '00000000-2026-4000-8000-000000000006', 5, 'Rapida y muy ordenada con la informacion.', now() - interval '12 days'),
  (null, '00000000-2026-4000-8000-000000000010', '00000000-2026-4000-8000-000000000006', 5, 'Todo perfecto y sin vueltas.', now() - interval '11 days'),
  (null, '00000000-2026-4000-8000-000000000011', '00000000-2026-4000-8000-000000000007', 5, 'Publicacion clara y operacion segura.', now() - interval '10 days'),
  (null, '00000000-2026-4000-8000-000000000012', '00000000-2026-4000-8000-000000000007', 4, 'Muy buena atencion durante todo el proceso.', now() - interval '9 days'),
  (null, '00000000-2026-4000-8000-000000000013', '00000000-2026-4000-8000-000000000008', 4, 'Respondio rapido y fue amable.', now() - interval '8 days'),
  (null, '00000000-2026-4000-8000-000000000014', '00000000-2026-4000-8000-000000000009', 5, 'Datos completos y entrega sin problemas.', now() - interval '7 days'),
  (null, '00000000-2026-4000-8000-000000000001', '00000000-2026-4000-8000-000000000010', 5, 'Muy buena comunicacion y todo correcto.', now() - interval '6 days'),
  (null, '00000000-2026-4000-8000-000000000003', '00000000-2026-4000-8000-000000000010', 4, 'Confiable, proceso ordenado.', now() - interval '5 days'),
  (null, '00000000-2026-4000-8000-000000000004', '00000000-2026-4000-8000-000000000011', 5, 'Excelente trato y respuesta inmediata.', now() - interval '5 days'),
  (null, '00000000-2026-4000-8000-000000000005', '00000000-2026-4000-8000-000000000012', 4, 'Todo bien documentado.', now() - interval '4 days'),
  (null, '00000000-2026-4000-8000-000000000006', '00000000-2026-4000-8000-000000000013', 5, 'Muy atento y responsable.', now() - interval '3 days'),
  (null, '00000000-2026-4000-8000-000000000007', '00000000-2026-4000-8000-000000000013', 4, 'Buena experiencia general.', now() - interval '2 days'),
  (null, '00000000-2026-4000-8000-000000000008', '00000000-2026-4000-8000-000000000014', 5, 'Operacion rapida y sin inconvenientes.', now() - interval '1 day');

with seed_users(idx, id) as (
  values
    (1, '00000000-2026-4000-8000-000000000001'::uuid),
    (2, '00000000-2026-4000-8000-000000000002'::uuid),
    (3, '00000000-2026-4000-8000-000000000003'::uuid),
    (4, '00000000-2026-4000-8000-000000000004'::uuid),
    (5, '00000000-2026-4000-8000-000000000005'::uuid),
    (6, '00000000-2026-4000-8000-000000000006'::uuid),
    (7, '00000000-2026-4000-8000-000000000007'::uuid),
    (8, '00000000-2026-4000-8000-000000000008'::uuid),
    (9, '00000000-2026-4000-8000-000000000009'::uuid),
    (10, '00000000-2026-4000-8000-000000000010'::uuid),
    (11, '00000000-2026-4000-8000-000000000011'::uuid),
    (12, '00000000-2026-4000-8000-000000000012'::uuid),
    (13, '00000000-2026-4000-8000-000000000013'::uuid),
    (14, '00000000-2026-4000-8000-000000000014'::uuid)
),
selected_matches as (
  select id, row_number() over (order by md5(coalesce(match_number::text, id::text) || '-seed-demo-v1')) as rn
  from matches
  where lower(coalesce(phase, '')) not like '%final%'
    and lower(coalesce(phase, '')) not like '%semi%'
    and lower(coalesce(phase, '')) not like '%4t%'
    and lower(coalesce(phase, '')) not like '%cuarto%'
    and lower(coalesce(phase, '')) not like '%quarter%'
),
offer_plan(rn, user_idx, type, category, quantity, price, sector, seats, exchange_targets, seller_payment_method, seller_payment_value) as (
  values
    (1, 1, 'sale', 3, 2, 1215, '118', '12, 13', null::jsonb, 'Alias', 'fernando.arocena.usd'),
    (2, 2, 'sale', 2, 3, 1320, '125', '5, 6, 7', null::jsonb, 'CBU', '0000003100090000011122'),
    (3, 3, 'sale', 3, 1, 1230, '132', '18', null::jsonb, 'Alias', 'jazmin.farias.usd'),
    (4, 4, 'exchange', 2, 2, 0, '104', '22, 23', '{"matches":["Otro partido de fase de grupos"],"text":"Busco intercambio equivalente, misma categoria."}'::jsonb, null, null),
    (5, 5, 'sale', 3, 4, 1205, '141', '8, 9, 10, 11', null::jsonb, 'USD', 'Cuenta USD a coordinar por la plataforma'),
    (6, 6, 'sale', 1, 2, 1390, '210', '3, 4', null::jsonb, 'Alias', 'paula.orrego.usd'),
    (7, 7, 'sale', 2, 2, 1345, '126', '16, 17', null::jsonb, 'CBU', '0000003100090000013344'),
    (8, 8, 'sale', 3, 3, 1225, '137', '20, 21, 22', null::jsonb, 'Wallet', 'carolina.loss@wallet'),
    (9, 9, 'exchange', 1, 1, 0, '109', '14', '{"matches":["Partido de Argentina, Brasil o Mexico"],"text":"Busco intercambio 1 a 1 por partido de alta demanda."}'::jsonb, null, null),
    (10, 10, 'sale', 2, 2, 1315, '122', '1, 2', null::jsonb, 'Alias', 'juan.otero.usd'),
    (11, 11, 'sale', 3, 2, 1240, '144', '30, 31', null::jsonb, 'CBU', '0000003100090000015566'),
    (12, 12, 'sale', 1, 1, 1385, '215', '9', null::jsonb, 'Alias', 'tadeo.collazo.usd'),
    (13, 13, 'sale', 2, 3, 1295, '119', '24, 25, 26', null::jsonb, 'Wallet', 'santiago.quiroga@wallet'),
    (14, 14, 'exchange', 3, 2, 0, '150', '6, 7', '{"matches":["Octavos o fase de grupos"],"text":"Acepto intercambio por partido similar, sector lateral."}'::jsonb, null, null),
    (15, 1, 'sale', 2, 1, 1360, '127', '15', null::jsonb, 'Alias', 'fernando.arocena.usd'),
    (16, 2, 'sale', 3, 2, 1220, '139', '4, 5', null::jsonb, 'CBU', '0000003100090000011122'),
    (17, 3, 'sale', 1, 2, 1400, '208', '18, 19', null::jsonb, 'Alias', 'jazmin.farias.usd'),
    (18, 4, 'sale', 2, 4, 1305, '116', '10, 11, 12, 13', null::jsonb, 'Alias', 'milagros.cardinaux.usd'),
    (19, 5, 'exchange', 2, 1, 0, '123', '7', '{"matches":["Partido en fin de semana"],"text":"Busco partido de fecha cercana para intercambio simple."}'::jsonb, null, null),
    (20, 6, 'sale', 3, 3, 1265, '146', '33, 34, 35', null::jsonb, 'Alias', 'paula.orrego.usd'),
    (21, 7, 'sale', 1, 2, 1375, '203', '2, 3', null::jsonb, 'CBU', '0000003100090000013344'),
    (22, 8, 'sale', 2, 1, 1335, '121', '28', null::jsonb, 'Wallet', 'carolina.loss@wallet'),
    (23, 9, 'sale', 3, 2, 1255, '148', '19, 20', null::jsonb, 'Alias', 'juan.costa.usd'),
    (24, 10, 'exchange', 1, 2, 0, '206', '11, 12', '{"matches":["Argentina, Brasil, Colombia o Alemania"],"text":"Busco intercambio 1 a 1 por partido de seleccion fuerte."}'::jsonb, null, null),
    (25, 11, 'sale', 2, 3, 1325, '120', '6, 7, 8', null::jsonb, 'CBU', '0000003100090000015566'),
    (26, 12, 'sale', 3, 1, 1270, '151', '41', null::jsonb, 'Alias', 'tadeo.collazo.usd'),
    (27, 13, 'sale', 1, 2, 1395, '211', '5, 6', null::jsonb, 'Wallet', 'santiago.quiroga@wallet'),
    (28, 14, 'sale', 2, 2, 1285, '117', '27, 28', null::jsonb, 'Alias', 'ricardo.otero.usd'),
    (29, 1, 'exchange', 3, 3, 0, '142', '1, 2, 3', '{"matches":["Cualquier partido con sede en USA"],"text":"Intercambio 1 a 1 por entradas de sede USA."}'::jsonb, null, null),
    (30, 2, 'sale', 1, 1, 1380, '214', '21', null::jsonb, 'CBU', '0000003100090000011122')
)
insert into listings (
  match_id, seller_id, type, category, quantity, price, currency,
  status, seller_payment_method, seller_payment_value, sector, seats,
  exchange_targets, created_at
)
select
  selected_matches.id,
  seed_users.id,
  offer_plan.type,
  offer_plan.category,
  offer_plan.quantity,
  offer_plan.price,
  'USD',
  'active',
  offer_plan.seller_payment_method,
  offer_plan.seller_payment_value,
  offer_plan.sector,
  offer_plan.seats,
  offer_plan.exchange_targets,
  now() - ((31 - offer_plan.rn) || ' hours')::interval
from offer_plan
join selected_matches on selected_matches.rn = offer_plan.rn
join seed_users on seed_users.idx = offer_plan.user_idx
where selected_matches.rn <= 30;

commit;

select
  'Seed demo cargado' as resultado,
  (select count(*) from users where id between '00000000-2026-4000-8000-000000000001'::uuid and '00000000-2026-4000-8000-000000000014'::uuid) as usuarios_demo,
  (select count(*) from listings where seller_id between '00000000-2026-4000-8000-000000000001'::uuid and '00000000-2026-4000-8000-000000000014'::uuid) as publicaciones_demo,
  (select count(*) from reviews where reviewed_user_id between '00000000-2026-4000-8000-000000000001'::uuid and '00000000-2026-4000-8000-000000000014'::uuid) as resenas_demo;
