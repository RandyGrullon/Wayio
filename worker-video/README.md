# Worker de video de Wayio

«Recrear un viaje desde un video» necesita **yt-dlp** (descargar el video) y **ffmpeg** (sacar fotogramas), y ninguno de los dos funciona en las funciones serverless de Vercel. Este worker es un contenedor pequeño que hace solo esa parte:

1. Recibe `POST /fotogramas` con la URL del video y un secreto compartido.
2. Valida la URL (YouTube, TikTok, Instagram, Vimeo o Facebook, sin IPs internas), descarga el video (≤720p, ≤10 min, ≤250 MB) y saca hasta 20 fotogramas JPG.
3. Devuelve los fotogramas en base64, el título y la duración.

**No tiene claves de IA.** La app web sigue haciendo el análisis con IA, así que la sesión, los límites por cuenta, el tope diario de gasto, el cupo del plan Gratis y el registro de costes (`ai_logs`) funcionan igual que siempre.

## Conectarlo a la app: dos variables en Vercel

| Variable              | Valor                                                                  |
| --------------------- | ---------------------------------------------------------------------- |
| `VIDEO_WORKER_URL`    | La URL pública del worker, p. ej. `https://wayio-video.up.railway.app` |
| `VIDEO_WORKER_SECRET` | El mismo secreto que pusiste en el worker (`openssl rand -hex 32`)     |

Con las dos, el modo video se activa solo, sin tocar nada más. Si en Vercel existe `VIDEO_ANALYSIS_ENABLED=false`, **bórrala**: `false` apaga el video aunque haya worker (sirve de interruptor de emergencia). Después de guardar las variables, haz _Redeploy_ en Vercel.

## Paso 0: genera el secreto

```bash
openssl rand -hex 32
# o, sin openssl:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Guárdalo en tu gestor de contraseñas: lo pegarás en el worker y en Vercel. Mínimo 16 caracteres (el worker no arranca sin él).

## Opción A: Railway (la más sencilla)

1. Entra en [railway.com](https://railway.com) → **New Project** → **Deploy from GitHub repo** → elige el repositorio de Wayio.
2. Abre el servicio que se crea → **Settings**:
   - **Source → Root Directory**: `/worker-video`
   - **Config-as-code → Railway Config File**: `/worker-video/railway.json` (con esto usa el `Dockerfile`, el _health check_ en `/salud` y solo redespliega cuando cambia `worker-video/`).
3. **Variables** → **New Variable**: `VIDEO_WORKER_SECRET` = tu secreto. Nada más es obligatorio.
4. **Settings → Networking → Generate Domain** (si pide puerto: `8080`). Copia el dominio.
5. Espera a que el despliegue quede en verde y comprueba: `curl https://TU-DOMINIO/salud` → `{"ok":true,...}`.
6. En Vercel pon `VIDEO_WORKER_URL=https://TU-DOMINIO` y `VIDEO_WORKER_SECRET` → **Redeploy**.

**Costo aproximado** (precios de Railway a finales de 2026; revísalos en su web): plan Hobby de **5 USD/mes, que incluye 5 USD de consumo**. El worker en reposo usa ~60-100 MB de RAM (≈1 USD/mes) y cada video son 10-90 s de CPU (céntimos al mes con poco uso), así que normalmente cabe en esos 5 USD. Opcional: **Settings → Serverless** para que duerma sin tráfico (el primer video tras dormir tarda unos segundos más).

## Opción B: Fly.io

