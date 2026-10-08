import { validFrame } from './telemetry'

// Replay actual stored Python scores and confirmed alert states, without inference.
export function createRecordedClient({ url, onFrame, onStatus, fetchImpl = fetch,
  timers = globalThis }) {
  const controller = new AbortController()
  let stopped = false, paused = false, frames = [], cursor = 280, pass = 0, timer
  const publish = () => {
    if (stopped || !frames.length) return
    const next = { ...frames[cursor], session_id: `recorded-${pass}` }
    const history = frames.slice(Math.max(0, cursor - 299), cursor + 1)
      .map(frame => ({ ...frame, session_id: next.session_id }))
    onFrame(next, history)
    onStatus(paused ? 'paused' : 'replay')
  }
  fetchImpl(url, { signal: controller.signal }).then(response => {
    if (!response.ok) throw new Error('Recording unavailable')
    return response.json()
  }).then(data => {
    if (stopped) return
    if (data.rate_hz !== 10 || !Array.isArray(data.frames) || data.frames.length < 300)
      throw new Error('Invalid recording')
    let count = 0, latest = null, previousAlert = false
    frames = data.frames.map((frame, index) => {
      if (frame.alert && !previousAlert) latest = { ...frame, id: ++count }
      previousAlert = frame.alert
      const next = { ...frame, sequence: index + 1, session_id: 'recorded-0',
        threshold: data.threshold, event_count: count, latest_event: latest }
      if (!validFrame(next) || (index && frame.timestamp <= data.frames[index - 1].timestamp))
        throw new Error('Invalid recorded frame')
      return next
    })
    publish()
    timer = timers.setInterval(() => {
      if (stopped || paused) return
      cursor++
      if (cursor >= frames.length) { cursor = 0; pass++ }
      publish()
    }, 100)
  }).catch(error => { if (!stopped && error.name !== 'AbortError') onStatus('error') })
  return {
    togglePause() { if (!frames.length) return; paused = !paused; publish() },
    showEvent() { if (!frames.length) return; cursor = 280; pass++; paused = false; publish() },
    dispose() { stopped = true; controller.abort(); timers.clearInterval(timer) },
  }
}
