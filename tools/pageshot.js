// node tools/pageshot.js "tools/modelsheet.html?mode=heads" out.png
import { serve, launch } from './lib.js';
const [url, out] = process.argv.slice(2);
const { server, port } = await serve();
const b = await launch();
const p = await b.newPage();
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
p.on('console', (m) => m.type() === 'error' && console.log('[err]', m.text()));
await p.goto(`http://127.0.0.1:${port}/${url}`);
await p.waitForFunction('window.done === true', { timeout: 60000 });
await (await p.$('canvas')).screenshot({ path: out });
await b.close(); server.close();
