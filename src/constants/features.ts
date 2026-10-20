/**
 * Funciones por plan, alineadas con el catálogo público
 * (src/constants/planes.ts, que es la fuente única de la página de planes):
 * true = incluida en Gratis (con cuenta); 'pro' = solo Pro (mensual, anual o
 * pase de 30 días). Las acciones de IA con cupo mensual en Gratis (trazar,
 * ajustar y analizar fotos o videos) cuentan como incluidas: el cupo vive en
 * CUPO_GRATIS y Pro las deja sin límite (uso justo). Pro Grupo no se vende:
 * lo del grupo es Gratis.
 */
export const FEATURES = {
  // GRATIS (con cuenta)
  planificacion: true,
  ajustes_ia: true,
  analizar_fotos_videos: true,
  mapa_basico: true,
  gps_en_vivo: true,
  geofencing_basico: true,
  sala_grupal: true,
  chat_integrado: true,
  split_gastos: true,
  ubicacion_grupo_vivo: true,
  alerta_nivel_1: true,
  alerta_nivel_2: true,
  reservas_con_afiliado: true,
  modo_offline: true,
  pdf_export: true,
  historial_viajes: true,

  // PRO
  ia_sin_limite: 'pro',
  alertas_ia_completas: 'pro',
  reoptimizacion_en_vivo: 'pro',
} as const satisfies Record<string, true | 'pro'>

export type FeatureKey = keyof typeof FEATURES
export type FeatureGate = (typeof FEATURES)[FeatureKey]
