import type { TripForm } from '@/lib/validations/tripForm'

const PAQUETE_INSTRUCCIONES: Record<TripForm['paquete'], string> = {
  basico:
    'PAQUETE BÁSICO: hoteles 3 estrellas o hostales bien valorados, vuelos económicos (clase turista sin extras), prioriza actividades gratuitas o de bajo costo, transporte público cuando sea posible.',
  confort:
    'PAQUETE CONFORT: hoteles 4 estrellas, vuelo en clase turista con equipaje incluido, mix equilibrado de actividades gratuitas y de pago, taxi o Uber para traslados clave.',
  premium:
    'PAQUETE PREMIUM: hoteles 5 estrellas o boutique de lujo, vuelo en clase business o primera, tours privados, restaurantes top (mínimo 2 por viaje), traslados en vehículo privado.',
}

export function buildItineraryPrompt(form: TripForm): string {
  const destinoFinal = form.destinoSorpresa
    ? 'SORPRESA (elige un destino perfecto para el tipo de viaje solicitado, usa el nombre real del lugar en el JSON)'
    : form.destino

  const preferenciasLinea =
    form.preferencias && form.preferencias.length > 0
      ? `\n- Preferencias: ${form.preferencias.join(', ')}`
      : ''

  const paqueteInstruccion = PAQUETE_INSTRUCCIONES[form.paquete]

  return `
Eres el mejor planificador de viajes del mundo.
Tu trabajo es crear un itinerario perfecto que la gente
realmente pueda seguir durante su viaje real.

DATOS DEL VIAJE:
- Destino: ${destinoFinal}
- Origen: ${form.origen}
- Personas: ${form.personas}
- Fechas: ${form.fechaInicio} al ${form.fechaFin}
- Presupuesto total: ${form.presupuesto} ${form.moneda}
- Tipo de viaje: ${form.tipo}
- Paquete: ${form.paquete.toUpperCase()}${preferenciasLinea}

INSTRUCCIONES DE PAQUETE:
${paqueteInstruccion}

REGLAS CRITICAS DE OPTIMIZACION DE RUTA:
1. NUNCA volver a un lugar ya visitado.
2. Agrupar lugares cercanos en el mismo dia.
3. La ruta de cada dia debe ser circular o lineal, nunca zigzag.
4. Lugares masificados: ir al amanecer (6-8 AM) o muy temprano.
5. Museos e interiores: mediodia (10 AM - 2 PM).
6. Barrios y mercados: tarde (3-6 PM).
7. Restaurantes y ocio: noche (7 PM en adelante).
8. Dia 1 y ultimo dia: actividades ligeras, considerar viaje.
9. Incluir tiempo de desplazamiento realista entre actividades.
10. Si hay playa: ir por la manana, nunca al mediodia.

REGLAS DE RADIO DE GEOFENCING:
- Restaurante: 80 metros
- Museo o templo: 120 metros
- Mirador o punto especifico: 100 metros
- Parque o jardin: 250 metros
- Playa: 400 metros
- Barrio o zona amplia: 500 metros
- Mercado grande: 200 metros
- Puerto de crucero: 800 metros

REGLAS DE PRESUPUESTO:
- Distribuir el presupuesto de forma realista entre dias.
- Incluir siempre costos de transporte entre actividades.
- Primer y ultimo dia: menos actividades pagadas.
- Calcular presupuesto por persona ademas del total.

Antes de generar el JSON verifica que:
- Ningun lugar este programado en horario de cierre.
- Haya tiempo suficiente de traslado entre actividades.
- El presupuesto total no exceda lo indicado.
- Los dias 1 y ultimo sean ligeros en actividades.
- Si hay vuelo el ultimo dia, dejar tiempo suficiente al aeropuerto.
Lista las advertencias encontradas en el campo advertencias del JSON.

RESPONDE SOLO CON UN JSON VALIDO. SIN TEXTO ANTES NI DESPUES.
SIN BLOQUES DE CODIGO. SIN EXPLICACIONES.
EL JSON DEBE SEGUIR EXACTAMENTE ESTA ESTRUCTURA:

{
  "destino": string,
  "resumenViaje": string,
  "presupuestoTotal": number,
  "presupuestoPorPersona": number,
  "dias": [
    {
      "numero": number,
      "titulo": string,
      "descripcion": string,
      "ciudad": string,
      "presupuestoDia": number,
      "colorMapa": string,
      "actividades": [
        {
          "id": string,
          "nombre": string,
          "descripcion": string,
          "horaInicio": "HH:MM",
          "horaFin": "HH:MM",
          "duracionMinutos": number,
          "tipo": "museo|restaurante|templo|parque|barrio|playa|actividad|traslado",
          "direccion": string,
          "lat": number,
          "lng": number,
          "radioGeofencingMetros": number,
          "precioEstimado": number,
          "reservaRequerida": boolean,
          "reservaPagada": false,
          "mejorHoraVisita": string,
          "consejos": [string],
          "tiempoHastaSiguiente": number,
          "estado": "pendiente",
          "esPerdida": false
        }
      ]
    }
  ],
  "advertencias": [string],
  "consejos": [string]
}
`
}
