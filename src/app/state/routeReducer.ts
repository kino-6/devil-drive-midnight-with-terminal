import type { Action, ResultType, RewardOption, State } from '../../game/types';
import { getMoeLine } from '../../game/moeDialogue';
import { emergencyRewardCatalog, rewardCatalog } from '../../game/catalogs';
import { appendSupportDaemonDisconnectLogs } from '../../game/runtimeHelpers';
import { applyRunUnlockRewards, formatUnlockRewardLog } from '../../game/progression';
import { getSupportBacklashChance } from '../../game/vehicleUpgrades';
import { getRareSalvageLog, getRareSalvageMoeLine, isRareSalvageReward, maybeAddRareSalvageReward } from '../../game/rareEvents';
import { getEventById, getEventsByPool } from '../../eventConfig';
import { applyRewardOption, pickRewardChoices } from './stateRuntime';
import { moveToApproach } from './approachReducer';
import { getRouteChoiceTargetNodeId, getRouteNextNodeId, getStageRouteNode, moveRouteStateToNode } from './routeGraph';
import { appendRecoveredStoryLogLines, getRunGrowth, makePreviousRunSummary, resolveStoryFromRun } from './storyProgression';

type ApproachRouteKind = State['encounter']['kind'];
type RouteLaneChoice = Extract<Action, { type: 'ROUTE_CHOICE' }>['lane'];
type BossPreviewChoice = Extract<Action, { type: 'BOSS_PREVIEW_CHOICE' }>['choice'];

const isRouteLaneChoice = (value: string | undefined): value is RouteLaneChoice =>
  value === 'salvage' || value === 'signal' || value === 'push_forward' || value === 'return_gate';

const isBossPreviewChoice = (value: string | undefined): value is BossPreviewChoice =>
  value === 'challenge' || value === 'emergency_salvage' || value === 'return_gate';

const getCurrentChoiceIdForTargetNode = (state: State, nodeId: string): string | undefined => {
  const choices = getStageRouteNode(state)?.choices;
  if (!choices) return undefined;
  return Object.entries(choices).find(([, targetNodeId]) => targetNodeId === nodeId)?.[0];
};

const checkpointLogForCurrentNode = (state: State): string[] =>
  state.routeState?.lastReturnCheckpointId && state.routeState.currentNodeId === state.routeState.lastReturnCheckpointId
    ? ['> RETURN CHECKPOINT REACHED']
    : [];

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
    logs: appendRecoveredStoryLogLines([
      ...disconnectLogs,
      '> RETURN GATE ROUTE OPEN',
      ...(state.routeState?.returnIntent === 'extracting' ? ['> SAFE EXTRACT USED'] : []),
      '> RUN COMPLETE',
    ], story),
    moeLine,
  };
};

const withReturnIntent = (state: State, returnIntent: NonNullable<State['routeState']>['returnIntent']): State => ({
  ...state,
  routeState: state.routeState ? { ...state.routeState, returnIntent } : state.routeState,
});

