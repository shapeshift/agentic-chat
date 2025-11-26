import { Buffer } from 'buffer'

import mixpanel from 'mixpanel-browser'
import { StrictMode } from 'react'
import * as ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import App from './app/app'

// Polyfill Buffer for Solana SDK
window.Buffer = Buffer

// Initialize Mixpanel
mixpanel.init('c7ded934ffc012d90c2c3f3f2e8fd8aa', {
  debug: true,
  track_pageview: true,
  persistence: 'localStorage',
  autocapture: true,
  record_sessions_percent: 100,
})

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)

root.render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
