delete from listings
where seller_id between '00000000-2026-4000-8000-000000000001'::uuid and '00000000-2026-4000-8000-000000000014'::uuid;

insert into listings (
  match_id, seller_id, type, category, quantity, price, currency,
  status, seller_payment_method, seller_payment_value, sector, seats,
  exchange_targets, created_at
)
select
  matches.id,
  offer_plan.seller_id,
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
  now() - (offer_plan.age_hours || ' hours')::interval
from (
  values
    (4,  '00000000-2026-4000-8000-000000000001'::uuid, 'sale',     3, 2, 1215, '118', '12, 13',          null::jsonb, 'Alias',  'fernando.arocena.usd',              29),
    (7,  '00000000-2026-4000-8000-000000000002'::uuid, 'sale',     2, 3, 1320, '125', '5, 6, 7',         null::jsonb, 'CBU',    '0000003100090000011122',           28),
    (9,  '00000000-2026-4000-8000-000000000003'::uuid, 'sale',     3, 1, 1230, '132', '18',              null::jsonb, 'Alias',  'jazmin.farias.usd',                27),
    (11, '00000000-2026-4000-8000-000000000004'::uuid, 'exchange', 2, 2, 0,    '104', '22, 23',          '{"matches":["Otro partido de fase de grupos"],"text":"Busco intercambio equivalente, misma categoria."}'::jsonb, null, null, 26),
    (13, '00000000-2026-4000-8000-000000000005'::uuid, 'sale',     3, 4, 1205, '141', '8, 9, 10, 11',    null::jsonb, 'USD',    'Cuenta USD a coordinar por la plataforma', 25),
    (15, '00000000-2026-4000-8000-000000000006'::uuid, 'sale',     1, 2, 1390, '210', '3, 4',            null::jsonb, 'Alias',  'paula.orrego.usd',                 24),
    (18, '00000000-2026-4000-8000-000000000007'::uuid, 'sale',     2, 2, 1345, '126', '16, 17',          null::jsonb, 'CBU',    '0000003100090000013344',           23),
    (20, '00000000-2026-4000-8000-000000000008'::uuid, 'sale',     3, 3, 1225, '137', '20, 21, 22',      null::jsonb, 'Wallet', 'carolina.loss@wallet',              22),
    (22, '00000000-2026-4000-8000-000000000009'::uuid, 'exchange', 1, 1, 0,    '109', '14',              '{"matches":["Partido de Argentina, Brasil o Mexico"],"text":"Busco intercambio 1 a 1 por partido de alta demanda."}'::jsonb, null, null, 21),
    (24, '00000000-2026-4000-8000-000000000010'::uuid, 'sale',     2, 2, 1315, '122', '1, 2',            null::jsonb, 'Alias',  'juan.otero.usd',                   20),
    (26, '00000000-2026-4000-8000-000000000011'::uuid, 'sale',     3, 2, 1240, '144', '30, 31',          null::jsonb, 'CBU',    '0000003100090000015566',           19),
    (28, '00000000-2026-4000-8000-000000000012'::uuid, 'sale',     1, 1, 1385, '215', '9',               null::jsonb, 'Alias',  'tadeo.collazo.usd',                18),
    (30, '00000000-2026-4000-8000-000000000013'::uuid, 'sale',     2, 3, 1295, '119', '24, 25, 26',      null::jsonb, 'Wallet', 'santiago.quiroga@wallet',           17),
    (32, '00000000-2026-4000-8000-000000000014'::uuid, 'exchange', 3, 2, 0,    '150', '6, 7',            '{"matches":["Octavos o fase de grupos"],"text":"Acepto intercambio por partido similar, sector lateral."}'::jsonb, null, null, 16),
    (34, '00000000-2026-4000-8000-000000000001'::uuid, 'sale',     2, 1, 1360, '127', '15',              null::jsonb, 'Alias',  'fernando.arocena.usd',              15),
    (36, '00000000-2026-4000-8000-000000000002'::uuid, 'sale',     3, 2, 1220, '139', '4, 5',            null::jsonb, 'CBU',    '0000003100090000011122',           14),
    (38, '00000000-2026-4000-8000-000000000003'::uuid, 'sale',     1, 2, 1400, '208', '18, 19',          null::jsonb, 'Alias',  'jazmin.farias.usd',                13),
    (40, '00000000-2026-4000-8000-000000000004'::uuid, 'sale',     2, 4, 1305, '116', '10, 11, 12, 13',  null::jsonb, 'Alias',  'milagros.cardinaux.usd',           12),
    (42, '00000000-2026-4000-8000-000000000005'::uuid, 'exchange', 2, 1, 0,    '123', '7',               '{"matches":["Partido en fin de semana"],"text":"Busco partido de fecha cercana para intercambio simple."}'::jsonb, null, null, 11),
    (44, '00000000-2026-4000-8000-000000000006'::uuid, 'sale',     3, 3, 1265, '146', '33, 34, 35',      null::jsonb, 'Alias',  'paula.orrego.usd',                 10),
    (46, '00000000-2026-4000-8000-000000000007'::uuid, 'sale',     1, 2, 1375, '203', '2, 3',            null::jsonb, 'CBU',    '0000003100090000013344',           9),
    (48, '00000000-2026-4000-8000-000000000008'::uuid, 'sale',     2, 1, 1335, '121', '28',              null::jsonb, 'Wallet', 'carolina.loss@wallet',              8),
    (50, '00000000-2026-4000-8000-000000000009'::uuid, 'sale',     3, 2, 1255, '148', '19, 20',          null::jsonb, 'Alias',  'juan.costa.usd',                   7),
    (52, '00000000-2026-4000-8000-000000000010'::uuid, 'exchange', 1, 2, 0,    '206', '11, 12',          '{"matches":["Argentina, Brasil, Colombia o Alemania"],"text":"Busco intercambio 1 a 1 por partido de seleccion fuerte."}'::jsonb, null, null, 6),
    (54, '00000000-2026-4000-8000-000000000011'::uuid, 'sale',     2, 3, 1325, '120', '6, 7, 8',         null::jsonb, 'CBU',    '0000003100090000015566',           5),
    (56, '00000000-2026-4000-8000-000000000012'::uuid, 'sale',     3, 1, 1270, '151', '41',              null::jsonb, 'Alias',  'tadeo.collazo.usd',                4),
    (58, '00000000-2026-4000-8000-000000000013'::uuid, 'sale',     1, 2, 1395, '211', '5, 6',            null::jsonb, 'Wallet', 'santiago.quiroga@wallet',           3),
    (60, '00000000-2026-4000-8000-000000000014'::uuid, 'sale',     2, 2, 1285, '117', '27, 28',          null::jsonb, 'Alias',  'ricardo.otero.usd',                2),
    (62, '00000000-2026-4000-8000-000000000001'::uuid, 'exchange', 3, 3, 0,    '142', '1, 2, 3',         '{"matches":["Cualquier partido con sede en USA"],"text":"Intercambio 1 a 1 por entradas de sede USA."}'::jsonb, null, null, 1)
) as offer_plan (
  match_number, seller_id, type, category, quantity, price, sector, seats,
  exchange_targets, seller_payment_method, seller_payment_value, age_hours
)
join matches on matches.match_number = offer_plan.match_number;
