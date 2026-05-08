import { getEventById, getEventsByPool } from '../../eventConfig';
import { routeIntelCatalog } from '../../game/catalogs';
import { getStageConfig, isStageConfigRuntimeLoaded, type StageDefinition, type StageRouteNode } from '../../stageConfig';
import type { RouteState, State } from '../../game/types';

type RouteLaneChoice = 'salvage' | 'signal' | 'push_forward' | 'return_gate';

export type NaviIntelLevel = 'low' | 'medium' | 'high';

export type NaviRouteCandidate = {
  choiceId: RouteLaneChoice;
  nodeId: string;
  title: string;
  body?: string;
  tags: string;
  risk: string;
  reward: string;
  effects?: string;
  eventId?: string;
  intelLevel: NaviIntelLevel;
};

export type NaviRouteBriefing = {
  title: string;
  body?: string;
  effects?: string;
  eventId?: string;
  intelLevel: NaviIntelLevel;
};

const stageRouteIdForStage = (stage: number) => `stage_${stage}`;

export const getActiveStageRoute = (stage: number): StageDefinition | undefined => {
  if (!isStageConfigRuntimeLoaded()) return undefined;
  if (stage !== 1) return undefined;
  return getStageConfig().stages[stageRouteIdForStage(stage)];
};

const getCurrentStageRoute = (state: State): StageDefinition | undefined => {
  const routeId = state.routeState?.stageRouteId ?? stageRouteIdForStage(state.stage);
  const route = getActiveStageRoute(state.stage);
  return route?.id === routeId ? route : undefined;
};

export const getStageRouteNode = (state: State, nodeId = state.routeState?.currentNodeId): StageRouteNode | undefined => {
  if (!nodeId) return undefined;
  return getCurrentStageRoute(state)?.nodes[nodeId];
};

const pickEventIdForNode = (node?: StageRouteNode): string | undefined => {
  if (!node?.eventPool) return undefined;
  return getEventsByPool(node.eventPool)[0]?.id;
};

export const initRouteStateForStage = (stage: number): RouteState | undefined => {
  const route = getActiveStageRoute(stage);
  if (!route) return undefined;
  const entryNode = route.nodes[route.entryNode];
  return {
    stageRouteId: route.id,
    currentNodeId: route.entryNode,
    visitedNodeIds: [route.entryNode],
    currentEventId: pickEventIdForNode(entryNode),
  };
};

export const moveRouteStateToNode = (state: State, nodeId: string): State => {
  const route = getCurrentStageRoute(state);
  const node = route?.nodes[nodeId];
  if (!route || !node) return state;

  const current = state.routeState ?? initRouteStateForStage(state.stage);
  const visitedNodeIds = current?.visitedNodeIds.includes(nodeId)
    ? current.visitedNodeIds
    : [...(current?.visitedNodeIds ?? []), nodeId];
  const isReturnCheckpoint = node.returnCheckpoint || node.type === 'return_checkpoint';

  return {
    ...state,
    routeState: {
      stageRouteId: route.id,
      currentNodeId: nodeId,
      visitedNodeIds,
      currentEventId: pickEventIdForNode(node),
      lastReturnCheckpointId: isReturnCheckpoint ? nodeId : current?.lastReturnCheckpointId,
      returnIntent: current?.returnIntent ?? 'none',
    },
  };
};

export const getRouteChoiceTargetNodeId = (state: State, choiceId: string): string | undefined =>
  getStageRouteNode(state)?.choices?.[choiceId];

export const getRouteNextNodeId = (state: State): string | undefined =>
  getStageRouteNode(state)?.next;

const isRouteLaneChoice = (value: string): value is RouteLaneChoice =>
  value === 'salvage' || value === 'signal' || value === 'push_forward' || value === 'return_gate';

