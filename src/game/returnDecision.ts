import type { GamePhase, State } from './types';

export type ReturnDecisionStatus = {
  visible: boolean;
  tone: 'safe' | 'risk' | 'locked';
  checkpointLabel: 'Return Point: reached' | 'Return Point: not reached';
  actionLabel: 'Safe Extract可能' | 'Backtrack riskあり' | 'Safe Extract不可';
  detail: string;
  moeKey: string;
  moeFallback: string;
};

const activeRunPhases: GamePhase[] = [
  'approach',
  'encounter',
  'reward',
  'route_choice',
  'salvage',
  'signal',
  'boss_preview',
  'boss_encounter',
  'return_gate',
];

export const getReturnDecisionStatus = (state: State): ReturnDecisionStatus => {
  const visible = activeRunPhases.includes(state.gamePhase);
  const hasCheckpoint = !!state.routeState?.lastReturnCheckpointId;
  const atCheckpoint = !!state.routeState?.lastReturnCheckpointId
    && state.routeState.currentNodeId === state.routeState.lastReturnCheckpointId;
  const safeExtractPossible = state.gamePhase === 'return_gate' || atCheckpoint;
  const backtrackRiskActive = hasCheckpoint && !safeExtractPossible;

  if (safeExtractPossible) {
    return {
      visible,
      tone: 'safe',
      checkpointLabel: 'Return Point: reached',
      actionLabel: 'Safe Extract可能',
      detail: '帰還点を確保済み。ここで抜ければ、獲得物を安全に持ち帰れる。',
      moeKey: 'moe.return_status.safe',
      moeFallback: '帰還点、確保。帰る判断もちゃんと仕事だよ。',
    };
  }

  if (backtrackRiskActive) {
    return {
      visible,
      tone: 'risk',
      checkpointLabel: 'Return Point: reached',
      actionLabel: 'Backtrack riskあり',
      detail: '帰還点までは戻れる。ただしFuel / Armor / Signalの小リスクを受ける。',
      moeKey: 'moe.return_status.backtrack',
      moeFallback: '戻るなら今。逃げじゃなくて、持ち帰るための運転。',
    };
  }

  return {
    visible,
    tone: 'locked',
    checkpointLabel: 'Return Point: not reached',
    actionLabel: 'Safe Extract不可',
    detail: 'まだ安全帰還点を掴んでいない。全損時は一部だけ持ち帰る。',
    moeKey: 'moe.return_status.locked',
    moeFallback: 'まだ帰還点が遠い。無理はできるけど、保証は薄いよ。',
  };
};
