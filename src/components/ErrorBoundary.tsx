import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  private handleReload = () => {
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="app-shell min-h-screen flex items-center justify-center">
          <div className="error-card max-w-md w-full p-6 rounded-lg">
            <div className="flex items-center mb-4">
              <AlertCircle className="tree-menu-danger h-8 w-8 mr-3" />
              <h1 className="text-xl font-semibold">
                Something went wrong
              </h1>
            </div>
            
            <div className="mb-6">
              <p className="sidebar-muted mb-2">
                An unexpected error occurred. The error has been logged and we'll look into it.
              </p>
              
              {this.state.error && (
                <details className="mt-4">
                  <summary className="sidebar-muted cursor-pointer text-sm">
                    Technical details
                  </summary>
                  <pre className="error-details mt-2 p-2 rounded text-xs overflow-auto">
                    {this.state.error.toString()}
                    {this.state.errorInfo && (
                      <>
                        {'\n\nComponent Stack:'}
                        {this.state.errorInfo.componentStack}
                      </>
                    )}
                  </pre>
                </details>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="error-secondary-button flex-1 px-4 py-2 rounded transition-colors"
              >
                Try Again
              </button>
              
              <button
                onClick={this.handleReload}
                className="error-primary-button flex-1 px-4 py-2 rounded transition-colors flex items-center justify-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reload App
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// HOC for functional components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  )
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}
