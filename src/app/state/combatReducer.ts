import { getBalanceConfig } from '../../balanceConfig';
import { getConversationLine, getConversationLineWithVars } from '../../conversationConfig';
import { getDialogueLine } from '../../dialogueConfig';
import { getEncounterScenario, getScenarioLine } from '../../scenario/scenarioLoader';
import { affinityLabel, affinityOrder, contractModules } from '../../game/catalogs';
import { getConversationProfile } from '../../game/conversationCatalog';
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
  supportDaemonMoeLinkLines,
} from '../../game/runtimeHelpers';
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
let moeLine = getDialogueLine('moe.dynamic.battle.idle', '次の手を選んで。');
let skipEnemyResolution = false;
let escaped = false;
const selectedMainGun = getMainGunSpec(state.selectedLoadout.mainGunId);
const selectedSubGun = getSubGunSpec(state.selectedLoadout.subGunId);
const selectedSE = getSpecialEquipmentSpec(state.selectedLoadout.specialEquipmentId);
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
  const affinityThreshold = getIntelAffinityThreshold(enemy.intelThreshold);
  if (source === 'analyze') {
    logs.push(`> INTEL PROGRESS: ${enemy.name.toUpperCase()} ${after}/${enemy.intelThreshold}`);
  }
  if (!enemy.revealed && after >= revealThreshold) {
    enemy.revealed = true;
    logs.push('> IDENTITY LOCK PARTIAL RELEASED');
  }
  if (!enemy.affinityRevealed && after >= affinityThreshold) {
    enemy.affinityRevealed = true;
    logs.push('> AFFINITY MAP PARTIAL DECODED');
  }
  if (after >= enemy.intelThreshold) {
    encounter.analyzedEnemyIds = Array.from(new Set([...encounter.analyzedEnemyIds, enemy.id]));
  }
};

logs.push(`> COMMAND: ${command.toUpperCase()}${selectedEnemy ? ` / ${selectedEnemy.name.toUpperCase()}` : ''}`);

