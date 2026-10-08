const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '../frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const root = path.resolve(__dirname, '..');
  try {
    await page.goto((process.env.FLIGHTSENTINEL_URL || 'http://localhost:8000'), { waitUntil: 'networkidle' });
    await page.getByText('LIVE SIMULATION', { exact: true }).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.recharts-line-curve')].length === 4);
    await page.waitForFunction(() => [...document.querySelectorAll('.recharts-line-curve')]
      .every(line => (line.getAttribute('d') || '').length > 200), null, { timeout: 10000 });
    const health = await (await page.request.get((process.env.FLIGHTSENTINEL_URL || 'http://localhost:8000') + '/health')).json();
    assert.equal(health.stream_ready, true);
    assert.ok(health.sequence > 0);
    assert.ok(await page.getByText('Threshold ' + health.threshold.toFixed(3), { exact: true }).count());
    await page.getByText(/Seeded signals, not aircraft data/).waitFor();
    // Capture a complete actual anomaly waveform, not an empty startup chart.
    await page.waitForFunction(() => {
      const line = document.querySelector('.recharts-line-curve');
      return ((line?.getAttribute('d') || '').match(/L/g) || []).length >= 200;
    }, null, { timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('.alert-banner')?.textContent.includes('CONFIRMED'),
      null, { timeout: 45000 });
    await page.waitForFunction(() => !document.querySelector('.alert-banner')?.textContent.includes('CONFIRMED'),
      null, { timeout: 15000 });
    await page.getByText(/^[1-9][0-9]* events?$/, { exact: true }).waitFor({ timeout: 45000 });
    await page.screenshot({ path: path.join(root, 'docs/dashboard.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(root, 'docs/dashboard-mobile.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    // Exercise unavailable UI against the actual browser transport by blocking
    // subsequent WS reconnects and closing the current socket through a test proxy.
    const unavailable = await context.newPage();
    await unavailable.addInitScript(() => {
      const NativeWebSocket = window.WebSocket;
      window.__testSockets = [];
      window.WebSocket = class extends NativeWebSocket {
        constructor(...args) { super(...args); window.__testSockets.push(this); }
      };
    });
    await unavailable.goto((process.env.FLIGHTSENTINEL_URL || 'http://localhost:8000'));
    await unavailable.getByText('LIVE SIMULATION', { exact: true }).waitFor();
    await unavailable.evaluate(() => {
      window.WebSocket = class { constructor() { throw new Error('Test outage'); } };
      window.__testSockets.forEach(socket => socket.close());
    });
    await unavailable.getByText('TELEMETRY UNAVAILABLE', { exact: true }).waitFor();
    const unavailableText = await unavailable.locator('main').innerText();
    assert.ok(!unavailableText.includes('WITHIN LEARNED ENVELOPE'));
    assert.equal(await unavailable.locator('.instruments').getByText('---', { exact: true }).count(), 6);
    await unavailable.close();

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto((process.env.FLIGHTSENTINEL_PORTFOLIO_URL || 'http://localhost:8090'), { waitUntil: 'networkidle' });
    await page.getByText(/Normal-only holdout: 0.45%/).waitFor();
    await page.getByRole('button', { name: 'Pause replay' }).waitFor();
    assert.equal(await page.locator('table tr').count(), 7);
    assert.ok(await page.locator('.screenshot').evaluate(image => image.complete && image.naturalWidth > 0));
    await page.getByRole('button', { name: 'Pause replay' }).click();
    const score = await page.locator('#recording-info').innerText();
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#recording-info').innerText(), score);
    await page.screenshot({ path: path.join(root, 'docs/portfolio-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(root, 'docs/portfolio-mobile.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ desktop: 'pass', mobile: 'pass', unavailableState: 'pass',
      charts: '4 rendering', portfolioReplay: 'model recording loaded / pause works',
      browserErrors: errors, threshold: health.threshold, sequence: health.sequence }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });