-- Datos demo para que el marketplace no arranque vacío.
-- Ejecutar después de supabase/schema-v18.sql.
-- Es idempotente: vuelve a correr sin duplicar usuarios ni publicaciones demo.

with demo_users(idx, first_name, last_name, email, rating, reviews, sales) as (
  values
  (1,'Santiago','Molina','santiago.molina.demo@example.com',4.9,38,124),
  (2,'Valentina','Rossi','valentina.rossi.demo@example.com',4.8,31,98),
  (3,'Mateo','Silva','mateo.silva.demo@example.com',4.7,24,76),
  (4,'Camila','Fernandez','camila.fernandez.demo@example.com',5.0,42,151),
  (5,'Nicolas','Pereyra','nicolas.pereyra.demo@example.com',4.6,19,63),
  (6,'Lucia','Martinez','lucia.martinez.demo@example.com',4.9,35,112),
  (7,'Tomas','Herrera','tomas.herrera.demo@example.com',4.7,28,89),
  (8,'Martina','Suarez','martina.suarez.demo@example.com',4.8,33,105),
  (9,'Agustin','Romero','agustin.romero.demo@example.com',4.5,17,57),
  (10,'Sofia','Castro','sofia.castro.demo@example.com',4.9,44,139),
  (11,'Joaquin','Vega','joaquin.vega.demo@example.com',4.6,21,68),
  (12,'Florencia','Acosta','florencia.acosta.demo@example.com',4.8,29,94),
  (13,'Ignacio','Navarro','ignacio.navarro.demo@example.com',4.7,26,83),
  (14,'Julieta','Medina','julieta.medina.demo@example.com',5.0,47,166),
  (15,'Benjamin','Ortega','benjamin.ortega.demo@example.com',4.6,22,71),
  (16,'Renata','Gimenez','renata.gimenez.demo@example.com',4.9,39,128),
  (17,'Facundo','Sosa','facundo.sosa.demo@example.com',4.7,25,80),
  (18,'Victoria','Luna','victoria.luna.demo@example.com',4.8,32,101),
  (19,'Lautaro','Campos','lautaro.campos.demo@example.com',4.5,18,59),
  (20,'Emilia','Ibarra','emilia.ibarra.demo@example.com',4.9,41,133),
  (21,'Bruno','Arias','bruno.arias.demo@example.com',4.6,20,66),
  (22,'Micaela','Rivas','micaela.rivas.demo@example.com',4.8,30,97),
  (23,'Gonzalo','Mendez','gonzalo.mendez.demo@example.com',4.7,27,85),
  (24,'Carolina','Farias','carolina.farias.demo@example.com',5.0,45,158),
  (25,'Ramiro','Cabrera','ramiro.cabrera.demo@example.com',4.6,23,73),
  (26,'Antonella','Aguirre','antonella.aguirre.demo@example.com',4.9,36,117),
  (27,'Federico','Morales','federico.morales.demo@example.com',4.7,28,90),
  (28,'Paula','Benitez','paula.benitez.demo@example.com',4.8,34,108),
  (29,'Diego','Correa','diego.correa.demo@example.com',4.5,16,54),
  (30,'Milagros','Paz','milagros.paz.demo@example.com',4.9,40,130)
)
insert into users (
  id, email, first_name, last_name, account_status, verification_status,
  preferred_currency, role, seller_rating, seller_reviews_count, seller_sales_count
)
select
  ('10000000-0000-4000-8000-' || lpad(idx::text, 12, '0'))::uuid,
  email,
  first_name,
  last_name,
  'active',
  'verified',
  'USD',
  'user',
  rating,
  reviews,
  sales
from demo_users
on conflict (id) do update set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  seller_rating = excluded.seller_rating,
  seller_reviews_count = excluded.seller_reviews_count,
  seller_sales_count = excluded.seller_sales_count,
  verification_status = excluded.verification_status;

with cats(category, base_price) as (
  values (1,1700), (2,1400), (3,1200)
),
demo_listings as (
  select
    ('20000000-' || lpad(m.id::text, 4, '0') || '-' || c.category || '000-8000-' || lpad((m.id * 10 + c.category)::text, 12, '0'))::uuid as id,
    m.id as match_id,
    c.category,
    (2 + ((m.id + c.category) % 4))::int as quantity,
    (((c.base_price + ((m.id * 37 + c.category * 83) % 290)) *
      case when m.phase in ('semifinals','final') then 4 else 1 end))::numeric as price,
    ('10000000-0000-4000-8000-' || lpad(((((m.id + c.category * 7 - 1) % 30) + 1))::text, 12, '0'))::uuid as seller_id,
    (100 + ((m.id * 3 + c.category * 11) % 430))::text as sector,
    ((1 + ((m.id * 5 + c.category * 3) % 24))::text || ', ' ||
      (2 + ((m.id * 5 + c.category * 3) % 24))::text || ', ' ||
      (3 + ((m.id * 5 + c.category * 3) % 24))::text) as seats
  from matches m
  cross join cats c
)
insert into listings (
  id, match_id, category, quantity, price, currency, seller_id, type, status,
  seller_payment_method, seller_payment_value, sector, seats
)
select
  id, match_id, category, quantity, price, 'USD', seller_id, 'sale', 'active',
  'Wallet', 'demo-wallet-' || right(seller_id::text, 6), sector, seats
from demo_listings
on conflict (id) do update set
  match_id = excluded.match_id,
  category = excluded.category,
  quantity = excluded.quantity,
  price = excluded.price,
  currency = excluded.currency,
  seller_id = excluded.seller_id,
  type = excluded.type,
  status = excluded.status,
  seller_payment_method = excluded.seller_payment_method,
  seller_payment_value = excluded.seller_payment_value,
  sector = excluded.sector,
  seats = excluded.seats;

notify pgrst, 'reload schema';
