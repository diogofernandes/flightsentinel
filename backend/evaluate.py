"""Reproducible held-out synthetic evaluation; no claims about real flight safety."""

import argparse
import json
from pathlib import Path
import platform
import time

import numpy as np
import sklearn

from .detector import (AlertTracker, AnomalyDetector, CALIBRATION_QUANTILE,
                       CALIBRATION_SEED, FEATURES, TRAIN_SEED, feature_matrix)
from .simulator import TelemetrySimulator

TEST_SEEDS = (101, 102, 103)
SCENARIOS = ("descent", "bank", "airspeed")


def metrics(labels, predicted):
    y, p = np.asarray(labels, dtype=bool), np.asarray(predicted, dtype=bool)
    tp, fp = int((y & p).sum()), int((~y & p).sum())
    fn, tn = int((y & ~p).sum()), int((~y & ~p).sum())
    return {
        "true_positive": tp, "false_positive": fp,
        "false_negative": fn, "true_negative": tn,
        "precision": tp / (tp + fp) if tp + fp else 0.0,
        "recall": tp / (tp + fn) if tp + fn else 0.0,
        "false_positive_rate": fp / (fp + tn) if fp + tn else 0.0,
    }


def event_metrics(frames, scores, threshold):
    tracker = AlertTracker(threshold)
    intervals, starts = [], []
    start = None
    for i, frame in enumerate(frames):
        if frame.is_anomaly and start is None:
            start = i
        if not frame.is_anomaly and start is not None:
            intervals.append((start, i))
            start = None
        count = tracker.count
        tracker.update(float(scores[i]))
        if tracker.count != count:
            starts.append(i)
    if start is not None:
        intervals.append((start, len(frames)))
    delays = []
    for begin, end in intervals:
        matches = [s for s in starts if begin <= s < end]
        if matches:
            delays.append(frames[matches[0]].timestamp - frames[begin].timestamp)
    return {
        "injected_events": len(intervals),
        "detected_events": len(delays),
        "missed_events": len(intervals) - len(delays),
        "false_alert_events": sum(not frames[s].is_anomaly for s in starts),
        "detection_delay_seconds": [round(d, 3) for d in delays],
    }


def baseline_scores(frames):
    # Explicit illustrative limits, not aircraft operating limits.
    return np.array([
        float(f.airspeed < 85 or abs(f.roll) > 25 or f.pitch > 8 or f.vsi < -500)
        for f in frames
    ])


def evaluate(detector):
    runs = []
    for scenario in SCENARIOS:
        for severity in (1.0, 0.5):
            labels_all, model_all, baseline_all = [], [], []
            model_events, baseline_events = [], []
            for seed in TEST_SEEDS:
                sim = TelemetrySimulator(seed=seed, scenario=scenario, severity=severity)
                frames = [sim.next_frame() for _ in range(2999)]
                labels = [f.is_anomaly for f in frames]
                scores = detector.scores(feature_matrix(frames))
                baseline = baseline_scores(frames)
                labels_all.extend(labels)
                model_all.extend(scores > detector.threshold)
                baseline_all.extend(baseline > 0.5)
                model_events.append(event_metrics(frames, scores, detector.threshold))
                baseline_events.append(event_metrics(frames, baseline, 0.5))
            def aggregate(events):
                delays = [d for e in events for d in e["detection_delay_seconds"]]
                return {
                    **{key: sum(e[key] for e in events) for key in
                       ("injected_events", "detected_events", "missed_events", "false_alert_events")},
                    "median_detection_delay_seconds": float(np.median(delays)) if delays else None,
                }
            runs.append({
                "scenario": scenario, "severity": severity,
                "frames": len(labels_all),
                "model": metrics(labels_all, model_all),
                "baseline": metrics(labels_all, baseline_all),
                "model_events": aggregate(model_events),
                "baseline_events": aggregate(baseline_events),
            })
    normal_sim = TelemetrySimulator(seed=TEST_SEEDS[0], anomalies=False)
    normal_frames = [normal_sim.next_frame() for _ in range(6000)]
    normal = feature_matrix(normal_frames)
    normal_scores = detector.scores(normal)
    frame = TelemetrySimulator(seed=101, anomalies=False).next_frame()
    elapsed = []
    for _ in range(100):
        started = time.perf_counter()
        detector.score(frame)
        elapsed.append((time.perf_counter() - started) * 1000)
    return {
        "scope": "Synthetic generator only; held-out noise seeds, not independent real flight data.",
        "features": list(FEATURES),
        "training_seed": TRAIN_SEED, "calibration_seed": CALIBRATION_SEED,
        "test_seeds": list(TEST_SEEDS), "calibration_quantile": CALIBRATION_QUANTILE,
        "threshold": detector.threshold,
        "normal_only": {
            "frames": len(normal),
            "false_positive_rate": float((normal_scores > detector.threshold).mean()),
            "events": event_metrics(
                normal_frames,
                normal_scores, detector.threshold)["false_alert_events"],
        },
        "inference_ms": {"median": float(np.median(elapsed)),
                         "p95": float(np.quantile(elapsed, 0.95))},
        "environment": {"python": platform.python_version(), "numpy": np.__version__,
                        "scikit_learn": sklearn.__version__},
        "runs": runs,
    }


