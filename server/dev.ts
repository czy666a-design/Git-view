import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { Service } from './service.js';
const service = new Service(); const binding = await service.open(resolve(process.argv[2] || process.cwd()));
const token = randomBytes(32).toString('hex');
const hostBundle = await build({ entryPoints: ['scripts/mcp-host.ts'], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' });
const server = createServer(async (req,res) => {
  res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  if (req.headers.host !== new URL(origin).host) { res.writeHead(403).end(); return; }
  if (req.url === '/favicon.ico') { res.writeHead(204).end(); return; }
  if (req.url === '/api' && req.method === 'POST') {
    if (req.headers.authorization !== `Bearer ${token}` || (req.headers.origin && req.headers.origin !== origin)) { res.writeHead(403).end(); return; }
    try {
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 100000) throw new Error('请求过大'); }
      const { action, ...params } = JSON.parse(body);
      let data;
      if (action === 'binding') data = { ...binding, graph: await service.reader.graph(binding.graph.repository.path) };
      else if (action === 'open') data = await service.openWorktree(params.sessionId || binding.sessionId, params.projectPath);
      else data = await service.call(action, { ...params, sessionId: params.sessionId || binding.sessionId });
      res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(data));
    } catch(e:any) { res.writeHead(400,{'Content-Type':'application/json'}).end(JSON.stringify({error:{code:e.code || 'ERROR',message:e.message}})); }
    return;
  }
  if (req.url?.split('?')[0] === '/' && req.method === 'GET') {
    try { res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(await readFile(new URL('../dist/panel.html', import.meta.url))); }
    catch { res.writeHead(503).end('请先运行 npm run build'); }
    return;
  }
  if (req.url === '/host' && req.method === 'GET') { res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body><script type="module">${hostBundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script></body></html>`); return; }
  res.writeHead(404).end();
});
server.listen(Number(process.env.PORT || 4173),'127.0.0.1',() => console.log(`Git 总览开发入口：http://127.0.0.1:${(server.address() as any).port}/#dev=${token}`));
