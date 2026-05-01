delete from reviews
where reviewer_id between '00000000-2026-4000-8000-000000000001'::uuid and '00000000-2026-4000-8000-000000000014'::uuid
   or reviewed_user_id between '00000000-2026-4000-8000-000000000001'::uuid and '00000000-2026-4000-8000-000000000014'::uuid;

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
