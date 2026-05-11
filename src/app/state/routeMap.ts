import type { StageRouteNode } from '../../stageConfig';
import type { State } from '../../game/types';
import {
  getCurrentStageRoute,
  getNaviRouteCandidates,
  getNaviRouteIntelStatus,
  getRouteBossSteps,
  getRouteStepLabel,
  type NaviIntelLevel,
  type NaviRouteCandidate,
  type NaviRouteIntelStatus,
  type RouteLaneChoice,
} from './routeGraph';

export type NaviRouteMapNodeStatus = 'current' | 'visited' | 'selectable' | 'preview' | 'hidden' | 'boss';

export type NaviRouteMapNode = {
  id: string;
  step: string;
  label: string;
  x: number;
  y: number;
  status: NaviRouteMapNodeStatus;
  title: string;
  masked: boolean;
  choiceId?: RouteLaneChoice;
  bossSteps?: number;
};

export type NaviRouteMapEdge = {
  id: string;
  from: string;
  to: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  status: 'visited' | 'selectable' | 'preview' | 'hidden';
};

export type NaviRouteMap = {
  currentNodeId: string;
  nodes: NaviRouteMapNode[];
  edges: NaviRouteMapEdge[];
  intelStatus: NaviRouteIntelStatus;
};

const getRouteMapChildren = (
  node: StageRouteNode,
  firstHopTargets?: Set<string>,
): string[] => {
  const rawChildren = [
    node.next,
    ...Object.values(node.choices ?? {}),
  ].filter((targetNodeId): targetNodeId is string => !!targetNodeId);
  const uniqueChildren = [...new Set(rawChildren)];
  return firstHopTargets && firstHopTargets.size > 0
    ? uniqueChildren.filter((targetNodeId) => firstHopTargets.has(targetNodeId))
    : uniqueChildren;
};

const getRouteMapRevealDepth = (intelLevel: NaviIntelLevel) => {
  if (intelLevel === 'high') return 5;
  if (intelLevel === 'medium') return 3;
  return 1;
};

const getRouteMapX = (index: number, count: number) => {
  if (count <= 1) return 50;
  const spacing = count === 2 ? 24 : count === 3 ? 20 : 16;
  return 50 - (spacing * (count - 1)) / 2 + spacing * index;
};

const routeMapNodeTitle = (
  node: StageRouteNode,
  candidateByNodeId: Map<string, NaviRouteCandidate>,
  masked: boolean,
) => {
  const candidate = candidateByNodeId.get(node.id);
  if (masked) return 'Signal masked route node';
  if (candidate) return `${candidate.title}: ${candidate.tags}`;
  return `${getRouteStepLabel(node)}: ${node.label}`;
};

export const getNaviRouteMap = (state: State, candidates = getNaviRouteCandidates(state)): NaviRouteMap | undefined => {
  const route = getCurrentStageRoute(state);
  const currentNodeId = state.routeState?.currentNodeId;
  const currentNode = currentNodeId ? route?.nodes[currentNodeId] : undefined;
  if (!route || !currentNodeId || !currentNode) return undefined;

  const intelStatus = getNaviRouteIntelStatus(state);
  const candidateByNodeId = new Map(candidates.map((candidate) => [candidate.nodeId, candidate]));
  const firstHopTargets = candidateByNodeId.size > 0 ? new Set(candidateByNodeId.keys()) : undefined;
  const revealDepth = getRouteMapRevealDepth(intelStatus.level);
  const maxDepth = 5;
  const levels = new Map<number, string[]>();
  const depthByNodeId = new Map<string, number>([[currentNodeId, 0]]);
  const edgePairs: Array<{ from: string; to: string }> = [];
  const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: currentNodeId, depth: 0 }];

  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) continue;
    const node = route.nodes[item.nodeId];
    if (!node || item.depth > maxDepth || node.type === 'result') continue;
    const level = levels.get(item.depth) ?? [];
    if (!level.includes(item.nodeId)) level.push(item.nodeId);
    levels.set(item.depth, level);

    const children = getRouteMapChildren(node, item.nodeId === currentNodeId ? firstHopTargets : undefined);
    for (const childNodeId of children) {
      const child = route.nodes[childNodeId];
      if (!child || child.type === 'result') continue;
      edgePairs.push({ from: item.nodeId, to: childNodeId });
      const nextDepth = item.depth + 1;
      const knownDepth = depthByNodeId.get(childNodeId);
      if (nextDepth <= maxDepth && (knownDepth === undefined || nextDepth < knownDepth)) {
        depthByNodeId.set(childNodeId, nextDepth);
        queue.push({ nodeId: childNodeId, depth: nextDepth });
      }
    }
  }

  const maxVisibleDepth = Math.max(1, ...Array.from(levels.keys()));
  const visitedNodeIds = new Set(state.routeState?.visitedNodeIds ?? []);
  const positionedNodes = new Map<string, NaviRouteMapNode>();

  for (const [depth, nodeIds] of Array.from(levels.entries()).sort(([a], [b]) => a - b)) {
    const y = 88 - (depth / maxVisibleDepth) * 74;
    nodeIds.forEach((nodeId, index) => {
      const node = route.nodes[nodeId];
      if (!node) return;
      const masked = depth > revealDepth && node.type !== 'boss';
      const candidate = candidateByNodeId.get(nodeId);
      const status: NaviRouteMapNodeStatus =
        nodeId === currentNodeId
          ? 'current'
          : candidate
            ? 'selectable'
            : visitedNodeIds.has(nodeId)
              ? 'visited'
              : masked
                ? 'hidden'
                : node.type === 'boss'
                  ? 'boss'
                  : 'preview';

      positionedNodes.set(nodeId, {
        id: nodeId,
        step: masked ? 'UNKNOWN' : getRouteStepLabel(node),
        label: masked ? '?' : node.label,
        x: getRouteMapX(index, nodeIds.length),
        y,
        status,
        title: routeMapNodeTitle(node, candidateByNodeId, masked),
        masked,
        choiceId: candidate?.choiceId,
        bossSteps: getRouteBossSteps(route, nodeId),
      });
    });
  }

  const edges = edgePairs.reduce<NaviRouteMapEdge[]>((out, pair) => {
    const from = positionedNodes.get(pair.from);
    const to = positionedNodes.get(pair.to);
    if (!from || !to) return out;
    const status = to.status === 'selectable'
      ? 'selectable'
      : to.status === 'hidden'
        ? 'hidden'
        : visitedNodeIds.has(pair.from) && visitedNodeIds.has(pair.to)
          ? 'visited'
          : 'preview';
    out.push({
      id: `${pair.from}-${pair.to}`,
      from: pair.from,
      to: pair.to,
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      status,
    });
    return out;
  }, []);

  return {
    currentNodeId,
    nodes: Array.from(positionedNodes.values()),
    edges,
    intelStatus,
  };
};
