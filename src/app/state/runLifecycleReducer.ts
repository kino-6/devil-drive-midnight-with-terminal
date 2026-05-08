import type { Action, State } from '../../game/types';
import { appendSupportDaemonDisconnectLogs } from '../../game/runtimeHelpers';
import { getMoeLine } from '../../game/moeDialogue';
import { initState } from './stateRuntime';
import { claimRunGrowthIfNeeded, makePreviousRunSummary } from './storyProgression';

const getGarageEntryMoeLine = (isFirstGarageEntry: boolean) =>
  isFirstGarageEntry
    ? getMoeLine('moe.garage.first_enter', 'Midnight Bay Garage、初回起動。装備とStageを確認しよう。', undefined, 'soft')
    : getMoeLine('moe.garage.enter', '戻れたね。次は出る前に少し積み替えよっか。', undefined, 'soft');

export function reduceRunLifecycle(state: State, action: Action): State {
  if (action.type === 'DEBUG_RESTORE') {
    return action.snapshot;
  }

  if (action.type === 'RETRY') {
    const claimed = claimRunGrowthIfNeeded(state);
    const fresh = initState();
    return {
      ...fresh,
      gamePhase: 'prologue',
      selectedLoadout: claimed.selectedLoadout,
      story: claimed.story,
      skillLevels: claimed.skillLevels,
      vehicleUpgrades: claimed.vehicleUpgrades,
      unlocks: claimed.unlocks,
      driverXpBank: claimed.driverXpBank,
      moeSyncBank: claimed.moeSyncBank,
      creditBank: claimed.creditBank,
    };
  }

  if (action.type === 'START_NEXT_RUN') {
    if (!(state.gamePhase === 'result' || state.gamePhase === 'game_over')) return state;
    const claimed = claimRunGrowthIfNeeded(state);
    const nextStage = claimed.resultType === 'Boss Cleared' ? 1 : claimed.stage;
    const disconnectLogs = appendSupportDaemonDisconnectLogs(
      claimed.logs,
      claimed.activeSupportDaemon,
      claimed.gamePhase === 'result' ? 'return_gate' : 'archive',
    );
    return {
      ...claimed,
      gamePhase: 'garage',
      stage: nextStage,
      activeSupportDaemon: undefined,
      previousRun: makePreviousRunSummary(claimed, claimed.resultType ?? 'Early Return'),
      logs: [...disconnectLogs, '> GARAGE: MIDNIGHT BAY ONLINE'],
      moeLine: getMoeLine('moe.garage.enter', '戻れたね。次は出る前に少し積み替えよっか。', undefined, 'soft'),
    };
  }

  if (action.type === 'OPEN_GARAGE') {
    if (!(state.gamePhase === 'prologue' || state.gamePhase === 'result' || state.gamePhase === 'game_over' || state.gamePhase === 'garage')) return state;
    const isFirstGarageEntry = state.gamePhase === 'prologue' && !state.previousRun;
    const claimed = claimRunGrowthIfNeeded(state);
    const previousRun = claimed.gamePhase === 'result' || claimed.gamePhase === 'game_over'
      ? makePreviousRunSummary(claimed, claimed.resultType ?? 'Early Return')
      : claimed.previousRun;
    const disconnectLogs = appendSupportDaemonDisconnectLogs(
      claimed.logs,
      claimed.activeSupportDaemon,
      claimed.gamePhase === 'result' ? 'return_gate' : 'archive',
    );
    return {
      ...claimed,
      gamePhase: 'garage',
      activeSupportDaemon: undefined,
      previousRun,
      logs: [...disconnectLogs, '> GARAGE: MIDNIGHT BAY ONLINE'],
      moeLine: getGarageEntryMoeLine(isFirstGarageEntry),
    };
  }

  return state;
}
