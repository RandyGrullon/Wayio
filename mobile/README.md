# Wayio Mobile

App móvil (Expo SDK 54 + React Native 0.81, TypeScript) de Wayio. Es la
migración completa de la web: planificación con IA, viajes guardados, sala
grupal (chat/votos/gastos), modo en vivo con GPS + geofencing + alertas, y
paywall Pro.

Documentación de Expo de esta versión (no la de la última):
https://docs.expo.dev/versions/v54.0.0/

## Arquitectura

- **Supabase (directo)** → auth, viajes, grupos, suscripción y realtime. El
  móvil guarda la sesión en `AsyncStorage` (no usa cookies como la web).
- **Backend web (Next.js)** → IA (`/api/generate[/stream]`, `/api/adjust`,
  `/api/reschedule`, `/api/validate`, `/api/interpret`, `/api/analyze-video`),
  búsquedas (`/api/hotels`, `/api/activities`, `/api/flights`) y Stripe. Todas
  las llamadas llevan `Authorization: Bearer <access_token>` de Supabase
  (`src/lib/api/http.ts`, con tiempo límite de 60 s; 300 s en la IA larga).
- **Stripe** → `POST /api/stripe/checkout` con el Bearer y el pago se abre en
  el navegador seguro de la app (`expo-web-browser`).

```
src/
  config.ts                 variables EXPO_PUBLIC_* (API, web, Supabase, Mapbox, reservas)
  context/AuthContext.tsx   sesión + plan Pro; al salir limpia el modo en vivo
  navigation/               navegador ligero por pila (sin deps nativas)
  lib/api                   http (Bearer + timeout), backend IA, búsquedas, SSE (stream.ts)
  lib/utils/formatters.ts   formatos es-DO (fechas, horas, moneda) sin Intl
  lib/trips|geofencing      repositorio, conversor al modelo en vivo, motor de alertas
  hooks/ tasks/             grupo realtime, geofencing, sync offline, ubicación en 2.º plano
  screens/ components/      pantallas, ui/ (sistema «Cuaderno de Ruta»), trip/, alerts/
```

## Configuración

1. Copia `.env.example` a `.env` y rellena las variables. En un teléfono
   físico, `EXPO_PUBLIC_API_URL` debe ser la IP LAN de tu PC
   (ej. `http://192.168.1.50:3000`), no `localhost`.
2. `EXPO_PUBLIC_RESERVAS_ENABLED=false` por defecto: con `true` aparece
   «Reservar con depósito (15 %)» (requiere `NEXT_PUBLIC_RESERVAS_ENABLED=true`
   en el servidor; si no, el checkout responde 403).
3. `npm install`

## Desarrollo (dev build)

La app usa módulos nativos que **no** vienen en Expo Go o que cambiaron:
`@rnmapbox/maps`, `react-native-svg`, `react-native-safe-area-context`,
`expo-splash-screen`, `expo-system-ui`, `expo-font`, `expo-dev-client`, además
de `expo-location` en segundo plano y notificaciones. Cada vez que se añade o
actualiza uno hay que **recompilar el dev build** (EAS o local):

```bash
npx expo run:android          # o run:ios (requiere Mac + Xcode)
```

(O con EAS Build y un perfil de desarrollo; el repo aún no trae `eas.json`.)

Luego, para iterar: `npx expo start` (o `npm start`). Con `expo-dev-client`
instalado abre el **dev build por defecto**; pulsa `s` para cambiar a Expo Go
(sin mapa ni ubicación en segundo plano).

Las fuentes (Newsreader, Instrument Sans, Geist Mono de `@expo-google-fonts`)
se cargan con `useFonts` en `App.tsx`; el splash nativo se mantiene hasta que
estén listas.

## Validación

`npm run type-check`, `npm run lint` y `npm run format:check`
(o todo junto: `npm run validate`).

## Backend

El móvil necesita el servidor web Wayio corriendo (`cd ../ && npm run dev`)
para la IA, las búsquedas y los pagos. Auth, viajes y grupos van directo a
Supabase y funcionan sin el servidor web.
