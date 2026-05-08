import { getBalanceConfig } from '../../balanceConfig';
import { getMoeLine } from '../../game/moeDialogue';
import type { Action, ApproachKind, EncounterPrep, ResultType, State } from '../../game/types';
import { appendSupportDaemonDisconnectLogs, clamp, getMainGunSpec, isAlive } from '../../game/runtimeHelpers';
import {
  buildEncounter,
  buildForecast,
  createEmptyEncounterPrep,
  damageVarianceByCommand,
  getEncounterIntroLine,
  getScanChance,
  hasAiNaviContract,
  initRunWithLoadout,
  makeEncounterReport,
  pickEncounterLineup,
  resolveDamageRoll,
  accumulateSummary,
} from './stateRuntime';
import { appendRecoveredStoryLogLines, resolveStoryFromRun } from './storyProgression';

export const moveToApproach = (
  nextState: State,
  kind: ApproachKind,
  extraLogs: string[] = [],
  prepSeed: Partial<EncounterPrep> = {},
): State => {
  const lineup = pickEncounterLineup(kind, nextState.stage);
  const scanChance = getScanChance(nextState, kind, lineup);
  const scanSuccess = Math.random() * 100 < scanChance;
  const logs = [...nextState.logs, ...extraLogs, '> NAVI SCAN START', '> SIGNAL SWEEP: NIGHT LOOP LANE'];
  if (scanSuccess) {
    logs.push('> CONTACT DETECTED', '> APPROACH WINDOW OPEN');
  } else {
    logs.push('> NAVI SCAN FAILED', '> AMBUSH WARNING');
  }
  return {
    ...nextState,
    gamePhase: 'approach',
    approach: { pendingKind: kind, scanSuccess, scanChance, lineup },
    encounterPrep: {
      ...createEmptyEncounterPrep(),
      ...prepSeed,
    },
    logs,
    moeLine: scanSuccess
      ? kind === 'boss'
        ? getMoeLine('moe.run.scan_success_boss', '強い反応。見えてるけど、近づき方は選べる。', undefined, 'serious')
        : getMoeLine('moe.run.scan_success', '先に見つけた。どう入る？', undefined, 'proud')
      : getMoeLine('moe.run.scan_fail', 'ごめん、遅れた。来るよ。', undefined, 'flustered'),
  };
};

export const createEncounterFromApproach = (baseState: State): State => {
  if (!baseState.approach) return baseState;
  const kind = baseState.approach.pendingKind;
  const encounter = buildEncounter(
    kind,
    baseState.contracts,
    baseState.selectedLoadout.contractSupportId,
    baseState.activeSupportDaemon?.profile,
    baseState.tempForecastBoost,
    baseState.stage,
    baseState.approach.lineup,
  );
  let fuel = baseState.fuel;
  let armor = baseState.armor;
  let signal = baseState.signal;
  let mainAmmo = baseState.mainAmmo;
  let seAmmo = baseState.seAmmo;
  const logs = [...baseState.logs];
  const introTarget = encounter.enemies.find(isAlive);
  const introLine = introTarget ? getEncounterIntroLine(introTarget.profile) : undefined;
  if (introLine) logs.push(`> ${introLine}`);
  const prep = { ...baseState.encounterPrep, firstStrikeDamage: undefined };

  if (!baseState.approach.scanSuccess) {
    const enemyIdx = encounter.enemies.findIndex(isAlive);
    if (enemyIdx >= 0) {
      encounter.enemies[enemyIdx].intent = 'attack';
      encounter.enemies[enemyIdx].pressure += 1;
    }
    if (Math.random() < 0.5) {
      armor = Math.max(0, armor - 1);
      logs.push('> AMBUSH CONTACT', '> ARMOR -1');
    } else {
      signal = Math.max(0, signal - 1);
      logs.push('> AMBUSH CONTACT', '> SIGNAL -1');
    }
    prep.ambushed = true;
    prep.approachLabel = 'AMBUSHED';
    prep.intentDisrupted = false;
    prep.firstTalkBonus = baseState.skillLevels.translation_assist * 0.03;
    prep.firstTalkPending = prep.firstTalkBonus > 0;
    if (armor <= 0 || fuel <= 0) {
      const resultType: ResultType = 'Vehicle Disabled';
      const story = resolveStoryFromRun(baseState, resultType);
      const disconnectLogs = appendSupportDaemonDisconnectLogs(logs, baseState.activeSupportDaemon, 'archive');
      return {
        ...baseState,
        fuel,
        armor,
        signal,
        logs: appendRecoveredStoryLogLines([...disconnectLogs, '> SIGNAL LOST', '> VEHICLE DISABLED'], story),
        gamePhase: 'game_over',
        resultType,
        story,
        activeSupportDaemon: undefined,
        approach: undefined,
        encounterPrep: prep,
      };
    }
    return {
      ...baseState,
      gamePhase: kind === 'boss' ? 'boss_encounter' : 'encounter',
      encounterIndex: kind === 'enc1' ? 0 : kind === 'enc2' ? 1 : 2,
      encounter,
      fuel,
      armor,
      signal,
      mainAmmo,
      seAmmo,
      encounterPrep: prep,
      logs,
      moeLine: getMoeLine('moe.run.ambush_contact', '見落とした。ごめん、初撃来る。', undefined, 'flustered'),
      approach: undefined,
    };
  }

  return {
    ...baseState,
    gamePhase: kind === 'boss' ? 'boss_encounter' : 'encounter',
    encounterIndex: kind === 'enc1' ? 0 : kind === 'enc2' ? 1 : 2,
    encounter,
    fuel,
    armor,
    signal,
    mainAmmo,
    seAmmo,
    encounterPrep: {
      ...prep,
      firstTalkBonus: prep.firstTalkBonus + baseState.skillLevels.translation_assist * 0.03,
      firstTalkPending: prep.firstTalkPending || baseState.skillLevels.translation_assist > 0,
    },
    logs: [...logs, '> NAVI FORECAST UPDATED'],
    moeLine: getMoeLine('moe.run.contact_to_command', '接触。コマンド選択へ。'),
    approach: undefined,
  };
};

