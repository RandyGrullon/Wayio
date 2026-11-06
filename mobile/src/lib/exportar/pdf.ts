/**
 * «Exportar PDF» (web: window.print del itinerario, un día por página).
 * En la app: HTML legible del itinerario → expo-print lo convierte en PDF en
 * la caché → hoja de compartir del sistema (guardar en Archivos, enviar,
 * imprimir…). Si el sistema no deja compartir, abre el diálogo de impresión
 * (que también ofrece «Guardar como PDF»).
 *
 * Papel blanco: siempre la paleta clara del tema (nunca hex sueltos).
 */
import { DAY_COLORS, colorDia, light } from '../../theme'
import {
  formatCurrency,
  formatDias,
  formatDuracion,
  formatFecha,
  formatHora12,
  formatRangoFechas,
  formatViajeros,
  sumarDias,
} from '../utils/formatters'
import { baseNombreArchivo } from '../utils/ics'
import type {
  Moneda,
  PlanningActivity,
  PlanningActivityType,
  PlanningTrip,
} from '../../types/planning'
import {
  ErrorExportar,
  cargarArchivos,
  cargarPrint,
  cargarSharing,
} from './nativos'

const PAQUETE: Record<string, string> = {
  basico: 'Básico',
  confort: 'Confort',
  premium: 'Premium',
}

const TIPO: Record<PlanningActivityType, string> = {
  museo: 'Museo',
  restaurante: 'Restaurante',
  templo: 'Templo',
  parque: 'Parque',
  barrio: 'Barrio',
  playa: 'Playa',
  actividad: 'Actividad',
  traslado: 'Traslado',
}

export interface OpcionesPdf {
  moneda: Moneda
  /** «Para tu próxima visita» (actividades perdidas sin nuevo hueco). */
  pendientes?: PlanningActivity[]
  /** Fecha del pie «Impreso el …» (para pruebas). */
  ahora?: Date
}

