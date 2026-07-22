# =============================================================
# detector.py
#
# WHAT THIS FILE DOES:
#   Trains an Isolation Forest model on normal flight data,
#   then scores each incoming frame with a number from 0 to 1.
#   Score close to 0 = normal. Score close to 1 = anomaly.
#
# HOW ISOLATION FOREST WORKS (simple version):
#   Imagine throwing random lines across your data to split it.
#   Anomalies are "alone" in the data space, so they get
#   isolated with very few cuts. Normal points are surrounded
#   by similar points, so they need many cuts to isolate.
#   Fewer cuts = higher anomaly score.
#
# WHY UNSUPERVISED?
#   We don't have labelled examples of every possible anomaly.
#   We only know what normal flight looks like.
#   Isolation Forest only needs normal data to train —
#   it learns the "shape" of normal and flags anything outside it.
# =============================================================

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from simulator import TelemetrySimulator, TelemetryFrame


# The 5 features we feed to the model.
# Order matters — must be consistent between training and inference.
FEATURES = ['altitude', 'airspeed', 'pitch', 'roll', 'vsi']

# Score above this threshold triggers an alert.
# Derived from F1 sweep on evaluation data — not a magic number.
THRESHOLD = 0.65


class AnomalyDetector:
    """
    Wraps an Isolation Forest with a StandardScaler.

    Training:
        1. Generate 6,000 frames of normal flight
        2. Fit StandardScaler (makes all features same scale)
        3. Fit IsolationForest on scaled data

    Inference:
        1. Scale the incoming frame the same way as training data
        2. Get raw sklearn score (negative = more anomalous)
        3. Convert to [0, 1] where 1 = most anomalous
    """

    def __init__(self):
        self.scaler  = StandardScaler()
        self.model   = IsolationForest(
            n_estimators = 200,    # 200 trees in the forest
                                   # more trees = more stable scores
                                   # performance plateaus around 150, we use 200 for margin
            contamination = 0.05,  # we expect at most 5% of training data to be anomalous
                                   # (our training data is 100% normal, but this calibrates sensitivity)
            random_state  = 42,    # makes results reproducible
            n_jobs        = -1,    # use all CPU cores
        )
        self._trained = False

    def train(self):
        """
        Generate training data and fit the model.
        Called once at startup — takes about 5 seconds.
        """
        print("[Detector] Generating training data...")
        X_train = self._generate_normal_data(n=6000)

        print("[Detector] Fitting StandardScaler...")
        # StandardScaler: subtracts mean, divides by std dev
        # Result: every feature has mean=0, std=1
        # WHY: without this, altitude (range ~7800-8200) would dominate
        # over pitch (range -3 to +3), which would be nearly ignored
        self.scaler.fit(X_train)
        X_scaled = self.scaler.transform(X_train)

        print("[Detector] Training Isolation Forest...")
        self.model.fit(X_scaled)
        self._trained = True
        print("[Detector] Ready.")

    def score(self, frame: TelemetryFrame) -> tuple[float, bool]:
        """
        Score one telemetry frame.

        Returns:
            score     float in [0, 1]  — higher = more anomalous
            is_alert  bool             — True if score > THRESHOLD
        """
        if not self._trained:
            return 0.0, False

        # Extract the 5 features as a numpy array
        # shape: (1, 5) — the model expects a 2D array
        x = np.array([[
            frame.altitude,
            frame.airspeed,
            frame.pitch,
            frame.roll,
            frame.vsi,
        ]], dtype=np.float32)

        # Scale using the same scaler fitted on training data
        x_scaled = self.scaler.transform(x)

        # Get raw sklearn score
        # sklearn convention: more negative = more anomalous
        # typical range for our data: [-0.8, +0.1]
        raw = float(self.model.score_samples(x_scaled)[0])

        # Convert to [0, 1] where 1 = most anomalous
        score = self._normalise(raw)
        alert = score > THRESHOLD
        return score, alert

    def _normalise(self, raw: float) -> float:
        """
        Convert sklearn raw score to [0, 1] anomaly score.

        Formula:
            clip the raw score to [-0.8, 0.1]
            then: score = 1 - (clipped - (-0.8)) / (0.1 - (-0.8))
            then: clamp to [0, 1]

        This flips the direction (sklearn: negative=anomaly → we want: 1=anomaly)
        and normalises to a clean 0-1 range for display.
        """
        CLIP_LOW  = -0.8
        CLIP_HIGH =  0.1
        clipped = max(CLIP_LOW, min(CLIP_HIGH, raw))
        score   = 1.0 - (clipped - CLIP_LOW) / (CLIP_HIGH - CLIP_LOW)
        return max(0.0, min(1.0, score))

    def _generate_normal_data(self, n: int) -> np.ndarray:
        """
        Generate n normal flight frames for training.
        We use the simulator in "normal only" mode —
        the model must NEVER see anomaly data during training.
        """
        sim  = TelemetrySimulator()
        rows = []
        for _ in range(n):
            frame = sim._normal_frame()
            sim.t += 1.0 / sim.RATE_HZ
            rows.append([
                frame.altitude,
                frame.airspeed,
                frame.pitch,
                frame.roll,
                frame.vsi,
            ])
        return np.array(rows, dtype=np.float32)
