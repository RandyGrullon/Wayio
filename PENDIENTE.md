# Wayio — estado y pasos para terminar

> Actualizado el 2026-10-20 (planes Gratis y Pro aplicados en el servidor); el 2026-10-17 (freno al gasto de IA, y geocodificación y rutas con Geoapify); antes, el 2026-10-09, tras el análisis completo, la reconstrucción de la IA, los arreglos de seguridad, el rediseño y la integración final. Los detalles de cada servicio están en [API-KEYS-GUIA.md](API-KEYS-GUIA.md).

## ✅ Planes Gratis y Pro en el servidor (rama `feat/planes-rentabilidad`, 2026-10-20)

- **Gratis exige cuenta y trae un cupo mensual** (`CUPO_GRATIS` en `src/constants/planes.ts`): 2 viajes, 5 ajustes con IA y 3 fotos o videos, por mes natural de RD (se renueva el día 1 a las 00:00 de RD). Lo aplica `src/lib/planes/cupo.ts` en `/api/generate`, `/api/generate/stream`, `/api/adjust` y `/api/analyze-video`, siempre después de la sesión, los límites por cuenta y el tope diario, y antes de gastar IA. Agotado: **402** `{ error, code: 'cupo_agotado', accion, usados, limite, renueva }` con un mensaje como «Usaste tus 2 viajes gratis de este mes. Se renuevan el 1 de noviembre. Con Pro trazas sin límite.» (en el stream, antes de abrirlo).
- **No gastan cupo**: lo que sale de la caché o del modo demo, ni lo que falla, se trunca o se cancela (la unidad se devuelve). Con el cupo agotado, un viaje que ya está en la caché sale igual. «Otra versión» y «Reintentar» cuentan como un viaje nuevo.
- **Pro** (`pro_mensual`, `pro_anual` y el **Pase Pro de 30 días**, antes «Pro por viaje») es IA sin límite con uso justo (los topes por hora y día de `aiGuard.ts`). Su uso se cuenta igual, con un límite enorme, para que el admin vea conteos reales. `pro_grupo` incluye todo lo de Pro.
- **Solo Pro**: alertas con IA (`/api/alert-message` responde en Gratis el mensaje local, `fuente: 'local'`) y reagendar con IA (`/api/reschedule` responde en Gratis 503 `ia_no_disponible` con `motivo: 'requiere_pro'` y los huecos libres, el mismo camino manual que sin IA). Interpretar y validar no cambian.
- **`GET /api/cupo`** (cookie o Bearer): `{ tier, cupos: { generar, ajustar, analizar: { usados, limite } } | null, renueva, aproximado? }`; `cupos` es null en Pro.
- **Checkout**: un plan que no está en `PLANES_A_LA_VENTA` responde 400 `plan_no_disponible`. `pro_grupo` queda oculto de la venta; sus suscriptores conservan el acceso, el portal y el webhook.
- **Falla abierta**: si no se puede leer el plan o contar el uso (sin service role, migración sin aplicar, error de red), deja pasar y avisa en consola y Sentry (`area: planes-cupo`) como mucho una vez por hora por instancia.
- Migración `20261017130000_cupos_y_rentabilidad.sql`: tabla `usage_counters` (el usuario solo lee sus filas), RPC `consumir_cupo` y `devolver_cupo` (solo service role, atómicas), tabla privada `admin_private_settings` (para la calculadora del admin) e índice `idx_ai_logs_user_created`. Replicada en `supabase/schema.sql` y comprobada por `npm run verificar` («Migración 5»).

## ✅ Freno al gasto de IA (rama `feat/tope-gasto-ia`, 2026-10-17)

