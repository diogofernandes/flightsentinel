"""One paced producer, bounded subscriber queues, and a React demo frontend."""

import asyncio
from contextlib import asynccontextmanager, suppress
from pathlib import Path
import uuid

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .detector import AlertTracker, AnomalyDetector
from .simulator import TelemetrySimulator


class TelemetryHub:
    def __init__(self, detector, simulator, session_seconds=120):
        self.session_seconds = session_seconds
        self.detector = detector
        self.simulator = simulator
        self.tracker = AlertTracker(detector.threshold)
        self.session_id = str(uuid.uuid4())
        self.subscribers = set()
        self.latest = None
        self.latest_event = None
        self.sequence = 0
        self.overruns = 0
        self.last_published = None

    def subscribe(self):
        queue = asyncio.Queue(maxsize=1)
        self.subscribers.add(queue)
        if self.latest is not None:
            queue.put_nowait(self.latest)
        return queue

    async def run(self):
        loop = asyncio.get_running_loop()
        period = 1 / self.simulator.RATE_HZ
        deadline = loop.time()
        while True:
            # Repeat a finite demonstration, not an endless descent through the ground.
            # Session IDs make the intentional reset visible to every viewer.
            if self.simulator.t >= self.session_seconds:
                self.simulator.reset()
                self.session_id = str(uuid.uuid4())
                self.sequence = 0
                self.latest_event = None
                self.tracker = AlertTracker(self.detector.threshold)
            frame = self.simulator.next_frame()
            score, _ = await asyncio.to_thread(self.detector.score, frame)
            previous_count = self.tracker.count
            frame.score = score
            frame.alert = self.tracker.update(score)
            if self.tracker.count != previous_count:
                self.latest_event = {**frame.to_dict(), "id": self.tracker.count}
            self.sequence += 1
            self.latest = {
                **frame.to_dict(), "sequence": self.sequence,
                "session_id": self.session_id, "threshold": self.detector.threshold,
                "event_count": self.tracker.count, "latest_event": self.latest_event,
            }
            self.last_published = loop.time()
            for queue in tuple(self.subscribers):
                # Slow viewers get the latest frame, never an unbounded backlog.
                if queue.full():
                    queue.get_nowait()
                queue.put_nowait(self.latest)
            deadline += period
            remaining = deadline - loop.time()
            if remaining < 0:
                self.overruns += 1
                # Avoid flooding viewers with catch-up frames after a long stall.
                deadline = loop.time()
                remaining = 0
            await asyncio.sleep(remaining)


@asynccontextmanager
async def lifespan(app):
    detector = AnomalyDetector()
    await asyncio.to_thread(detector.train)
    hub = TelemetryHub(detector, TelemetrySimulator())
    app.state.hub = hub
    task = asyncio.create_task(hub.run())
    app.state.producer = task
    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="FlightSentinel — synthetic telemetry demo", lifespan=lifespan)


@app.get("/health")
async def health():
    hub = app.state.hub
    age = None if hub.last_published is None else asyncio.get_running_loop().time() - hub.last_published
    ready = not app.state.producer.done() and age is not None and age < 2
    return JSONResponse({"status": "ok" if ready else "unavailable",
                         "model_ready": hub.detector._trained,
                         "stream_ready": ready, "frame_age_seconds": age,
                         "sequence": hub.sequence, "overruns": hub.overruns,
                         "threshold": hub.detector.threshold},
                        status_code=200 if ready else 503)


@app.websocket("/ws/telemetry")
async def telemetry_stream(ws: WebSocket):
    await ws.accept()
    hub = app.state.hub
    queue = hub.subscribe()

    async def send():
        while True:
            payload = await queue.get()
            await asyncio.wait_for(ws.send_json(payload), timeout=2)

    async def receive():
        # Detect disconnect even while the producer is idle.
        while True:
            message = await ws.receive()
            if message["type"] == "websocket.disconnect":
                return

    tasks = {asyncio.create_task(send()), asyncio.create_task(receive())}
    try:
        done, _ = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for task in done:
            task.result()
    except (WebSocketDisconnect, asyncio.TimeoutError, OSError):
        pass
    finally:
        hub.subscribers.discard(queue)
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        with suppress(RuntimeError, OSError):
            await ws.close()


# Recruiter pages share the dashboard origin, including on public hosting.
PROJECT_DOCS = Path(__file__).resolve().parents[1] / "docs"
if PROJECT_DOCS.is_dir():
    app.mount("/project", StaticFiles(directory=PROJECT_DOCS, html=True), name="project")

# A built frontend is served by this process; dev uses Vite's WebSocket proxy.
DIST = Path(__file__).resolve().parents[1] / "frontend" / "dist"
if DIST.is_dir():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="frontend")
