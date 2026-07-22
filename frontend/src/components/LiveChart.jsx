// LiveChart.jsx
//
// Four stacked real-time charts showing the last 30 seconds
// of telemetry. Built with Recharts.
//
// RECHARTS BASICS:
//   <ResponsiveContainer> — makes chart fill its parent div
//   <LineChart>           — the chart type (line graph)
//   <XAxis> / <YAxis>    — the axes
//   <Line>               — one line on the chart
//   <ReferenceLine>       — a horizontal threshold line
//   <Tooltip>             — popup on hover
//
// PROPS:
//   history   array   — array of telemetry frames (last 300)

import React from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts'

// Chart configuration — one entry per sub-chart
// This array drives the rendering loop below.
const CHARTS = [
  {
    key:    'altitude',
    label:  'Altitude (ft)',
    colour: '#22d3ee',      // cyan
    domain: [6000, 10000],
  },
  {
    key:    'airspeed',
    label:  'Airspeed (kts)',
    colour: '#f59e0b',      // amber
    domain: [50, 160],
    // Reference line at 65 kts — stall speed
    refLine: { value: 65, label: 'Vs', colour: '#ef4444' },
  },
  {
    key:    'pitch',
    label:  'Pitch (°)',
    colour: '#a78bfa',      // purple
    domain: [-20, 20],
    refLine: { value: 0, label: '', colour: '#334155' },
  },
  {
    key:    'score',
    label:  'Anomaly Score',
    colour: '#22c55e',      // green (overridden dynamically)
    domain: [0, 1],
    refLine: { value: 0.65, label: '0.65', colour: '#ef4444' },
  },
]

// Custom tooltip — shown on hover
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  const val = payload[0]?.value
  return (
    <div style={tooltipStyle}>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#f59e0b' }}>
        {val != null ? val.toFixed(2) : '---'}
      </span>
    </div>
  )
}

const tooltipStyle = {
  backgroundColor: '#161923',
  border:          '1px solid #1e2333',
  borderRadius:    '4px',
  padding:         '4px 10px',
}

export default function LiveChart({ history }) {
  // If no data yet, show placeholder
  if (!history || history.length === 0) {
    return (
      <div style={styles.placeholder}>
        <span style={styles.placeholderText}>Waiting for telemetry...</span>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Render one chart per entry in CHARTS array */}
      {CHARTS.map((chart, idx) => {
        const isLast = idx === CHARTS.length - 1

        return (
          <div key={chart.key} style={{
            ...styles.chartWrapper,
            // Only the last chart shows the X axis
            marginBottom: isLast ? 0 : 4,
          }}>
            {/* Chart label */}
            <div style={styles.chartLabel}>{chart.label}</div>

            {/* The actual Recharts chart */}
            <ResponsiveContainer width="100%" height={isLast ? 80 : 75}>
              <LineChart
                data={history}
                margin={{ top: 2, right: 8, bottom: 2, left: 0 }}
              >
                {/* Y axis — left side, no labels to save space */}
                <YAxis
                  domain={chart.domain}
                  tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
                  width={36}
                  tickCount={3}
                />

                {/* X axis — only on the last chart */}
                {isLast && (
                  <XAxis
                    dataKey="timestamp"
                    tick={{ fill: '#64748b', fontSize: 9 }}
                    tickFormatter={(v) => `${v.toFixed(0)}s`}
                    tickCount={6}
                  />
                )}

                {/* Horizontal reference line (stall speed, threshold, etc.) */}
                {chart.refLine && (
                  <ReferenceLine
                    y={chart.refLine.value}
                    stroke={chart.refLine.colour}
                    strokeDasharray="4 4"
                    label={{
                      value:    chart.refLine.label,
                      fill:     chart.refLine.colour,
                      fontSize: 9,
                      position: 'insideTopLeft',
                    }}
                  />
                )}

                {/* Tooltip on hover */}
                <Tooltip content={<CustomTooltip />} />

                {/* The data line */}
                <Line
                  type="monotone"
                  dataKey={chart.key}
                  stroke={chart.colour}
                  strokeWidth={1.5}
                  dot={false}          // no dots — too cluttered at 10 Hz
                  isAnimationActive={false}  // disable animation — hurts perf at 10 Hz
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )
      })}
    </div>
  )
}

const styles = {
  container: {
    display:       'flex',
    flexDirection: 'column',
    gap:           '2px',
    padding:       '12px',
    backgroundColor: '#10121a',
    border:        '1px solid #1e2333',
    borderRadius:  '6px',
    height:        '100%',
  },
  chartWrapper: {
    display: 'flex',
    flexDirection: 'column',
  },
  chartLabel: {
    fontFamily:    'JetBrains Mono, monospace',
    fontSize:      '9px',
    color:         '#64748b',
    letterSpacing: '1px',
    textTransform: 'uppercase',
    marginBottom:  '2px',
    marginLeft:    '38px',
  },
  placeholder: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    height:         '100%',
    backgroundColor: '#10121a',
    border:         '1px solid #1e2333',
    borderRadius:   '6px',
  },
  placeholderText: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize:   '12px',
    color:      '#334155',
    letterSpacing: '1px',
  },
}
