import React from 'react'

const STATES = {
  replay: ['#67e8f9', 'RECORDED REPLAY'],
  paused: ['#f59e0b', 'REPLAY PAUSED'],
  connecting: ['#f59e0b', 'CONNECTING'],
  waiting: ['#f59e0b', 'WAITING FOR DATA'],
  live: ['#22c55e', 'LIVE SIMULATION'],
  reconnecting: ['#f59e0b', 'RECONNECTING'],
  error: ['#ef4444', 'CONNECTION / DATA ERROR'],
  stale: ['#ef4444', 'STALE DATA'],
}

export default function TopBar({ status, alert, replay }) {
  const [colour, label] = STATES[status] || ['#64748b', 'UNAVAILABLE']
  return (
    <header className="top-bar">
      <div className="brand"><span aria-hidden="true">✈</span> FLIGHTSENTINEL</div>
      <nav className="project-navigation" aria-label="Project navigation">
        <a href={import.meta.env.BASE_URL} aria-current="page">{replay ? 'Dashboard demo' : 'Live dashboard'}</a>
        <a href={`${import.meta.env.BASE_URL}project/about.html`}>Project explained</a>
        <a href={`${import.meta.env.BASE_URL}project/`}>Results &amp; context</a>
      </nav>
      <span className="alert-banner" role="status" aria-live="polite">
        {alert ? '⚠ CONFIRMED MODEL ALERT' : ''}
      </span>
      <div className="connection" role="status">
        <span className="status-dot" style={{ background: colour }} />
        {label}
      </div>
    </header>
  )
}
