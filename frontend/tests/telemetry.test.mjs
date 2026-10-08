import test from 'node:test'
import assert from 'node:assert/strict'
import { createTelemetryClient, telemetryUrl, validFrame } from '../src/telemetry.js'

const frame = {
  timestamp: 0.1, altitude: 8000, airspeed: 120, pitch: 0, roll: 0,
  vsi: 0, heading: 90, score: 0.5, alert: false, is_anomaly: false,
  session_id: 'test', sequence: 1, event_count: 0, threshold: 0.6, latest_event: null,
}

function harness() {
  const sockets = [], statuses = [], frames = []
  const pending = new Map()
  let id = 0
  const timers = {
    setTimeout(fn, delay) { pending.set(++id, { fn, delay }); return id },
    clearTimeout(key) { pending.delete(key) },
  }
  class Socket {
    constructor(url) { this.url = url; sockets.push(this) }
    close() { this.closed = true; this.onclose?.() }
    sendFrame(value = frame) { this.onmessage?.({ data: JSON.stringify(value) }) }
  }
  const stop = createTelemetryClient({
    url: 'ws://test/ws/telemetry', WebSocketImpl: Socket, timers,
    onFrame: f => frames.push(f), onStatus: s => statuses.push(s),
  })
  const fire = delay => {
    const entry = [...pending].find(([, timer]) => timer.delay === delay)
    assert.ok(entry, `No ${delay}ms timer`)
    pending.delete(entry[0])
    entry[1].fn()
  }
  return { sockets, statuses, frames, pending, stop, fire }
}

test('same-origin URL handles HTTPS and rejects mixed content', () => {
  assert.equal(telemetryUrl({ protocol: 'https:', host: 'demo.example' }), 'wss://demo.example/ws/telemetry')
  assert.equal(telemetryUrl({ protocol: 'http:', host: 'localhost:5173' }), 'ws://localhost:5173/ws/telemetry')
  assert.throws(() => telemetryUrl({ protocol: 'https:' }, 'ws://localhost/ws'))
})

test('invalid payloads cannot become live telemetry', () => {
  assert.ok(validFrame(frame))
  for (const invalid of [null, {}, { ...frame, score: NaN }, { ...frame, airspeed: null },
    { ...frame, threshold: null }, { ...frame, alert: 'false' }, { ...frame, latest_event: { id: 1 } }]) {
    assert.equal(validFrame(invalid), false)
  }
  const h = harness()
  h.sockets[0].onopen()
  h.sockets[0].onmessage({ data: '{broken' })
  assert.equal(h.frames.length, 0)
  assert.equal(h.statuses.at(-1), 'error')
  h.stop()
})

test('a connected socket is not live until a valid frame arrives', () => {
  const h = harness()
  h.sockets[0].onopen()
  assert.equal(h.statuses.at(-1), 'waiting')
  h.sockets[0].sendFrame()
  assert.equal(h.statuses.at(-1), 'live')
  assert.equal(h.frames.length, 1)
  h.stop()
})

test('stale data closes the socket and reconnects', () => {
  const h = harness()
  h.sockets[0].onopen()
  h.sockets[0].sendFrame()
  h.fire(2000)
  assert.equal(h.statuses.at(-1), 'stale')
  assert.ok(h.sockets[0].closed)
  h.fire(500)
  assert.equal(h.sockets.length, 2)
  h.sockets[1].onopen()
  h.sockets[1].sendFrame({ ...frame, sequence: 2, timestamp: 0.2 })
  assert.equal(h.statuses.at(-1), 'live')
  h.stop()
})

test('retries back off and disposal prevents old callbacks or new sockets', () => {
  const h = harness()
  h.sockets[0].close()
  h.fire(500)
  h.sockets[1].close()
  h.fire(1000)
  assert.equal(h.sockets.length, 3)
  const oldMessage = h.sockets[2].onmessage
  h.stop()
  oldMessage({ data: JSON.stringify(frame) })
  assert.equal(h.pending.size, 0)
  assert.equal(h.frames.length, 0)
  assert.ok(h.sockets[2].closed)
})


test('duplicate or out-of-order frames do not refresh stale readings', () => {
  const h = harness()
  h.sockets[0].onopen()
  h.sockets[0].sendFrame()
  h.sockets[0].sendFrame()
  h.sockets[0].sendFrame({ ...frame, sequence: 2, timestamp: 0.05 })
  assert.equal(h.frames.length, 1)
  h.fire(2000)
  assert.equal(h.statuses.at(-1), 'stale')
  h.stop()
})
