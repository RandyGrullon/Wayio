# Configuración de Supabase — Login y Register (web + mobile)

> Guía paso a paso para dejar funcionando el registro, el inicio de sesión, la
> recuperación de contraseña y el enlace mágico de Wayio, tanto en la **web**
> (Next.js) como en la **app mobile** (Expo), con los **correos HTML**
> personalizados.

Todo lo de esta guía se hace **una vez** por proyecto. Los archivos a los que se
refiere están en esta carpeta `supabase/`:

| Archivo            | Para qué sirve                                                     |
| ------------------ | ------------------------------------------------------------------ |
| `schema.sql`       | Esquema completo (pegar todo en el SQL Editor de una vez)          |
| `migrations/*.sql` | Lo mismo, pero versionado para `supabase db push`                  |
| `templates/*.html` | Los 6 correos de autenticación, con la marca Wayio                 |
| `config.toml`      | Config del **stack local** de la CLI (`supabase start`), no hosted |

---

## 0. Antes de empezar

Necesitas un proyecto en [supabase.com](https://supabase.com). Del panel saca:

- **Project URL** → `https://xxxx.supabase.co`
- **anon public key** (Settings → API)
- **service_role key** (Settings → API) — **solo backend, nunca en el cliente**

Define tus dominios:

- Web producción: `https://wayio.app` (cámbialo por el tuyo)
- Web local: `http://localhost:3000`
- Deep link mobile: `wayio://` (ya declarado en `mobile/app.json`)

> Recomendado: usa **un proyecto de Supabase para desarrollo y otro para
> producción**. Así las URLs de `localhost` nunca están permitidas en
> producción.

---

## 1. Crear las tablas (migraciones)

Tienes **dos formas equivalentes**; elige una.

### Opción A — Rápida (SQL Editor)

1. Supabase → **SQL Editor** → New query.
2. Pega **todo** `supabase/schema.sql` y pulsa **Run**.
   Es idempotente: puedes correrlo varias veces sin romper nada.

Esto crea todas las tablas + RLS + el trigger `on_auth_user_created`, que al
registrarse genera automáticamente: **perfil**, **suscripción `free`** y
**código de referido**.

### Opción B — Con la CLI (versionado, recomendado para el equipo)

```bash
npx supabase link --project-ref <TU_PROJECT_REF>
npx supabase db push         # aplica supabase/migrations/ en orden
```

> `db push` **solo aplica migraciones**. No sube las plantillas de correo, ni
> las URLs, ni nada de la sección `[auth]` de `config.toml`: eso se configura
> en el panel (secciones 2 a 5).

Para futuros cambios: crea un archivo nuevo en `migrations/` con un timestamp
mayor y vuelve a `db push`. **No edites** migraciones ya aplicadas.

### Hazte admin (opcional)

Tras registrarte una vez:

```sql
update public.profiles set role = 'admin' where email = 'tu-email@ejemplo.com';
```

---

## 2. URLs de redirección (clave para que el login no falle)

Supabase → **Authentication → URL Configuration**:

- **Site URL:** `https://wayio.app` (en el proyecto de desarrollo:
  `http://localhost:3000`). Las plantillas la usan como `{{ .SiteURL }}`, así
  que **todos los enlaces de los correos apuntan aquí**.
- **Redirect URLs** (añade todas; los `**` cubren `?next=...`):

  ```
  https://wayio.app/**
  wayio://**
  ```

  En el proyecto de desarrollo, en su lugar:

  ```
  http://localhost:3000/**
  wayio://**
  ```

  Si usas previews de Vercel, añade también su patrón, por ejemplo
  `https://*-tu-equipo.vercel.app/**`.

Rutas de la web que intervienen (todas ya implementadas):

| Ruta                | Qué hace                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| `/auth/callback`    | Vuelta de **Google**: canjea el `code` y lleva a `next` (validado).                             |
| `/auth/confirm`     | Destino de **todos los correos**: `verifyOtp(token_hash, type)` y redirige a `next` (validado). |
| `/auth/recuperar`   | Formulario "¿Olvidaste tu contraseña?".                                                         |
| `/auth/nueva-clave` | Elegir contraseña nueva (solo con la sesión del enlace de recuperación o invitación).           |
| `/auth/abrir-app`   | Puente para correos pedidos **desde la app**: abre `wayio://auth/callback` con el token.        |

Si una URL no está en la lista, Supabase **ignora** el destino pedido y usa la
Site URL.

---

## 3. Correos personalizados (HTML de Wayio)

Las plantillas de `supabase/templates/` ya **no usan `{{ .ConfirmationURL }}`**:
enlazan a `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=...`.
Así la confirmación funciona **aunque el correo se abra en otro dispositivo o
navegador** (el canje PKCE clásico solo funciona en el mismo navegador).

### Instalación en el proyecto hosted — panel (obligatorio)

Supabase → **Authentication → Emails → Templates**. Para cada tipo, pega el
contenido completo del archivo y pon el asunto:

| Tipo en el panel     | Archivo                           | Asunto                                | Enlace que lleva                               |
| -------------------- | --------------------------------- | ------------------------------------- | ---------------------------------------------- |
| Confirm signup       | `templates/confirmation.html`     | Confirma tu cuenta en Wayio ✈️        | `type=email&next={{ .RedirectTo }}`            |
| Magic Link           | `templates/magic_link.html`       | Tu enlace de acceso a Wayio 🔑        | `type=email&next={{ .RedirectTo }}`            |
| Reset Password       | `templates/recovery.html`         | Restablece tu contraseña de Wayio 🔒  | `type=recovery&next=/auth/nueva-clave`         |
| Invite user          | `templates/invite.html`           | Te invitaron a Wayio 🌍               | `type=invite&next=/auth/nueva-clave`           |
| Change Email Address | `templates/email_change.html`     | Confirma tu nuevo email en Wayio ✉️   | `type=email_change&next={{ .RedirectTo }}`     |
| Reauthentication     | `templates/reauthentication.html` | Tu código de verificación de Wayio 🛡️ | (sin enlace: muestra el código `{{ .Token }}`) |

Variables que usan las plantillas (las rellena Supabase):

- `{{ .SiteURL }}` — la Site URL de la sección 2.
- `{{ .TokenHash }}` — el token del enlace (lo verifica `/auth/confirm`).
- `{{ .RedirectTo }}` — el destino que pidió la web o la app (por ejemplo
  `https://wayio.app/auth/confirm?next=/group/abc` o `wayio://auth/callback`).
  La web lo valida: solo acepta rutas de su propio dominio o el deep link de
  la app; cualquier otra cosa termina en `/`.
- `{{ .Token }}` — código de 6 dígitos (reauthentication).
- `{{ .Email }}` / `{{ .NewEmail }}` — en el cambio de email.

> Si no pegas las plantillas, Supabase usa las suyas (en inglés, con
> `{{ .ConfirmationURL }}`). La web sigue funcionando en el mismo navegador,
> pero no entre dispositivos, y la recuperación pedida desde la app falla.

### Stack local — CLI

`supabase/config.toml` apunta a cada plantilla con `content_path` y `subject`.
Se aplican **solo** con `npx supabase start` (stack local); los correos se ven
en **Inbucket**: <http://localhost:54324>.

> Existe `npx supabase config push`, pero sube **todo** el `[auth]` de
> `config.toml` (incluida `site_url = http://localhost:3000`) al proyecto
> hosted. No lo uses contra producción: pega las plantillas en el panel.

### Aviso: escáneres de enlaces

Algunos filtros de correo corporativos (por ejemplo Safe Links de Outlook)
abren los enlaces antes que el usuario y gastan el token. Si alguien dice que
el enlace "ya caducó" nada más recibirlo, que pida otro o que use el inicio de
sesión con contraseña.

---

## 4. Ajustes de email/password y SMTP

Supabase → **Authentication → Providers → Email**:

- **Enable Email provider:** ON.
- **Confirm email:** ON. El usuario confirma antes de poder iniciar sesión. Si
  intenta entrar sin confirmar, la web le ofrece **reenviar el correo**.
- **Secure email change:** ON (confirma en el correo viejo y en el nuevo).
- **Secure password change:** ON.
- **Minimum password length:** **8** (la web y la app exigen 8 en cuentas
  nuevas; las cuentas antiguas con 6 siguen entrando).

### SMTP propio (necesario en producción) — Resend

El SMTP incluido en Supabase solo envía unos pocos correos por hora y suele
caer en spam: con él, el registro y la recuperación se bloquean enseguida.

1. Crea una cuenta en [resend.com](https://resend.com) (plan gratis: ~3.000
   correos/mes, 100/día).
2. **Domains → Add domain**: añade tu dominio (p. ej. `wayio.app`) y crea en tu
   DNS los registros que te muestra (SPF/DKIM). Espera a que quede **Verified**.
3. **API Keys → Create API key** (permiso _Sending access_).
4. Supabase → **Authentication → Emails → SMTP Settings → Enable custom SMTP**:
   - Sender email: `no-reply@wayio.app` · Sender name: `Wayio`
   - Host: `smtp.resend.com` · Port: `465`
   - Username: `resend` · Password: la API key del paso 3
5. Supabase → **Authentication → Rate Limits**: sube "emails per hour" a lo
   que necesites (p. ej. 100).

La web añade además su propio límite por IP a login, registro, recuperación y
enlace mágico.

---

## 5. Google (login social)

El botón "Continuar con Google" ya está en la web. La vuelta usa el mismo
dominio desde el que el usuario pulsó el botón (no hace falta ninguna variable
de entorno extra).

1. [Google Cloud Console](https://console.cloud.google.com/) → crea (o elige)
   un proyecto.
2. **APIs y servicios → Pantalla de consentimiento de OAuth**: tipo _Externo_,
   nombre `Wayio`, correo de asistencia, logo opcional y, en **Dominios
   autorizados**, tu dominio (`wayio.app`). Publica la app (o añade usuarios de
   prueba mientras esté en modo prueba).
3. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de
   OAuth** → tipo **Aplicación web**:
   - **Orígenes de JavaScript autorizados:** `https://wayio.app` (y
     `http://localhost:3000` en el de desarrollo).
   - **URI de redireccionamiento autorizados:**
     `https://<TU_PROJECT_REF>.supabase.co/auth/v1/callback`
4. Copia el **ID de cliente** y el **Secreto**.
5. Supabase → **Authentication → Providers → Google:** actívalo y pega el
   Client ID y el Client Secret.

Flujo: `signInWithGoogle` → Google → Supabase → `/auth/callback?next=...` →
la página de la que venía el usuario (por ejemplo la invitación a un grupo).

---

## 6. App mobile (Expo) — deep linking

`mobile/app.json` ya declara `"scheme": "wayio"`, `ios.bundleIdentifier` y
`android.package` (`com.wayio.app`). Los deep links necesitan un **build de
desarrollo** (Expo Go no registra `wayio://`):

```bash
cd mobile
npx expo install expo-dev-client
npx expo run:android      # o: eas build --profile development
```

Cómo funciona cada flujo en la app:

- **Registro:** `signUp` pide `emailRedirectTo: wayio://auth/callback`. El
  correo abre `/auth/confirm` en la web, que lo pasa a `/auth/abrir-app`, y esa
  página abre la app con el token; la app llama a `verifyOtp` y entra sola. Si
  el correo se abre en un ordenador sin la app, el botón "continuar en la web"
  confirma la cuenta allí.
- **¿Olvidaste tu contraseña?:** la app envía el correo; la contraseña nueva se
  elige en la web (`/auth/nueva-clave`) y después se inicia sesión en la app.
- **Sin variables `EXPO_PUBLIC_SUPABASE_*`:** la app muestra "Configuración
  incompleta" en lugar de cerrarse.

---

## 7. Variables de entorno

### Web (`.env.local`)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...        # anon public
SUPABASE_SERVICE_ROLE_KEY=eyJ...            # service_role (solo backend)
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # en prod: https://wayio.app
```

`NEXT_PUBLIC_SITE_URL` ya no es necesaria (si existe, se acepta como
alternativa a `NEXT_PUBLIC_BASE_URL`).

### Mobile (`mobile/.env`)

```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...        # la MISMA anon key
EXPO_PUBLIC_API_URL=http://192.168.1.50:3000  # IP LAN del PC para endpoints IA
EXPO_PUBLIC_WEB_URL=https://wayio.app       # web pública (recuperar contraseña, pagos)
```

> En el móvil físico **no uses `localhost`** para `EXPO_PUBLIC_API_URL`: pon la
> IP de tu computadora en la red local.

---

## 8. Comprobación rápida

1. **Registro en otro dispositivo:** `/login` → Crear cuenta → abre el correo
   en el móvil → entra con la cuenta ya confirmada.
2. **Volver a donde estabas:** abre `/login?redirect=/group/<link>` → inicia
   sesión (con contraseña o con Google) → terminas en el grupo.
3. **¿Olvidaste tu contraseña?:** `/login` → enlace → email → abre el correo →
   `/auth/nueva-clave` → guarda una contraseña nueva (mínimo 8) → entra.
4. **Enlace mágico:** `/login` → escribe tu email → "Prefiero recibir un
   enlace por email" → abre el correo → entras sin contraseña.
5. **Mobile:** Crear cuenta en la app → abre el correo en el mismo teléfono →
   la app se abre con la sesión iniciada.
6. En Supabase → **Authentication → Users** aparece el usuario, y en **Table
   editor** hay una fila en `profiles`, una en `subscriptions` (`free`) y una
   en `referrals`.

---

## Problemas comunes

| Síntoma                                                   | Causa / solución                                                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| El correo lleva a la portada sin iniciar sesión           | No pegaste las plantillas de `templates/` en el panel (sección 3).                                |
| "El enlace no es válido o ya caducó"                      | Ya se usó (un solo uso), pasó más de 1 h, o un escáner de correo lo abrió antes. Pide otro.       |
| Tras Google acabas en la portada o en `/login?error=auth` | Falta tu dominio con `/**` en **Redirect URLs** (sección 2) o el Client ID/Secret no es correcto. |
| Google dice `redirect_uri_mismatch`                       | El URI en Google Cloud debe ser exactamente `https://<ref>.supabase.co/auth/v1/callback`.         |
| El correo no llega                                        | SMTP por defecto saturado → configura Resend (sección 4) y revisa spam.                           |
| "Todavía no confirmaste tu email"                         | `Confirm email` está ON y el usuario no confirmó. Usa "Reenviar el correo de confirmación".       |
| La app no se abre desde el correo                         | Falta `wayio://**` en Redirect URLs, o estás en Expo Go (usa un build de desarrollo, sección 6).  |
| App: "Configuración incompleta"                           | Falta `mobile/.env` con `EXPO_PUBLIC_SUPABASE_*` (sección 7). Reinicia Expo tras crearlo.         |
| No se crea `profiles`/`subscriptions`                     | No corriste el esquema o la migración de aprovisionamiento (sección 1).                           |
