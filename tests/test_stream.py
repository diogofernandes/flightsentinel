import asyncio
from contextlib import suppress
import time

from fastapi.testclient import TestClient
import pytest

from backend.main import TelemetryHub, app
from backend.simulator import TelemetrySimulator


class FakeDetector:
    threshold = 0.65
    def score(self, frame):
        # Deliberately non-zero inference cost to catch sleep-after-work drift.
        time.sleep(0.025)
        return (0.8 if frame.is_anomaly else 0.2), frame.is_anomaly


def test_one_producer_shared_by_fast_and_slow_subscribers():
    async def exercise():
        hub = TelemetryHub(FakeDetector(), TelemetrySimulator(anomalies=False))
        first, second, slow = hub.subscribe(), hub.subscribe(), hub.subscribe()
        task = asyncio.create_task(hub.run())
        times, payloads = [], []
        try:
            for _ in range(12):
                a = await asyncio.wait_for(first.get(), 1)
                b = await asyncio.wait_for(second.get(), 1)
                assert a == b
                times.append(asyncio.get_running_loop().time())
                payloads.append(a)
            assert hub.simulator.tick == hub.sequence == 12
            assert slow.qsize() == 1
            assert slow.get_nowait()["sequence"] == payloads[-1]["sequence"]
            assert (times[-1] - times[0]) / 11 == pytest.approx(0.1, abs=0.015)
        finally:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
    asyncio.run(exercise())


def test_websocket_metadata_and_disconnect_cleanup():
    with TestClient(app) as client:
        with client.websocket_connect("/ws/telemetry") as first:
            with client.websocket_connect("/ws/telemetry") as second:
                a, b = first.receive_json(), second.receive_json()
                # Subscribers can join on different ticks, but share one timeline.
                assert a["session_id"] == b["session_id"]
                assert a["threshold"] == b["threshold"]
                assert a["timestamp"] == pytest.approx(a["sequence"] / 10)
                assert b["timestamp"] == pytest.approx(b["sequence"] / 10)
                assert a["threshold"] > 0
                assert len(app.state.hub.subscribers) == 2
                assert client.get("/health").json()["stream_ready"]
        # Drain the ASGI disconnect tasks before checking subscription cleanup.
        for _ in range(20):
            if not app.state.hub.subscribers:
                break
            time.sleep(0.01)
        assert not app.state.hub.subscribers


def test_health_detects_dead_producer():
    with TestClient(app) as client:
        with client.websocket_connect("/ws/telemetry") as ws:
            ws.receive_json()
        async def stop():
            task = app.state.producer
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
        client.portal.call(stop)
        response = client.get("/health")
        assert response.status_code == 503
        assert not response.json()["stream_ready"]


def test_finite_demo_reset_is_visible_to_subscribers():
    async def exercise():
        simulator = TelemetrySimulator(anomalies=False)
        hub = TelemetryHub(FakeDetector(), simulator, session_seconds=0.3)
        queue = hub.subscribe()
        task = asyncio.create_task(hub.run())
        try:
            frames = [await asyncio.wait_for(queue.get(), 1) for _ in range(4)]
            assert frames[0]["session_id"] == frames[2]["session_id"]
            assert frames[3]["session_id"] != frames[2]["session_id"]
            assert frames[3]["sequence"] == 1
            assert frames[3]["timestamp"] == 0.1
            assert frames[3]["altitude"] == frames[0]["altitude"]
            assert frames[3]["event_count"] == 0
        finally:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
    asyncio.run(exercise())
