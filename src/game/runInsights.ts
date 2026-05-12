import type { RunRecord } from '../saveSystem';
import type { State } from './types';
import { isWipeoutCarryback } from './carryback';

export const resultLabel = (value?: string) => value ?? 'Unknown';

export const buildMoeRunComment = (record: RunRecord): string => {
  const { fuel, armor, signal } = record.finalResources;
  if (armor <= 0) {
    return 'Armor lost. Next: Guard timing or Armor reward.';
  }
  if (fuel <= 0) {
    return 'Fuel lost. Next: shorter lane or earlier Return.';
  }
  if (signal <= 0) {
    return 'Signal lost. Next: fewer reads or Signal reward.';
  }
  if (record.analyzedEnemies.length === 0) {
    return 'No Analyze. Next: read one target early.';
  }
  if (record.contractsAcquired.length === 0 && record.analyzedEnemies.length > 0) {
    return 'No Contract. Next: try Talk window.';
  }
  if (!record.bossChallenged) {
    return 'Boss avoided. Next: enter with Fuel/Armor margin.';
  }
  if (record.bossCleared) {
    return 'Boss clear. Next: contract route or memory logs.';
  }
  if (record.returnGateUsed) {
    return 'Return complete. Next: one lane deeper.';
  }
  return 'Run logged. Tune weakest resource.';
};

export const buildResultDecisionLines = (state: State): string[] => {
  const returnLine = (() => {
    if (state.funTestMode) return `Fun Test: ${state.funTestMode.label}`;
    if (state.resultType === 'Boss Cleared') return 'Extract: Boss toll clear';
    if (isWipeoutCarryback(state)) return 'Carryback: Partial growth';
    if (state.routeState?.returnIntent === 'backtracking') return 'Backtrack: Checkpoint reacquired';
    if (state.resultType === 'Early Return' || state.resultType === 'Boss Avoided') {
      return 'Extract: Growth secured';
    }
    return 'Risk End: No Return Point';
  })();

  const signalLine = (() => {
    if (state.signal <= 0) return 'Signal 0: Reads constrained';
    if (state.signal <= 2) return 'Signal Low: Forecast narrow';
    return 'Signal OK: Reads available';
  })();

  const talkBreakCount = state.logs.filter((log) => log.includes('TALK BREAK: ACTION SHIFT')).length;
  const actionReadableCount = state.logs.filter((log) => log.includes('ACTION READABLE')).length;
  const actionLine = talkBreakCount > 0
    ? `Talk Break x${talkBreakCount}: Action shifted`
    : actionReadableCount > 0
      ? `Action Read x${actionReadableCount}: Target window`
      : 'Action Read: None';

  return [returnLine, signalLine, actionLine];
};
