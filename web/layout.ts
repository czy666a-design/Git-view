import type { Commit } from '../server/types.js';
export interface GraphRow { commit?: Commit; id: string; parents: string[]; working: boolean; lane: number }
export interface GraphEdge { from: number; to?: number; fromLane: number; toLane: number; parent: string; working: boolean }
export function layoutGraph(commits: Commit[], dirtyHead?: string) {
  const input: Omit<GraphRow,'lane'>[] = [];
  for (const commit of commits) {
    if (dirtyHead === commit.id) input.push({ id: 'working', parents: [commit.id], working: true });
    input.push({ id: commit.id, parents: commit.parents, working: false, commit });
  }
  const rows: GraphRow[] = []; const edges: GraphEdge[] = []; const active: (string|null)[] = [];
  const positions = new Map(input.map((row, index) => [row.id, index]));
  const vacant = () => { const index = active.indexOf(null); return index < 0 ? active.length : index; };
  let lanes = 1;
  input.forEach((row, index) => {
    let lane = active.indexOf(row.id); if (lane < 0) lane = vacant(); active[lane] = null;
    rows.push({ ...row, lane }); lanes = Math.max(lanes, lane+1);
    row.parents.forEach((parent, parentIndex) => {
      let parentLane = active.indexOf(parent);
      if (parentLane < 0) { parentLane = parentIndex === 0 && active[lane] === null ? lane : vacant(); active[parentLane] = parent; }
      lanes = Math.max(lanes, parentLane+1);
      edges.push({ from: index, to: positions.get(parent), fromLane: lane, toLane: parentLane, parent, working: row.working });
    });
  });
  return { rows, edges, lanes };
}
export function edgePath(edge: GraphEdge, rowHeight: number, height: number) {
  const x = 22 + edge.fromLane*22, targetX = 22 + edge.toLane*22;
  const y = edge.from*rowHeight + rowHeight/2, targetY = edge.to === undefined ? height-7 : edge.to*rowHeight + rowHeight/2;
  if (x === targetX) return `M${x} ${y}V${targetY}`;
  const bend = Math.min(targetY-y, rowHeight*.7);
  return `M${x} ${y}C${x} ${y+bend},${targetX} ${y+bend*.3},${targetX} ${y+bend}V${targetY}`;
}
export const laneColors = ['#ac83dc','#78b9a2','#dcad62','#77a8d2','#d78ba6','#9ca3da','#8bb671'];
