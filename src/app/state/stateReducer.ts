import { limitStateLogs } from '../../runtimeLimits';
import { getMoeLine } from '../../game/moeDialogue';
import type { Action, AutoPlayReport, AutoPlayStrategy, Loadout, State } from '../../game/types';
import { isAlive } from '../../game/runtimeHelpers';
import { resolveExecuteCommand, resolveTalkChoice } from './combatReducer';
import { reduceApproach } from './approachReducer';
import { reduceGarage } from './garageReducer';
import { reduceRoute } from './routeReducer';
import { reduceRunLifecycle } from './runLifecycleReducer';
import { runAutoplayBatchWithDeps } from './stateAutoplay';
import { sanitizeRestoredStateWithDeps } from './stateRestore';
import {
  accumulateSummary,
  applyTalkTemperament,
  buildEncounter,
  buildForecast,
  canOpenContractWindow,
  damageVarianceByCommand,
  getAffinityTag,
  getContractHint,
  getIntelAffinityThreshold,
  getIntelRevealThreshold,
  getLikelyWeaknessSummary,
  getLogBadge,
  getPseudoTimecode,
  getRollBounds,
  getRunStartResources,
  getSelectedEnemy,
  getSkillCost,
  getStageProfile,
  getTalkTendencyFor,
  getVehicleUpgradeCost,
  hasAiNaviContract,
  initState,
  isBossProfile,
  makeEncounterReport,
  meetsContractCondition,
  nextIntent,
  pickSfxCueFromLog,
  resolveDamageBounds,
  resolveDamageRoll,
  stageProfiles,
  classifyLog,
} from './stateRuntime';
import {
  appendRecoveredStoryLogLines,
  getGarageStageAdvisory,
  getNarrativeMoeLine,
  getRunGrowth,
  resolveStoryFromRun,
} from './storyProgression';

export {
  classifyLog,
  getLogBadge,
  getPseudoTimecode,
  pickSfxCueFromLog,
  getRunStartResources,
  getSelectedEnemy,
  getSkillCost,
  getStageProfile,
  getVehicleUpgradeCost,
  getLikelyWeaknessSummary,
  getNarrativeMoeLine,
  getContractHint,
  isBossProfile,
  initState,
  stageProfiles,
  damageVarianceByCommand,
  getAffinityTag,
  getRollBounds,
  resolveDamageBounds,
  resolveDamageRoll,
  hasAiNaviContract,
  getGarageStageAdvisory,
  getRunGrowth,
};

export const runAutoplayBatch = (loadout: Loadout, runs: number, strategy: AutoPlayStrategy): AutoPlayReport =>
  runAutoplayBatchWithDeps(loadout, runs, strategy, { initState, reducer });

export const sanitizeRestoredState = (raw: unknown, fallback: State): State =>
  sanitizeRestoredStateWithDeps(raw, fallback, { initState, buildEncounter });

function reducerCore(state: State, action: Action): State {
  const reducedLifecycle = reduceRunLifecycle(state, action);
  if (reducedLifecycle !== state) return reducedLifecycle;

  const reducedGarage = reduceGarage(state, action);
  if (reducedGarage !== state) return reducedGarage;

  const reducedApproach = reduceApproach(state, action);
  if (reducedApproach !== state) return reducedApproach;

  const reducedRoute = reduceRoute(state, action);
  if (reducedRoute !== state) return reducedRoute;

  if (action.type === 'SELECT_ENEMY') {
    if (!(state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') || state.encounter.phase !== 'command') return state;
    const target = state.encounter.enemies.find((enemy) => enemy.id === action.enemyId && isAlive(enemy));
    if (!target) return state;
    return { ...state, encounter: { ...state.encounter, selectedEnemyId: action.enemyId } };
  }

  if (action.type === 'SELECT_COMMAND') {
    if (!(state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') || state.encounter.phase !== 'command') return state;
    return { ...state, encounter: { ...state.encounter, selectedCommand: action.command } };
  }

  if (action.type === 'TALK_CANCEL') {
    if (!(state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') || state.encounter.phase !== 'conversation') return state;
    return {
      ...state,
      activeConversation: undefined,
      encounter: { ...state.encounter, phase: 'command' },
      moeLine: getMoeLine('moe.dynamic.battle.idle', '次の手を選んで。'),
    };
  }

  if (action.type === 'TALK_CHOOSE') {
    return resolveTalkChoice(state, action, {
      canOpenContractWindow,
      buildForecast,
      hasAiNaviContract,
      nextIntent,
      makeEncounterReport,
      accumulateSummary,
    });
  }

  return resolveExecuteCommand(state, action, {
    getSelectedEnemy,
    damageVarianceByCommand,
    resolveDamageRoll,
    getAffinityTag,
    getIntelRevealThreshold,
    getIntelAffinityThreshold,
    canOpenContractWindow,
    getContractHint,
    applyTalkTemperament,
    getTalkTendencyFor,
    meetsContractCondition,
    nextIntent,
    makeEncounterReport,
    resolveStoryFromRun,
    appendRecoveredStoryLogLines,
    accumulateSummary,
    buildForecast,
    hasAiNaviContract,
  });
}

export function reducer(state: State, action: Action): State {
  const isBattlePhase = state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter';
  const aliveEnemyCount = isBattlePhase ? state.encounter.enemies.filter(isAlive).length : 0;

  const healedState: State = (() => {
    if (isBattlePhase && state.encounter.phase === 'conversation' && !state.activeConversation) {
      return {
        ...state,
        encounter: { ...state.encounter, phase: 'command' as const },
        logs: [...state.logs, '> TALK CHANNEL DESYNC: RETURN TO COMMAND'],
      };
    }

    if (isBattlePhase && state.encounter.phase === 'resolving') {
      return {
        ...state,
        encounter: { ...state.encounter, phase: 'command' as const },
        logs: [...state.logs, '> ENCOUNTER SYNC: RESOLVING->COMMAND'],
      };
    }

    if (
      isBattlePhase
      && state.encounter.phase !== 'conversation'
      && aliveEnemyCount <= 0
    ) {
      const toReturnGate = state.gamePhase === 'boss_encounter';
      return {
        ...state,
        gamePhase: toReturnGate ? 'return_gate' : 'reward',
        encounter: { ...state.encounter, phase: 'finished' as const },
        rewardScope: toReturnGate
          ? state.rewardScope
          : (state.encounter.kind === 'enc1' ? 'post_enc1' : 'post_enc2'),
        logs: [
          ...state.logs,
          '> ENCOUNTER SYNC: NO ACTIVE HOSTILES',
          toReturnGate ? '> RETURN GATE ROUTE OPEN' : '> SALVAGE RESULT READY',
        ],
        moeLine: toReturnGate
          ? getMoeLine('moe.run.return_gate_seen', '帰還ゲート、見えた。まだ車は動くね。', undefined, 'soft')
          : getMoeLine('moe.run.encounter_clear', '遭遇クリア。次の判断に備えよう。'),
      };
    }

    return state;
  })();

  const next = reducerCore(healedState, action);
  if (next.logs === state.logs) return next;
  const trimmed = limitStateLogs(next.logs);
  if (trimmed.length === next.logs.length) return next;
  return { ...next, logs: trimmed };
}
