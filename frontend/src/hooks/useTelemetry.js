// useTelemetry.js
//
// WHAT IS A CUSTOM HOOK?
//   In React, a "hook" is a function that manages state or
//   side-effects for a component. Custom hooks let you extract
//   reusable logic out of components so they stay clean.
//
//   This hook manages the WebSocket connection to the backend.
//   Any component that needs telemetry data just calls:
//     const { frame, history, status } = useTelemetry()
//   ...and it gets live data automatically.
//
// WHAT THIS HOOK DOES:
//   1. Opens a WebSocket to ws://localhost:8000/ws/telemetry
//   2. Every 100ms the backend sends a JSON frame
//   3. We parse it and store:
//      - frame:   the latest single frame (for readouts)
//      - history: the last 300 frames (for the live chart)
//      - status:  connection state ("connecting", "live", "error")
//   4. On unmount (component removed), closes the WebSocket cleanly

import { useState, useEffect, useRef, useCallback } from 'react'

// How many frames to keep in history for the chart.
// At 10 Hz, 300 frames = 30 seconds of data visible.
const HISTORY_LENGTH = 300

// The WebSocket URL — connects to our FastAPI backend
const WS_URL = 'ws://localhost:8000/ws/telemetry'

export function useTelemetry() {
  // --- State ---
  // useState(initialValue) returns [currentValue, setterFunction]
  // When you call the setter, React re-renders the component.

  const [frame,   setFrame]   = useState(null)    // latest telemetry frame
  const [history, setHistory] = useState([])       // array of recent frames
  const [status,  setStatus]  = useState('connecting') // 'connecting' | 'live' | 'error' | 'closed'

  // useRef stores a value that persists between renders
  // but changing it does NOT trigger a re-render.
  // Perfect for storing the WebSocket object itself.
  const wsRef = useRef(null)

  // --- Connect function ---
  // useCallback memoises the function so it doesn't get
  // recreated on every render (performance optimisation)
  const connect = useCallback(() => {
    setStatus('connecting')

    // Create the WebSocket connection
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    // Fired when connection is established
    ws.onopen = () => {
      console.log('[WebSocket] Connected to FlightSentinel backend')
      setStatus('live')
    }

    // Fired every time the backend sends a frame
    ws.onmessage = (event) => {
      // event.data is a JSON string — parse it to an object
      const newFrame = JSON.parse(event.data)

      // Update the latest frame (triggers re-render of readouts)
      setFrame(newFrame)

      // Add to history, keeping only the last HISTORY_LENGTH frames.
      // We use the functional form of setState:
      //   setHistory(prev => newValue)
      // This ensures we always work with the most current history,
      // even if multiple updates arrive close together.
      setHistory(prev => {
        const updated = [...prev, newFrame]
        // If we have too many frames, drop the oldest ones
        return updated.length > HISTORY_LENGTH
          ? updated.slice(updated.length - HISTORY_LENGTH)
          : updated
      })
    }

    // Fired if the connection drops or fails
    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error)
      setStatus('error')
    }

    // Fired when the connection closes (backend stopped, etc.)
    ws.onclose = () => {
      console.log('[WebSocket] Connection closed')
      setStatus('closed')
    }
  }, []) // empty dependency array = this function never changes

  // --- Effect: open connection on mount, close on unmount ---
  // useEffect runs after the component mounts.
  // The returned function runs when the component unmounts (cleanup).
  useEffect(() => {
    connect()

    // Cleanup: close the WebSocket when the component is removed
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect]) // re-run if connect changes (it won't, due to useCallback)

  // --- Return everything components need ---
  return { frame, history, status }
}
