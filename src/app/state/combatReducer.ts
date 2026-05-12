import { getBalanceConfig } from '../../balanceConfig';
import { getConversationLine, getConversationLineWithVars } from '../../conversationConfig';
import { getDialogueLine } from '../../dialogueConfig';
import { getMoeLine } from '../../game/moeDialogue';
import { getEncounterScenario, getScenarioLine } from '../../scenario/scenarioLoader';
import { affinityLabel, affinityOrder, contractModules } from '../../game/catalogs';
import { buildTalkConversation } from '../../game/talkRules';
import {
  appendSupportDaemonDisconnectLogs,
  clamp,
  getMainGunSpec,
  isEnemyIdentityKnown,
  getSpecialEquipmentSpec,
  getSubGunSpec,
  isAlive,
  makeActiveSupportDaemon,
  supportDaemonLinkFlavorLogs,
} from '../../game/runtimeHelpers';
import { getVehicleUpgradeUtilityEffects } from '../../game/vehicleUpgrades';
import type { Action, AffinityType, ConversationEffect, Devil, EncounterState, ResultType, State } from '../../game/types';

export const resolveExecuteCommand = (state: State, action: Action, deps: any): State => {
  const {
    getSelectedEnemy,
    damageVarianceByCommand,
    resolveDamageRoll,
    getAffinityTag,
    getIntelRevealThreshold,
    getIntelAffinityThreshold,
    canOpenContractWindow,
    getContractHint,
    meetsContractCondition,
    nextIntent,
    makeEncounterReport,
    resolveStoryFromRun,
    appendRecoveredStoryLogLines,
    accumulateSummary,
    buildForecast,
    hasAiNaviContract,
  } = deps;

if (action.type !== 'EXECUTE_COMMAND' || !(state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') || state.encounter.phase !== 'command') return state;

const encounter: EncounterState = {
  ...state.encounter,
  enemies: state.encounter.enemies.map((enemy) => ({ ...enemy })),
  analyzedEnemyIds: [...state.encounter.analyzedEnemyIds],
  phase: 'resolving',
};
const command = action.command ?? encounter.selectedCommand;
encounter.selectedCommand = command;
const selectedEnemy = getSelectedEnemy(encounter);
const logs = [...state.logs];
let fuel = state.fuel;
let armor = state.armor;
let signal = state.signal;
let mainAmmo = state.mainAmmo;
let seAmmo = state.seAmmo;
let contracts = [...state.contracts];
let activeSupportDaemon = state.activeSupportDaemon;
let activeConversation = state.activeConversation;
let negotiationRewards = [...state.negotiationRewards];
let moeSyncBank = state.moeSyncBank;
let story = { ...state.story, recoveredLogs: [...state.story.recoveredLogs], recentRecoveredLogs: [...state.story.recentRecoveredLogs] };
let salvageCredits = state.salvageCredits;
let analyzeSuccessCount = state.analyzeSuccessCount;
let tempForecastBoost = state.tempForecastBoost;
const encounterPrep = { ...state.encounterPrep };
const maxFuelCap = getBalanceConfig().resources.baseFuel + state.vehicleUpgrades.fuel_tank;
const maxArmorCap = getBalanceConfig().resources.baseArmor + state.vehicleUpgrades.armor_plating;
const maxSignalCap = getBalanceConfig().resources.baseSignal;
let moeLine = getMoeLine('moe.dynamic.battle.idle', '次の手を選んで。');
let skipEnemyResolution = false;
let escaped = false;
const addNegotiationReward = (reward: string) => {
  if (!negotiationRewards.includes(reward)) negotiationRewards.push(reward);
};
const selectedMainGun = getMainGunSpec(state.selectedLoadout.mainGunId);
const selectedSubGun = getSubGunSpec(state.selectedLoadout.subGunId);
const selectedSE = getSpecialEquipmentSpec(state.selectedLoadout.specialEquipmentId);
const vehicleUtility = getVehicleUpgradeUtilityEffects(state.vehicleUpgrades);
const getMoeTargetName = (enemy: Devil) =>
  isEnemyIdentityKnown(enemy, encounter.analyzedEnemyIds)
    ? enemy.name
    : 'Unknown Sign';
const logAffinityReaction = (enemy: Devil, affinityType: AffinityType) => {
  const rating = enemy.affinities[affinityType];
  if (rating === 'weak') {
    logs.push(`> WEAK POINT DETECTED: ${affinityType.toUpperCase()}`);
  } else if (rating === 'resist') {
    logs.push(`> RESISTED: ${affinityType.toUpperCase()}`);
  }
  return rating;
};
const applyContractBoon = (enemy: Devil) => {
  const hasRadioVoiceModule = contracts.some((module) => module.id === 'radio_voice');
  const hasSilentShapeModule = contracts.some((module) => module.id === 'silent_shape');
  const hasAiNaviModule = contracts.some((module) => module.id === 'abandoned_ai_navi');
  const aiNaviSupportActive =
    activeSupportDaemon?.profile === 'abandoned_ai_navi'
    || state.selectedLoadout.contractSupportId === 'abandoned_ai_navi';

  if (aiNaviSupportActive || hasAiNaviModule || enemy.temperament === 'machine') {
    tempForecastBoost += 1;
    logs.push(`> ${getConversationLine('contract.boon.forecast', 'CONTRACT BOON: FORECAST +1')}`);
    return;
  }
  if ((hasRadioVoiceModule || enemy.temperament === 'curious') && signal < maxSignalCap) {
    signal = Math.max(0, signal + 1);
    logs.push(`> ${getConversationLine('contract.boon.signal', 'CONTRACT BOON: SIGNAL +1')}`);
    return;
  }
  if ((hasSilentShapeModule || enemy.targetModuleId === 'silent_shape') && armor < maxArmorCap) {
    armor = Math.max(0, armor + 1);
    logs.push(`> ${getConversationLine('contract.boon.armor', 'CONTRACT BOON: ARMOR +1')}`);
    return;
  }
  if (enemy.targetModuleId === 'silent_shape') {
    encounter.supportArmorGuardReady = true;
    logs.push(`> ${getConversationLine('contract.boon.guard', 'CONTRACT BOON: NEXT IMPACT -1')}`);
    return;
  }
  if (enemy.temperament === 'hungry') {
    fuel = Math.min(maxFuelCap, Math.max(0, fuel + 1));
    logs.push(`> ${getConversationLine('contract.boon.fuel', 'CONTRACT BOON: FUEL +1')}`);
    return;
  }
  if (enemy.temperament === 'proud' || enemy.temperament === 'hostile') {
    armor = Math.min(maxArmorCap, Math.max(0, armor + 1));
    logs.push(`> ${getConversationLine('contract.boon.armor', 'CONTRACT BOON: ARMOR +1')}`);
    return;
  }
  signal = Math.min(maxSignalCap, Math.max(0, signal + 1));
  logs.push(`> ${getConversationLine('contract.boon.signal', 'CONTRACT BOON: SIGNAL +1')}`);
};
const applyIntelGain = (enemyIndex: number, gain: number, source: 'analyze' | 'combat' | 'defeat' | 'talk') => {
  const enemy = encounter.enemies[enemyIndex];
  if (!enemy || gain <= 0) return;
  const before = enemy.intelProgress;
  enemy.intelProgress = Math.min(enemy.intelThreshold, enemy.intelProgress + gain);
  const after = enemy.intelProgress;
  if (after <= before) return;
  const revealThreshold = getIntelRevealThreshold(enemy.intelThreshold);
  const actionThreshold = enemy.profile === 'toll_gate_saint'
    ? Math.floor(enemy.intelThreshold * 0.45)
    : revealThreshold;
  const affinityThreshold = getIntelAffinityThreshold(enemy.intelThreshold);
  const wasIdentityKnown = enemy.revealed || before >= revealThreshold || encounter.analyzedEnemyIds.includes(enemy.id);
  const wasActionReadable = before >= actionThreshold || encounter.analyzedEnemyIds.includes(enemy.id);
  const wasAffinityReadable = enemy.affinityRevealed || before >= affinityThreshold || encounter.analyzedEnemyIds.includes(enemy.id);
  const wasFullyAnalyzed = before >= enemy.intelThreshold || encounter.analyzedEnemyIds.includes(enemy.id);
  const progressLabel = wasIdentityKnown ? enemy.name.toUpperCase() : 'UNKNOWN SIGN';
  if (source === 'analyze') {
    logs.push(`> ANALYZE PROGRESS: ${progressLabel} ${after}/${enemy.intelThreshold}`);
  }
  if (!enemy.revealed && after >= revealThreshold) {
    enemy.revealed = true;
    logs.push(`> IDENTITY DECODED: ${enemy.name.toUpperCase()}`);
  }
  if (!wasActionReadable && after >= actionThreshold) {
    logs.push('> ACTION READABLE: NEXT INTENT VISIBLE');
  }
  if (after >= affinityThreshold) {
    if (!enemy.affinityRevealed) enemy.affinityRevealed = true;
    if (!wasAffinityReadable) logs.push('> WEAKNESS DECODED: AFFINITY MAP VISIBLE');
  }
  if (after >= enemy.intelThreshold) {
    encounter.analyzedEnemyIds = Array.from(new Set([...encounter.analyzedEnemyIds, enemy.id]));
    if (!wasFullyAnalyzed) logs.push('> FULL ANALYZE COMPLETE: TACTIC CONFIRMED');
  }
};
const consumeTalkBreak = (enemy: Devil) => {
  if ((enemy.talkBreakTurns ?? 0) <= 0) return 0;
  enemy.talkBreakTurns = Math.max(0, (enemy.talkBreakTurns ?? 0) - 1);
  logs.push('> TALK BREAK HIT: DAMAGE +1');
  return 1;
};

logs.push(`> COMMAND: ${command.toUpperCase()}${selectedEnemy ? ` / ${getMoeTargetName(selectedEnemy).toUpperCase()}` : ''}`);

if (command === 'main_gun' && selectedEnemy && mainAmmo > 0) {
  const idx = encounter.enemies.findIndex((enemy) => enemy.id === selectedEnemy.id);
  if (idx >= 0) {
    mainAmmo -= 1;
    const shield = encounter.enemies[idx].guardStacks > 0 ? 1 : 0;
    const talkBreakBonus = consumeTalkBreak(encounter.enemies[idx]);
    const affinity = logAffinityReaction(encounter.enemies[idx], 'ballistic');
    const gunRoll = resolveDamageRoll({
      baseDamage: selectedMainGun.damage + state.skillLevels.gunnery,
      affinity,
      variance: damageVarianceByCommand.main_gun,
      flatReduction: shield - talkBreakBonus,
      armored: !!encounter.enemies[idx].armored,
    });
    const damage = gunRoll.damage;
    encounter.enemies[idx].hp = Math.max(0, encounter.enemies[idx].hp - damage);
    encounter.enemies[idx].guardStacks = Math.max(0, encounter.enemies[idx].guardStacks - 1);
    encounter.enemies[idx].pressure += 1;
    applyIntelGain(idx, 8, 'combat');
    if (selectedMainGun.effect === 'intel') {
      applyIntelGain(idx, 14, 'combat');
      encounter.enemies[idx].analyzeVulnerableTurns = Math.max(1, encounter.enemies[idx].analyzeVulnerableTurns ?? 0);
      logs.push('> NEEDLE TELEMETRY: INTEL LOCK DEEPENED');
    }
    if (selectedMainGun.effect === 'contract' && isEnemyIdentityKnown(encounter.enemies[idx], encounter.analyzedEnemyIds)) {
      encounter.enemies[idx].interest += 1;
      if (canOpenContractWindow(encounter.enemies[idx])) {
        encounter.enemies[idx].contractWindow = true;
        logs.push('> SIGIL DRIVER: CONTRACT WINDOW PARTIAL OPEN');
      }
    }
    if (affinity === 'resist') {
      encounter.enemies[idx].pressure += 1;
      encounter.enemies[idx].contractWindow = false;
    }
    encounter.enemies[idx].trust = Math.max(0, encounter.enemies[idx].trust - 1);
    encounter.enemies[idx].contractWindow = false;
    logs.push(`> MAIN GUN: ${selectedMainGun.name.toUpperCase()} / TARGET: ${encounter.enemies[idx].name.toUpperCase()}`);
    logs.push(`> IMPACT CONFIRMED: ${damage} DAMAGE (PRED ${gunRoll.min}-${gunRoll.max})`);
    const targetName = getMoeTargetName(encounter.enemies[idx]);
    moeLine = affinity === 'weak'
      ? getConversationLineWithVars('moe.dynamic.battle.main_gun.weak', { target: targetName })
      : affinity === 'resist'
        ? getConversationLineWithVars('moe.dynamic.battle.main_gun.resist', { target: targetName })
        : getConversationLineWithVars('moe.dynamic.battle.main_gun.normal', { target: targetName });
    if (encounter.enemies[idx].profile === 'road_reaper' && affinity === 'weak') {
      encounter.enemies[idx].intent = 'guard';
      encounter.enemies[idx].analyzeVulnerableTurns = Math.max(1, encounter.enemies[idx].analyzeVulnerableTurns ?? 0);
      logs.push('> MAIN GUN IMPACT: WARNING BATON BROKEN');
      logs.push('> ENEMY INTENT DISRUPTED');
      logs.push('> ACTION RESULT: Road Reaper weak point hit. Next intent disrupted.');
      moeLine = '通った。標識の制御、割れてる。';
    }
    if (encounter.enemies[idx].hp <= 0 && !encounter.enemies[idx].exit) {
      applyIntelGain(idx, 28, 'defeat');
      encounter.enemies[idx].exit = 'defeated';
      salvageCredits += 1;
      logs.push(`> TARGET DOWN: ${encounter.enemies[idx].name.toUpperCase()} / SALVAGE +1`);
    }
  }
}

if (command === 'sub_gun') {
  logs.push(`> SUB GUN: ${selectedSubGun.name.toUpperCase()}`);
  let weakHits = 0;
  let resistHits = 0;
  const applySubHit = (enemyIndex: number) => {
    if (!isAlive(encounter.enemies[enemyIndex])) return;
    const affinity = logAffinityReaction(encounter.enemies[enemyIndex], 'suppressive');
    const shield = encounter.enemies[enemyIndex].guardStacks > 0 ? 1 : 0;
    const talkBreakBonus = consumeTalkBreak(encounter.enemies[enemyIndex]);
    const subRoll = resolveDamageRoll({
      baseDamage: selectedSubGun.damage,
      affinity,
      variance: damageVarianceByCommand.sub_gun,
      flatReduction: shield - talkBreakBonus,
      armored: !!encounter.enemies[enemyIndex].armored,
    });
    const damage = subRoll.damage;
    encounter.enemies[enemyIndex].hp = Math.max(0, encounter.enemies[enemyIndex].hp - damage);
    encounter.enemies[enemyIndex].guardStacks = Math.max(0, encounter.enemies[enemyIndex].guardStacks - 1);
    if (selectedSubGun.pressureMode === 'cool') {
      encounter.enemies[enemyIndex].pressure = Math.max(0, encounter.enemies[enemyIndex].pressure - 1);
      encounter.enemies[enemyIndex].interest += 1;
    } else {
      encounter.enemies[enemyIndex].pressure += 1;
    }
    applyIntelGain(enemyIndex, 4, 'combat');
    if (affinity === 'weak') weakHits += 1;
    if (affinity === 'resist') {
      resistHits += 1;
      encounter.enemies[enemyIndex].pressure += 1;
      encounter.enemies[enemyIndex].contractWindow = false;
    }
    if (selectedSubGun.softenChance && Math.random() < selectedSubGun.softenChance && encounter.enemies[enemyIndex].intent === 'attack') {
      encounter.enemies[enemyIndex].intent = 'guard';
    }
    if (encounter.enemies[enemyIndex].hp <= 0 && !encounter.enemies[enemyIndex].exit) {
      applyIntelGain(enemyIndex, 28, 'defeat');
      encounter.enemies[enemyIndex].exit = 'defeated';
      salvageCredits += 1;
    }
  };

  if (selectedSubGun.mode === 'all') {
    for (let i = 0; i < encounter.enemies.length; i += 1) applySubHit(i);
    logs.push('> MULTI TARGET HIT');
  } else {
    const hits = selectedSubGun.hits ?? 2;
    for (let i = 0; i < hits; i += 1) {
      const aliveTargets = encounter.enemies.map((enemy, idx) => ({ enemy, idx })).filter(({ enemy }) => isAlive(enemy));
      if (aliveTargets.length === 0) break;
      const pick = aliveTargets[Math.floor(Math.random() * aliveTargets.length)];
      applySubHit(pick.idx);
    }
    logs.push(`> RANDOM HIT x${hits}`);
  }
  if (resistHits > weakHits && resistHits > 0) {
    moeLine = getMoeLine('moe.dynamic.battle.sub_gun.resist', '副砲制圧。効きが浅い。相性が悪い。');
  } else if (weakHits > 0) {
    moeLine = getMoeLine('moe.dynamic.battle.sub_gun.weak', '副砲制圧。刺さってる。崩せるよ。');
  } else {
    moeLine = selectedSubGun.id === 'suppression_mg'
      ? getMoeLine('moe.dynamic.battle.sub_gun.suppress', '副砲制圧。攻勢が鈍るかも。')
      : getMoeLine('moe.dynamic.battle.sub_gun.normal', '副砲制圧。足止めにはなる。');
  }
}

if (command === 'se_harpoon' && selectedEnemy && seAmmo >= selectedSE.seAmmoCost) {
  const idx = encounter.enemies.findIndex((enemy) => enemy.id === selectedEnemy.id);
  if (idx >= 0) {
    seAmmo -= selectedSE.seAmmoCost;
    logs.push(`> S-E: ${selectedSE.name.toUpperCase()} FIRED`);
    if (selectedSE.effect === 'all_damage') {
      for (let i = 0; i < encounter.enemies.length; i += 1) {
        if (!isAlive(encounter.enemies[i])) continue;
        const affinity = logAffinityReaction(encounter.enemies[i], 'signal');
        const guardShield = encounter.enemies[i].guardStacks > 0 ? 1 : 0;
        const talkBreakBonus = consumeTalkBreak(encounter.enemies[i]);
        const aoeRoll = resolveDamageRoll({
          baseDamage: selectedSE.damage,
          affinity,
          variance: damageVarianceByCommand.se_harpoon,
          flatReduction: guardShield - talkBreakBonus,
          armored: !!encounter.enemies[i].armored,
        });
        const aoeDamage = aoeRoll.damage;
        encounter.enemies[i].hp = Math.max(0, encounter.enemies[i].hp - aoeDamage);
        encounter.enemies[i].guardStacks = Math.max(0, encounter.enemies[i].guardStacks - 1);
        encounter.enemies[i].pressure += 1;
        applyIntelGain(i, 6, 'combat');
        if (affinity === 'weak') {
          encounter.enemies[i].interest += 1;
          if (canOpenContractWindow(encounter.enemies[i])) encounter.enemies[i].contractWindow = true;
        }
        if (affinity === 'resist') {
          encounter.enemies[i].pressure += 1;
          encounter.enemies[i].contractWindow = false;
        }
        if (encounter.enemies[i].hp <= 0 && !encounter.enemies[i].exit) {
          applyIntelGain(i, 28, 'defeat');
          encounter.enemies[i].exit = 'defeated';
          salvageCredits += 1;
        }
      }
      logs.push('> MICRO MISSILE SALVO: ALL TARGETS');
      moeLine = getMoeLine('moe.dynamic.battle.se.all_damage', 'S-E発射。制圧寄りにまとめて焼いた。');
    } else {
      const affinity = logAffinityReaction(encounter.enemies[idx], 'signal');
      const shield = encounter.enemies[idx].guardStacks > 0 ? 1 : 0;
      const talkBreakBonus = consumeTalkBreak(encounter.enemies[idx]);
      const seRoll = resolveDamageRoll({
        baseDamage: selectedSE.damage,
        affinity,
        variance: damageVarianceByCommand.se_harpoon,
        flatReduction: shield - talkBreakBonus,
      });
      const adjustedDamage = seRoll.damage;
      encounter.enemies[idx].hp = Math.max(0, encounter.enemies[idx].hp - adjustedDamage);
      encounter.enemies[idx].guardStacks = Math.max(0, encounter.enemies[idx].guardStacks - 1);
      const intelGain = selectedSE.effect === 'analyze_lock' ? 38 : 10;
      applyIntelGain(idx, intelGain, selectedSE.effect === 'analyze_lock' ? 'analyze' : 'combat');
      if (selectedSE.effect === 'interest') {
        encounter.enemies[idx].interest += 1 + (affinity === 'weak' ? 1 : 0);
        if (encounter.enemies[idx].temperament === 'machine' || encounter.enemies[idx].temperament === 'curious') encounter.enemies[idx].interest += 1;
        if (affinity === 'resist') {
          encounter.enemies[idx].pressure += 1;
          encounter.enemies[idx].contractWindow = false;
        }
        if (canOpenContractWindow(encounter.enemies[idx])) encounter.enemies[idx].contractWindow = true;
        logs.push('> ENTITY SIGNATURE PINNED');
        logs.push(`> SIGNAL EFFECT: ${getAffinityTag(affinity)}`);
        if (encounter.enemies[idx].contractWindow) logs.push('> CONTRACT WINDOW: PARTIAL OPEN');
        const targetName = getMoeTargetName(encounter.enemies[idx]);
        moeLine = affinity === 'weak'
          ? getConversationLineWithVars('moe.dynamic.battle.se.interest.weak', { target: targetName })
          : affinity === 'resist'
            ? getConversationLineWithVars('moe.dynamic.battle.se.interest.resist', { target: targetName })
            : getConversationLineWithVars('moe.dynamic.battle.se.interest.normal', { target: targetName });
      } else if (selectedSE.effect === 'analyze_lock') {
        encounter.enemies[idx].revealed = true;
        encounter.enemies[idx].analyzeVulnerableTurns = Math.max(2, encounter.enemies[idx].analyzeVulnerableTurns ?? 0);
        logs.push('> SCAN BEACON: SIGNATURE LOCK EXTENDED');
        if (encounter.enemies[idx].affinityRevealed) logs.push('> SCAN BEACON: AFFINITY MAP STABILIZED');
        moeLine = getMoeLine('moe.dynamic.battle.analyze.success', '{target}の解析完了。気質と相性を掴んだ。交渉の順番を合わせよう。', {
          target: getMoeTargetName(encounter.enemies[idx]),
        }, 'proud');
      } else if (selectedSE.effect === 'contract_window') {
        encounter.enemies[idx].interest += 2 + (affinity === 'weak' ? 1 : 0);
        encounter.enemies[idx].trust += affinity === 'resist' ? 0 : 1;
        if (affinity === 'resist') {
          encounter.enemies[idx].pressure += 1;
          encounter.enemies[idx].contractWindow = false;
        } else {
          encounter.enemies[idx].contractWindow = canOpenContractWindow(encounter.enemies[idx]);
        }
        logs.push('> BINDING FLARE: CONTRACT SEAL TEST');
        if (encounter.enemies[idx].contractWindow) logs.push('> CONTRACT WINDOW: FORCED OPEN');
        moeLine = getConversationLineWithVars('moe.dynamic.battle.se.interest.normal', {
          target: getMoeTargetName(encounter.enemies[idx]),
        });
      } else if (selectedSE.effect === 'boss_breaker') {
        if (encounter.enemies[idx].profile === 'toll_gate_saint') {
          const anchorDamage = 2 + state.skillLevels.scan_boost;
          encounter.enemies[idx].hp = Math.max(0, encounter.enemies[idx].hp - anchorDamage);
          encounter.enemies[idx].empDisabledTurns = Math.max(encounter.enemies[idx].empDisabledTurns, 1);
          logs.push(`> SAINT ANCHOR: BOSS SIGNAL DAMAGE +${anchorDamage}`);
          logs.push('> SAINT ANCHOR: NEXT INTENT STAGGERED');
        } else {
          encounter.enemies[idx].interest += 1;
          logs.push('> SAINT ANCHOR: SIGNAL PIN LIGHT RESPONSE');
        }
        moeLine = getConversationLineWithVars('moe.dynamic.battle.se.emp', {
          target: getMoeTargetName(encounter.enemies[idx]),
        });
      } else if (selectedSE.effect === 'emp') {
        if (encounter.enemies[idx].temperament === 'machine' || encounter.enemies[idx].profile === 'abandoned_ai_navi') {
          encounter.enemies[idx].empDisabledTurns = 1;
          logs.push('> EMP LOCK: NEXT INTENT DISABLED');
        } else {
          logs.push('> EMP BURST: NO MACHINE RESPONSE');
        }
        moeLine = getConversationLineWithVars('moe.dynamic.battle.se.emp', {
          target: getMoeTargetName(encounter.enemies[idx]),
        });
      }
      if (affinity === 'resist' && selectedSE.effect !== 'interest') {
        encounter.enemies[idx].pressure += 1;
      }
      if (encounter.enemies[idx].hp <= 0 && !encounter.enemies[idx].exit) {
        applyIntelGain(idx, 28, 'defeat');
        encounter.enemies[idx].exit = 'defeated';
        salvageCredits += 1;
      }
    }
  }
}

if (command === 'analyze' && selectedEnemy) {
  if (signal <= 0) {
    logs.push('> WARNING: SIGNAL TOO LOW FOR SCAN');
    moeLine = getMoeLine('moe.dynamic.battle.signal_low', 'Signalが足りない。', undefined, 'serious');
  } else {
    signal -= 1;
    let analyzedTarget: Devil | undefined;
    const idx = encounter.enemies.findIndex((enemy) => enemy.id === selectedEnemy.id);
    if (idx >= 0) {
      applyIntelGain(idx, 55 + vehicleUtility.analyzeIntelBonus, 'analyze');
      analyzedTarget = encounter.enemies[idx];
      analyzedTarget.analyzeVulnerableTurns = Math.max(1, analyzedTarget.analyzeVulnerableTurns ?? 0);
      logs.push(`> ${getConversationLine('analyze.boon.damage_reduction.applied', '解析ロック成立。次の攻勢を1段鈍化できる。')}`);
      if (analyzedTarget.affinityRevealed) {
        for (const affinity of affinityOrder) {
          logs.push(`> AFFINITY ${affinityLabel[affinity].toUpperCase()}: ${analyzedTarget.affinities[affinity].toUpperCase()}`);
        }
      }
    }
    logs.push('> SIGNATURE SCAN COMPLETE');
    if (analyzedTarget?.revealed) {
      logs.push(`> TEMPERAMENT: ${analyzedTarget.temperament.toUpperCase()}`);
    }
    if (analyzedTarget?.affinityRevealed) {
      logs.push(`> CONTRACT HINT: ${getContractHint(analyzedTarget).toUpperCase()}`);
    }
    analyzeSuccessCount += 1;
    moeLine = getMoeLine('moe.dynamic.battle.analyze.success', '{target}の解析完了。気質と相性を掴んだ。交渉の順番を合わせよう。', {
      target: getMoeTargetName(selectedEnemy),
    }, 'proud');
    if (analyzedTarget?.profile === 'pixie_shibuya_glow') {
      moeLine = '撃つより話す方が早い。信号の光、見てるよ。';
    } else if (analyzedTarget?.profile === 'road_reaper') {
      moeLine = 'Talkは通りにくい。主砲、使うなら今。';
    } else if (analyzedTarget?.profile === 'toll_gate_saint') {
      moeLine = 'Fuelで通るか、Signalで交渉するか、主砲で割るか。どれも正解にはできる。';
    }
  }
}

if (command === 'talk' && selectedEnemy) {
  const idx = encounter.enemies.findIndex((enemy) => enemy.id === selectedEnemy.id);
  if (idx >= 0) {
    const targetName = getMoeTargetName(encounter.enemies[idx]);
    if (!isEnemyIdentityKnown(encounter.enemies[idx], encounter.analyzedEnemyIds)) {
      encounter.phase = 'command';
      logs.push('> TALK CHANNEL LOCKED: UNKNOWN SIGN');
      moeLine = getMoeLine('moe.dynamic.battle.talk.locked_unknown', '相手の輪郭がまだ取れてない。先にAnalyzeで署名を掴もう。', {
        target: targetName,
      }, 'serious');
      return {
        ...state,
        fuel,
        armor,
        signal,
        mainAmmo,
        seAmmo,
        contracts,
        activeSupportDaemon,
        activeConversation,
        negotiationRewards,
        tempForecastBoost,
        moeSyncBank,
        story,
        salvageCredits,
        logs,
        encounterPrep,
        analyzeSuccessCount,
        moeLine,
        encounter,
      };
    }
    const profile = buildTalkConversation({
      target: encounter.enemies[idx],
      analyzed: isEnemyIdentityKnown(encounter.enemies[idx], encounter.analyzedEnemyIds),
      state: {
        fuel,
        armor,
        signal,
        mainAmmo,
        seAmmo,
        salvageCredits,
      },
    });
    activeConversation = {
      enemyId: encounter.enemies[idx].id,
      enemyProfile: encounter.enemies[idx].profile,
      introLine: profile.introLine,
      choices: profile.choices.slice(0, 3),
      mood: profile.mood,
      persona: profile.persona,
      demand: profile.demand,
      seed: profile.seed,
    };
    logs.push(`> TALK CHANNEL OPEN: ${targetName.toUpperCase()}`);
    const scenarioTalkLine = getScenarioLine(getEncounterScenario(encounter.enemies[idx].profile)?.talk?.curious);
    if (scenarioTalkLine) logs.push(`> ${scenarioTalkLine}`);
    encounter.phase = 'conversation';
    moeLine = encounter.enemies[idx].profile === 'pixie_shibuya_glow'
      ? getMoeLine('moe.dynamic.battle.talk.pixie_hint', '好奇心で近づいてる。怖がらせないで。', undefined, 'soft')
      : getMoeLine('moe.dynamic.battle.talk.success.normal', '会話に乗った。反応を見て選んで。', {
        target: targetName,
      });
    return {
      ...state,
      fuel,
      armor,
      signal,
      mainAmmo,
      seAmmo,
      contracts,
      activeSupportDaemon,
      activeConversation,
      negotiationRewards,
      tempForecastBoost,
      moeSyncBank,
      story,
      salvageCredits,
      logs,
      encounterPrep,
      analyzeSuccessCount,
      moeLine,
      encounter,
    };
  }
}

if (command === 'contract' && selectedEnemy) {
  const idx = encounter.enemies.findIndex((enemy) => enemy.id === selectedEnemy.id);
  if (idx >= 0) {
    const target = encounter.enemies[idx];
    if (!target.contractable || !target.contractWindow) {
      logs.push('> CONTRACT REJECTED: NO CONTRACT WINDOW');
      moeLine = getMoeLine('moe.dynamic.battle.contract.no_window', '{target}へ契約試行。契約窓が未開放。TalkかS-Eを先に。', {
        target: getMoeTargetName(target),
      }, 'serious');
    } else if (!meetsContractCondition(target)) {
      logs.push('> CONTRACT REJECTED: CONDITION NOT MET');
      target.contractWindow = false;
      if (Math.random() < 0.5 && signal > 0) {
        signal -= 1;
        logs.push('> SIGNAL -1');
      } else {
        armor = Math.max(0, armor - 1);
        logs.push('> ARMOR -1');
      }
      moeLine = getMoeLine('moe.dynamic.battle.contract.condition_fail', '{target}へ契約失敗。条件不足。反動が来る。', {
        target: getMoeTargetName(target),
      }, 'flustered');
    } else {
      const contractCfg = getBalanceConfig().contract;
      const analyzedBonus = isEnemyIdentityKnown(target, encounter.analyzedEnemyIds) ? contractCfg.analyzeBonus : 0;
      const baseSuccess = target.profile === 'toll_gate_saint' ? contractCfg.bossBaseSuccess : contractCfg.normalBaseSuccess;
      const funTestContractBonus = state.funTestMode ? 0.18 : 0;
      const successRate = clamp(
        baseSuccess + analyzedBonus + funTestContractBonus - target.pressure * contractCfg.pressurePenaltyPerStack,
        contractCfg.minSuccess,
        contractCfg.maxSuccess,
      );
      logs.push(`> CONTRACT PROTOCOL START: ${target.name.toUpperCase()}`);
      if (Math.random() < successRate) {
        const contractDisplayName = target.profile === 'pixie_shibuya_glow'
          ? 'PIXIE LINK'
          : target.profile === 'toll_gate_saint'
            ? 'TOLL BLESSING'
            : target.name.toUpperCase();
        logs.push('> CONTRACT PROTOCOL ACCEPTED');
        logs.push('> ENTITY SIGNATURE CAPTURED');
        if (target.targetModuleId && !contracts.some((module) => module.id === target.targetModuleId)) {
          contracts = [...contracts, contractModules[target.targetModuleId]];
          logs.push(`> MODULE SLOT UPDATED: ${contractDisplayName}`);
        }
        if (target.profile === 'toll_gate_saint') logs.push('> TOLL TOKEN ACCEPTED');
        logs.push(`> CONTRACT REGISTERED: ${contractDisplayName}`);
        if (target.temperament === 'machine') logs.push(`> ${getDialogueLine('run.milestone.contract_machine', 'DEMON MILESTONE: MACHINE CONTRACT')}`);
        if (target.temperament === 'lonely') logs.push(`> ${getDialogueLine('run.milestone.contract_lonely', 'DEMON MILESTONE: LONELY CONTRACT')}`);
        const contractSuccessLine = getScenarioLine(getEncounterScenario(target.profile)?.contract?.success);
        if (contractSuccessLine) logs.push(`> ${contractSuccessLine}`);
        if (target.profile === 'pixie_shibuya_glow') {
          logs.push('> PIXIE LINK: NEXT TALK SUCCESS +15%');
          logs.push('> PIXIE LINK: APPROACH SCAN +5%');
          addNegotiationReward('Pixie Link: Talk +15% / Scan +5%');
        }
        if (target.profile === 'toll_gate_saint') {
          logs.push('> TOLL BLESSING: SALVAGE CLAIM +1');
          addNegotiationReward('Toll Blessing acquired');
        }
        applyContractBoon(target);
        logs.push(`> ${getConversationLine('contract.success.default', '契約成立。短期恩恵を受領した。')}`);
        activeSupportDaemon = makeActiveSupportDaemon(target);
        logs.push(`> SUPPORT DAEMON LINKED: ${target.name.toUpperCase()} // ${activeSupportDaemon.effectLabel.toUpperCase()}`);
        logs.push(`> ${supportDaemonLinkFlavorLogs()[activeSupportDaemon.profile]}`);
        encounter.enemies[idx].hp = 0;
        encounter.enemies[idx].contractWindow = false;
        encounter.enemies[idx].exit = 'contracted';
        if (activeSupportDaemon.profile === 'silent_shape') {
          encounter.supportArmorGuardReady = true;
        }
        moeLine = target.profile === 'pixie_shibuya_glow'
          ? getMoeLine('moe.dynamic.battle.contract.pixie_link', '契約できる。……この子、車内ライトに住む気かも。', undefined, 'soft')
          : target.profile === 'toll_gate_saint'
            ? getMoeLine('moe.dynamic.battle.contract.toll_blessing', '契約成立。……通行許可じゃなくて、徴収権を積んだのかも。', undefined, 'serious')
            : getMoeLine('moe.dynamic.battle.contract.support_linked', 'Support daemon accepted. I will monitor corruption drift.');
      } else {
        encounter.enemies[idx].contractWindow = false;
        logs.push('> CONTRACT FAILED: SIGNAL REJECTED');
        if (Math.random() < 0.5 && signal > 0) {
          signal -= 1;
          logs.push('> SIGNAL -1');
        } else {
          armor = Math.max(0, armor - 1);
          logs.push('> ARMOR -1');
        }
        moeLine = getMoeLine('moe.dynamic.battle.contract.reject', '{target}へ契約失敗。拒否された。まだ早い。', {
          target: getMoeTargetName(target),
        }, 'flustered');
      }
    }
  }
}

if (command === 'ram' && selectedEnemy && armor > 0) {
  const idx = encounter.enemies.findIndex((enemy) => enemy.id === selectedEnemy.id);
  if (idx >= 0) {
    armor = Math.max(0, armor - 1);
    const ramBase = encounter.enemies[idx].intent === 'guard' ? 2 : 3;
    const affinity = logAffinityReaction(encounter.enemies[idx], 'impact');
    const shield = encounter.enemies[idx].guardStacks > 0 ? 1 : 0;
    const talkBreakBonus = consumeTalkBreak(encounter.enemies[idx]);
    const ramRoll = resolveDamageRoll({
      baseDamage: ramBase,
      affinity,
      variance: damageVarianceByCommand.ram,
      flatReduction: shield - talkBreakBonus,
      armored: !!encounter.enemies[idx].armored,
    });
    const damage = ramRoll.damage;
    encounter.enemies[idx].hp = Math.max(0, encounter.enemies[idx].hp - damage);
    encounter.enemies[idx].guardStacks = Math.max(0, encounter.enemies[idx].guardStacks - 1);
    encounter.enemies[idx].pressure += 2;
    applyIntelGain(idx, 10, 'combat');
    if (affinity === 'resist') encounter.enemies[idx].pressure += 1;
    encounter.enemies[idx].contractWindow = false;
    encounter.guardActive = false;
    logs.push('> DRIVE COMMAND: RAM');
    logs.push('> CHASSIS IMPACT CONFIRMED');
    logs.push(`> RAM DAMAGE: ${damage} (PRED ${ramRoll.min}-${ramRoll.max})`);
    logs.push('> ARMOR -1');
    const targetName = getMoeTargetName(encounter.enemies[idx]);
    moeLine = affinity === 'weak'
      ? getConversationLineWithVars('moe.dynamic.battle.ram.weak', { target: targetName })
      : affinity === 'resist'
        ? getConversationLineWithVars('moe.dynamic.battle.ram.resist', { target: targetName })
        : getConversationLineWithVars('moe.dynamic.battle.ram.normal', { target: targetName });
    if (encounter.enemies[idx].hp <= 0 && !encounter.enemies[idx].exit) {
      applyIntelGain(idx, 28, 'defeat');
      encounter.enemies[idx].exit = 'defeated';
      salvageCredits += 1;
    }
  }
}

if (command === 'guard') {
  encounter.guardActive = true;
  logs.push('> DEFENSIVE POSTURE LOCKED');
  moeLine = getMoeLine('moe.dynamic.battle.guard', '防御姿勢、固定。次の被弾を抑える。');
}

if (command === 'escape' && fuel > 0) {
  fuel = Math.max(0, fuel - 1);
  const reaperLike = encounter.enemies.some((enemy) => isAlive(enemy) && (enemy.profile === 'road_reaper' || enemy.profile === 'toll_gate_saint'));
  const escapeCfg = getBalanceConfig().escape;
  const successRate = reaperLike ? Math.max(0.01, escapeCfg.baseChance - escapeCfg.reaperPenalty) : escapeCfg.baseChance;
  logs.push('> DRIVE COMMAND: ESCAPE');
  logs.push('> THROTTLE OVERRIDE');
  if (Math.random() < successRate) {
    logs.push('> ESCAPE ROUTE FOUND');
    escaped = true;
    skipEnemyResolution = true;
    moeLine = getMoeLine('moe.dynamic.battle.escape.success', '離脱。ルート確保。接触を切った。', undefined, 'soft');
  } else {
    logs.push('> ESCAPE FAILED');
    moeLine = getMoeLine('moe.dynamic.battle.escape.fail', '離脱失敗。受ける準備して。', undefined, 'flustered');
  }
}

if (!skipEnemyResolution) {
  let guardBudget = encounter.guardActive ? 2 : 0;
  for (const enemy of encounter.enemies.filter(isAlive)) {
    const enemyIdx = encounter.enemies.findIndex((d) => d.id === enemy.id);
    const enemyState = enemyIdx >= 0 ? encounter.enemies[enemyIdx] : enemy;
    const enemyIntent = enemy.empDisabledTurns > 0 ? 'guard' : enemy.intent;
    logs.push(`> ENEMY INTENT: ${enemy.name.toUpperCase()} -> ${enemyIntent.toUpperCase()}`);
    if (enemy.empDisabledTurns > 0) logs.push('> EMP DISRUPTION: INTENT JAMMED');
    if (enemyIntent === 'attack') {
      let damage = 2;
      if ((enemyState.analyzeVulnerableTurns ?? 0) > 0) {
        damage = Math.max(0, damage - 1);
        enemyState.analyzeVulnerableTurns = Math.max(0, (enemyState.analyzeVulnerableTurns ?? 0) - 1);
        logs.push(`> ${getConversationLine('analyze.boon.damage_reduction.attack', 'ANALYZE LOCK: IMPACT -1')}`);
      }
      if (guardBudget > 0) {
        const reduced = Math.min(guardBudget, damage);
        damage -= reduced;
        guardBudget -= reduced;
      }
      if (encounter.supportArmorGuardReady && damage > 0) {
        damage = Math.max(0, damage - 1);
        encounter.supportArmorGuardReady = false;
        logs.push('> SUPPORT SHIELD: SILENT SHAPE ABSORBED 1');
      }
      if (damage > 0) {
        armor = Math.max(0, armor - damage);
        logs.push(`> ARMOR -${damage}`);
      } else logs.push('> GUARD ABSORBED IMPACT');
    } else if (enemyIntent === 'curse') {
      let sigDamage = 1;
      if ((enemyState.analyzeVulnerableTurns ?? 0) > 0) {
        sigDamage = Math.max(0, sigDamage - 1);
        enemyState.analyzeVulnerableTurns = Math.max(0, (enemyState.analyzeVulnerableTurns ?? 0) - 1);
        logs.push(`> ${getConversationLine('analyze.boon.damage_reduction.curse', 'ANALYZE LOCK: CURSE -1')}`);
      }
      if (encounter.guardActive) sigDamage = Math.max(0, sigDamage - 1);
      if (sigDamage > 0) {
        signal = Math.max(0, signal - sigDamage);
        logs.push(`> SIGNAL -${sigDamage}`);
      } else logs.push('> CURSE MITIGATED');
    } else if (enemyIntent === 'bargain') {
      if (signal > fuel && signal > 0) {
        signal -= 1;
        logs.push('> SIGNAL -1 (BARGAIN)');
      } else {
        fuel = Math.max(0, fuel - 1);
        logs.push('> FUEL -1 (BARGAIN)');
      }
    } else if (enemyIntent === 'guard') {
      const idx = encounter.enemies.findIndex((d) => d.id === enemy.id);
      if (idx >= 0) {
        encounter.enemies[idx].guardStacks += 1;
        logs.push('> ENEMY GUARD STACK +1');
      }
    } else if (enemyIntent === 'flee') {
      const idx = encounter.enemies.findIndex((d) => d.id === enemy.id);
      if (idx >= 0) {
        if (encounter.enemies[idx].hp <= 2) {
          encounter.enemies[idx].hp = 0;
          encounter.enemies[idx].exit = encounter.enemies[idx].exit ?? 'fled';
          logs.push(`> TARGET FLED: ${enemy.name.toUpperCase()}`);
        } else {
          encounter.enemies[idx].intent = 'guard';
          logs.push(`> FLEE ABORTED: ${enemy.name.toUpperCase()} / HOLDING POSITION`);
        }
      }
    }
  }
  encounter.guardActive = false;
  encounter.turn += 1;
  encounter.enemies = encounter.enemies.map((enemy) => {
    if (!isAlive(enemy)) return enemy;
    const next = nextIntent(enemy.profile);
    const remainingEmp = Math.max(0, enemy.empDisabledTurns - 1);
    return { ...enemy, intent: next, empDisabledTurns: remainingEmp };
  });
}

const completeFunTestResult = (resultLogs: string[], escapedForReport = escaped): State => {
  const report = makeEncounterReport(state.encounterIndex + 1, encounter.enemies, escapedForReport);
  return {
    ...state,
    gamePhase: 'result',
    fuel,
    armor,
    signal,
    mainAmmo,
    seAmmo,
    contracts,
    activeSupportDaemon,
    activeConversation: undefined,
    negotiationRewards,
    tempForecastBoost,
    moeSyncBank,
    story,
    salvageCredits,
    logs: [...logs, ...resultLogs, '> TEST RESULT READY'],
    encounter: { ...encounter, phase: 'finished' },
    lastReport: report,
    runSummary: accumulateSummary(state.runSummary, report),
    resultType: 'Fun Test Complete',
    bossChallenged: state.bossChallenged,
    encounterPrep,
    analyzeSuccessCount,
    growthClaimed: true,
    moeLine: state.funTestMode
      ? getMoeLine('moe.garage.enter', `${state.funTestMode.label}、結果を見よっか。`, undefined, 'soft')
      : moeLine,
  };
};

if (armor <= 0 || fuel <= 0) {
  if (state.funTestMode) {
    return completeFunTestResult(['> FUN TEST END: VEHICLE LIMIT']);
  }
  const report = makeEncounterReport(state.encounterIndex + 1, encounter.enemies, escaped);
  const resultType: ResultType = 'Vehicle Disabled';
  const story = resolveStoryFromRun(state, resultType);
  const disconnectLogs = appendSupportDaemonDisconnectLogs(logs, activeSupportDaemon, 'archive');
  return {
    ...state,
    gamePhase: 'game_over',
    activeSupportDaemon: undefined,
    fuel,
    armor,
    signal,
    mainAmmo,
    seAmmo,
    contracts,
    tempForecastBoost,
    salvageCredits,
    logs: appendRecoveredStoryLogLines([...disconnectLogs, '> SIGNAL LOST', '> VEHICLE DISABLED'], story),
    encounter: { ...encounter, phase: 'finished' },
    lastReport: report,
    runSummary: accumulateSummary(state.runSummary, report),
    resultType,
    story,
    encounterPrep,
    analyzeSuccessCount,
    moeLine: getMoeLine('moe.run.game_over', '応答して。……だめ、車両信号が落ちてる。', undefined, 'flustered'),
  };
}

const cleared = escaped || encounter.enemies.every((enemy) => !isAlive(enemy));
if (cleared) {
  const report = makeEncounterReport(state.encounterIndex + 1, encounter.enemies, escaped);
  const summary = accumulateSummary(state.runSummary, report);
  const logsWithClear = [...logs, '> ENCOUNTER CLEARED'];

  if (state.funTestMode) {
    return completeFunTestResult(['> ENCOUNTER CLEARED']);
  }

  if (state.gamePhase === 'boss_encounter') {
    return {
      ...state,
      gamePhase: 'return_gate',
      fuel,
      armor,
      signal,
      mainAmmo,
      seAmmo,
      contracts,
      activeSupportDaemon,
      tempForecastBoost,
      salvageCredits,
      logs: [...logsWithClear, '> RETURN GATE ROUTE OPEN'],
      encounter: { ...encounter, phase: 'finished' },
      lastReport: report,
      runSummary: summary,
      resultType: 'Boss Cleared',
      encounterPrep,
      analyzeSuccessCount,
      moeLine: getMoeLine('moe.run.return_gate_seen', '帰還ゲート、見えた。まだ車は動くね。', undefined, 'soft'),
    };
  }

  return {
    ...state,
    gamePhase: 'reward',
    fuel,
    armor,
    signal,
    mainAmmo,
    seAmmo,
    contracts,
    activeSupportDaemon,
    tempForecastBoost,
    salvageCredits,
    logs: [...logsWithClear, '> SALVAGE RESULT READY'],
    encounter: { ...encounter, phase: 'finished' },
    lastReport: report,
    runSummary: summary,
    rewardScope: state.encounter.kind === 'enc1' ? 'post_enc1' : 'post_enc2',
    encounterPrep,
    analyzeSuccessCount,
    moeLine: getMoeLine('moe.run.encounter_clear', '遭遇クリア。次の判断に備えよう。'),
  };
}

const alive = encounter.enemies.filter(isAlive);
if (alive.length > 0 && !alive.some((enemy) => enemy.id === encounter.selectedEnemyId)) encounter.selectedEnemyId = alive[0].id;
const { forecast, unstable } = buildForecast(
  encounter.enemies,
  hasAiNaviContract(contracts),
  state.selectedLoadout.contractSupportId,
  activeSupportDaemon?.profile,
  tempForecastBoost,
);
encounter.forecast = forecast;
encounter.forecastUnstable = unstable;
encounter.phase = 'command';
logs.push('> NAVI FORECAST UPDATED');
if (unstable) logs.push('> WARNING: FORECAST RELIABILITY UNSTABLE');

return {
  ...state,
  fuel,
  armor,
  signal,
  mainAmmo,
  seAmmo,
  contracts,
  activeSupportDaemon,
  activeConversation,
  negotiationRewards,
  tempForecastBoost,
  moeSyncBank,
  story,
  salvageCredits,
  logs,
  encounterPrep,
  analyzeSuccessCount,
  moeLine,
  encounter,
};
};

export const resolveTalkChoice = (state: State, action: Action, deps: any): State => {
  if (action.type !== 'TALK_CHOOSE') return state;
  if (!(state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter')) return state;
  if (state.encounter.phase !== 'conversation' || !state.activeConversation) return state;

  const {
    canOpenContractWindow,
    buildForecast,
    hasAiNaviContract,
    makeEncounterReport,
    accumulateSummary,
  } = deps;

  const encounter: EncounterState = {
    ...state.encounter,
    enemies: state.encounter.enemies.map((enemy) => ({ ...enemy })),
    analyzedEnemyIds: [...state.encounter.analyzedEnemyIds],
  };
  const logs = [...state.logs];
  let fuel = state.fuel;
  let armor = state.armor;
  let signal = state.signal;
  let mainAmmo = state.mainAmmo;
  let seAmmo = state.seAmmo;
  let salvageCredits = state.salvageCredits;
  const moeSyncBank = state.moeSyncBank;
  let newMoeSyncBank = moeSyncBank;
  let story = { ...state.story, recoveredLogs: [...state.story.recoveredLogs], recentRecoveredLogs: [...state.story.recentRecoveredLogs] };
  const negotiationRewards = [...state.negotiationRewards];
  const addNegotiationReward = (reward: string) => {
    if (!negotiationRewards.includes(reward)) negotiationRewards.push(reward);
  };
  const encounterPrep = { ...state.encounterPrep };
  let tempForecastBoost = state.tempForecastBoost;
  const vehicleUtility = getVehicleUpgradeUtilityEffects(state.vehicleUpgrades);
  let moeLine = state.moeLine;

  const finalizeTalkResolution = (): State | undefined => {
    const cleared = encounter.enemies.every((enemy) => !isAlive(enemy));
    if (!cleared) return undefined;

    const report = makeEncounterReport(state.encounterIndex + 1, encounter.enemies, false);
    const summary = accumulateSummary(state.runSummary, report);
    const logsWithClear = [...logs, '> ENCOUNTER CLEARED'];

    if (state.funTestMode) {
      return {
        ...state,
        gamePhase: 'result',
        fuel,
        armor,
        signal,
        mainAmmo,
        seAmmo,
        encounter: { ...encounter, phase: 'finished' },
        encounterPrep,
        logs: [...logsWithClear, '> TEST RESULT READY'],
        activeConversation: undefined,
        negotiationRewards,
        story,
        moeLine: getMoeLine('moe.garage.enter', `${state.funTestMode.label}、結果を見よっか。`, undefined, 'soft'),
        moeSyncBank: newMoeSyncBank,
        salvageCredits,
        lastReport: report,
        runSummary: summary,
        resultType: 'Fun Test Complete',
        growthClaimed: true,
      };
    }

    if (state.gamePhase === 'boss_encounter') {
      return {
        ...state,
        gamePhase: 'return_gate',
        fuel,
        armor,
        signal,
        mainAmmo,
        seAmmo,
        encounter: { ...encounter, phase: 'finished' },
        encounterPrep,
        logs: [...logsWithClear, '> RETURN GATE ROUTE OPEN'],
        activeConversation: undefined,
        negotiationRewards,
        story,
        moeLine,
        moeSyncBank: newMoeSyncBank,
        salvageCredits,
        lastReport: report,
        runSummary: summary,
        resultType: 'Boss Cleared',
      };
    }

    return {
      ...state,
      gamePhase: 'reward',
      fuel,
      armor,
      signal,
      mainAmmo,
      seAmmo,
      encounter: { ...encounter, phase: 'finished' },
      encounterPrep,
      logs: [...logsWithClear, '> SALVAGE RESULT READY'],
      activeConversation: undefined,
      negotiationRewards,
      story,
      moeLine,
      moeSyncBank: newMoeSyncBank,
      salvageCredits,
      lastReport: report,
      runSummary: summary,
      rewardScope: state.encounter.kind === 'enc1' ? 'post_enc1' : 'post_enc2',
    };
  };

  const conversation = state.activeConversation;
  const targetIndex = encounter.enemies.findIndex((enemy) => enemy.id === conversation.enemyId && isAlive(enemy));
  if (targetIndex < 0) {
    encounter.phase = 'command';
    const finalized = finalizeTalkResolution();
    if (finalized) return finalized;
    return {
      ...state,
      activeConversation: undefined,
      encounter,
    };
  }
  const target = encounter.enemies[targetIndex];
  const choice = conversation.choices.find((entry) => entry.id === action.choiceId) ?? conversation.choices[0];
  if (!choice) {
    encounter.phase = 'command';
    const finalized = finalizeTalkResolution();
    if (finalized) return finalized;
    return {
      ...state,
      activeConversation: undefined,
      encounter,
    };
  }

  const translationBonus = state.skillLevels.translation_assist > 0 ? 0.05 : 0;
  const analyzed = isEnemyIdentityKnown(target, encounter.analyzedEnemyIds);
  const preferredMatch = choice.preferredTemperaments?.includes(target.temperament) ? 0.15 : 0;
  const affinityType = choice.affinityType ?? 'talk';
  const affinityRating = target.affinities[affinityType];
  const affinityBonus = affinityRating === 'weak' ? 0.15 : affinityRating === 'resist' ? -0.2 : 0;
  const pressurePenalty = target.pressure * 0.05;
  const firstTalkBonus = encounterPrep.firstTalkPending ? encounterPrep.firstTalkBonus : 0;
  const pixieLinkBonus = state.contracts.some((module) => module.id === 'radio_voice') ? 0.15 : 0;
  const choiceBias = choice.successBias ?? 0;
  const baseSuccess = 0.65 + (analyzed ? 0.1 : 0) + preferredMatch + affinityBonus + translationBonus + firstTalkBonus + pixieLinkBonus + choiceBias - pressurePenalty;
  const successRate = clamp(baseSuccess, 0.15, 0.95);

  const applyResourceDelta = (resource: 'fuel' | 'armor' | 'signal' | 'mainAmmo', amount: number) => {
    if (resource === 'fuel') {
      fuel = Math.max(0, fuel + amount);
    } else if (resource === 'armor') {
      armor = Math.max(0, armor + amount);
    } else if (resource === 'signal') {
      signal = Math.max(0, signal + amount);
    } else if (resource === 'mainAmmo') {
      mainAmmo = Math.max(0, mainAmmo + amount);
    }
  };
  const softenIntentByTemperament = (enemy: Devil): Devil['intent'] => {
    if (enemy.intent === 'guard' || enemy.intent === 'flee') return enemy.intent;
    if (enemy.temperament === 'hostile' || enemy.temperament === 'proud') return 'guard';
    if (enemy.temperament === 'machine') return enemy.intent === 'bargain' ? 'flee' : 'guard';
    if (enemy.temperament === 'hungry' || enemy.temperament === 'lonely' || enemy.temperament === 'curious') {
      return enemy.intent === 'attack' ? 'guard' : 'flee';
    }
    return enemy.intent === 'attack' ? 'guard' : 'flee';
  };
  const applyTalkBreak = (enemy: Devil, previousIntent: Devil['intent']) => {
    enemy.revealed = true;
    enemy.guardStacks = 0;
    enemy.analyzeVulnerableTurns = Math.max(2, enemy.analyzeVulnerableTurns ?? 0);
    enemy.talkBreakTurns = Math.max(1, enemy.talkBreakTurns ?? 0);
    tempForecastBoost = Math.max(tempForecastBoost, state.tempForecastBoost + 1);
    addNegotiationReward('Talk Break: route read +1');
    logs.push(`> TALK BREAK: ACTION SHIFT ${previousIntent.toUpperCase()} -> ${enemy.intent.toUpperCase()}`);
    logs.push('> TALK BREAK: NEXT HIT +1');
    logs.push('> TALK BREAK: NEXT IMPACT/CURSE -1');
    logs.push('> TALK INTEL: ROUTE READ +1');
    if (canOpenContractWindow(enemy)) {
      enemy.contractWindow = true;
      logs.push('> TALK STABILIZED: CONTRACT WINDOW OPEN');
    }
  };

  const hasCost = () => {
    const cost = choice.cost;
    if (!cost) return true;
    if ((cost.fuel ?? 0) > fuel) return false;
    if ((cost.armor ?? 0) > armor) return false;
    if ((cost.signal ?? 0) > signal) return false;
    if ((cost.mainAmmo ?? 0) > mainAmmo) return false;
    if ((cost.seAmmo ?? 0) > seAmmo) return false;
    if ((cost.salvageCredits ?? 0) > salvageCredits) return false;
    return true;
  };
  const payCost = () => {
    const cost = choice.cost;
    if (!cost) return;
    if (cost.fuel) fuel = Math.max(0, fuel - cost.fuel);
    if (cost.armor) armor = Math.max(0, armor - cost.armor);
    if (cost.signal) signal = Math.max(0, signal - cost.signal);
    if (cost.mainAmmo) mainAmmo = Math.max(0, mainAmmo - cost.mainAmmo);
    if (cost.seAmmo) seAmmo = Math.max(0, seAmmo - cost.seAmmo);
    if (cost.salvageCredits) salvageCredits = Math.max(0, salvageCredits - cost.salvageCredits);
  };

  const applyEffects = (effects: ConversationEffect[] | undefined, success: boolean) => {
    if (!effects) return;
    for (const effect of effects) {
      if (effect.type === 'trust') {
        target.trust = Math.max(0, target.trust + effect.amount);
      } else if (effect.type === 'interest') {
        target.interest = Math.max(0, target.interest + effect.amount);
      } else if (effect.type === 'pressure') {
        target.pressure = Math.max(0, target.pressure + effect.amount);
      } else if (effect.type === 'openContractWindow') {
        if (canOpenContractWindow(target)) {
          target.contractWindow = true;
          logs.push('> CONTRACT WINDOW OPEN');
        }
      } else if (effect.type === 'revealAffinity') {
        target.affinityRevealed = true;
        target.revealed = true;
        logs.push('> AFFINITY REVEAL ACQUIRED');
      } else if (effect.type === 'revealIntent') {
        target.revealed = true;
        logs.push(`> INTENT REVEAL: ${target.intent.toUpperCase()}`);
        if (target.profile === 'pixie_shibuya_glow') addNegotiationReward('Pixie: next intent reveal');
      } else if (effect.type === 'routeHint') {
        const hint = 'Route hint acquired';
        addNegotiationReward(hint);
        logs.push('> ROUTE HINT RECEIVED');
      } else if (effect.type === 'bossTraitHint') {
        const hint = 'Boss trait hint acquired';
        addNegotiationReward(hint);
        logs.push('> BOSS TRAIT HINT RECEIVED');
      } else if (effect.type === 'recover') {
        applyResourceDelta(effect.resource, effect.amount);
        const sign = effect.amount >= 0 ? '+' : '';
        logs.push(`> ${effect.resource.toUpperCase()} ${sign}${effect.amount}`);
        if (target.profile === 'pixie_shibuya_glow' && effect.amount > 0) {
          addNegotiationReward(`Pixie: ${effect.resource} +${effect.amount}`);
        }
      } else if (effect.type === 'enemyLeaves') {
        target.exit = 'fled';
        logs.push(`> TARGET LEFT: ${target.name.toUpperCase()}`);
      } else if (effect.type === 'cancelNextIntent') {
        target.intent = 'guard';
        logs.push('> NEXT INTENT CANCELED');
      } else if (effect.type === 'storyLog') {
        if (!story.recoveredLogs.includes(effect.logId)) {
          story.recoveredLogs.push(effect.logId);
          story.recentRecoveredLogs = [effect.logId];
          story.previousDriverClues += 1;
          logs.push(`> STORY LOG RECOVERED: ${effect.logId}`);
          addNegotiationReward(`Story Log ${effect.logId}`);
        }
      } else if (effect.type === 'moeSync') {
        newMoeSyncBank = Math.max(0, newMoeSyncBank + effect.amount);
        logs.push(`> M.O.E. SYNC +${effect.amount}`);
        addNegotiationReward(`M.O.E. Sync +${effect.amount}`);
      }
    }
    if (success && target.profile === 'roadside_phone') {
      if (target.interest <= target.trust) {
        target.interest += 1;
      } else {
        target.trust += 1;
      }
      logs.push('> SUPPORT DAEMON: ROADSIDE PHONE / TALK BOOST');
    }
  };

  logs.push(`> PLAYER RESPONSE: ${choice.label.toUpperCase()}`);
  logs.push(`> ${choice.playerLine}`);
  if (!hasCost()) {
    logs.push('> NEGOTIATION RESPONSE: COST DENIED');
    logs.push(`> ${choice.failText}`);
    const pressureGain = Math.max(0, 1 - vehicleUtility.talkFailurePressureReduction);
    target.pressure += pressureGain;
    if (pressureGain === 0) logs.push('> NOISE FILTER: PRESSURE SPIKE DAMPED');
    moeLine = choice.failText;
    encounter.phase = 'command';
    encounterPrep.firstTalkPending = false;
  } else {
    payCost();
    const succeeded = Math.random() < successRate;
    if (succeeded) {
      logs.push('> NEGOTIATION RESPONSE: ACCEPTED');
      logs.push(`> ${choice.successText}`);
      const previousIntent = target.intent;
      applyEffects(choice.effectsOnSuccess, true);
      if (target.profile === 'pixie_shibuya_glow' && choice.id === 'listen') {
        logs.push('> ACTION RESULT: Pixie listened. Contract Window opened.');
      }
      if (target.profile === 'pixie_shibuya_glow' && choice.id === 'offer_signal') {
        logs.push('> ACTION RESULT: Pixie accepted the signal. Contract Window opened.');
      }
      if (target.profile === 'toll_gate_saint' && choice.id === 'pay_fuel') {
        addNegotiationReward('Paid Passage');
        logs.push('> ACTION RESULT: Toll paid. Boss passage resolved.');
      }
      if (target.profile === 'toll_gate_saint' && choice.id === 'present_signal') {
        logs.push('> ACTION RESULT: Toll token recognized. Contract Window opened.');
      }
      if (affinityType === 'talk' && affinityRating === 'weak') {
        logs.push('> WEAK RESPONSE: TALK');
      }
      logs.push(`> ${getConversationLine('talk.effect.intent_softened', 'TALK DISRUPTION: INTENT SOFTENED')}`);
      target.intent = softenIntentByTemperament(target);
      applyTalkBreak(target, previousIntent);
      const talkKey = `talk.success.${target.temperament}`;
      moeLine = getConversationLine(talkKey, getConversationLine('talk.success.default', choice.successText));
      if (affinityType === 'talk' && affinityRating === 'weak') {
        moeLine = '会話に乗った。撃つよりずっと得だったね';
      }
    } else {
      logs.push('> NEGOTIATION RESPONSE: REJECTED');
      logs.push(`> ${choice.failText}`);
      applyEffects(choice.effectsOnFail, false);
      const pressureGain = Math.max(0, 1 - vehicleUtility.talkFailurePressureReduction);
      target.pressure += pressureGain;
      if (pressureGain === 0) logs.push('> NOISE FILTER: PRESSURE SPIKE DAMPED');
      target.intent = target.temperament === 'hostile' ? 'attack' : 'curse';
      moeLine = choice.failText;
    }
    encounterPrep.firstTalkPending = false;
    encounter.phase = 'command';
  }

  const alive = encounter.enemies.filter(isAlive);
  if (alive.length > 0 && !alive.some((enemy) => enemy.id === encounter.selectedEnemyId)) {
    encounter.selectedEnemyId = alive[0].id;
  }

  const finalized = finalizeTalkResolution();
  if (finalized) return finalized;

  const { forecast, unstable } = buildForecast(
    encounter.enemies,
    hasAiNaviContract(state.contracts),
    state.selectedLoadout.contractSupportId,
    state.activeSupportDaemon?.profile,
    tempForecastBoost,
  );
  encounter.forecast = forecast;
  encounter.forecastUnstable = unstable;
  encounter.phase = 'command';
  logs.push('> NAVI FORECAST UPDATED');

  return {
    ...state,
    fuel,
    armor,
    signal,
    mainAmmo,
    seAmmo,
    encounter,
    encounterPrep,
    logs,
    activeConversation: undefined,
    negotiationRewards,
    story,
    moeLine,
    moeSyncBank: newMoeSyncBank,
    salvageCredits,
    tempForecastBoost,
  };
};
