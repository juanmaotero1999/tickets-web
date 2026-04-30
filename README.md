# Ticket Marketplace v18

## Deploy
1. Subir el contenido de esta carpeta a GitHub.
2. Vercel detecta Vite: `npm run build`, output `dist`.
3. Variables:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_KEY

## Supabase
Ejecutar `supabase/schema-v18.sql` en SQL Editor.

Si aparece `Could not find the 'seller_payment_method' column of 'listings' in the schema cache`, volvé a ejecutar ese script completo en Supabase. La versión actual agrega columnas faltantes en tablas existentes y fuerza la recarga del cache de esquema de la API.

El mismo script carga/actualiza los 104 partidos del Mundial 2026. La fase de grupos usa equipos reales; las fases eliminatorias usan los cruces oficiales hasta que se conozcan los clasificados.

Para cargar mercado inicial con 30 vendedores demo y ofertas en todos los partidos, ejecutar después `supabase/demo-seed.sql`.

## Emails transaccionales
La app incluye un endpoint backend de Vercel en `api/send-email.js` para enviar avisos por mail cuando se crean notificaciones importantes.

Configurar estas variables de entorno en Vercel:

- `SUPABASE_URL` o `VITE_SUPABASE_URL`
- `SUPABASE_ANON_KEY` o `VITE_SUPABASE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SMTP_HOST=smtp.hostinger.com`
- `SMTP_PORT=465`
- `SMTP_USER=transferencias@entradas-fifa.store`
- `SMTP_PASS` con la contraseña del correo
- `EMAIL_FROM=Digital Guale <transferencias@entradas-fifa.store>`
- `APP_URL=https://entradas-fifa.store`

No guardar la contraseña SMTP en el código. Va solo como variable secreta del deploy.

## Admin
Por defecto:
- admin@demo.com
- juanmaotero1999@gmail.com

También podés editar `ADMIN_EMAILS` en `src/main.js`.
