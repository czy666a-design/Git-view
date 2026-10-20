import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFixture, fixtureGit as g } from './fixture.js';
import { RepositoryReader, parseWorking } from '../server/repository.js';
import { canonicalProject } from '../server/git.js';
import { Service } from '../server/service.js';
import { edgePath, layoutGraph } from '../web/layout.js';
const dirs: string[]=[]; after(async()=>{for(const dir of dirs) await rm(dir,{recursive:true,force:true});});
async function fixture(dirty=true){const root=await realpath(await mkdtemp(join(tmpdir(),'git-overview-test-')));dirs.push(root);const project=join(root,'中文 项目');const ids=await createFixture(project,dirty);return {root,project,ids,reader:new RepositoryReader()};}
async function digest(path:string){const hash=createHash('sha256');async function visit(dir:string){for(const entry of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const name=join(dir,entry.name);hash.update(name);if(entry.isDirectory())await visit(name);else if(entry.isFile())hash.update(await readFile(name));}}await visit(path);return hash.digest('hex');}

test('全部本地分支、真实合并父节点、多引用共享节点；远程按需展示',async()=>{
 const {project,ids,reader}=await fixture();const graph=await reader.graph(project);
 assert.equal(graph.repository.branch,'codex/design-sync');assert.equal(graph.repository.head,ids.current);assert.equal(graph.repository.changes.total,3);
 assert.ok(graph.commits.some(c=>c.id===ids.onboarding));assert.ok(!graph.commits.some(c=>c.id===ids.remote));
 assert.equal(graph.commits.filter(c=>c.id===ids.current).length,1);assert.equal(graph.refs.filter(r=>r.commitId===ids.current&&r.kind==='local').length,2);
 assert.equal(graph.commits.find(c=>c.id===ids.merge)!.parents.length,2);assert.ok(graph.refs.some(r=>r.label==='v0.2.0'&&r.commitId===ids.main));
 assert.ok((await reader.graph(project,{includeRemote:true})).commits.some(c=>c.id===ids.remote));
 const order=new Map(graph.commits.map((c,i)=>[c.id,i]));for(const c of graph.commits)for(const p of c.parents)if(order.has(p))assert.ok(order.get(c.id)!<order.get(p)!);
});
test('分支详情支持非当前分支，计数、上游与工作树使用真实记录',async()=>{
 const {project,ids,reader}=await fixture();const branch=await reader.branch(project,'refs/heads/codex/component-gallery');
 assert.equal(branch.ref.commitId,ids.merge);assert.ok(branch.currentOnly>0);assert.ok(branch.branchOnly>0);
 const current=await reader.branch(project,'refs/heads/codex/design-sync');assert.equal(current.upstream?.ahead,1);assert.equal(current.upstream?.behind,0);assert.equal(current.worktrees[0].path,project);
});
test('合并提交相对父节点切换，首次提交和文件差异按需读取',async()=>{
 const {project,ids,reader}=await fixture();const first=await reader.commit(project,ids.root);assert.ok(first.files.some(f=>f.path==='README.md'));
 assert.ok((await reader.diff(project,{path:'README.md',commit:ids.root})).text.includes('Design system'));
 const merge=await reader.commit(project,ids.merge);assert.equal(merge.base,merge.commit.parents[0]);
 const other=await reader.commit(project,ids.merge,merge.commit.parents[1]);assert.notDeepEqual(merge.files,other.files);
 assert.ok((await reader.diff(project,{path:'src/sync.ts',commit:ids.current})).text.includes('bidirectional'));
 await assert.rejects(reader.commit(project,ids.merge,ids.root),/父提交/);await assert.rejects(reader.diff(project,{path:'../outside',commit:ids.current}),/超出/);
});
test('工作区区分暂存、未暂存、新文件，同文件双重状态和换行文件名',async()=>{
 const {project,reader}=await fixture();await writeFile(join(project,'README.md'),'staged\n');g(project,['add','README.md']);await writeFile(join(project,'README.md'),'unstaged\n');
 await writeFile(join(project,'含\n换行.txt'),'new\n');const files=(await reader.working(project)).files;
 assert.ok(files.some(f=>f.path==='README.md'&&f.scope==='staged'));assert.ok(files.some(f=>f.path==='README.md'&&f.scope==='unstaged'));assert.ok(files.some(f=>f.path==='含\n换行.txt'));
 assert.ok((await reader.diff(project,{path:'README.md',scope:'unstaged'})).text.includes('unstaged'));
 assert.ok((await reader.diff(project,{path:'含\n换行.txt',scope:'untracked'})).text.includes('new'));
 assert.equal(parseWorking('UU file.txt\0')[0].scope,'conflict');
});
test('二进制、大文件有明确状态；图、详情和差异读取不改变仓库',async()=>{
 const {project,ids,reader}=await fixture();await writeFile(join(project,'image.bin'),Buffer.from([0,1,2,3]));await writeFile(join(project,'large.txt'),'a'.repeat(1024*1024+1));
 const before=await digest(project);await reader.graph(project,{includeRemote:true});await reader.branch(project,'refs/heads/main');await reader.commit(project,ids.current);await reader.working(project);
 assert.equal((await reader.diff(project,{path:'image.bin',scope:'untracked'})).kind,'binary');assert.equal((await reader.diff(project,{path:'large.txt',scope:'untracked'})).kind,'large');
 await reader.diff(project,{path:'src/sync.ts',commit:ids.current});assert.equal(await digest(project),before);
 g(project,['add','large.txt']);g(project,['commit','-m','Large file fixture']);g(project,['rm','large.txt']);
 assert.equal((await reader.diff(project,{path:'large.txt',scope:'staged'})).kind,'large');
});
test('历史分页延续边界、定位历史 HEAD、外部分支变化使游标失效',async()=>{
 const {project,ids,reader}=await fixture(false);for(let i=0;i<24;i++){await writeFile(join(project,'sequence.txt'),String(i));g(project,['add','.']);g(project,['commit','-m',`Sequence ${i}`]);}
 const first=await reader.graph(project,{pageSize:20});assert.equal(first.commits.length,20);assert.ok(first.nextCursor);
 const layout=layoutGraph(first.commits);assert.ok(layout.edges.some(e=>e.to===undefined));assert.ok(layout.edges.filter(e=>e.to===undefined).every(e=>edgePath(e,78,20*78).includes('V')));
 const second=await reader.graph(project,{pageSize:20,cursor:first.nextCursor});assert.equal(second.offset,20);assert.ok(second.commits.length>0);assert.ok(!second.commits.some(c=>first.commits.some(v=>v.id===c.id)));
 g(project,['switch','main']);const anchor=await reader.graph(project,{pageSize:20,anchor:ids.main});assert.ok(anchor.commits.some(c=>c.id===ids.main));assert.ok(anchor.offset>0);
 await assert.rejects(reader.graph(project,{cursor:first.nextCursor,pageSize:20}),/刷新/);
});
test('无 Git、无提交、脱离分支、工作树和浅克隆边界',async()=>{
 const {root,project,ids,reader}=await fixture(false);const empty=join(root,'empty');await mkdir(empty);assert.equal((await reader.graph(empty)).repository.initialized,false);g(empty,['init','-b','main']);assert.equal((await reader.graph(empty)).commits.length,0);
 g(project,['switch','--detach',ids.onboarding]);const detached=await reader.graph(project);assert.equal(detached.repository.branch,undefined);assert.equal(detached.repository.head,ids.onboarding);
 const worktree=join(root,'another worktree');g(project,['worktree','add',worktree,'main']);const bound=await canonicalProject(worktree);const working=await reader.graph(bound);assert.equal(working.repository.branch,'main');assert.equal(working.repository.head,ids.main);
 const clone=join(root,'shallow');g(root,['clone','--depth=1',`file://${project}`,clone]);const shallow=await reader.graph(clone);assert.equal(shallow.repository.shallow,true);assert.ok(shallow.commits.some(c=>c.shallowBoundary));const detail=await reader.commit(clone,shallow.commits[0].id);assert.equal(detail.files.length,0);
});
test('真实冲突状态可读，保持冲突现场',async()=>{
 const {project,ids,reader}=await fixture(false);g(project,['switch','-c','conflict-left',ids.base]);await writeFile(join(project,'shared.txt'),'left\n');g(project,['add','.']);g(project,['commit','-m','left']);
 g(project,['switch','-c','conflict-right',ids.base]);await writeFile(join(project,'shared.txt'),'right\n');g(project,['add','.']);g(project,['commit','-m','right']);try{g(project,['merge','conflict-left']);}catch{}
 const before=await digest(project);const state=await reader.graph(project);assert.equal(state.repository.operation,'有待解决的冲突');assert.equal(state.repository.changes.conflicts,1);
 assert.equal((await reader.diff(project,{path:'shared.txt',scope:'conflict'})).kind,'conflict');assert.equal(await digest(project),before);
});
test('请求上下文绑定项目与所选对象，分支移动后停止发送旧上下文',async()=>{
 const {project,ids}=await fixture();const service=new Service();const binding=await service.open(project,'current-chat');
 const selection={kind:'branch',name:'refs/heads/codex/component-gallery',id:ids.merge};const data=await service.call('handoff',{sessionId:binding.sessionId,selection,projectPath:'/tmp/other'});
 assert.equal(data.context.projectPath,project);assert.equal(data.context.currentHead,ids.current);assert.deepEqual(data.context.selection,selection);
 g(project,['update-ref',selection.name,ids.base]);await assert.rejects(service.call('handoff',{sessionId:binding.sessionId,selection}),/位置已变化/);
 await assert.rejects(service.call('save',{sessionId:binding.sessionId}),/仅提供/);await assert.rejects(service.call('graph',{sessionId:'wrong'}),/连接已过期/);
});
