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
La app incluye una Edge Function en `supabase/functions/send-email` para enviar avisos por mail cuando se crean notificaciones importantes.

1. Crear una cuenta en Resend y verificar el dominio `digitalguale.com`.
2. En el DNS del dominio, agregar los registros que indique Resend para DKIM/SPF.
3. Configurar secretos en Supabase:

```bash
supabase secrets set RESEND_API_KEY="re_xxx"
supabase secrets set EMAIL_FROM="Digital Guale <avisos@digitalguale.com>"
supabase secrets set APP_URL="https://digitalguale.com"
```

4. Deploy de la función:

```bash
supabase functions deploy send-email
```

La función usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`, que Supabase expone automáticamente en Edge Functions.

## Admin
Por defecto:
- admin@demo.com
- juanmaotero1999@gmail.com

También podés editar `ADMIN_EMAILS` en `src/main.js`.
