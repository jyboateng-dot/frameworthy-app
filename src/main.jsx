import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { initErrorLogging } from './services/errorLogging.js'

initErrorLogging();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

// ErrorBoundary sets this flag right before its one auto-reload for a
// stale-chunk failure (see its comment for why that happens). If the app is
// still running several seconds after this fresh load, the reload worked —
// clear the flag so a later, unrelated deploy occurring later in the same
// tab session still gets its own auto-reload instead of being silently
// blocked by this run's now-stale guard.
setTimeout(() => {
  try {
    sessionStorage.removeItem('fw_chunk_reload_attempted');
  } catch {
    // Private browsing / storage disabled — nothing to clear.
  }
}, 5000);
