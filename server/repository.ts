import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { git, isRepository, optionalGit, resolveCommit, safePath } from './git.js';
import { AppError, type BranchDetail, type Change, type ChangeKind, type Commit, type CommitDetail, type DiffData, type GitRef, type GraphData, type GraphQuery, type Repository, type Worktree } from './types.js';

function kind(status: string): ChangeKind { return status === 'A' || status === '?' ? 'added' : status === 'D' ? 'deleted' : status === 'R' ? 'renamed' : 'modified'; }
export function parseWorking(raw: string): Change[] {
  const records = raw.split('\0'); const files: Change[] = [];
  for (let i = 0; i < records.length; i++) {
    const row = records[i]; if (!row) continue;
    const xy = row.slice(0, 2), path = row.slice(3);
    const oldPath = /[RC]/.test(xy) ? records[++i] : undefined;
    if (/^(UU|AA|DD|AU|UA|DU|UD)$/.test(xy)) { files.push({ path, kind: 'modified', scope: 'conflict' }); continue; }
    if (xy === '??') { files.push({ path, kind: 'added', scope: 'untracked' }); continue; }
    if (xy[0] !== ' ' && xy[0] !== '?') files.push({ path, oldPath, kind: kind(xy[0]), scope: 'staged' });
    if (xy[1] !== ' ' && xy[1] !== '?') files.push({ path, oldPath, kind: kind(xy[1]), scope: 'unstaged' });
  }
  return files;
}
export function parseFiles(raw: string): Change[] {
  const parts = raw.split('\0'); const files: Change[] = [];
  for (let i = 0; i < parts.length; i++) { if (!parts[i]) continue; const status = parts[i], path = parts[++i]; if (path) files.push({ path, kind: kind(status[0]) }); }
  return files;
}
function parseCommits(raw: string, shallow: Set<string>): Commit[] {
  const parts = raw.split('\0'); const commits: Commit[] = [];
  for (let i = 0; i + 4 < parts.length; i += 5) {
    const id = parts[i].trim(); if (!id) continue;
    commits.push({ id, parents: parts[i+1].split(' ').filter(Boolean), title: parts[i+2], date: parts[i+3], author: parts[i+4], shallowBoundary: shallow.has(id) });
  }
  return commits;
}
const format = '%H%x00%P%x00%s%x00%aI%x00%an%x00';
const noFilters = ['--no-ext-diff', '--no-textconv', '--no-renames'];
interface Snapshot { repository: Repository; refs: GitRef[]; revision: string; shallow: Set<string> }
export class RepositoryReader {
  async snapshot(project: string): Promise<Snapshot> {
    const initialized = await isRepository(project);
    const empty: Repository = { path: project, name: basename(project), initialized, changes: { total: 0, staged: 0, unstaged: 0, untracked: 0, conflicts: 0 }, shallow: false, worktrees: [], observedAt: new Date().toISOString() };
    if (!initialized) return { repository: empty, refs: [], revision: 'uninitialized', shallow: new Set() };
    const [head, branch, refsRaw, status, worktreeRaw, shallowFlag] = await Promise.all([
      optionalGit(project, ['rev-parse', '--verify', 'HEAD']), optionalGit(project, ['symbolic-ref', '--short', '-q', 'HEAD']),
      git(project, ['for-each-ref', '--format=%(refname)%00%(objectname)%00%(objecttype)%00%(*objectname)%00%(*objecttype)%00%(upstream)%00', 'refs/heads', 'refs/remotes', 'refs/tags']),
      git(project, ['status', '--porcelain=v1', '-z', '--untracked-files=all']),
      git(project, ['worktree', 'list', '--porcelain', '-z']), optionalGit(project, ['rev-parse', '--is-shallow-repository']),
    ]);
    const refs: GitRef[] = [];
    const parts = refsRaw.split('\0');
    for (let i = 0; i + 5 < parts.length; i += 6) {
      const name = parts[i].trim(); if (!name || name.endsWith('/HEAD')) continue;
      const id = parts[i+2] === 'commit' ? parts[i+1] : parts[i+4] === 'commit' ? parts[i+3] : '';
      if (!id) continue;
      const type = name.startsWith('refs/heads/') ? 'local' : name.startsWith('refs/remotes/') ? 'remote' : 'tag';
      refs.push({ name, label: name.replace(/^refs\/(heads|remotes|tags)\//, ''), kind: type, commitId: id, upstream: parts[i+5] || undefined });
    }
    refs.sort((a,b) => a.name.localeCompare(b.name));
    const files = parseWorking(status); const changes = { total: new Set(files.map(f => f.path)).size, staged: 0, unstaged: 0, untracked: 0, conflicts: 0 };
    for (const file of files) { if (file.scope === 'conflict') changes.conflicts++; else if (file.scope) changes[file.scope]++; }
    const worktrees: Worktree[] = []; let worktree: Worktree | undefined;
    for (const item of worktreeRaw.split('\0')) {
      if (item.startsWith('worktree ')) { worktree = { path: item.slice(9), detached: false }; worktrees.push(worktree); }
      else if (worktree && item.startsWith('HEAD ')) worktree.head = item.slice(5);
      else if (worktree && item.startsWith('branch ')) worktree.branch = item.slice(7);
      else if (worktree && item === 'detached') worktree.detached = true;
    }
    let operation: string | undefined;
    for (const [marker, label] of [['MERGE_HEAD','正在合并'], ['rebase-merge','正在变基'], ['rebase-apply','正在变基'], ['CHERRY_PICK_HEAD','正在挑选提交'], ['REVERT_HEAD','正在撤销提交']] as const) {
      const path = resolve(project, (await git(project, ['rev-parse', '--git-path', marker])).trim());
      try { await lstat(path); operation = label; } catch (e: any) { if (e.code !== 'ENOENT') throw e; }
    }
    if (changes.conflicts) operation = '有待解决的冲突';
    const shallow = new Set<string>();
    if (shallowFlag === 'true') { const file = resolve(project, (await git(project, ['rev-parse', '--git-path', 'shallow'])).trim()); for (const id of (await readFile(file, 'utf8')).trim().split('\n')) shallow.add(id); }
    const repository = { ...empty, head: head || undefined, branch: branch || undefined, changes, operation, shallow: shallowFlag === 'true', worktrees, lastCommitAt: head ? await optionalGit(project, ['show', '-s', '--format=%aI', head]) : undefined };
    const revision = createHash('sha256').update(JSON.stringify({ refs, head, branch, shallow: [...shallow] })).digest('hex');
    return { repository, refs, revision, shallow };
  }
  async graph(project: string, query: GraphQuery = {}): Promise<GraphData> {
    const snapshot = await this.snapshot(project); const { repository, refs, revision, shallow } = snapshot;
    const pageSize = Math.min(200, Math.max(20, query.pageSize || 100));
    const scope = JSON.stringify([!!query.includeRemote, query.branch || '']); let offset = 0;
    if (query.cursor) {
      try { const cursor = JSON.parse(Buffer.from(query.cursor, 'base64url').toString()); if (cursor.revision !== revision || cursor.scope !== scope) throw new Error(); offset = cursor.offset; if (!Number.isSafeInteger(offset) || offset < 0) throw new Error(); }
      catch { throw new AppError('STALE_GRAPH', '分支或历史已变化，请刷新图后继续。'); }
    }
    let roots = refs.filter(ref => ref.kind === 'local' || (query.includeRemote && ref.kind === 'remote')).map(ref => ref.commitId);
    if (query.branch) { const ref = refs.find(r => r.name === query.branch); if (!ref) throw new AppError('BRANCH_NOT_FOUND', '这条分支已不存在，请刷新。'); roots = [ref.commitId]; }
    else if (repository.head) roots.push(repository.head);
    roots = [...new Set(roots)];
    if (!roots.length) return { repository, refs, revision, commits: [], offset };
    let anchorMissing = false;
    if (query.anchor) {
      await resolveCommit(project, query.anchor);
      const order = (await git(project, ['rev-list', '--topo-order', '--stdin'], { input: roots.join('\n') + '\n' })).trim().split('\n');
      const index = order.indexOf(query.anchor);
      if (index < 0) anchorMissing = true; else offset = Math.max(0, index - Math.floor(pageSize / 4));
    }
    const raw = await git(project, ['log', '--topo-order', '--no-decorate', `--format=${format}`, `--max-count=${pageSize+1}`, `--skip=${offset}`, '--stdin'], { input: roots.join('\n') + '\n' });
    const commits = parseCommits(raw, shallow); const hasMore = commits.length > pageSize; commits.splice(pageSize);
    // References are immutable roots for this read. A concurrent switch/update invalidates paging.
    if ((await this.snapshot(project)).revision !== revision) throw new AppError('STALE_GRAPH', '读取期间分支发生变化，请刷新。');
    return { repository, refs, revision, commits, offset, anchorMissing, nextCursor: hasMore ? Buffer.from(JSON.stringify({ revision, scope, offset: offset + pageSize })).toString('base64url') : undefined };
  }
  async commit(project: string, id: string, base?: string): Promise<CommitDetail> {
    const commitId = await resolveCommit(project, id); const snapshot = await this.snapshot(project);
    const commit = parseCommits(await git(project, ['show', '-s', `--format=${format}`, commitId]), snapshot.shallow)[0];
    if (base && !commit.parents.includes(base)) throw new AppError('INVALID_BASE', '比较对象必须是该提交的父提交。');
    const chosenBase = base || commit.parents[0];
    const files = commit.shallowBoundary ? [] : parseFiles(chosenBase ? await git(project, ['diff', ...noFilters, '--name-status', '-z', chosenBase, commitId, '--']) : await git(project, ['diff-tree', ...noFilters, '--root', '--no-commit-id', '-r', '--name-status', '-z', commitId, '--']));
    const [body, email] = await Promise.all([git(project, ['show', '-s', '--format=%B', commitId]), optionalGit(project, ['show', '-s', '--format=%ae', commitId])]);
    return { commit, body: body.trim(), email, base: chosenBase, files };
  }
  async branch(project: string, name: string): Promise<BranchDetail> {
    const snapshot = await this.snapshot(project); const ref = snapshot.refs.find(r => r.name === name && r.kind !== 'tag');
    if (!ref) throw new AppError('BRANCH_NOT_FOUND', '分支已不存在，请刷新图。');
    let currentOnly = 0, branchOnly = 0;
    if (snapshot.repository.head) [currentOnly, branchOnly] = (await git(project, ['rev-list', '--left-right', '--count', `${snapshot.repository.head}...${ref.commitId}`])).trim().split(/\s+/).map(Number);
    let upstream: BranchDetail['upstream'];
    if (ref.upstream) { const remote = snapshot.refs.find(r => r.name === ref.upstream); let ahead = 0, behind = 0; if (remote) [ahead, behind] = (await git(project, ['rev-list', '--left-right', '--count', `${ref.commitId}...${remote.commitId}`])).trim().split(/\s+/).map(Number); upstream = { name: ref.upstream.replace(/^refs\/remotes\//, ''), ahead, behind, missing: !remote }; }
    const tip = parseCommits(await git(project, ['show', '-s', `--format=${format}`, ref.commitId]), snapshot.shallow)[0];
    return { ref, tip, currentOnly, branchOnly, upstream, worktrees: snapshot.repository.worktrees.filter(w => w.branch === name) };
  }
  async working(project: string) { return { files: parseWorking(await git(project, ['status', '--porcelain=v1', '-z', '--untracked-files=all'])) }; }
  async diff(project: string, input: { path: string; commit?: string; base?: string; scope?: string }): Promise<DiffData> {
    const path = safePath(input.path); let args: string[]; let maxSize = 0; let conflict = false; let untracked = false;
    if (input.commit) {
      const detail = await this.commit(project, input.commit, input.base);
      if (!detail.files.some(file => file.path === path)) throw new AppError('FILE_NOT_FOUND', '该文件不在此提交的变化中。');
      if (!detail.base) args = ['show', '--format=', '--root', ...noFilters, detail.commit.id, '--', path];
      else args = ['diff', ...noFilters, detail.base, detail.commit.id, '--', path];
      for (const id of [detail.base, detail.commit.id].filter(Boolean)) maxSize = Math.max(maxSize, Number(await optionalGit(project, ['cat-file', '-s', `${id}:${path}`])) || 0);
    } else {
      const file = (await this.working(project)).files.find(file => file.path === path && file.scope === input.scope);
      if (!file) throw new AppError('FILE_NOT_FOUND', '文件状态已变化，请刷新后重新选择。');
      conflict = file.scope === 'conflict'; untracked = file.scope === 'untracked';
      args = untracked ? ['diff', '--no-index', ...noFilters, '--', '/dev/null', path] : ['diff', ...noFilters, ...(file.scope === 'staged' ? ['--cached'] : conflict ? ['--cc'] : []), '--', path];
      try { const stat = await lstat(join(project, path)); maxSize = stat.isFile() ? stat.size : 0; } catch (e: any) { if (e.code !== 'ENOENT') throw e; }
      const blobs = file.scope === 'conflict' ? [`:1:${path}`, `:2:${path}`, `:3:${path}`] : file.scope === 'staged' ? [`HEAD:${path}`, `:${path}`] : [`:${path}`];
      for (const blob of blobs) maxSize = Math.max(maxSize, Number(await optionalGit(project, ['cat-file', '-s', blob])) || 0);
    }
    if (maxSize > 1024*1024) return { path, text: '', kind: 'large', bytes: maxSize, truncated: false };
    const numArgs = [...args]; numArgs.splice(numArgs.indexOf('--'), 0, '--numstat');
    const numstat = await git(project, numArgs, { allowedExitCodes: untracked ? [1] : [] });
    if (/(?:^|\n)-\t-\t/.test(numstat)) return { path, text: '', kind: 'binary', bytes: maxSize, truncated: false };
    const textArgs = [...args]; textArgs.splice(textArgs.indexOf('--'), 0, '--no-color', '--unified=3');
    const text = await git(project, textArgs, { allowedExitCodes: untracked ? [1] : [], maxBuffer: 300000, truncate: true });
    return { path, text: text.slice(0, 100000), kind: conflict ? 'conflict' : 'text', truncated: text.length > 100000 };
  }
}
