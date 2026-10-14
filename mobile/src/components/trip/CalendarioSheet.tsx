import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useEstilos, useTheme, type Tema } from '../../theme'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { Sheet } from '../ui/Sheet'
import { Txt } from '../ui/Txt'
import { ChevronLeft, ChevronRight } from '../ui/iconos'
import {
  DIAS_SEMANA_CORTOS,
  DIAS_SEMANA_LARGOS,
  formatFechaLarga,
  formatMesAnio,
  formatResumenFechas,
  hoyLocal,
  parseFecha,
  toISODateLocal,
} from '../ui/formato'

interface Rango {
  inicio: string
  fin: string
}

interface Props {
  visible: boolean
  onClose: () => void
  value: Rango
  onChange: (r: Rango) => void
  /** Fecha mínima 'YYYY-MM-DD' (por defecto, hoy en hora local). */
  min?: string
  /** Máximo de días del viaje (el servidor admite 30). */
  maxDias?: number
}

function semanasDelMes(anio: number, mes: number): (string | null)[][] {
  const primero = new Date(anio, mes, 1)
  const desfase = (primero.getDay() + 6) % 7 // lunes = 0
  const diasMes = new Date(anio, mes + 1, 0).getDate()
  const celdas: (string | null)[] = []
  for (let i = 0; i < desfase; i++) celdas.push(null)
  for (let d = 1; d <= diasMes; d++) {
    celdas.push(toISODateLocal(new Date(anio, mes, d)))
  }
  while (celdas.length % 7 !== 0) celdas.push(null)
  const semanas: (string | null)[][] = []
  for (let i = 0; i < celdas.length; i += 7)
    semanas.push(celdas.slice(i, i + 7))
  return semanas
}

/**
 * Selector de fechas de salida y regreso en una hoja (sin módulos nativos):
 * primer toque = salida, segundo = regreso. «Hoy» se calcula en hora local y
 * los días anteriores quedan deshabilitados. Cada día se anuncia con la fecha
 * completa y su estado.
 */
