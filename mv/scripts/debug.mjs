import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 8732;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/src/index.html';
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { console.log('404', p); res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const exe = path.join(ROOT, 'bin/chrome-headless-shell-win64/chrome-headless-shell.exe');
const browser = await puppeteer.launch({
  executablePath: exe, headless: 'shell',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--use-angle=swiftshader', '--disable-dev-shm-usage', '--hide-scrollbars'],
  defaultViewport: { width: 1920, height: 804, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
page.on('console', (m) => console.log('[console.' + m.type() + ']', m.text().slice(0, 600)));
page.on('pageerror', (e) => console.log('[pageerror]', String(e.stack || e).slice(0, 1200)));
page.on('requestfailed', (r) => console.log('[reqfail]', r.url(), r.failure()?.errorText));

await page.goto(`http://127.0.0.1:${PORT}/src/index.html`, { waitUntil: 'networkidle0', timeout: 60000 }).catch((e) => console.log('goto err', e.message));
await new Promise((r) => setTimeout(r, 4000));

const info = await page.evaluate(() => {
  const c = document.createElement('canvas');
  const gl2 = c.getContext('webgl2');
  const gl1 = c.getContext('webgl');
  const d = gl2 && gl2.getExtension('WEBGL_debug_renderer_info');
  return {
    MV: typeof window.MV,
    err: window.MV_ERROR || null,
    webgl2: !!gl2,
    webgl1: !!gl1,
    renderer: d ? gl2.getParameter(d.UNMASKED_RENDERER_WEBGL) : null,
    canvases: document.querySelectorAll('canvas').length,
    html: document.getElementById('card')?.innerHTML?.slice(0, 200),
  };
});
console.log('INFO', JSON.stringify(info, null, 2));
await browser.close(); server.close();
