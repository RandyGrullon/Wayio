export const GEOFENCING_RADII = {
  restaurante: 80,
  cafe: 60,
  museo: 150,
  templo: 120,
  mirador: 100,
  parque: 250,
  jardin: 200,
  playa: 400,
  barrio: 500,
  mercado: 200,
  plaza: 150,
  aeropuerto: 600,
  puerto_crucero: 800,
  hotel: 100,
  defecto: 150,
} as const satisfies Record<string, number>

export type ActivityType = keyof typeof GEOFENCING_RADII
