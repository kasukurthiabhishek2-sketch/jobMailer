import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled application error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: 'var(--bg-primary, #0f172a)',
          color: 'var(--text-primary, #f8fafc)',
          fontFamily: 'Inter, system-ui, sans-serif',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '520px',
            background: 'var(--bg-secondary, #1e293b)',
            padding: '2.5rem',
            borderRadius: '1rem',
            border: '1px solid var(--border-color, #334155)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.75rem', color: '#f87171' }}>
              Something went wrong
            </h2>
            <p style={{ color: 'var(--text-secondary, #94a3b8)', marginBottom: '1.5rem', fontSize: '0.95rem', lineHeight: '1.5' }}>
              An unexpected error occurred while rendering the application.
            </p>
            {this.state.error?.message && (
              <pre style={{
                background: '#0a0f1d',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
                color: '#e2e8f0',
                overflowX: 'auto',
                marginBottom: '1.5rem',
                textAlign: 'left'
              }}>
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#6366f1',
                color: '#ffffff',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.95rem'
              }}
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
