import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, isAbsolute, sep } from 'node:path';
import { Service } from './service.js';
import { AppError } from './types.js';
export const URI = 'ui://project-versions/panel.html';
export function createServer(service = new Service(), htmlFile = join(dirname(fileURLToPath(import.meta.url)), 'panel.html')) {
  const server = new McpServer({ name: 'project-versions', version: '0.2.5' });
  const resourceMeta = { ui: { prefersBorder: false, csp: { resourceDomains: [], connectDomains: [] } }, 'openai/ui': { preferredDisplayMode: 'fullscreen', availableDisplayModes: ['fullscreen', 'inline'] }, 'openai/widgetDescription': '当前项目的 Git 提交与分支关系总览。' };
  registerAppResource(server, 'Git 总览', URI, { mimeType: RESOURCE_MIME_TYPE, _meta: resourceMeta }, async () => ({ contents: [{ uri: URI, mimeType: RESOURCE_MIME_TYPE, text: await readFile(htmlFile, 'utf8'), _meta: resourceMeta }] }));
  const attempt = async (fn: () => Promise<any>) => {
    try { const data = await fn(); return { content: [{ type: 'text' as const, text: '已读取真实 Git 信息。' }], structuredContent: data }; }
    catch (e: any) { return { isError: true, content: [{ type: 'text' as const, text: e.message }], structuredContent: { error: { code: e instanceof AppError ? e.code : 'INTERNAL_ERROR', message: e.message } } }; }
  };
  registerAppTool(server, 'open_project_versions', {
    title: '打开 Git 总览', description: '在当前 Codex 工作空间打开只读 Git 分支与提交图。可传当前项目根目录的绝对路径和当前 CODEX_THREAD_ID。菜单直接打开时从宿主工作空间解析项目，缺少或不明确时由用户指定。只有客户端 ready 回执才证明面板已连接。',
    inputSchema: { projectPath: z.string().trim().min(1).optional(), threadId: z.string().optional() },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, _meta: { ui: { resourceUri: URI, visibility: ['model', 'app'] }, 'openai/ui': { entrypoints: [{ type: 'thread' }] } },
  }, args => attempt(async () => {
    const threadId = args.threadId || process.env.CODEX_THREAD_ID;
    if (args.projectPath) return service.open(args.projectPath, threadId);
    // Entrypoint launches have no model-supplied arguments. Ask the current MCP
    // client for its workspace; never use the plugin process's installation cwd.
    if (server.server.getClientCapabilities()?.roots) {
      try {
        const { roots } = await server.server.listRoots(undefined, { timeout: 3000 });
        const paths = [...new Set(roots.filter(root => root.uri.startsWith('file:')).map(root => fileURLToPath(root.uri)))];
        if (paths.length === 1) return service.open(paths[0], threadId);
      } catch { /* Render project binding UI when the host cannot supply a root. */ }
    }
    if (process.env.CODEX_WORKSPACE_DIR) return service.open(process.env.CODEX_WORKSPACE_DIR, threadId);
    if (process.env.PROJECT_VERSIONS_WORKSPACE_CWD === '1') {
      const pluginRoot = dirname(dirname(htmlFile));
      const path = process.cwd(); const insidePlugin = relative(pluginRoot, path);
      // Only treat cwd as the workspace when the host explicitly supplies it.
      // The packaged plugin runs from its root; reject that cwd as a project unless
      // the host explicitly launched the server from a workspace directory.
      if (insidePlugin === '..' || insidePlugin.startsWith('..' + sep) || isAbsolute(insidePlugin)) return service.open(path, threadId);
    }
    return { projectRequired: true, threadId };
  }));
  const register = (name: string, action: string, title: string, description: string, schema: Record<string, z.ZodTypeAny>, appOnly = false) => {
    registerAppTool(server, name, { title, description, inputSchema: { sessionId: z.string(), ...schema }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, _meta: { ui: { visibility: appOnly ? ['app'] : ['model', 'app'] } } }, args => attempt(() => service.call(action, args)));
  };
  register('get_git_graph', 'graph', '读取分支图', '读取真实提交父子关系、引用、当前工作树和变化数量。默认全部本地分支，远程使用本机记录。用 nextCursor 继续；STALE_GRAPH 时重新从首页读取。anchor 用于定位当前 HEAD 或其他提交。', { query: z.object({ includeRemote: z.boolean().optional(), branch: z.string().optional(), cursor: z.string().optional(), anchor: z.string().optional(), pageSize: z.number().int().min(20).max(200).optional() }).optional() });
  register('get_git_commit', 'commit', '查看提交详情', '读取完整提交信息及变化文件。id 为完整提交 ID，合并提交默认对比第一父节点，也可传其他实际父节点 base。浅克隆边界不冒充根提交。', { id: z.string(), base: z.string().optional() });
  register('get_git_branch', 'branch', '查看分支详情', '按完整引用名称读取分支最新提交、相对当前 HEAD 各自独有的提交数量、工作树及本机记录的上游关系。不得据此断言可以安全合并。', { name: z.string() });
  register('get_git_changes', 'working', '查看未提交修改', '读取暂存、未暂存、新文件和冲突文件。一个文件可以同时有暂存与未暂存修改。', {});
  register('get_git_diff', 'diff', '查看文件差异', '按需读取所选提交或未提交文件的差异。提交传 commit，可传父节点 base；工作区传 scope。大文件或二进制文件返回明确状态。', { path: z.string(), commit: z.string().optional(), base: z.string().optional(), scope: z.enum(['staged','unstaged','untracked','conflict']).optional() });
  register('prepare_git_handoff', 'handoff', '准备 Codex 请求上下文', '核实所选对象及当前 HEAD，返回可供用户编辑的请求上下文。此工具不会发送消息，也不会执行 Git 操作。', { selection: z.discriminatedUnion('kind', [z.object({ kind: z.literal('commit'), id: z.string() }), z.object({ kind: z.literal('branch'), name: z.string(), id: z.string() }), z.object({ kind: z.literal('working') })]) });
  register('project_versions_ready', 'ready', '面板已连接', '客户端挂载、接收项目数据并初始化 MCP Apps bridge 后回执。仅用于连接诊断。', { hostName: z.string().optional() }, true);
  register('check_project_versions_ready', 'readiness', '检查面板连接', '核实真实客户端 ready 回执、宿主、项目路径和 threadId。测试宿主与 Codex 原生宿主的结果应分别报告。', {});
  return server;
}
if (process.argv[1] && /(?:mcp\.ts|server\.mjs)$/.test(process.argv[1])) await createServer().connect(new StdioServerTransport());
