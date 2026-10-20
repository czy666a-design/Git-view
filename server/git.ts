import { execFile } from 'node:child_process';
import { realpath, lstat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { AppError } from './types.js';

export interface GitOptions { input?: string; allowedExitCodes?: number[]; maxBuffer?: number; truncate?: boolean }
export async function git(project: string, args: string[], options: GitOptions = {}): Promise<string> {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key];
  return new Promise((resolve, reject) => {
    const child = execFile('git', ['--no-pager', '-c', 'core.fsmonitor=false', '-c', 'core.quotePath=false', ...args], {
      cwd: project, env: { ...env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', GIT_NO_LAZY_FETCH: '1' },
      encoding: 'utf8', timeout: 45000, maxBuffer: options.maxBuffer || 16 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (!error || options.allowedExitCodes?.includes(Number(error.code)) || (options.truncate && error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER')) return resolve(stdout);
      if (error.code === 'ENOENT') return reject(new AppError('GIT_MISSING', '尚未找到 Git，请先安装 Git 后重新打开。'));
      reject(new AppError('GIT_ERROR', (stderr || error.message || '无法读取 Git 信息').trim()));
    });
    child.stdin?.end(options.input);
  });
}
export async function optionalGit(project: string, args: string[]) {
  try { return (await git(project, args)).trim(); }
  catch (error) { if (error instanceof AppError && error.code === 'GIT_MISSING') throw error; return ''; }
}
export async function isRepository(project: string) {
  try { return (await git(project, ['rev-parse', '--is-inside-work-tree'])).trim() === 'true'; }
  catch (e) { if (e instanceof AppError && e.code === 'GIT_ERROR' && /not a git repository/i.test(e.message)) return false; throw e; }
}
export async function canonicalProject(path: string) {
  if (!isAbsolute(path)) throw new AppError('INVALID_PATH', '请提供项目的绝对路径。');
  const requested = await realpath(path);
  if (!(await lstat(requested)).isDirectory()) throw new AppError('INVALID_PATH', '请选择项目文件夹。');
  if (!await isRepository(requested)) {
    if (await optionalGit(requested, ['rev-parse', '--is-bare-repository']) === 'true') throw new AppError('BARE_REPOSITORY', '该仓库没有工作目录，暂不支持打开。');
    return requested;
  }
  const root = await realpath((await git(requested, ['rev-parse', '--show-toplevel'])).trim());
  if (root !== requested) throw new AppError('NESTED_PROJECT', `请明确打开 Git 项目根目录：${root}`);
  return root;
}
export function safePath(path: string) {
  if (!path || isAbsolute(path) || path.includes('\0') || path.split(/[\\/]/).includes('..')) throw new AppError('INVALID_PATH', '文件路径超出了当前项目。');
  return path;
}
export async function resolveCommit(project: string, id: string) {
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(id)) throw new AppError('INVALID_COMMIT', '提交标识无效，请刷新后重新选择。');
  const resolved = await optionalGit(project, ['rev-parse', '--verify', `${id}^{commit}`]);
  if (!resolved) throw new AppError('COMMIT_NOT_FOUND', '该提交已无法读取，请刷新项目。');
  return resolved;
}
