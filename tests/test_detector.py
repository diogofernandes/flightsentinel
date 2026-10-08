from dataclasses import replace

import numpy as np
import pytest

from backend.detector import AlertTracker, AnomalyDetector, feature_matrix
from backend.simulator import TelemetrySimulator


@pytest.fixture(scope="module")
def detector():
    model = AnomalyDetector()
    model.train()
    return model


def test_seeded_simulation_and_altitude_integration():
    a, b = TelemetrySimulator(seed=101), TelemetrySimulator(seed=101)
    altitude = 8000
    for _ in range(1000):
        frame = a.next_frame()
        assert frame == b.next_frame()
        assert frame.altitude - altitude == pytest.approx(frame.vsi / 600)
        altitude = frame.altitude
    assert frame.timestamp == 100


def test_training_reproducible(detector):
    second = AnomalyDetector()
    second.train()
    assert second.threshold == detector.threshold
    x = detector.normal_data(103, 100)
    np.testing.assert_array_equal(second.scores(x), detector.scores(x))


def test_held_out_normal_false_positive_rate(detector):
    scores = detector.scores(detector.normal_data(101))
    assert np.all((scores >= 0) & (scores <= 1))
    # A regression budget on this synthetic envelope, not a safety requirement.
    assert (scores > detector.threshold).mean() < 0.02
    tracker = AlertTracker(detector.threshold)
    for score in scores:
        tracker.update(float(score))
    assert tracker.count <= 2


@pytest.mark.parametrize("scenario", ["descent"])
def test_obvious_synthetic_event_detected(detector, scenario):
    sim = TelemetrySimulator(seed=102, scenario=scenario)
    frames = [sim.next_frame() for _ in range(600)]
    scores = detector.scores(feature_matrix(frames))
    assert (scores[np.array([f.is_anomaly for f in frames])] > detector.threshold).mean() > 0.3
    tracker = AlertTracker(detector.threshold)
    for score in scores:
        tracker.update(float(score))
    assert tracker.count >= 1


def test_untrained_and_invalid_telemetry_fail_explicitly(detector):
    frame = TelemetrySimulator().next_frame()
    with pytest.raises(RuntimeError):
        AnomalyDetector().score(frame)
    with pytest.raises(ValueError):
        detector.score(replace(frame, airspeed=float("nan")))
    with pytest.raises(ValueError):
        detector.score(replace(frame, vsi=float("inf")))


def test_altitude_is_not_an_absolute_anomaly_feature(detector):
    frame = TelemetrySimulator().next_frame()
    assert detector.score(frame) == detector.score(replace(frame, altitude=18000))


def test_alert_confirmation_hysteresis_and_event_count():
    tracker = AlertTracker(0.65)
    assert not tracker.update(0.8)
    assert not tracker.update(0.4)
    for _ in range(3):
        tracker.update(0.8)
    assert tracker.active and tracker.count == 1
    for score in [0.64, 0.67, 0.63] * 10:
        assert tracker.update(score)
    for _ in range(5):
        tracker.update(0.4)
    assert not tracker.active
    for _ in range(3):
        tracker.update(0.8)
    assert tracker.count == 2


@pytest.mark.parametrize("scenario", ["bank", "airspeed"])
def test_rule_baseline_catches_obvious_isolated_deviation(scenario):
    # ML misses many isolated changes; benchmark rules are an honest reference.
    from backend.evaluate import baseline_scores, event_metrics
    sim = TelemetrySimulator(seed=102, scenario=scenario)
    frames = [sim.next_frame() for _ in range(599)]
    result = event_metrics(frames, baseline_scores(frames), 0.5)
    assert result["detected_events"] == result["injected_events"] == 1
