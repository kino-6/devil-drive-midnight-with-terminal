import { getNaviRouteCandidates, getNaviRouteIntelStatus } from '../../state/routeGraph';
import type { RewardOption, State } from '../../../game/types';
import type { SignalChoice } from './types';

type RouteCommandsProps = {
  gamePhase: string;
  state: State;
  rewardOptions: RewardOption[];
  signalChoices: SignalChoice[];
  getDialogueLine: (key: string, fallback: string) => string;
  setHoveredHint: (hint: string) => void;
  clearHoveredHint: () => void;
  onRewardContinue: () => void;
  onRouteChoice: (lane: 'salvage' | 'signal' | 'push_forward' | 'return_gate') => void;
  onSalvagePick: (rewardId: string) => void;
  onSignalRouteChoice: (choiceId: 'analyze_trace' | 'hold_lane' | 'open_radio') => void;
  onBossPreviewChoice: (choice: 'challenge' | 'emergency_salvage' | 'return_gate') => void;
  onReturnExtract: () => void;
  onReturnToSurface: () => void;
};

export const RouteCommands = ({
  gamePhase,
  state,
  rewardOptions,
  signalChoices,
  getDialogueLine,
  setHoveredHint,
  clearHoveredHint,
  onRewardContinue,
  onRouteChoice,
  onSalvagePick,
  onSignalRouteChoice,
  onBossPreviewChoice,
  onReturnExtract,
  onReturnToSurface,
}: RouteCommandsProps) => {
  if (gamePhase === 'reward') {
    return <div className="command-window command-list">
      <button
        className="command-button command-button--route"
        onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.proceed', '回収結果をまとめて次フェーズへ移る。'))}
        onMouseLeave={clearHoveredHint}
        onClick={onRewardContinue}
      >
        PROCEED
      </button>
    </div>;
  }

  if (gamePhase === 'route_choice') {
    const naviCandidates = getNaviRouteCandidates(state);
    const intelStatus = getNaviRouteIntelStatus(state);
    if (naviCandidates.length > 0) {
      return <div className="command-window command-list">
        {intelStatus.isLimited && (
          <div className={`command-alert command-alert--${intelStatus.level}`}>
            <strong>{intelStatus.label}</strong>
            <span>{intelStatus.detail}</span>
          </div>
        )}
        {naviCandidates.map((candidate) => (
          <button
            key={`${candidate.nodeId}-${candidate.choiceId}`}
            className={candidate.choiceId === 'return_gate' ? 'command-button command-button--danger' : 'command-button command-button--route'}
            onMouseEnter={() => setHoveredHint(candidate.body ?? `${candidate.title} / ${candidate.forecast.join(' > ')} / risk: ${candidate.risk} / reward: ${candidate.reward}`)}
            onMouseLeave={clearHoveredHint}
            onClick={() => onRouteChoice(candidate.choiceId)}
          >
            {candidate.title} <span>{candidate.forecast.join(' > ')} / BOSS IN {candidate.bossSteps ?? '--'}</span>
          </button>
        ))}
      </div>;
    }

    return <div className="command-window command-list">
      <button className="command-button command-button--route" onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.route.salvage', '補給寄りレーン。立て直し向け。'))} onMouseLeave={clearHoveredHint} onClick={() => onRouteChoice('salvage')}>Salvage Lane</button>
      <button className="command-button command-button--route" onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.route.signal', 'Signal寄りレーン。解析と交渉を伸ばせる。'))} onMouseLeave={clearHoveredHint} onClick={() => onRouteChoice('signal')}>Signal Lane</button>
      <button className="command-button command-button--route" onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.route.push_forward', '強行前進。次報酬は良いが被害リスク高。'))} onMouseLeave={clearHoveredHint} onClick={() => onRouteChoice('push_forward')}>Push Forward</button>
      <button className="command-button command-button--danger" onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.route.return_gate', 'ここで帰還。戦果を確実に持ち帰る。'))} onMouseLeave={clearHoveredHint} onClick={() => onRouteChoice('return_gate')}>Return Gate</button>
    </div>;
  }

  if (gamePhase === 'salvage') {
    return <div className="command-window command-list">
      {rewardOptions.map((option: RewardOption) => <button
        key={option.id}
        className="command-button command-button--route"
        onMouseEnter={() => setHoveredHint(`回収候補: ${option.label} / ${option.detail}`)}
        onMouseLeave={clearHoveredHint}
        onClick={() => onSalvagePick(option.id)}
      >
        {option.label} <span>{option.detail}</span>
      </button>)}
    </div>;
  }

  if (gamePhase === 'signal') {
    return <div className="command-window command-list">
      {signalChoices.map((choice) => (
        <button
          key={choice.id}
          className={choice.choiceId === 'open_radio' ? 'command-button command-button--contract' : 'command-button command-button--route'}
          onMouseEnter={() => setHoveredHint(choice.text || '')}
          onMouseLeave={clearHoveredHint}
          onClick={() => onSignalRouteChoice(choice.choiceId)}
          disabled={choice.disabled}
        >
          {choice.label}
        </button>
      ))}
    </div>;
  }

  if (gamePhase === 'boss_preview') {
    return <div className="command-window command-list">
      <button className="command-button command-button--danger" onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.boss.challenge', '深層反応に挑む。高リスク高リターン。'))} onMouseLeave={clearHoveredHint} onClick={() => onBossPreviewChoice('challenge')}>Challenge Deep Signal</button>
      <button className="command-button command-button--route" onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.boss.emergency_salvage', '応急補給してから突入。安定重視。'))} onMouseLeave={clearHoveredHint} onClick={() => onBossPreviewChoice('emergency_salvage')}>Emergency Salvage</button>
      <button className="command-button command-button--route" onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.boss.return_gate', '帰還ポイントまで戻る。途中で小さな撤退リスクがある。'))} onMouseLeave={clearHoveredHint} onClick={() => onBossPreviewChoice('return_gate')}>Backtrack</button>
    </div>;
  }

  if (gamePhase === 'return_gate') {
    const label = state.resultType === 'Boss Cleared' ? 'RETURN TO SURFACE' : 'SAFE EXTRACT';
    return <div className="command-window command-list">
      <button
        className="command-button command-button--route"
        onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.return_to_surface', '帰還処理を実行。地上へ戻る。'))}
        onMouseLeave={clearHoveredHint}
        onClick={state.resultType === 'Boss Cleared' ? onReturnToSurface : onReturnExtract}
      >
        {label}
      </button>
    </div>;
  }

  return null;
};
