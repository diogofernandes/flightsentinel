import React, { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useTelemetry } from './hooks/useTelemetry'
import TopBar from './components/TopBar'
import InstrumentReadout from './components/InstrumentReadout'
import ScoreBar from './components/ScoreBar'
const LiveChart = lazy(() => import('./components/LiveChart'))
import AlertLog from './components/AlertLog'

const INSTRUMENTS = [
  { key: 'altitude', label: 'ALT', unit: 'FT', format: v => Math.round(v).toLocaleString() },
  { key: 'airspeed', label: 'IAS', unit: 'KTS', format: v => v.toFixed(1) },
  { key: 'pitch', label: 'PITCH', unit: 'DEG', format: v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}` },
  { key: 'roll', label: 'ROLL', unit: 'DEG', format: v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}` },
  { key: 'vsi', label: 'VSI', unit: 'FPM', format: v => `${v >= 0 ? '+' : ''}${Math.round(v)}` },
  { key: 'heading', label: 'HDG', unit: 'DEG', format: v => String(Math.round(v) % 360).padStart(3, '0') },
]

export default function App() {
  const { frame, history, status, togglePause, showEvent } = useTelemetry()
  const replay = import.meta.env.VITE_DEMO_MODE === 'replay'
  const [alerts, setAlerts] = useState([])
  const seenEvents = useRef({ session: null, id: 0 })

  useEffect(() => {
    if (!frame) return
    if (seenEvents.current.session !== frame.session_id) {
      seenEvents.current = { session: frame.session_id, id: 0 }
      setAlerts([])
    }
    const event = frame.latest_event
    if (event && event.id > seenEvents.current.id) {
      seenEvents.current.id = event.id
      setAlerts(previous => [{
        ...event, id: `${frame.session_id}:${event.id}`,
        time: `${event.timestamp.toFixed(1)}s`,
      }, ...previous].slice(0, 100))
    }
  }, [frame])

  const live = ['live', 'replay', 'paused'].includes(status) && Boolean(frame)
  return (
    <div className="app">
      <TopBar status={status} alert={live && frame.alert} replay={replay} />
      <div className="demo-notice">
        {replay
          ? 'RECORDED SYNTHETIC REPLAY · Actual Python-model output · No live backend or browser inference · 90-second recording loops · Score is not a probability'
          : 'SYNTHETIC DEMONSTRATOR · Seeded signals, not aircraft data · 120-second sessions repeat · Score is not a probability'}
      </div>
      {replay && <div className="replay-controls">
        <button disabled={!live} onClick={togglePause}>{status === 'paused' ? 'Resume replay' : 'Pause replay'}</button>
        <button disabled={!live} onClick={showEvent}>Show an anomaly</button>
        <span>Starts just before an injected event. Hover charts to inspect readings.</span>
      </div>}
      <main className="dashboard">
        <aside className="left-panel">
          <section>
            <h2>FLIGHT INSTRUMENTS</h2>
            <div className="instruments">
              {INSTRUMENTS.map(({ key, ...props }) => (
                <InstrumentReadout key={key} {...props} value={live ? frame[key] : null} />
              ))}
            </div>
          </section>
          <section>
            <h2>MODEL OUTPUT</h2>
            <ScoreBar score={live ? frame.score : null}
              threshold={frame?.threshold} alert={live && frame.alert} available={live} />
            <p className="explanation">
              Three high frames confirm an alert; five low frames clear it.
              The threshold comes from separate normal calibration data.
            </p>
          </section>
          <section>
            <AlertLog alerts={alerts} onClear={() => setAlerts([])} />
            <p className="explanation">
              Simulation time · Latest 100 events observed by this browser.
              {replay ? 'Replay restarts reset the log; event states come from the saved Python run.' : 'Refresh clears the log; reconnect restores only the latest server event.'}
            </p>
          </section>
        </aside>
        <section className="chart-panel">
          <h2>TELEMETRY · LAST 30 SIMULATION SECONDS</h2>
          <Suspense fallback={<p className="explanation">Loading charts…</p>}>
            <LiveChart history={history} threshold={frame?.threshold ?? history.at(-1)?.threshold} />
          </Suspense>
          <p className="explanation">
            {live
              ? `${replay ? 'Recorded replay' : 'Shared stream'} · Frame ${frame.sequence} · Injected scenario: ${frame.is_anomaly ? 'active' : 'inactive'}`
              : 'Telemetry unavailable. Readings are hidden until fresh, valid data arrives.'}
          </p>
        </section>
      </main>
    </div>
  )
}
