"""Seeded telemetry scenarios, not an aircraft dynamics or stall model."""

import math
import random
from dataclasses import asdict, dataclass


@dataclass
class TelemetryFrame:
    timestamp: float
    altitude: float
    airspeed: float
    pitch: float
    roll: float
    vsi: float
    heading: float
    is_anomaly: bool
    score: float = 0.0
    alert: bool = False

    def to_dict(self) -> dict:
        return asdict(self)


class TelemetrySimulator:
    RATE_HZ = 10
    ANOMALY_EVERY = 30  # start-to-start interval, in simulation seconds
    ANOMALY_DUR = 8

    def __init__(self, seed: int = 42, anomalies: bool = True,
                 scenario: str = "descent", severity: float = 1.0):
        if scenario not in {"descent", "bank", "airspeed"}:
            raise ValueError("Unknown synthetic scenario")
        if not 0 < severity <= 1:
            raise ValueError("Severity must be in (0, 1]")
        self.seed = seed
        self.rng = random.Random(seed)
        self.anomalies = anomalies
        self.scenario = scenario
        self.severity = severity
        self.t = 0.0
        self.tick = 0
        self.altitude = 8000.0

    def reset(self):
        self.__init__(self.seed, self.anomalies, self.scenario, self.severity)

    def next_frame(self) -> TelemetryFrame:
        dt = 1 / self.RATE_HZ
        self.tick += 1
        self.t = self.tick * dt
        cycle_tick = self.tick % (self.ANOMALY_EVERY * self.RATE_HZ)
        active = self.anomalies and self.tick >= self.ANOMALY_EVERY * self.RATE_HZ
        active = active and cycle_tick < self.ANOMALY_DUR * self.RATE_HZ
        # Smooth entry/recovery. The label describes the injected interval,
        # including its mild edges, not an aerodynamically verified stall.
        p = cycle_tick / (self.ANOMALY_DUR * self.RATE_HZ)
        envelope = math.sin(math.pi * p) ** 2 * self.severity if active else 0.0
        airspeed = 120 + 10 * math.sin(self.t / 20) + self.rng.gauss(0, 1.5)
        pitch = 2 * math.sin(self.t / 15) + self.rng.gauss(0, 0.3)
        roll = 5 * math.sin(self.t / 25) + self.rng.gauss(0, 0.5)
        vsi = 80 * math.sin(self.t / 30) + self.rng.gauss(0, 15)
        if self.scenario == "descent":
            airspeed -= 60 * envelope
            pitch += 12 * envelope
            roll += 20 * envelope
            vsi -= 1200 * envelope
        elif self.scenario == "bank":
            roll += 50 * envelope
        elif self.scenario == "airspeed":
            airspeed -= 60 * envelope
        # Integrate the reported VSI (ft/min), keeping altitude continuous.
        self.altitude += vsi * dt / 60
        return TelemetryFrame(
            timestamp=round(self.t, 3), altitude=self.altitude,
            airspeed=airspeed, pitch=pitch, roll=roll, vsi=vsi,
            heading=(90 + 10 * math.sin(self.t / 60)) % 360,
            is_anomaly=bool(active),
        )
