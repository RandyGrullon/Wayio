import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import {
  Button,
  Card,
  CardKicker,
  Chip,
  ChipGroup,
  EmptyState,
  Input,
  Txt,
} from '../ui'
import { Plus } from '../ui/iconos'
import { formatCurrency, formatFecha } from '../ui/formato'
import { useEstilos, type Tema } from '../../theme'
import type { TripMemberRow } from '../../types/planning'
import {
  calcularSaldos,
  participantesDe,
  type Deuda,
  type GastoGrupo,
} from './saldos'
import type { NuevoGasto } from './useGastosGrupo'

const TEMPORAL = 'temp-'
const NOMBRE_EXMIEMBRO = 'Alguien que ya no está'

type Errores = {
  concepto?: string | undefined
  monto?: string | undefined
  participantes?: string | undefined
}

/** «Ana», «Ana y Luis», «Ana, Luis y tú». */
function enumerar(nombres: readonly string[]): string {
  if (nombres.length <= 1) return nombres[0] ?? ''
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
}

/**
 * Gastos del grupo en móvil (§6.8): formulario con «Pagó» y «Entre quiénes»
 * (todos marcados por defecto), lista con pagador y reparto, y «Balances»
 * con el mínimo de pagos: «Ana le debe US$45.00 a Luis».
 */