- **Sesión obligatoria** para generar (`/api/generate` y `/stream`), ajustar con IA y analizar fotos o videos (401 `auth_required`). Interpretar y validar siguen abiertos con límite por IP. El modelo por defecto no cambia (Opus 5.5).
- **Límites por cuenta** por hora y por día, siempre activos en producción (en desarrollo con `RATE_LIMIT_ENFORCE=true`): generar 6/h y 20/día, ajustar 20/h y 60/día, foto 10/h y 20/día, video 5/h y 10/día, interpretar 20/h sin cuenta y 60/h con ella. El 429 trae `code: 'rate_limit'`, `retryAfter` y un mensaje con la espera real.
- **Tope global diario** `AI_DAILY_BUDGET_USD` (día natural de RD, coste estimado de `ai_logs` vía la RPC `ai_gasto_desde`, caché de 30 s por instancia más el gasto local aún sin registrar). Al llegar: 429 `tope_diario` en generar, interpretar y analizar; ajustar y reagendar pasan a edición manual (503 `ia_no_disponible`, `motivo: 'tope_diario'`); validar y alertas usan sus reglas locales. Corte duro al 125 % dentro de `aiGenerate`. Si no puede leer el gasto, deja pasar y avisa (consola y Sentry, una vez por hora). Aviso en Sentry al alcanzar el tope (una vez por día).
- Cuerpos de `/api/generate` y `/stream` con tope de 64 KB; precios de `claude-opus-4-8` y `claude-fable-5-1` (destinos del _fallback_) para que no se registren a 0.
- Admin: tarjeta «Tope diario de IA» en `/admin/ai` y fila en «Estado del entorno».

## ✅ Hecho en esta ronda (rama `rediseno-ui-ia`)

**IA: generación fiable con cualquier descripción**

- Nuevo campo de **descripción libre** («cuéntanos tu viaje ideal») y `POST /api/interpret`: convierte un texto como «Japón 10 días en abril con mi esposa, 6000 dólares» en los campos del formulario y pregunta solo lo que falta.
- **Salida estructurada** (JSON garantizado por esquema) en vez de texto que había que «reparar». Validación y normalización de todo lo que devuelve el modelo: ids únicos, horas sin solapes, números válidos y coordenadas lejanas descartadas.
- **Viajes largos**: primero un esqueleto (ciudades por día, hoteles por paquete y presupuesto) y después bloques de 2 días generados **en paralelo**. Antes, con `max_tokens=4096`, los viajes de más de unos 3 días se truncaban y caían en silencio al demo de Tokio.
- **Errores honestos**: si la IA falla, el usuario ve un error con «Reintentar». Solo se muestra el ejemplo cuando la instalación no tiene IA.
- **Contexto real**: pronóstico de las fechas si el viaje empieza en ≤ 5 días, geocoding con límite global y caché, coordenadas verificadas y tiempos de traslado estimados sin APIs de pago.
- **Presupuesto**: vuelo estimado aparte, aviso automático si el plan se sale del presupuesto, paquetes básico/confort/premium que cambian de verdad hoteles, restaurantes y experiencias, y moneda guardada en el viaje.
- **Modelos y SDK**: `claude-opus-5-5` (itinerario) y `claude-haiku-5-5` (tareas rápidas), streaming, `effort`, _fallback_ ante rechazos, SDK 0.128 y modelos de Groq vigentes. Registro de uso por endpoint y usuario en `ai_logs`.
- **Rutas de IA secundarias**: ajuste por chat que conserva el progreso del viaje, reagendado con huecos reales, validación sin el _polling_ de 30 s que costaba dinero, alertas sin «proxy abierto» y video con anti-SSRF y _feature flag_.
- **Batería de evaluación**: `npm run eval:ia` (44 viajes muy distintos + 6 textos libres, validaciones automáticas y juez opcional).

**Seguridad y datos** (migración `supabase/migrations/20261008120000_seguridad_y_flujos.sql`, probada en Postgres real)

- Cerrado: cualquier usuario podía **hacerse admin**; el chat, los gastos y el GPS de **todos los grupos** eran legibles por cualquier usuario registrado.
- Funcionan ahora: **compartir viaje** (público solo si el dueño lo marca), **unirse a un grupo** por enlace, realtime de grupos, referidos, registro de dispositivos y estados del modo en vivo.
- Stripe: el webhook ya activa los planes (antes RLS bloqueaba todo) y es idempotente; el checkout calcula importes en el servidor; el «Pro por viaje» caduca; el depósito de reserva queda **desactivado** a propósito.
- Auth: recuperación de contraseña, enlace mágico, confirmación que funciona en cualquier dispositivo, `?redirect` respetado y open redirects cerrados. Google OAuth ya no redirige a localhost en producción.
- Admin: `requireAdmin` en cada consulta; revocar un plan lo cancela en Stripe; el MRR solo cuenta pagos reales.
- Plataforma:
  - rate limit en todas las rutas de IA y búsqueda;
  - Sentry y PostHog completos y seguros sin keys;
  - el service worker ya no cachea respuestas privadas;
  - `robots.txt`, sitemap correcto, afiliados por variables de entorno y enlaces de navegación universales.