if (command === 'main_gun' && selectedEnemy && mainAmmo > 0) {
  const idx = encounter.enemies.findIndex((enemy) => enemy.id === selectedEnemy.id);
  if (idx >= 0) {
    mainAmmo -= 1;
    const shield = encounter.enemies[idx].guardStacks > 0 ? 1 : 0;
    const affinity = logAffinityReaction(encounter.enemies[idx], 'ballistic');
    const gunRoll = resolveDamageRoll({
      baseDamage: selectedMainGun.damage,
      affinity,
      variance: damageVarianceByCommand.main_gun,
      flatReduction: shield,
    });
    const damage = gunRoll.damage;
    encounter.enemies[idx].hp = Math.max(0, encounter.enemies[idx].hp - damage);
    encounter.enemies[idx].guardStacks = Math.max(0, encounter.enemies[idx].guardStacks - 1);
    encounter.enemies[idx].pressure += 1;
    applyIntelGain(idx, 8, 'combat');
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
    const subRoll = resolveDamageRoll({
      baseDamage: selectedSubGun.damage,
      affinity,
      variance: damageVarianceByCommand.sub_gun,
      flatReduction: shield,
      armored: !!encounter.enemies[enemyIndex].armored,
    });
    const damage = subRoll.damage;
    encounter.enemies[enemyIndex].hp = Math.max(0, encounter.enemies[enemyIndex].hp - damage);
    encounter.enemies[enemyIndex].guardStacks = Math.max(0, encounter.enemies[enemyIndex].guardStacks - 1);
    encounter.enemies[enemyIndex].pressure += 1;
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
    moeLine = getDialogueLine('moe.dynamic.battle.sub_gun.resist', '副砲制圧。効きが浅い。相性が悪い。');
  } else if (weakHits > 0) {
    moeLine = getDialogueLine('moe.dynamic.battle.sub_gun.weak', '副砲制圧。刺さってる。崩せるよ。');
  } else {
    moeLine = selectedSubGun.id === 'suppression_mg'
      ? getDialogueLine('moe.dynamic.battle.sub_gun.suppress', '副砲制圧。攻勢が鈍るかも。')
      : getDialogueLine('moe.dynamic.battle.sub_gun.normal', '副砲制圧。足止めにはなる。');
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
        const aoeRoll = resolveDamageRoll({
          baseDamage: selectedSE.damage,
          affinity,
          variance: damageVarianceByCommand.se_harpoon,
          flatReduction: guardShield,
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
      moeLine = getDialogueLine('moe.dynamic.battle.se.all_damage', 'S-E発射。制圧寄りにまとめて焼いた。');
    } else {
      const affinity = logAffinityReaction(encounter.enemies[idx], 'signal');
      const shield = encounter.enemies[idx].guardStacks > 0 ? 1 : 0;
      const seRoll = resolveDamageRoll({
        baseDamage: selectedSE.damage,
        affinity,
        variance: damageVarianceByCommand.se_harpoon,
        flatReduction: shield,
      });
      const adjustedDamage = seRoll.damage;
      encounter.enemies[idx].hp = Math.max(0, encounter.enemies[idx].hp - adjustedDamage);
      encounter.enemies[idx].guardStacks = Math.max(0, encounter.enemies[idx].guardStacks - 1);
      applyIntelGain(idx, 10, 'combat');
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
    moeLine = getDialogueLine('moe.dynamic.battle.signal_low', 'Signalが足りない。');
  } else {
    signal -= 1;
    let analyzedTarget: Devil | undefined;
    const idx = encounter.enemies.findIndex((enemy) => enemy.id === selectedEnemy.id);
    if (idx >= 0) {
      applyIntelGain(idx, 55, 'analyze');
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
    moeLine = getConversationLineWithVars('moe.dynamic.battle.analyze.success', {
      target: getMoeTargetName(selectedEnemy),
    });
  }
}

if (command === 'talk' && selectedEnemy) {
  const idx = encounter.enemies.findIndex((enemy) => enemy.id === selectedEnemy.id);
  if (idx >= 0) {
    const profile = getConversationProfile(encounter.enemies[idx].profile);
    activeConversation = {
      enemyId: encounter.enemies[idx].id,
      enemyProfile: encounter.enemies[idx].profile,
      introLine: profile.introLine,
      choices: profile.choices.slice(0, 3),
    };
    logs.push(`> TALK CHANNEL OPEN: ${encounter.enemies[idx].name.toUpperCase()}`);
    const scenarioTalkLine = getScenarioLine(getEncounterScenario(encounter.enemies[idx].profile)?.talk?.curious);
    if (scenarioTalkLine) logs.push(`> ${scenarioTalkLine}`);
    encounter.phase = 'conversation';
    moeLine = profile.moeHint ?? getDialogueLine('moe.dynamic.battle.talk.success.normal', '会話に乗った。反応を見て選んで。');
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
      moeLine = getConversationLineWithVars('moe.dynamic.battle.contract.no_window', {
        target: getMoeTargetName(target),
      });
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
      moeLine = getConversationLineWithVars('moe.dynamic.battle.contract.condition_fail', {
        target: getMoeTargetName(target),
      });
    } else {
      const contractCfg = getBalanceConfig().contract;
      const analyzedBonus = isEnemyIdentityKnown(target, encounter.analyzedEnemyIds) ? contractCfg.analyzeBonus : 0;
      const baseSuccess = target.profile === 'toll_gate_saint' ? contractCfg.bossBaseSuccess : contractCfg.normalBaseSuccess;
      const successRate = clamp(
        baseSuccess + analyzedBonus - target.pressure * contractCfg.pressurePenaltyPerStack,
        contractCfg.minSuccess,
        contractCfg.maxSuccess,
      );
      logs.push('> CONTRACT PROTOCOL START');
      if (Math.random() < successRate) {
        logs.push('> ENTITY SIGNATURE CAPTURED');
        if (target.targetModuleId && !contracts.some((module) => module.id === target.targetModuleId)) {
          contracts = [...contracts, contractModules[target.targetModuleId]];
          logs.push(`> MODULE SLOT UPDATED: ${contractModules[target.targetModuleId].name.toUpperCase()}`);
        }
        logs.push(`> CONTRACT REGISTERED: ${target.name.toUpperCase()}`);
        const contractSuccessLine = getScenarioLine(getEncounterScenario(target.profile)?.contract?.success);
        if (contractSuccessLine) logs.push(`> ${contractSuccessLine}`);
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
        moeLine = `M.O.E.: ${supportDaemonMoeLinkLines[Math.floor(Math.random() * supportDaemonMoeLinkLines.length)]}`;
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
        moeLine = getConversationLineWithVars('moe.dynamic.battle.contract.reject', {
          target: getMoeTargetName(target),
        });
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
    const ramRoll = resolveDamageRoll({
      baseDamage: ramBase,
      affinity,
      variance: damageVarianceByCommand.ram,
      flatReduction: shield,
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
  moeLine = getDialogueLine('moe.dynamic.battle.guard', '防御姿勢、固定。次の被弾を抑える。');
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
    moeLine = getDialogueLine('moe.dynamic.battle.escape.success', '離脱。ルート確保。接触を切った。');
  } else {
    logs.push('> ESCAPE FAILED');
    moeLine = getDialogueLine('moe.dynamic.battle.escape.fail', '離脱失敗。受ける準備して。');
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

if (armor <= 0 || fuel <= 0) {
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
    moeLine: getDialogueLine('moe.run.game_over', '応答して。……だめ、車両信号が落ちてる。'),
  };
}

const cleared = escaped || encounter.enemies.every((enemy) => !isAlive(enemy));
if (cleared) {
  const report = makeEncounterReport(state.encounterIndex + 1, encounter.enemies, escaped);
  const summary = accumulateSummary(state.runSummary, report);
  const logsWithClear = [...logs, '> ENCOUNTER CLEARED'];

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
      moeLine: getDialogueLine('moe.run.return_gate_seen', '帰還ゲート、見えた。まだ車は動くね。'),
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
    moeLine: getDialogueLine('moe.run.encounter_clear', '遭遇クリア。次の判断に備えよう。'),
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
  } = deps;

  const encounter: EncounterState = {
    ...state.encounter,
    enemies: state.encounter.enemies.map((enemy) => ({ ...enemy })),
    analyzedEnemyIds: [...state.encounter.analyzedEnemyIds],
  };
  const logs = [...state.logs];
  const conversation = state.activeConversation;
  const targetIndex = encounter.enemies.findIndex((enemy) => enemy.id === conversation.enemyId && enemy.hp > 0);
  if (targetIndex < 0) {
    encounter.phase = 'command';
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
    return {
      ...state,
      activeConversation: undefined,
      encounter,
    };
  }

  let fuel = state.fuel;
  let armor = state.armor;
  let signal = state.signal;
  let mainAmmo = state.mainAmmo;
  const moeSyncBank = state.moeSyncBank;
  let newMoeSyncBank = moeSyncBank;
  let story = { ...state.story, recoveredLogs: [...state.story.recoveredLogs], recentRecoveredLogs: [...state.story.recentRecoveredLogs] };
  const negotiationRewards = [...state.negotiationRewards];
  const encounterPrep = { ...state.encounterPrep };
  let moeLine = state.moeLine;

  const translationBonus = state.skillLevels.translation_assist > 0 ? 0.05 : 0;
  const analyzed = isEnemyIdentityKnown(target, encounter.analyzedEnemyIds);
  const preferredMatch = choice.preferredTemperaments?.includes(target.temperament) ? 0.15 : 0;
  const affinityType = choice.affinityType ?? 'talk';
  const affinityRating = target.affinities[affinityType];
  const affinityBonus = affinityRating === 'weak' ? 0.15 : affinityRating === 'resist' ? -0.2 : 0;
  const pressurePenalty = target.pressure * 0.05;
  const firstTalkBonus = encounterPrep.firstTalkPending ? encounterPrep.firstTalkBonus : 0;
  const baseSuccess = 0.65 + (analyzed ? 0.1 : 0) + preferredMatch + affinityBonus + translationBonus + firstTalkBonus - pressurePenalty;
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

  const hasCost = () => {
    const cost = choice.cost;
    if (!cost) return true;
    if ((cost.fuel ?? 0) > fuel) return false;
    if ((cost.armor ?? 0) > armor) return false;
    if ((cost.signal ?? 0) > signal) return false;
    if ((cost.mainAmmo ?? 0) > mainAmmo) return false;
    return true;
  };
  const payCost = () => {
    const cost = choice.cost;
    if (!cost) return;
    if (cost.fuel) fuel = Math.max(0, fuel - cost.fuel);
    if (cost.armor) armor = Math.max(0, armor - cost.armor);
    if (cost.signal) signal = Math.max(0, signal - cost.signal);
    if (cost.mainAmmo) mainAmmo = Math.max(0, mainAmmo - cost.mainAmmo);
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
      } else if (effect.type === 'routeHint') {
        const hint = 'Route hint acquired';
        negotiationRewards.push(hint);
        logs.push('> ROUTE HINT RECEIVED');
      } else if (effect.type === 'bossTraitHint') {
        const hint = 'Boss trait hint acquired';
        negotiationRewards.push(hint);
        logs.push('> BOSS TRAIT HINT RECEIVED');
      } else if (effect.type === 'recover') {
        applyResourceDelta(effect.resource, effect.amount);
        const sign = effect.amount >= 0 ? '+' : '';
        logs.push(`> ${effect.resource.toUpperCase()} ${sign}${effect.amount}`);
      } else if (effect.type === 'enemyLeaves') {
        target.hp = 0;
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
          negotiationRewards.push(`Story Log ${effect.logId}`);
        }
      } else if (effect.type === 'moeSync') {
        newMoeSyncBank = Math.max(0, newMoeSyncBank + effect.amount);
        logs.push(`> M.O.E. SYNC +${effect.amount}`);
        negotiationRewards.push(`M.O.E. Sync +${effect.amount}`);
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
    target.pressure += 1;
    moeLine = choice.failText;
    encounter.phase = 'command';
    encounterPrep.firstTalkPending = false;
  } else {
    payCost();
    const succeeded = Math.random() < successRate;
    if (succeeded) {
      logs.push('> NEGOTIATION RESPONSE: ACCEPTED');
      logs.push(`> ${choice.successText}`);
      applyEffects(choice.effectsOnSuccess, true);
      logs.push(`> ${getConversationLine('talk.effect.intent_softened', 'TALK DISRUPTION: INTENT SOFTENED')}`);
      target.intent = softenIntentByTemperament(target);
      const talkKey = `talk.success.${target.temperament}`;
      moeLine = getConversationLine(talkKey, getConversationLine('talk.success.default', choice.successText));
    } else {
      logs.push('> NEGOTIATION RESPONSE: REJECTED');
      logs.push(`> ${choice.failText}`);
      applyEffects(choice.effectsOnFail, false);
      target.pressure += 1;
      target.intent = target.temperament === 'hostile' ? 'attack' : 'curse';
      moeLine = choice.failText;
    }
    encounterPrep.firstTalkPending = false;
    encounter.phase = 'command';
  }

  const alive = encounter.enemies.filter((enemy) => enemy.hp > 0);
  if (alive.length > 0 && !alive.some((enemy) => enemy.id === encounter.selectedEnemyId)) {
    encounter.selectedEnemyId = alive[0].id;
  }
  const { forecast, unstable } = buildForecast(
    encounter.enemies,
    hasAiNaviContract(state.contracts),
    state.selectedLoadout.contractSupportId,
    state.activeSupportDaemon?.profile,
    state.tempForecastBoost,
  );
  encounter.forecast = forecast;
  encounter.forecastUnstable = unstable;
  logs.push('> NAVI FORECAST UPDATED');

  return {
    ...state,
    fuel,
    armor,
    signal,
    mainAmmo,
    encounter,
    encounterPrep,
    logs,
    activeConversation: undefined,
    negotiationRewards,
    story,
    moeLine,
    moeSyncBank: newMoeSyncBank,
  };
};
