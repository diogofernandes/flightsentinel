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
    padding:         '16px 8px',
    minWidth:        0,
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
    fontSize:      'clamp(19px, 2.5vw, 28px)',
    fontWeight:    700,
    letterSpacing: '1px',
    lineHeight:    1.1,
    transition:    'color 0.3s ease',
  },
  unit: {
    fontFamily:    'JetBrains Mono, monospace',
    fontSize:      '9px',
    color:         '#94a3b8',
    letterSpacing: '2px',
    textTransform: 'uppercase',
  },
}
