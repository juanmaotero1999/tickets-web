
-- V18 schema compatible con la app.
-- Ejecutar en Supabase SQL Editor si faltan columnas.
-- Si tus tablas ya existen, estos ALTER no borran datos.

create table if not exists users (
  id uuid primary key,
  email text unique,
  first_name text,
  last_name text,
  birth_date date,
  nationality text,
  document_type text,
  document_number text,
  document_country text,
  sex text,
  phone text,
  country text,
  state text,
  city text,
  address text,
  timezone text,
  preferred_language text,
  preferred_currency text default 'ARS',
  two_factor_enabled boolean default false,
  account_status text default 'active',
  verification_status text default 'not_verified',
  seller_rating numeric,
  seller_reviews_count int default 0,
  seller_sales_count int default 0,
  avatar_url text,
  identity_document_path text,
  identity_document_uploaded_at timestamp,
  identity_document_status text default 'not_submitted',
  identity_selfie_path text,
  liveness_side_path text,
  liveness_front_path text,
  identity_selfie_uploaded_at timestamp,
  liveness_status text default 'not_submitted',
  role text default 'user',
  created_at timestamp default now()
);

create table if not exists matches (
  id int primary key,
  match_number int,
  phase text,
  group_name text,
  home_team text,
  away_team text,
  home_code text,
  away_code text,
  city text,
  stadium text,
  match_date timestamp,
  created_at timestamp default now()
);

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  match_id int,
  category int,
  quantity int,
  price numeric,
  currency text default 'ARS',
  seller_id uuid,
  type text default 'sale',
  exchange_targets jsonb,
  status text default 'active',
  seller_payment_method text,
  seller_payment_value text,
  sector text,
  seats text,
  created_at timestamp default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid,
  buyer_id uuid,
  seller_id uuid,
  quantity int,
  total numeric,
  status text default 'pending_payment',
  seller_delivery_status text default 'pending',
  buyer_delivery_status text default 'pending',
  admin_seller_delivery_status text default 'pending',
  admin_buyer_delivery_status text default 'pending',
  buyer_payment_status text default 'pending',
  seller_payment_status text default 'pending',
  created_at timestamp default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid,
  sender_id uuid,
  text text,
  created_at timestamp default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  subject text,
  message text,
  action_view text,
  action_id text,
  read boolean default false,
  created_at timestamp default now()
);

-- Compatibilidad con bases creadas por versiones anteriores.
-- CREATE TABLE IF NOT EXISTS no agrega columnas si la tabla ya existia.
alter table users add column if not exists email text unique;
alter table users add column if not exists first_name text;
alter table users add column if not exists last_name text;
alter table users add column if not exists birth_date date;
alter table users add column if not exists nationality text;
alter table users add column if not exists document_type text;
alter table users add column if not exists document_number text;
alter table users add column if not exists document_country text;
alter table users add column if not exists sex text;
alter table users add column if not exists phone text;
alter table users add column if not exists country text;
alter table users add column if not exists state text;
alter table users add column if not exists city text;
alter table users add column if not exists address text;
alter table users add column if not exists timezone text;
alter table users add column if not exists preferred_language text;
alter table users add column if not exists preferred_currency text default 'ARS';
alter table users add column if not exists two_factor_enabled boolean default false;
alter table users add column if not exists account_status text default 'active';
alter table users add column if not exists verification_status text default 'not_verified';
alter table users add column if not exists seller_rating numeric;
alter table users add column if not exists seller_reviews_count int default 0;
alter table users add column if not exists seller_sales_count int default 0;
alter table users add column if not exists avatar_url text;
alter table users add column if not exists identity_document_path text;
alter table users add column if not exists identity_document_uploaded_at timestamp;
alter table users add column if not exists identity_document_status text default 'not_submitted';
alter table users add column if not exists identity_selfie_path text;
alter table users add column if not exists liveness_side_path text;
alter table users add column if not exists liveness_front_path text;
alter table users add column if not exists identity_selfie_uploaded_at timestamp;
alter table users add column if not exists liveness_status text default 'not_submitted';
alter table users add column if not exists verification_rejection_reason text;
alter table users add column if not exists email_notifications boolean default true;
alter table users alter column seller_rating drop default;
alter table users add column if not exists role text default 'user';
alter table users add column if not exists created_at timestamp default now();

