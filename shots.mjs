// Screenshot driver for Marisol Bay: serves game/, drives headless Chrome over
// CDP, loads ?shot=N for each staged scene, waits for window.__shotReady, and
// saves a 1280x800 JPEG into screenshots/. Reports console errors and any
// non-localhost network request (there must be none).
// Usage: node shots.mjs [shot numbers...]   (default: 1 2 3 4)
import { spawn, execFile } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = 8091;
const CHROME = process.env.CHROME_BIN ?? '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const shots = process.argv.slice(2).map(Number).filter((n) => n >= 1 && n <= 4);
if (shots.length === 0) shots.push(1, 2, 3, 4);

const NAMES = { 1: '1-drive.jpg', 2: '2-beach.jpg', 3: '3-chase.jpg', 4: '4-mission.jpg' };

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitFor(fn, timeoutMs, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await fn()) return true;
    await sleep(250);
  }
  throw new Error('timeout waiting for ' + label);
}

const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: here, stdio: 'pipe' });
server.stdout.on('data', (d) => process.stdout.write('[serve] ' + d));
server.stderr.on('data', (d) => process.stderr.write('[serve] ' + d));

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader',
  '--window-size=1280,800', '--remote-debugging-port=9222', '--user-data-dir=/tmp/marisol-chrome-profile',
  '--autoplay-policy=no-user-gesture-required', 'about:blank',
], { stdio: 'pipe' });
chrome.stderr.on('data', (d) => { const s = String(d); if (/ERROR|FATAL/.test(s)) process.stderr.write('[chrome] ' + s); });

try {
  await waitFor(async () => {
    try { const r = await fetch('http://127.0.0.1:9222/json/version'); return r.ok; } catch { return false; }
  }, 20000, 'chrome devtools');
  await waitFor(async () => {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/index.html`); return r.ok; } catch { return false; }
  }, 10000, 'game server');

  const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target found');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let msgId = 0;
  const pending = new Map();
  const consoleErrors = [];
  const badRequests = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text ?? 'exception');
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    }
    if (m.method === 'Network.requestWillBeSent') {
      const url = m.params.request.url;
      if (!url.startsWith('http://localhost:') && !url.startsWith('http://127.0.0.1:') && !url.startsWith('data:') && !url.startsWith('blob:')) {
        badRequests.push(url);
      }
    }
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = ++msgId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

  mkdirSync(join(here, 'screenshots'), { recursive: true });
  for (const n of shots) {
    consoleErrors.length = 0;
    badRequests.length = 0;
    await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html?shot=${n}` });
    await waitFor(async () => {
      const r = await send('Runtime.evaluate', { expression: 'window.__shotReady === true', returnByValue: true });
      return r.result?.result?.value === true;
    }, 30000, `shot ${n} ready`);
    await sleep(600); // let the frame settle
    const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
    const out = join(here, 'screenshots', NAMES[n]);
    writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
    const errs = await send('Runtime.evaluate', { expression: 'JSON.stringify({errors: window.__errors || [], fps: window.__fps})', returnByValue: true });
    console.log(`shot ${n} -> ${NAMES[n]} | page: ${errs.result?.result?.value} | console errors this shot: ${consoleErrors.length} | non-local requests: ${badRequests.length}`);
    if (consoleErrors.length) console.log('  console errors:', consoleErrors.slice(0, 3));
    if (badRequests.length) console.log('  bad requests:', badRequests.slice(0, 3));
  }
  ws.close();
  console.log('DONE');
} finally {
  chrome.kill('SIGTERM');
  server.kill('SIGTERM');
}
