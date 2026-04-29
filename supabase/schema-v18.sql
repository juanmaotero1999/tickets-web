
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
  message text,
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
alter table users add column if not exists role text default 'user';
alter table users add column if not exists created_at timestamp default now();

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
alter table listings add column if not exists created_at timestamp default now();

alter table orders add column if not exists listing_id uuid;
alter table orders add column if not exists buyer_id uuid;
alter table orders add column if not exists seller_id uuid;
alter table orders add column if not exists quantity int;
alter table orders add column if not exists total numeric;
alter table orders add column if not exists status text default 'pending_payment';
alter table orders add column if not exists created_at timestamp default now();

alter table messages add column if not exists order_id uuid;
alter table messages add column if not exists sender_id uuid;
alter table messages add column if not exists text text;
alter table messages add column if not exists created_at timestamp default now();

alter table notifications add column if not exists user_id uuid;
alter table notifications add column if not exists message text;
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

-- Fuerza a PostgREST/Supabase API a refrescar el cache del esquema.
notify pgrst, 'reload schema';

-- Partidos demo si la tabla está vacía. Podés reemplazar/cargar los 104 después.
insert into matches (id, match_number, phase, group_name, home_team, away_team, home_code, away_code, city, stadium, match_date)
select * from (values
(1,1,'groups','Grupo A','Mexico','South Africa','MEX','RSA','Mexico City','Estadio Azteca','2026-06-11 16:00'::timestamp),
(2,2,'groups','Grupo B','Canada','Qatar','CAN','QAT','Vancouver','BC Place','2026-06-12 15:00'::timestamp),
(3,3,'groups','Grupo D','USA','Paraguay','USA','PAR','Los Angeles','SoFi Stadium','2026-06-12 18:00'::timestamp),
(4,4,'groups','Grupo A','Argentina','Mexico','ARG','MEX','Dallas','AT&T Stadium','2026-06-15 19:00'::timestamp),
(5,5,'groups','Grupo L','England','Croatia','ENG','CRO','Dallas','AT&T Stadium','2026-06-17 15:00'::timestamp),
(6,6,'groups','Grupo K','Portugal','DR Congo','POR','COD','Houston','NRG Stadium','2026-06-17 12:00'::timestamp),
(7,7,'round16',null,'Match 1 Winner','Match 2 Runner-up','1A','2B','Dallas','AT&T Stadium','2026-06-28 17:00'::timestamp),
(8,8,'quarterfinals',null,'Round of 16 Winner','Round of 16 Winner','W86','W88','Kansas City','Arrowhead Stadium','2026-07-04 20:00'::timestamp),
(9,9,'semifinals',null,'Quarterfinal Winner','Quarterfinal Winner','W95','W96','Dallas','AT&T Stadium','2026-07-14 20:00'::timestamp),
(10,10,'final',null,'Semi Winner','Semi Winner','W101','W102','New York','MetLife Stadium','2026-07-19 18:00'::timestamp)
) as v(id,match_number,phase,group_name,home_team,away_team,home_code,away_code,city,stadium,match_date)
where not exists (select 1 from matches);
