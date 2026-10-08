/** Telemetry protocol and reconnect lifecycle, independent of React. */
const FIELDS = ['timestamp', 'altitude', 'airspeed', 'pitch', 'roll', 'vsi', 'heading', 'score']

export function telemetryUrl(location, override) {
  const url = override || `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/telemetry`
  const parsed = new URL(url)
  if (!['ws:', 'wss:'].includes(parsed.protocol)) throw new Error('Telemetry URL must use ws or wss')
  if (location.protocol === 'https:' && parsed.protocol !== 'wss:') {
    throw new Error('HTTPS pages require secure telemetry')
  }
  return url
}

export function validFrame(frame) {
  const finiteFields = value => value && FIELDS.every(key => typeof value[key] === 'number' && Number.isFinite(value[key]))
  return Boolean(
    finiteFields(frame) && frame.timestamp >= 0 &&
    frame.score >= 0 && frame.score <= 1 &&
    typeof frame.alert === 'boolean' && typeof frame.is_anomaly === 'boolean' &&
    typeof frame.session_id === 'string' && frame.session_id.length > 0 &&
    Number.isSafeInteger(frame.sequence) && frame.sequence > 0 &&
    Number.isSafeInteger(frame.event_count) && frame.event_count >= 0 &&
    typeof frame.threshold === 'number' && Number.isFinite(frame.threshold) &&
    frame.threshold > 0 && frame.threshold < 1 &&
    (frame.latest_event === null || (
      finiteFields(frame.latest_event) &&
      Number.isSafeInteger(frame.latest_event.id) && frame.latest_event.id > 0 &&
      frame.latest_event.id <= frame.event_count
    ))
  )
}

export function createTelemetryClient({
  url, onFrame, onStatus, WebSocketImpl = globalThis.WebSocket,
  timers = globalThis, staleMs = 2000,
}) {
  let stopped = false
  let socket = null
  let reconnectTimer
  let staleTimer
  let failures = 0
  let failedStatus = 'reconnecting'
  let lastSession = null, lastSequence = 0, lastTimestamp = -1

  function cancelStale() { timers.clearTimeout(staleTimer) }
  function connect() {
    if (stopped) return
    onStatus(failures ? 'reconnecting' : 'connecting')
    try {
      socket = new WebSocketImpl(url)
    } catch {
      onStatus('error')
      retry()
      return
    }
    const current = socket
    const active = () => !stopped && socket === current
    function watchFreshness() {
      cancelStale()
      staleTimer = timers.setTimeout(() => {
        if (!active()) return
        failedStatus = 'stale'
        onStatus('stale')
        current.close()
      }, staleMs)
    }
    current.onopen = () => {
      if (!active()) return
      onStatus('waiting')
      watchFreshness()
    }
    current.onmessage = event => {
      if (!active()) return
      let frame
      try { frame = JSON.parse(event.data) } catch { frame = null }
      if (!validFrame(frame)) {
        failedStatus = 'error'
        onStatus('error')
        current.close()
        return
      }
      if (frame.session_id === lastSession && (frame.sequence <= lastSequence || frame.timestamp <= lastTimestamp)) return
      lastSession = frame.session_id
      lastSequence = frame.sequence
      lastTimestamp = frame.timestamp
      failures = 0
      failedStatus = 'reconnecting'
      watchFreshness()
      onStatus('live')
      onFrame(frame)
    }
    current.onerror = () => {
      if (!active()) return
      failedStatus = 'error'
      onStatus('error')
      current.close()
    }
    current.onclose = () => {
      if (!active()) return
      cancelStale()
      socket = null
      onStatus(failedStatus)
      retry()
    }
  }
  function retry() {
    if (stopped) return
    const delay = Math.min(500 * 2 ** failures, 16000)
    failures += 1
    reconnectTimer = timers.setTimeout(connect, delay)
  }
  connect()
  return () => {
    stopped = true
    timers.clearTimeout(reconnectTimer)
    cancelStale()
    if (socket) {
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null
      socket.close()
    }
    socket = null
  }
}
