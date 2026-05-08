import { getEventsByPool } from '../../eventConfig';
import { getStageConfig, isStageConfigRuntimeLoaded, type StageDefinition, type StageRouteNode } from '../../stageConfig';
import type { RouteState, State } from '../../game/types';

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

  return {
    ...state,
    routeState: {
      stageRouteId: route.id,
      currentNodeId: nodeId,
      visitedNodeIds,
      currentEventId: pickEventIdForNode(node),
    },
  };
};

export const getRouteChoiceTargetNodeId = (state: State, choiceId: string): string | undefined =>
  getStageRouteNode(state)?.choices?.[choiceId];

export const getRouteNextNodeId = (state: State): string | undefined =>
  getStageRouteNode(state)?.next;