export function CalendarioSheet({
  visible,
  onClose,
  value,
  onChange,
  min,
  maxDias = 30,
}: Props): React.ReactElement {
  const { colors } = useTheme()
  const styles = useEstilos(crearEstilos)
  const minimo = min ?? hoyLocal()
  const base = parseFecha(value.inicio) ?? parseFecha(minimo) ?? new Date()
  const [mes, setMes] = useState(() => ({
    anio: base.getFullYear(),
    mes: base.getMonth(),
  }))
  const semanas = useMemo(() => semanasDelMes(mes.anio, mes.mes), [mes])
  const minimoMes = parseFecha(minimo)
  const puedeAtras =
    !minimoMes ||
    mes.anio > minimoMes.getFullYear() ||
    (mes.anio === minimoMes.getFullYear() && mes.mes > minimoMes.getMonth())

  const mover = (delta: number): void => {
    setMes((m) => {
      const d = new Date(m.anio, m.mes + delta, 1)
      return { anio: d.getFullYear(), mes: d.getMonth() }
    })
  }

  const elegir = (dia: string): void => {
    if (!value.inicio || value.fin) {
      onChange({ inicio: dia, fin: '' })
      return
    }
    if (dia < value.inicio) {
      onChange({ inicio: dia, fin: '' })
      return
    }
    const a = parseFecha(value.inicio)
    const b = parseFecha(dia)
    if (a && b) {
      const dias =
        Math.round(
          (new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime() -
            new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()) /
            86_400_000
        ) + 1
      if (dias > maxDias) {
        onChange({ inicio: dia, fin: '' })
        return
      }
    }
    onChange({ inicio: value.inicio, fin: dia })
  }

  const resumen = formatResumenFechas(value.inicio, value.fin)
  const hoy = hoyLocal()

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Fechas del viaje"
      description={
        !value.inicio
          ? 'Toca el día de salida.'
          : !value.fin
            ? 'Ahora toca el día de regreso.'
            : 'Puedes cambiarlas cuando quieras.'
      }
      footer={
        <>
          <Button
            title="Borrar"
            variant="ghost"
            onPress={() => onChange({ inicio: '', fin: '' })}
            disabled={!value.inicio}
          />
          <Button
            title="Listo"
            variant="tinta"
            onPress={onClose}
            disabled={!value.inicio || !value.fin}
          />
        </>
      }
    >
      <View style={styles.cabecera}>
        <IconButton
          label="Mes anterior"
          icon={ChevronLeft}
          onPress={() => mover(-1)}
          disabled={!puedeAtras}
        />
        <Txt
          variant="title"
          style={styles.mes}
          accessibilityLiveRegion="polite"
        >
          {formatMesAnio(new Date(mes.anio, mes.mes, 1))}
        </Txt>
        <IconButton
          label="Mes siguiente"
          icon={ChevronRight}
          onPress={() => mover(1)}
        />
      </View>

      <View
        style={styles.semana}
        importantForAccessibility="no-hide-descendants"
      >
        {DIAS_SEMANA_CORTOS.map((d, i) => (
          <View key={`${d}-${i}`} style={styles.celda}>
            <Txt
              variant="caption"
              color="fgSubtle"
              accessibilityLabel={DIAS_SEMANA_LARGOS[i]}
            >
              {d}
            </Txt>
          </View>
        ))}
      </View>

      {semanas.map((semana, si) => (
        <View key={si} style={styles.semana}>
          {semana.map((dia, di) => {
            if (!dia) return <View key={di} style={styles.celda} />
            const deshabilitado = dia < minimo
            const esInicio = dia === value.inicio
            const esFin = dia === value.fin
            const extremo = esInicio || esFin
            const enRango =
              Boolean(value.inicio && value.fin) &&
              dia > value.inicio &&
              dia < value.fin
            const numero = Number(dia.slice(8, 10))
            return (
              <View
                key={dia}
                style={[styles.celda, enRango ? styles.rango : null]}
              >
                <Pressable
                  onPress={() => elegir(dia)}
                  disabled={deshabilitado}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatFechaLarga(dia)}${esInicio ? ', salida' : ''}${esFin ? ', regreso' : ''}${dia === hoy ? ', hoy' : ''}`}
                  accessibilityState={{
                    disabled: deshabilitado,
                    selected: extremo || enRango,
                  }}
                  style={({ pressed }) => [
                    styles.dia,
                    extremo ? styles.diaSel : null,
                    dia === hoy && !extremo ? styles.hoy : null,
                    pressed && !extremo ? styles.diaPulsado : null,
                  ]}
                >
                  <Txt
                    variant="label"
                    tnum
                    maxFontSizeMultiplier={1.2}
                    color={
                      extremo ? 'fgInverse' : deshabilitado ? 'fgSubtle' : 'fg'
                    }
                    style={deshabilitado ? styles.tachado : null}
                  >
                    {numero}
                  </Txt>
                </Pressable>
              </View>
            )
          })}
        </View>
      ))}

      <View style={[styles.resumen, { borderTopColor: colors.border }]}>
        <Txt
          variant="bodyS"
          color={resumen ? 'fg' : 'fgMuted'}
          accessibilityLiveRegion="polite"
        >
          {resumen || 'Sin fechas todavía'}
        </Txt>
      </View>
    </Sheet>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    cabecera: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    mes: { textTransform: 'capitalize' },
    semana: { flexDirection: 'row' },
    celda: {
      flex: 1,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rango: { backgroundColor: t.colors.surface2 },
    dia: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    diaSel: { backgroundColor: t.colors.surfaceInverse },
    diaPulsado: { backgroundColor: t.colors.surface2 },
    hoy: { borderWidth: 1, borderColor: t.colors.borderStrong },
    tachado: { opacity: 0.6 },
    resumen: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
  })
