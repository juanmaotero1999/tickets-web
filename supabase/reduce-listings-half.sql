-- Deja fuera de disponibilidad aproximadamente el 50% de las publicaciones activas.
-- No borra operaciones existentes: solo cancela publicaciones que no tienen órdenes asociadas.

with ranked as (
  select
    l.id,
    row_number() over (order by l.match_id, l.created_at, l.id) as rn
  from listings l
  where l.status = 'active'
    and not exists (
      select 1
      from orders o
      where o.listing_id = l.id
    )
)
update listings l
set status = 'cancelled'
from ranked r
where l.id = r.id
  and r.rn % 2 = 0;
