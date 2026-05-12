import { getBalanceConfig } from '../../balanceConfig';
import { getMainGunSpec, getSpecialEquipmentSpec, isAlive } from '../../game/runtimeHelpers';
import { canPayConversationChoiceCost } from '../../game/talkRules';
import type { Action, ApproachOption, AutoPlayReport, AutoPlayStrategy, CommandId, Loadout, ResultType, RewardOption, State } from '../../game/types';
import { getRouteChoiceTargetNodeId } from './routeGraph';

export type AutoplayReducerDeps = {
  initState: () => State;
  reducer: (state: State, action: Action) => State;
};

const getSelectedEnemy = (state: State) =>
  state.encounter.enemies.find((enemy) => enemy.id === state.encounter.selectedEnemyId && isAlive(enemy))
  ?? state.encounter.enemies.find(isAlive);

const chooseAutoplayReward = (state: State): RewardOption => {
  const auto = getBalanceConfig().autoplay;
  const options = state.rewardOptions;
  const lowArmor = state.armor <= auto.rewardArmorPriority;
  const lowFuel = state.fuel <= auto.rewardFuelPriority;
  const lowSignal = state.signal <= auto.rewardSignalPriority;
  const lowAmmo = state.mainAmmo <= 1;
  const lowSeAmmo = state.seAmmo <= 1;
  if (lowArmor) return options.find((r) => r.armor) ?? options[0];
  if (lowFuel) return options.find((r) => r.fuel) ?? options[0];
  if (lowSignal) return options.find((r) => r.signal) ?? options[0];
  if (lowSeAmmo) return options.find((r) => r.seAmmo) ?? options[0];
  if (lowAmmo) return options.find((r) => r.mainAmmo) ?? options[0];
  return options.find((r) => r.mainAmmo) ?? options[0];
};

const chooseAutoplayRoute = (state: State, strategy: AutoPlayStrategy): 'salvage' | 'signal' | 'push_forward' | 'return_gate' => {
  const auto = getBalanceConfig().autoplay;
  if (strategy === 'safe' && (state.armor <= 3 || state.fuel <= 2)) return 'return_gate';
  if (state.signal <= 2) return 'signal';
  if (state.armor <= 5 || state.fuel <= 3 || state.mainAmmo <= 1) return 'salvage';
  if (strategy === 'aggressive') return 'push_forward';
  if (strategy === 'contract') return 'signal';
  if (Math.random() < auto.pushForwardChance) return 'push_forward';
  return 'salvage';
};

const chooseAutoplayBossPreview = (state: State, strategy: AutoPlayStrategy): 'challenge' | 'emergency_salvage' | 'return_gate' => {
  const auto = getBalanceConfig().autoplay;
  if (state.armor <= auto.bossReturnArmor || state.fuel <= auto.bossReturnFuel) return 'return_gate';
  if (
    state.mainAmmo <= auto.bossPrepMainAmmo
    || state.seAmmo <= auto.bossPrepSeAmmo
    || state.armor <= auto.bossPrepArmor
    || state.fuel <= auto.bossPrepFuel
    || state.signal <= auto.bossPrepSignal
  ) return 'emergency_salvage';
  if (strategy === 'contract' && state.signal <= auto.bossPrepSignal) return 'emergency_salvage';
  return 'challenge';
};

