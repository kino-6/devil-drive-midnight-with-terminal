import { AssetFigure } from '../../components/EncounterVisuals';
import type {
  AutoPlayReport,
  AutoPlayStrategy,
  ContractSupportId,
  FunTestId,
  MainGunId,
  SpecialEquipmentId,
  State,
  SubGunId,
  UpgradeId,
  VehicleUpgradeId,
} from '../../game/types';
import type { MoeMemoryEntry, RouteLogEntry, RunRecord, SaveData } from '../../saveSystem';
import { GarageStageSelect } from './garage/GarageStageSelect';
import { GaragePreviousRunSection } from './garage/GaragePreviousRunSection';
import { GarageLoadoutSection } from './garage/GarageLoadoutSection';
import { GarageGrowthSection } from './garage/GarageGrowthSection';
import type { StageProfile } from './garage/types';

type GaragePanelProps = {
  visible: boolean;
  state: State;
  moeAsset?: string;
  garageImage?: string;
  selectedStageProfile: StageProfile;
  selectedStageAdvisory: string;
  stageProfiles: StageProfile[];
  nextRunPreview: { fuel: number; armor: number; signal: number; mainAmmo: number; seAmmo: number };
  showGarageLaunchConfirm: boolean;
  showRunHistory: boolean;
  saveSnapshot: SaveData;
  latestRunRecord?: RunRecord;
  latest3Runs: RunRecord[];
  routeLogEntries: RouteLogEntry[];
  moeMemoryEntries: MoeMemoryEntry[];
  canUpdateDriverSkill: boolean;
  canUpdateMoeSkill: boolean;
  canUpdateVehicleTune: boolean;
  autoplayRuns: number;
  autoplayStrategy: AutoPlayStrategy;
  autoplayReport: AutoPlayReport | null;
  autoplayMinRuns: number;
  autoplayMaxRuns: number;
  onSetShowRunHistory: (next: boolean) => void;
  onGarageEnterNightLoop: () => void;
  onGarageLaunchConfirm: () => void;
  onGarageLaunchCancel: () => void;
  onSetStage: (stage: number) => void;
  onSetMainGun: (id: MainGunId) => void;
  onSetSubGun: (id: SubGunId) => void;
  onSetSpecial: (id: SpecialEquipmentId) => void;
  onSetSupport: (id: ContractSupportId) => void;
  onPurchaseSkill: (upgrade: UpgradeId) => void;
  onPurchaseVehicleUpgrade: (id: VehicleUpgradeId) => void;
  onPurchaseUnlock: (id: string) => void;
  onSetAutoplayRuns: (runs: number) => void;
  onSetAutoplayStrategy: (strategy: AutoPlayStrategy) => void;
  onRunAutoplay: () => void;
  onStartFunTest: (id: FunTestId) => void;
};

export const GaragePanel = ({
  visible,
  state,
  moeAsset,
  garageImage,
  selectedStageProfile,
  selectedStageAdvisory,
  stageProfiles,
  nextRunPreview,
  showGarageLaunchConfirm,
  showRunHistory,
  saveSnapshot,
  latestRunRecord,
  latest3Runs,
  routeLogEntries,
  moeMemoryEntries,
  canUpdateDriverSkill,
  canUpdateMoeSkill,
  canUpdateVehicleTune,
  autoplayRuns,
  autoplayStrategy,
  autoplayReport,
  autoplayMinRuns,
  autoplayMaxRuns,
  onSetShowRunHistory,
  onGarageEnterNightLoop,
  onGarageLaunchConfirm,
  onGarageLaunchCancel,
  onSetStage,
  onSetMainGun,
  onSetSubGun,
  onSetSpecial,
  onSetSupport,
  onPurchaseSkill,
  onPurchaseVehicleUpgrade,
  onPurchaseUnlock,
  onSetAutoplayRuns,
  onSetAutoplayStrategy,
  onRunAutoplay,
  onStartFunTest,
}: GaragePanelProps) => {
  if (!visible) return null;

  return (
    <section className="event-card garage-grid-card">
      <div className="event-header">
        <div className="event-kicker">GARAGE // MIDNIGHT BAY</div>
        <span className="event-chip event-chip--route">LOADOUT READY</span>
      </div>
      <h2>Next Sortie Setup</h2>
      <p>
        <AssetFigure
          src={moeAsset}
          alt=""
          className="radio-panel__avatar radio-panel__avatar--moe"
          fallback={<></>}
          transparencyMode="auto-corner"
        />
        M.O.E.: 「{state.moeLine}」
      </p>
      {garageImage && <div className="garage-visual">
        <img src={garageImage} alt="Midnight Bay Garage" loading="lazy" decoding="async" />
      </div>}

      <GarageStageSelect
        stageProfiles={stageProfiles}
        stageCount={state.stageCount}
        selectedStage={state.stage}
        selectedStageProfile={selectedStageProfile}
        selectedStageAdvisory={selectedStageAdvisory}
        showGarageLaunchConfirm={showGarageLaunchConfirm}
        nextRunPreview={nextRunPreview}
        onSetStage={onSetStage}
        onGarageEnterNightLoop={onGarageEnterNightLoop}
        onGarageLaunchConfirm={onGarageLaunchConfirm}
        onGarageLaunchCancel={onGarageLaunchCancel}
      />

      <div className="garage-block garage-fun-test">
        <div className="event-header">
          <div className="event-kicker">FUN TEST MODE</div>
          <span className="event-chip event-chip--route">1 ENCOUNTER</span>
        </div>
        <div className="garage-fun-test__buttons">
          <button className="command-button command-button--contract" type="button" onClick={() => onStartFunTest('pixie_talk')}>
            Test Pixie Talk
          </button>
          <button className="command-button command-button--danger" type="button" onClick={() => onStartFunTest('road_reaper_combat')}>
            Test Road Reaper Combat
          </button>
          <button className="command-button command-button--route" type="button" onClick={() => onStartFunTest('toll_gate_boss')}>
            Test Toll Gate Boss
          </button>
        </div>
      </div>

      <div className="garage-columns">
        <GaragePreviousRunSection
          saveSnapshot={saveSnapshot}
          latestRunRecord={latestRunRecord}
          latest3Runs={latest3Runs}
          showRunHistory={showRunHistory}
          onSetShowRunHistory={onSetShowRunHistory}
          routeLogEntries={routeLogEntries}
          moeMemoryEntries={moeMemoryEntries}
          story={state.story}
        />

        <GarageLoadoutSection
          state={state}
          onSetMainGun={onSetMainGun}
          onSetSubGun={onSetSubGun}
          onSetSpecial={onSetSpecial}
          onSetSupport={onSetSupport}
        />

        <GarageGrowthSection
          state={state}
          canUpdateDriverSkill={canUpdateDriverSkill}
          canUpdateMoeSkill={canUpdateMoeSkill}
          canUpdateVehicleTune={canUpdateVehicleTune}
          autoplayRuns={autoplayRuns}
          autoplayStrategy={autoplayStrategy}
          autoplayReport={autoplayReport}
          autoplayMinRuns={autoplayMinRuns}
          autoplayMaxRuns={autoplayMaxRuns}
          onPurchaseSkill={onPurchaseSkill}
          onPurchaseVehicleUpgrade={onPurchaseVehicleUpgrade}
          onPurchaseUnlock={onPurchaseUnlock}
          onSetAutoplayRuns={onSetAutoplayRuns}
          onSetAutoplayStrategy={onSetAutoplayStrategy}
          onRunAutoplay={onRunAutoplay}
        />
      </div>
    </section>
  );
};
