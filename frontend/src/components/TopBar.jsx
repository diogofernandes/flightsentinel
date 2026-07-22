// TopBar.jsx
//
// The header bar at the top of the cockpit.
// Shows: app title, connection status, anomaly alert banner.
//
// PROPS (inputs this component receives):
//   status  string  — 'connecting' | 'live' | 'error' | 'closed'
//   alert   bool    — true when anomaly is detected

import React from 'react'

// Status dot colours
const STATUS_COLOURS = {
  connecting: '#f59e0b',   // amber — waiting
  live:       '#22c55e',   // green — connected
  error:      '#ef4444',   // red — problem
  closed:     '#64748b',   // grey — disconnected
}

const STATUS_LABELS = {
  connecting: 'CONNECTING...',
  live:       'LIVE',
  error:      'CONNECTION ERROR',
  closed:     'DISCONNECTED',
}

export default function TopBar({ status, alert }) {
  return (
    <header style={styles.bar}>

      {/* Left: title */}
      <div style={styles.title}>
        <span style={styles.plane}>✈</span>
        <span style={styles.titleText}>FLIGHTSENTINEL</span>
        <span style={styles.subtitle}>COCKPIT ANOMALY MONITOR</span>
      </div>

      {/* Centre: anomaly alert banner — only visible when alert is true */}
      <div style={{
        ...styles.alertBanner,
        // Conditionally show/hide using opacity and visibility
        // (opacity keeps it in the layout even when hidden)
        opacity:    alert ? 1 : 0,
        visibility: alert ? 'visible' : 'hidden',
      }}>
        ⚠ ANOMALY DETECTED
      </div>

      {/* Right: connection status */}
      <div style={styles.statusRow}>
        {/* Pulsing dot — the animation is in styles.css */}
        <span style={{
          ...styles.dot,
          backgroundColor: STATUS_COLOURS[status] || '#64748b',
        }} />
        <span style={styles.statusLabel}>
          {STATUS_LABELS[status] || status.toUpperCase()}
        </span>
      </div>

    </header>
  )
}

// --- Inline styles ---
// We use inline styles here for component-scoped styles.
// No risk of CSS class name collisions between components.
const styles = {
  bar: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '12px 20px',
    borderBottom:   '1px solid #1e2333',
    backgroundColor:'#0b0c0f',
    position:       'sticky',
    top: 0,
    zIndex: 100,
  },
  title: {
    display:    'flex',
    alignItems: 'center',
    gap:        '10px',
  },
  plane: {
    fontSize: '20px',
  },
  titleText: {
    fontFamily:    'JetBrains Mono, monospace',
    fontSize:      '18px',
    fontWeight:    700,
    color:         '#f59e0b',
    letterSpacing: '3px',
  },
  subtitle: {
    fontFamily:    'JetBrains Mono, monospace',
    fontSize:      '10px',
    color:         '#64748b',
    letterSpacing: '2px',
  },
  alertBanner: {
    fontFamily:      'JetBrains Mono, monospace',
    fontSize:        '14px',
    fontWeight:      700,
    color:           '#ef4444',
    backgroundColor: '#450a0a',
    padding:         '6px 20px',
    borderRadius:    '4px',
    letterSpacing:   '2px',
    border:          '1px solid #7f1d1d',
    transition:      'opacity 0.2s ease',
  },
  statusRow: {
    display:    'flex',
    alignItems: 'center',
    gap:        '8px',
  },
  dot: {
    width:        '8px',
    height:       '8px',
    borderRadius: '50%',
    display:      'inline-block',
  },
  statusLabel: {
    fontFamily:    'JetBrains Mono, monospace',
    fontSize:      '11px',
    color:         '#64748b',
    letterSpacing: '1px',
  },
}
