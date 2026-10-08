"""Isolation Forest calibrated on separate, seeded normal telemetry."""

import numpy as np
from sklearn.ensemble import IsolationForest

from .simulator import TelemetryFrame, TelemetrySimulator

# Absolute altitude alone is not abnormal: aircraft can cruise at other levels.
# Altitude and heading remain visible, but are not detector inputs.
FEATURES = ("airspeed", "pitch", "roll", "vsi")
TRAIN_SEED = 42
CALIBRATION_SEED = 43
CALIBRATION_QUANTILE = 0.995


def feature_matrix(frames) -> np.ndarray:
    x = np.array([[getattr(f, key) for key in FEATURES] for f in frames], dtype=float)
    if x.ndim != 2 or x.shape[1] != len(FEATURES) or not np.isfinite(x).all():
        raise ValueError("Telemetry features must be finite numbers")
    return x


class AnomalyDetector:
    def __init__(self):
        self.model = IsolationForest(n_estimators=200, contamination="auto",
                                     random_state=TRAIN_SEED, n_jobs=1)
        self.threshold = None
        self._trained = False

    @staticmethod
    def normal_data(seed: int, n: int = 6000) -> np.ndarray:
        sim = TelemetrySimulator(seed=seed, anomalies=False)
        return feature_matrix([sim.next_frame() for _ in range(n)])

    def train(self):
        self.model.fit(self.normal_data(TRAIN_SEED))
        calibration = self.scores(self.normal_data(CALIBRATION_SEED))
        self.threshold = float(np.quantile(calibration, CALIBRATION_QUANTILE))
        self._trained = True

    def scores(self, x: np.ndarray) -> np.ndarray:
        if not np.isfinite(x).all():
            raise ValueError("Telemetry features must be finite numbers")
        # Flip sklearn's negative score without inventing a probability scale.
        return np.clip(-self.model.score_samples(x), 0.0, 1.0)

    def score(self, frame: TelemetryFrame) -> tuple[float, bool]:
        if not self._trained:
            raise RuntimeError("Detector must be trained before scoring")
        score = float(self.scores(feature_matrix([frame]))[0])
        return score, score > self.threshold


class AlertTracker:
    """Three high frames to enter; five low frames to clear, with hysteresis."""

    def __init__(self, threshold: float, enter_frames: int = 3, exit_frames: int = 5):
        self.threshold = threshold
        self.clear_threshold = threshold - 0.03
        self.enter_frames = enter_frames
        self.exit_frames = exit_frames
        self.active = False
        self.count = 0
        self.high = self.low = 0

    def update(self, score: float) -> bool:
        if not np.isfinite(score):
            raise ValueError("Score must be finite")
        if not self.active:
            self.high = self.high + 1 if score > self.threshold else 0
            if self.high >= self.enter_frames:
                self.active = True
                self.count += 1
                self.high = 0
        else:
            self.low = self.low + 1 if score < self.clear_threshold else 0
            if self.low >= self.exit_frames:
                self.active = False
                self.low = 0
        return self.active
