import React from 'react'

// Column definitions — drives the table header and row rendering
const COLUMNS = [
  { key: 'time',     label: 'SIM TIME',      width: '70px' },
  { key: 'score',    label: 'SCORE',     width: '60px' },
  { key: 'altitude', label: 'ALT (FT)',  width: '80px' },
  { key: 'airspeed', label: 'IAS (KTS)', width: '80px' },
  { key: 'pitch',    label: 'PITCH',     width: '65px' },
  { key: 'roll',     label: 'ROLL',      width: '65px' },
  { key: 'vsi',      label: 'VSI (FPM)', width: '80px' },
]

export default function AlertLog({ alerts = [], onClear }) {
  return (
    <div style={styles.container}>

      {/* Header row */}
      <div style={styles.header}>
        <span style={styles.title}>CONFIRMED EVENT LOG</span>
        <span style={styles.count}>{alerts.length} {alerts.length === 1 ? 'event' : 'events'}</span>
        <button style={styles.clearBtn} onClick={onClear}>
          CLEAR
        </button>
      </div>

      {/* Scrollable table area */}
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          {/* Column headers */}
          <thead>
            <tr>
              {COLUMNS.map(col => (
                <th key={col.key} style={{ ...styles.th, width: col.width }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          {/* Data rows */}
          <tbody>
            {alerts.length === 0 ? (
              // Empty state
              <tr>
                <td colSpan={COLUMNS.length} style={styles.emptyCell}>
                  No confirmed events observed
                </td>
              </tr>
            ) : (
              // One row per alert event, newest first
              alerts.map((alert, idx) => (
                <tr key={alert.id} style={{
                  backgroundColor: idx % 2 === 0 ? '#161923' : '#10121a',
                }}>
                  <td style={styles.td}>{alert.time}</td>
                  <td style={{ ...styles.td, color: '#f87171' }}>
                    {alert.score.toFixed(3)}
                  </td>
                  <td style={styles.td}>{Math.round(alert.altitude).toLocaleString()}</td>
                  <td style={styles.td}>{alert.airspeed.toFixed(1)}</td>
                  <td style={styles.td}>{alert.pitch >= 0 ? '+' : ''}{alert.pitch.toFixed(1)}</td>
                  <td style={styles.td}>{alert.roll  >= 0 ? '+' : ''}{alert.roll.toFixed(1)}</td>
                  <td style={styles.td}>{alert.vsi   >= 0 ? '+' : ''}{Math.round(alert.vsi)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  )
}

const styles = {
  container: {
    display:       'flex',
    flexDirection: 'column',
    gap:           '8px',
    backgroundColor: '#10121a',
    border:        '1px solid #1e2333',
    borderRadius:  '6px',
    overflow:      'hidden',
  },
  header: {
    display:        'flex',
    alignItems:     'center',
    gap:            '10px',
    padding:        '10px 14px',
    borderBottom:   '1px solid #1e2333',
  },
  title: {
    fontFamily:    'JetBrains Mono, monospace',
    fontSize:      '11px',
    color:         '#f59e0b',
    letterSpacing: '2px',
    flex:          1,
  },
  count: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize:   '11px',
    color:      '#64748b',
  },
  clearBtn: {
    fontFamily:      'JetBrains Mono, monospace',
    fontSize:        '10px',
    color:           '#94a3b8',
    backgroundColor: '#1e2333',
    border:          '1px solid #334155',
    borderRadius:    '3px',
    padding:         '3px 10px',
    cursor:          'pointer',
    letterSpacing:   '1px',
  },
  tableWrap: {
    overflow:   'auto',
    maxHeight:  '200px',
  },
  table: {
    width:          '100%',
    borderCollapse: 'collapse',
    fontFamily:     'JetBrains Mono, monospace',
    fontSize:       '11px',
  },
  th: {
    padding:       '6px 10px',
    textAlign:     'left',
    color:         '#94a3b8',
    fontSize:      '9px',
    letterSpacing: '1px',
    borderBottom:  '1px solid #1e2333',
    position:      'sticky',
    top:           0,
    backgroundColor: '#10121a',
  },
  td: {
    padding:  '6px 10px',
    color:    '#94a3b8',
    whiteSpace: 'nowrap',
  },
  emptyCell: {
    padding:   '20px',
    textAlign: 'center',
    color:     '#334155',
    fontSize:  '12px',
  },
}
