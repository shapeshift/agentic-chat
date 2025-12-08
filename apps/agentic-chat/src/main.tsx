import { Buffer } from 'buffer'

import * as Sentry from '@sentry/react'
import mixpanel from 'mixpanel-browser'
import { StrictMode } from 'react'
import * as ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { isUserCancellation } from '@/utils/walletErrors'

import App from './app/app'

// Polyfill Buffer for Solana SDK
window.Buffer = Buffer

// Initialize Sentry
Sentry.init({
  dsn: 'https://5029b06bf89b9e74ac64b3b8fc3e379d@o4507174990905344.ingest.de.sentry.io/4510434281783376',
  sendDefaultPii: false,
  enableLogs: true,
  beforeSend(event, hint) {
    const error = hint.originalException
    if (isUserCancellation(error)) {
      return null
    }

    // Filter HMR/react-refresh errors (dev-only)
    const frames = event.exception?.values?.[0]?.stacktrace?.frames
    if (frames?.some(frame => frame.filename?.includes('@react-refresh'))) {
      return null
    }

    return event
  },
})

// Initialize Mixpanel (disabled in dev unless VITE_ENABLE_ANALYTICS is set)
const isProduction = import.meta.env.PROD
const analyticsEnabled = isProduction || import.meta.env.VITE_ENABLE_ANALYTICS === 'true'

if (analyticsEnabled) {
  mixpanel.init('c7ded934ffc012d90c2c3f3f2e8fd8aa', {
    debug: !isProduction,
    track_pageview: false,
    persistence: 'localStorage',
    autocapture: false,
  })
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)

root.render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