- Amadeus (cerrado) y la API legacy de Booking se retiraron; Viator se reescribió con su API v2.

**Rediseño completo «Cuaderno de Ruta»** ([docs/DISENO.md](docs/DISENO.md))

- Nuevo sistema visual:
  - tinta azul noche y acento Rosa de Bayahíbe;
  - Newsreader e Instrument Sans;
  - AA verificado en claro y oscuro (252 pares de contraste comprobados).
- **Logo nuevo**: «wayio» monolínea, donde la w es la ruta y el punto de la i es el destino.
- **Animación de entrada «La ruta llega»**: el punto traza la w, vuela, aterriza en la i y el logo viaja al header con un portal circular. Es CSS servido en SSR, así que no penaliza la carga, y se puede saltar.
- Iconos, imagen OG y assets de la app móvil regenerados.
- Pantallas rehechas: landing, planificador por pasos, carga con progreso real, comparador de versiones, itinerario, viaje en vivo, compartido, grupo, auth, mis viajes, cuenta, precios, SEO, admin y app móvil.

**Mapa «carta de ruta»**

- Estilo propio sobre OpenFreeMap (paleta de la carta en claro y oscuro), marcadores numerados con aro de origen, etiqueta «hora · nombre», fichas sin HTML inyectable y flechas del sentido del recorrido.
- **Rutas exactas por calles** (`POST /api/ruta`, OSRM sobre OpenStreetMap): a pie hasta 1,6 km y en carro hasta 250 km; por mar o aire, un arco. Con caché en el servidor y en la sesión, y arcos si el servicio no responde.
- Gestos libres (arrastrar, deslizar, pellizcar, rueda) sin rotación accidental. En el móvil, dentro de una página, se mueve con dos dedos para que uno haga scroll; en pantalla completa queda libre.
- Pantalla completa, «Ajustar vista», mostrar/ocultar rutas y, en la sala de grupo, avatares-pin de los miembros en su última ubicación.

**Cierre de integración (2026-10-09)**

- `/?destino=` redirige con un 307 real a `/planificar` y la landing es estática; los destinos inexistentes dan un 404 real.
- Cabecera con «Cuenta», cierre de sesión que también reinicia la analítica, «Planes y precios» en el pie, sitemap con las páginas legales y `robots.txt` que deja a WhatsApp y X leer las tarjetas de los viajes compartidos.
- Toasts que nunca tapan barras ni el botón «Ajustar con IA», errores por campo y espera real (429) en la generación, reserva desde el planificador cuando el viaje ya está guardado y reagendado que mueve la actividad al día propuesto.
- Admin: errores reales con «Reintentar», rango 7/30/90 días, conteos en todos los filtros, presupuestos y gastos en su moneda, uso de IA por usuario, anuncios programados, valor JSON de las flags, mensajes de error en español y días en hora de RD.
- App móvil: tipos al día con la web, formatos es-DO en toda la app, tiempo límite en todas las peticiones, cierre de sesión que borra los datos del modo en vivo y README/AGENTS de SDK 54.
- Limpieza: 21 módulos web que ya nadie usaba (alertas, rastreador y paywall antiguos), `Loader3D` y dos componentes móviles; respaldo en el scratchpad de la sesión.
- Verificado: `tsc` y ESLint sin errores ni avisos (web y móvil), Prettier, `next build` correcto (90 páginas) y QA en Chromium a 1440 px claro y 390 px oscuro sin errores de consola en producción.

**Geocoding y rutas aptos para cobrar (rama `feat/geo-comercial`, 2026-10-17)**

