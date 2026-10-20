import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
const web = await build({ entryPoints: ['web/main.tsx'], bundle: true, write: false, metafile: true, format: 'iife', platform: 'browser', target: 'es2022', minify: true, define: { 'process.env.NODE_ENV': '"production"' } });
const js = web.outputFiles.find(f => f.path.endsWith('.js'))?.text || web.outputFiles[0].text;
const css = await readFile('web/style.css', 'utf8');
await writeFile('dist/panel.html', `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Git 总览</title><style>${css.replace(/<\/style/gi, '<\\/style')}</style></head><body><div id="root"></div><script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`);
const server = await build({ entryPoints: ['server/mcp.ts'], outfile: 'dist/server.mjs', bundle: true, metafile: true, platform: 'node', format: 'esm', target: 'node22', banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' } });
const packages = new Set();
for (const path of [...Object.keys(web.metafile.inputs), ...Object.keys(server.metafile.inputs)]) {
  const match = path.match(/^node_modules\/((?:@[^/]+\/)?[^/]+)/); if (match) packages.add(match[1]);
}
const notices = [];
for (const name of [...packages].sort()) {
  const manifest = JSON.parse(await readFile(`node_modules/${name}/package.json`, 'utf8'));
  let license = '';
  for (const file of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'LICENSE-MIT', 'COPYING']) {
    try { license = await readFile(`node_modules/${name}/${file}`, 'utf8'); break; } catch { /* next name */ }
  }
  notices.push(`${name} ${manifest.version}\nLicense: ${manifest.license || 'See upstream package'}\n\n${license || JSON.stringify(manifest.repository || '')}`);
}
await writeFile('dist/THIRD_PARTY_NOTICES.txt', notices.join('\n\n' + '='.repeat(72) + '\n\n'));
console.log('已构建 MCP 服务与内嵌面板');
