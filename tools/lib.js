// Shared helpers for render.js / tools: static server + browser launcher.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary',
};

export function serve(port = 0) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      let file = path.join(ROOT, url === '/' ? 'index.html' : url);
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.stat(file, (err, st) => {
        if (err || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
        const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
        const range = req.headers.range;
        if (range) {
          const [a, b] = range.replace('bytes=', '').split('-');
          const start = parseInt(a, 10), end = b ? parseInt(b, 10) : st.size - 1;
          res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
          fs.createReadStream(file, { start, end }).pipe(res);
        } else {
          res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
          fs.createReadStream(file).pipe(res);
        }
      });
    });
    server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);

export async function launch({ gpu = false, headless = true } = {}) {
  let puppeteer, executablePath;
  try {
    puppeteer = (await import('puppeteer')).default;
    try { executablePath = puppeteer.executablePath(); if (!fs.existsSync(executablePath)) executablePath = undefined; } catch { executablePath = undefined; }
  } catch {
    puppeteer = (await import('puppeteer-core')).default;
  }
  if (!executablePath || process.env.CHROME_PATH) executablePath = CANDIDATES.find((p) => fs.existsSync(p));
  const args = [
    '--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required',
    '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--force-color-profile=srgb',
    '--js-flags=--max-old-space-size=4096', '--disable-accelerated-2d-canvas', '--disable-gpu-compositing',
  ];
  if (gpu) args.push('--enable-gpu', '--use-angle=default'); else args.push('--use-angle=swiftshader');
  return puppeteer.launch({ headless: headless ? true : false, executablePath, args, defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 }, protocolTimeout: 0 });
}

export async function openFilm(browser, port, { log = true } = {}) {
  const page = await browser.newPage();
  page.setDefaultTimeout(0);
  if (log) {
    page.on('console', (m) => { const ty = m.type(); if (ty === 'error' || ty === 'warning') console.log(`[page:${ty}]`, m.text()); });
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  }
  await page.goto(`http://127.0.0.1:${port}/index.html?render=1`, { waitUntil: 'load' });
  await page.evaluate(() => window.film.ready);
  return page;
}

export function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) o[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) o[k] = argv[++i];
      else o[k] = true;
    }
  }
  return o;
}