- Con `GEOAPIFY_API_KEY` la geocodificación y las rutas por calles van por **Geoapify** (uso comercial, plan Free de 3000 créditos/día). Sin la clave todo sigue exactamente como antes (Nominatim + OSRM de FOSSGIS).
- Clave solo en el servidor (cabecera `x-api-key`), limitador de 4 peticiones/s por instancia (`GEOAPIFY_RPS`) con 8 s de espera máxima en cola, un reintento ante 429 por ritmo/5xx (no ante cuota agotada) y caché persistente de 30 días entre instancias que no guarda los fallos transitorios. Con cualquiera de los dos proveedores, un fallo pasajero ya no deja un «sin resultados» cacheado 7 días.
- Gasto acotado: presupuesto diario global de créditos (`GEOAPIFY_CREDITOS_DIA`, 3000 por defecto, en Upstash), límites de créditos por IP en `/api/ruta` y `/api/geocode`, corte de un minuto tras clave no válida o cuota agotada, rutas cacheadas tramo a tramo (no se vuelven a cobrar al reabrir o editar un viaje) y el mapa del planificador espera a que terminen las coordenadas de fondo antes de pedir rutas.
- Las actividades descartan siempre los aciertos gruesos (la ciudad entera en vez del lugar), haya ciudad de referencia o no, y la fase de coordenadas del itinerario geocodifica 4 a la vez.
- Mapa web: «Powered by Geoapify» en los créditos cuando hay clave (el de OpenStreetMap ya lo trae OpenFreeMap) y caché de rutas de la sesión renovada (`wayio:rutas:v2`). App móvil: enlace «Powered by Geoapify» sobre el mapa (se oculta con `EXPO_PUBLIC_GEO_PROVEEDOR=osm`). Privacidad y guía actualizadas.

## 🔴 Lo que tienes que hacer tú (en este orden)

1. **IA**: pon `ANTHROPIC_API_KEY` en `.env.local`, arranca `npm run dev` y ejecuta `npm run eval:ia -- --base http://localhost:3000 --interpret`. Todos los casos deberían salir sin errores (ver el informe en `scripts/eval-ia/resultados/`). Generar exige sesión: con Supabase configurado, pon `EVAL_IA_BEARER` con el access_token de una cuenta de pruebas.
2. **Supabase**:
   - restaura el proyecto si está pausado;
   - en el SQL Editor, pega y ejecuta `supabase/migrations/20261008120000_seguridad_y_flujos.sql`, después `supabase/migrations/20261017120000_ai_gasto_diario.sql` (RPC del tope diario de IA; sin ella el tope queda abierto) y por último `supabase/migrations/20261017130000_cupos_y_rentabilidad.sql` (cupos del plan Gratis y ajustes privados del admin; sin ella los cupos quedan abiertos y la calculadora del admin no puede guardar);
   - revisa los admins y comprueba realtime;
   - configura Auth (URLs, plantillas de correo, SMTP y Google), guía en `supabase/CONFIGURACION-AUTH.md`.
3. **Upstash Redis** (gratis): `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`, para que los límites de uso protejan tu factura de IA en producción (sin Upstash cada instancia cuenta por su lado).
4. **Vercel**:
   - variables de `.env.example`, con `NEXT_PUBLIC_BASE_URL` igual a tu dominio y `NEXT_PUBLIC_CONTACT_EMAIL` con tu email público (sin él, `/contacto` dice que el canal llega pronto);
   - **`AI_DAILY_BUDGET_USD`** (p. ej. `25`) y las dos variables de **Upstash**; comprueba con `npm run verificar` que salen OK el tope, las migraciones 4 y 5 y Upstash;
   - **`WAYIO_OWNER_EMAILS`** con tu correo (el de tu cuenta admin; varios separados por comas). Solo servidor, nunca `NEXT_PUBLIC_`. Es quien ve la calculadora de rentabilidad del admin; sin ella, cualquier admin la ve;
   - como red final, un **límite de gasto mensual** en la consola de Anthropic (Settings → Limits);
   - **Fluid Compute activado**, porque las rutas de IA usan hasta 300 s;
   - **`GEOAPIFY_API_KEY`** (gratis en myprojects.geoapify.com, sin tarjeta; guía en la sección 4 de [API-KEYS-GUIA.md](API-KEYS-GUIA.md)) y vuelve a desplegar para que salgan los créditos de Geoapify en el mapa. Con Upstash configurado el presupuesto diario (`GEOAPIFY_CREDITOS_DIA`) es global; sin él, por instancia. Después, `npm run verificar` en local con la misma clave;
   - **antes de poner la clave**, publica una build de la app móvil con el enlace «Powered by Geoapify» del mapa (ya está en el código; el plan Free lo exige porque la app muestra coordenadas de Geoapify). Las builds anteriores no lo tienen;
   - borra `AMADEUS_*`, `BOOKING_API_KEY` y `NEXT_PUBLIC_SITE_URL`.
