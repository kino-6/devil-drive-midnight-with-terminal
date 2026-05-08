import type { CommandId, GamePhase, RewardOption, State } from '../../game/types';
import { EncounterCommands } from './command/EncounterCommands';
import { ApproachCommands } from './command/ApproachCommands';
import { RouteCommands } from './command/RouteCommands';
import { GarageCommands } from './command/GarageCommands';
import { ResultCommands } from './command/ResultCommands';
import type { SignalChoice } from './command/types';

type Group = 'WEAPON' | 'TERMINAL' | 'DRIVE';

export type { SignalChoice };

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
  onTalkChoose: (choiceId: string) => void;
  onTalkCancel: () => void;
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
  onTalkChoose,
  onTalkCancel,
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

    {(gamePhase === 'encounter' || gamePhase === 'boss_encounter') && (
      <EncounterCommands
        state={state}
        groupOrder={groupOrder}
        commandEnabledMap={commandEnabledMap}
        commandAffinityTagMap={commandAffinityTagMap}
        contractEnabled={contractEnabled}
        selectedMainGunName={selectedMainGunName}
        selectedSubGunName={selectedSubGunName}
        selectedSubGunDescription={selectedSubGunDescription}
        selectedSEName={selectedSEName}
        selectedSEDescription={selectedSEDescription}
        getPredictedDamageLabel={getPredictedDamageLabel}
        getMoeCommandGuide={getMoeCommandGuide}
        getDialogueLine={getDialogueLine}
        setHoveredHint={setHoveredHint}
        clearHoveredHint={clearHoveredHint}
        onExecuteCommand={onExecuteCommand}
        onSelectCommand={onSelectCommand}
        onTalkChoose={onTalkChoose}
        onTalkCancel={onTalkCancel}
      />
    )}

    <ApproachCommands
      state={state}
      approachMainGunDesc={approachMainGunDesc}
      getDialogueLine={getDialogueLine}
      setHoveredHint={setHoveredHint}
      clearHoveredHint={clearHoveredHint}
      onApproachChoose={onApproachChoose}
      onApproachContinue={onApproachContinue}
    />

    <RouteCommands
      gamePhase={gamePhase}
      state={state}
      rewardOptions={state.rewardOptions as RewardOption[]}
      signalChoices={signalChoices}
      getDialogueLine={getDialogueLine}
      setHoveredHint={setHoveredHint}
      clearHoveredHint={clearHoveredHint}
      onRewardContinue={onRewardContinue}
      onRouteChoice={onRouteChoice}
      onSalvagePick={onSalvagePick}
      onSignalRouteChoice={onSignalRouteChoice}
      onBossPreviewChoice={onBossPreviewChoice}
      onReturnToSurface={onReturnToSurface}
    />

    {gamePhase === 'garage' && (
      <GarageCommands
        showGarageLaunchConfirm={showGarageLaunchConfirm}
        onGarageEnterNightLoop={onGarageEnterNightLoop}
        onGarageLaunchConfirm={onGarageLaunchConfirm}
        onGarageLaunchCancel={onGarageLaunchCancel}
      />
    )}

    {(gamePhase === 'result' || gamePhase === 'game_over') && (
      <ResultCommands
        onStartNextRun={onStartNextRun}
        onOpenGarage={onOpenGarage}
        onRetry={onRetry}
      />
    )}

    <small className="command-hint">Keys: ↑↓ command / ←→ target / Enter execute selected</small>
  </section>
);
