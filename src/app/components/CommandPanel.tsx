import { commandDescriptions, commandOptions } from '../../game/catalogs';
import type { CommandId, GamePhase, RewardOption, State } from '../../game/types';

type Group = 'WEAPON' | 'TERMINAL' | 'DRIVE';

export type SignalChoice = {
  id: string;
  label: string;
  text?: string;
  choiceId: 'analyze_trace' | 'hold_lane' | 'open_radio';
  disabled: boolean;
};

type CommandPanelProps = {
  gamePhase: GamePhase;
  state: State;
  groupOrder: Group[];
  commandEnabledMap: Record<CommandId, boolean>;
  commandAffinityTagMap: Partial<Record<CommandId, string>>;
  contractEnabled: boolean;
  selectedMainGunName: string;
  selectedSubGunName: string;
  selectedSubGunDescription: string;
  selectedSEName: string;
  selectedSEDescription: string;
  getPredictedDamageLabel: (commandId: 'main_gun' | 'sub_gun' | 'se_harpoon' | 'ram') => string;
  getMoeCommandGuide: (commandId: CommandId) => string;
  getDialogueLine: (key: string, fallback: string) => string;
  setHoveredHint: (hint: string) => void;
  clearHoveredHint: () => void;
  onExecuteCommand: (command: CommandId) => void;
  onSelectCommand: (command: CommandId) => void;
  onRewardContinue: () => void;
  onApproachChoose: (option: 'preemptive_main_gun' | 'hit_and_run_ram' | 'silent_coast' | 'open_channel') => void;
  onApproachContinue: () => void;
  onRouteChoice: (lane: 'salvage' | 'signal' | 'push_forward' | 'return_gate') => void;
  onSalvagePick: (rewardId: string) => void;
  signalChoices: SignalChoice[];
  onSignalRouteChoice: (choiceId: 'analyze_trace' | 'hold_lane' | 'open_radio') => void;
  onBossPreviewChoice: (choice: 'challenge' | 'emergency_salvage' | 'return_gate') => void;
  onReturnToSurface: () => void;
  showGarageLaunchConfirm: boolean;
  onGarageEnterNightLoop: () => void;
  onGarageLaunchConfirm: () => void;
  onGarageLaunchCancel: () => void;
  onStartNextRun: () => void;
  onOpenGarage: () => void;
  onRetry: () => void;
  approachMainGunDesc: string;
};