5. **Afiliados** (es donde ganas dinero sin cobrar al usuario): Viator Partner (`VIATOR_API_KEY`, `PID`, `MCID`), Booking vía Awin/CJ, Travelpayouts o Skyscanner, y Airalo. Después de desplegar, haz un clic de prueba en cada panel de afiliado.
6. **Cobros** (solo si vas a cobrar):
   - primero decide con qué entidad: Stripe no opera con comercios en RD, así que necesitarías una LLC en EE. UU., Paddle o Lemon Squeezy;
   - después crea productos, webhook y Customer Portal según la guía.
7. **PostHog y Sentry** (opcional): las claves de la guía.
8. **App móvil**:
   - `cd mobile && npx expo install expo-dev-client expo-system-ui`;
   - crea `mobile/.env` con las `EXPO_PUBLIC_*`;
   - genera un _development build_ con `npx expo run:android` o `eas build --profile development`. Expo Go ya no sirve para este proyecto.
9. **Pruebas finales con 2 cuentas** (checklist):
   - B no puede hacerse admin;
   - B no ve el grupo de A hasta abrir el enlace, y después el chat llega en vivo;
   - un visitante sin sesión ve `/viaje-compartido/<id>` solo si A lo hizo público;
   - el pago de prueba con la tarjeta 4242 cambia el plan;
   - con una cuenta Gratis, el tercer viaje del mes da el aviso de cupo agotado (402) y `GET /api/cupo` lo refleja; con Pro, no;
   - la recuperación de contraseña funciona de punta a punta;
   - en el móvil: crear cuenta, generar, guardar y modo en vivo.

## 🟡 Decisiones de producto pendientes

- **Valores del cupo Gratis**: decididos (2 viajes, 5 ajustes, 3 fotos o videos al mes) y aplicados en el servidor desde la rama `feat/planes-rentabilidad`. Revísalos con los conteos reales de `usage_counters` (se cuentan todos los planes) y cámbialos en `CUPO_GRATIS` (`src/constants/planes.ts`).
- **Modelo del itinerario**: sigue `claude-opus-5-5` ($4/$20 por millón). `AI_ITINERARY_MODEL=claude-sonnet-5-5` lo abarata a la mitad; es decisión tuya, el tope diario no lo cambia.
- **Valores de los límites y del tope**: los de ahora son para la beta (`src/lib/security/aiGuard.ts` y `AI_DAILY_BUDGET_USD`). Revísalos con el gasto real de `/admin/ai`.
- **Reservas con depósito**: desactivadas (`NEXT_PUBLIC_RESERVAS_ENABLED=false`) hasta que haya un proveedor real de reservas y una revisión legal.
- **Precios reales de vuelos y hoteles**: hoy son enlaces de afiliado con fechas. Para precios en la app: Duffel o Travelpayouts (vuelos) y LiteAPI (hoteles).
- **Video de TikTok/Instagram**: no funciona en Vercel serverless (necesita ffmpeg y yt-dlp). Muévelo a un worker en contenedor (Railway, Fly.io o Cloud Run) o déjalo desactivado.
- **Feature flags y modo mantenimiento del admin**: se guardan pero nadie los lee todavía.
- **Geocoding y rutas**: la migración a Geoapify está hecha en código; falta poner `GEOAPIFY_API_KEY` en Vercel (ver arriba). Vigila los créditos diarios en su panel y pasa al plan API 10 (US$59/mes) si te acercas de forma sostenida a los 3000 del plan Free (y entonces sube `GEOAPIFY_CREDITOS_DIA`, que por defecto corta en 3000).
- **Gastos del grupo**: hoy siempre paga quien lo registra y se reparte entre todos. «Pagó» y «Entre quiénes» necesitan columnas nuevas y cambios en la API.
- **Páginas legales** (`/privacidad`, `/terminos`): son un borrador (edad mínima, conservación de datos, nombre del responsable); revísalas con un abogado.

## 🧹 Deuda técnica conocida

- Quitar los alias `TEMPORAL` de colores de `globals.css` cuando ninguna pantalla los use (spec §2.2).
- Probar en dispositivo (no había emulador): la intro móvil, los hápticos, el teclado sobre las hojas en Android y el modo en vivo en segundo plano.
- Revisar en un Android de gama baja la intro y el mapa.
- Mapa: falta la animación de 600 ms del trazo al cambiar de día (§7.4); el día activo ya se resalta con línea más gruesa y los demás atenuados.
- En `next dev`, mientras el servidor recompila, la consola puede mostrar un «SyntaxError: Invalid or unexpected token» de un hot-update; no ocurre en producción (verificado con `next build` + `next start`).
