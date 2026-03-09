import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo })
    // Log to error reporting service (e.g., Sentry) in production
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full card p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-danger-600/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} className="text-danger-400" />
            </div>
            
            <h1 className="font-display font-bold text-xl text-white mb-2">
              Something went wrong
            </h1>
            
            <p className="text-slate-400 text-sm mb-6">
              The application encountered an unexpected error. Try refreshing the page.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="text-left mb-6 p-4 rounded-lg bg-surface-800 border border-surface-700">
                <p className="text-xs text-danger-400 font-mono break-all">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo?.componentStack && (
                  <details className="mt-2">
                    <summary className="text-xs text-slate-500 cursor-pointer">
                      Component stack trace
                    </summary>
                    <pre className="text-xs text-slate-600 mt-1 overflow-auto max-h-40">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="btn-primary w-full justify-center gap-2"
            >
              <RefreshCw size={16} />
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
