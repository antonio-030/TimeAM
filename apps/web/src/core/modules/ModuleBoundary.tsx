/**
 * ModuleBoundary
 *
 * Error Boundary für Feature-Module.
 * Fängt Fehler in Modulen ab, ohne die gesamte App zum Absturz zu bringen.
 * Core-Module und andere Bereiche bleiben funktionsfähig.
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';

interface ModuleBoundaryProps {
  /** Modul-ID für Logging und Anzeige */
  moduleId: string;
  
  /** Anzeigename des Moduls */
  moduleName: string;
  
  /** Children (das eigentliche Modul) */
  children: ReactNode;
  
  /** Optionales Fallback-Element */
  fallback?: ReactNode;
}

interface ModuleBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary Komponente für Module.
 * Isoliert Fehler in einzelnen Modulen.
 */
export class ModuleBoundary extends Component<ModuleBoundaryProps, ModuleBoundaryState> {
  constructor(props: ModuleBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ModuleBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Logging für Debugging
    console.error(`[ModuleBoundary] Fehler in Modul "${this.props.moduleId}":`, error);
    console.error('[ModuleBoundary] Component Stack:', errorInfo.componentStack);
    
    // Hier könnte man auch an einen Error-Tracking-Service senden (z.B. Sentry)
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { moduleName, children, fallback } = this.props;

    if (hasError) {
      // Custom Fallback oder Default
      if (fallback) {
        return fallback;
      }

      return (
        <div style={styles.container}>
          <div style={styles.icon}>⚠️</div>
          <h2 style={styles.title}>
            {moduleName} konnte nicht geladen werden
          </h2>
          <p style={styles.message}>
            Es ist ein unerwarteter Fehler aufgetreten. Die restliche Anwendung
            funktioniert weiterhin normal.
          </p>
          {error && (
            <details style={styles.details}>
              <summary style={styles.summary}>Technische Details</summary>
              <pre style={styles.errorText}>{error.message}</pre>
            </details>
          )}
          <button onClick={this.handleRetry} style={styles.retryButton}>
            Erneut versuchen
          </button>
        </div>
      );
    }

    return children;
  }
}

// Inline Styles für Error UI (kein CSS-Module nötig)
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    minHeight: '300px',
    backgroundColor: 'var(--surface-primary, #fff)',
    borderRadius: '12px',
    border: '1px solid var(--border-subtle, #e5e7eb)',
    textAlign: 'center',
  },
  icon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: 'var(--text-primary, #111827)',
    margin: '0 0 0.5rem 0',
  },
  message: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary, #6b7280)',
    margin: '0 0 1.5rem 0',
    maxWidth: '400px',
  },
  details: {
    marginBottom: '1.5rem',
    textAlign: 'left',
    width: '100%',
    maxWidth: '400px',
  },
  summary: {
    cursor: 'pointer',
    fontSize: '0.875rem',
    color: 'var(--text-secondary, #6b7280)',
  },
  errorText: {
    fontSize: '0.75rem',
    fontFamily: 'monospace',
    backgroundColor: 'var(--surface-secondary, #f9fafb)',
    padding: '0.75rem',
    borderRadius: '6px',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: 'var(--text-error, #dc2626)',
    marginTop: '0.5rem',
  },
  retryButton: {
    padding: '0.625rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#fff',
    backgroundColor: 'var(--brand-primary, #3b82f6)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
};

export default ModuleBoundary;
