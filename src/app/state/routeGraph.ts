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
  note: string;
  forecast: string[];
  bossSteps?: number;
  effects?: string;
  eventId?: string;
  resourceWarning?: string;
  intelLevel: NaviIntelLevel;
};

export type NaviRouteBriefing = {
  title: string;
  body?: string;
  effects?: string;
  eventId?: string;
  intelLevel: NaviIntelLevel;
};

export type NaviRouteIntelStatus = {
  level: NaviIntelLevel;
  label: string;
  detail: string;
  isLimited: boolean;
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
  const events = getEventsByPool(node.eventPool);
  if (events.length === 0) return undefined;
  const totalWeight = events.reduce((sum, event) => sum + Math.max(0, event.weight || 0), 0);
  if (totalWeight <= 0) return events[Math.floor(Math.random() * events.length)]?.id;
  let roll = Math.random() * totalWeight;
  for (const event of events) {
    roll -= Math.max(0, event.weight || 0);
    if (roll <= 0) return event.id;
  }
  return events[events.length - 1]?.id;
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
    risk: 'minor route risk',
    reward: 'resource pick',
  },
  signal: {
    tags: 'signal / analyze',
    risk: 'noise exposure',
    reward: 'forecast boost',
  },
  push_forward: {
    tags: 'contact / speed',
    risk: 'contact risk',
    reward: 'boss closer',
  },
  return_gate: {
    tags: 'extract / safe',
    risk: 'low',
    reward: 'secure',
  },
};

const getNaviIntelScore = (state: State) => {
  const supportBonus = state.selectedLoadout.contractSupportId === 'abandoned_ai_navi' ? 1 : 0;
  const contractBonus = state.contracts.some((contract) => contract.id === 'abandoned_ai_navi') ? 1 : 0;
  return state.signal + state.skillLevels.scan_boost + supportBonus + contractBonus;
};

const getRouteCandidateNote = (state: State, choiceId: RouteLaneChoice, intelLevel: NaviIntelLevel): string => {
  if (intelLevel === 'low') {
    return state.signal <= 0
      ? 'Signal 0: details masked. Take Signal or Salvage to restore planning.'
      : 'Low Signal: exact reward/risk partly masked.';
  }
  if (choiceId === 'salvage') return 'Pick one resource before the lane closes.';
  if (choiceId === 'signal') return 'Restores Signal and improves the next forecast.';
  if (choiceId === 'push_forward') {
    if (state.armor <= 3) return 'Armor low: contact can become fatal.';
    if (state.fuel <= 2) return 'Fuel low: return options narrow after this.';
    return 'Skip recovery for faster boss progress.';
  }
  if (choiceId === 'return_gate') {
    return state.routeState?.lastReturnCheckpointId
      ? 'Backtrack to checkpoint, then extract safely.'
      : 'No checkpoint yet: return route may be unstable.';
  }
  return 'Route effect readable.';
};

const getRouteResourceWarning = (
  state: State,
  choiceId: RouteLaneChoice,
  intelLevel: NaviIntelLevel,
): string | undefined => {
  if (state.signal <= 0 && intelLevel === 'low') return 'SIGNAL LOST: reward masked';
  if (choiceId === 'signal' && state.signal <= 1) return 'SIGNAL LOW: forecast recovery';
  if (choiceId === 'salvage') {
    if (state.fuel <= 3) return 'FUEL LOW: recovery recommended';
    if (state.armor <= 4) return 'ARMOR LOW: repair recommended';
    if (state.signal <= 1) return 'SIGNAL LOW: restore before Analyze/Talk';
    if (state.mainAmmo <= 2) return 'MAIN AMMO LOW: resupply useful';
    if (state.seAmmo <= 1) return 'S-E AMMO LOW: utility options thin';
  }
  if (choiceId === 'push_forward') {
    if (state.armor <= 3) return 'ARMOR LOW: contact risk high';
    if (state.fuel <= 2) return 'FUEL LOW: backtrack margin thin';
    if (state.signal <= 0) return 'SIGNAL LOST: next route blind';
  }
  if (choiceId === 'return_gate' && !state.routeState?.lastReturnCheckpointId) {
    return 'RETURN POINT NOT REACHED';
  }
  return undefined;
};

