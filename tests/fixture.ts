import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
export function fixtureGit(project: string,args: string[], env: Record<string,string> = {}) { return execFileSync('git',args,{cwd:project,encoding:'utf8',env:{...process.env,GIT_TERMINAL_PROMPT:'0',...env},stdio:['ignore','pipe','pipe']}).trim(); }
export async function createFixture(project: string, dirty = true) {
  await mkdir(project,{recursive:true}); fixtureGit(project,['init','-b','main']); fixtureGit(project,['config','user.name','Design Team']); fixtureGit(project,['config','user.email','design@example.com']);
  let tick=0; const ids: Record<string,string> = {};
  const dateEnv = () => { const date = new Date(Date.UTC(2026,9,19,2,30+(tick++))).toISOString(); return {GIT_AUTHOR_DATE:date,GIT_COMMITTER_DATE:date}; };
  const commit = async (key: string,title: string,files: Record<string,string|Buffer>) => { for (const [file,content] of Object.entries(files)) { await mkdir(dirname(join(project,file)),{recursive:true}); await writeFile(join(project,file),content); } fixtureGit(project,['add','-A']); fixtureGit(project,['commit','-m',title],dateEnv()); return ids[key]=fixtureGit(project,['rev-parse','HEAD']); };
  await commit('root','Initial project structure',{'README.md':'# Design system\n','.gitignore':'node_modules/\n.env\n'});
  await commit('base','chore: preserve design system baseline',{'src/tokens.ts':'export const color = "blue";\n','shared.txt':'baseline\n'});
  fixtureGit(project,['tag','v0.1.0']);
  fixtureGit(project,['switch','-c','codex/component-gallery']);
  await commit('gallery1','feat: build component documentation gallery',{'demo/src/Gallery.tsx':'export const Gallery = () => "Components";\n'});
  await commit('gallery2','Add component search and category navigation',{'demo/src/Gallery.tsx':'export const Gallery = () => "Search components by category";\n'});
  fixtureGit(project,['switch','-c','codex/design-sync',ids.base]);
  await commit('design1','Build code-first component discovery and design sync',{'.codex-plugin/plugin.json':'{"name":"design-system","version":"0.1.0"}\n','src/sync.ts':'export const sync = "one-way";\n'});
  fixtureGit(project,['switch','-c','codex/code-onboarding',ids.base]);
  await commit('onboarding','Add code-first onboarding and component catalog',{'docs/onboarding.md':'Connect your design tokens and components.\n'});
  fixtureGit(project,['switch','main']); fixtureGit(project,['merge','--no-ff','codex/design-sync','-m','Merge design sync foundations into main'],dateEnv()); ids.main=fixtureGit(project,['rev-parse','HEAD']);
  fixtureGit(project,['tag','-a','v0.2.0','-m','Design sync foundations']);
  fixtureGit(project,['switch','codex/component-gallery']); fixtureGit(project,['merge','--no-ff','main','-m','Merge design continuation into component documentation gallery'],dateEnv()); ids.merge=fixtureGit(project,['rev-parse','HEAD']);
  fixtureGit(project,['switch','codex/design-sync']);
  await commit('current','Refine bidirectional sync and component validation',{'src/sync.ts':'export const sync = "bidirectional";\n','.codex-plugin/plugin.json':'{"name":"design-system","version":"0.2.0"}\n'});
  fixtureGit(project,['branch','codex/design-system-lifecycle']);
  fixtureGit(project,['switch','-c','remote-seed',ids.base]); await commit('remote','Explore remote-only component experiments',{'experiments.md':'Component experiment\n'});
  fixtureGit(project,['update-ref','refs/remotes/origin/experiment',ids.remote]); fixtureGit(project,['switch','codex/design-sync']); fixtureGit(project,['branch','-D','remote-seed']);
  fixtureGit(project,['update-ref','refs/remotes/origin/main',ids.main]); fixtureGit(project,['update-ref','refs/remotes/origin/design-sync',ids.design1]);
  fixtureGit(project,['config','branch.codex/design-sync.remote','origin']); fixtureGit(project,['config','branch.codex/design-sync.merge','refs/heads/design-sync']); fixtureGit(project,['config','remote.origin.url','https://example.invalid/design-system.git']); fixtureGit(project,['config','remote.origin.fetch','+refs/heads/*:refs/remotes/origin/*']);
  if (dirty) {
    await writeFile(join(project,'.codex-plugin/plugin.json'),'{"name":"design-system","version":"0.3.0"}\n'); fixtureGit(project,['add','.codex-plugin/plugin.json']);
    await writeFile(join(project,'README.md'),(await readFile(join(project,'README.md'),'utf8'))+'\nAdd bidirectional component documentation.\n');
    await mkdir(join(project,'demo/src'),{recursive:true});
    await writeFile(join(project,'demo/src/ComponentGallery.tsx'),'export const ComponentGallery = () => "New gallery";\n');
  }
  return ids;
}
