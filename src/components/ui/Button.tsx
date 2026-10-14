import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
  Ref,
} from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

/**
 * Botón del sistema (docs/DISENO.md §5.1).
 *
 * Variantes: primary (uno por vista) · tinta · soft · outline · ghost · link ·
 * danger (solo en ConfirmDialog) · danger-outline. Alias @deprecated:
 * accent → primary, secondary → soft.
 * Tamaños: sm 36 · md 44 · lg 52 · xl 60 · icon 44 · icon-sm 36 · icon-lg 52.
 */
export type ButtonVariant =
  | 'primary'
  | 'tinta'
  | 'soft'
  | 'outline'
  | 'ghost'
  | 'link'
  | 'danger'
  | 'danger-outline'
  /** @deprecated usa 'primary' */
  | 'accent'
  /** @deprecated usa 'soft' */
  | 'secondary'

export type ButtonSize =
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | 'icon'
  | 'icon-sm'
  | 'icon-lg'

const BASE =
  'group relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-sans font-semibold ' +
  'transition-[background-color,color,border-color,transform] duration-(--dur-fast) ease-papel ' +
  'active:scale-[.98] active:duration-(--dur-instant) ' +
  'disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 ' +
  'aria-disabled:cursor-not-allowed aria-disabled:opacity-45 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

const VARIANTES: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-fg hover:bg-primary-hover active:bg-primary-pressed',
  accent:
    'bg-primary text-primary-fg hover:bg-primary-hover active:bg-primary-pressed',
  tinta:
    'bg-surface-inverse text-fg-inverse hover:bg-surface-inverse-hover focus-visible:outline-ring',
  soft: 'bg-surface-2 text-fg hover:bg-papel-300 dark:hover:bg-noche-800',
  secondary: 'bg-surface-2 text-fg hover:bg-papel-300 dark:hover:bg-noche-800',
  outline:
    'border border-border-strong bg-transparent text-fg hover:bg-surface-2',
  ghost: 'bg-transparent text-fg hover:bg-surface-2',
  link: 'h-auto min-h-0 px-0 rounded-sm text-accent underline decoration-1 underline-offset-[3px] hover:text-accent-hover active:scale-100',
  danger: 'bg-danger text-on-danger hover:bg-danger-hover',
  'danger-outline': 'border border-danger/40 text-danger hover:bg-danger-bg',
}

const TAMANOS: Record<ButtonSize, string> = {
  // `sm` amplía el área táctil hasta 44 px con un pseudo-elemento.
  sm: 'h-control-sm px-3.5 text-[14px] after:absolute after:-inset-1 [&_svg]:size-4',
  md: 'h-control-md px-[18px] text-[15px] [&_svg]:size-[18px]',
  lg: 'h-control-lg px-[22px] text-base [&_svg]:size-[18px]',
  xl: 'h-control-xl px-7 text-[17px] [&_svg]:size-5',
  icon: 'size-control-md p-0 [&_svg]:size-[18px]',
  'icon-sm':
    'size-control-sm p-0 after:absolute after:-inset-1 [&_svg]:size-[18px]',
  'icon-lg': 'size-control-lg p-0 [&_svg]:size-[18px]',
}

export interface ButtonStyleOptions {
  variant?: ButtonVariant | undefined
  size?: ButtonSize | undefined
  fullWidth?: boolean | undefined
  className?: string | undefined
}

/** Clases del botón, para aplicarlas a otros elementos (p. ej. un <label>). */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
}: ButtonStyleOptions = {}): string {
  return cn(
    BASE,
    TAMANOS[size],
    VARIANTES[variant],
    '[&_svg]:shrink-0',
    fullWidth && 'w-full',
    className
  )
}

/** Spinner de aro de 16 px (ocupa el sitio del icono inicial). */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent',
        className
      )}
    />
  )
}

interface ContenidoProps {
  icon?: ReactNode
  iconEnd?: ReactNode
  loading?: boolean
  loadingText?: string | undefined
  children?: ReactNode
}

