import type { Trip, Day } from '@/types/trip'
import type { Activity, ActivityType } from '@/types/activity'
import type { WeatherData } from '@/lib/api/openweather'
import type { TripForm } from '@/lib/validations/tripForm'

/**
 * Itinerario de demostración (Tokio, coordenadas reales) para previsualizar la
 * app sin necesidad de API keys. Se usa cuando no hay proveedor de IA
 * configurado o cuando la generación real falla.
 */

interface Seed {
  id: string
  nombre: string
  descripcion: string
  horaInicio: string
  horaFin: string
  tipo: ActivityType
  direccion: string
  lat: number
  lng: number
  radio: number
  precio: number
}

function minutes(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function activity(s: Seed, factor: number): Activity {
  return {
    id: s.id,
    nombre: s.nombre,
    descripcion: s.descripcion,
    horaInicio: s.horaInicio,
    horaFin: s.horaFin,
    duracionMinutos: minutes(s.horaFin) - minutes(s.horaInicio),
    tipo: s.tipo,
    direccion: s.direccion,
    lat: s.lat,
    lng: s.lng,
    radioGeofencingMetros: s.radio,
    precioEstimado: Math.round(s.precio * factor),
    reservaRequerida: s.tipo === 'restaurante',
    reservaPagada: false,
    mejorHoraVisita: s.horaInicio,
    consejos: ['Llega temprano para evitar multitudes.'],
    tiempoHastaSiguiente: 20,
    estado: 'pendiente',
    esPerdida: false,
  }
}

const DEMO_WEATHER: WeatherData = {
  temp: 22,
  description: 'cielo despejado',
  humidity: 58,
  windSpeed: 3.1,
  icon: '01d',
}

const DAY_SEEDS: {
  titulo: string
  descripcion: string
  ciudad: string
  colorMapa: string
  seeds: Seed[]
}[] = [
  {
    titulo: 'Asakusa y el este histórico',
    descripcion: 'Templos, mercados tradicionales y vistas desde la Skytree.',
    ciudad: 'Tokio',
    colorMapa: '#2E75B6',
    seeds: [
      {
        id: 'd1-senso',
        nombre: 'Templo Sensō-ji',
        descripcion: 'El templo budista más antiguo de Tokio.',
        horaInicio: '08:00',
        horaFin: '09:30',
        tipo: 'templo',
        direccion: '2-3-1 Asakusa, Taito',
        lat: 35.7148,
        lng: 139.7967,
        radio: 120,
        precio: 0,
      },
      {
        id: 'd1-nakamise',
        nombre: 'Calle Nakamise',
        descripcion: 'Mercado tradicional de snacks y souvenirs.',
        horaInicio: '09:40',
        horaFin: '10:40',
        tipo: 'barrio',
        direccion: 'Nakamise-dori, Asakusa',
        lat: 35.7112,
        lng: 139.7964,
        radio: 200,
        precio: 15,
      },
      {
        id: 'd1-skytree',
        nombre: 'Tokyo Skytree',
        descripcion: 'Mirador a 450 m de altura.',
        horaInicio: '11:00',
        horaFin: '12:30',
        tipo: 'actividad',
        direccion: '1-1-2 Oshiage, Sumida',
        lat: 35.7101,
        lng: 139.8107,
        radio: 150,
        precio: 25,
      },
      {
        id: 'd1-imahan',
        nombre: 'Almuerzo Asakusa Imahan',
        descripcion: 'Sukiyaki clásico de res wagyu.',
        horaInicio: '13:00',
        horaFin: '14:30',
        tipo: 'restaurante',
        direccion: '3-1-12 Nishiasakusa, Taito',
        lat: 35.711,
        lng: 139.795,
        radio: 80,
        precio: 40,
      },
    ],
  },
  {
    titulo: 'Shibuya, Harajuku y jardines',
    descripcion: 'Santuarios, cultura juvenil y el cruce más famoso del mundo.',
    ciudad: 'Tokio',
    colorMapa: '#E8743B',
    seeds: [
      {
        id: 'd2-meiji',
        nombre: 'Santuario Meiji',
        descripcion: 'Santuario sintoísta rodeado de bosque.',
        horaInicio: '08:30',
        horaFin: '10:00',
        tipo: 'templo',
        direccion: '1-1 Yoyogikamizonocho, Shibuya',
        lat: 35.6764,
        lng: 139.6993,
        radio: 250,
        precio: 0,
      },
      {
        id: 'd2-takeshita',
        nombre: 'Calle Takeshita (Harajuku)',
        descripcion: 'Moda kawaii, crepes y tiendas vintage.',
        horaInicio: '10:20',
        horaFin: '11:50',
        tipo: 'barrio',
        direccion: 'Takeshita St, Jingumae, Shibuya',
        lat: 35.6716,
        lng: 139.705,
        radio: 200,
        precio: 20,
      },
      {
        id: 'd2-gyoen',
        nombre: 'Jardín Shinjuku Gyoen',
        descripcion: 'Parque amplio ideal para descansar.',
        horaInicio: '13:00',
        horaFin: '14:30',
        tipo: 'parque',
        direccion: '11 Naitomachi, Shinjuku',
        lat: 35.6852,
        lng: 139.71,
        radio: 250,
        precio: 5,
      },
      {
        id: 'd2-shibuya',
        nombre: 'Cruce de Shibuya',
        descripcion: 'El cruce peatonal más concurrido del mundo.',
        horaInicio: '17:00',
        horaFin: '18:30',
        tipo: 'actividad',
        direccion: 'Shibuya Crossing, Shibuya',
        lat: 35.6595,
        lng: 139.7005,
        radio: 120,
        precio: 0,
      },
    ],
  },
  {
    titulo: 'Cultura en Ueno y lujo en Ginza',
    descripcion: 'Museos, parques y la zona más elegante de Tokio.',
    ciudad: 'Tokio',
    colorMapa: '#54A24B',
    seeds: [
      {
        id: 'd3-museo',
        nombre: 'Museo Nacional de Tokio',
        descripcion: 'La mayor colección de arte japonés.',
        horaInicio: '09:30',
        horaFin: '11:30',
        tipo: 'museo',
        direccion: '13-9 Uenokoen, Taito',
        lat: 35.7188,
        lng: 139.7765,
        radio: 120,
        precio: 10,
      },
      {
        id: 'd3-ueno',
        nombre: 'Parque Ueno',
        descripcion: 'Parque con templos, lago y cerezos.',
        horaInicio: '11:40',
        horaFin: '13:00',
        tipo: 'parque',
        direccion: 'Uenokoen, Taito',
        lat: 35.7156,
        lng: 139.7745,
        radio: 250,
        precio: 0,
      },
      {
        id: 'd3-ginza',
        nombre: 'Barrio de Ginza',
        descripcion: 'Tiendas de lujo y arquitectura icónica.',
        horaInicio: '15:00',
        horaFin: '17:00',
        tipo: 'barrio',
        direccion: 'Ginza, Chuo',
        lat: 35.6717,
        lng: 139.765,
        radio: 300,
        precio: 0,
      },
    ],
  },
]

// Experiencia exclusiva que solo aparece en el paquete premium
const PREMIUM_EXTRA: Seed = {
  id: 'd3-kaiseki',
  nombre: 'Cena kaiseki privada',
  descripcion: 'Menú degustación de alta cocina con chef dedicado.',
  horaInicio: '19:30',
  horaFin: '21:30',
  tipo: 'restaurante',
  direccion: 'Ginza, Chuo',
  lat: 35.6717,
  lng: 139.764,
  radio: 80,
  precio: 120,
}

function buildTrip(
  paquete: Trip['paquete'],
  factor: number,
  form: TripForm
): Trip {
  const dias: Day[] = DAY_SEEDS.map((d, i) => {
    const seeds =
      paquete === 'premium' && i === DAY_SEEDS.length - 1
        ? [...d.seeds, PREMIUM_EXTRA]
        : d.seeds
    const actividades = seeds.map((s) => activity(s, factor))
    const presupuestoDia = actividades.reduce(
      (sum, a) => sum + a.precioEstimado,
      0
    )
    return {
      numero: i + 1,
      titulo: d.titulo,
      descripcion: d.descripcion,
      ciudad: d.ciudad,
      actividades,
      presupuestoDia,
      colorMapa: d.colorMapa,
    }
  })

  const presupuestoTotal = dias.reduce((s, d) => s + d.presupuestoDia, 0)
  const personas = form.personas

  return {
    id: crypto.randomUUID(),
    destino: 'Tokio',
    origen: form.origen,
    personas,
    fechaInicio: form.fechaInicio,
    fechaFin: form.fechaFin,
    presupuestoTotal,
    presupuestoPorPersona: Math.round(presupuestoTotal / Math.max(1, personas)),
    dias,
    paquete,
    resumenViaje: `Itinerario de ejemplo por Tokio (paquete ${paquete}). Son datos de demostración para que veas la app completa sin configurar ninguna API key.`,
    consejos: [
      'Compra una tarjeta Suica para el transporte.',
      'Lleva efectivo: muchos sitios no aceptan tarjeta.',
    ],
    advertencias: [
      'Datos de demostración. Configura una API key de IA (Groq o Anthropic) en el .env para generar itinerarios reales.',
    ],
    listaActividades: [],
    actividadesPendientes: [],
  }
}

export interface DemoTrips {
  basico: Trip
  confort: Trip
  premium: Trip
  weather: WeatherData
}

export function buildDemoTrips(form: TripForm): DemoTrips {
  return {
    basico: buildTrip('basico', 1, form),
    confort: buildTrip('confort', 1.7, form),
    premium: buildTrip('premium', 3, form),
    weather: DEMO_WEATHER,
  }
}
