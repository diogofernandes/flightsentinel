import React from 'react'
import {
  CartesianGrid, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

const CHARTS = [
  { key: 'altitude', label: 'Altitude (ft)', colour: '#22d3ee',
    domain: ([low, high]) => [Math.floor(low - 50), Math.ceil(high + 50)] },
  { key: 'airspeed', label: 'Airspeed (kt)', colour: '#f59e0b', domain: [50, 160],
    reference: { value: 85, label: 'Benchmark rule: 85 kt' } },
  { key: 'pitch', label: 'Pitch (deg)', colour: '#a78bfa', domain: [-20, 20] },
  { key: 'score', label: 'Relative anomaly score', colour: '#22c55e', domain: [0, 1] },
]

function FrameTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <span>{Number.isFinite(label) ? label.toFixed(1) + 's' : ''}</span>
      <strong>{Number.isFinite(payload[0].value) ? payload[0].value.toFixed(2) : '---'}</strong>
    </div>
  )
}

export default function LiveChart({ history, threshold }) {
  if (!history?.length) return <div className="chart-placeholder">Waiting for fresh telemetry…</div>
  return (
    <div className="charts">
      {CHARTS.map((chart, index) => {
        const reference = chart.key === 'score' && Number.isFinite(threshold)
          ? { value: threshold, label: 'Threshold ' + threshold.toFixed(3) } : chart.reference
        return (
          <div className="chart" key={chart.key}>
            <div className="chart-label">{chart.label}</div>
            <ResponsiveContainer width="100%" height={index === CHARTS.length - 1 ? 145 : 130}>
              <LineChart data={history} margin={{ top: 10, right: 12, bottom: 2, left: 0 }}>
                <CartesianGrid stroke="#1e293b" vertical={false} />
                <YAxis domain={chart.domain} width={46} tickCount={3}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickFormatter={value => chart.key === 'altitude' ? Math.round(value).toLocaleString() : chart.key === 'score' ? value.toFixed(1) : Math.round(value)} />
                <XAxis dataKey="timestamp" type="number" domain={['dataMin', 'dataMax']}
                  hide={index !== CHARTS.length - 1} tickCount={6}
                  tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={value => value.toFixed(1) + 's'} />
                {reference && <ReferenceLine y={reference.value} stroke="#f87171" strokeDasharray="4 4"
                  label={{ value: reference.label, fill: '#f87171', fontSize: 10, position: 'insideTopLeft' }} />}
                <Tooltip content={<FrameTooltip />} />
                <Line type="linear" dataKey={chart.key} stroke={chart.colour}
                  strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )
      })}
    </div>
  )
}
