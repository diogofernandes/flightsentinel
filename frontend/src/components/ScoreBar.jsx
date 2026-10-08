import React from 'react'

export default function ScoreBar({ score, threshold, alert = false, available = false }) {
  const ready = available && Number.isFinite(score) && Number.isFinite(threshold)
  const colour = !ready ? '#94a3b8' : alert ? '#ef4444' : score > threshold ? '#f59e0b' : '#22c55e'
  const label = !ready ? 'TELEMETRY UNAVAILABLE'
    : alert ? '⚠ CONFIRMED MODEL ALERT'
    : score > threshold ? 'ELEVATED · AWAITING CONFIRMATION' : 'WITHIN LEARNED ENVELOPE'
  return (
    <div className="score-panel">
      <div className="score-heading">
        <span>RELATIVE ANOMALY SCORE</span>
        <strong style={{ color: colour }}>{ready ? score.toFixed(3) : '---'}</strong>
      </div>
      <div className="score-track" role="meter" aria-label="Relative anomaly score"
        aria-valuemin={0} aria-valuemax={1} aria-valuenow={ready ? score : undefined}
        aria-valuetext={label}>
        <div className="score-fill" style={{ width: `${ready ? score * 100 : 0}%`, background: colour }} />
        {ready && <div className="threshold-marker" style={{ left: `${threshold * 100}%` }} />}
      </div>
      <div className="score-details">
        <span style={{ color: colour }}>{label}</span>
        <span>{ready ? `Threshold ${threshold.toFixed(3)}` : 'No current score'}</span>
      </div>
    </div>
  )
}
