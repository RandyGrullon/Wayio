# Panel de administración de Wayio

Panel completo en `/admin` para controlar el backend que comparten la web y la
app mobile (Supabase + API routes).

## Activación (3 pasos)

### 1. Crear las tablas y aplicar la seguridad

Si el proyecto ya tenía el esquema, pega
`supabase/migrations/20261008120000_seguridad_y_flujos.sql` completo en
**Supabase → SQL Editor → Run**. Si está vacío, pega `supabase/schema.sql` (ya
la incluye). Ambos son idempotentes.

> ⚠️ Esa migración cierra un hueco crítico: antes cualquier usuario podía
> hacerse admin editando su propio perfil desde el navegador. Después de
> aplicarla, revisa `select id, email from public.profiles where role = 'admin';`.

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

| Sección       | Ruta                   | Qué hace                                                                                                         |
| ------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Dashboard     | `/admin`               | Métricas: usuarios, viajes, MRR, costo de IA, gráficas                                                           |
| Usuarios      | `/admin/users`         | Buscar, ver detalle, cambiar rol, banear, otorgar/revocar plan, eliminar                                         |
| Viajes        | `/admin/trips`         | Listar/filtrar, ver itinerario+grupo, cambiar estado, borrar                                                     |
| Suscripciones | `/admin/subscriptions` | MRR/ARR (solo planes cobrados en Stripe; los concedidos a mano se marcan «Concedido» y no cuentan), tiers, lista |
| Grupos        | `/admin/groups`        | Moderar mensajes y gastos de los viajes en grupo                                                                 |
| Referidos     | `/admin/referrals`     | Códigos, conversiones, leaderboard                                                                               |
| Uso de IA     | `/admin/ai`            | Tokens, costo, latencia y éxito por proveedor/modelo; gasto de hoy frente al tope diario                         |
| Rentabilidad  | `/admin/rentabilidad`  | **Solo el dueño** (`WAYIO_OWNER_EMAILS`): ingresos netos, IA por acción y usuario, fijos y equilibrio            |
| Feature Flags | `/admin/flags`         | Guardar flags por plataforma (⚠️ la web y la app aún no las leen: ver abajo)                                     |
| Anuncios      | `/admin/announcements` | Publicar banners para web y mobile                                                                               |
| Auditoría     | `/admin/audit`         | Registro de todas las acciones de admin                                                                          |
| Settings      | `/admin/settings`      | Modo mantenimiento (⚠️ aún no lo lee nadie) y proveedor de IA (⚠️ manda la variable `AI_PROVIDER` del servidor)  |

> Pendiente de producto: hoy solo los **anuncios** tienen efecto real. Las flags,
> el modo mantenimiento y el selector de proveedor de IA se guardan pero ni la
> web ni la app los consultan todavía (hace falta un hook `useRemoteConfig` en
> cada cliente y que `src/lib/ai/config.ts` lea `app_settings`).

## Rentabilidad (solo el dueño)

`/admin/rentabilidad` es una calculadora para saber si Wayio gana o pierde
dinero y cuánto. El cliente nunca ve nada de esto y los demás admins tampoco:

- **Quién la ve**: los correos de `WAYIO_OWNER_EMAILS` (variable SOLO de
  servidor, separados por coma, sin distinguir mayúsculas). Si la variable está
  vacía o no existe, **cualquier admin cuenta como dueño** (para no dejar la
  sección inaccesible en un despliegue sin configurar): defínela en producción.
  La página, su consulta y su server action lo comprueban en el servidor
  (`requireOwner` en `src/lib/admin/dueno.ts`); a otro admin le responde 404 y
  el ítem «Rentabilidad» no aparece en su menú ni en la búsqueda ⌘K.
- **Datos reales** (marcados «real»): `ai_logs` del mes en curso de RD y de
  los últimos 30 días (costo por acción con media y p90, costo por tipo de
  usuario, recalculado desde los tokens con Opus, Sonnet, Haiku y Groq),
  usuarios activos aproximados (con IA o con un viaje creado o editado; sin
  admins), suscripciones cobradas, pases vigentes y planes concedidos, y
  `usage_counters` (acciones por usuario y mes) si existe.
