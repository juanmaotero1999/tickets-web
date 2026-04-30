-- Datos demo para que el marketplace no arranque vacío.
-- Ejecutar después de supabase/schema-v18.sql.
-- Es idempotente: vuelve a correr sin duplicar usuarios ni publicaciones demo.

with demo_users(idx, first_name, last_name, email, rating, reviews, sales) as (
  values
  (1,'Jorge','Boso','jorge.boso.demo@example.com',5.0,2,2),
  (2,'Damian','Gentile','damian.gentile.demo@example.com',5.0,1,1),
  (3,'Camila','Tonetti','camila.tonetti.demo@example.com',5.0,3,3),
  (4,'Valentina','Rossi','valentina.rossi.demo@example.com',5.0,2,2),
  (5,'Mateo','Silva','mateo.silva.demo@example.com',5.0,1,1),
  (6,'Lucia','Martinez','lucia.martinez.demo@example.com',5.0,3,3),
  (7,'Tomas','Herrera','tomas.herrera.demo@example.com',5.0,2,2),
  (8,'Martina','Suarez','martina.suarez.demo@example.com',5.0,1,1),
  (9,'Agustin','Romero','agustin.romero.demo@example.com',5.0,3,3),
  (10,'Sofia','Castro','sofia.castro.demo@example.com',5.0,2,2),
  (11,'Nicolas','Pereyra','nicolas.pereyra.demo@example.com',5.0,1,1),
  (12,'Florencia','Acosta','florencia.acosta.demo@example.com',5.0,3,3),
  (13,'Ignacio','Navarro','ignacio.navarro.demo@example.com',5.0,2,2),
  (14,'Julieta','Medina','julieta.medina.demo@example.com',5.0,1,1),
  (15,'Benjamin','Ortega','benjamin.ortega.demo@example.com',5.0,3,3),
  (16,'Renata','Gimenez','renata.gimenez.demo@example.com',5.0,2,2),
  (17,'Facundo','Sosa','facundo.sosa.demo@example.com',5.0,1,1),
  (18,'Victoria','Luna','victoria.luna.demo@example.com',5.0,3,3),
  (19,'Lautaro','Campos','lautaro.campos.demo@example.com',5.0,2,2),
  (20,'Emilia','Ibarra','emilia.ibarra.demo@example.com',5.0,1,1),
  (21,'Bruno','Arias','bruno.arias.demo@example.com',5.0,3,3),
  (22,'Micaela','Dalla Fontana','micaela.dallafontana.demo@example.com',5.0,2,2),
  (23,'Gonzalo','Mendez','gonzalo.mendez.demo@example.com',5.0,1,1),
  (24,'Carolina','Farias','carolina.farias.demo@example.com',5.0,3,3),
  (25,'Ramiro','Dell Acqua','ramiro.dellacqua.demo@example.com',4.0,2,2),
  (26,'Antonella','Zampieri','antonella.zampieri.demo@example.com',4.0,1,1),
  (27,'Federico','Morales','federico.morales.demo@example.com',4.0,3,3),
  (28,'Paula','Benitez','paula.benitez.demo@example.com',4.0,2,2),
  (29,'Diego','Quagliaro','diego.quagliaro.demo@example.com',3.0,1,1),
  (30,'Milagros','Mazzitelli','milagros.mazzitelli.demo@example.com',3.0,2,2)
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

with cats(category, multiplier) as (
  values (1,1.00), (2,0.66), (3,0.40)
),
priced_matches as (
  select
    m.*,
    greatest(
      case
        when m.phase = 'final' then 6730
        when m.phase = 'semifinals' then 3295
        when m.phase = 'quarterfinals' then 1450
        when m.phase in ('round16','round_of_16','r16') then 850
        when m.phase = 'round32' then 560
        when m.phase = 'third_place' then 650
        else 320
      end,
      case
        when m.phase = 'groups' and (m.home_code in ('ARG','BRA','GER','MEX','USA','COL','ENG','FRA','ESP','POR') or m.away_code in ('ARG','BRA','GER','MEX','USA','COL','ENG','FRA','ESP','POR')) then 760
        when m.phase = 'groups' and (m.home_code in ('URU','NED','BEL','CRO','SUI','JPN','MAR') or m.away_code in ('URU','NED','BEL','CRO','SUI','JPN','MAR')) then 430
        when m.phase = 'groups' then 260
        else 0
      end
    ) as cat1_anchor
  from matches m
),
demo_listings as (
  select
    ('20000000-' || lpad(pm.id::text, 4, '0') || '-' || c.category || '000-8000-' || lpad((pm.id * 10 + c.category)::text, 12, '0'))::uuid as id,
    pm.id as match_id,
    c.category,
    (2 + ((pm.id + c.category) % 3))::int as quantity,
    round((
      (pm.cat1_anchor * c.multiplier) +
      case
        when pm.phase = 'groups' then ((pm.id * 17 + c.category * 23) % 55)
        when pm.phase in ('round32','round16','round_of_16','r16','quarterfinals','third_place') then ((pm.id * 29 + c.category * 37) % 120)
        else ((pm.id * 53 + c.category * 71) % 420)
      end
    ) / 10) * 10 as price,
    ('10000000-0000-4000-8000-' || lpad(((((pm.id + c.category * 7 - 1) % 30) + 1))::text, 12, '0'))::uuid as seller_id,
    (100 + ((pm.id * 3 + c.category * 11) % 430))::text as sector,
    ((1 + ((pm.id * 5 + c.category * 3) % 24))::text || ', ' ||
      (2 + ((pm.id * 5 + c.category * 3) % 24))::text || ', ' ||
      (3 + ((pm.id * 5 + c.category * 3) % 24))::text) as seats
  from priced_matches pm
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
