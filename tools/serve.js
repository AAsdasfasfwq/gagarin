// Interactive preview server: node tools/serve.js [port]  → http://localhost:8080
import { serve } from './lib.js';
const { port } = await serve(parseInt(process.argv[2] || '8080', 10));
console.log(`Preview: http://localhost:${port}/index.html   (space = play/pause, ←/→ = frame step, "score" = render music)`);
