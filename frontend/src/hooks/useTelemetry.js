import { useEffect, useRef, useState } from 'react'
import { createTelemetryClient, telemetryUrl } from '../telemetry'
import { createRecordedClient } from '../replay'

export function useTelemetry() {
  const [frame, setFrame] = useState(null)
  const [history, setHistory] = useState([])
  const [status, setStatus] = useState('connecting')
  const recorded = useRef(null)

  useEffect(() => {
    if (import.meta.env.VITE_DEMO_MODE === 'replay') {
      const client = createRecordedClient({
        url: `${import.meta.env.BASE_URL}project/demo-data.json`,
        onStatus: next => { setStatus(next); if (next === 'error') { setFrame(null); setHistory([]) } },
        onFrame: (next, previous) => { setFrame(next); setHistory(previous) },
      })
      recorded.current = client
      return () => { client.dispose(); recorded.current = null }
    }
    let session = null
    let sequence = 0
    let url
    try {
      url = telemetryUrl(window.location, import.meta.env.VITE_TELEMETRY_URL)
    } catch {
      setStatus('error')
      return
    }
    return createTelemetryClient({
      url,
      onStatus: next => {
        setStatus(next)
        if (next !== 'live') setFrame(null)
        // Do not connect chart lines across a transport outage.
        if (['stale', 'error', 'reconnecting'].includes(next)) setHistory([])
      },
      onFrame: next => {
        const newSession = session !== next.session_id
        if (!newSession && next.sequence <= sequence) return
        session = next.session_id
        sequence = next.sequence
        setFrame(next)
        setHistory(previous => [
          ...(newSession ? [] : previous).filter(f => f.timestamp > next.timestamp - 30),
          next,
        ].slice(-300))
      },
    })
  }, [])

  return { frame, history, status, togglePause: () => recorded.current?.togglePause(),
    showEvent: () => recorded.current?.showEvent() }
}