const chooseAutoplayCommand = (state: State, strategy: AutoPlayStrategy): CommandId => {
  const auto = getBalanceConfig().autoplay;
  const selected = getSelectedEnemy(state);
  const alive = state.encounter.enemies.filter(isAlive);
  if (!selected || alive.length === 0) return 'guard';
  const mainGun = getMainGunSpec(state.selectedLoadout.mainGunId);
  const se = getSpecialEquipmentSpec(state.selectedLoadout.specialEquipmentId);

  if (selected.contractWindow && selected.contractable) return 'contract';
  if ((!selected.revealed || !state.encounter.analyzedEnemyIds.includes(selected.id)) && state.signal > 0) return 'analyze';
  if (strategy === 'contract' && selected.contractable && selected.pressure <= 2 && !selected.contractWindow) {
    if (state.seAmmo >= se.seAmmoCost) return 'se_harpoon';
    return 'talk';
  }
  if (selected.contractable && selected.pressure <= 1 && selected.hp > 2 && Math.random() < auto.talkProbeChance) return 'talk';
  if (state.gamePhase === 'boss_encounter' && state.mainAmmo > 0) return 'main_gun';
  if (state.mainAmmo > 0 && selected.hp >= mainGun.damage) return 'main_gun';
  if (alive.length >= 2) return 'sub_gun';
  if (state.seAmmo >= se.seAmmoCost && selected.hp > 1) return 'se_harpoon';
  if (state.armor <= 3 && state.fuel > 0 && Math.random() < 0.4) return 'escape';
  if (state.mainAmmo > 0) return 'main_gun';
  if (state.seAmmo >= se.seAmmoCost) return 'se_harpoon';
  if (state.armor > 1) return 'ram';
  return 'guard';
};

const chooseAutoplayTalkChoiceId = (state: State): string | undefined => {
  const conversation = state.activeConversation;
  if (!conversation || conversation.choices.length === 0) return undefined;
  const target = state.encounter.enemies.find((enemy) => enemy.id === conversation.enemyId);
  const affordable = conversation.choices.filter((choice) => canPayConversationChoiceCost(choice, state));

  const pick = (...attitudes: Array<string>) =>
    affordable.find((choice) => choice.attitude && attitudes.includes(choice.attitude))
    ?? conversation.choices.find((choice) => choice.attitude && attitudes.includes(choice.attitude));

  if (conversation.choices.some((choice) => choice.attitude === 'pay')) {
    return pick('pay', 'bargain', 'refuse', 'threaten')?.id ?? conversation.choices[0].id;
  }

  if (conversation.mood === 'aggressive') {
    return pick('listen', 'offer', 'logic', 'challenge')?.id ?? conversation.choices[0].id;
  }
  if (conversation.mood === 'desperate') {
    return pick('offer', 'bargain', 'listen', 'logic')?.id ?? conversation.choices[0].id;
  }

  if (target && state.encounter.analyzedEnemyIds.includes(target.id)) {
    if (target.temperament === 'hungry') return pick('offer', 'listen', 'logic', 'bargain')?.id ?? conversation.choices[0].id;
    if (target.temperament === 'machine') return pick('logic', 'listen', 'offer')?.id ?? conversation.choices[0].id;
    if (target.temperament === 'lonely') return pick('listen', 'flatter', 'offer')?.id ?? conversation.choices[0].id;
    if (target.temperament === 'proud') return pick('flatter', 'challenge', 'logic')?.id ?? conversation.choices[0].id;
    if (target.temperament === 'curious') return pick('joke', 'logic', 'offer')?.id ?? conversation.choices[0].id;
    if (target.temperament === 'hostile') return pick('challenge', 'threaten', 'logic')?.id ?? conversation.choices[0].id;
  }

  return pick('listen', 'logic', 'offer', 'bargain')?.id ?? conversation.choices[0].id;
};