const getBacktrackRiskEvent = (state: State) => {
  const pool = getEventsByPool(`return.stage_${state.stage}`);
  if (pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
};

const prioritizeSalvageEventReward = (
  rewards: RewardOption[],
  eventId: string | undefined,
  catalog: RewardOption[],
): RewardOption[] => {
  const rewardId = getEventById(eventId)?.rewardId;
  if (!rewardId || rewards.some((reward) => reward.id === rewardId)) return rewards;
  const eventReward = catalog.find((reward) => reward.id === rewardId);
  if (!eventReward) return rewards;
  return [eventReward, ...rewards.slice(0, Math.max(0, rewards.length - 1))];
};

const backtrackToReturnCheckpoint = (state: State, resultType: ResultType): State => {
  const checkpointId = state.routeState?.lastReturnCheckpointId;
  if (!checkpointId) {
    return completeRunAtReturnGate(
      state,
      resultType,
      getMoeLine('moe.run.route_return', '帰るのも仕事だよ。持ち帰れなきゃ、全部ゼロ。', undefined, 'soft'),
    );
  }

  const graphState = withReturnIntent(moveRouteStateToNode(state, checkpointId), 'backtracking');
  const risk = getBacktrackRiskEvent(graphState);
  const logs = [...graphState.logs, '> BACKTRACK STARTED'];
  let fuel = graphState.fuel;
  let armor = graphState.armor;
  let signal = graphState.signal;
  if (risk) logs.push(`> ${risk.log ?? `RETURN RISK: ${risk.title.toUpperCase()}`}`);
  const tags = risk?.tags ?? [];
  if (tags.includes('fuel')) {
    fuel = Math.max(0, fuel - 1);
    logs.push('> FUEL -1');
  } else if (tags.includes('armor')) {
    armor = Math.max(0, armor - 1);
    logs.push('> ARMOR -1');
  } else if (tags.includes('signal')) {
    signal = Math.max(0, signal - 1);
    logs.push('> SIGNAL -1');
  } else {
    signal = Math.max(0, signal - 1);
    logs.push('> SIGNAL -1');
  }

  if (fuel <= 0 || armor <= 0) {
    const disabledType: ResultType = 'Vehicle Disabled';
    const story = resolveStoryFromRun(graphState, disabledType);
    const disconnectLogs = appendSupportDaemonDisconnectLogs(logs, graphState.activeSupportDaemon, 'archive');
    return {
      ...graphState,
      gamePhase: 'game_over',
      resultType: disabledType,
      fuel,
      armor,
      signal,
      activeSupportDaemon: undefined,
      story,
      logs: appendRecoveredStoryLogLines([...disconnectLogs, '> SIGNAL LOST', '> VEHICLE DISABLED DURING BACKTRACK'], story),
      moeLine: getMoeLine('moe.run.game_over', '応答して。……だめ、車両信号が落ちてる。', undefined, 'flustered'),
    };
  }

  return {
    ...graphState,
    gamePhase: 'return_gate',
    resultType,
    fuel,
    armor,
    signal,
    logs: [...logs, '> RETURN CHECKPOINT REACHED'],
    moeLine: risk?.moeLine ?? getMoeLine('moe.run.return_checkpoint', '帰還チェックポイントに戻った。ここからなら安全に抜けられる。', undefined, 'soft'),
  };
};

const nextRouteEncounterKind = (toBoss: boolean): ApproachRouteKind => (toBoss ? 'boss' : 'enc2');

const enterRouteNode = (state: State, nodeId: string): State => {
  const graphState = moveRouteStateToNode(state, nodeId);
  const node = getStageRouteNode(graphState, nodeId);
  if (!node) return state;

  if (node.type === 'route_choice') {
    return {
      ...graphState,
      gamePhase: 'route_choice',
      logs: [...graphState.logs, ...checkpointLogForCurrentNode(graphState), '> ROUTE CHOICE AVAILABLE'],
      moeLine: getMoeLine('moe.run.route_choice', '次の車線を選んで。補給・信号強化・強行突破・帰還、どれも正解になり得る。'),
    };
  }

  if (node.type === 'salvage') {
    const toBoss = node.next === 'boss_contact';
    const rewardPool = toBoss ? emergencyRewardCatalog : rewardCatalog;
    return {
      ...graphState,
      gamePhase: 'salvage',
      rewardTarget: toBoss ? 'boss' : 'encounter2',
      rewardOptions: prioritizeSalvageEventReward(pickRewardChoices(rewardPool), graphState.routeState?.currentEventId, rewardPool),
      logs: [...graphState.logs, `> ROUTE NODE: ${node.label.toUpperCase()}`],
      moeLine: toBoss
        ? getMoeLine('moe.run.salvage_to_boss', '主砲弾か装甲を足してから行ける。選んで。', undefined, 'serious')
        : getMoeLine('moe.run.salvage_ready', '補給反応あり。ひとつだけ拾える。'),
    };
  }

  if (node.type === 'signal') {
    return {
      ...graphState,
      gamePhase: 'signal',
      logs: [...graphState.logs, `> ROUTE NODE: ${node.label.toUpperCase()}`],
      moeLine: getMoeLine('moe.run.route_signal', '信号帯がクリアになった。次の予測が少し長く見える。', undefined, 'proud'),
    };
  }

  if (node.type === 'boss_preview') {
    return {
      ...graphState,
      gamePhase: 'boss_preview',
      logs: [...graphState.logs, '> DEEP SIGNAL DETECTED: TOLL GATE SAINT'],
      moeLine: getMoeLine('moe.run.boss_preview', '料金所型の反応。無理なら引き返そ。', undefined, 'serious'),
    };
  }

  if (node.type === 'return_checkpoint' || node.type === 'return_gate') {
    return {
      ...graphState,
      gamePhase: 'return_gate',
      logs: [...graphState.logs, '> RETURN GATE ROUTE OPEN'],
      moeLine: getMoeLine('moe.run.return_gate_seen', '帰還ゲート、見えた。まだ車は動くね。', undefined, 'soft'),
    };
  }

  if (node.type === 'extract') {
    return completeRunAtReturnGate(
      withReturnIntent(graphState, 'extracting'),
      graphState.resultType ?? 'Early Return',
      getMoeLine('moe.run.route_return', '帰るのも仕事だよ。持ち帰れなきゃ、全部ゼロ。', undefined, 'soft'),
    );
  }

  if (node.type === 'encounter' || node.type === 'boss') {
    const kind = node.encounterKind ?? (node.type === 'boss' ? 'boss' : 'enc2');
    const encounterIndex = kind === 'enc1' ? 0 : kind === 'enc2' ? 1 : 2;
    return moveToApproach({
      ...graphState,
      encounterIndex,
      bossChallenged: kind === 'boss' ? true : graphState.bossChallenged,
      tempForecastBoost: kind === 'boss' ? 0 : graphState.tempForecastBoost,
      logs: [...graphState.logs, `> ROUTE NODE: ${node.label.toUpperCase()}`],
    }, kind);
  }

  if (node.type === 'result') {
    return { ...graphState, gamePhase: 'result' };
  }

  return graphState;
};

export function reduceRoute(state: State, action: Action): State {
  if (action.type === 'ROUTE_NODE_CHOOSE') {
    const choiceId = getCurrentChoiceIdForTargetNode(state, action.nodeId);
    if (state.gamePhase === 'route_choice' && isRouteLaneChoice(choiceId)) {
      return reduceRoute(state, { type: 'ROUTE_CHOICE', lane: choiceId });
    }
    if (state.gamePhase === 'boss_preview' && isBossPreviewChoice(choiceId)) {
      return reduceRoute(state, { type: 'BOSS_PREVIEW_CHOICE', choice: choiceId });
    }
    return enterRouteNode(state, action.nodeId);
  }

  if (action.type === 'REWARD_CONTINUE') {
    if (state.gamePhase !== 'reward') return state;
    if (state.rewardScope === 'post_enc1') {
      const graphState = moveRouteStateToNode(state, getRouteNextNodeId(state) ?? 'post_encounter_1');
      return {
      ...graphState,
      gamePhase: 'route_choice',
      logs: [...graphState.logs, ...checkpointLogForCurrentNode(graphState), '> ROUTE CHOICE AVAILABLE'],
      moeLine: getMoeLine('moe.run.route_choice', '次の車線を選んで。補給・信号強化・強行突破・帰還、どれも正解になり得る。'),
    };
    }
    const graphState = moveRouteStateToNode(state, getRouteNextNodeId(state) ?? 'boss_preview');
    return {
      ...graphState,
      gamePhase: 'boss_preview',
      logs: [...graphState.logs, '> DEEP SIGNAL DETECTED: TOLL GATE SAINT'],
      moeLine: getMoeLine('moe.run.boss_preview', '料金所型の強い反応。無理なら引き返そ。', undefined, 'serious'),
    };
  }

  if (action.type === 'ROUTE_CHOICE') {
    if (state.gamePhase !== 'route_choice') return state;
    if (action.lane === 'return_gate') {
      const graphState = moveRouteStateToNode(state, getRouteChoiceTargetNodeId(state, action.lane) ?? 'early_return');
      if (state.routeState?.lastReturnCheckpointId && state.routeState.currentNodeId !== state.routeState.lastReturnCheckpointId) {
        return backtrackToReturnCheckpoint(graphState, 'Early Return');
      }
      return completeRunAtReturnGate(
        withReturnIntent(graphState, 'extracting'),
        'Early Return',
        getMoeLine('moe.run.route_return', '帰るのも仕事だよ。持ち帰れなきゃ、全部ゼロ。', undefined, 'soft'),
      );
    }
    if (action.lane === 'salvage') {
      const graphState = moveRouteStateToNode(state, getRouteChoiceTargetNodeId(state, action.lane) ?? 'salvage_lane');
      const rewards = maybeAddRareSalvageReward(
        state,
        prioritizeSalvageEventReward(pickRewardChoices(rewardCatalog), graphState.routeState?.currentEventId, rewardCatalog),
      );
      return {
        ...graphState,
        gamePhase: 'salvage',
        rewardTarget: 'encounter2',
        rewardOptions: rewards,
        logs: [...graphState.logs, '> SALVAGE LANE SELECTED'],
        moeLine: getMoeLine('moe.run.salvage_ready', '補給反応あり。ひとつだけ拾える。'),
      };
    }
    if (action.lane === 'signal') {
      const graphState = moveRouteStateToNode(state, getRouteChoiceTargetNodeId(state, action.lane) ?? 'signal_tunnel');
      const signalGain = state.selectedLoadout.contractSupportId === 'radio_voice' ? 2 : 1;
      const forecastGain = state.selectedLoadout.contractSupportId === 'radio_voice' ? 2 : 1;
      const signalLogs = [...graphState.logs, '> SIGNAL LANE SELECTED', `> SIGNAL +${signalGain}`];
      if (state.selectedLoadout.contractSupportId === 'radio_voice' && Math.random() < getSupportBacklashChance(0.4, state.vehicleUpgrades)) signalLogs.push('> WARNING: AM 666.0 FALSE CARRIER');
      return {
        ...graphState,
        gamePhase: 'signal',
        signal: state.signal + signalGain,
        tempForecastBoost: forecastGain,
        logs: signalLogs,
        moeLine: getMoeLine('moe.run.route_signal', '信号帯がクリアになった。次の予測が少し長く見える。', undefined, 'proud'),
      };
    }
    const graphState = moveRouteStateToNode(state, getRouteChoiceTargetNodeId(state, action.lane) ?? 'forward_contact');
    const pushedRoute = applySilentShapeBacklash(state, [...graphState.logs, '> PUSH FORWARD SELECTED', '> ENCOUNTER 2: FORWARD CONTACT']);
    return moveToApproach({
      ...graphState,
      fuel: pushedRoute.fuel,
      routeBoostReward: true,
      logs: pushedRoute.logs,
      encounterIndex: 1,
      moeLine: getMoeLine('moe.run.route_push', '回復なしで進むのね。報酬は少し盛れるかも。'),
    }, 'enc2');
  }

  if (action.type === 'SALVAGE_PICK') {
    if (state.gamePhase !== 'salvage') return state;
    const selected = state.rewardOptions.find((reward) => reward.id === action.rewardId);
    if (!selected) return state;
    if (isRareSalvageReward(selected.id)) {
      const toBoss = state.rewardTarget === 'boss';
      const nextKind = nextRouteEncounterKind(toBoss);
      const graphState = moveRouteStateToNode(state, getRouteNextNodeId(state) ?? (toBoss ? 'boss_contact' : 'encounter_2'));
      const logs = [...graphState.logs, `> ${getRareSalvageLog(selected.id)}`, `> ${toBoss ? 'BOSS CONTACT' : 'ENCOUNTER 2: SIGNAL CONTACT'}`];
      return moveToApproach({
        ...graphState,
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
    const graphState = moveRouteStateToNode(state, getRouteNextNodeId(state) ?? (toBoss ? 'boss_contact' : 'encounter_2'));
    const rewardedRoute = applySilentShapeBacklash(
      state,
      [...graphState.logs, `> SALVAGE APPLIED: ${selected.label.toUpperCase()}`, `> ${toBoss ? 'BOSS CONTACT' : 'ENCOUNTER 2: SIGNAL CONTACT'}`],
      patched.fuel,
    );
    return moveToApproach({
      ...graphState,
      ...patched,
      fuel: rewardedRoute.fuel,
      rewardTarget: undefined,
      tempForecastBoost: 0,
      logs: rewardedRoute.logs,
      bossChallenged: toBoss ? true : state.bossChallenged,
      encounterIndex: toBoss ? 2 : 1,
      moeLine: toBoss
        ? getMoeLine('moe.run.salvage_to_boss_done', '応急補給完了。Toll Gate Saintへ向かう。', undefined, 'serious')
        : getMoeLine('moe.run.salvage_done', '補給完了。次の区画へ。'),
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
    const graphState = moveRouteStateToNode(state, getRouteNextNodeId(state) ?? 'encounter_2');
    return moveToApproach({
      ...graphState,
      signal,
      fuel: signaledRoute.fuel,
      encounterIndex: 1,
      tempForecastBoost,
      logs: signaledRoute.logs,
      moeLine:
        normalizedChoice === 'analyze_trace'
          ? getMoeLine('moe.run.signal.analyze_trace', '断片ログを掴んだ。次接敵の読みは少し深い。', undefined, 'proud')
          : normalizedChoice === 'open_radio'
            ? getMoeLine('moe.run.signal.open_radio', 'AM帯を開いた。最初の会話は通しやすい。')
            : getMoeLine('moe.run.signal.hold_lane', '速度維持で抜ける。接敵優先で行くよ。'),
    }, 'enc2', [], prepSeed);
  }

  if (action.type === 'BOSS_PREVIEW_CHOICE') {
    if (state.gamePhase !== 'boss_preview') return state;
    if (action.choice === 'return_gate') {
      const graphState = moveRouteStateToNode(state, getRouteChoiceTargetNodeId(state, action.choice) ?? 'boss_return');
      if (state.routeState?.lastReturnCheckpointId) return backtrackToReturnCheckpoint(graphState, 'Boss Avoided');
      return completeRunAtReturnGate(
        withReturnIntent(graphState, 'extracting'),
        'Boss Avoided',
        getMoeLine('moe.run.boss_return', '引き返す判断、正解。持ち帰ることが最優先。', undefined, 'soft'),
      );
    }
    if (action.choice === 'emergency_salvage') {
      const graphState = moveRouteStateToNode(state, getRouteChoiceTargetNodeId(state, action.choice) ?? 'boss_salvage');
      const emergencyPool = state.routeBoostReward
        ? emergencyRewardCatalog.map((reward) => (reward.mainAmmo ? { ...reward, detail: 'Main Ammo +3', mainAmmo: 3 } : reward))
        : emergencyRewardCatalog;
      return {
        ...graphState,
        gamePhase: 'salvage',
        rewardTarget: 'boss',
        rewardOptions: prioritizeSalvageEventReward(pickRewardChoices(emergencyPool), graphState.routeState?.currentEventId, emergencyPool),
        logs: [...graphState.logs, '> EMERGENCY SALVAGE OPEN'],
        moeLine: getMoeLine('moe.run.salvage_to_boss', '主砲弾か装甲を足してから行ける。選んで。', undefined, 'serious'),
      };
    }
    const graphState = moveRouteStateToNode(state, getRouteChoiceTargetNodeId(state, action.choice) ?? 'boss_contact');
    const bossRoute = applySilentShapeBacklash(state, [...graphState.logs, '> BOSS ENCOUNTER: TOLL GATE SAINT']);
    return moveToApproach({
      ...graphState,
      fuel: bossRoute.fuel,
      encounterIndex: 2,
      bossChallenged: true,
      tempForecastBoost: 0,
      logs: bossRoute.logs,
      moeLine: getMoeLine('moe.run.boss_start', '深層料金所、突入。主砲を温存しすぎないで。', undefined, 'serious'),
    }, 'boss');
  }

  if (action.type === 'RETURN_BACKTRACK') {
    if (!(state.gamePhase === 'route_choice' || state.gamePhase === 'boss_preview')) return state;
    return backtrackToReturnCheckpoint(state, state.resultType ?? (state.gamePhase === 'boss_preview' ? 'Boss Avoided' : 'Early Return'));
  }

  if (action.type === 'RETURN_EXTRACT') {
    if (state.gamePhase !== 'return_gate') return state;
    return reduceRoute(withReturnIntent(state, 'extracting'), { type: 'RETURN_TO_SURFACE' });
  }

  if (action.type === 'RETURN_TO_SURFACE') {
    if (state.gamePhase !== 'return_gate') return state;
    const graphState = withReturnIntent(moveRouteStateToNode(state, getRouteNextNodeId(state) ?? 'result'), 'extracting');
    const resultType = state.resultType ?? 'Boss Cleared';
    const disconnectLogs = appendSupportDaemonDisconnectLogs(graphState.logs, graphState.activeSupportDaemon, 'return_gate');
    const unlockedAbyssLoop = resultType === 'Boss Cleared' && graphState.stageCount < 4 && graphState.stage >= 3;
    if (resultType === 'Boss Cleared' && graphState.stage < graphState.stageCount) {
      const growth = getRunGrowth(graphState);
      const story = resolveStoryFromRun(graphState, resultType);
      const unlockRewards = applyRunUnlockRewards({ ...graphState, resultType, story });
      const unlockLogs = unlockRewards.newlyUnlocked.map(formatUnlockRewardLog);
      const nextStage = graphState.stage + 1;
      return {
        ...graphState,
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
          ...(graphState.routeState?.returnIntent === 'extracting' ? ['> SAFE EXTRACT USED'] : []),
          `> STAGE CLEAR: ${graphState.stage}/${graphState.stageCount}`,
          `> NEXT STAGE PREP: ${nextStage}/${graphState.stageCount}`,
          '> GARAGE: MIDNIGHT BAY ONLINE',
        ], story),
        moeLine: getMoeLine('moe.run.stage_clear', 'ステージ{stage}突破。次は深くなる、装備を組み直そう。', { stage: graphState.stage }, 'proud'),
      };
    }
    const story = resolveStoryFromRun(graphState, resultType);
    return {
      ...graphState,
      gamePhase: 'result',
      resultType,
      stageCount: unlockedAbyssLoop ? 4 : graphState.stageCount,
      activeSupportDaemon: undefined,
      story,
      logs: appendRecoveredStoryLogLines([
        ...disconnectLogs,
        ...(graphState.routeState?.returnIntent === 'extracting' ? ['> SAFE EXTRACT USED'] : []),
        ...(unlockedAbyssLoop ? ['> ABYSS LOOP UNLOCKED: STAGE 4'] : []),
        '> RUN COMPLETE',
      ], story),
      moeLine: unlockedAbyssLoop
        ? getMoeLine('moe.run.abyss_unlocked', '深層封鎖鍵が外れた。次から最深層、Abyss Loopに入れる。', undefined, 'serious')
        : getMoeLine('moe.run.result', '帰れたね。積んだもの、確認しよっか。', undefined, 'soft'),
    };
  }

  return state;
}
