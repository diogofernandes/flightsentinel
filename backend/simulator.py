# =============================================================
# simulator.py
#
# WHAT THIS FILE DOES:
#   Generates fake flight data that looks like a real aircraft.
#   Every time you call next_frame(), you get one "snapshot"
#   of the aircraft's state at that moment.
#
# WHY FAKE DATA?
#   Real flight data requires access to aircraft systems.
#   For a demonstrator, we simulate realistic behaviour:
#   - Smooth cruise oscillations (sine waves + small noise)
#   - A synthetic stall every 30 seconds so the detector fires
#
# THE 5 PARAMETERS WE TRACK:
#   altitude  - height above sea level in feet
#   airspeed  - how fast the aircraft moves through the air (knots)
#   pitch     - nose up (+) or down (-) angle in degrees
#   roll      - left (-) or right (+) bank angle in degrees
#   vsi       - vertical speed in feet per minute (climbing or descending)
# =============================================================

import math
import random
import time
from dataclasses import dataclass, asdict


# A dataclass is like a simple container for structured data.
# @dataclass auto-generates __init__, __repr__ etc.
@dataclass
class TelemetryFrame:
    """One snapshot of the aircraft state at a given moment."""
    timestamp:  float   # seconds since simulator started
    altitude:   float   # feet
    airspeed:   float   # knots
    pitch:      float   # degrees (positive = nose up)
    roll:       float   # degrees (positive = right bank)
    vsi:        float   # feet per minute
    heading:    float   # degrees (0-360)
    is_anomaly: bool    # ground truth — did we inject a stall here?
    score:      float   # anomaly score from ML model (0-1)
    alert:      bool    # True if score > threshold

    def to_dict(self) -> dict:
        """Convert to plain Python dict for JSON serialisation."""
        return asdict(self)


class TelemetrySimulator:
    """
    Simulates a small general aviation aircraft in cruise.

    Normal flight: smooth sine-wave oscillations around cruise values,
    with small Gaussian noise added to each parameter.

    Stall injection: every ANOMALY_EVERY seconds, we inject a
    4-second stall approach where airspeed drops, pitch rises,
    and VSI goes strongly negative — the classic stall signature.
    """

    # --- Timing ---
    RATE_HZ         = 10    # frames per second
    ANOMALY_EVERY   = 30    # inject a stall every N seconds
    ANOMALY_DUR     = 4     # stall lasts N seconds

    def __init__(self):
        self.t = 0.0                        # current time in seconds
        self._next_anomaly = self.ANOMALY_EVERY
        self._in_anomaly   = False
        self._anomaly_t    = 0.0            # how long we've been in stall

    def next_frame(self) -> TelemetryFrame:
        """
        Advance the simulation by one tick (1/RATE_HZ seconds)
        and return a TelemetryFrame with the current values.
        """
        self.t += 1.0 / self.RATE_HZ

        # Check if we should start a stall
        if not self._in_anomaly and self.t >= self._next_anomaly:
            self._in_anomaly = True
            self._anomaly_t  = 0.0

        # Advance the stall timer if we're in one
        if self._in_anomaly:
            self._anomaly_t += 1.0 / self.RATE_HZ
            if self._anomaly_t >= self.ANOMALY_DUR:
                self._in_anomaly   = False
                self._next_anomaly = self.t + self.ANOMALY_EVERY

        # Generate values depending on flight phase
        if self._in_anomaly:
            return self._stall_frame()
        else:
            return self._normal_frame()

    def _normal_frame(self) -> TelemetryFrame:
        """
        Generate one normal cruise frame.

        Math: base_value + amplitude * sin(time / period) + noise
        - The sine wave creates slow, realistic oscillations
        - random.gauss(0, std) adds small random noise on top
        """
        t = self.t
        return TelemetryFrame(
            timestamp = round(t, 2),
            altitude  = 8000 + 200 * math.sin(t / 30) + random.gauss(0, 20),
            airspeed  = 120  + 10  * math.sin(t / 20) + random.gauss(0, 1.5),
            pitch     =         2  * math.sin(t / 15) + random.gauss(0, 0.3),
            roll      =         5  * math.sin(t / 25) + random.gauss(0, 0.5),
            vsi       =        50  * math.sin(t / 30) + random.gauss(0, 15),
            heading   = (90 + 10 * math.sin(t / 60)) % 360,
            is_anomaly= False,
            score     = 0.0,   # filled in by the detector later
            alert     = False,
        )

    def _stall_frame(self) -> TelemetryFrame:
        """
        Generate one stall-approach frame.

        p = progress through the stall (0.0 at start, 1.0 at end)
        As p increases:
          - airspeed drops  (losing lift)
          - pitch rises     (pilot pulling back)
          - vsi goes negative (descending despite nose-up)
          - roll increases  (becoming unstable)
        """
        p = self._anomaly_t / self.ANOMALY_DUR   # 0 → 1
        t = self.t
        return TelemetryFrame(
            timestamp = round(t, 2),
            altitude  = 8000 - 500  * p + random.gauss(0, 40),
            airspeed  = 120  - 60   * p + random.gauss(0, 3),
            pitch     = 12   * p        + random.gauss(0, 1),
            roll      = 20   * math.sin(p * math.pi) + random.gauss(0, 2),
            vsi       = -1200 * p       + random.gauss(0, 80),
            heading   = (90 + 10 * math.sin(t / 60)) % 360,
            is_anomaly= True,
            score     = 0.0,   # filled in later
            alert     = False,
        )
