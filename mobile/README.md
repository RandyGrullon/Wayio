# Wayio Mobile

App móvil (Expo + React Native) de Wayio. Es la migración completa de la web:
planificación con IA, viajes guardados, sala grupal (chat/votos/gastos),
modo en vivo con GPS + geofencing + alertas, y paywall Pro.

## Arquitectura

- **Supabase (directo)** → auth, viajes, grupos, suscripción y realtime. El móvil
  guarda la sesión en `AsyncStorage` (no usa cookies como la web).
- **Backend web (Next.js)** → solo para los endpoints de IA, que tienen las API
  keys secretas y no requieren auth: `/api/generate`, `/api/reschedule`,
  `/api/validate`.
- **Stripe checkout** → se abre la web (`/precios`) en un navegador in-app, porque
  el pago requiere la sesión web.

```
src/
  config.ts                 env (API URL, web URL, supabase, mapbox)
  context/AuthContext.tsx   sesión + tier Pro
  navigation/               navegador ligero por stack (sin deps nativas)
  lib/supabase|api|trips     cliente supabase, backend IA, repositorio + converter
  hooks/                    useGroup (realtime) + hooks de geofencing/offline
  screens/                  Auth, Home, CreateTrip, Packages, TripDetail,
                            LiveTracking, Group, Paywall
  components/               ui/, trip/, alerts/, mapa, etc.
```

## Configuración

1. Copia `.env.example` a `.env` y rellena las variables. **Importante:** en un
   teléfono físico, `EXPO_PUBLIC_API_URL` debe ser la IP LAN de tu PC
   (ej. `http://192.168.1.50:3000`), no `localhost`.
2. `npm install`
3. Como usa módulos nativos (`@rnmapbox/maps`, `expo-location` en background,
   notificaciones), necesitas un **dev build**, no Expo Go:
   ```bash
   npx expo run:android   # o run:ios (requiere Mac + Xcode)
   ```
   Luego, para iterar: `npm start`.

## Backend

El móvil necesita el servidor web Wayio corriendo (`cd ../ && npm run dev`) para
generar itinerarios y reagendar con IA. El resto (auth, viajes, grupos) va directo
a Supabase y funciona sin el servidor web.