def markdown(report):
    lines = [
        "# Synthetic evaluation", "",
        "Generated by `python -m backend.evaluate`. Timing is machine dependent.", "",
        report["scope"], "",
        f"Training seed: {TRAIN_SEED}; calibration seed: {CALIBRATION_SEED}; "
        f"held-out test seeds: {report['test_seeds']}.",
        "Each scenario/severity uses three 299.9-second runs (8,997 frames; complete injection intervals). "
        "The threshold uses the 99.5th percentile of 6,000 separate normal calibration frames; "
        "test results do not select it.",
        f"Calibrated threshold: **{report['threshold']:.4f}**. "
        "Scores measure relative unusualness, not anomaly probability.", "",
        "| Scenario | Severity | ML frame recall | ML normal-frame FPR | Baseline recall | Baseline FPR |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for run in report["runs"]:
        m, b = run["model"], run["baseline"]
        lines.append(f"| {run['scenario']} | {run['severity']:.1f} | {m['recall']:.1%} | "
                     f"{m['false_positive_rate']:.2%} | {b['recall']:.1%} | {b['false_positive_rate']:.2%} |")
    lines.extend(["", "Frame metrics above use the raw score threshold. Display alerts apply "
                  "three-frame confirmation and five-frame clearing with 0.03 hysteresis.", "",
                  "| Scenario | Severity | ML events detected / injected | False ML events | Median ML delay (s) | Baseline events detected / injected |",
                  "|---|---:|---:|---:|---:|---:|"])
    for run in report["runs"]:
        m, b = run["model_events"], run["baseline_events"]
        delay = m["median_detection_delay_seconds"]
        lines.append(f"| {run['scenario']} | {run['severity']:.1f} | "
                     f"{m['detected_events']} / {m['injected_events']} | {m['false_alert_events']} | "
                     f"{'—' if delay is None else f'{delay:.2f}'} | "
                     f"{b['detected_events']} / {b['injected_events']} |")
    n = report["normal_only"]
    t = report["inference_ms"]
    lines.extend(["", f"Normal-only holdout: {n['false_positive_rate']:.2%} raw frame FPR, "
                  f"{n['events']} confirmed alert events in {n['frames']} frames.",
                  f"Single-frame inference: median {t['median']:.2f} ms, p95 {t['p95']:.2f} ms.",
                  "", "## Limits", "",
                  "- Training, calibration and test data share the same generator and nominal envelope. "
                  "Different noise seeds are not evidence of generalization to real aircraft.",
                  "- Mild event edges are labeled anomalous even before their values become unusual. "
                  "Delay is measured from injection onset, including those edges.",
                  "- The simple baseline can outperform ML on obvious violations. The project does not "
                  "claim that ML is required or superior.",
                  "- Flight phases, sensor faults, turbulence and aircraft-specific operating limits "
                  "are not validated. Climb, approach or a different cruise envelope may trigger alerts.",
                  "- The simulator integrates VSI for altitude consistency; other channels are "
                  "illustrative signals, not a dynamics model.",
                  "", f"Environment: {report['environment']}.", ""])
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="docs/evaluation.json")
    parser.add_argument("--replay", action="store_true",
                        help="Also write a 90-second scored recording for the portfolio page")
    args = parser.parse_args()
    detector = AnomalyDetector()
    detector.train()
    report = evaluate(detector)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    output.with_suffix(".md").write_text(markdown(report), encoding="utf-8")
    if args.replay:
        sim = TelemetrySimulator(seed=101)
        tracker = AlertTracker(detector.threshold)
        frames = [sim.next_frame() for _ in range(900)]
        scores = detector.scores(feature_matrix(frames))
        recording = []
        for frame, score in zip(frames, scores):
            frame.score = float(score)
            frame.alert = tracker.update(frame.score)
            recording.append({k: round(v, 4) if isinstance(v, float) else v
                              for k, v in frame.to_dict().items()})
        replay = {"source": "Recorded synthetic run scored by backend.detector.AnomalyDetector",
                  "seed": 101, "threshold": detector.threshold, "rate_hz": sim.RATE_HZ,
                  "frames": recording}
        (output.parent / "demo-data.json").write_text(json.dumps(replay) + "\n", encoding="utf-8")
    print(markdown(report))


if __name__ == "__main__":
    main()
