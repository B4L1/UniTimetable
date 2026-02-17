import React from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, background: '#111', color: '#ff5555', height: '100vh', overflow: 'auto', fontFamily: 'monospace' }}>
          <h1>Something went wrong.</h1>
          <h2 style={{ marginTop: 20, marginBottom: 10 }}>Error:</h2>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#222', padding: 10, borderRadius: 5 }}>{this.state.error?.toString()}</pre>
          <h2 style={{ marginTop: 20, marginBottom: 10 }}>Stack:</h2>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#222', padding: 10, borderRadius: 5 }}>{this.state.error?.stack}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
