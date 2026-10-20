import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, rm, realpath, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createFixture } from './fixture.js';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ListRootsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
test('stdio MCP 只暴露读取工具，内嵌资源与真实 ready 状态可读',async()=>{
 const bundleRoot=process.env.MCP_BUNDLE_DIR || resolve('dist');
 const client=new Client({name:'read-only-contract-test',version:'1.0.0'});
 try{
  await client.connect(new StdioClientTransport({command:process.execPath,args:[resolve(bundleRoot,'server.mjs')],cwd:bundleRoot,stderr:'pipe'}));
  const list=await client.listTools();assert.equal(list.tools.length,9);assert.ok(list.tools.every(t=>t.annotations?.readOnlyHint===true));
  for(const name of ['save_project_version','restore_project_version','configure_project_preview','capture_project_preview','initialize_project_versions'])assert.ok(!list.tools.some(t=>t.name===name));
  const resource=await client.readResource({uri:'ui://project-versions/panel.html'});assert.equal(resource.contents[0].mimeType,'text/html;profile=mcp-app');
  assert.ok('text' in resource.contents[0]&&resource.contents[0].text.includes('<title>Git 总览</title>'));
  const result=await client.callTool({name:'open_project_versions',arguments:{projectPath:process.cwd(),threadId:'contract-test'}});const binding=result.structuredContent as any;
  assert.equal(binding.graph.repository.branch,'main');
  const ready=await client.callTool({name:'check_project_versions_ready',arguments:{sessionId:binding.sessionId}});assert.equal((ready.structuredContent as any).ready,false);
 }finally{await client.close();}
});

for (const mode of ['none', 'one', 'multiple'] as const) test(`菜单无参数打开：宿主工作空间 ${mode}`, async () => {
 const client = new Client({ name: 'entrypoint-contract-test', version: '1.0.0' }, { capabilities: mode === 'none' ? {} : { roots: {} } });
 if (mode !== 'none') client.setRequestHandler(ListRootsRequestSchema, async () => ({ roots: [process.cwd(), ...(mode === 'multiple' ? ['/private/tmp'] : [])].map(path => ({ uri: pathToFileURL(path).href })) }));
 const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string,string] => entry[1] !== undefined));
 delete env.CODEX_WORKSPACE_DIR; delete env.CODEX_THREAD_ID; delete env.PROJECT_VERSIONS_WORKSPACE_CWD;
 const bundleRoot = process.env.MCP_BUNDLE_DIR || resolve('dist');
 try {
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [resolve(bundleRoot,'server.mjs')], cwd: bundleRoot, env, stderr: 'pipe' }));
  const result = await client.callTool({ name: 'open_project_versions', arguments: {} });
  assert.ok(!result.isError, '菜单打开不能因缺少 projectPath 失败');
  const data = result.structuredContent as any;
  if (mode === 'one') { assert.equal(data.graph.repository.path, process.cwd()); assert.equal(data.graph.repository.branch, 'main'); }
  else { assert.equal(data.projectRequired, true); assert.equal(data.sessionId, undefined); }
 } finally { await client.close(); }
});

test('继承工作空间启动：两个项目各自自动绑定，安装目录不作为项目', async () => {
 const base = await realpath(await mkdtemp(join(tmpdir(),'git-cwd-binding-')));
 const bundleRoot = process.env.MCP_BUNDLE_DIR || resolve('dist');
 const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string,string] => entry[1] !== undefined));
 delete env.CODEX_WORKSPACE_DIR; delete env.CODEX_THREAD_ID; env.PROJECT_VERSIONS_WORKSPACE_CWD = '1';
 try {
  const projects = [join(base,'项目 A'),join(base,'项目 B')];
  for (const path of projects) await createFixture(path,false);
  for (const cwd of [...projects,bundleRoot]) {
   const client = new Client({ name:'workspace-inheritance-test',version:'1.0.0' });
   try {
    await client.connect(new StdioClientTransport({command:process.execPath,args:[resolve(bundleRoot,'server.mjs')],cwd,env,stderr:'pipe'}));
    const result = await client.callTool({name:'open_project_versions',arguments:{}});assert.ok(!result.isError);
    const data = result.structuredContent as any;
    if(cwd === bundleRoot) assert.equal(data.projectRequired,true);
    else { assert.equal(data.graph.repository.path,cwd);assert.equal(data.graph.repository.branch,'codex/design-sync'); }
   } finally { await client.close(); }
  }
 } finally { await rm(base,{recursive:true,force:true}); }
});

test('安装配置使用插件根目录作为工作目录并完成真实 MCP 握手',async()=>{
 const config = JSON.parse(await readFile('.mcp.json','utf8')).mcpServers['project-versions'];
 assert.equal(config.cwd,'.');assert.deepEqual(config.args,['./dist/server.mjs']);
 const client = new Client({name:'configured-startup-test',version:'1.0.0'});
 try {
  await client.connect(new StdioClientTransport({command:config.command,args:config.args,cwd:process.cwd(),stderr:'pipe'}));
  assert.equal((await client.listTools()).tools.length,9);
  const opened = await client.callTool({name:'open_project_versions',arguments:{}});
  assert.equal(opened.isError,undefined);
  assert.equal((opened.structuredContent as any).projectRequired,true);
 } finally { await client.close(); }
});