export const CommandPanel = ({
  gamePhase,
  state,
  groupOrder,
  commandEnabledMap,
  commandAffinityTagMap,
  contractEnabled,
  selectedMainGunName,
  selectedSubGunName,
  selectedSubGunDescription,
  selectedSEName,
  selectedSEDescription,
  getPredictedDamageLabel,
  getMoeCommandGuide,
  getDialogueLine,
  setHoveredHint,
  clearHoveredHint,
  onExecuteCommand,
  onSelectCommand,
  onRewardContinue,
  onApproachChoose,
  onApproachContinue,
  onRouteChoice,
  onSalvagePick,
  signalChoices,
  onSignalRouteChoice,
  onBossPreviewChoice,
  onReturnToSurface,
  showGarageLaunchConfirm,
  onGarageEnterNightLoop,
  onGarageLaunchConfirm,
  onGarageLaunchCancel,
  onStartNextRun,
  onOpenGarage,
  onRetry,
  approachMainGunDesc,
}: CommandPanelProps) => (
  <section className={`command-core ${!(gamePhase === 'encounter' || gamePhase === 'boss_encounter') ? 'command-core--standby' : ''}`}>
    <div className="panel-title panel-title--compact">
      <span>COMMAND</span>
      <small>{(gamePhase === 'encounter' || gamePhase === 'boss_encounter') ? 'SELECT ACTION' : gamePhase.toUpperCase()}</small>
    </div>

    {(gamePhase === 'encounter' || gamePhase === 'boss_encounter') && <>
      <div className="command-groups">
        {groupOrder.map((group) => <div key={group} className="command-group">
          <div className="command-group__title">{group}</div>
          <div className="command-window command-list command-window--grid">
            {commandOptions.filter((option) => option.group === group).map((command) => <button
              key={command.id}
              className={`command-button command-button--${command.tone} ${state.encounter.selectedCommand === command.id ? 'is-selected' : ''}`}
              onClick={() => {
                if (commandEnabledMap[command.id]) {
                  onExecuteCommand(command.id);
                  return;
                }
                onSelectCommand(command.id);
              }}
              disabled={!commandEnabledMap[command.id]}
              type="button"
              onMouseEnter={() => {
                const hint = command.id === 'main_gun'
                  ? `主砲 ${selectedMainGunName}。予測DMG ${getPredictedDamageLabel('main_gun')}、残弾 ${state.mainAmmo}。`
                  : command.id === 'sub_gun'
                    ? `副砲 ${selectedSubGunName}。予測DMG ${getPredictedDamageLabel('sub_gun')} / ${selectedSubGunDescription}`
                    : command.id === 'se_harpoon'
                      ? `S-E ${selectedSEName}。予測DMG ${getPredictedDamageLabel('se_harpoon')} / ${selectedSEDescription}（残弾 ${state.seAmmo}）`
                      : command.id === 'contract'
                        ? (
                            contractEnabled
                              ? getDialogueLine('hint.contract.window_open', '契約窓が開いてる。今なら接続できる。')
                              : getDialogueLine('hint.contract.window_closed', '契約窓がまだ開いていない。TalkかS-Eを先に。')
                          )
                        : getMoeCommandGuide(command.id);
                setHoveredHint(hint);
              }}
              onMouseLeave={clearHoveredHint}
              onFocus={() => setHoveredHint(getMoeCommandGuide(command.id))}
              onBlur={clearHoveredHint}
              data-desc={
                command.id === 'main_gun'
                  ? `${selectedMainGunName}: PRED DMG ${getPredictedDamageLabel('main_gun')} / AMMO ${state.mainAmmo}`
                  : command.id === 'sub_gun'
                    ? `${selectedSubGunName}: PRED DMG ${getPredictedDamageLabel('sub_gun')} / ${selectedSubGunDescription}`
                    : command.id === 'se_harpoon'
                      ? `${selectedSEName}: PRED DMG ${getPredictedDamageLabel('se_harpoon')} / ${selectedSEDescription} / S-E AMMO ${state.seAmmo}`
                      : command.id === 'ram'
                        ? `Ram: PRED DMG ${getPredictedDamageLabel('ram')} / ARMOR -1`
                        : command.id === 'contract'
                          ? (contractEnabled ? 'Window Open' : 'No contract window')
                          : commandDescriptions[command.id].description
              }
            >
              <span className="command-button__label">{command.label}</span>
              {commandAffinityTagMap[command.id] && <span className={`command-button__affinity command-button__affinity--${commandAffinityTagMap[command.id]?.toLowerCase()}`}>{commandAffinityTagMap[command.id]}</span>}
            </button>)}
          </div>
        </div>)}
      </div>
      <div className="command-window">
        <div className="command-instant">Tap command to execute instantly</div>
      </div>
    </>}

    {gamePhase === 'reward' && <div className="command-window command-list">
      <button
        className="command-button command-button--route"
        onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.proceed', '回収結果をまとめて次フェーズへ移る。'))}
        onMouseLeave={clearHoveredHint}
        onClick={onRewardContinue}
      >
        PROCEED
      </button>
    </div>}

    {gamePhase === 'approach' && state.approach && <div className="command-window command-list">
      {state.approach.scanSuccess
        ? <>
          <button
            className="command-button command-button--danger"
            onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.approach.preemptive', '先制主砲。接敵前に削るけど交渉は荒れる。'))}
            onMouseLeave={clearHoveredHint}
            onClick={() => onApproachChoose('preemptive_main_gun')}
            disabled={state.mainAmmo <= 0}
            data-desc={approachMainGunDesc}
          >
            Preemptive Main Gun
          </button>
          <button className="command-button command-button--danger" onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.approach.hit_and_run', '轢き逃げ突破。成功すれば接敵を飛ばせる。'))} onMouseLeave={clearHoveredHint} onClick={() => onApproachChoose('hit_and_run_ram')} data-desc="轢き逃げ突破。Armor-1 Fuel-1 / 成功で遭遇回避">
            Hit-and-Run Ram
          </button>
          <button className="command-button command-button--route" onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.approach.silent_coast', '静穏接近。交渉初手を通しやすくする。'))} onMouseLeave={clearHoveredHint} onClick={() => onApproachChoose('silent_coast')} data-desc="静穏接近。Fuel-1 / 初手Talk成功率上昇 / 敵攻勢鈍化">
            Silent Coast
          </button>
          <button
            className="command-button command-button--contract"
            onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.approach.open_channel', '先行交信。契約窓を開けたい時の前振り。'))}
            onMouseLeave={clearHoveredHint}
            onClick={() => onApproachChoose('open_channel')}
            disabled={state.signal <= 0}
            data-desc="先行交信。Signal-1 / interest上昇 / hostile相手は逆上リスク"
          >
            Open Channel
          </button>
        </>
        : <button className="command-button command-button--danger" onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.approach.brace', '不意打ち受領。被害を抑える準備を。'))} onMouseLeave={clearHoveredHint} onClick={onApproachContinue}>
          Brace for Contact
        </button>}
    </div>}

    {gamePhase === 'route_choice' && <div className="command-window command-list">
      <button className="command-button command-button--route" onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.route.salvage', '補給寄りレーン。立て直し向け。'))} onMouseLeave={clearHoveredHint} onClick={() => onRouteChoice('salvage')}>Salvage Lane</button>
      <button className="command-button command-button--route" onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.route.signal', 'Signal寄りレーン。解析と交渉を伸ばせる。'))} onMouseLeave={clearHoveredHint} onClick={() => onRouteChoice('signal')}>Signal Lane</button>
      <button className="command-button command-button--route" onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.route.push_forward', '強行前進。次報酬は良いが被害リスク高。'))} onMouseLeave={clearHoveredHint} onClick={() => onRouteChoice('push_forward')}>Push Forward</button>
      <button className="command-button command-button--danger" onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.route.return_gate', 'ここで帰還。戦果を確実に持ち帰る。'))} onMouseLeave={clearHoveredHint} onClick={() => onRouteChoice('return_gate')}>Return Gate</button>
    </div>}

    {gamePhase === 'salvage' && <div className="command-window command-list">
      {state.rewardOptions.map((option: RewardOption) => <button
        key={option.id}
        className="command-button command-button--route"
        onMouseEnter={() => setHoveredHint(`回収候補: ${option.label} / ${option.detail}`)}
        onMouseLeave={clearHoveredHint}
        onClick={() => onSalvagePick(option.id)}
      >
        {option.label} <span>{option.detail}</span>
      </button>)}
    </div>}

    {gamePhase === 'signal' && <div className="command-window command-list">
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
    </div>}

    {gamePhase === 'boss_preview' && <div className="command-window command-list">
      <button className="command-button command-button--danger" onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.boss.challenge', '深層反応に挑む。高リスク高リターン。'))} onMouseLeave={clearHoveredHint} onClick={() => onBossPreviewChoice('challenge')}>Challenge Deep Signal</button>
      <button className="command-button command-button--route" onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.boss.emergency_salvage', '応急補給してから突入。安定重視。'))} onMouseLeave={clearHoveredHint} onClick={() => onBossPreviewChoice('emergency_salvage')}>Emergency Salvage</button>
      <button className="command-button command-button--route" onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.boss.return_gate', 'ここで撤退。戦果の確保を優先。'))} onMouseLeave={clearHoveredHint} onClick={() => onBossPreviewChoice('return_gate')}>Return Gate</button>
    </div>}

    {gamePhase === 'return_gate' && <div className="command-window command-list">
      <button className="command-button command-button--route" onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.return_to_surface', '帰還処理を実行。地上へ戻る。'))} onMouseLeave={clearHoveredHint} onClick={onReturnToSurface}>RETURN TO SURFACE</button>
    </div>}

    {gamePhase === 'garage' && <div className="command-window command-list">
      {!showGarageLaunchConfirm
        ? <button className="command-button command-button--route" onClick={onGarageEnterNightLoop}>ENTER NIGHT LOOP</button>
        : <>
          <div className="command-window">
            <strong>READY CHECK</strong>
            <p>M.O.E.: 「積み替え、終わった？ このまま夜環へ入る。」</p>
          </div>
          <button className="command-button command-button--danger" onClick={onGarageLaunchConfirm}>YES, ENTER NIGHT LOOP</button>
          <button className="command-button command-button--system" onClick={onGarageLaunchCancel}>NOT YET</button>
        </>}
    </div>}

    {(gamePhase === 'result' || gamePhase === 'game_over') && <div className="command-window command-list">
      <button className="command-button command-button--route" onClick={onStartNextRun}>START NEXT RUN</button>
      <button className="command-button command-button--route" onClick={onOpenGarage}>RETURN TO GARAGE</button>
      <button className="command-button command-button--route" onClick={onRetry}>RETRY</button>
    </div>}

    <small className="command-hint">Keys: ↑↓ command / ←→ target / Enter execute selected</small>
  </section>
);
