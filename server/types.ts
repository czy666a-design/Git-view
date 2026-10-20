export type RefKind = 'local' | 'remote' | 'tag';
export interface GitRef { name: string; label: string; kind: RefKind; commitId: string; upstream?: string }
export interface Commit { id: string; parents: string[]; title: string; date: string; author: string; shallowBoundary: boolean }
export interface Worktree { path: string; head?: string; branch?: string; detached: boolean }
export type ChangeKind = 'added' | 'modified' | 'deleted' | 'renamed';
export type ChangeScope = 'staged' | 'unstaged' | 'untracked' | 'conflict';
export interface Change { path: string; oldPath?: string; kind: ChangeKind; scope?: ChangeScope }
export interface Repository {
  path: string; name: string; initialized: boolean; branch?: string; head?: string; lastCommitAt?: string;
  changes: { total: number; staged: number; unstaged: number; untracked: number; conflicts: number };
  operation?: string; shallow: boolean; worktrees: Worktree[]; observedAt: string;
}
export interface GraphQuery { includeRemote?: boolean; branch?: string; cursor?: string; anchor?: string; pageSize?: number }
export interface GraphData {
  repository: Repository; refs: GitRef[]; commits: Commit[]; revision: string;
  nextCursor?: string; offset: number; anchorMissing?: boolean;
}
export interface CommitDetail { commit: Commit; body: string; email: string; base?: string; files: Change[] }
export interface BranchDetail { ref: GitRef; tip: Commit; currentOnly: number; branchOnly: number; upstream?: { name: string; ahead: number; behind: number; missing: boolean }; worktrees: Worktree[] }
export interface WorkingDetail { files: Change[] }
export interface DiffData { path: string; text: string; kind: 'text' | 'binary' | 'large' | 'conflict'; truncated: boolean; bytes?: number }
export type Selection = { kind: 'commit'; id: string } | { kind: 'branch'; name: string; id: string } | { kind: 'working' };
export interface HandoffContext { projectPath: string; currentBranch?: string; currentHead?: string; observedAt: string; selection: Selection; label: string }
export class AppError extends Error { constructor(public code: string, message: string) { super(message); } }