- **Supuestos** (marcados «supuesto»): comisiones por canal (Creem, Paddle,
  Dodo, PayPal RD, Stripe con LLC) y de las tiendas, costos fijos, conversión,
  usuarios activos proyectados, mezcla de planes, modelo, perfil de uso, cupo
  gratis, afiliados e impuestos (a confirmar con un contador). Los valores por
  defecto salen del informe «Wayio IA cobros y servicios gratis» y viven en
  `src/lib/admin/rentabilidad/supuestos.ts` (`server-only`). Al guardarlos van
  a la tabla PRIVADA `admin_private_settings` (clave
  `rentabilidad_supuestos`; solo service role), nunca a `app_settings`, que es
  de lectura pública. La auditoría guarda solo los nombres de los campos
  cambiados.
- **Requiere** la migración `20261017130000_cupos_y_rentabilidad.sql`
  (`usage_counters` y `admin_private_settings`). Sin ella la página funciona
  con los supuestos por defecto, avisa y no deja guardar.
- **Aproximaciones**: `ai_logs` no guarda un id de acción, así que una
  generación o una foto son sus llamadas de la misma persona a menos de 90 s;
  el plan de cada persona es el efectivo de hoy; con Groq gratis el costo real
  es 0 (se usa su tarifa de pago); recalcular tokens con otro modelo es
  orientativo. Lee hasta 50.000 filas por tabla y avisa si llega al tope.

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

Cada llamada a la IA (web y mobile, vía `aiGenerate` en `src/lib/ai/client.ts`)
se registra automáticamente en `ai_logs` con proveedor, modelo, endpoint
(`generate`, `generate:bloque`, `interpret`, `adjust`…), usuario, tokens, costo
estimado (`src/lib/ai/pricing.ts`) y latencia. Los truncamientos
(`max_tokens`) quedan como `success=false` con error `max_tokens`. Requiere la
service role key; aparece en `/admin/ai`.

### Tope diario de gasto

`AI_DAILY_BUDGET_USD` (variable del servidor, en USD; no es secreta) pone un
techo GLOBAL al gasto de IA de cada día. La lógica está en
`src/lib/ai/presupuesto.ts`:

- **Día**: el natural de RD (America/Santo_Domingo, UTC-4 fijo). Se reinicia a
  las 12:00 a. m. de RD, igual que el «Costo diario» del panel.
- **Gasto de hoy**: `sum(ai_logs.cost_usd)` desde las 00:00 de RD con la RPC
  `ai_gasto_desde` (migración `20261017120000_ai_gasto_diario.sql`, solo
  service role), cacheado 30 s por instancia. Como las filas se escriben al
  terminar cada respuesta (`after()`), cada instancia suma además el coste de
  sus llamadas ya terminadas que la BD todavía no tiene.
- **Al llegar al tope** (1 ×): generar, interpretar y analizar responden 429
  `tope_diario` con `retryAfter` hasta la medianoche de RD; ajustar y
  reagendar responden 503 `ia_no_disponible` con `motivo: 'tope_diario'`
  (el cliente ofrece editar a mano); validar devuelve `ia.estado:
'no_disponible'` y las alertas el mensaje local. El modo demo (sin IA) y
  los viajes que ya están en la caché siguen saliendo.
- **Corte duro** (1,25 ×): `aiGenerate` deja de llamar al proveedor aunque la
  ruta ya hubiera pasado la comprobación (generaciones largas o concurrentes).
- **Si no se puede leer el gasto** (sin service role, sin la RPC, red): falla
  ABIERTO y avisa con `console.warn` y Sentry (`area: ai-presupuesto`), como
  mucho una vez por hora por instancia. Al alcanzar el tope hay un aviso en
  Sentry por día.
- **Es una estimación**: precios de `pricing.ts` (con la tarifa de más de 100K
  tokens de Haiku 5.5 y, si un modelo no tiene precio, el más alto conocido de
  su familia, con aviso en Sentry para añadirlo). Las llamadas abortadas,
  cortadas por timeout o rechazadas también se facturan y se registran con un
  coste estimado prudente (entrada real o estimada y salida acotada por el
  tiempo transcurrido); con fallback del servidor se suman todos los intentos.
  Con Groq gratis el coste es el de su tarifa de pago. Lo que Vercel corta por
  `maxDuration` no llega a registrarse. Como red final, pon un límite de gasto
  mensual en la consola de Anthropic.

La tarjeta «Tope diario de IA» de `/admin/ai` compara la última barra del
«Costo diario» (hoy) con el tope: sin tope, dentro, cerca (≥ 80 %) o agotado.
«Estado del entorno» (`/admin/settings`) muestra si está configurado y el
monto. Los límites por cuenta (por hora y por día) están en
`src/lib/security/aiGuard.ts`.
