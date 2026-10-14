import { StyleSheet, View } from 'react-native'
import { useEstilos, useTheme, type Tema, type ThemeColors } from '../../theme'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { Txt } from '../ui/Txt'
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Star,
  type LucideIcon,
} from '../ui/iconos'
import { formatCurrency, formatPorcentaje } from '../ui/formato'
import type { Paquete, PlanningTrip } from '../../types/planning'

export const META_PAQUETE: Record<
  Paquete,
  { label: string; estrellas: number; color: keyof ThemeColors }
> = {
  basico: { label: 'Básico', estrellas: 3, color: 'accent' },
  confort: { label: 'Confort', estrellas: 4, color: 'primaryText' },
  premium: { label: 'Premium', estrellas: 5, color: 'brassText' },
}

function actividades(trip: PlanningTrip): number {
  return trip.dias.reduce((n, d) => n + d.actividades.length, 0)
}
function dePago(trip: PlanningTrip): number {
  return trip.dias.reduce(
    (n, d) => n + d.actividades.filter((a) => a.precioEstimado > 0).length,
    0
  )
}

/** Nombres de las actividades que cambian respecto a la versión de referencia. */
export function distintas(
  trip: PlanningTrip,
  ref: PlanningTrip | null
): string[] {
  if (!ref) return []
  const porId = new Map<string, string>()
  for (const d of ref.dias)
    for (const a of d.actividades) porId.set(a.id, a.nombre)
  const out: string[] = []
  for (const d of trip.dias) {
    for (const a of d.actividades) {
      const otro = porId.get(a.id)
      if (otro !== undefined && otro !== a.nombre && !out.includes(a.nombre)) {
        out.push(a.nombre)
      }
      if (out.length >= 3) return out
    }
  }
  return out
}

interface Encaje {
  tono: 'success' | 'warning' | 'danger'
  texto: string
  icono: LucideIcon
  pct: number
}

function encaje(total: number, presupuesto: number): Encaje | null {
  if (!presupuesto || presupuesto <= 0 || !Number.isFinite(total)) return null
  const pct = Math.round((total / presupuesto) * 100)
  if (pct <= 100) {
    return {
      tono: 'success',
      texto: `Dentro de tu presupuesto (${formatPorcentaje(pct)})`,
      icono: CheckCircle2,
      pct,
    }
  }
  if (pct <= 115) {
    return {
      tono: 'warning',
      texto: `Un poco por encima (${formatPorcentaje(pct)})`,
      icono: AlertTriangle,
      pct,
    }
  }
  return {
    tono: 'danger',
    texto: `Por encima de tu presupuesto (${formatPorcentaje(pct)})`,
    icono: AlertCircle,
    pct,
  }
}

/**
 * Tarjeta de versión (§6.4): kicker por nivel, estrellas de latón, precio
 * grande en la moneda del viaje «sin vuelo», encaje con el presupuesto
 * (siempre con texto e icono), filas alineadas con «Igual» y lo que la hace
 * distinta. Es un radio: seleccionar no navega.
 */
