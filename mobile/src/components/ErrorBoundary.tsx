import { Component, type ReactNode } from 'react'

interface Props {
  fallback: ReactNode
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Minimal error boundary. Used to wrap the lazily-loaded native map so that, in
 * environments without the native module (e.g. Expo Go), the rest of the screen
 * keeps working and a friendly fallback is shown instead of a red screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}