1. Instala `flyctl` ([fly.io/docs/flyctl/install](https://fly.io/docs/flyctl/install/)) y entra: `fly auth login` (pide tarjeta).
2. Desde esta carpeta:
   ```bash
   cd worker-video
   fly launch --copy-config --no-deploy   # usa fly.toml; si «wayio-video» está cogido, elige otro nombre
   fly secrets set VIDEO_WORKER_SECRET=TU_SECRETO
   fly deploy
   ```
   No crees bases de datos ni Redis si `fly launch` lo ofrece.
3. Comprueba: `curl https://NOMBRE-APP.fly.dev/salud` → `{"ok":true,...}`.
4. En Vercel pon `VIDEO_WORKER_URL=https://NOMBRE-APP.fly.dev` y `VIDEO_WORKER_SECRET` → **Redeploy**.

**Costo aproximado** (revísalo en fly.io/pricing): una máquina `shared-cpu-1x` de 1 GB cuesta ≈5-6 USD/mes si estuviera encendida siempre, pero `fly.toml` la **apaga sin tráfico y la enciende con la siguiente petición**: pagas por segundo encendida más unos céntimos de disco, así que con poco uso suele quedar en **1-3 USD/mes**. El arranque en frío añade 2-5 s al primer video. La región es `iad` (Virginia), junto a las funciones de Vercel.

## Prueba rápida

```bash
curl -X POST https://TU-WORKER/fotogramas \
  -H "Authorization: Bearer TU_SECRETO" \
  -H "Content-Type: application/json" \
  -d '{"videoUrl":"https://www.youtube.com/watch?v=jNQXAC9IVRw","maxFotogramas":3}'
```

La respuesta empieza con algunos espacios (ver «Contrato») y termina con `{"ok":true,"titulo":"Me at the zoo","duracion":19,"fotogramas":[...]}`. Luego prueba desde la app: «Recrear desde un video» con un enlace público corto.

## Variables del worker

| Variable                    | Por defecto                                       | Para qué                                                                                                                         |
| --------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `VIDEO_WORKER_SECRET`       | — (obligatoria)                                   | Secreto compartido con la app (cabecera `Authorization: Bearer …`).                                                              |
| `PORT`                      | `8080`                                            | Puerto HTTP (Railway lo pone solo).                                                                                              |
| `MAX_TRABAJOS`              | `2`                                               | Videos a la vez. Más responde 503 `ocupado` y la app pide reintentar.                                                            |
| `MAX_DURACION_SEG`          | `600`                                             | Duración máxima (la app pide 600).                                                                                               |
| `MAX_FOTOGRAMAS`            | `20`                                              | Fotogramas máximos (la app pide 20).                                                                                             |
| `MAX_VIDEO_MB`              | `250`                                             | Peso máximo del video descargado.                                                                                                |
| `TIEMPO_MAX_MS`             | `240000`                                          | Tiempo máximo por video (la app manda el suyo, ≤230 s).                                                                          |
| `YTDLP_PROXY`               | —                                                 | Proxy para yt-dlp (p. ej. `http://usuario:clave@host:puerto`) si las plataformas bloquean la IP del servidor. Nunca se registra. |
| `YTDLP_AUTOACTUALIZAR`      | `true` en Docker                                  | `yt-dlp -U` al arrancar y cada 24 h cuando está libre.                                                                           |
| `YTDLP_JS_RUNTIMES`         | `node` en Docker                                  | Motor JS que yt-dlp usa para YouTube.                                                                                            |
| `FFMPEG_PATH`, `YTDLP_PATH` | `/usr/bin/ffmpeg`, `/opt/yt-dlp/yt-dlp` en Docker | Rutas de los binarios.                                                                                                           |

## Avisos importantes

- **Bloqueos de las plataformas.** YouTube, Instagram y TikTok bloquean a menudo las IPs de centros de datos (Railway, Fly): YouTube responde «Sign in to confirm you're not a bot». El worker lo devuelve como `descarga/bloqueado` y la app muestra «La plataforma no nos dejó descargar ese video ahora mismo…» (y lo manda a Sentry). Si pasa a menudo, la solución es `YTDLP_PROXY` con un proxy residencial (de pago). No se usan cookies de una cuenta a propósito: se arriesga la cuenta y los términos de uso.
- **Instagram** pide iniciar sesión para muchos reels: esos fallan como «privado».
- **yt-dlp envejece rápido.** Se actualiza solo; si algo deja de funcionar de golpe, un _redeploy_ trae la última versión.
- **Seguridad:** sin el secreto todo responde 401; solo dominios de la lista (la misma que `src/lib/ai/analyzeVideo.ts`, lo comprueba `npm test`), DNS solo hacia IPs públicas, yt-dlp sin el extractor genérico ni configuración del sistema, límites de duración, peso, tiempo y concurrencia, el contenedor corre sin root y los temporales se borran siempre. Los logs (JSON por línea) guardan el host del video y, si falla, el final del error de yt-dlp (que puede incluir el id o la URL del video); nunca el secreto ni el proxy.

## Contrato HTTP

- `GET /salud` → `200 {"ok":true,"ytDlp":"2026.10.26","ffmpeg":"ffmpeg version …","enCurso":0,"maxTrabajos":2}` (503 si falta alguna herramienta). No pide secreto.
- `POST /fotogramas` con `Authorization: Bearer <VIDEO_WORKER_SECRET>` y `{"videoUrl": "...", "maxFotogramas"?: 20, "maxDuracionSeg"?: 600, "tiempoMaxMs"?: 230000}`.
  - Errores antes de empezar, con su status: `401 no_autorizado`, `400 bad_request`, `400 url_no_valida`, `400 url_no_permitida`, `422 descarga/dns`, `503 ocupado` (con `Retry-After`).
  - Después responde **200 enseguida** y manda un espacio cada 10 s mientras trabaja (JSON admite espacios iniciales; así ningún proxy corta la conexión por inactividad). El cuerpo termina en `{"ok":true,"titulo","duracion","fotogramas":[{"data","mediaType":"image/jpeg"}],"ms"}` o en `{"ok":false,"code","motivo","error","detalle"?}`.
  - `code` usa los códigos de la app (`descarga`, `muy_largo`, `sin_fotogramas`, `herramientas`, `url_no_permitida`…) y `motivo` afina el mensaje (`privado`, `bloqueado`, `no_disponible`, `directo`, `tiempo`, `pesado`, `duracion`…). Los textos para el usuario los pone la app.

## Desarrollo

Sin dependencias npm: solo Node ≥ 20.3.

```bash
cd worker-video
npm test                                   # pruebas (sin red)

# Con Docker:
docker build -t wayio-video .
docker run --rm -p 8080:8080 -e VIDEO_WORKER_SECRET=un-secreto-de-pruebas-123 wayio-video

# Sin Docker (con yt-dlp y ffmpeg instalados):
VIDEO_WORKER_SECRET=un-secreto-de-pruebas-123 YTDLP_JS_RUNTIMES=node npm start
```

Para probar la app contra un worker local: `VIDEO_WORKER_URL=http://localhost:8080` (en local se admite `http://`; en producción debe ser `https://`) y el mismo `VIDEO_WORKER_SECRET` en `.env.local`.
