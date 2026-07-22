# FlightSentinel · Flight Anomaly Monitor

Real-time flight anomaly detection built with **PySide6 (Qt for Python)**, **PyTorch**, and **scikit-learn**.

A cockpit-style instrument panel that ingests live telemetry at 10 Hz, scores each frame against a trained Isolation Forest model, and fires alerts when the aircraft deviates from its normal flight envelope.

Built as a portfolio demonstrator for the **Simulation, Methods & Tools** track at [Critical FlyTech](https://criticalflytech.com), an Airbus + Critical Software joint venture.

---

## What it does

- Streams five flight parameters at 10 Hz (altitude, airspeed, pitch, roll, vertical speed)
- Scores each frame with a PyTorch-wrapped Isolation Forest model
- Displays alerts on a dark Qt instrument panel with live pyqtgraph charts
- Logs every anomaly event to a scrollable table with full parameter context
- Accepts external telemetry over TCP; any process can pipe JSON frames in

---

## Quick start

```bash
git clone https://github.com/diogofernandes/flightsentinel.git
cd flightsentinel

python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

pip install PySide6 numpy pandas scikit-learn torch pyqtgraph pytest

python main.py --train           # train model (~10 seconds)
python main.py                   # launch UI
```

The simulator injects a synthetic stall every 30 seconds so you can watch the detector fire immediately.

---

## Architecture

```
QMainWindow  (main thread, UI only)
  ├── InstrumentReadouts   ← amber numeric displays
  ├── AnomalyScoreBar      ← colour-coded 0–1 gauge
  ├── pyqtgraph charts     ← 4-panel live telemetry
  └── AlertLogPanel        ← QTableWidget event log
         ▲
         │  Signal (frame_ready)   ← Qt thread-safe channel
         │
TelemetryWorker  (QThread, never touches UI)
  ├── TelemetrySimulator   ← 10 Hz stream + anomaly injection
  └── AnomalyDetector      ← IsolationForest in PyTorch nn.Module
         ▲
         │  optional
TCPTelemetryReceiver  (daemon thread, port 54399)
  └── JSON frames from any external source
```

The critical design decision: inference runs in a `QThread`, never on the main thread. The worker emits a Qt Signal per frame and the UI catches it and updates all widgets in one pass. This is the standard Qt pattern for any application with background processing.

---

## V-cycle mapping

Each design decision traces to a stated requirement and a corresponding test, following the same principle as DO-178C certified development.

| Requirement | Implementation | Verification |
|---|---|---|
| Score in [0, 1] | Clipped normalisation in model wrapper | `test_model_scores_in_range()` |
| Anomaly score > normal score | Trained on normal data only | `assert score_anomaly > score_normal` |
| UI not freeze at 10 Hz | QThread + Signal architecture | Event loop stays responsive |
| Alert on rising edge only | `last_was_anomaly` guard | One log row per event, not per frame |
| Anomaly frame differs from normal | Stall injector in simulator | `test_anomaly_frame_differs_from_normal()` |
| External data replaces simulator | TCPTelemetryReceiver port 54399 | JSON pipes in cleanly |

---

## Project structure

```
flightsentinel/
├── data/
│   └── simulator.py        # 10 Hz telemetry stream + stall injection
├── model/
│   ├── train.py            # IsolationForest training → flightsentinel.pt
│   ├── infer.py            # AnomalyDetector: frame scorer
│   ├── flightsentinel.pt        # trained model (after --train)
│   └── scaler.pkl          # fitted StandardScaler
├── ui/
│   ├── main_window.py      # QMainWindow + QThread worker
│   ├── instruments.py      # InstrumentReadout, AnomalyScoreBar widgets
│   ├── alert_panel.py      # QTableWidget anomaly log
│   └── theme.py            # dark EFIS Qt stylesheet
├── bridge/
│   └── tcp_receiver.py     # optional TCP input (port 54399)
├── tests/
│   └── test_flightsentinel.py   # 7 pytest unit tests
├── main.py                 # entry point (--train flag)
├── params.py               # central config, one file for all tuneables
└── requirements.txt
```

---

## External telemetry via TCP

A TCP socket decouples the data source from the application. Swap the simulator for real avionics data, a HIL rig, or any other process without changing the UI.

```bash
# pipe a stall frame from the command line
echo '{"altitude": 7200, "airspeed": 58, "pitch": 14, "roll": 22, "vsi": -1100}' \
  | nc 127.0.0.1 54399

# or from Python
import socket, json
s = socket.create_connection(("127.0.0.1", 54399))
s.sendall((json.dumps(frame) + "\n").encode())
```

---

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| GUI | PySide6 (Qt for Python) | Official Qt bindings, same API as Qt C++ production tooling |
| Charts | pyqtgraph | Hardware-accelerated, designed for real-time data |
| ML model | scikit-learn IsolationForest | Unsupervised; no labelled anomaly data needed |
| Serialisation | PyTorch nn.Module (.pt) | Consistent format; easy swap to LSTM Autoencoder |
| IPC | TCP sockets port 54399 | Language-agnostic; C++, Rust, or Python can all send frames |
| Tests | pytest | 7 tests, each mapping to a stated requirement |

---

## Run the tests

```bash
python -m pytest tests/ -v
```

All 7 tests pass on Python 3.10+.

---

## Author

**Diogo Fernandes** · VFX Compositor and AI/ML Pipeline Engineer  
13+ years in production VFX · Le Wagon Data Science and AI bootcamp · Lisbon, Portugal

[github.com/diogofernandes](https://github.com/diogofernandes) · [linkedin.com/in/diogo-fernandes](https://www.linkedin.com/in/diogo-fernandes-5221922a/)

Code walkthrough available on request or in an interview.
