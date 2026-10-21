import { randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { canonicalProject, git, resolveCommit } from './git.js';
import { RepositoryReader } from './repository.js';
import { AppError, type HandoffContext, type Selection } from './types.js';

export class Service {
  sessions = new Map<string, { project: string; threadId?: string; ready: boolean; hostName?: string }>();
  constructor(public reader = new RepositoryReader()) {}
  async open(projectPath: string, threadId?: string) {
    const project = await canonicalProject(projectPath); const sessionId = randomUUID();
    const graph = await this.reader.graph(project);
    this.sessions.set(sessionId, { project, threadId, ready: false });
    return { sessionId, threadId, graph };
  }
  async openWorktree(sessionId: string, projectPath: string) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new AppError('SESSION_EXPIRED', '连接已过期，请从当前聊天重新打开 Git 总览。');
    const target = await canonicalProject(projectPath);
    if (target === session.project) return this.open(target, session.threadId);
    const { repository } = await this.reader.snapshot(session.project);
    const paths = await Promise.all(repository.worktrees.map(worktree => realpath(worktree.path).catch(() => undefined)));
    if (!paths.includes(target)) throw new AppError('WORKTREE_NOT_FOUND', '该目录不是此仓库的工作树，请刷新后重新选择。');
    const common = async (project: string) => realpath(resolve(project, (await git(project, ['rev-parse', '--git-common-dir'])).trim()));
    if (await common(target) !== await common(session.project)) throw new AppError('WORKTREE_NOT_FOUND', '该工作树已不属于此仓库，请刷新后重新选择。');
    // Keep previous sessions immutable so in-flight reads cannot change project.
    return this.open(target, session.threadId);
  }
  async call(action: string, params: Record<string, any>): Promise<Record<string, any>> {
    const session = this.sessions.get(params.sessionId);
    if (!session) throw new AppError('SESSION_EXPIRED', '连接已过期，请从当前聊天重新打开 Git 总览。');
    const project = session.project;
    switch (action) {
      case 'graph': return { graph: await this.reader.graph(project, params.query) };
      case 'commit': return { detail: await this.reader.commit(project, params.id, params.base) };
      case 'branch': return { detail: await this.reader.branch(project, params.name) };
      case 'working': return { detail: await this.reader.working(project) };
      case 'diff': return { diff: await this.reader.diff(project, { path: params.path, commit: params.commit, base: params.base, scope: params.scope }) };
      case 'handoff': {
        const { repository, refs } = await this.reader.snapshot(project); const selection = params.selection as Selection;
        let label = '未提交修改';
        if (selection.kind === 'branch') {
          const ref = refs.find(ref => ref.name === selection.name);
          if (!ref || ref.commitId !== selection.id) throw new AppError('STALE_SELECTION', '这条分支的位置已变化，请刷新后重新选择。');
          label = ref.label;
        } else if (selection.kind === 'commit') {
          await resolveCommit(project, selection.id); label = (await this.reader.commit(project, selection.id)).commit.title;
        }
        const context: HandoffContext = { projectPath: project, currentBranch: repository.branch, currentHead: repository.head, observedAt: repository.observedAt, selection, label };
        return { context };
      }
      case 'ready': session.ready = true; session.hostName = params.hostName; return { ready: true, hostName: session.hostName, threadId: session.threadId, projectPath: project };
      case 'readiness': return { ready: session.ready, hostName: session.hostName, threadId: session.threadId, projectPath: project };
      default: throw new AppError('UNKNOWN_ACTION', '此版本仅提供 Git 信息查看，请让 Codex 在聊天中处理 Git 操作。');
    }
  }
}