update users
set seller_rating = null
where coalesce(seller_sales_count, 0) = 0
  and coalesce(seller_reviews_count, 0) = 0
  and seller_rating = 5;

alter table matches add column if not exists match_number int;
alter table matches add column if not exists phase text;
alter table matches add column if not exists group_name text;
alter table matches add column if not exists home_team text;
alter table matches add column if not exists away_team text;
alter table matches add column if not exists home_code text;
alter table matches add column if not exists away_code text;
alter table matches add column if not exists city text;
alter table matches add column if not exists stadium text;
alter table matches add column if not exists match_date timestamp;
alter table matches add column if not exists created_at timestamp default now();

alter table listings add column if not exists match_id int;
alter table listings add column if not exists category int;
alter table listings add column if not exists quantity int;
alter table listings add column if not exists price numeric;
alter table listings add column if not exists currency text default 'ARS';
alter table listings add column if not exists seller_id uuid;
alter table listings add column if not exists type text default 'sale';
alter table listings add column if not exists exchange_targets jsonb;
alter table listings add column if not exists status text default 'active';
alter table listings add column if not exists seller_payment_method text;
alter table listings add column if not exists seller_payment_value text;
alter table listings add column if not exists sector text;
alter table listings add column if not exists seats text;
alter table listings add column if not exists created_at timestamp default now();

alter table orders add column if not exists listing_id uuid;
alter table orders add column if not exists buyer_id uuid;
alter table orders add column if not exists seller_id uuid;
alter table orders add column if not exists quantity int;
alter table orders add column if not exists total numeric;
alter table orders add column if not exists status text default 'pending_payment';
alter table orders add column if not exists seller_delivery_status text default 'pending';
alter table orders add column if not exists buyer_delivery_status text default 'pending';
alter table orders add column if not exists admin_seller_delivery_status text default 'pending';
alter table orders add column if not exists admin_buyer_delivery_status text default 'pending';
alter table orders add column if not exists buyer_payment_status text default 'pending';
alter table orders add column if not exists seller_payment_status text default 'pending';
alter table orders add column if not exists created_at timestamp default now();

alter table messages add column if not exists order_id uuid;
alter table messages add column if not exists sender_id uuid;
alter table messages add column if not exists text text;
alter table messages add column if not exists created_at timestamp default now();

alter table notifications add column if not exists user_id uuid;
alter table notifications add column if not exists subject text;
alter table notifications add column if not exists message text;
alter table notifications add column if not exists action_view text;
alter table notifications add column if not exists action_id text;
alter table notifications add column if not exists read boolean default false;
alter table notifications add column if not exists created_at timestamp default now();

alter table users enable row level security;
alter table matches enable row level security;
alter table listings enable row level security;
alter table orders enable row level security;
alter table messages enable row level security;
alter table notifications enable row level security;

drop policy if exists "open users" on users;
drop policy if exists "open matches" on matches;
drop policy if exists "open listings" on listings;
drop policy if exists "open orders" on orders;
drop policy if exists "open messages" on messages;
drop policy if exists "open notifications" on notifications;

