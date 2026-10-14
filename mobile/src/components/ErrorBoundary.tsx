import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  /** Contenido de reserva, o una función que recibe `reintentar`. */
  fallback: ReactNode | ((reintentar: () => void) => ReactNode)
  children: ReactNode
  /** Aviso opcional (registro de errores). */
  onError?: (error: Error, info: ErrorInfo) => void
}

interface State {
  hasError: boolean
}

/**
 * Límite de errores. Envuelve la app entera (App.tsx, M18) y también el mapa
 * nativo cargado en diferido, para que un fallo muestre una pantalla amable en
 * vez de la pantalla roja o una app en blanco.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info)
  }

  reintentar = (): void => {
    this.setState({ hasError: false })
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children
    const { fallback } = this.props
    return typeof fallback === 'function' ? fallback(this.reintentar) : fallback
  }
}
