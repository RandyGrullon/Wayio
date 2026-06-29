# Configuración de Supabase — Login y Register (web + mobile)

> Guía paso a paso para dejar funcionando el registro e inicio de sesión de
> Wayio, tanto en la **web** (Next.js) como en la **app mobile** (Expo), con los
> **correos HTML** ya personalizados.

Todo lo de esta guía se hace **una vez** por proyecto. Los archivos a los que se
refiere están en esta carpeta `supabase/`:

| Archivo            | Para qué sirve                                            |
| ------------------ | --------------------------------------------------------- |
| `schema.sql`       | Esquema completo (pegar todo en el SQL Editor de una vez) |
| `migrations/*.sql` | Lo mismo, pero versionado para `supabase db push`         |
| `templates/*.html` | Los 6 correos de autenticación, con la marca Wayio        |
| `config.toml`      | Config del stack local + plantillas (Supabase CLI)        |

---

## 0. Antes de empezar

Necesitas un proyecto en [supabase.com](https://supabase.com). Del panel saca:

- **Project URL** → `https://xxxx.supabase.co`
- **anon public key** (Settings → API)
- **service_role key** (Settings → API) — **solo backend, nunca en el cliente**

Define tus dominios:

- Web producción: `https://wayio.app` (cámbialo por el tuyo)
- Web local: `http://localhost:3000`
- Deep link mobile: `wayio://` (esquema de la app Expo)

---

## 1. Crear las tablas (migraciones)

Tienes **dos formas equivalentes**; elige una.

### Opción A — Rápida (SQL Editor)

1. Supabase → **SQL Editor** → New query.
2. Pega **todo** `supabase/schema.sql` y pulsa **Run**.
   Es idempotente: puedes correrlo varias veces sin romper nada.

Esto crea todas las tablas + RLS + el trigger `on_auth_user_created`, que al
registrarse genera automáticamente: **perfil**, **suscripción `free`** y
**código de referido**. Así la pantalla de la app no se queda sin datos.

### Opción B — Con la CLI (versionado, recomendado para el equipo)

```bash
npm i -g supabase            # o: npx supabase ...
supabase link --project-ref <TU_PROJECT_REF>
supabase db push             # aplica supabase/migrations/ en orden
```

Las migraciones se aplican por nombre (timestamp) en orden:

1. `20260101000000_initial_schema.sql` — todo el esquema base.
2. `20260627120000_auth_signup_provisioning.sql` — aprovisionamiento al
   registrarse (suscripción `free` + referido) y backfill de los usuarios que ya
   existían.

> Para futuros cambios: crea un archivo nuevo en `migrations/` con un timestamp
> mayor y vuelve a `supabase db push`. **No edites** migraciones ya aplicadas.

### Hazte admin (opcional)

Al final de `schema.sql` hay una línea comentada. Tras registrarte una vez:

```sql
update public.profiles set role = 'admin' where email = 'tu-email@ejemplo.com';
```

---

## 2. URLs de redirección (clave para que el login no falle)

Supabase → **Authentication → URL Configuration**:

- **Site URL:** `https://wayio.app` (en local: `http://localhost:3000`)
- **Redirect URLs** (añade todas las que uses):

  ```
  http://localhost:3000/auth/callback
  https://wayio.app/auth/callback
  wayio://auth/callback
  ```

La web intercambia el `code` por sesión en `src/app/auth/callback/route.ts`.
El esquema `wayio://` es para que el correo abra la **app** en el móvil
(ver sección 6). Si una URL no está en esta lista, Supabase **rechaza** la
redirección y verás `?error=auth`.

---

## 3. Correos personalizados (HTML de Wayio)

Las plantillas están en `supabase/templates/` con la marca (teal `#14b8a6`),
listas para usar. Hay dos maneras de instalarlas.

### Opción A — Dashboard (proyecto hosted)

Supabase → **Authentication → Emails → Templates**. Para cada tipo, pega el
contenido del archivo correspondiente y ajusta el asunto:

| Tipo en el Dashboard | Archivo                           | Asunto sugerido                       |
| -------------------- | --------------------------------- | ------------------------------------- |
| Confirm signup       | `templates/confirmation.html`     | Confirma tu cuenta en Wayio ✈️        |
| Magic Link           | `templates/magic_link.html`       | Tu enlace de acceso a Wayio 🔑        |
| Reset Password       | `templates/recovery.html`         | Restablece tu contraseña de Wayio 🔒  |
| Invite user          | `templates/invite.html`           | Te invitaron a Wayio 🌍               |
| Change Email Address | `templates/email_change.html`     | Confirma tu nuevo email en Wayio ✉️   |
| Reauthentication     | `templates/reauthentication.html` | Tu código de verificación de Wayio 🛡️ |

Variables que usan las plantillas (las rellena Supabase):

- `{{ .ConfirmationURL }}` — enlace de acción (confirmar / reset / magic link).
- `{{ .Token }}` — código OTP de 6 dígitos (en reauthentication).
- `{{ .Email }}` / `{{ .NewEmail }}` — en el cambio de email.

### Opción B — CLI (`config.toml`)

`supabase/config.toml` ya apunta a cada plantilla con su `content_path` y
`subject`. Con `supabase db push` / `supabase start` se aplican solas. En local,
los correos se capturan en **Inbucket**: <http://localhost:54324>.

---

## 4. Ajustes de email/password

Supabase → **Authentication → Providers → Email**:

- **Enable Email provider:** ON.
- **Confirm email:** ON (recomendado en producción). El usuario debe confirmar
  antes de poder iniciar sesión. La web ya muestra _"Revisa tu email para
  confirmar"_ tras registrarse, y la app mobile también.
- **Minimum password length:** 6 (el formulario ya valida `minLength=6`).

> **SMTP propio (producción):** el SMTP de Supabase tiene un límite bajo y baja
> entregabilidad. Para producción configura un SMTP en **Authentication →
> Emails → SMTP Settings** (p. ej. Resend, SendGrid o Postmark) con tu dominio
> verificado. Así los correos HTML llegan bien y no a spam.

---

## 5. Google (login social)

Solo si quieres el botón "Continuar con Google" (ya está en la web):

1. [Google Cloud Console](https://console.cloud.google.com/) → crea credenciales
   **OAuth 2.0 Client ID** (tipo: Web application).
2. **Authorized redirect URI:**
   `https://<TU_PROJECT_REF>.supabase.co/auth/v1/callback`
3. Supabase → **Authentication → Providers → Google:** pega Client ID + Secret,
   actívalo.

El flujo web ya está implementado en `src/lib/auth/actions.ts`
(`signInWithGoogle`) → redirige a `/auth/callback`.

---

## 6. App mobile (Expo) — deep linking

La app usa `@supabase/supabase-js` con sesión en **AsyncStorage**
(`mobile/src/lib/supabase/client.ts`). El **login y register con email/password
ya funcionan** sin pasos extra: tras confirmar el email (el enlace abre la web),
el usuario inicia sesión en la app con su contraseña.

Para que el correo de confirmación abra **directamente la app** (opcional, mejor
UX nativa):

1. En `mobile/app.json` añade el esquema:

   ```json
   {
     "expo": {
       "scheme": "wayio"
     }
   }
   ```

2. Asegúrate de que `wayio://auth/callback` está en las **Redirect URLs**
   (sección 2).

3. Al registrar/recuperar desde la app, pasa el `redirectTo`:

   ```ts
   await getSupabase().auth.signUp({
     email,
     password,
     options: {
       data: { full_name: nombre },
       emailRedirectTo: 'wayio://auth/callback',
     },
   })
   ```

   Y maneja el enlace entrante con `Linking` + `exchangeCodeForSession`
   (o `setSession` con los tokens del fragmento).

> Si no añades el deep link, todo sigue funcionando: el correo abre la web,
> confirma la cuenta y el usuario vuelve a la app a iniciar sesión. El deep link
> es solo para evitar ese salto.

---

## 7. Variables de entorno

### Web (`.env.local`)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...        # anon public
SUPABASE_SERVICE_ROLE_KEY=eyJ...            # service_role (solo backend)
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # en prod: https://wayio.app
```

### Mobile (`mobile/.env`)

```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...        # la MISMA anon key
EXPO_PUBLIC_API_URL=http://192.168.1.50:3000  # IP LAN del PC para endpoints IA
EXPO_PUBLIC_WEB_URL=http://localhost:3000
```

> En el móvil físico **no uses `localhost`** para `EXPO_PUBLIC_API_URL`: pon la
> IP de tu computadora en la red local.

---

## 8. Comprobación rápida

1. Web: `npm run dev` → `/login` → **Crear cuenta** → llega el correo HTML de
   confirmación → confirmas → inicias sesión.
2. Mobile: `expo start` → pantalla de Auth → **Crear cuenta** → confirmas por
   correo → inicias sesión con la contraseña.
3. En Supabase → **Authentication → Users** debe aparecer el usuario, y en
   **Table editor**: una fila en `profiles`, una en `subscriptions` (`free`) y
   una en `referrals`.

---

## Problemas comunes

| Síntoma                                 | Causa / solución                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| `?error=auth` tras confirmar            | Falta la URL en **Redirect URLs** (sección 2).                                      |
| El correo no llega                      | SMTP por defecto saturado → configura SMTP propio (sección 4).                      |
| "Email not confirmed" al iniciar sesión | `Confirm email` está ON y el usuario no confirmó. Reenvía el correo.                |
| App: "Faltan EXPO*PUBLIC_SUPABASE*..."  | Falta el `.env` del móvil (sección 7). Reinicia Expo tras crearlo.                  |
| No se crea `profiles`/`subscriptions`   | No corriste la migración de aprovisionamiento (sección 1, opción B o `schema.sql`). |
| Login social falla                      | Redirect URI mal en Google Cloud (sección 5).                                       |