export function reduceApproach(state: State, action: Action): State {
  if (action.type === 'ADVANCE_PROLOGUE') {
    if (state.gamePhase !== 'prologue') return state;
    return state;
  }

  if (action.type === 'START_ENGINE') {
    if (state.gamePhase !== 'prologue') return state;
    return initRunWithLoadout(state, ['> RUN START: SHALLOW NIGHT LOOP SALVAGE', '> ENGINE START', '> NIGHT LOOP ENTRY CONFIRMED']);
  }

  if (action.type === 'APPROACH_CONTINUE') {
    if (state.gamePhase !== 'approach' || !state.approach) return state;
    return createEncounterFromApproach(state);
  }

  if (action.type === 'APPROACH_CHOOSE') {
    if (state.gamePhase !== 'approach' || !state.approach?.scanSuccess) return state;
    const kind = state.approach.pendingKind;
    const encounter = buildEncounter(
      kind,
      state.contracts,
      state.selectedLoadout.contractSupportId,
      state.activeSupportDaemon?.profile,
      state.tempForecastBoost,
      state.stage,
      state.approach.lineup,
    );
    let fuel = state.fuel;
    let armor = state.armor;
    let signal = state.signal;
    let mainAmmo = state.mainAmmo;
    let seAmmo = state.seAmmo;
    let salvageCredits = state.salvageCredits;
    const logs = [...state.logs];
    const introTarget = encounter.enemies.find(isAlive);
    const introLine = introTarget ? getEncounterIntroLine(introTarget.profile) : undefined;
    if (introLine) logs.push(`> ${introLine}`);
    const prep = createEmptyEncounterPrep();
    const baseTalkBonus = state.skillLevels.translation_assist * 0.03;

    if (action.option === 'preemptive_main_gun') {
      if (mainAmmo <= 0) {
        return {
          ...state,
          logs: [...state.logs, '> WARNING: MAIN AMMO EMPTY'],
          moeLine: getMoeLine('moe.run.approach.no_main_ammo', '主砲弾がない。別の入り方にして。', undefined, 'serious'),
        };
      }
      let firstStrikeDamage: number | undefined;
      const target = encounter.enemies.findIndex(isAlive);
      if (target >= 0) {
        mainAmmo -= 1;
        const gunBase = getMainGunSpec(state.selectedLoadout.mainGunId).damage + state.skillLevels.gunnery;
        const gunRoll = resolveDamageRoll({
          baseDamage: gunBase,
          affinity: 'normal',
          variance: damageVarianceByCommand.approach_main_gun,
        });
        encounter.enemies[target].hp = Math.max(0, encounter.enemies[target].hp - gunRoll.damage);
        firstStrikeDamage = gunRoll.damage;
        encounter.enemies[target].pressure += 1;
        encounter.enemies[target].intent = 'guard';
        logs.push(`> FIRST STRIKE DAMAGE: ${gunRoll.damage} (PRED ${gunRoll.min}-${gunRoll.max})`);
        if (encounter.enemies[target].hp <= 0 && !encounter.enemies[target].exit) {
          encounter.enemies[target].exit = 'defeated';
          salvageCredits += 1;
        }
      }
      logs.push('> APPROACH: PREEMPTIVE MAIN GUN', '> FIRST STRIKE CONFIRMED');
      prep.firstStrike = true;
      prep.firstStrikeDamage = firstStrikeDamage;
      prep.intentDisrupted = true;
      prep.approachLabel = 'FIRST STRIKE';
    }

    if (action.option === 'hit_and_run_ram') {
      armor = Math.max(0, armor - 1);
      fuel = Math.max(0, fuel - 1);
      logs.push('> APPROACH: HIT-AND-RUN RAM', '> CHASSIS IMPACT');
      const approach = getBalanceConfig().approach;
      const successRate = clamp(
        approach.hitAndRunBaseChance + state.skillLevels.ram_control * approach.ramControlBonusPerLevel,
        approach.minChance,
        approach.maxChance,
      );
      if (Math.random() < successRate) {
        logs.push('> BYPASS SUCCESS');
        const clearedEncounter = {
          ...encounter,
          enemies: encounter.enemies.map((enemy) => ({ ...enemy, hp: 0, exit: enemy.exit ?? 'fled' })),
          phase: 'finished' as const,
        };
        const report = makeEncounterReport(kind === 'enc1' ? 1 : kind === 'enc2' ? 2 : 3, clearedEncounter.enemies, true);
        const summary = accumulateSummary(state.runSummary, report);
        if (kind === 'boss') {
          return {
            ...state,
            fuel,
            armor,
            signal,
            mainAmmo,
            seAmmo,
            salvageCredits,
            logs,
            runSummary: summary,
            lastReport: report,
            encounter: clearedEncounter,
            encounterPrep: { ...prep, approachLabel: 'BYPASS' },
            gamePhase: 'return_gate',
            resultType: 'Boss Avoided',
          moeLine: getMoeLine('moe.dynamic.battle.hit_and_run_success', 'ひき逃げ成功。突破した。', undefined, 'proud'),
            approach: undefined,
          };
        }
        return {
          ...state,
          fuel,
          armor,
          signal,
          mainAmmo,
          seAmmo,
          salvageCredits,
          logs,
          runSummary: summary,
          lastReport: report,
          encounter: clearedEncounter,
          encounterPrep: { ...prep, approachLabel: 'BYPASS' },
          gamePhase: 'reward',
          rewardScope: kind === 'enc1' ? 'post_enc1' : 'post_enc2',
          moeLine: getMoeLine('moe.dynamic.battle.hit_and_run_bypass', 'ひき逃げ成功。接敵を回避した。', undefined, 'proud'),
          approach: undefined,
        };
      }
      logs.push('> BYPASS FAILED');
      encounter.enemies = encounter.enemies.map((enemy) => (isAlive(enemy) ? { ...enemy, pressure: enemy.pressure + 1 } : enemy));
      prep.approachLabel = 'BYPASS FAILED';
    }

    if (action.option === 'silent_coast') {
      fuel = Math.max(0, fuel - 1);
      encounter.enemies = encounter.enemies.map((enemy) => (enemy.intent === 'attack' ? { ...enemy, intent: 'guard' } : enemy));
      prep.talkPrepared = true;
      prep.intentDisrupted = true;
      prep.firstTalkBonus = 0.1 + baseTalkBonus;
      prep.firstTalkPending = true;
      prep.approachLabel = 'TALK BOOST';
      logs.push('> APPROACH: SILENT COAST', '> ENGINE NOISE SUPPRESSED', '> TALK CHANNEL STABLE');
    }

    if (action.option === 'open_channel') {
      if (signal <= 0) {
        return {
          ...state,
          logs: [...state.logs, '> WARNING: SIGNAL TOO LOW'],
          moeLine: getMoeLine('moe.run.approach.no_signal', 'Signalが足りない。', undefined, 'serious'),
        };
      }
      signal = Math.max(0, signal - 1);
      const target = encounter.enemies.findIndex(isAlive);
      if (target >= 0) {
        encounter.enemies[target].interest += 1;
        if (encounter.enemies[target].temperament === 'hostile') encounter.enemies[target].pressure += 1;
      }
      prep.firstTalkBonus = 0.2 + baseTalkBonus;
      prep.firstTalkPending = true;
      prep.talkPrepared = true;
      prep.approachLabel = 'OPEN CHANNEL';
      logs.push('> APPROACH: OPEN CHANNEL', '> NEGOTIATION CHANNEL PRE-OPENED');
    }

    if (prep.firstTalkBonus === 0 && baseTalkBonus > 0) {
      prep.firstTalkBonus = baseTalkBonus;
      prep.firstTalkPending = true;
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
      salvageCredits,
      gamePhase: kind === 'boss' ? 'boss_encounter' : 'encounter',
      encounterIndex: kind === 'enc1' ? 0 : kind === 'enc2' ? 1 : 2,
      encounter,
      encounterPrep: prep,
      approach: undefined,
      logs,
      moeLine:
        action.option === 'preemptive_main_gun'
          ? getMoeLine('moe.run.approach.preemptive', '先に撃つ。交渉は少し荒れるよ。')
          : action.option === 'hit_and_run_ram'
            ? getMoeLine('moe.run.approach.hit_and_run', 'ひき逃げルート。成功すれば早いけど、車体は削れるよ。')
            : action.option === 'silent_coast'
              ? getMoeLine('moe.run.approach.silent_coast', '静かに寄る。話すならこれが一番マシ。')
              : getMoeLine('moe.run.approach.open_channel', '先に声をかけるね。返事が人間向けとは限らないけど。'),
    };
  }

  return state;
}
