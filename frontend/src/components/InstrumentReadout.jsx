// InstrumentReadout.jsx
//
// A single cockpit instrument — shows one flight parameter.
// Looks like this:
//
//   ALT
//  8 042
//    FT
//
// Turns red if the value goes outside the warning range.
//
// PROPS:
//   label     string   — parameter name (e.g. "ALT")
//   value     number   — current value
//   unit      string   — unit label (e.g. "FT")
//   format    function — how to format the number (e.g. x => x.toFixed(1))
//   warnAbove number   — value above which to show red (optional)
//   warnBelow number   — value below which to show red (optional)

import React from 'react'

export default function InstrumentReadout({
  label,
  value,
  unit,
  format    = (v) => Math.round(v).toLocaleString(),
  warnAbove = null,
  warnBelow = null,
}) {
  // Determine if value is in warning range
  const isWarning = (
    (warnAbove !== null && value > warnAbove) ||
    (warnBelow !== null && value < warnBelow)
  )

  // Format the value, or show "---" if no data yet
  const displayValue = value != null ? format(value) : '---'

  return (
    <div style={styles.container}>
      {/* Parameter label — e.g. "ALT" */}
      <div style={styles.label}>{label}</div>

      {/* The big number — turns red on warning */}
      <div style={{
        ...styles.value,
        color: isWarning ? '#ef4444' : '#f59e0b',
      }}>
        {displayValue}
      </div>

      {/* Unit label — e.g. "FT" */}
      <div style={styles.unit}>{unit}</div>
    </div>
  )
}

const styles = {
  container: {
    display:         'flex',
    flexDirection:   'column',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: '#0f1117',
    border:          '1px solid #1e2333',
    borderRadius:    '6px',
    padding:         '12px 16px',
    minWidth:        '110px',
    flex:            1,
    gap:             '2px',
    // Smooth colour transition when entering/leaving warning state
    transition:      'border-color 0.3s ease',
  },
  label: {
    fontFamily:    'JetBrains Mono, monospace',
    fontSize:      '10px',
    color:         '#64748b',
    letterSpacing: '2px',
    textTransform: 'uppercase',
  },
  value: {
    fontFamily:    'JetBrains Mono, monospace',
    fontSize:      '28px',
    fontWeight:    700,
    letterSpacing: '1px',
    lineHeight:    1.1,
    transition:    'color 0.3s ease',
  },
  unit: {
    fontFamily:    'JetBrains Mono, monospace',
    fontSize:      '9px',
    color:         '#334155',
    letterSpacing: '2px',
    textTransform: 'uppercase',
  },
}
