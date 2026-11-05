# Expo SDK 54 (no la última)

Lee la documentación de esta versión antes de escribir código:
https://docs.expo.dev/versions/v54.0.0/

- Con `expo-dev-client` instalado, `npx expo start` abre el dev build por
  defecto (pulsa `s` para Expo Go).
- Añadir o actualizar un módulo nativo (`@rnmapbox/maps`, `react-native-svg`,
  `react-native-safe-area-context`, `expo-splash-screen`, `expo-system-ui`,
  `expo-font`, `expo-dev-client`…) exige recompilar el dev build (EAS o
  `npx expo run:android|ios`).
- Fuentes con `useFonts` (`App.tsx`). Formatos es-DO solo desde
  `src/lib/utils/formatters.ts` (sin `Intl`). Llamadas al backend solo con
  `src/lib/api/http.ts` (Bearer + tiempo límite).
- `EXPO_PUBLIC_RESERVAS_ENABLED` (por defecto `false`) → `config.reservasActivas`.
- Compras integradas con RevenueCat (`src/lib/compras/tienda.ts`,
  `react-native-purchases` 10.x: la 11.x aún no sirve en Expo): se activan
  solas con `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY`;
  `EXPO_PUBLIC_COMPRAS_TIENDA=false` las apaga. El plan lo decide siempre el
  servidor.
- Comentarios y textos de la UI en español (es-DO); colores siempre desde el
  tema (`src/theme.ts`), nunca hex sueltos.
