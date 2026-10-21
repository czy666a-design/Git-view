import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { canMessage, connect, handoffText, hostName, request, sendRequest } from './bridge.js';
import { Select } from './Select.js';
import { edgePath, laneColors, layoutGraph } from './layout.js';
import type { BranchDetail, Change, CommitDetail, DiffData, GraphData, GraphQuery, HandoffContext, Selection, WorkingDetail } from '../server/types.js';

function Icon({ name, size = 17 }: { name: string; size?: number }) {
  const shapes: Record<string, React.ReactNode> = {
    branch: <><circle cx="6" cy="5" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="19" r="2"/><path d="M6 7v10M18 8c0 6-12 2-12 8"/></>,
    refresh: <><path d="M20 10a8 8 0 0 0-14-4L3 9"/><path d="M3 4v5h5"/><path d="M4 14a8 8 0 0 0 14 4l3-3"/><path d="M16 15h5v5"/></>, locate: <><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></>,
    close: <path d="m6 6 12 12M6 18 18 6"/>, arrow: <path d="m9 5 7 7-7 7"/>, file: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"/><path d="M14 3v6h6"/></>,
    clock: <><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></>, commit: <><circle cx="12" cy="12" r="4"/><path d="M2 12h6M16 12h6"/></>, cloud: <path d="M6 18a4 4 0 1 1 0-8 6 6 0 0 1 12-1 4.5 4.5 0 0 1 0 9H6Z"/>,
    spark: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>, send: <><path d="m3 3 18 9-18 9 3-9-3-9ZM6 12h15"/></>, copy: <><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>, check: <path d="m5 12 4 4L19 6"/>, tag: <><path d="M20 13 13 20 3 10V3h7l10 10Z"/><circle cx="7.5" cy="7.5" r=".8"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{shapes[name] || shapes.commit}</svg>;
}
function RefPopover({ anchor, onClose, children }: { anchor: HTMLButtonElement; onClose: () => void; children: React.ReactNode }) {
  const popup = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>();
  useLayoutEffect(() => {
    const box = popup.current!; const rect = anchor.getBoundingClientRect();
    const width = box.offsetWidth, height = box.offsetHeight, gap = 8, margin = 12;
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
    const top = rect.bottom + gap + height <= window.innerHeight - margin ? rect.bottom + gap : Math.max(margin, rect.top - gap - height);
    setPosition({ left, top });
    const dismiss = (event: Event) => { if (!box.contains(event.target as Node) && !anchor.contains(event.target as Node)) onClose(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); anchor.focus({ preventScroll: true }); } };
    document.addEventListener('pointerdown', dismiss); document.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', onClose); window.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('scroll', dismiss, true); window.removeEventListener('resize', onClose); window.removeEventListener('keydown', key, true); };
  }, [anchor, onClose]);
  return createPortal(<div ref={popup} className="ref-popover" role="region" aria-label="分支与标签引用" style={{ ...position, visibility: position ? 'visible' : 'hidden' }} onClick={e => e.stopPropagation()}>{children}</div>, document.body);
}
const date = (value?: string) => value ? new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
const scopeLabels = { staged: '已暂存', unstaged: '未暂存', untracked: '新增文件', conflict: '冲突' };
const changeLabels = { added: '新增', modified: '修改', deleted: '删除', renamed: '重命名' };
const ROW = 78;
function Panel() {
  const [projectRequired, setProjectRequired] = useState(false); const [projectPath, setProjectPath] = useState('');
  const [graph, setGraph] = useState<GraphData>(); const [connected, setConnected] = useState(false); const ready = useRef('');
  const [bindingId, setBindingId] = useState(''); const bindingRef = useRef('');
  const switchingWorktree = useRef(false);
  const threadRef = useRef<string | undefined>(undefined); const reconnecting = useRef(false);
  const [retryMode, setRetryMode] = useState<'read' | 'reconnect' | 'none'>('read');
  const retryModeRef = useRef<'read' | 'reconnect' | 'none'>('read');
  const [query, setQuery] = useState<GraphQuery>({}); const queryRef = useRef<GraphQuery>({});
  const [selection, setSelection] = useState<Selection>(); const [detailOpen, setDetailOpen] = useState(false); const [detail, setDetail] = useState<CommitDetail | BranchDetail | WorkingDetail>();
  const [base, setBase] = useState<string>(); const [openFile, setOpenFile] = useState<string>(); const [diff, setDiff] = useState<DiffData>(); const [diffBusy, setDiffBusy] = useState(false);
  const [busy, setBusy] = useState(false); const [detailBusy, setDetailBusy] = useState(false); const [error, setError] = useState(''); const [detailError, setDetailError] = useState(''); const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState<{ context: HandoffContext; intent: string }>(); const [sending, setSending] = useState(false);
  const [slow, setSlow] = useState(false); const [refPopover, setRefPopover] = useState<string>();
  const popoverAnchor = useRef<HTMLButtonElement | null>(null);
  const closeRefs = React.useCallback(() => setRefPopover(undefined), []);
  const graphSeq = useRef(0), detailSeq = useRef(0), diffSeq = useRef(0); const graphRef = useRef<GraphData | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null); const panelRef = useRef<HTMLElement>(null); const draftRef = useRef<HTMLDialogElement>(null); const selectionRef = useRef<Selection | undefined>(undefined);
  graphRef.current = graph; selectionRef.current = selection;
  const readError = (failure: any, reconnectFailed = false) => {
    setNotice('');
    const terminal = reconnectFailed || ['NOT_CONNECTED', 'GIT_MISSING', 'INVALID_PATH', 'PROJECT_UNAVAILABLE', 'BARE_REPOSITORY', 'NESTED_PROJECT'].includes(failure.code);
    const mode = terminal ? 'none' : failure.code === 'SESSION_EXPIRED' ? 'reconnect' : 'read';
    retryModeRef.current = mode; setRetryMode(mode);
    setError(reconnectFailed ? '无法重新建立连接，请从当前聊天重新打开 Gitview。' : mode === 'reconnect' ? '连接已过期，重新读取将重新连接当前工作树。' : failure.message);
  };
  const accept = (data: Record<string, any>) => {
    if (data.graph) {
      if (data.sessionId && data.sessionId !== bindingRef.current) {
        bindingRef.current = data.sessionId; setBindingId(data.sessionId);
        threadRef.current = data.threadId;
        retryModeRef.current = 'read'; setRetryMode('read');
        ++graphSeq.current; ++detailSeq.current; ++diffSeq.current;
        queryRef.current = {}; setQuery({}); selectionRef.current = undefined;
        setSelection(undefined); setDetailOpen(false); setDetail(undefined); setBase(undefined);
        setOpenFile(undefined); setDiff(undefined); setDraft(undefined); setRefPopover(undefined);
        setBusy(false); setDetailBusy(false); setDiffBusy(false); setDetailError(''); setError('');
        scrollRef.current?.scrollTo({ top: 0 });
      }
      graphRef.current = data.graph; setGraph(data.graph); setProjectRequired(false);
    } else if (data.projectRequired) setProjectRequired(true);
  };
  useEffect(() => { connect(accept, () => setConnected(true)).catch(e => setError(e.message)); const timer = setTimeout(() => setSlow(true), 10000); return () => clearTimeout(timer); }, []);
  useEffect(() => { if (connected && graph && bindingId && ready.current !== bindingId) { ready.current = bindingId; request('ready', { hostName: hostName() }).catch(failure => { if (bindingRef.current === bindingId) readError(failure); }); } }, [connected, graph, bindingId]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5500); return () => clearTimeout(timer); }, [notice]);
  const reopen = async () => {
    const project = graphRef.current?.repository.path;
    if (!project || reconnecting.current) return;
    reconnecting.current = true;
    const seq = ++graphSeq.current; setBusy(true);
    try {
      const result = await request('reopen', { projectPath: project, threadId: threadRef.current });
      if (seq !== graphSeq.current) return;
      if (!result.sessionId || result.graph?.repository.path !== project) throw new Error('未能恢复原工作树的连接。');
      accept(result); setNotice('已重新连接并读取当前工作树。');
    } catch (failure) { if (seq === graphSeq.current) readError(failure, true); }
    finally { reconnecting.current = false; if (seq === graphSeq.current) setBusy(false); }
  };
  const load = async (next: GraphQuery = queryRef.current, append = false, locate = false) => {
    if (switchingWorktree.current || reconnecting.current || retryModeRef.current === 'none') return;
    if (retryModeRef.current === 'reconnect') { await reopen(); return; }
    const seq = ++graphSeq.current; setBusy(true); setError('');
    const viewport = scrollRef.current; const previousGraph = graphRef.current;
    const preserve = !append && !locate && next === queryRef.current;
    const topRow = preserve && viewport ? [...viewport.querySelectorAll<HTMLElement>('.graph-row')].find(row => row.getBoundingClientRect().bottom > viewport.getBoundingClientRect().top) : undefined;
    const topId = topRow?.id.slice(7); const topOffset = topRow && viewport ? topRow.getBoundingClientRect().top - viewport.getBoundingClientRect().top : 0;
    const readQuery = preserve && topId && topId !== 'working' && previousGraph && (previousGraph.offset > 0 || previousGraph.commits.length > 100) ? { ...next, anchor: topId } : next;
    try {
      const result = await request('graph', { query: readQuery }); if (seq !== graphSeq.current) return;
      const incoming = result.graph as GraphData;
      setGraph(previous => append && previous && previous.revision === incoming.revision ? { ...incoming, offset: previous.offset, commits: [...previous.commits, ...incoming.commits].filter((v,i,all) => all.findIndex(x => x.id === v.id) === i) } : incoming);
      setSelection(previous => { if (previous?.kind !== 'branch') return previous; const ref = incoming.refs.find(r => r.name === previous.name); return ref ? { ...previous, id: ref.commitId } : undefined; });
      if (preserve && topId) requestAnimationFrame(() => { const row = document.getElementById(`commit-${topId}`); if (row && viewport) viewport.scrollTop += row.getBoundingClientRect().top - viewport.getBoundingClientRect().top - topOffset; });
      if (locate && incoming.repository.head) requestAnimationFrame(() => document.getElementById(`commit-${incoming.repository.head}`)?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth' }));
    } catch (e: any) { if (seq === graphSeq.current) readError(e); }
    finally { if (seq === graphSeq.current) setBusy(false); }
  };
  const changeQuery = (next: GraphQuery) => { queryRef.current = next; setQuery(next); setRefPopover(undefined); scrollRef.current?.scrollTo({ top: 0 }); load(next); };
  const viewWorktree = async (path: string) => {
    if (switchingWorktree.current || path === graphRef.current?.repository.path) return;
    switchingWorktree.current = true;
    const seq = ++graphSeq.current; setBusy(true); setError('');
    try {
      const result = await request('open', { projectPath: path });
      if (seq !== graphSeq.current) return;
      accept(result); setNotice('已更改查看的工作树。');
    } catch (e: any) { if (seq === graphSeq.current) readError(e); }
    finally { switchingWorktree.current = false; if (seq === graphSeq.current) setBusy(false); }
  };
  useEffect(() => {
    const refresh = () => { if (graphRef.current && retryModeRef.current === 'read' && document.visibilityState === 'visible' && !draftRef.current?.open) load(queryRef.current); };
    window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh);
  }, []);
  useEffect(() => {
    const seq = ++detailSeq.current; ++diffSeq.current; setOpenFile(undefined); setDiff(undefined); setDetailError(''); setDetail(undefined); setDraft(undefined);
    if (!selection) return;
    setDetailBusy(true);
    const action = selection.kind === 'commit' ? 'commit' : selection.kind === 'branch' ? 'branch' : 'working';
    const params = selection.kind === 'commit' ? { id: selection.id, base } : selection.kind === 'branch' ? { name: selection.name } : {};
    request(action, params).then(result => { if (seq === detailSeq.current) setDetail(result.detail); }).catch(e => { if (seq === detailSeq.current) setDetailError(e.message); }).finally(() => { if (seq === detailSeq.current) setDetailBusy(false); });
  }, [selection?.kind, selection && 'id' in selection ? selection.id : '', selection?.kind === 'branch' ? selection.name : '', base, graph?.revision, selection?.kind === 'working' ? graph?.repository.observedAt : '']);
  const choose = (value: Selection) => { if (JSON.stringify(value) !== JSON.stringify(selection) || base !== undefined) { setDetailBusy(true); setDetail(undefined); } setBase(undefined); setSelection(value); setDetailOpen(true); setRefPopover(undefined); };
  const closeDetail = () => { setDetailOpen(false); setDraft(undefined); requestAnimationFrame(() => { const id = selection && 'id' in selection ? selection.id : 'working'; document.getElementById(`commit-${id}`)?.querySelector<HTMLButtonElement>('.row-title')?.focus({ preventScroll: true }); }); };
  useEffect(() => { if (!selection || !detailOpen) return; const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !draftRef.current?.open) closeDetail(); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [selection, detailOpen]);
  const fileDiff = async (file: Change, commit?: CommitDetail) => {
    const key = `${file.scope || 'commit'}:${file.path}`;
    if (openFile === key) { setOpenFile(undefined); return; }
    const seq = ++diffSeq.current; setOpenFile(key); setDiff(undefined); setDiffBusy(true); setDetailError('');
    try { const result = await request('diff', { path: file.path, ...(commit ? { commit: commit.commit.id, base: commit.base } : { scope: file.scope }) }); if (seq === diffSeq.current) setDiff(result.diff); }
    catch (e: any) { if (seq === diffSeq.current) setDetailError(e.message); }
    finally { if (seq === diffSeq.current) setDiffBusy(false); }
  };
  const beginHandoff = async () => {
    if (!selection) return; setDetailError('');
    const seq = detailSeq.current;
    try { const result = await request('handoff', { selection }); if (seq !== detailSeq.current) return; setDraft({ context: result.context, intent: selection.kind === 'working' ? '请帮我理解当前未提交的修改，以及继续工作前需要注意什么。' : selection.kind === 'branch' ? '请帮我解释这条分支的进展，以及它与当前分支的关系。' : '请帮我解释这次提交改了什么，以及它在项目历史中的位置。' }); }
    catch (e:any) { if (seq === detailSeq.current) setDetailError(e.message); }
  };
  useEffect(() => { if (draft && !draftRef.current?.open) draftRef.current?.showModal(); }, [!!draft]);
  const dispatch = async (copy: boolean) => {
    if (!draft || !selection || sending) return; setSending(true); setDetailError('');
    const seq = detailSeq.current;
    try {
      const fresh = await request('handoff', { selection }); const text = handoffText(fresh.context, draft.intent);
      if (seq !== detailSeq.current) return;
      if (copy) { await navigator.clipboard.writeText(text); setNotice('已复制请求，可粘贴到 Codex 聊天。'); }
      else { await sendRequest(text); setNotice('已发送到当前 Codex 聊天。'); }
      setDraft(undefined);
    } catch (e:any) { if (seq === detailSeq.current) setDetailError(e.message); }
    finally { setSending(false); }
  };
  const layout = useMemo(() => layoutGraph(graph?.commits || [], graph?.repository.changes.total ? graph.repository.head : undefined), [graph?.commits, graph?.repository.changes.total, graph?.repository.head]);
  const plotWidth = Math.max(66, layout.lanes*22+30); const height = layout.rows.length*ROW;
  const selectedCommit = selection && 'id' in selection ? selection.id : '';
  const commitDetail = detail && 'commit' in detail ? detail as CommitDetail : undefined;
  const branchDetail = detail && 'ref' in detail ? detail as BranchDetail : undefined;
  const workingDetail = detail && 'files' in detail && !('commit' in detail) ? detail as WorkingDetail : undefined;
  const files = commitDetail?.files || workingDetail?.files || [];
  const renderFiles = (fileList: Change[], commit?: CommitDetail) => <div className="file-list">{fileList.map(file => {
    const key = `${file.scope || 'commit'}:${file.path}`; const expanded = openFile === key;
    return <div className="file-entry" key={key}><button className={`file-toggle ${expanded ? 'expanded' : ''}`} aria-expanded={expanded} onClick={() => fileDiff(file, commit)}><Icon name="file" size={15}/><span className="file-path" title={file.path}>{file.path}</span><span className={`file-kind ${file.kind}`}>{changeLabels[file.kind]}</span><Icon name="arrow" size={12}/></button>{expanded && <div className="diff-content">{diffBusy ? <p className="loading-line">正在读取文件差异…</p> : diff ? <>{diff.kind === 'large' ? <p className="diff-message">文件较大（{Math.ceil((diff.bytes || 0)/1024)} KB），可交给 Codex 按需检查。</p> : diff.kind === 'binary' ? <p className="diff-message">二进制文件，无法显示文本差异。</p> : <>{diff.kind === 'conflict' && <p className="diff-message">以下为 Git 记录的冲突文件差异。</p>}<pre aria-label={`${file.path} 的差异`}>{diff.text ? diff.text.split('\n').map((line,i) => <span key={i} className={line.startsWith('+') && !line.startsWith('+++') ? 'diff-add' : line.startsWith('-') && !line.startsWith('---') ? 'diff-delete' : line.startsWith('@@') ? 'diff-hunk' : ''}>{line || ' '} {'\n'}</span>) : '当前没有可显示的文本差异。'}</pre></>}{diff.truncated && <p className="diff-message">差异较长，仅显示前 100,000 字符。</p>}</> : null}</div>}</div>;
  })}</div>;

  if (!graph && projectRequired) return <div className="connecting project-binding"><Icon name="branch" size={26}/><h1>打开 Gitview</h1><p>宿主尚未提供当前项目目录。请选择这次要查看的项目。</p><form onSubmit={async event => { event.preventDefault(); setBusy(true); setError(''); try { accept(await request('open', { projectPath: projectPath.trim() })); } catch (e: any) { setError(e.message); } finally { setBusy(false); } }}><label htmlFor="project-root">项目文件夹的绝对路径</label><input id="project-root" autoFocus value={projectPath} onChange={event => setProjectPath(event.target.value)} placeholder="/Users/你/项目文件夹"/>{error && <p role="alert">{error}</p>}<button className="primary" disabled={busy || !projectPath.trim()}>{busy ? '正在读取…' : '打开项目'}</button></form></div>;
  if (!graph) return <div className="connecting"><Icon name="branch" size={26}/><h1>Gitview</h1><p>{error || (slow ? '尚未收到项目数据，请从当前聊天重新打开面板。' : '正在读取项目分支…')}</p></div>;
  const repository = graph.repository;
  return <div className={`app ${selection && detailOpen ? 'has-detail' : ''}`}>
    <header className="header"><div className="brand"><strong>Gitview</strong><span className="separator"/><span className="project-name" title={repository.path}>{repository.name}</span></div><button className={`icon-button ${busy ? 'spinning' : ''}`} aria-label="刷新 Git 信息" title="刷新 Git 信息" onClick={() => load()} disabled={busy || retryMode === 'none'}><Icon name="refresh" size={18}/></button></header>
    <div className="worktree-bar"><span className="worktree-label">查看工作树</span>{repository.worktrees.length ? <Select label="查看工作树" value={repository.path} disabled={busy} onChange={viewWorktree} options={repository.worktrees.map(worktree => ({ value: worktree.path, label: worktree.branch?.replace(/^refs\/heads\//, '') || (worktree.detached ? '游离 HEAD' : '无分支'), description: worktree.path }))}/> : <span title={repository.path}>{repository.path}</span>}</div>
    <div className="repository-bar"><div className="current-branch"><Icon name="branch" size={15}/><strong title={repository.branch}>{repository.initialized ? repository.branch || '未处于分支' : '未启用 Git'}</strong><span className="here-dot"/><span className="subtle">工作树 HEAD</span></div>{repository.head && <div className="head-state"><code>{repository.head.slice(0,7)}</code><span className="subtle">{date(repository.lastCommitAt)}</span></div>}<button className={`working-count ${repository.changes.conflicts ? 'conflicted' : ''}`} onClick={() => choose({ kind: 'working' })}><span className={`working-dot ${repository.changes.total ? 'dirty' : ''}`}/>{repository.changes.total ? `${repository.changes.total} 个文件未提交` : '没有未提交修改'}<Icon name="arrow" size={11}/></button></div>
    {repository.operation && <div className="operation-notice"><span className="working-dot dirty"/>{repository.operation}</div>}
    <div className="workspace">
      <main className="graph-pane">
        <div className="toolbar"><div className="branch-filter"><Select label="筛选分支" variant="quiet" disabled={busy} value={query.branch || ''} onChange={branch => changeQuery({ ...query, branch: branch || undefined })} options={[{ value: '', label: `全部本地分支 · ${graph.refs.filter(r => r.kind === 'local').length}` }, ...graph.refs.filter(r => r.kind === 'local' || (query.includeRemote && r.kind === 'remote')).map(ref => ({ value: ref.name, label: ref.label }))]}/></div><div className="toolbar-actions"><label className="remote-switch" title={`远程信息来自本机记录，读取于 ${date(repository.observedAt)}`}><input type="checkbox" disabled={busy} checked={!!query.includeRemote} onChange={e => changeQuery({ includeRemote: e.target.checked })}/><Icon name="cloud" size={14}/><span>显示远程</span></label><button className="text-button locate-button" aria-label="定位当前" title="定位当前" disabled={!repository.head || busy} onClick={() => { const exists = graph.commits.some(c => c.id === repository.head); if (exists && !query.branch) document.getElementById(`commit-${repository.head}`)?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth' }); else { const next = { includeRemote: query.includeRemote }; queryRef.current = next; setQuery(next); load({ ...next, anchor: repository.head }, false, true); } }}><Icon name="locate" size={14}/><span>定位当前</span></button></div></div>
        {error && <div className="error-banner" role="alert">{error}{retryMode !== 'none' && <button className="text-button" onClick={() => load()} disabled={busy}>{busy && retryMode === 'reconnect' ? '正在重新连接…' : '重新读取'}</button>}</div>}
        {query.includeRemote && <div className="remote-notice">远程为本机记录 · 读取于 {date(repository.observedAt)}</div>}
        <div className="graph-scroll" ref={scrollRef} onClick={() => { if (refPopover) setRefPopover(undefined); }}>
          {graph.offset > 0 && <button className="history-window" onClick={() => load(queryRef.current)}>↑ 当前查看历史中的一段 · 回到最新位置</button>}
          {graph.anchorMissing && <p className="empty-hint">当前位置不在当前筛选范围内。</p>}
          {layout.rows.length ? <div className="graph-content" style={{ '--plot-width': `${plotWidth}px`, '--row-height': `${ROW}px` } as React.CSSProperties}>
            <svg className="graph-lines" width={plotWidth} height={height} aria-hidden="true">{layout.edges.map((edge,i) => <path key={i} d={edgePath(edge,ROW,height)} fill="none" stroke={laneColors[edge.fromLane % laneColors.length]} strokeWidth="2" strokeLinecap="round" strokeDasharray={edge.working || edge.to === undefined ? '4 4' : undefined} opacity={edge.working ? .7 : .86}/>)}</svg>
            {layout.rows.map(row => {
              const current = row.id === repository.head, active = row.working ? selection?.kind === 'working' : selectedCommit === row.id;
              const refs = graph.refs.filter(ref => ref.commitId === row.id); const visible = refs.filter(ref => ref.kind !== 'remote'); const remote = refs.filter(ref => ref.kind === 'remote');
              return <div key={row.id} id={`commit-${row.id}`} className={`graph-row ${current ? 'current' : ''} ${active ? 'active' : ''} ${row.working ? 'working-row' : ''}`}>
                <button className="node-hit" style={{ left: 6+row.lane*22, '--lane-color': laneColors[row.lane % laneColors.length] } as React.CSSProperties} aria-label={row.working ? '查看未提交修改' : `查看提交 ${row.commit!.title}`} onClick={() => choose(row.working ? { kind: 'working' } : { kind: 'commit', id: row.id })}><span className={`node ${row.working ? 'working-node' : ''}`}>{current && <span/>}</span></button>
                <div className="row-content"><div className="row-top"><button className="row-title" onClick={() => choose(row.working ? { kind: 'working' } : { kind: 'commit', id: row.id })} title={row.working ? '查看当前工作目录中的未提交修改' : row.commit!.title}>{row.working ? `未提交修改 · ${repository.changes.total} 个文件` : row.commit!.title}</button>{!row.working && <time title={row.commit!.date}>{date(row.commit!.date)}</time>}</div>
                  <div className="row-labels">{row.working ? null : <>{visible.slice(0,3).map(ref => <button key={ref.name} className={`ref-badge ${ref.kind}`} style={{ '--lane-color': laneColors[row.lane % laneColors.length] } as React.CSSProperties} onClick={() => ref.kind === 'tag' ? choose({ kind: 'commit', id: row.id }) : choose({ kind: 'branch', name: ref.name, id: ref.commitId })} title={ref.name} aria-label={ref.label}>{ref.kind === 'tag' && <Icon name="tag" size={11}/>}<span className="ref-name"><span className="ref-start">{ref.label.slice(0,-8)}</span><span className="ref-end">{ref.label.slice(-8)}</span></span></button>)}{current && <span className="head-badge">← 工作树 HEAD</span>}{row.commit!.parents.length > 1 && <span className="merge-label">合并</span>}{row.commit!.shallowBoundary && <span className="merge-label">浅克隆边界</span>}{(remote.length > 0 || visible.length > 3) && <span className="ref-overflow"><button className="extra-refs" aria-expanded={refPopover === row.id} onClick={e => { e.stopPropagation(); popoverAnchor.current = e.currentTarget; setRefPopover(refPopover === row.id ? undefined : row.id); }}>{visible.length > 3 ? `+${visible.length-3} 标签` : ''}{remote.length ? `${visible.length > 3 ? ' · ' : ''}${remote.length} 个远程分支` : ''}</button>{refPopover === row.id && popoverAnchor.current && <RefPopover anchor={popoverAnchor.current} onClose={closeRefs}>{[...visible.slice(3),...remote].map(ref => <button key={ref.name} onClick={() => ref.kind === 'tag' ? choose({ kind: 'commit', id: row.id }) : choose({ kind: 'branch', name: ref.name, id: ref.commitId })}><Icon name={ref.kind === 'remote' ? 'cloud' : 'tag'} size={13}/><span>{ref.label}</span></button>)}<p>远程为本机记录 · {date(repository.observedAt)}</p></RefPopover>}</span>}</>}
                  </div>
                </div>
              </div>;
            })}
          </div> : <div className="empty-state"><Icon name="branch" size={30}/><h1>{repository.initialized ? '这个项目还没有提交' : '这个文件夹尚未启用 Git'}</h1><p>{repository.initialized ? '有了第一次提交，分支关系就会显示在这里。' : '可以在 Codex 聊天中初始化仓库，再回来查看。'}</p></div>}
          {graph.nextCursor && <button className="load-more" disabled={busy} onClick={() => load({ ...queryRef.current, cursor: graph.nextCursor }, true)}>{busy ? '正在读取…' : '继续查看更早的历史'}<Icon name="arrow" size={12}/></button>}
          {!graph.nextCursor && repository.shallow && <p className="history-end">已到本机浅克隆的历史边界</p>}
        </div>
      </main>
      {selection && detailOpen && <><button className="detail-backdrop" aria-label="关闭详情覆盖层" onClick={closeDetail}/><aside ref={panelRef} className="detail-pane" aria-label="Git 详情"><div className="detail-top"><span>{selection.kind === 'commit' ? '提交详情' : selection.kind === 'branch' ? '分支详情' : '未提交修改'}</span><button className="icon-button" aria-label="关闭详情" onClick={closeDetail}><Icon name="close" size={18}/></button></div>
        <div className="detail-scroll">{detailError && !draft && <div className="error-banner" role="alert">{detailError}</div>}{detailBusy ? <p className="loading-line">正在读取详情…</p> : commitDetail ? <><h2 className="detail-title">{commitDetail.commit.title}</h2><div className="detail-meta"><span>{commitDetail.commit.author}</span><time>{date(commitDetail.commit.date)}</time></div><div className="detail-section-label">{commitDetail.commit.shallowBoundary ? '浅克隆边界 · 父提交未保存在本机' : commitDetail.base ? `相对${commitDetail.commit.parents.length > 1 ? `第 ${commitDetail.commit.parents.indexOf(commitDetail.base)+1} 个父提交` : '上一次提交'} · ${files.length} 个文件` : `首次提交 · ${files.length} 个文件`}</div>{commitDetail.commit.parents.length > 1 && <div className="parent-picker"><span>比较对象</span><Select label="选择父提交" value={commitDetail.base || ''} onChange={setBase} options={commitDetail.commit.parents.map((id,i) => ({ value: id, label: `第 ${i+1} 个父提交 · ${id.slice(0,7)}` }))}/></div>}<details className="commit-information"><summary><Icon name="arrow" size={12}/>提交信息</summary><pre>{commitDetail.body}</pre><dl><dt>提交</dt><dd>{commitDetail.commit.id}</dd><dt>作者</dt><dd>{commitDetail.commit.author} &lt;{commitDetail.email}&gt;</dd><dt>父提交</dt><dd>{commitDetail.commit.parents.join('\n') || (commitDetail.commit.shallowBoundary ? '本机缺少历史' : '无')}</dd></dl></details>{renderFiles(files,commitDetail)}{!files.length && !commitDetail.commit.shallowBoundary && <p className="empty-hint">这次比较没有文件变化。</p>}</> : branchDetail ? <><div className="detail-type"><Icon name={branchDetail.ref.kind === 'remote' ? 'cloud' : 'branch'} size={15}/>{branchDetail.ref.kind === 'remote' ? '远程分支 · 本机记录' : '本地分支'}</div><h2 className="detail-title branch-name">{branchDetail.ref.label}</h2><p className="branch-tip-label">最新提交</p><button className="branch-tip" onClick={() => choose({ kind: 'commit', id: branchDetail.tip.id })}>{branchDetail.tip.title}<Icon name="arrow" size={14}/></button><p className="detail-meta">{date(branchDetail.tip.date)} · {branchDetail.tip.author}</p><div className="branch-comparison"><h3>与当前分支的关系</h3><div><span>此分支独有</span><strong>{branchDetail.branchOnly}<small> 次提交</small></strong></div><div><span>当前分支独有</span><strong>{branchDetail.currentOnly}<small> 次提交</small></strong></div>{!branchDetail.branchOnly && !branchDetail.currentOnly && <p>两条分支停在同一次提交。</p>}</div>{branchDetail.upstream && <section className="branch-section"><h3>远程关联</h3><code>{branchDetail.upstream.name}</code><p>{branchDetail.upstream.missing ? '本机没有对应远程引用。' : `本地领先 ${branchDetail.upstream.ahead} 次，落后 ${branchDetail.upstream.behind} 次提交。`}</p><span className="muted">依据本机已有记录</span></section>}{branchDetail.worktrees.length > 0 && <section className="branch-section"><h3>所在工作目录</h3>{branchDetail.worktrees.map(w => <p className="worktree-path" key={w.path}>{w.path === repository.path && <span className="here-dot"/>}{w.path}</p>)}</section>}</> : workingDetail ? <><h2 className="detail-title">{new Set(files.map(f => f.path)).size} 个文件尚未提交</h2><p className="detail-description">这里显示当前工作目录的真实变化。</p>{(['conflict','staged','unstaged','untracked'] as const).map(scope => { const group = files.filter(file => file.scope === scope); return group.length ? <section className="working-group" key={scope}><h3>{scopeLabels[scope]}<span>{group.length}</span></h3>{renderFiles(group)}</section> : null; })}{!files.length && <p className="empty-hint">当前工作目录没有未提交修改。</p>}</> : null}</div>
        <div className="detail-footer"><button className="handoff-button" disabled={detailBusy || !detail} onClick={beginHandoff}><Icon name="spark" size={15}/>交给 Codex<Icon name="arrow" size={12}/></button></div>
      </aside></>}
    </div>
    {draft && <dialog ref={draftRef} className="handoff-dialog" onCancel={e => { e.preventDefault(); if (!sending) setDraft(undefined); }}><div className="draft-heading"><h2>交给 Codex</h2><button className="icon-button" aria-label="关闭请求草稿" disabled={sending} onClick={() => setDraft(undefined)}><Icon name="close"/></button></div><p className="draft-target">{draft.context.selection.kind === 'working' ? '未提交修改' : draft.context.selection.kind === 'branch' ? '分支' : '提交'}<strong>{draft.context.label}</strong></p><label htmlFor="request-intent">你想让 Codex 做什么？</label><textarea id="request-intent" autoFocus rows={4} value={draft.intent} onChange={e => setDraft({ ...draft, intent: e.target.value })}/><details className="request-context"><summary>随请求附带的项目与 Git 上下文</summary><pre>{JSON.stringify(draft.context,null,2)}</pre></details>{detailError && <div className="error-banner" role="alert">{detailError}</div>}<div className="draft-footer"><button className="secondary" disabled={sending || !draft.intent.trim()} onClick={() => dispatch(true)}><Icon name="copy" size={14}/>复制请求</button>{canMessage() && <button className="primary" disabled={sending || !draft.intent.trim()} onClick={() => dispatch(false)}><Icon name="send" size={14}/>{sending ? '发送中…' : '发送到当前聊天'}</button>}</div></dialog>}
    {notice && <div className="toast" role="status"><Icon name="check" size={15}/>{notice}<button className="icon-button" aria-label="关闭提示" onClick={() => setNotice('')}><Icon name="close" size={13}/></button></div>}
    {busy && <div className="reading-indicator" aria-label="正在读取 Git"/>}
  </div>;
}
createRoot(document.getElementById('root')!).render(<Panel/>);
