import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'build', 'frames');
const PORT = 8731;
const FPS = 24;

const START = Number(process.argv[2] ?? 0);
const END = Number(process.argv[3] ?? 0);      // 0 = 全部
const ONLY_ONE = process.argv[4];              // 可选：单帧时间点（秒）

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/src/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); res.end('404'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

function findChrome() {
  const local = [
    path.join(ROOT, 'bin/chrome-headless-shell-win64/chrome-headless-shell.exe'),
    path.join(ROOT, 'bin/chrome-win64/chrome.exe'),
  ].filter((f) => fs.existsSync(f));
  if (local.length) return local;

  const base = 'C:/Users/admin/.cache/puppeteer';
  const cands = [];
  if (fs.existsSync(base)) {
    for (const dir of fs.readdirSync(base)) {
      const d = path.join(base, dir);
      if (!fs.statSync(d).isDirectory()) continue;
      for (const v of fs.readdirSync(d)) {
        for (const exe of ['chrome-win64/chrome.exe', 'chrome-headless-shell-win64/chrome-headless-shell.exe']) {
          const f = path.join(d, v, exe);
          if (fs.existsSync(f)) cands.push(f);
        }
      }
    }
  }
  return cands;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

  const cands = findChrome();
  console.log('chrome candidates:', cands);
  if (!cands.length) throw new Error('no chrome found');

  const exe = cands.find((c) => c.includes('chrome-win64')) || cands[0];
  const isShell = exe.includes('chrome-headless-shell');
  const browser = await puppeteer.launch({
    executablePath: exe,
    headless: isShell ? 'shell' : 'new',
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
      '--use-angle=d3d11',
      '--disable-dev-shm-usage', '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--window-size=1920,804',
    ],
    defaultViewport: { width: 1920, height: 804, deviceScaleFactor: 1 },
    dumpio: false,
  });

  const page = await browser.newPage();
  page.on('console', (m) => {
    const t = m.text();
    if (/error|Error|ERROR/.test(t)) console.log('[page]', t.slice(0, 400));
  });
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 400)));

  await page.goto(`http://127.0.0.1:${PORT}/src/index.html`, { waitUntil: 'networkidle0', timeout: 120000 });
  await page.waitForFunction('window.MV && window.MV.ready === true', { timeout: 120000 });
  const dur = await page.evaluate(() => window.MV.duration);
  const gl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    const g = c.getContext('webgl2');
    const d = g && g.getExtension('WEBGL_debug_renderer_info');
    return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  console.log('duration:', dur, '| GPU:', gl);

  if (ONLY_ONE) {
    const times = String(ONLY_ONE).split(',').map(Number);
    for (const t of times) {
      await page.evaluate((tt) => window.MV.frame(tt), t);
      await new Promise((r) => setTimeout(r, 80));
      const f = path.join(ROOT, 'build', 'test', `t${t.toFixed(2)}.jpg`);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      await page.screenshot({ path: f, type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 1920, height: 804 } });
      console.log('wrote', f);
    }
    await browser.close(); server.close(); return;
  }

  const total = Math.round(dur * FPS);
  const end = END > 0 ? Math.min(END, total) : total;
  const t0 = Date.now();
  let written = 0;
  for (let i = START; i < end; i++) {
    const t = i / FPS;
    const file = path.join(OUT, `f${String(i).padStart(5, '0')}.jpg`);
    if (fs.existsSync(file) && fs.statSync(file).size > 2000) { written++; continue; }
    await page.evaluate((tt) => { window.MV.frame(tt); }, t);
    const buf = await page.screenshot({ type: 'jpeg', quality: 94, clip: { x: 0, y: 0, width: 1920, height: 804 } });
    fs.writeFileSync(file, buf);
    written++;
    if (i % 24 === 0) {
      const el = (Date.now() - t0) / 1000;
      const rate = written / Math.max(el, 0.001);
      const left = (end - i) / Math.max(rate, 0.001);
      console.log(`frame ${i}/${end} t=${t.toFixed(2)}s  ${rate.toFixed(2)} fps  eta ${(left / 60).toFixed(1)} min`);
    }
  }
  console.log('done frames', START, '->', end, 'in', ((Date.now() - t0) / 60000).toFixed(1), 'min');
  await browser.close();
  server.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
