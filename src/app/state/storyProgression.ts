import { getDialogueLine } from '../../dialogueConfig';
import { getMoeLine as getScenarioMoeLine } from '../../scenario/scenarioLoader';
import type { State } from '../../game/types';
import { getMainGunSpec, getSpecialEquipmentSpec, getSubGunSpec } from '../../game/runtimeHelpers';
import { getRunStartResources, getStageProfile } from './stateRuntime';

export {
  appendRecoveredStoryLogLines,
  claimRunGrowthIfNeeded,
  getRunGrowth,
  makePreviousRunSummary,
  resolveStoryFromRun,
} from '../../game/runProgression';

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
    3: { focus: '深層関門はToll Gate Saint封鎖へ近づく。主砲弾とS-Eを残して入りたい。', fuel: 10, armor: 10, signal: 3, mainAmmo: 9, seAmmo: 3 },
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
      getDialogueLine('moe.story.boss_preview_log01', '深層関門の反応、前よりは読める。通行料を払う相手を間違えないで。'),
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
