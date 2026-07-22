// ScoreBar.jsx
//
// The anomaly score gauge — a horizontal bar from 0 to 1.
// Colour changes as the score increases:
//   0.0 - 0.4  → green  (normal)
//   0.4 - 0.65 → amber  (elevated)
//   0.65 - 1.0 → red    (anomaly — alert fires)
//
// Also shows a vertical threshold line at 0.65.
//
// PROPS:
//   score      number  — current anomaly score (0 to 1)
//   threshold  number  — alert threshold (default 0.65)

import React from 'react'

export default function ScoreBar({ score = 0, threshold = 0.65 }) {
  // Convert score to percentage for the bar width
  const pct = Math.round(Math.max(0, Math.min(1, score)) * 100)

  // Pick colour based on score
  const barColour =
    score < 0.4        ? '#22c55e' :   // green
    score < threshold  ? '#f59e0b' :   // amber
                         '#ef4444'     // red

  // Score label colour matches bar colour
  const labelColour = barColour

  return (
    <div style={styles.container}>

      {/* Header row: label on left, value on right */}
      <div style={styles.header}>
        <span style={styles.label}>ANOMALY SCORE</span>
        <span style={{ ...styles.scoreNum, color: labelColour }}>
          {score.toFixed(3)}
        </span>
      </div>

      {/* The bar track */}
      <div style={styles.track}>

        {/* The filled portion — width is proportional to score */}
        <div style={{
          ...styles.fill,
          width:           `${pct}%`,
          backgroundColor: barColour,
          // Smooth animation as score changes
          transition:      'width 0.2s ease, background-color 0.3s ease',
        }} />

        {/* Threshold line — a thin vertical marker at 65% */}
        <div style={{
          ...styles.thresholdLine,
          left: `${threshold * 100}%`,
        }}>
          {/* Small label above the threshold line */}
          <span style={styles.thresholdLabel}>
            {threshold.toFixed(2)}
          </span>
        </div>

      </div>

      {/* Status text below the bar */}
      <div style={{ ...styles.statusText, color: labelColour }}>
        {score >= threshold ? '⚠ ANOMALY DETECTED' : '● NORMAL FLIGHT'}
      </div>

    </div>
  )
}

const styles = {
  container: {
    display:       'flex',
    flexDirection: 'column',
    gap:           '8px',
    padding:       '14px 16px',
    backgroundColor: '#0f1117',
    border:        '1px solid #1e2333',
    borderRadius:  '6px',
  },
  header: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  label: {
    fontFamily:    'JetBrains Mono, monospace',
    fontSize:      '10px',
    color:         '#64748b',
    letterSpacing: '2px',
  },
  scoreNum: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize:   '14px',
    fontWeight: 700,
    transition: 'color 0.3s ease',
  },
  track: {
    position:      'relative',
    height:        '8px',
    backgroundColor: '#1e2333',
    borderRadius:  '4px',
    overflow:      'visible',  // allow threshold label to overflow
  },
  fill: {
    position:     'absolute',
    left:         0,
    top:          0,
    height:       '100%',
    borderRadius: '4px',
  },
  thresholdLine: {
    position:        'absolute',
    top:             '-4px',
    bottom:          '-4px',
    width:           '2px',
    backgroundColor: '#ef444480',  // semi-transparent red
    transform:       'translateX(-1px)',
  },
  thresholdLabel: {
    position:      'absolute',
    top:           '-18px',
    left:          '50%',
    transform:     'translateX(-50%)',
    fontFamily:    'JetBrains Mono, monospace',
    fontSize:      '9px',
    color:         '#ef4444',
    whiteSpace:    'nowrap',
  },
  statusText: {
    fontFamily:    'JetBrains Mono, monospace',
    fontSize:      '11px',
    letterSpacing: '1px',
    textAlign:     'center',
    transition:    'color 0.3s ease',
  },
}
