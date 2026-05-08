import { getDialogueLine } from '../../dialogueConfig';
import { getMoeLine } from '../../scenario/scenarioLoader';
import { storyLogById } from '../../game/catalogs';
import type { PreviousRunSummary, ResultType, State, StoryLogId, StoryState } from '../../game/types';
import { getMainGunSpec, getSpecialEquipmentSpec, getSubGunSpec } from '../../game/runtimeHelpers';
import { applyRunUnlockRewards, formatUnlockRewardLog } from '../../game/progression';
import { applyWipeoutCarryback, formatWipeoutCarrybackLog, isWipeoutCarryback } from '../../game/carryback';
import { getRunStartResources, getStageProfile } from './stateRuntime';

export const makePreviousRunSummary = (state: State, resultType: ResultType): PreviousRunSummary => ({
  stage: state.stage,
  resultType,
  encountersCleared: state.runSummary.cleared,
  bossChallenged: state.bossChallenged,
  contractsAcquired: state.runSummary.contracted,
  salvageGained: state.salvageCredits,
  fuel: state.fuel,
  armor: state.armor,
  signal: state.signal,
  mainAmmo: state.mainAmmo,
  seAmmo: state.seAmmo,
});

export const getRunGrowth = (state: State) => {
  const isReturned = state.gamePhase === 'result';
  const driverXp = state.runSummary.cleared + ((state.resultType ?? 'Early Return') === 'Boss Cleared' ? 2 : 0);
  const moeSync = state.runSummary.contracted + state.analyzeSuccessCount;
  const salvageCreditGain = state.salvageCredits + (isReturned ? 1 : 0);
  const growth = { driverXp, moeSync, salvageCreditGain };
  return isWipeoutCarryback(state) ? applyWipeoutCarryback(growth) : growth;
};

export const getGarageStageAdvisory = (state: State, stage: number): string => {
  const profile = getStageProfile(stage);
  const main = getMainGunSpec(state.selectedLoadout.mainGunId);
  const sub = getSubGunSpec(state.selectedLoadout.subGunId);
  const se = getSpecialEquipmentSpec(state.selectedLoadout.specialEquipmentId);
  const preview = getRunStartResources(state.selectedLoadout, state.vehicleUpgrades);
  const firepowerScore = main.damage + Math.floor(main.ammo / 2) + sub.damage * 2 + se.damage;
  const survivabilityScore = preview.armor + preview.fuel + preview.signal + state.skillLevels.ram_control + state.skillLevels.scan_boost;
  const totalScore = firepowerScore + survivabilityScore;
  const recommended = profile.recommendedScore;
  if (totalScore < recommended - 5) {
    return `${profile.label}は今夜だと危険域。補給か改装を優先して、装備を一段上げよう。`;
  }
  if (totalScore < recommended) {
    return `${profile.label}は接戦域。突入は可能、でも弾薬とSignalの配分はかなりシビア。`;
  }
  return `${profile.label}は突入可能域。今の構成なら深層反応にも届く。`;
};

export const claimRunGrowthIfNeeded = (state: State): State => {
  if (state.growthClaimed || !(state.gamePhase === 'result' || state.gamePhase === 'game_over')) return state;
  const growth = getRunGrowth(state);
  const unlockRewards = applyRunUnlockRewards(state);
  const unlockLogs = unlockRewards.newlyUnlocked.map(formatUnlockRewardLog);
  const carrybackLogs = isWipeoutCarryback(state) ? [formatWipeoutCarrybackLog()] : [];
  return {
    ...state,
    driverXpBank: state.driverXpBank + growth.driverXp,
    moeSyncBank: state.moeSyncBank + growth.moeSync,
    creditBank: state.creditBank + growth.salvageCreditGain,
    unlocks: unlockRewards.unlocks,
    logs: [...state.logs, ...carrybackLogs, ...unlockLogs],
    growthClaimed: true,
  };
};

export const resolveStoryFromRun = (state: State, resultType: ResultType): StoryState => {
  const recovered = [...state.story.recoveredLogs];
  const newly: StoryLogId[] = [];
  const unlock = (id: StoryLogId) => {
    if (!recovered.includes(id)) {
      recovered.push(id);
      newly.push(id);
    }
  };

  if (resultType !== 'Vehicle Disabled') unlock('LOG_00');
  if (state.bossChallenged) unlock('LOG_01');
  if (state.bossChallenged && resultType !== 'Vehicle Disabled') unlock('LOG_02');
  if (state.contracts.some((module) => module.id === 'radio_voice')) unlock('LOG_03');
  if (state.contracts.some((module) => module.id === 'abandoned_ai_navi')) unlock('LOG_04');

  const chapter = recovered.length >= 4 ? 3 : recovered.length >= 2 ? 2 : 1;
  const clueBonus = newly.filter((id) => id === 'LOG_00' || id === 'LOG_01' || id === 'LOG_02').length;
  const memoryBonus = newly.filter((id) => id === 'LOG_04').length * 2 + newly.length;

  return {
    chapter,
    recoveredLogs: recovered,
    moeMemory: state.story.moeMemory + memoryBonus,
    previousDriverClues: state.story.previousDriverClues + clueBonus,
    recentRecoveredLogs: newly,
  };
};

export const getNarrativeMoeLine = (state: State): string => {
  if (state.gamePhase === 'prologue') {
    return getMoeLine(
      'prologue.open',
      getDialogueLine('moe.prologue.narrative', '午前0時。夜環、開いたよ。浅層サルベージ任務……ってことになってる。本命は、前任者のログ反応。まだ消えてない。'),
    );
  }
  if (state.story.recoveredLogs.includes('LOG_01') && state.gamePhase === 'boss_preview') {
    return getMoeLine(
      'boss_preview.toll_gate',
      getDialogueLine('moe.story.boss_preview_log01', '料金所の反応、前よりは読める。通行料を払う相手を間違えないで。'),
    );
  }
  if (state.story.recoveredLogs.includes('LOG_00') && state.gamePhase === 'garage') {
    return getMoeLine(
      'garage.after_log00',
      getDialogueLine('moe.story.after_log00', '前任者の声……記録には残ってない。でも、知ってる気がする。'),
    );
  }
  return state.moeLine;
};

export const appendRecoveredStoryLogLines = (logs: string[], story: StoryState): string[] => {
  if (story.recentRecoveredLogs.length === 0) return logs;
  const out = [...logs, '> STORY LOG RECOVERED'];
  for (const id of story.recentRecoveredLogs) {
    out.push(`> ${id}: ${storyLogById[id].title.toUpperCase()}`);
  }
  return out;
};