function Contenido({
  icon,
  iconEnd,
  loading,
  loadingText,
  children,
}: ContenidoProps) {
  return (
    <>
      {loading ? (
        <Spinner />
      ) : icon ? (
        <span aria-hidden="true" className="inline-flex">
          {icon}
        </span>
      ) : null}
      {loading && loadingText ? loadingText : children}
      {iconEnd ? (
        <span
          aria-hidden="true"
          className="inline-flex transition-transform duration-(--dur-fast) ease-papel group-hover:translate-x-0.5"
        >
          {iconEnd}
        </span>
      ) : null}
    </>
  )
}

export interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    Omit<ButtonStyleOptions, 'className'> {
  /** Muestra el spinner, deshabilita y marca aria-busy. */
  loading?: boolean
  /** Etiqueta en gerundio mientras carga («Guardando…»). */
  loadingText?: string
  /** Icono inicial (lucide); se sustituye por el spinner al cargar. */
  icon?: ReactNode
  /** Icono final; se desplaza 2 px en hover (flecha del CTA). */
  iconEnd?: ReactNode
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText,
  fullWidth = false,
  icon,
  iconEnd,
  className,
  children,
  disabled,
  type = 'button',
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses({ variant, size, fullWidth, className })}
      disabled={Boolean(disabled) || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      <Contenido
        icon={icon}
        iconEnd={iconEnd}
        loading={loading}
        loadingText={loadingText}
      >
        {children}
      </Contenido>
    </button>
  )
}

export interface IconButtonProps extends Omit<
  ButtonProps,
  'aria-label' | 'children' | 'icon' | 'iconEnd'
> {
  /** Texto accesible obligatorio (los botones solo-icono lo exigen). */
  label: string
  children: ReactNode
}

/** Botón de solo icono con aria-label obligatorio. Por defecto ghost 44. */
export function IconButton({
  label,
  variant = 'ghost',
  size = 'icon',
  title,
  children,
  ...props
}: IconButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      aria-label={label}
      title={title ?? label}
      icon={children}
      {...props}
    />
  )
}

export interface ButtonLinkProps
  extends
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>,
    Omit<ButtonStyleOptions, 'className'> {
  href: string
  icon?: ReactNode
  iconEnd?: ReactNode
  /** Navega sin prefetch (rutas pesadas o externas). */
  prefetch?: boolean
  ref?: Ref<HTMLAnchorElement>
}

/**
 * Enlace con forma de botón (next/link; <a> para externos y mailto). Si abre
 * otra pestaña añade noopener y noreferrer al rel que se pase.
 */
export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon,
  iconEnd,
  className,
  children,
  target,
  rel,
  prefetch,
  ref,
  onClick,
  onMouseEnter,
  onTouchStart,
  ...props
}: ButtonLinkProps) {
  // next/link no admite manejadores `undefined` con exactOptionalPropertyTypes.
  const manejadores = {
    ...(onClick ? { onClick } : {}),
    ...(onMouseEnter ? { onMouseEnter } : {}),
    ...(onTouchStart ? { onTouchStart } : {}),
  }
  // Con target=_blank siempre van noopener y noreferrer (§13.16), sumados a
  // lo que pase el llamador (p. ej. «sponsored» en los enlaces patrocinados).
  const relFinal =
    target === '_blank'
      ? Array.from(
          new Set([
            ...(rel ?? '').split(/\s+/).filter(Boolean),
            'noopener',
            'noreferrer',
          ])
        ).join(' ')
      : rel
  const externo = /^(https?:)?\/\//.test(href) || href.startsWith('mailto:')
  const clases = buttonClasses({ variant, size, fullWidth, className })
  const contenido = (
    <Contenido icon={icon} iconEnd={iconEnd}>
      {children}
    </Contenido>
  )

  if (externo) {
    return (
      <a
        ref={ref}
        href={href}
        target={target}
        rel={relFinal}
        className={clases}
        {...manejadores}
        {...props}
      >
        {contenido}
      </a>
    )
  }
  return (
    <Link
      ref={ref}
      href={href}
      target={target}
      rel={relFinal}
      className={clases}
      {...(prefetch === undefined ? {} : { prefetch })}
      {...manejadores}
      {...props}
    >
      {contenido}
    </Link>
  )
}
