# =============================================================
# main.py  —  FastAPI WebSocket server
#
# WHAT THIS FILE DOES:
#   Starts a web server that:
#   1. Trains the ML model on startup
#   2. Opens a WebSocket connection when React connects
#   3. Sends one telemetry frame every 100ms (10 Hz)
#   4. The React frontend receives the frames and updates the UI
#
# WHAT IS A WEBSOCKET?
#   Normal HTTP: browser asks → server replies → connection closes.
#   WebSocket: connection stays OPEN. Server can push data anytime.
#   Perfect for real-time telemetry — we push 10 frames per second
#   without the browser having to ask for each one.
#
# WHAT IS FASTAPI?
#   A modern Python web framework. Very fast, async-native.
#   We use it here specifically for its WebSocket support.
#
# HOW TO RUN:
#   pip install fastapi uvicorn
#   python main.py
#   → Server runs at http://localhost:8000
#   → WebSocket at  ws://localhost:8000/ws/telemetry
# =============================================================

import asyncio
import json
import time

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from simulator import TelemetrySimulator
from detector  import AnomalyDetector


# =============================================================
# App setup
# =============================================================

app = FastAPI(title="FlightSentinel Backend")

# CORS (Cross-Origin Resource Sharing):
# The React app runs on localhost:5173 (Vite dev server).
# The backend runs on localhost:8000.
# Browsers block requests between different ports by default.
# This middleware tells the browser "it's ok, trust React".
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # in production: ["http://localhost:5173"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create the detector once — shared across all WebSocket connections.
# Training happens in startup() below.
detector  = AnomalyDetector()
simulator = TelemetrySimulator()


# =============================================================
# Startup event — runs once when the server starts
# =============================================================

@app.on_event("startup")
async def startup():
    """
    Train the ML model before accepting any connections.
    asyncio.to_thread() runs the training in a background thread
    so the async event loop doesn't get blocked.
    (Training takes ~5 seconds and is CPU-intensive.)
    """
    print("[Server] Starting up — training model...")
    await asyncio.to_thread(detector.train)
    print("[Server] Model ready. Accepting connections.")


# =============================================================
# HTTP endpoint — health check
# =============================================================

@app.get("/health")
async def health():
    """
    Simple health check. React can call this to confirm the
    backend is ready before connecting the WebSocket.
    Returns: {"status": "ok", "model_ready": true/false}
    """
    return {"status": "ok", "model_ready": detector._trained}


# =============================================================
# WebSocket endpoint — the main data stream
# =============================================================

@app.websocket("/ws/telemetry")
async def telemetry_stream(ws: WebSocket):
    """
    The heart of the backend.

    When React connects:
    1. Accept the WebSocket handshake
    2. Loop forever:
       a. Get next telemetry frame from the simulator
       b. Score it with the anomaly detector
       c. Attach the score to the frame
       d. Serialise to JSON and send to React
       e. Wait 100ms (= 10 Hz)
    3. If React disconnects, stop the loop cleanly

    The frame is sent as a JSON string like:
    {
        "timestamp": 12.3,
        "altitude":  8042.1,
        "airspeed":  118.4,
        "pitch":     1.2,
        "roll":      -3.5,
        "vsi":       45.0,
        "heading":   92.0,
        "is_anomaly": false,
        "score":     0.21,
        "alert":     false
    }
    """
    # Accept the incoming WebSocket connection
    await ws.accept()
    print(f"[WebSocket] Client connected: {ws.client}")

    try:
        while True:
            # 1. Get the next frame from the simulator
            frame = simulator.next_frame()

            # 2. Score it — runs the Isolation Forest
            #    asyncio.to_thread() keeps the event loop responsive
            #    (scoring is fast but we keep it off the main thread)
            score, alert = await asyncio.to_thread(detector.score, frame)

            # 3. Attach score and alert to the frame object
            frame.score = round(score, 4)
            frame.alert = alert

            # 4. Convert to dict → JSON string → send over WebSocket
            await ws.send_text(json.dumps(frame.to_dict()))

            # 5. Wait 100ms before sending the next frame
            #    asyncio.sleep() is non-blocking — other connections
            #    can be served while we wait
            await asyncio.sleep(1.0 / TelemetrySimulator.RATE_HZ)

    except WebSocketDisconnect:
        # React closed the tab or refreshed — this is normal
        print(f"[WebSocket] Client disconnected: {ws.client}")


# =============================================================
# Entry point
# =============================================================

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host      = "0.0.0.0",   # accept connections from any network interface
        port      = 8000,
        reload    = False,        # don't auto-reload (model would retrain)
        log_level = "info",
    )
