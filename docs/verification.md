# Local verification

These are local results, not a claim of a completed GitHub Actions run.

- Python 3.12.3: **13 backend tests passed** in a project-local virtual environment.
- Node.js 20.20.2: **6 frontend transport tests passed**.
- Production build: passed with Vite 8.3.3; chart code loads in a separate chunk.
- npm audit: **0 known vulnerabilities** at the time of verification.
- pip check: no broken requirements.
- Chrome browser smoke check: desktop (1440×1000) and mobile (390×844),
  four rendering charts, threshold matches backend health, six readouts hidden
  during an induced outage, portfolio JSON/recording loaded, pause control works,
  no uncaught browser JavaScript exceptions, and no root horizontal overflow.
- Desktop/mobile screenshots are captures of the actual app and portfolio page,
  not generated mockups.
- The dependency update replaces Vite 5 and Recharts 2 and removes the unused icon package.
- GitHub Actions is configured to run backend tests/evaluation and frontend tests/build
  after push. It has not been dispatched as part of this local change.

Reproduce the numerical evaluation with:

```bash
python -m backend.evaluate --replay
```

See [evaluation.md](evaluation.md) for the normal false-positive rate, event recall,
detection delays, rule baseline, and limitations. Those results use the same
synthetic generator as training with held-out noise seeds. They do not validate
performance on aircraft telemetry.

The optional browser script and setup are documented in the README. It needs a
running application, a static docs server, and Playwright/Chromium (or installed Chrome).

One upstream warning remains: Starlette's test client deprecates its httpx
transport in favor of httpx2. Tests pass using the pinned httpx version; no
warnings are suppressed.
