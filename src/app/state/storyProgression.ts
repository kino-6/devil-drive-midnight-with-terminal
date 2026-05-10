import { getDialogueLine } from '../../dialogueConfig';
import { getMoeLine as getScenarioMoeLine } from '../../scenario/scenarioLoader';
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
  const preview = getRunStartResources(state.selectedLoadout, state.vehicleUpgrades, state.skillLevels);
  const firepowerScore = main.damage + Math.floor(main.ammo / 2) + sub.damage * 2 + se.damage;
  const survivabilityScore = preview.armor + preview.fuel + preview.signal + state.skillLevels.ram_control + state.skillLevels.scan_boost;
  const totalScore = firepowerScore + survivabilityScore;
  const recommended = profile.recommendedScore;
  const stageNeeds: Record<number, {
    focus: string;
    fuel: number;
    armor: number;
    signal: number;
    mainAmmo: number;
    seAmmo: number;
  }> = {
    1: { focus: '入口ランプは接敵数が少なめ。Analyze/Talkで情報を取る余裕を作りたい。', fuel: 6, armor: 5, signal: 1, mainAmmo: 4, seAmmo: 0 },
    2: { focus: '高架分岐はSignal妨害と装甲削りが増える。進路情報を失うと判断が荒れる。', fuel: 8, armor: 8, signal: 2, mainAmmo: 7, seAmmo: 2 },
    3: { focus: '料金所外縁はToll Gate Saint封鎖へ近づく。主砲弾とS-Eを残して入りたい。', fuel: 10, armor: 10, signal: 3, mainAmmo: 9, seAmmo: 3 },
    4: { focus: '環状封鎖域は帰還判断が重い。燃料、装甲、Signalのどれかを切らすと戻りにくい。', fuel: 12, armor: 12, signal: 4, mainAmmo: 10, seAmmo: 4 },
  };
  const need = stageNeeds[stage] ?? stageNeeds[4];
  const shortages = [
    preview.fuel < need.fuel ? `Fuel ${preview.fuel}/${need.fuel}` : '',
    preview.armor < need.armor ? `Armor ${preview.armor}/${need.armor}` : '',
    preview.signal < need.signal ? `Signal ${preview.signal}/${need.signal}` : '',
    preview.mainAmmo < need.mainAmmo ? `Main ${preview.mainAmmo}/${need.mainAmmo}` : '',
    preview.seAmmo < need.seAmmo ? `S-E ${preview.seAmmo}/${need.seAmmo}` : '',
  ].filter(Boolean);
  const shortageText = shortages.length > 0 ? `不足: ${shortages.join(' / ')}。` : '主要資源は基準内。';
  if (totalScore < recommended - 5) {
    return `危険域 ${totalScore}/${recommended}。${need.focus} ${shortageText}`;
  }
  if (totalScore < recommended) {
    return `接戦域 ${totalScore}/${recommended}。${need.focus} ${shortageText}`;
  }
  return `突入可能 ${totalScore}/${recommended}。${need.focus} ${shortageText}`;
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
    return getScenarioMoeLine(
      'prologue.open',
      getDialogueLine('moe.prologue.narrative', '午前0時。夜環、開いたよ。浅層サルベージ任務……ってことになってる。本命は、前任者のログ反応。まだ消えてない。'),
    );
  }
  if (state.story.recoveredLogs.includes('LOG_01') && state.gamePhase === 'boss_preview') {
    return getScenarioMoeLine(
      'boss_preview.toll_gate',
      getDialogueLine('moe.story.boss_preview_log01', '料金所の反応、前よりは読める。通行料を払う相手を間違えないで。'),
    );
  }
  if (state.story.recoveredLogs.includes('LOG_00') && state.gamePhase === 'garage') {
    return getScenarioMoeLine(
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
