import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './App.css'

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)

    this.state = {
      error: null
    }
  }

  static getDerivedStateFromError(error) {
    return {
      error
    }
  }

  componentDidCatch(error, info) {
    console.error(
      'OU The Builder WBA startup error:',
      error,
      info
    )
  }

  render() {
    if (this.state.error) {
      const message =
        this.state.error?.stack ||
        this.state.error?.message ||
        String(this.state.error)

      return (
        <div
          style={{
            minHeight: '100vh',
            boxSizing: 'border-box',
            padding: '24px',
            background: '#050816',
            color: '#eef4ff',
            fontFamily:
              'Inter, system-ui, -apple-system, sans-serif'
          }}
        >
          <div
            style={{
              maxWidth: '760px',
              margin: '40px auto',
              padding: '24px',
              borderRadius: '16px',
              border:
                '1px solid rgba(255,90,110,.4)',
              background: '#0c1229',
              boxShadow:
                '0 20px 60px rgba(0,0,0,.35)'
            }}
          >
            <div
              style={{
                color: '#6f9dff',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '1.5px',
                marginBottom: '10px'
              }}
            >
              OU THE BUILDER
            </div>

            <h1 style={{ marginTop: 0 }}>
              WBA Startup Error
            </h1>

            <p
              style={{
                color: '#8b99b5',
                lineHeight: 1.6
              }}
            >
              The GitHub Pages site loaded, but the
              application encountered a JavaScript
              error while starting.
            </p>

            <pre
              style={{
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                padding: '16px',
                borderRadius: '10px',
                background: '#03050d',
                color: '#ff9eaa',
                fontSize: '12px',
                lineHeight: 1.6,
                overflow: 'auto'
              }}
            >
              {message}
            </pre>

            <p
              style={{
                color: '#687690',
                fontSize: '12px'
              }}
            >
              This diagnostic screen was added
              automatically by the WBA startup
              diagnostic workflow.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

const rootElement =
  document.getElementById('root')

if (!rootElement) {
  document.body.innerHTML = `
    <div style="
      min-height:100vh;
      box-sizing:border-box;
      padding:24px;
      background:#050816;
      color:#eef4ff;
      font-family:system-ui,sans-serif;
    ">
      <h1>OU The Builder</h1>
      <h2>Startup Error</h2>
      <p>
        The application could not find the
        React root element.
      </p>
    </div>
  `
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>
  )
}
