import { getDialogueLine } from '../../dialogueConfig';
import type { Action, ResultType, State } from '../../game/types';
import { emergencyRewardCatalog, rewardCatalog } from '../../game/catalogs';
import { appendSupportDaemonDisconnectLogs } from '../../game/runtimeHelpers';
import { applyRunUnlockRewards, formatUnlockRewardLog } from '../../game/progression';
import { getSupportBacklashChance } from '../../game/vehicleUpgrades';
import { getRareSalvageLog, getRareSalvageMoeLine, isRareSalvageReward, maybeAddRareSalvageReward } from '../../game/rareEvents';
import { applyRewardOption, pickRewardChoices } from './stateRuntime';
import { moveToApproach } from './approachReducer';
import { appendRecoveredStoryLogLines, getRunGrowth, makePreviousRunSummary, resolveStoryFromRun } from './storyProgression';

type ApproachRouteKind = State['encounter']['kind'];

const applySilentShapeBacklash = (
  state: State,
  logs: string[],
  fuel = state.fuel,
): { fuel: number; logs: string[] } => {
  if (state.selectedLoadout.contractSupportId !== 'silent_shape') return { fuel, logs };
  if (Math.random() >= getSupportBacklashChance(0.2, state.vehicleUpgrades)) return { fuel, logs };
  return {
    fuel: Math.max(0, fuel - 1),
    logs: [...logs, '> SUPPORT BACKLASH: SILENT SHAPE / FUEL -1'],
  };
};

const completeRunAtReturnGate = (state: State, resultType: ResultType, moeLine: string): State => {
  const story = resolveStoryFromRun(state, resultType);
  const disconnectLogs = appendSupportDaemonDisconnectLogs(state.logs, state.activeSupportDaemon, 'return_gate');
  return {
    ...state,
    gamePhase: 'result',
    resultType,
    activeSupportDaemon: undefined,
    story,
    logs: appendRecoveredStoryLogLines([...disconnectLogs, '> RETURN GATE ROUTE OPEN', '> RUN COMPLETE'], story),
    moeLine,
  };
};

const nextRouteEncounterKind = (toBoss: boolean): ApproachRouteKind => (toBoss ? 'boss' : 'enc2');