export const getNaviIntelLevel = (state: State): NaviIntelLevel => {
  const score = getNaviIntelScore(state);
  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
};

export const getNaviRouteIntelStatus = (state: State): NaviRouteIntelStatus => {
  const level = getNaviIntelLevel(state);
  if (level === 'high') {
    return {
      level,
      label: 'NAVI CLEAR',
      detail: 'Route tags, risks, rewards, and effects readable.',
      isLimited: false,
    };
  }
  if (level === 'medium') {
    return {
      level,
      label: 'SIGNAL PARTIAL',
      detail: 'Reward detail is masked. Higher Signal improves forecast.',
      isLimited: true,
    };
  }
  return {
    level,
    label: state.signal <= 0 ? 'SIGNAL LOST' : 'SIGNAL WEAK',
    detail: state.signal <= 0
      ? 'Reward masked: Signal is 0. Recover Signal or use NAVI support.'
      : 'Route detail masked: Signal/Scan support is too low.',
    isLimited: true,
  };
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

const routeStepLabel = (node: StageRouteNode): string => {
  if (node.type === 'encounter') return 'CONTACT';
  if (node.type === 'salvage') return 'SUPPLY';
  if (node.type === 'signal') return 'SIGNAL';
  if (node.type === 'boss_preview') return 'BOSS GATE';
  if (node.type === 'boss') return 'BOSS';
  if (node.type === 'return_gate' || node.type === 'extract') return 'EXTRACT';
  if (node.type === 'route_choice') return 'FORK';
  if (node.type === 'return_checkpoint') return 'CHECKPOINT';
  return node.label.toUpperCase();
};

const preferredNextNodeId = (node: StageRouteNode): string | undefined => {
  if (node.next) return node.next;
  if (!node.choices) return undefined;
  return node.choices.challenge
    ?? node.choices.push_forward
    ?? node.choices.signal
    ?? node.choices.salvage
    ?? Object.entries(node.choices).find(([choice]) => choice !== 'return_gate')?.[1]
    ?? Object.values(node.choices)[0];
};

const getRouteForecast = (route: StageDefinition, startNodeId: string, limit = 3): string[] => {
  const out: string[] = [];
  const visited = new Set<string>();
  let nodeId: string | undefined = startNodeId;
  while (nodeId && out.length < limit && !visited.has(nodeId)) {
    visited.add(nodeId);
    const node = route.nodes[nodeId];
    if (!node) break;
    out.push(routeStepLabel(node));
    nodeId = preferredNextNodeId(node);
  }
  return out;
};

const getBossSteps = (route: StageDefinition, startNodeId: string): number | undefined => {
  const queue: Array<{ nodeId: string; steps: number }> = [{ nodeId: startNodeId, steps: 1 }];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.nodeId)) continue;
    visited.add(current.nodeId);
    const node = route.nodes[current.nodeId];
    if (!node) continue;
    if (node.type === 'boss') return current.steps;
    const nextNodeIds = [
      node.next,
      ...Object.entries(node.choices ?? {})
        .filter(([choice]) => choice !== 'return_gate')
        .map(([, targetNodeId]) => targetNodeId),
    ].filter((targetNodeId): targetNodeId is string => !!targetNodeId);
    for (const nextNodeId of nextNodeIds) {
      if (!visited.has(nextNodeId)) queue.push({ nodeId: nextNodeId, steps: current.steps + 1 });
    }
  }
  return undefined;
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
  const route = getCurrentStageRoute(state);
  if (!currentNode?.choices) return [];
  if (!route) return [];

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
      note: getRouteCandidateNote(state, choiceId, intelLevel),
      forecast: getRouteForecast(route, nodeId),
      bossSteps: getBossSteps(route, nodeId),
      effects: intelLevel === 'high' ? event.effects : undefined,
      eventId: event.id,
      resourceWarning: getRouteResourceWarning(state, choiceId, intelLevel),
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
        note: getRouteCandidateNote(state, lane, intelLevel),
        forecast: getRouteForecast(route, nodeId),
        bossSteps: getBossSteps(route, nodeId),
        resourceWarning: getRouteResourceWarning(state, lane, intelLevel),
        intelLevel,
      };
    });
};