export function GastosGrupo({
  gastos,
  pendientes,
  miembros,
  userId,
  moneda,
  onAnadir,
}: {
  gastos: readonly GastoGrupo[]
  pendientes: ReadonlySet<string>
  miembros: readonly TripMemberRow[]
  userId: string
  moneda: string
  onAnadir: (nuevo: NuevoGasto) => Promise<boolean>
}): React.ReactElement {
  const styles = useEstilos(crearEstilos)
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  // null = el valor por defecto (pagas tú · entre todos los miembros, incluso
  // los que se sumen mientras rellenas el gasto).
  const [pagador, setPagador] = useState<string | null>(null)
  const [elegidos, setElegidos] = useState<string[] | null>(null)
  const [errores, setErrores] = useState<Errores>({})

  const ids = miembros.map((m) => m.user_id)
  const variosMiembros = ids.length > 1

  const nombres = new Map(miembros.map((m) => [m.user_id, m.nombre]))
  for (const g of gastos) {
    if (!nombres.has(g.pagado_por)) nombres.set(g.pagado_por, g.nombre_pagador)
  }
  const nombre = (id: string): string =>
    id === userId ? 'Tú' : (nombres.get(id) ?? NOMBRE_EXMIEMBRO)
  /** Nombre dentro de una frase: «tú» en minúscula. */
  const quien = (id: string): string => (id === userId ? 'tú' : nombre(id))

  const pagadorEfectivo =
    pagador && ids.includes(pagador)
      ? pagador
      : ids.includes(userId)
        ? userId
        : (ids[0] ?? userId)
  const participantes =
    elegidos === null ? ids : elegidos.filter((id) => ids.includes(id))
  const todosMarcados =
    ids.length > 0 && ids.every((id) => participantes.includes(id))

  const opciones = miembros.map((m) => ({
    value: m.user_id,
    label: m.user_id === userId ? 'Tú' : m.nombre,
  }))

  const montoLeido = Number(monto.replace(',', '.'))
  const [unicoElegido] = participantes
  const pistaReparto =
    participantes.length === 1 && unicoElegido
      ? unicoElegido === userId
        ? 'Solo para ti: no se reparte.'
        : `Solo para ${nombre(unicoElegido)}: no se reparte.`
      : Number.isFinite(montoLeido) && montoLeido > 0
        ? `A partes iguales: ${formatCurrency(montoLeido / Math.max(1, participantes.length), moneda, { decimales: true })} por persona.`
        : 'A partes iguales entre las personas marcadas.'

  const alternar = (id: string): void => {
    const nuevos = participantes.includes(id)
      ? participantes.filter((p) => p !== id)
      : [...participantes, id]
    setElegidos(ids.every((m) => nuevos.includes(m)) ? null : nuevos)
    if (nuevos.length > 0) {
      setErrores((e) => ({ ...e, participantes: undefined }))
    }
  }

  const anadir = async (): Promise<void> => {
    const c = concepto.trim()
    const n = montoLeido
    const reparto =
      variosMiembros || participantes.length > 0
        ? participantes
        : [pagadorEfectivo]
    const nuevos: Errores = {}
    if (!c) nuevos.concepto = 'Escribe el concepto del gasto.'
    if (!Number.isFinite(n) || n <= 0) {
      nuevos.monto = 'El monto debe ser mayor que cero.'
    }
    if (reparto.length === 0) {
      nuevos.participantes = 'Marca al menos una persona.'
    }
    setErrores(nuevos)
    if (nuevos.concepto || nuevos.monto || nuevos.participantes) return

    const ok = await onAnadir({
      concepto: c,
      monto: n,
      pagadoPor: pagadorEfectivo,
      participantes: reparto,
    })
    if (ok) {
      setConcepto('')
      setMonto('')
      setPagador(null)
      setElegidos(null)
    }
  }

  /** «Entre todos» · «Solo para Ana» · «Entre Ana, Luis y tú» · «Entre 5». */
  const describirReparto = (g: GastoGrupo): string => {
    const entre = participantesDe(g, ids)
    if (
      ids.length > 1 &&
      entre.length === ids.length &&
      ids.every((id) => entre.includes(id))
    ) {
      return 'Entre todos'
    }
    const [unico] = entre
    if (entre.length === 1 && unico) {
      return unico === userId ? 'Solo para ti' : `Solo para ${nombre(unico)}`
    }
    if (entre.length <= 3) return `Entre ${enumerar(entre.map(quien))}`
    return `Entre ${entre.length} personas`
  }

  const { deudas, personas, total } = calcularSaldos(gastos, ids)
  const yo = personas.find((p) => p.userId === userId)
  const importe = (n: number): string =>
    formatCurrency(n, moneda, { decimales: true })
  /** Texto antes y después del importe: «Ana le debe ‹US$45.00› a Luis». */
  const frase = (d: Deuda): [string, string] =>
    d.de === userId
      ? ['Tú le debes ', ` a ${nombre(d.a)}`]
      : d.a === userId
        ? [`${nombre(d.de)} te debe `, '']
        : [`${nombre(d.de)} le debe `, ` a ${nombre(d.a)}`]

  return (
    <ScrollView
      contentContainerStyle={styles.lista}
      keyboardShouldPersistTaps="handled"
    >
      <Card style={styles.form}>
        <CardKicker>Añadir gasto</CardKicker>
        <Input
          label="Concepto"
          placeholder="Ej.: cena en el malecón"
          value={concepto}
          onChangeText={setConcepto}
          maxLength={200}
          containerStyle={styles.hueco}
          error={errores.concepto ?? null}
        />
        <Input
          label={`Monto (${moneda})`}
          placeholder="0"
          value={monto}
          onChangeText={(t) => setMonto(t.replace(/[^\d.,]/g, ''))}
          keyboardType="decimal-pad"
          error={errores.monto ?? null}
          {...(variosMiembros
            ? {}
            : {
                hint: 'Por ahora solo estás tú: cuando se sume alguien podrás elegir quién pagó y entre quiénes se reparte.',
              })}
        />

        {variosMiembros ? (
          <>
            <Txt variant="label" style={styles.etiqueta} accessible={false}>
              Pagó
            </Txt>
            <ChipGroup
              label="Pagó"
              size="sm"
              options={opciones}
              value={pagadorEfectivo}
              onValueChange={setPagador}
            />

            <View style={styles.cabecera}>
              <Txt variant="label" accessible={false}>
                Entre quiénes
              </Txt>
              {todosMarcados ? null : (
                <Button
                  title="Marcar a todos"
                  variant="link"
                  size="sm"
                  onPress={() => {
                    setElegidos(null)
                    setErrores((e) => ({ ...e, participantes: undefined }))
                  }}
                />
              )}
            </View>
            <View
              role="group"
              accessibilityLabel="Entre quiénes"
              style={styles.chips}
            >
              {opciones.map((o) => (
                <Chip
                  key={o.value}
                  label={o.label}
                  role="checkbox"
                  size="sm"
                  selected={participantes.includes(o.value)}
                  onPress={() => alternar(o.value)}
                  accessibilityHint={errores.participantes ?? pistaReparto}
                />
              ))}
            </View>
            {errores.participantes ? (
              <Txt
                variant="caption"
                color="danger"
                style={styles.pista}
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
              >
                {errores.participantes}
              </Txt>
            ) : (
              <Txt variant="caption" color="fgMuted" style={styles.pista} tnum>
                {pistaReparto}
              </Txt>
            )}
          </>
        ) : null}

        <Button
          title="Añadir gasto"
          variant="tinta"
          icon={Plus}
          onPress={() => void anadir()}
          style={styles.boton}
        />
      </Card>

      {gastos.length === 0 ? (
        <EmptyState
          title="Sin gastos todavía"
          description="Anota quién paga qué y Wayio calcula quién le debe a quién."
        />
      ) : (
        <View style={styles.gastos}>
          {gastos.map((g) => {
            const pendiente = pendientes.has(g.id) || g.id.startsWith(TEMPORAL)
            const apunto =
              g.registrado_por && g.registrado_por !== g.pagado_por
                ? ` · Lo apuntó ${quien(g.registrado_por)}`
                : ''
            return (
              <View key={g.id} style={styles.gasto}>
                <View style={styles.flex}>
                  <Txt variant="label" numberOfLines={2}>
                    {g.concepto}
                  </Txt>
                  <Txt variant="caption" color="fgMuted">
                    {pendiente
                      ? 'Guardando…'
                      : `${g.pagado_por === userId ? 'Pagaste tú' : `Pagó ${nombre(g.pagado_por)}`} · ${formatFecha(g.created_at, { diaSemana: false })}`}
                  </Txt>
                  <Txt variant="caption" color="fgMuted">
                    {describirReparto(g)}
                    {apunto}
                  </Txt>
                </View>
                <Txt variant="label" tnum>
                  {importe(Number(g.monto))}
                </Txt>
              </View>
            )
          })}
        </View>
      )}

      {gastos.length > 0 ? (
        <Card style={styles.balances}>
          <CardKicker>Balances</CardKicker>
          <Txt variant="caption" color="fgMuted" style={styles.hueco} tnum>
            Total del grupo: {importe(total)}
            {yo
              ? ` · Tu parte: ${importe(yo.parte)} · Pagaste ${importe(yo.pagado)}`
              : ''}
          </Txt>
          {deudas.length === 0 ? (
            <Txt variant="bodyS" style={styles.hueco}>
              Están a mano: nadie le debe nada a nadie.
            </Txt>
          ) : (
            deudas.map((d) => {
              const [antes, despues] = frase(d)
              return (
                <Txt
                  key={`${d.de}-${d.a}`}
                  variant="bodyS"
                  style={styles.hueco}
                >
                  {antes}
                  <Txt variant="label" tnum>
                    {importe(d.monto)}
                  </Txt>
                  {despues}
                </Txt>
              )
            })
          )}
        </Card>
      ) : null}
    </ScrollView>
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    flex: { flex: 1 },
    lista: { padding: 16, paddingBottom: 48 },
    hueco: { marginTop: 10 },
    form: { padding: 16, marginBottom: 16 },
    etiqueta: { marginTop: 4, marginBottom: 8 },
    cabecera: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 16,
      marginBottom: 8,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pista: { marginTop: 8 },
    boton: { marginTop: 16 },
    gastos: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    gasto: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    balances: { marginTop: 16, padding: 16 },
  })
