import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const root = 'release/project-versions';
await rm(root, { recursive: true, force: true }); await mkdir(root, { recursive: true });
for (const path of ['dist', '.codex-plugin', '.mcp.json', 'skills', 'docs', 'design.md', 'README.md', 'LICENSE']) await cp(path, `${root}/${path}`, { recursive: true });
await writeFile(`${root}/package.json`, JSON.stringify({ name: 'project-versions', version: '0.2.8', private: true, type: 'module', engines: { node: '>=22' } }, null, 2));
await rm('release/project-versions-0.2.8.zip', { force: true });
execFileSync('zip', ['-qr', 'project-versions-0.2.8.zip', 'project-versions'], { cwd: 'release' });
console.log('安装包：release/project-versions-0.2.8.zip');