function esc(texto: string | null | undefined): string {
  return (texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function lista(items: string[], clase = ''): string {
  if (items.length === 0) return ''
  return `<ul${clase ? ` class="${clase}"` : ''}>${items
    .map((i) => `<li>${esc(i)}</li>`)
    .join('')}</ul>`
}

function rangoHoras(a: PlanningActivity): string {
  const ini = formatHora12(a.horaInicio)
  const fin = formatHora12(a.horaFin)
  if (ini && fin) return `${ini} – ${fin}`
  return ini || fin || ''
}

function actividadHtml(
  a: PlanningActivity,
  moneda: Moneda,
  ultima: boolean
): string {
  const perdida = a.estado === 'perdida' || a.esPerdida
  const meta = [
    TIPO[a.tipo] ?? '',
    a.duracionMinutos > 0 ? formatDuracion(a.duracionMinutos) : '',
    a.precioEstimado > 0 ? `${formatCurrency(a.precioEstimado, moneda)}` : '',
  ].filter(Boolean)
  const sellos = [
    perdida ? '<span class="sello sello-perdida">Perdida</span>' : '',
    a.reservaRequerida && !perdida
      ? '<span class="sello">Requiere reserva</span>'
      : '',
    a.reagendadaDesdeDia
      ? `<span class="sello">Reagendada desde el día ${esc(String(a.reagendadaDesdeDia))}</span>`
      : '',
  ].filter(Boolean)
  return `
    <li class="act${perdida ? ' act-perdida' : ''}">
      <div class="act-hora">${esc(rangoHoras(a)) || '—'}</div>
      <div class="act-cuerpo">
        <p class="act-nombre">${esc(a.nombre)}</p>
        ${meta.length > 0 ? `<p class="act-meta">${esc(meta.join(' · '))}</p>` : ''}
        ${sellos.length > 0 ? `<p class="sellos">${sellos.join(' ')}</p>` : ''}
        ${a.descripcion ? `<p class="act-desc">${esc(a.descripcion)}</p>` : ''}
        ${a.direccion ? `<p class="act-dir">${esc(a.direccion)}</p>` : ''}
        ${a.mejorHoraVisita ? `<p class="act-meta">Mejor hora: ${esc(a.mejorHoraVisita)}</p>` : ''}
        ${lista(a.consejos ?? [], 'act-consejos')}
        ${
          !ultima && a.tiempoHastaSiguiente > 0
            ? `<p class="act-traslado">${esc(formatDuracion(a.tiempoHastaSiguiente))} hasta la siguiente</p>`
            : ''
        }
      </div>
    </li>`
}

/** HTML imprimible del itinerario (portada, avisos, días, notas, pendientes). */
export function htmlDelItinerario(
  trip: PlanningTrip,
  { moneda, pendientes = [], ahora = new Date() }: OpcionesPdf
): string {
  const c = light
  const rango = formatRangoFechas(trip.fechaInicio, trip.fechaFin)
  const kicker = [
    'Itinerario',
    PAQUETE[trip.paquete] ?? 'Confort',
    formatDias(trip.dias.length),
  ].join(' · ')
  const meta = [
    rango,
    formatViajeros(trip.personas),
    trip.origen ? `Desde ${trip.origen}` : '',
    trip.presupuestoTotal > 0
      ? `${formatCurrency(trip.presupuestoTotal, moneda)} estimado en destino`
      : '',
  ].filter(Boolean)

  const dias = trip.dias
    .map((d) => {
      const color = colorDia(DAY_COLORS, d.numero)
      const fecha = formatFecha(sumarDias(trip.fechaInicio, d.numero - 1))
      const cabecera = [
        `Día ${String(d.numero).padStart(2, '0')}`,
        fecha,
        d.ciudad,
      ]
        .filter(Boolean)
        .join(' · ')
      const acts = d.actividades ?? []
      const actividades = acts
        .map((a, i) => actividadHtml(a, moneda, i === acts.length - 1))
        .join('')
      return `
      <section class="dia">
        <p class="dia-kicker" style="color:${color}">${esc(cabecera)}</p>
        <h2 class="dia-titulo">${esc(d.titulo || `Día ${d.numero}`)}</h2>
        ${d.descripcion ? `<p class="dia-desc">${esc(d.descripcion)}</p>` : ''}
        ${
          d.presupuestoDia > 0
            ? `<p class="dia-presupuesto">${esc(formatCurrency(d.presupuestoDia, moneda))} estimado</p>`
            : ''
        }
        ${
          acts.length > 0
            ? `<ol class="acts" style="border-left-color:${color}">${actividades}</ol>`
            : '<p class="vacio">Día libre.</p>'
        }
      </section>`
    })
    .join('')

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(`Itinerario de ${trip.destino}`)}</title>
<style>
  @page { margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: ${c.fg};
    background: ${c.surface};
    font-family: -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1, h2, .serif { font-family: Georgia, 'Times New Roman', serif; font-weight: 500; }
  p { margin: 0; }
  ul { margin: 4px 0 0; padding-left: 18px; }
  li { margin: 2px 0; }
  .kicker, .dia-kicker {
    font-size: 8.5pt; letter-spacing: 0.08em; text-transform: uppercase;
    font-weight: 600; color: ${c.fgMuted};
  }
  h1 { font-size: 26pt; font-style: italic; margin: 6px 0 4px; line-height: 1.15; }
  .meta { color: ${c.fgMuted}; font-size: 10pt; }
  .resumen { margin-top: 12px; color: ${c.fgMuted}; }
  .caja {
    margin-top: 16px; padding: 10px 14px; border-radius: 8px;
    border: 1px solid ${c.border};
  }
  .caja-aviso { background: ${c.warningBg}; border-color: ${c.warningBg}; color: ${c.warningFg}; }
  .caja-nota { background: ${c.brassSoft}; border-color: ${c.brassSoft}; }
  .caja h3 { margin: 0; font-size: 10pt; font-weight: 600; }
  .dia { margin-top: 26px; }
  .dia + .dia { page-break-before: always; break-before: page; margin-top: 0; }
  .dia-titulo { font-size: 17pt; margin: 4px 0 2px; }
  .dia-desc { color: ${c.fgMuted}; }
  .dia-presupuesto { color: ${c.fgMuted}; font-size: 9.5pt; margin-top: 2px; }
  .acts { list-style: none; margin: 12px 0 0; padding: 0 0 0 12px; border-left: 3px solid ${c.border}; }
  .act { display: flex; gap: 12px; padding: 8px 0; border-bottom: 1px solid ${c.border}; page-break-inside: avoid; break-inside: avoid; }
  .act:last-child { border-bottom: 0; }
  .act-hora { width: 118px; flex-shrink: 0; font-variant-numeric: tabular-nums; font-weight: 600; font-size: 10pt; }
  .act-cuerpo { flex: 1; min-width: 0; }
  .act-nombre { font-weight: 600; font-size: 11.5pt; }
  .act-perdida .act-nombre { text-decoration: line-through; color: ${c.fgMuted}; }
  .act-meta, .act-dir, .act-traslado { color: ${c.fgMuted}; font-size: 9.5pt; }
  .act-desc { margin-top: 2px; }
  .act-traslado { margin-top: 4px; font-style: italic; }
  .act-consejos { font-size: 9.5pt; color: ${c.fgMuted}; }
  .sellos { margin-top: 3px; }
  .sello {
    display: inline-block; font-size: 8pt; padding: 1px 6px; border-radius: 4px;
    background: ${c.surface2}; color: ${c.fg};
  }
  .sello-perdida { background: ${c.dangerBg}; color: ${c.dangerFg}; }
  .vacio { color: ${c.fgMuted}; margin-top: 8px; }
  .pie { margin-top: 28px; padding-top: 8px; border-top: 1px solid ${c.border}; font-size: 8.5pt; color: ${c.fgSubtle}; }
</style>
</head>
<body>
  <header>
    <p class="kicker">${esc(kicker)}</p>
    <h1>${esc(trip.destino)}</h1>
    <p class="meta">${esc(meta.join(' · '))}</p>
    ${trip.resumenViaje ? `<p class="resumen">${esc(trip.resumenViaje)}</p>` : ''}
  </header>
  ${
    (trip.advertencias ?? []).length > 0
      ? `<div class="caja caja-aviso"><h3>Antes de ir</h3>${lista(trip.advertencias)}</div>`
      : ''
  }
  ${dias}
  ${
    (trip.consejos ?? []).length > 0
      ? `<div class="caja caja-nota"><h3>Notas de ruta</h3>${lista(trip.consejos)}</div>`
      : ''
  }
  ${
    pendientes.length > 0
      ? `<div class="caja"><h3>Para tu próxima visita</h3>${lista(pendientes.map((p) => p.nombre))}</div>`
      : ''
  }
  <p class="pie">Wayio · Impreso el ${esc(formatFecha(ahora, { anio: true }))}</p>
</body>
</html>`
}

/** Nombre del PDF: «wayio-cartagena.pdf». */
export function nombreArchivoPdf(destino: string): string {
  return `wayio-${baseNombreArchivo(destino) || 'viaje'}.pdf`
}

/**
 * Genera el PDF y lo comparte (o abre el diálogo de impresión si no se puede
 * compartir). Lanza ErrorExportar con un texto ya listo.
 */
export async function exportarPdf(
  trip: PlanningTrip,
  opciones: OpcionesPdf
): Promise<'compartido' | 'impreso'> {
  const Print = await cargarPrint()
  const html = htmlDelItinerario(trip, opciones)
  const Sharing = await cargarSharing()

  if (!Sharing) {
    try {
      await Print.printAsync({ html })
    } catch {
      // iOS rechaza si se cierra el diálogo sin imprimir: no es un error.
    }
    return 'impreso'
  }

  let uri: string
  try {
    const r = await Print.printToFileAsync({
      html,
      margins: { top: 40, right: 36, bottom: 40, left: 36 },
    })
    uri = r.uri
  } catch {
    throw new ErrorExportar('No pudimos crear el PDF. Inténtalo de nuevo.')
  }

  // Nombre legible en vez del aleatorio de expo-print (si falla, se comparte
  // igual con el nombre original).
  try {
    const { File, Paths } = await cargarArchivos()
    const origen = new File(uri)
    const destino = new File(Paths.cache, nombreArchivoPdf(trip.destino))
    if (destino.exists) destino.delete()
    origen.move(destino)
    uri = origen.uri
  } catch {
    // Se queda el nombre de expo-print.
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: `Itinerario de ${trip.destino}`,
  })
  return 'compartido'
}
