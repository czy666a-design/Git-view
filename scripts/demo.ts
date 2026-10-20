import { spawn } from 'node:child_process';
import { mkdtemp, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFixture } from '../tests/fixture.js';
const root=await realpath(await mkdtemp(join(tmpdir(),'git-overview-example-'))); const project=join(root,'design-system'); await createFixture(project);
const child=spawn(process.execPath,['--import','tsx','server/dev.ts',project],{stdio:'inherit',env:{...process.env,PORT:'0'}});
console.log(`体验项目：${project}`); process.on('SIGINT',()=>child.kill());process.on('SIGTERM',()=>child.kill());
