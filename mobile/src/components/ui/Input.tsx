import { useState, type ReactNode, type Ref } from 'react'
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useEstilos, useTheme, type Tema } from '../../theme'
import { Txt } from './Txt'
import { AlertCircle, type LucideIcon } from './iconos'

export interface InputProps extends Omit<
  TextInputProps,
  'style' | 'editable' | 'placeholderTextColor'
> {
  /** Etiqueta visible (obligatoria: nunca solo placeholder). */
  label: string
  /** Oculta la etiqueta visual (sigue siendo la etiqueta accesible). */
  hideLabel?: boolean
  hint?: string
  error?: string | null
  optional?: boolean
  icon?: LucideIcon
  /** Contenido a la derecha dentro del campo (botón ojo, moneda…). */
  suffix?: ReactNode
  disabled?: boolean
  /** lg = 52 (por defecto), md = 44. */
  fieldSize?: 'lg' | 'md'
  containerStyle?: StyleProp<ViewStyle>
  inputStyle?: StyleProp<TextStyle>
  inputRef?: Ref<TextInput>
  /** Contador «124/600» (requiere maxLength o limite). */
  showCount?: boolean
  limite?: number
}

/** Campo de texto con label, hint y error (§5.2). Texto a 16 px. */
export function Input({
  label,
  hideLabel = false,
  hint,
  error,
  optional = false,
  icon: Icono,
  suffix,
  disabled = false,
  fieldSize = 'lg',
  containerStyle,
  inputStyle,
  inputRef,
  showCount = false,
  limite,
  multiline,
  value,
  maxLength,
  onFocus,
  onBlur,
  ...rest
}: InputProps): React.ReactElement {
  const tema = useTheme()
  const { colors } = tema
  const styles = useEstilos(crearEstilos)
  const [foco, setFoco] = useState(false)
  const hayError = Boolean(error)
  const tope = limite ?? maxLength
  const largo = value?.length ?? 0

  return (
    <View style={[styles.wrap, containerStyle]}>
      {!hideLabel ? (
        <Txt variant="label" style={styles.label} accessible={false}>
          {label}
          {optional ? (
            <Txt variant="label" color="fgSubtle" style={styles.opcional}>
              {' '}
              (opcional)
            </Txt>
          ) : null}
        </Txt>
      ) : null}
      <View
        style={[
          styles.campo,
          multiline
            ? styles.campoMulti
            : { height: fieldSize === 'lg' ? 52 : 44 },
          foco ? styles.campoFoco : null,
          hayError ? styles.campoError : null,
          disabled ? styles.campoInactivo : null,
        ]}
      >
        {Icono ? (
          <View style={[styles.icono, multiline ? styles.iconoMulti : null]}>
            <Icono
              size={18}
              color={colors.fgSubtle}
              strokeWidth={1.75}
              accessible={false}
            />
          </View>
        ) : null}
        <TextInput
          ref={inputRef}
          {...rest}
          {...(value !== undefined ? { value } : {})}
          {...(maxLength !== undefined ? { maxLength } : {})}
          multiline={multiline ?? false}
          editable={!disabled}
          accessibilityLabel={optional ? `${label} (opcional)` : label}
          accessibilityHint={error ?? hint ?? undefined}
          accessibilityState={{ disabled }}
          placeholderTextColor={colors.fgSubtle}
          selectionColor={colors.ring}
          cursorColor={colors.fg}
          maxFontSizeMultiplier={1.4}
          onFocus={(e) => {
            setFoco(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFoco(false)
            onBlur?.(e)
          }}
          style={[
            styles.input,
            multiline ? styles.inputMulti : null,
            disabled ? styles.inputInactivo : null,
            inputStyle,
          ]}
        />
        {suffix ? <View style={styles.sufijo}>{suffix}</View> : null}
      </View>
      {hayError ? (
        <View
          style={styles.mensaje}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          <AlertCircle
            size={16}
            color={colors.danger}
            strokeWidth={1.75}
            accessible={false}
          />
          <Txt variant="bodyS" color="danger" style={styles.mensajeTexto}>
            {error}
          </Txt>
        </View>
      ) : hint || (showCount && tope) ? (
        <View style={styles.pie}>
          {hint ? (
            <Txt variant="caption" color="fgMuted" style={styles.hint}>
              {hint}
            </Txt>
          ) : (
            <View style={styles.hint} />
          )}
          {showCount && tope ? (
            <Txt
              variant="data"
              tnum
              color={largo >= tope - 40 ? 'warning' : 'fgSubtle'}
              style={styles.contador}
              accessibilityLabel={`${largo} de ${tope} caracteres`}
            >
              {largo}/{tope}
            </Txt>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

/** Textarea con crecimiento hasta 280 px y contador opcional. */
export function TextArea(
  props: Omit<InputProps, 'multiline'> & { minHeight?: number }
): React.ReactElement {
  const { minHeight = 128, inputStyle, ...rest } = props
  return (
    <Input
      {...rest}
      multiline
      textAlignVertical="top"
      inputStyle={[{ minHeight, maxHeight: 280 }, inputStyle]}
    />
  )
}

const crearEstilos = (t: Tema) =>
  StyleSheet.create({
    wrap: { marginBottom: 16 },
    label: { marginBottom: 6 },
    opcional: { fontFamily: t.fonts.sans },
    campo: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: t.colors.borderStrong,
      borderRadius: t.radius.control,
      backgroundColor: t.colors.surface,
      overflow: 'hidden',
    },
    campoMulti: { alignItems: 'flex-start' },
    campoFoco: {
      borderColor: t.colors.ring,
      borderWidth: 2,
      shadowColor: t.colors.ring,
      shadowOpacity: 0.22,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 0 },
    },
    campoError: { borderColor: t.colors.danger, borderWidth: 2 },
    campoInactivo: { backgroundColor: t.colors.surface2 },
    icono: { paddingLeft: 14, paddingRight: 2 },
    iconoMulti: { paddingTop: 15 },
    input: {
      flex: 1,
      alignSelf: 'stretch',
      paddingHorizontal: 14,
      fontFamily: t.fonts.sans,
      fontSize: 16,
      color: t.colors.fg,
    },
    inputMulti: {
      paddingTop: 14,
      paddingBottom: 14,
      lineHeight: 24,
    },
    inputInactivo: { color: t.colors.fgSubtle },
    sufijo: { paddingRight: 6, flexDirection: 'row', alignItems: 'center' },
    mensaje: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
      marginTop: 6,
    },
    mensajeTexto: { flex: 1, fontSize: 14, lineHeight: 20 },
    pie: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 6,
    },
    hint: { flex: 1 },
    contador: { fontSize: 12 },
  })