create policy "open users" on users for all using (true) with check (true);
create policy "open matches" on matches for all using (true) with check (true);
create policy "open listings" on listings for all using (true) with check (true);
create policy "open orders" on orders for all using (true) with check (true);
create policy "open messages" on messages for all using (true) with check (true);
create policy "open notifications" on notifications for all using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true),
       ('identity-documents', 'identity-documents', false),
       ('verification-selfies', 'verification-selfies', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "profile photos read" on storage.objects;
drop policy if exists "profile photos upload own" on storage.objects;
drop policy if exists "identity docs upload own" on storage.objects;
drop policy if exists "identity docs read own" on storage.objects;
drop policy if exists "identity docs admin read" on storage.objects;
drop policy if exists "verification selfies upload own" on storage.objects;
drop policy if exists "verification selfies read own" on storage.objects;
drop policy if exists "verification selfies admin read" on storage.objects;

create policy "profile photos read" on storage.objects
for select using (bucket_id = 'profile-photos');

create policy "profile photos upload own" on storage.objects
for all using (bucket_id = 'profile-photos' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'profile-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "identity docs upload own" on storage.objects
for insert with check (bucket_id = 'identity-documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "identity docs read own" on storage.objects
for select using (bucket_id = 'identity-documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "identity docs admin read" on storage.objects
for select using (bucket_id = 'identity-documents' and exists (select 1 from public.users where public.users.id = auth.uid() and public.users.role = 'admin'));

create policy "verification selfies upload own" on storage.objects
for insert with check (bucket_id = 'verification-selfies' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "verification selfies read own" on storage.objects
for select using (bucket_id = 'verification-selfies' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "verification selfies admin read" on storage.objects
for select using (bucket_id = 'verification-selfies' and exists (select 1 from public.users where public.users.id = auth.uid() and public.users.role = 'admin'));

-- Fuerza a PostgREST/Supabase API a refrescar el cache del esquema.
notify pgrst, 'reload schema';

-- Fixture completo del Mundial 2026.
-- Fase de grupos con equipos reales y eliminatorias con cruces oficiales.
insert into matches (id, match_number, phase, group_name, home_team, away_team, home_code, away_code, city, stadium, match_date)
values
(1,1,'groups','Grupo A','Mexico','South Africa','MEX','RSA','Mexico City','Mexico City Stadium','2026-06-11 16:00'::timestamp),
(2,2,'groups','Grupo A','Korea Republic','Czechia','KOR','CZE','Guadalajara','Estadio Guadalajara','2026-06-11 22:00'::timestamp),
(3,3,'groups','Grupo B','Canada','Bosnia and Herzegovina','CAN','BIH','Toronto','Toronto Stadium','2026-06-12 15:00'::timestamp),
(4,4,'groups','Grupo D','USA','Paraguay','USA','PAR','Los Angeles','Los Angeles Stadium','2026-06-12 18:00'::timestamp),
(5,5,'groups','Grupo C','Haiti','Scotland','HAI','SCO','Boston','Boston Stadium','2026-06-13 21:00'::timestamp),
(6,6,'groups','Grupo D','Australia','Turkiye','AUS','TUR','Vancouver','BC Place Vancouver','2026-06-13 21:00'::timestamp),
(7,7,'groups','Grupo C','Brazil','Morocco','BRA','MAR','New York New Jersey','New York New Jersey Stadium','2026-06-13 18:00'::timestamp),
(8,8,'groups','Grupo B','Qatar','Switzerland','QAT','SUI','San Francisco Bay Area','San Francisco Bay Area Stadium','2026-06-13 12:00'::timestamp),
(9,9,'groups','Grupo E','Cote d''Ivoire','Ecuador','CIV','ECU','Philadelphia','Philadelphia Stadium','2026-06-14 19:00'::timestamp),
(10,10,'groups','Grupo E','Germany','Curacao','GER','CUR','Houston','Houston Stadium','2026-06-14 12:00'::timestamp),
(11,11,'groups','Grupo F','Netherlands','Japan','NED','JPN','Dallas','Dallas Stadium','2026-06-14 15:00'::timestamp),
(12,12,'groups','Grupo F','Sweden','Tunisia','SWE','TUN','Monterrey','Estadio Monterrey','2026-06-14 21:00'::timestamp),
(13,13,'groups','Grupo H','Saudi Arabia','Uruguay','KSA','URU','Miami','Miami Stadium','2026-06-15 18:00'::timestamp),
(14,14,'groups','Grupo H','Spain','Cabo Verde','ESP','CPV','Atlanta','Atlanta Stadium','2026-06-15 12:00'::timestamp),
(15,15,'groups','Grupo G','IR Iran','New Zealand','IRN','NZL','Los Angeles','Los Angeles Stadium','2026-06-15 18:00'::timestamp),
(16,16,'groups','Grupo G','Belgium','Egypt','BEL','EGY','Seattle','Seattle Stadium','2026-06-15 12:00'::timestamp),
(17,17,'groups','Grupo I','France','Senegal','FRA','SEN','New York New Jersey','New York New Jersey Stadium','2026-06-16 15:00'::timestamp),
(18,18,'groups','Grupo I','Iraq','Norway','IRQ','NOR','Boston','Boston Stadium','2026-06-16 18:00'::timestamp),
(19,19,'groups','Grupo J','Argentina','Algeria','ARG','ALG','Kansas City','Kansas City Stadium','2026-06-16 20:00'::timestamp),
(20,20,'groups','Grupo J','Austria','Jordan','AUT','JOR','San Francisco Bay Area','San Francisco Bay Area Stadium','2026-06-16 21:00'::timestamp),
(21,21,'groups','Grupo L','Ghana','Panama','GHA','PAN','Toronto','Toronto Stadium','2026-06-17 19:00'::timestamp),
(22,22,'groups','Grupo L','England','Croatia','ENG','CRO','Dallas','Dallas Stadium','2026-06-17 15:00'::timestamp),
(23,23,'groups','Grupo K','Portugal','Congo DR','POR','COD','Houston','Houston Stadium','2026-06-17 12:00'::timestamp),
(24,24,'groups','Grupo K','Uzbekistan','Colombia','UZB','COL','Mexico City','Mexico City Stadium','2026-06-17 20:00'::timestamp),
(25,25,'groups','Grupo A','Czechia','South Africa','CZE','RSA','Atlanta','Atlanta Stadium','2026-06-18 12:00'::timestamp),
(26,26,'groups','Grupo B','Switzerland','Bosnia and Herzegovina','SUI','BIH','Los Angeles','Los Angeles Stadium','2026-06-18 12:00'::timestamp),
(27,27,'groups','Grupo B','Canada','Qatar','CAN','QAT','Vancouver','BC Place Vancouver','2026-06-18 15:00'::timestamp),
(28,28,'groups','Grupo A','Mexico','Korea Republic','MEX','KOR','Guadalajara','Estadio Guadalajara','2026-06-18 20:00'::timestamp),
(29,29,'groups','Grupo C','Brazil','Haiti','BRA','HAI','Philadelphia','Philadelphia Stadium','2026-06-19 20:30'::timestamp),
(30,30,'groups','Grupo C','Scotland','Morocco','SCO','MAR','Boston','Boston Stadium','2026-06-19 18:00'::timestamp),
(31,31,'groups','Grupo D','Turkiye','Paraguay','TUR','PAR','San Francisco Bay Area','San Francisco Bay Area Stadium','2026-06-19 20:00'::timestamp),
(32,32,'groups','Grupo D','USA','Australia','USA','AUS','Seattle','Seattle Stadium','2026-06-19 12:00'::timestamp),
(33,33,'groups','Grupo E','Germany','Cote d''Ivoire','GER','CIV','Toronto','Toronto Stadium','2026-06-20 16:00'::timestamp),
(34,34,'groups','Grupo E','Ecuador','Curacao','ECU','CUR','Kansas City','Kansas City Stadium','2026-06-20 19:00'::timestamp),
(35,35,'groups','Grupo F','Netherlands','Sweden','NED','SWE','Houston','Houston Stadium','2026-06-20 12:00'::timestamp),
(36,36,'groups','Grupo F','Tunisia','Japan','TUN','JPN','Monterrey','Estadio Monterrey','2026-06-20 21:00'::timestamp),
(37,37,'groups','Grupo H','Uruguay','Cabo Verde','URU','CPV','Miami','Miami Stadium','2026-06-21 18:00'::timestamp),
(38,38,'groups','Grupo H','Spain','Saudi Arabia','ESP','KSA','Atlanta','Atlanta Stadium','2026-06-21 12:00'::timestamp),
(39,39,'groups','Grupo G','Belgium','IR Iran','BEL','IRN','Los Angeles','Los Angeles Stadium','2026-06-21 12:00'::timestamp),
(40,40,'groups','Grupo G','New Zealand','Egypt','NZL','EGY','Vancouver','BC Place Vancouver','2026-06-21 18:00'::timestamp),
(41,41,'groups','Grupo I','Norway','Senegal','NOR','SEN','New York New Jersey','New York New Jersey Stadium','2026-06-22 20:00'::timestamp),
(42,42,'groups','Grupo I','France','Iraq','FRA','IRQ','Philadelphia','Philadelphia Stadium','2026-06-22 17:00'::timestamp),
(43,43,'groups','Grupo J','Argentina','Austria','ARG','AUT','Dallas','Dallas Stadium','2026-06-22 12:00'::timestamp),
(44,44,'groups','Grupo J','Jordan','Algeria','JOR','ALG','San Francisco Bay Area','San Francisco Bay Area Stadium','2026-06-22 20:00'::timestamp),
(45,45,'groups','Grupo L','England','Ghana','ENG','GHA','Boston','Boston Stadium','2026-06-23 13:00'::timestamp),
(46,46,'groups','Grupo L','Panama','Croatia','PAN','CRO','Toronto','Toronto Stadium','2026-06-23 19:00'::timestamp),
(47,47,'groups','Grupo K','Portugal','Uzbekistan','POR','UZB','Houston','Houston Stadium','2026-06-23 12:00'::timestamp),
(48,48,'groups','Grupo K','Colombia','Congo DR','COL','COD','Guadalajara','Estadio Guadalajara','2026-06-23 20:00'::timestamp),
(49,49,'groups','Grupo C','Scotland','Brazil','SCO','BRA','Miami','Miami Stadium','2026-06-24 18:00'::timestamp),
(50,50,'groups','Grupo C','Morocco','Haiti','MAR','HAI','Atlanta','Atlanta Stadium','2026-06-24 18:00'::timestamp),
(51,51,'groups','Grupo B','Switzerland','Canada','SUI','CAN','Vancouver','BC Place Vancouver','2026-06-24 12:00'::timestamp),
(52,52,'groups','Grupo B','Bosnia and Herzegovina','Qatar','BIH','QAT','Seattle','Seattle Stadium','2026-06-24 12:00'::timestamp),
(53,53,'groups','Grupo A','Czechia','Mexico','CZE','MEX','Mexico City','Mexico City Stadium','2026-06-24 20:00'::timestamp),
(54,54,'groups','Grupo A','South Africa','Korea Republic','RSA','KOR','Monterrey','Estadio Monterrey','2026-06-24 19:00'::timestamp),
(55,55,'groups','Grupo E','Curacao','Cote d''Ivoire','CUR','CIV','Philadelphia','Philadelphia Stadium','2026-06-25 15:00'::timestamp),
(56,56,'groups','Grupo E','Ecuador','Germany','ECU','GER','New York New Jersey','New York New Jersey Stadium','2026-06-25 15:00'::timestamp),
(57,57,'groups','Grupo F','Japan','Sweden','JPN','SWE','Dallas','Dallas Stadium','2026-06-25 18:00'::timestamp),
(58,58,'groups','Grupo F','Tunisia','Netherlands','TUN','NED','Kansas City','Kansas City Stadium','2026-06-25 18:00'::timestamp),
(59,59,'groups','Grupo D','Turkiye','USA','TUR','USA','Los Angeles','Los Angeles Stadium','2026-06-25 19:00'::timestamp),
(60,60,'groups','Grupo D','Paraguay','Australia','PAR','AUS','San Francisco Bay Area','San Francisco Bay Area Stadium','2026-06-25 19:00'::timestamp),
(61,61,'groups','Grupo I','Norway','France','NOR','FRA','Boston','Boston Stadium','2026-06-26 15:00'::timestamp),
(62,62,'groups','Grupo I','Senegal','Iraq','SEN','IRQ','Toronto','Toronto Stadium','2026-06-26 15:00'::timestamp),
(63,63,'groups','Grupo G','Egypt','IR Iran','EGY','IRN','Seattle','Seattle Stadium','2026-06-26 20:00'::timestamp),
(64,64,'groups','Grupo G','New Zealand','Belgium','NZL','BEL','Vancouver','BC Place Vancouver','2026-06-26 20:00'::timestamp),
(65,65,'groups','Grupo H','Cabo Verde','Saudi Arabia','CPV','KSA','Houston','Houston Stadium','2026-06-26 19:00'::timestamp),
(66,66,'groups','Grupo H','Uruguay','Spain','URU','ESP','Guadalajara','Estadio Guadalajara','2026-06-26 19:00'::timestamp),
(67,67,'groups','Grupo L','Panama','England','PAN','ENG','New York New Jersey','New York New Jersey Stadium','2026-06-27 17:00'::timestamp),
(68,68,'groups','Grupo L','Croatia','Ghana','CRO','GHA','Philadelphia','Philadelphia Stadium','2026-06-27 17:00'::timestamp),
(69,69,'groups','Grupo J','Algeria','Austria','ALG','AUT','Kansas City','Kansas City Stadium','2026-06-27 21:00'::timestamp),
(70,70,'groups','Grupo J','Jordan','Argentina','JOR','ARG','Dallas','Dallas Stadium','2026-06-27 21:00'::timestamp),
(71,71,'groups','Grupo K','Colombia','Portugal','COL','POR','Miami','Miami Stadium','2026-06-27 19:30'::timestamp),
(72,72,'groups','Grupo K','Congo DR','Uzbekistan','COD','UZB','Atlanta','Atlanta Stadium','2026-06-27 19:30'::timestamp),
(73,73,'round32',null,'Runner-up Group A','Runner-up Group B','2A','2B','Los Angeles','Los Angeles Stadium','2026-06-28 12:00'::timestamp),
(74,74,'round32',null,'Winner Group E','Third place Group A/B/C/D/F','1E','3ABCDF','Boston','Boston Stadium','2026-06-29 13:00'::timestamp),
(75,75,'round32',null,'Winner Group F','Runner-up Group C','1F','2C','Monterrey','Estadio Monterrey','2026-06-29 20:00'::timestamp),
(76,76,'round32',null,'Winner Group C','Runner-up Group F','1C','2F','Houston','Houston Stadium','2026-06-29 12:00'::timestamp),
(77,77,'round32',null,'Winner Group I','Third place Group C/D/F/G/H','1I','3CDFGH','New York New Jersey','New York New Jersey Stadium','2026-06-30 17:00'::timestamp),
(78,78,'round32',null,'Runner-up Group E','Runner-up Group I','2E','2I','Dallas','Dallas Stadium','2026-06-30 12:00'::timestamp),
(79,79,'round32',null,'Winner Group A','Third place Group C/E/F/H/I','1A','3CEFHI','Mexico City','Mexico City Stadium','2026-06-30 19:00'::timestamp),
(80,80,'round32',null,'Winner Group L','Third place Group E/H/I/J/K','1L','3EHIJK','Atlanta','Atlanta Stadium','2026-07-01 12:00'::timestamp),
(81,81,'round32',null,'Winner Group D','Third place Group B/E/F/I/J','1D','3BEFIJ','San Francisco Bay Area','San Francisco Bay Area Stadium','2026-07-01 12:00'::timestamp),
(82,82,'round32',null,'Winner Group G','Third place Group A/E/H/I/J','1G','3AEHIJ','Seattle','Seattle Stadium','2026-07-01 15:00'::timestamp),
(83,83,'round32',null,'Runner-up Group K','Runner-up Group L','2K','2L','Toronto','Toronto Stadium','2026-07-02 15:00'::timestamp),
(84,84,'round32',null,'Winner Group H','Runner-up Group J','1H','2J','Los Angeles','Los Angeles Stadium','2026-07-02 19:00'::timestamp),
(85,85,'round32',null,'Winner Group B','Third place Group E/F/G/I/J','1B','3EFGIJ','Vancouver','BC Place Vancouver','2026-07-02 15:00'::timestamp),
(86,86,'round32',null,'Winner Group J','Runner-up Group H','1J','2H','Miami','Miami Stadium','2026-07-03 12:00'::timestamp),
(87,87,'round32',null,'Winner Group K','Third place Group D/E/I/J/L','1K','3DEIJL','Kansas City','Kansas City Stadium','2026-07-03 15:00'::timestamp),
(88,88,'round32',null,'Runner-up Group D','Runner-up Group G','2D','2G','Dallas','Dallas Stadium','2026-07-03 20:00'::timestamp),
(89,89,'round16',null,'Winner match 74','Winner match 77','W74','W77','Philadelphia','Philadelphia Stadium','2026-07-04 12:00'::timestamp),
(90,90,'round16',null,'Winner match 73','Winner match 75','W73','W75','Houston','Houston Stadium','2026-07-04 18:00'::timestamp),
(91,91,'round16',null,'Winner match 76','Winner match 78','W76','W78','New York New Jersey','New York New Jersey Stadium','2026-07-05 12:00'::timestamp),
(92,92,'round16',null,'Winner match 79','Winner match 80','W79','W80','Mexico City','Mexico City Stadium','2026-07-05 17:00'::timestamp),
(93,93,'round16',null,'Winner match 83','Winner match 84','W83','W84','Dallas','Dallas Stadium','2026-07-06 12:00'::timestamp),
(94,94,'round16',null,'Winner match 81','Winner match 82','W81','W82','Seattle','Seattle Stadium','2026-07-06 15:00'::timestamp),
(95,95,'round16',null,'Winner match 86','Winner match 88','W86','W88','Atlanta','Atlanta Stadium','2026-07-07 12:00'::timestamp),
(96,96,'round16',null,'Winner match 85','Winner match 87','W85','W87','Vancouver','BC Place Vancouver','2026-07-07 15:00'::timestamp),
(97,97,'quarterfinals',null,'Winner match 89','Winner match 90','W89','W90','Boston','Boston Stadium','2026-07-09 15:00'::timestamp),
(98,98,'quarterfinals',null,'Winner match 93','Winner match 94','W93','W94','Los Angeles','Los Angeles Stadium','2026-07-10 15:00'::timestamp),
(99,99,'quarterfinals',null,'Winner match 91','Winner match 92','W91','W92','Miami','Miami Stadium','2026-07-11 12:00'::timestamp),
(100,100,'quarterfinals',null,'Winner match 95','Winner match 96','W95','W96','Kansas City','Kansas City Stadium','2026-07-11 16:00'::timestamp),
(101,101,'semifinals',null,'Winner match 97','Winner match 98','W97','W98','Dallas','Dallas Stadium','2026-07-14 15:00'::timestamp),
(102,102,'semifinals',null,'Winner match 99','Winner match 100','W99','W100','Atlanta','Atlanta Stadium','2026-07-15 15:00'::timestamp),
(103,103,'third_place',null,'Runner-up match 101','Runner-up match 102','L101','L102','Miami','Miami Stadium','2026-07-18 15:00'::timestamp),
(104,104,'final',null,'Winner match 101','Winner match 102','W101','W102','New York New Jersey','New York New Jersey Stadium','2026-07-19 15:00'::timestamp)
on conflict (id) do update set
  match_number = excluded.match_number,
  phase = excluded.phase,
  group_name = excluded.group_name,
  home_team = excluded.home_team,
  away_team = excluded.away_team,
  home_code = excluded.home_code,
  away_code = excluded.away_code,
  city = excluded.city,
  stadium = excluded.stadium,
  match_date = excluded.match_date;
