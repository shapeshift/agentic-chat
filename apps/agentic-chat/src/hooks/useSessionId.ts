import { useMemo } from 'react'

const SESSION_ID_KEY = 'shapeshift_session_id'

export const useSessionId = (): string => {
  return useMemo(() => {
    let sessionId = localStorage.getItem(SESSION_ID_KEY)
    if (!sessionId) {
      sessionId = `session-${crypto.randomUUID()}`
      localStorage.setItem(SESSION_ID_KEY, sessionId)
    }
    return sessionId
  }, [])
}