export function PackageCard({
  paquete,
  trip,
  moneda,
  selected,
  onSelect,
  presupuesto,
  referencia,
  distinta,
  ancho,
}: {
  paquete: Paquete
  trip: PlanningTrip
  moneda: string
  selected: boolean
  onSelect: () => void
  /** Presupuesto del formulario (para el encaje). */
  presupuesto?: number
  /** Versión Básico (para mostrar «Igual»). */
  referencia?: PlanningTrip
  /** Actividades que cambian frente a la versión de referencia. */
  distinta?: string[]
  ancho?: number
}): React.ReactElement {
  const { colors } = useTheme()
  const styles = useEstilos(crearEstilos)
  const m = META_PAQUETE[paquete]
  const total = actividades(trip)
  const pago = dePago(trip)
  const ritmo = trip.dias.length > 0 ? Math.round(total / trip.dias.length) : 0
  const fit = presupuesto ? encaje(trip.presupuestoTotal, presupuesto) : null
  const igual = (a: number, b: number | null): boolean =>
    paquete !== 'basico' && b !== null && a === b
  const refTotal = referencia ? actividades(referencia) : null
  const refPago = referencia ? dePago(referencia) : null
  const refRitmo =
    referencia && referencia.dias.length > 0
      ? Math.round(actividades(referencia) / referencia.dias.length)
      : null
  const colorFit =
    fit?.tono === 'success'
      ? colors.success
      : fit?.tono === 'warning'
        ? colors.warning
        : colors.danger

  const filas: { etiqueta: string; valor: string; igual: boolean }[] = [
    {
      etiqueta: 'Días',
      valor: String(trip.dias.length),
      igual: igual(trip.dias.length, referencia?.dias.length ?? null),
    },
    {
      etiqueta: 'Actividades',
      valor: `${total} · ${pago} de pago`,
      igual: igual(total, refTotal) && igual(pago, refPago),
    },
    {
      etiqueta: 'Ritmo',
      valor: `${ritmo} act./día`,
      igual: igual(ritmo, refRitmo),
    },
  ]

  return (
    <Card
      variant={selected ? 'selected' : 'default'}
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${m.label}, ${formatCurrency(trip.presupuestoTotal, moneda)} sin vuelo${fit ? `, ${fit.texto}` : ''}`}
      style={[styles.card, ancho ? { width: ancho } : null]}
    >
      <View style={styles.cabecera}>
        <Txt variant="overline" color={m.color}>
          {m.label}
        </Txt>
        {paquete === 'confort' ? (
          <Badge label="Equilibrio ideal" variant="laton" />
        ) : null}
      </View>

      <View style={styles.estrellas}>
        {Array.from({ length: m.estrellas }, (_, i) => (
          <Star
            key={i}
            size={16}
            color={colors.brass}
            fill={colors.brass}
            strokeWidth={1.5}
            accessible={false}
          />
        ))}
        <Txt variant="caption" color="fgMuted" style={styles.hoteles}>
          Hoteles {m.estrellas}★
        </Txt>
      </View>

      <Txt variant="numXL" style={styles.precio}>
        {formatCurrency(trip.presupuestoTotal, moneda)}
      </Txt>
      <Txt variant="caption" color="fgMuted">
        {formatCurrency(trip.presupuestoPorPersona, moneda)} por persona · sin
        vuelo
      </Txt>

      {fit ? (
        <View style={styles.encaje}>
          <View style={styles.encajeFila}>
            <fit.icono
              size={16}
              color={colorFit}
              strokeWidth={1.75}
              accessible={false}
            />
            <Txt
              variant="caption"
              color={
                fit.tono === 'success'
                  ? 'successFg'
                  : fit.tono === 'warning'
                    ? 'warningFg'
                    : 'dangerFg'
              }
              style={styles.flex}
            >
              {fit.texto}
            </Txt>
          </View>
          <View style={[styles.pista, { backgroundColor: colors.surface2 }]}>
            <View
              style={[
                styles.relleno,
                {
                  width: `${Math.min(100, fit.pct)}%`,
                  backgroundColor: colorFit,
                },
              ]}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.filas}>
        {filas.map((f) => (
          <View key={f.etiqueta} style={styles.fila}>
            <Txt variant="caption" color="fgMuted">
              {f.etiqueta}
            </Txt>
            <Txt
              variant="label"
              tnum
              color={f.igual ? 'fgSubtle' : 'fg'}
              accessibilityLabel={
                f.igual ? `${f.valor}, igual que Básico` : f.valor
              }
            >
              {f.igual ? 'Igual' : f.valor}
            </Txt>
          </View>
        ))}
      </View>

      {distinta && distinta.length > 0 ? (
        <View style={styles.distinta}>
          <Txt variant="overline" color="fgMuted">
            Lo que la hace distinta
          </Txt>
          {distinta.map((d) => (
            <Txt
              key={d}
              variant="bodyS"
              style={styles.vineta}
              numberOfLines={2}
            >
              · {d}
            </Txt>
          ))}
        </View>
      ) : null}

      <View style={styles.seleccion}>
        <View
          style={[
            styles.radio,
            selected
              ? { backgroundColor: colors.fg, borderColor: colors.fg }
              : { borderColor: colors.borderStrong },
          ]}
        >
          {selected ? (
            <Check size={14} color={colors.fgInverse} strokeWidth={2.5} />
          ) : null}
        </View>
        <Txt variant="label" color={selected ? 'fg' : 'fgMuted'}>
          {selected ? 'Seleccionada' : 'Seleccionar'}
        </Txt>
        {selected ? (
          <View
            style={[styles.sello, { borderColor: colors.brassText }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Txt variant="overline" color="brassText">
              Elegida
            </Txt>
          </View>
        ) : null}
      </View>
    </Card>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    flex: { flex: 1 },
    card: { marginRight: 12 },
    cabecera: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      minHeight: 24,
    },
    estrellas: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      marginTop: 10,
    },
    hoteles: { marginLeft: 6 },
    precio: { marginTop: 12 },
    encaje: { marginTop: 14, gap: 6 },
    encajeFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    pista: { height: 6, borderRadius: 3, overflow: 'hidden' },
    relleno: { height: 6, borderRadius: 3 },
    filas: {
      marginTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    fila: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    distinta: { marginTop: 14, gap: 4 },
    vineta: { marginTop: 2 },
    seleccion: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 18,
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sello: {
      marginLeft: 'auto',
      borderWidth: 1.5,
      borderRadius: t.radius.stamp,
      paddingHorizontal: 8,
      paddingVertical: 2,
      transform: [{ rotate: '-6deg' }],
    },
  })