export function reduceRoute(state: State, action: Action): State {
  if (action.type === 'REWARD_CONTINUE') {
    if (state.gamePhase !== 'reward') return state;
    if (state.rewardScope === 'post_enc1') {
      return {
        ...state,
        gamePhase: 'route_choice',
        logs: [...state.logs, '> ROUTE CHOICE AVAILABLE'],
        moeLine: getDialogueLine('moe.run.route_choice', '次の車線を選んで。補給・信号強化・強行突破・帰還、どれも正解になり得る。'),
      };
    }
    return {
      ...state,
      gamePhase: 'boss_preview',
      logs: [...state.logs, '> DEEP SIGNAL DETECTED: TOLL GATE SAINT'],
      moeLine: getDialogueLine('moe.run.boss_preview', '料金所型の強い反応。無理なら引き返そ。'),
    };
  }

  if (action.type === 'ROUTE_CHOICE') {
    if (state.gamePhase !== 'route_choice') return state;
    if (action.lane === 'return_gate') {
      return completeRunAtReturnGate(
        state,
        'Early Return',
        getDialogueLine('moe.run.route_return', '帰るのも仕事だよ。持ち帰れなきゃ、全部ゼロ。'),
      );
    }
    if (action.lane === 'salvage') {
      const rewards = maybeAddRareSalvageReward(state, pickRewardChoices(rewardCatalog));
      return {
        ...state,
        gamePhase: 'salvage',
        rewardTarget: 'encounter2',
        rewardOptions: rewards,
        logs: [...state.logs, '> SALVAGE LANE SELECTED'],
        moeLine: getDialogueLine('moe.run.salvage_ready', '補給反応あり。ひとつだけ拾える。'),
      };
    }
    if (action.lane === 'signal') {
      const signalGain = state.selectedLoadout.contractSupportId === 'radio_voice' ? 2 : 1;
      const forecastGain = state.selectedLoadout.contractSupportId === 'radio_voice' ? 2 : 1;
      const signalLogs = [...state.logs, '> SIGNAL LANE SELECTED', `> SIGNAL +${signalGain}`];
      if (state.selectedLoadout.contractSupportId === 'radio_voice' && Math.random() < getSupportBacklashChance(0.4, state.vehicleUpgrades)) signalLogs.push('> WARNING: AM 666.0 FALSE CARRIER');
      return {
        ...state,
        gamePhase: 'signal',
        signal: state.signal + signalGain,
        tempForecastBoost: forecastGain,
        logs: signalLogs,
        moeLine: getDialogueLine('moe.run.route_signal', '信号帯がクリアになった。次の予測が少し長く見える。'),
      };
    }
    const pushedRoute = applySilentShapeBacklash(state, [...state.logs, '> PUSH FORWARD SELECTED', '> ENCOUNTER 2: FORWARD CONTACT']);
    return moveToApproach({
      ...state,
      fuel: pushedRoute.fuel,
      routeBoostReward: true,
      logs: pushedRoute.logs,
      encounterIndex: 1,
      moeLine: getDialogueLine('moe.run.route_push', '回復なしで進むのね。報酬は少し盛れるかも。'),
    }, 'enc2');
  }

  if (action.type === 'SALVAGE_PICK') {
    if (state.gamePhase !== 'salvage') return state;
    const selected = state.rewardOptions.find((reward) => reward.id === action.rewardId);
    if (!selected) return state;
    if (isRareSalvageReward(selected.id)) {
      const toBoss = state.rewardTarget === 'boss';
      const nextKind = nextRouteEncounterKind(toBoss);
      const logs = [...state.logs, `> ${getRareSalvageLog(selected.id)}`, `> ${toBoss ? 'BOSS CONTACT' : 'ENCOUNTER 2: SIGNAL CONTACT'}`];
      return moveToApproach({
        ...state,
        rewardTarget: undefined,
        tempForecastBoost: 0,
        logs,
        bossChallenged: toBoss ? true : state.bossChallenged,
        encounterIndex: toBoss ? 2 : 1,
        moeLine: getRareSalvageMoeLine(selected.id),
      }, nextKind);
    }
    const patched = applyRewardOption(state, selected);
    const toBoss = state.rewardTarget === 'boss';
    const nextKind = nextRouteEncounterKind(toBoss);
    const rewardedRoute = applySilentShapeBacklash(
      state,
      [...state.logs, `> SALVAGE APPLIED: ${selected.label.toUpperCase()}`, `> ${toBoss ? 'BOSS CONTACT' : 'ENCOUNTER 2: SIGNAL CONTACT'}`],
      patched.fuel,
    );
    return moveToApproach({
      ...state,
      ...patched,
      fuel: rewardedRoute.fuel,
      rewardTarget: undefined,
      tempForecastBoost: 0,
      logs: rewardedRoute.logs,
      bossChallenged: toBoss ? true : state.bossChallenged,
      encounterIndex: toBoss ? 2 : 1,
      moeLine: toBoss ? '応急補給完了。Toll Gate Saintへ向かう。' : '補給完了。次の区画へ。',
    }, nextKind);
  }

  if (action.type === 'SIGNAL_ROUTE_CHOICE' || action.type === 'SIGNAL_CONTINUE') {
    if (state.gamePhase !== 'signal') return state;
    const selectedChoice = action.type === 'SIGNAL_ROUTE_CHOICE' ? action.choiceId : 'hold_lane';
    let normalizedChoice: 'analyze_trace' | 'hold_lane' | 'open_radio' = selectedChoice;
    let signal = state.signal;
    let fuel = state.fuel;
    let tempForecastBoost = state.tempForecastBoost;
    const logs = [...state.logs];
    const prepSeed: Partial<State['encounterPrep']> = {};

    if (normalizedChoice === 'analyze_trace') {
      logs.push('> SIGNAL TUNNEL CHOICE: ANALYZE TRACE');
      if (signal <= 0) {
        logs.push('> WARNING: SIGNAL TOO LOW / TRACE DOWNGRADED');
        normalizedChoice = 'hold_lane';
      } else {
        signal = Math.max(0, signal - 1);
        tempForecastBoost += 1;
        prepSeed.intentDisrupted = true;
        prepSeed.approachLabel = 'TRACE LOCK';
        logs.push('> MEMORY TRACE ISOLATED', '> FORECAST LANE BOOSTED');
      }
    }
    if (normalizedChoice === 'open_radio') {
      logs.push('> SIGNAL TUNNEL CHOICE: OPEN RADIO CHANNEL');
      if (signal <= 0) {
        logs.push('> WARNING: SIGNAL TOO LOW / CHANNEL CLOSED');
        normalizedChoice = 'hold_lane';
      } else {
        signal = Math.max(0, signal - 1);
        prepSeed.talkPrepared = true;
        prepSeed.firstTalkBonus = 0.12;
        prepSeed.firstTalkPending = true;
        prepSeed.approachLabel = 'OPEN CHANNEL';
        logs.push('> AM 666.0 CHANNEL OPEN', '> TALK HANDSHAKE PREPARED');
      }
    }
    if (normalizedChoice === 'hold_lane') {
      logs.push('> SIGNAL TUNNEL CHOICE: KEEP DRIVING', '> LANE HOLD / CONTACT PRIORITY');
      prepSeed.approachLabel = 'LANE HOLD';
    }

    logs.push('> ENCOUNTER 2: SIGNAL CONTACT');
    const signaledRoute = applySilentShapeBacklash(state, logs, fuel);
    return moveToApproach({
      ...state,
      signal,
      fuel: signaledRoute.fuel,
      encounterIndex: 1,
      tempForecastBoost,
      logs: signaledRoute.logs,
      moeLine:
        normalizedChoice === 'analyze_trace'
          ? '断片ログを掴んだ。次接敵の読みは少し深い。'
          : normalizedChoice === 'open_radio'
            ? 'AM帯を開いた。最初の会話は通しやすい。'
            : '速度維持で抜ける。接敵優先で行くよ。',
    }, 'enc2', [], prepSeed);
  }

  if (action.type === 'BOSS_PREVIEW_CHOICE') {
    if (state.gamePhase !== 'boss_preview') return state;
    if (action.choice === 'return_gate') {
      return completeRunAtReturnGate(
        state,
        'Boss Avoided',
        getDialogueLine('moe.run.boss_return', '引き返す判断、正解。持ち帰ることが最優先。'),
      );
    }
    if (action.choice === 'emergency_salvage') {
      const emergencyPool = state.routeBoostReward
        ? emergencyRewardCatalog.map((reward) => (reward.mainAmmo ? { ...reward, detail: 'Main Ammo +3', mainAmmo: 3 } : reward))
        : emergencyRewardCatalog;
      return {
        ...state,
        gamePhase: 'salvage',
        rewardTarget: 'boss',
        rewardOptions: pickRewardChoices(emergencyPool),
        logs: [...state.logs, '> EMERGENCY SALVAGE OPEN'],
        moeLine: getDialogueLine('moe.run.salvage_to_boss', '主砲弾か装甲を足してから行ける。選んで。'),
      };
    }
    const bossRoute = applySilentShapeBacklash(state, [...state.logs, '> BOSS ENCOUNTER: TOLL GATE SAINT']);
    return moveToApproach({
      ...state,
      fuel: bossRoute.fuel,
      encounterIndex: 2,
      bossChallenged: true,
      tempForecastBoost: 0,
      logs: bossRoute.logs,
      moeLine: getDialogueLine('moe.run.boss_start', '深層料金所、突入。主砲を温存しすぎないで。'),
    }, 'boss');
  }

  if (action.type === 'RETURN_TO_SURFACE') {
    if (state.gamePhase !== 'return_gate') return state;
    const resultType = state.resultType ?? 'Boss Cleared';
    const disconnectLogs = appendSupportDaemonDisconnectLogs(state.logs, state.activeSupportDaemon, 'return_gate');
    const unlockedAbyssLoop = resultType === 'Boss Cleared' && state.stageCount < 4 && state.stage >= 3;
    if (resultType === 'Boss Cleared' && state.stage < state.stageCount) {
      const growth = getRunGrowth(state);
      const story = resolveStoryFromRun(state, resultType);
      const unlockRewards = applyRunUnlockRewards({ ...state, resultType, story });
      const unlockLogs = unlockRewards.newlyUnlocked.map(formatUnlockRewardLog);
      const nextStage = state.stage + 1;
      return {
        ...state,
        gamePhase: 'garage',
        stage: nextStage,
        activeSupportDaemon: undefined,
        story,
        previousRun: makePreviousRunSummary(state, resultType),
        driverXpBank: state.driverXpBank + growth.driverXp,
        moeSyncBank: state.moeSyncBank + growth.moeSync,
        creditBank: state.creditBank + growth.salvageCreditGain,
        unlocks: unlockRewards.unlocks,
        growthClaimed: true,
        logs: appendRecoveredStoryLogLines([
          ...disconnectLogs,
          ...unlockLogs,
          `> STAGE CLEAR: ${state.stage}/${state.stageCount}`,
          `> NEXT STAGE PREP: ${nextStage}/${state.stageCount}`,
          '> GARAGE: MIDNIGHT BAY ONLINE',
        ], story),
        moeLine: `ステージ${state.stage}突破。次は深くなる、装備を組み直そう。`,
      };
    }
    const story = resolveStoryFromRun(state, resultType);
    return {
      ...state,
      gamePhase: 'result',
      resultType,
      stageCount: unlockedAbyssLoop ? 4 : state.stageCount,
      activeSupportDaemon: undefined,
      story,
      logs: appendRecoveredStoryLogLines([
        ...disconnectLogs,
        ...(unlockedAbyssLoop ? ['> ABYSS LOOP UNLOCKED: STAGE 4'] : []),
        '> RUN COMPLETE',
      ], story),
      moeLine: unlockedAbyssLoop
        ? '深層封鎖鍵が外れた。次から最深層、Abyss Loopに入れる。'
        : getDialogueLine('moe.run.result', '帰れたね。積んだもの、確認しよっか。'),
    };
  }

  return state;
}
