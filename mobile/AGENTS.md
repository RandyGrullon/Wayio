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
- Comentarios y textos de la UI en español (es-DO); colores siempre desde el
  tema (`src/theme.ts`), nunca hex sueltos.