export const runAutoplayBatchWithDeps = (loadout: Loadout, runs: number, strategy: AutoPlayStrategy, deps: AutoplayReducerDeps): AutoPlayReport => {
  const total = Math.max(1, Math.min(1000, Math.floor(runs)));
  const counts: Record<ResultType, number> = {
    'Early Return': 0,
    'Boss Cleared': 0,
    'Boss Avoided': 0,
    'Vehicle Disabled': 0,
    'Fun Test Complete': 0,
  };
  let sumEncounters = 0;
  let sumContracts = 0;
  let sumSalvage = 0;
  let sumFuel = 0;
  let sumArmor = 0;
  let sumSignal = 0;
  let sumMainAmmo = 0;
  let sumSeAmmo = 0;

  for (let i = 0; i < total; i += 1) {
    let s = deps.initState();
    s = { ...s, gamePhase: 'garage', selectedLoadout: { ...loadout }, logs: [] };
    s = deps.reducer(s, { type: 'GARAGE_ENTER_RUN' });
    let guard = 0;
    while (guard < 800 && !(s.gamePhase === 'result' || s.gamePhase === 'game_over')) {
      if (s.gamePhase === 'approach') {
        if (s.approach?.scanSuccess) {
          const choice: ApproachOption =
            strategy === 'aggressive'
              ? 'preemptive_main_gun'
              : strategy === 'contract'
                ? (s.signal > 0 ? 'open_channel' : 'silent_coast')
                : strategy === 'safe'
                  ? 'silent_coast'
                  : (s.mainAmmo > 0 ? 'preemptive_main_gun' : 'silent_coast');
          s = deps.reducer(s, { type: 'APPROACH_CHOOSE', option: choice });
        } else {
          s = deps.reducer(s, { type: 'APPROACH_CONTINUE' });
        }
      } else if (s.gamePhase === 'encounter' || s.gamePhase === 'boss_encounter') {
        if (s.encounter.phase === 'conversation') {
          const choiceId = chooseAutoplayTalkChoiceId(s);
          if (choiceId) {
            s = deps.reducer(s, { type: 'TALK_CHOOSE', choiceId });
          } else {
            s = deps.reducer(s, { type: 'TALK_CANCEL' });
          }
          guard += 1;
          continue;
        }
        const command = chooseAutoplayCommand(s, strategy);
        s = deps.reducer(s, { type: 'EXECUTE_COMMAND', command });
      } else if (s.gamePhase === 'reward') {
        s = deps.reducer(s, { type: 'REWARD_CONTINUE' });
      } else if (s.gamePhase === 'route_choice') {
        const lane = chooseAutoplayRoute(s, strategy);
        const nodeId = getRouteChoiceTargetNodeId(s, lane);
        s = nodeId
          ? deps.reducer(s, { type: 'ROUTE_NODE_CHOOSE', nodeId })
          : deps.reducer(s, { type: 'ROUTE_CHOICE', lane });
      } else if (s.gamePhase === 'salvage') {
        const reward = chooseAutoplayReward(s);
        s = deps.reducer(s, { type: 'SALVAGE_PICK', rewardId: reward.id });
      } else if (s.gamePhase === 'signal') {
        s = deps.reducer(s, { type: 'SIGNAL_ROUTE_CHOICE', choiceId: 'analyze_trace' });
      } else if (s.gamePhase === 'boss_preview') {
        const choice = chooseAutoplayBossPreview(s, strategy);
        const nodeId = getRouteChoiceTargetNodeId(s, choice);
        s = nodeId
          ? deps.reducer(s, { type: 'ROUTE_NODE_CHOOSE', nodeId })
          : deps.reducer(s, { type: 'BOSS_PREVIEW_CHOICE', choice });
      } else if (s.gamePhase === 'return_gate') {
        s = deps.reducer(s, { type: s.resultType === 'Boss Cleared' ? 'RETURN_TO_SURFACE' : 'RETURN_EXTRACT' });
      } else if (s.gamePhase === 'garage') {
        s = deps.reducer(s, { type: 'GARAGE_ENTER_RUN' });
      } else if (s.gamePhase === 'prologue') {
        s = deps.reducer(s, { type: 'START_ENGINE' });
      } else {
        break;
      }
      guard += 1;
    }
    const result = s.resultType ?? (s.gamePhase === 'game_over' ? 'Vehicle Disabled' : 'Early Return');
    counts[result] += 1;
    sumEncounters += s.runSummary.cleared;
    sumContracts += s.runSummary.contracted;
    sumSalvage += s.salvageCredits;
    sumFuel += s.fuel;
    sumArmor += s.armor;
    sumSignal += s.signal;
    sumMainAmmo += s.mainAmmo;
    sumSeAmmo += s.seAmmo;
  }

  return {
    runs: total,
    strategy,
    winRate: ((counts['Boss Cleared'] + counts['Boss Avoided'] + counts['Early Return']) / total) * 100,
    avgEncounters: sumEncounters / total,
    avgContracts: sumContracts / total,
    avgSalvage: sumSalvage / total,
    avgFuel: sumFuel / total,
    avgArmor: sumArmor / total,
    avgSignal: sumSignal / total,
    avgMainAmmo: sumMainAmmo / total,
    avgSeAmmo: sumSeAmmo / total,
    counts,
  };
};
