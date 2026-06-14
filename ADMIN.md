# Panel de administración de Wayio

Panel completo en `/admin` para controlar el backend que comparten la web y la
app mobile (Supabase + API routes).

## Activación (3 pasos)

### 1. Crear las tablas

Pega `supabase/schema.sql` completo en **Supabase → SQL Editor → Run**.
Crea todas las tablas de la app + las del panel (perfiles con rol, logs de IA,
feature flags, anuncios, tokens de push, auditoría, settings), con RLS, índices
y datos por defecto. Es idempotente.

### 2. Configurar la SERVICE ROLE key (imprescindible)

El panel usa la _service role_ key de Supabase para saltarse RLS. En
`.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co   # SIN /rest/v1/ al final
SUPABASE_SERVICE_ROLE_KEY=<la key real "service_role" de Supabase → Settings → API>
```

> ⚠️ Dos errores que bloquean el panel:
>
> - Si la URL termina en `/rest/v1/`, auth y queries fallan. Debe ser la base.
> - La `service_role` key NO es la `anon`. Cópiala de Settings → API → Project
>   API keys → `service_role` (secreta). Si pones la anon, el panel no autoriza.

### 3. Hacerte admin

Después de registrarte en la app con tu email, corre en el SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'tu-email@ejemplo.com';
```

Entra a `/admin`. Si no eres admin te redirige a la home; si no hay sesión, al login.

## Qué controla

| Sección       | Ruta                   | Qué hace                                                                 |
| ------------- | ---------------------- | ------------------------------------------------------------------------ |
| Dashboard     | `/admin`               | Métricas: usuarios, viajes, MRR, costo de IA, gráficas                   |
| Usuarios      | `/admin/users`         | Buscar, ver detalle, cambiar rol, banear, otorgar/revocar plan, eliminar |
| Viajes        | `/admin/trips`         | Listar/filtrar, ver itinerario+grupo, cambiar estado, borrar             |
| Suscripciones | `/admin/subscriptions` | MRR/ARR, tiers, lista con datos de Stripe                                |
| Grupos        | `/admin/groups`        | Moderar mensajes y gastos de los viajes en grupo                         |
| Referidos     | `/admin/referrals`     | Códigos, conversiones, leaderboard                                       |
| Uso de IA     | `/admin/ai`            | Tokens, costo, latencia y éxito por proveedor/modelo                     |
| Feature Flags | `/admin/flags`         | Activar/desactivar funciones en web y mobile                             |
| Anuncios      | `/admin/announcements` | Publicar banners para web y mobile                                       |
| Auditoría     | `/admin/audit`         | Registro de todas las acciones de admin                                  |
| Settings      | `/admin/settings`      | Modo mantenimiento y proveedor de IA                                     |

## Control de la app mobile

El mobile lee la configuración remota desde el mismo endpoint que la web:

```
GET /api/config?platform=mobile
→ { flags: {...}, announcements: [...], maintenance: { enabled, message } }
```

Para conectarlo, en la app mobile haz un fetch a este endpoint al arrancar y:

- usa `flags[x].enabled` para mostrar/ocultar funciones,
- muestra `announcements` como banner,
- si `maintenance.enabled` es true, muestra la pantalla de mantenimiento.

Registro de token de push (para envíos futuros):

```
POST /api/devices   { token, platform: 'ios' | 'android' | 'web' }
```

## Monitoreo de costos de IA

Cada llamada a la IA (web y mobile, vía `aiClient`) se registra automáticamente
en `ai_logs` con proveedor, modelo, tokens, costo estimado y latencia. No
requiere configuración extra: aparece en `/admin/ai`.
