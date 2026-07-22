// App.jsx
//
// THE ROOT COMPONENT — assembles all pieces into the cockpit layout.
//
// COMPONENT TREE:
//   App
//   ├── TopBar          — header with title, status, alert banner
//   └── main layout
//       ├── Left panel
//       │   ├── InstrumentReadout x6   — ALT, IAS, PITCH, ROLL, VSI, HDG
//       │   ├── ScoreBar               — anomaly score gauge
//       │   └── AlertLog               — table of anomaly events
//       └── Right panel
//           └── LiveChart              — 4 stacked real-time charts
//
// DATA FLOW:
//   useTelemetry() hook → frame, history, status
//   frame   → InstrumentReadouts, ScoreBar, TopBar
//   history → LiveChart
//   alerts  → AlertLog (derived from frame in useEffect below)

import React, { useState, useEffect, useRef } from 'react'

import { useTelemetry }       from './hooks/useTelemetry'
import TopBar                 from './components/TopBar'
import InstrumentReadout      from './components/InstrumentReadout'
import ScoreBar               from './components/ScoreBar'
import LiveChart              from './components/LiveChart'
import AlertLog               from './components/AlertLog'

// Maximum number of alert events to keep in the log
const MAX_ALERTS = 100

export default function App() {
  // --- Get live telemetry from the WebSocket hook ---
  const { frame, history, status } = useTelemetry()

  // --- Alert log state ---
  // alerts: array of past anomaly events (one per rising edge)
  // alertIdRef: auto-incrementing ID for each alert (useRef = no re-render)
  const [alerts,  setAlerts]  = useState([])
  const alertIdRef            = useRef(0)

  // --- Track previous alert state for rising-edge detection ---
  // "Rising edge" means: alert was false last frame, true this frame.
  // We only log one row per anomaly EVENT, not per anomaly FRAME.
  const prevAlertRef = useRef(false)

  // --- Effect: detect new anomaly events ---
  // useEffect runs after every render where `frame` changed.
  useEffect(() => {
    if (!frame) return

    const wasAlert  = prevAlertRef.current
    const isAlert   = frame.alert
    prevAlertRef.current = isAlert

    // Rising edge: anomaly just started
    if (isAlert && !wasAlert) {
      const now = new Date()
      const timeStr = now.toTimeString().slice(0, 8)  // "HH:MM:SS"

      const newAlert = {
        id:       alertIdRef.current++,
        time:     timeStr,
        score:    frame.score,
        altitude: frame.altitude,
        airspeed: frame.airspeed,
        pitch:    frame.pitch,
        roll:     frame.roll,
        vsi:      frame.vsi,
      }

      // Add new alert at the beginning (newest first), cap at MAX_ALERTS
      setAlerts(prev => [newAlert, ...prev].slice(0, MAX_ALERTS))
    }
  }, [frame])  // only re-run when frame changes

  // --- Derived values ---
  // Use frame values if we have them, otherwise show defaults
  const score     = frame?.score     ?? 0
  const isAlert   = frame?.alert     ?? false

  return (
    <div style={styles.root}>

      {/* ── Header ── */}
      <TopBar status={status} alert={isAlert} />

      {/* ── Main layout: left panel + right panel ── */}
      <div style={styles.layout}>

        {/* ── LEFT PANEL ── */}
        <div style={styles.leftPanel}>

          {/* Instrument readouts — 2 rows of 3 */}
          <section style={styles.section}>
            <div style={styles.sectionLabel}>FLIGHT INSTRUMENTS</div>
            <div style={styles.instrumentsGrid}>
              <InstrumentReadout
                label="ALT"
                value={frame?.altitude}
                unit="FT"
                format={v => Math.round(v).toLocaleString()}
                warnBelow={500}
                warnAbove={15000}
              />
              <InstrumentReadout
                label="IAS"
                value={frame?.airspeed}
                unit="KTS"
                format={v => v.toFixed(1)}
                warnBelow={55}
                warnAbove={200}
              />
              <InstrumentReadout
                label="PITCH"
                value={frame?.pitch}
                unit="DEG"
                format={v => (v >= 0 ? '+' : '') + v.toFixed(1)}
                warnAbove={20}
                warnBelow={-20}
              />
              <InstrumentReadout
                label="ROLL"
                value={frame?.roll}
                unit="DEG"
                format={v => (v >= 0 ? '+' : '') + v.toFixed(1)}
                warnAbove={45}
                warnBelow={-45}
              />
              <InstrumentReadout
                label="VSI"
                value={frame?.vsi}
                unit="FPM"
                format={v => (v >= 0 ? '+' : '') + Math.round(v)}
                warnAbove={1800}
                warnBelow={-1800}
              />
              <InstrumentReadout
                label="HDG"
                value={frame?.heading}
                unit="DEG"
                format={v => Math.round(v).toString().padStart(3, '0')}
              />
            </div>
          </section>

          {/* Anomaly score bar */}
          <section style={styles.section}>
            <div style={styles.sectionLabel}>ML ANOMALY SCORE</div>
            <ScoreBar score={score} threshold={0.65} />
          </section>

          {/* Alert log */}
          <section style={{ ...styles.section, flex: 1 }}>
            <AlertLog
              alerts={alerts}
              onClear={() => setAlerts([])}
            />
          </section>

        </div>

        {/* ── RIGHT PANEL — live charts ── */}
        <div style={styles.rightPanel}>
          <div style={styles.sectionLabel}>
            LIVE TELEMETRY — LAST 30 SECONDS
          </div>
          <div style={{ flex: 1 }}>
            <LiveChart history={history} />
          </div>
        </div>

      </div>

    </div>
  )
}

// --- Layout styles ---
const styles = {
  root: {
    display:       'flex',
    flexDirection: 'column',
    height:        '100vh',
    overflow:      'hidden',
    backgroundColor: '#0b0c0f',
  },
  layout: {
    display:  'flex',
    flex:     1,
    gap:      '8px',
    padding:  '8px',
    overflow: 'hidden',
  },
  leftPanel: {
    display:       'flex',
    flexDirection: 'column',
    gap:           '8px',
    width:         '360px',
    flexShrink:    0,
    overflowY:     'auto',
  },
  rightPanel: {
    display:       'flex',
    flexDirection: 'column',
    flex:          1,
    gap:           '6px',
    minWidth:      0,    // prevents flex item from overflowing
  },
  section: {
    display:       'flex',
    flexDirection: 'column',
    gap:           '6px',
  },
  sectionLabel: {
    fontFamily:    'JetBrains Mono, monospace',
    fontSize:      '9px',
    color:         '#334155',
    letterSpacing: '2px',
    textTransform: 'uppercase',
  },
  instrumentsGrid: {
    display:             'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',  // 3 columns, equal width
    gap:                 '6px',
  },
}
