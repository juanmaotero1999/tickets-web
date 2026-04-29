
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