const lowSignalRouteHints: Record<RouteLaneChoice, { tags: string; risk: string; reward: string }> = {
  salvage: {
    tags: 'supply / repair',
    risk: 'armor?',
    reward: 'fuel / ammo?',
  },
  signal: {
    tags: 'signal / analyze',
    risk: 'signal?',
    reward: 'intel?',
  },
  push_forward: {
    tags: 'contact / speed',
    risk: 'armor!',
    reward: 'progress+',
  },
  return_gate: {
    tags: 'extract / safe',
    risk: 'low',
    reward: 'secure',
  },
};

export const getNaviIntelLevel = (state: State): NaviIntelLevel => {
  const supportBonus = state.selectedLoadout.contractSupportId === 'abandoned_ai_navi' ? 1 : 0;
  const contractBonus = state.contracts.some((contract) => contract.id === 'abandoned_ai_navi') ? 1 : 0;
  const score = state.signal + state.skillLevels.scan_boost + supportBonus + contractBonus;
  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
};

const maskIntel = (
  value: string,
  intelLevel: NaviIntelLevel,
  revealAt: NaviIntelLevel,
  lowFallback: string,
): string => {
  if (intelLevel === 'high') return value;
  if (intelLevel === 'medium' && revealAt !== 'high') return value;
  if (intelLevel === 'medium') return lowFallback;
  return lowFallback;
};

export const getCurrentNaviRouteBriefing = (state: State): NaviRouteBriefing | undefined => {
  const currentEvent = getEventById(state.routeState?.currentEventId);
  if (!currentEvent) return undefined;
  const intelLevel = getNaviIntelLevel(state);
  return {
    title: currentEvent.title,
    body: intelLevel === 'low' ? undefined : currentEvent.body,
    effects: intelLevel === 'high' ? currentEvent.effects : undefined,
    eventId: currentEvent.id,
    intelLevel,
  };
};

export const getNaviRouteCandidates = (state: State): NaviRouteCandidate[] => {
  const currentNode = getStageRouteNode(state);
  if (!currentNode?.choices) return [];

  const intelLevel = getNaviIntelLevel(state);
  const events = currentNode.eventPool ? getEventsByPool(currentNode.eventPool) : [];
  const fromEvents = events.reduce<NaviRouteCandidate[]>((out, event) => {
    const choiceId = event.routeChoice ?? '';
    if (!isRouteLaneChoice(choiceId)) return out;
    const nodeId = currentNode.choices?.[choiceId];
    if (!nodeId) return out;
    const intel = routeIntelCatalog[choiceId];
    out.push({
      choiceId,
      nodeId,
      title: event.title || intel.label,
      body: intelLevel === 'low' ? undefined : event.body,
      tags: maskIntel(event.tags.join(' / '), intelLevel, 'medium', lowSignalRouteHints[choiceId].tags),
      risk: maskIntel(intel.riskTags, intelLevel, 'medium', lowSignalRouteHints[choiceId].risk),
      reward: maskIntel(intel.rewardTags, intelLevel, 'high', lowSignalRouteHints[choiceId].reward),
      effects: intelLevel === 'high' ? event.effects : undefined,
      eventId: event.id,
      intelLevel,
    });
    return out;
  }, []);

  if (fromEvents.length > 0) return fromEvents.slice(0, 3);

  return Object.entries(currentNode.choices)
    .filter(([choiceId]) => isRouteLaneChoice(choiceId))
    .slice(0, 3)
    .map(([choiceId, nodeId]) => {
      const lane = choiceId as RouteLaneChoice;
      const intel = routeIntelCatalog[lane];
      return {
        choiceId: lane,
        nodeId,
        title: intel.label,
        tags: maskIntel(intel.likelyEnemyTags, intelLevel, 'medium', lowSignalRouteHints[lane].tags),
        risk: maskIntel(intel.riskTags, intelLevel, 'medium', lowSignalRouteHints[lane].risk),
        reward: maskIntel(intel.rewardTags, intelLevel, 'high', lowSignalRouteHints[lane].reward),
        intelLevel,
      };
    });
};
