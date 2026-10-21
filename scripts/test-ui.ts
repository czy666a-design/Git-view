import assert from 'node:assert/strict';
import { spawn,execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { mkdtemp,mkdir,readFile,writeFile,rm,realpath,readdir } from 'node:fs/promises';
import { tmpdir,homedir } from 'node:os';
import { join,resolve } from 'node:path';
import { chromium } from 'playwright';
import { createFixture,fixtureGit as git } from '../tests/fixture.js';
const root=await realpath(await mkdtemp(join(tmpdir(),'git-overview-ui-')));const project=join(root,'design-system');const ids=await createFixture(project);
const worktree=join(root,'Function 工作树');git(project,['worktree','add','-b','Function',worktree,ids.main]);await writeFile(join(worktree,'function-only.txt'),'Function working tree\n');
const longRemote='desktop/desktop/home-orbit-very-long-feature-name-for-component-documentation-and-design-sync';
for(const name of [longRemote,'desktop/desktop/home-orbit','backup/component-gallery'])git(project,['update-ref',`refs/remotes/${name}`,ids.current]);
const artifacts=resolve(process.env.UI_ARTIFACTS || 'artifacts/git-overview');await mkdir(artifacts,{recursive:true});
async function fingerprint(){const hash=createHash('sha256');async function walk(path:string){for(const file of(await readdir(path,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const full=join(path,file.name);hash.update(full);if(file.isDirectory())await walk(full);else if(file.isFile())hash.update(await readFile(full));}}await walk(project);await walk(worktree);return hash.digest('hex');}
let browser;let child:ReturnType<typeof spawn>|undefined;const report:any={started:new Date().toISOString(),checks:[]};
try{
 const initial=await fingerprint();
 child=spawn(process.execPath,['--import','tsx','server/dev.ts',project],{cwd:process.cwd(),env:{...process.env,PORT:'0',PROJECT_VERSIONS_TEST_RESET:'1',PROJECT_VERSIONS_DEV_THREAD:'ui-test-chat'},stdio:['ignore','pipe','pipe']});
 const address=await new Promise<string>((yes,no)=>{let output='';const timer=setTimeout(()=>no(new Error('server timeout')),15000);child!.stdout!.on('data',chunk=>{output+=chunk;const match=output.match(/http:\/\/127\.0\.0\.1:\d+\/#dev=[a-f0-9]+/);if(match){clearTimeout(timer);yes(match[0]);}});child!.on('exit',code=>{if(code)no(new Error('server exited '+code));});});
 try{browser=await chromium.launch({channel:'chrome',headless:true});}catch{browser=await chromium.launch();}
 const page=await browser.newPage({viewport:{width:1280,height:900},colorScheme:'dark'});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const settle=async()=>page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().iterations)).map(a=>a.finished.catch(()=>{})));});
 await page.goto(address);await page.getByRole('button',{name:'查看提交 '+ 'Refine bidirectional sync and component validation',exact:true}).waitFor();await settle();
 assert.equal(await page.locator('.detail-pane').count(),0);assert.equal(await page.locator('.graph-row').count(),10);
 assert.equal(await page.getByRole('button',{name:/保存|恢复|截图|预览/}).count(),0);report.checks.push('零配置打开真实多分支图，默认无详情或 Git 操作入口');
 await page.screenshot({path:join(artifacts,'overview-dark.png')});
 const verifyPopover=async()=>{
  await page.locator('.graph-row.current .extra-refs').click();await page.locator('.ref-popover').waitFor();await settle();
  const geometry=await page.locator('.ref-popover').evaluate(el=>{const rect=el.getBoundingClientRect();const buttons=[...el.querySelectorAll('button')];const last=buttons.at(-1)!.getBoundingClientRect();const note=el.querySelector('p')!.getBoundingClientRect();let covered=true;for(let y=rect.top+12;y<rect.bottom-12;y+=15)for(let x=rect.left+12;x<rect.right-12;x+=30)if(!el.contains(document.elementFromPoint(x,y)))covered=false;return {covered,contained:rect.left>=0&&rect.right<=innerWidth&&rect.top>=0&&rect.bottom<=innerHeight,ordered:note.top>=last.bottom,wrapped:el.scrollWidth<=el.clientWidth};});
  assert.deepEqual(geometry,{covered:true,contained:true,ordered:true,wrapped:true});assert.ok((await page.locator('.ref-popover').innerText()).includes(longRemote));
 };
 await verifyPopover();await page.screenshot({path:join(artifacts,'remote-popover-dark.png')});await page.emulateMedia({colorScheme:'light'});await settle();await page.screenshot({path:join(artifacts,'remote-popover-light.png')});await page.keyboard.press('Escape');await page.locator('.ref-popover').waitFor({state:'hidden'});await page.emulateMedia({colorScheme:'dark'});report.checks.push('远程浮层独立覆盖后续提交，长名称及说明分行，Escape 关闭');

 await page.emulateMedia({colorScheme:'light'});await settle();await page.screenshot({path:join(artifacts,'overview-light.png')});await page.emulateMedia({colorScheme:'dark'});
 await page.getByRole('checkbox',{name:'显示远程'}).check();await page.getByRole('button',{name:'Explore remote-only component experiments',exact:true}).waitFor();report.checks.push('远程开关显示真实远程独有分支');
 await page.getByRole('checkbox',{name:'显示远程'}).uncheck();await page.getByRole('button',{name:'Explore remote-only component experiments',exact:true}).waitFor({state:'hidden'});
 await page.getByRole('combobox',{name:'筛选分支'}).selectOption('refs/heads/main');await page.getByRole('button',{name:'Refine bidirectional sync and component validation',exact:true}).waitFor({state:'hidden'});await page.getByRole('button',{name:'定位当前',exact:true}).click();await page.getByRole('button',{name:'Refine bidirectional sync and component validation',exact:true}).waitFor();report.checks.push('分支筛选限定历史，定位当前位置可回到包含 HEAD 的图');
 await page.getByRole('button',{name:'codex/component-gallery',exact:true}).click();await page.getByRole('heading',{name:'codex/component-gallery',exact:true}).waitFor();await settle();await page.screenshot({path:join(artifacts,'branch-detail.png')});report.checks.push('分支详情保留主图，展示独有提交计数与最新位置');
 await page.getByRole('button',{name:'关闭详情',exact:true}).click();assert.equal(await page.locator('.detail-pane').count(),0);assert.equal(await page.locator('.graph-row.active').count(),1);report.checks.push('关闭详情保留选择与图的位置');
 await page.getByRole('button',{name:'Merge design continuation into component documentation gallery',exact:true}).click();await page.getByRole('combobox',{name:'选择父提交'}).waitFor();await settle();await page.screenshot({path:join(artifacts,'commit-detail.png')});
 const firstFiles=await page.locator('.detail-pane .file-path').allTextContents();await page.getByRole('combobox',{name:'选择父提交'}).selectOption({index:1});await page.waitForFunction(before=>JSON.stringify([...document.querySelectorAll('.detail-pane .file-path')].map(e=>e.textContent))!==JSON.stringify(before),firstFiles);report.checks.push('合并提交可切换实际父节点比较');
 await page.getByRole('button',{name:'关闭详情',exact:true}).click();await page.getByRole('button',{name:'Refine bidirectional sync and component validation',exact:true}).click();await page.locator('.detail-pane .file-toggle').first().waitFor();
 await page.locator('.detail-pane .file-toggle').filter({hasText:'src/sync.ts'}).click();await page.locator('.diff-content pre').waitFor();await settle();await page.screenshot({path:join(artifacts,'file-diff.png')});assert.ok((await page.locator('.diff-content pre').innerText()).includes('bidirectional'));report.checks.push('点击文件后按需读取真实源码差异');
 await page.getByRole('button',{name:'交给 Codex',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByLabel('你想让 Codex 做什么？').fill('请解释这次提交与当前分支的关系。');assert.equal(await page.locator('.request-context').getAttribute('open'),null);assert.ok((await page.locator('.request-context pre').textContent())?.includes(ids.current));await settle();await page.screenshot({path:join(artifacts,'handoff-draft.png')});await page.getByRole('button',{name:'关闭请求草稿'}).click();report.checks.push('交给 Codex 先展示可编辑请求，附带准确所选对象与当前 HEAD');
 await page.getByRole('button',{name:/3 个文件未提交/}).click();await page.getByRole('heading',{name:'3 个文件尚未提交'}).waitFor();for(const label of ['已暂存','未暂存','新增文件'])assert.ok((await page.locator('.working-group h3').allTextContents()).some(v=>v.includes(label)));report.checks.push('未提交修改按暂存、未暂存与新增分组');
 await page.setViewportSize({width:760,height:900});await settle();await page.screenshot({path:join(artifacts,'detail-panel.png')});await page.getByRole('button',{name:'关闭详情',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.reload();await page.locator('.graph-row').first().waitFor();await settle();assert.equal(await page.locator('.header').count(),1);await page.screenshot({path:join(artifacts,'overview-narrow.png')});assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth),true);await verifyPopover();await page.screenshot({path:join(artifacts,'remote-popover-narrow.png')});await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Refine bidirectional sync and component validation',exact:true}).click();await page.locator('.detail-pane').waitFor();await settle();await page.screenshot({path:join(artifacts,'detail-narrow.png')});await page.getByRole('button',{name:'关闭详情',exact:true}).click();report.checks.push('760px/390px 详情覆盖层可关闭，无页面横向溢出');
 // A 640×450 CSS viewport at deviceScaleFactor 2 represents the visible area of a 1280×900 panel at 200% browser zoom.
 const zoomed=await browser.newPage({viewport:{width:640,height:450},deviceScaleFactor:2,colorScheme:'dark'});zoomed.on('pageerror',e=>errors.push(e.message));await zoomed.goto(address);await zoomed.locator('.graph-row').first().waitFor();await zoomed.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().iterations)).map(a=>a.finished.catch(()=>{})));});assert.equal(await zoomed.locator('body').evaluate(e=>e.scrollWidth<=innerWidth&&e.scrollHeight<=innerHeight),true);await zoomed.screenshot({path:join(artifacts,'zoom-200.png')});await zoomed.getByRole('button',{name:'Refine bidirectional sync and component validation',exact:true}).click();await zoomed.getByRole('heading',{name:'Refine bidirectional sync and component validation',exact:true}).waitFor();await zoomed.getByRole('button',{name:'交给 Codex',exact:true}).click();await zoomed.getByRole('dialog').waitFor();await zoomed.screenshot({path:join(artifacts,'zoom-handoff.png')});await zoomed.getByRole('button',{name:'关闭请求草稿'}).click();await zoomed.close();
 await page.setViewportSize({width:1280,height:900});
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'定位当前',exact:true}).click();report.checks.push('200% 阅读及减少动态效果下交互可用');
 assert.equal(await fingerprint(),initial);report.checks.push('图、筛选、详情、差异和请求草稿均未改变任何仓库文件或 Git 数据');
 const host=await browser.newPage({viewport:{width:1280,height:900},colorScheme:'light'});const hostErrors:string[]=[];host.on('pageerror',e=>hostErrors.push(e.message));await host.goto(address.replace('/#dev=','/host#dev='));const frame=host.frameLocator('iframe');await frame.getByRole('button',{name:'Refine bidirectional sync and component validation',exact:true}).waitFor();
 assert.equal(await frame.locator('html').getAttribute('data-theme'),'dark');await frame.getByRole('button',{name:'Refine bidirectional sync and component validation',exact:true}).click();await frame.getByRole('button',{name:'交给 Codex',exact:true}).click();await frame.getByRole('dialog').waitFor();assert.equal(await host.evaluate(()=>((window as any).__messages||[]).length),0);
 await frame.getByLabel('你想让 Codex 做什么？').fill('请比较这个提交与当前分支，先检查 Git 状态。');await frame.getByRole('button',{name:'发送到当前聊天',exact:true}).click();await host.waitForFunction(()=>((window as any).__messages||[]).length===1);const messages=await host.evaluate(()=>(window as any).__messages);assert.ok(JSON.stringify(messages).includes(ids.current));assert.ok(JSON.stringify(messages).includes(project));report.checks.push('标准 MCP Apps 宿主主题/工具/消息链路通过，只有点击发送才触发消息');
 const ready=await host.evaluate(async token=>{const res=await fetch('/api',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'readiness'})});return res.json();},address.split('#dev=')[1]);assert.equal(ready.ready,true);assert.equal(ready.hostName,'MCP Apps Test Host');report.checks.push('测试宿主真实 ready 回执通过，明确区分 Codex 原生宿主');
 const unbound=await browser.newPage({viewport:{width:760,height:900},colorScheme:'dark'});await unbound.goto(address.replace('/#dev=','/host#dev=')+'&projectRequired=1');const unboundFrame=unbound.frameLocator('iframe');await unboundFrame.getByLabel('项目文件夹的绝对路径').waitFor();await unbound.screenshot({path:join(artifacts,'entrypoint-project-required.png')});await unboundFrame.getByLabel('项目文件夹的绝对路径').fill(project);await unboundFrame.getByRole('button',{name:'打开项目',exact:true}).click();await unboundFrame.getByRole('button',{name:'Refine bidirectional sync and component validation',exact:true}).waitFor();await unbound.close();report.checks.push('菜单无参数启动可显示项目绑定页，缺少 session 时也能绑定并加载当前项目');
 // Selecting a worktree changes the bound view, never a Git checkout.
 const originalBranch=git(project,['branch','--show-current']);const worktreeBranch=git(worktree,['branch','--show-current']);
 await frame.getByRole('combobox',{name:'筛选分支'}).selectOption('refs/heads/codex/component-gallery');
 await frame.getByRole('button',{name:'Merge design continuation into component documentation gallery',exact:true}).click();await frame.locator('.detail-pane').waitFor();
 await frame.getByRole('combobox',{name:'查看工作树'}).selectOption(worktree);
 await frame.locator('.current-branch strong').filter({hasText:'Function'}).waitFor();
 assert.equal(await frame.getByRole('combobox',{name:'查看工作树'}).inputValue(),worktree);
 assert.equal(await frame.getByRole('combobox',{name:'筛选分支'}).inputValue(),'');assert.equal(await frame.locator('.detail-pane').count(),0);
 assert.equal(await frame.locator('.graph-row.current').getAttribute('id'),`commit-${ids.main}`);
 assert.ok((await frame.locator('.graph-row.current .head-badge').innerText()).includes('工作树 HEAD'));
 await frame.getByRole('button',{name:'刷新 Git 信息'}).click();await frame.getByRole('button',{name:'刷新 Git 信息'}).waitFor({state:'visible'});
 assert.equal(await frame.getByRole('combobox',{name:'查看工作树'}).inputValue(),worktree);
 await frame.getByRole('button',{name:'1 个文件未提交',exact:true}).click();await frame.getByRole('heading',{name:'1 个文件尚未提交'}).waitFor();
 assert.equal(await frame.locator('.detail-pane .file-path').innerText(),'function-only.txt');
 await frame.getByRole('button',{name:'交给 Codex',exact:true}).click();await frame.getByRole('dialog').waitFor();
 const worktreeContext=await frame.locator('.request-context pre').textContent();assert.ok(worktreeContext?.includes(worktree));assert.ok(worktreeContext?.includes(ids.main));
 await frame.getByRole('button',{name:'关闭请求草稿'}).click();await host.screenshot({path:join(artifacts,'worktree-function-host.png')});
 await frame.getByRole('combobox',{name:'查看工作树'}).selectOption(project);await frame.locator('.current-branch strong').filter({hasText:'codex/design-sync'}).waitFor();
 assert.equal(git(project,['branch','--show-current']),originalBranch);assert.equal(git(worktree,['branch','--show-current']),worktreeBranch);
 report.checks.push('同仓库工作树选择更新 HEAD、未提交与交接上下文，清除旧筛选和详情，不执行 Git 切换');
 // Failure must leave the original view selected and usable.
 await page.route('**/api',async route=>{const body=route.request().postDataJSON();if(body.action==='open')await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:{message:'工作树暂不可用'}})});else await route.continue();});
 await page.getByRole('combobox',{name:'查看工作树'}).selectOption(worktree);await page.getByRole('alert').filter({hasText:'工作树暂不可用'}).waitFor();
 assert.equal(await page.getByRole('combobox',{name:'查看工作树'}).inputValue(),project);await page.unroute('**/api');
 await page.getByRole('button',{name:'刷新 Git 信息'}).click();
 // A slow detail response from the previous worktree must not reopen its drawer.
 await page.getByRole('button',{name:'3 个文件未提交',exact:true}).click();await page.getByRole('heading',{name:'3 个文件尚未提交'}).waitFor();await page.getByRole('button',{name:'关闭详情',exact:true}).click();
 let releaseDetail!:()=>void;let detailStarted!:()=>void;const detailGate=new Promise<void>(yes=>releaseDetail=yes);const started=new Promise<void>(yes=>detailStarted=yes);
 await page.route('**/api',async route=>{const action=route.request().postDataJSON().action;if(action==='commit'){const response=await route.fetch();detailStarted();await detailGate;await route.fulfill({response});}else if(action==='open'){const response=await route.fetch();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await route.fulfill({response});}else await route.continue();});
 await page.getByRole('button',{name:'Refine bidirectional sync and component validation',exact:true}).click();await started;
 await page.getByRole('combobox',{name:'查看工作树'}).selectOption(worktree);await page.locator('.current-branch strong').filter({hasText:'Function'}).waitFor();releaseDetail();await page.unrouteAll({behavior:'wait'});
 assert.equal(await page.locator('.detail-pane').count(),0);assert.equal(await page.locator('.graph-row.current').getAttribute('id'),`commit-${ids.main}`);
 await page.setViewportSize({width:390,height:844});await settle();assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth),true);await page.screenshot({path:join(artifacts,'worktree-function-narrow.png')});
 await page.getByRole('combobox',{name:'查看工作树'}).selectOption(project);await page.locator('.current-branch strong').filter({hasText:'codex/design-sync'}).waitFor();await page.setViewportSize({width:1280,height:900});
 report.checks.push('工作树重绑失败保留原视图，迟到的旧详情不会覆盖新工作树，390px 选择器无横向溢出');
 assert.deepEqual(errors,[]);assert.deepEqual(hostErrors,[]);assert.equal(await fingerprint(),initial);await host.screenshot({path:join(artifacts,'mcp-apps-host.png')});
 // Losing all server sessions reproduces a service restart while the frame stays open.
 const waitWorktreeReady=()=>host.waitForResponse(async response=>response.url().endsWith('/api')&&response.request().postDataJSON()?.action==='ready'&&(await response.json()).ready===true&&(await response.json()).projectPath===worktree);
 const initialReady=waitWorktreeReady();
 await frame.getByRole('combobox',{name:'查看工作树'}).selectOption(worktree);await frame.locator('.current-branch strong').filter({hasText:'Function'}).waitFor();await initialReady;
 await host.evaluate(async token=>{const res=await fetch('/api',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'expire'})});if(!(await res.json()).expired)throw new Error('session reset failed');},address.split('#dev=')[1]);
 await frame.getByRole('button',{name:'刷新 Git 信息'}).click();await frame.getByRole('alert').filter({hasText:'连接已过期'}).waitFor();
 await host.screenshot({path:join(artifacts,'session-expired.png')});
 let reconnectArguments:any;
 await host.route('**/api',async route=>{const body=route.request().postDataJSON();if(body.action==='open'&&!body.sessionId)reconnectArguments=body;await route.continue();});
 const recoveredReady=waitWorktreeReady();await frame.getByRole('button',{name:'重新读取',exact:true}).click();await frame.getByRole('alert').waitFor({state:'hidden'});await recoveredReady;
 assert.ok(reconnectArguments);assert.equal(reconnectArguments.sessionId,undefined);assert.equal(reconnectArguments.projectPath,worktree);assert.equal(reconnectArguments.threadId,'ui-test-chat');
 assert.equal(await frame.getByRole('combobox',{name:'查看工作树'}).inputValue(),worktree);assert.equal(await frame.locator('.graph-row.current').getAttribute('id'),`commit-${ids.main}`);
 await frame.getByRole('button',{name:'1 个文件未提交',exact:true}).click();await frame.getByRole('heading',{name:'1 个文件尚未提交'}).waitFor();assert.equal(await frame.locator('.detail-pane .file-path').innerText(),'function-only.txt');
 await host.unrouteAll();await host.screenshot({path:join(artifacts,'session-reconnected.png')});report.checks.push('会话丢失后重新读取不带旧 ID，恢复所选 Function 工作树及其未提交修改');
 // When a fresh open also fails, remove the misleading retry control.
 await host.evaluate(async token=>{await fetch('/api',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'expire'})});},address.split('#dev=')[1]);
 await frame.getByRole('button',{name:'刷新 Git 信息'}).click();await frame.getByRole('alert').filter({hasText:'连接已过期'}).waitFor();
 await host.route('**/api',async route=>{const body=route.request().postDataJSON();if(body.action==='open'&&!body.sessionId)await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'NOT_CONNECTED',message:'宿主连接不可用'}})});else await route.continue();});
 await frame.getByRole('button',{name:'重新读取',exact:true}).click();await frame.getByRole('alert').filter({hasText:'无法重新建立连接'}).waitFor();
 assert.equal(await frame.getByRole('button',{name:'重新读取',exact:true}).count(),0);assert.equal(await frame.getByRole('button',{name:'刷新 Git 信息'}).isDisabled(),true);
 await host.screenshot({path:join(artifacts,'session-reconnect-unavailable.png')});await host.unrouteAll();
 report.checks.push('新建会话仍失败时隐藏重新读取并禁用刷新，提示从当前聊天重新打开');
 // Return the standalone preview to a valid binding for its remaining external-Git test.
 await page.reload();await page.locator('.graph-row').first().waitFor();await page.getByRole('alert').filter({hasText:'连接已过期'}).waitFor();await page.getByRole('button',{name:'重新读取',exact:true}).click();await page.getByRole('alert').waitFor({state:'hidden'});
 // External Git actions are performed only by this fixture, never by the plugin.
 git(project,['stash','push','-u','-m','UI fixture before external switch']);git(project,['switch','codex/component-gallery']);await page.getByRole('button',{name:'刷新 Git 信息'}).click();await page.waitForFunction(()=>document.querySelector('.current-branch strong')?.textContent==='codex/component-gallery');report.checks.push('外部 Git 切换后刷新定位到真实当前分支');
 if(process.env.UI_MOTION==='1'){
  const shoot=join(process.env.OIL_UI_SKILL || join(homedir(),'.codex','skills','oil-ui'),'scripts/shoot.mjs');
  for(const [folder,options]of [['motion',['--motion','--steps','click ".row-title"; wait 900; click ".file-toggle"']],['entry-motion',['--record','--entry','--hold','1500']],['detail-motion',['--record','--steps','click ".row-title"; wait 900; click ".icon-button[aria-label=关闭详情]"','--hold','1500']]] as [string,string[]][]) {
   await promisify(execFile)(process.execPath,[shoot,address,'--size','1280x900',...options,'--out',join(artifacts,folder)],{timeout:60000,maxBuffer:1000000});
  }
 }
 report.status='passed';report.finished=new Date().toISOString();console.log(JSON.stringify(report,null,2));
}catch(e:any){report.status='failed';report.error=e.stack;throw e;}finally{await writeFile(join(artifacts,'report.json'),JSON.stringify(report,null,2));child?.kill();await browser?.close();await rm(root,{recursive:true,force:true});}
