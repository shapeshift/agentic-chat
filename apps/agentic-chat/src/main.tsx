import { Buffer } from 'buffer'

import mixpanel from 'mixpanel-browser'
import { StrictMode } from 'react'
import * as ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './app/app'

// Polyfill Buffer for Solana SDK
window.Buffer = Buffer

// Initialize Mixpanel (disabled in dev unless VITE_ENABLE_ANALYTICS is set)
const isProduction = import.meta.env.PROD
const analyticsEnabled = isProduction || import.meta.env.VITE_ENABLE_ANALYTICS === 'true'

mixpanel.init('c7ded934ffc012d90c2c3f3f2e8fd8aa', {
  debug: !isProduction,
  track_pageview: analyticsEnabled,
  persistence: 'localStorage',
  autocapture: analyticsEnabled,
  record_sessions_percent: analyticsEnabled ? 100 : 0,
  opt_out_tracking_by_default: !analyticsEnabled,
})

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)

root.render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
