import { clamp } from '../../game/runtimeHelpers';
import { AssetFigure } from '../../components/EncounterVisuals';
import {
  contractSupportCatalog,
  garageMainGunOrder,
  garageSEOrder,
  garageSubGunOrder,
  garageSupportOrder,
  mainGunCatalog,
  skillLabels,
  specialEquipmentCatalog,
  storyLogCatalog,
  subGunCatalog,
  vehicleUpgradeLabels,
} from '../../game/catalogs';
import { getMainGunSpec, getSpecialEquipmentSpec, getSubGunSpec } from '../../game/runtimeHelpers';
import { getDialogueLine } from '../../dialogueConfig';
import { resultLabel } from '../../game/runInsights';
import { getSkillCost, getVehicleUpgradeCost } from '../state/stateReducer';
import type {
  AutoPlayReport,
  AutoPlayStrategy,
  ContractSupportId,
  MainGunId,
  SpecialEquipmentId,
  State,
  SubGunId,
  UpgradeId,
  VehicleUpgradeId,
} from '../../game/types';
import type { MoeMemoryEntry, RouteLogEntry, RunRecord, SaveData } from '../../saveSystem';

type StageProfile = {
  id: number;
  label: string;
  subtitle: string;
  hoverHint: string;
};

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
  onSetAutoplayRuns: (runs: number) => void;
  onSetAutoplayStrategy: (strategy: AutoPlayStrategy) => void;
  onRunAutoplay: () => void;
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
  onSetAutoplayRuns,
  onSetAutoplayStrategy,
  onRunAutoplay,
}: GaragePanelProps) => {
  if (!visible) return null;

  const skillOrder: UpgradeId[] = ['ram_control', 'gunnery', 'scan_boost', 'translation_assist'];
  const vehicleUpgradeOrder: VehicleUpgradeId[] = ['fuel_tank', 'armor_plating', 'ammo_rack', 'se_rack'];

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
          alt="M.O.E."
          className="radio-panel__avatar radio-panel__avatar--moe"
          fallback={<></>}
          transparencyMode="auto-corner"
        />
        M.O.E.: 「{state.moeLine}」
      </p>
      {garageImage && <div className="garage-visual">
        <img src={garageImage} alt="Midnight Bay Garage" loading="lazy" decoding="async" />
      </div>}
      <div className="command-window">
        <strong>STAGE SELECT</strong>
        <div className="garage-select-grid">
          {stageProfiles
            .filter((profile) => profile.id <= state.stageCount)
            .map((profile) => <button
              key={`stage-${profile.id}`}
              className={`command-button command-button--route ${state.stage === profile.id ? 'is-selected' : ''}`}
              onClick={() => onSetStage(profile.id)}
              data-desc={profile.hoverHint}
            >
              {profile.label}
            </button>)}
        </div>
        <small>
          現在選択: {selectedStageProfile.label}
          {' / '}
          {selectedStageProfile.subtitle}
        </small>
        <small>戦力判定: {selectedStageAdvisory}</small>
        {state.stageCount < 4 && <small>最深層 `ABYSS LOOP` は Stage 3突破で解放。</small>}
      </div>
      <div className="command-window command-list">
        {!showGarageLaunchConfirm
          ? <button className="command-button command-button--route" onClick={onGarageEnterNightLoop}>ENTER NIGHT LOOP</button>
          : <>
            <div className="command-window">
              <strong>Sortie Confirmation</strong>
              <p>Fuel {nextRunPreview.fuel} / Armor {nextRunPreview.armor} / Signal {nextRunPreview.signal} / Main {nextRunPreview.mainAmmo} / S-E {nextRunPreview.seAmmo}</p>
              <p>M.O.E.: 「準備完了なら、出る。まだならここで調整して。」</p>
            </div>
            <button className="command-button command-button--danger" onClick={onGarageLaunchConfirm}>CONFIRM SORTIE</button>
            <button className="command-button command-button--system" onClick={onGarageLaunchCancel}>KEEP TUNING</button>
          </>}
      </div>
      <div className="garage-columns">
        <div className="garage-block">
          <details className="garage-fold">
            <summary>PREVIOUS RUN</summary>
            <div className="garage-fold__body">
              <div className="negotiation-grid">
                <p><span>Total Runs</span><strong>{saveSnapshot.totalRuns}</strong></p>
                <p><span>Best Result</span><strong>{saveSnapshot.bestResult ?? '-'}</strong></p>
                <p><span>Demon Archive</span><strong>{Object.keys(saveSnapshot.demonArchive).length}</strong></p>
                <p><span>Route Log</span><strong>{Object.keys(saveSnapshot.routeLog).length}</strong></p>
                <p><span>M.O.E. Memory</span><strong>{Object.keys(saveSnapshot.moeMemory).length}</strong></p>
                <p><span>Run History</span><strong>{saveSnapshot.runHistory.length}</strong></p>
              </div>
              {latestRunRecord
                ? <div className="negotiation-grid">
                  <p><span>Result</span><strong>{resultLabel(latestRunRecord.resultType)}</strong></p>
                  <p><span>Ended</span><strong>{new Date(latestRunRecord.endedAt).toLocaleString()}</strong></p>
                  <p><span>Encounters</span><strong>{latestRunRecord.encountersCleared}</strong></p>
                  <p><span>Boss</span><strong>{latestRunRecord.bossChallenged ? (latestRunRecord.bossCleared ? 'Cleared' : 'Challenged') : 'Not challenged'}</strong></p>
                  <p><span>Contracts</span><strong>{latestRunRecord.contractsAcquired.length}</strong></p>
                  <p><span>Return Gate</span><strong>{latestRunRecord.returnGateUsed ? 'Used' : 'No'}</strong></p>
                  <p><span>Final</span><strong>{latestRunRecord.finalResources.fuel}/{latestRunRecord.finalResources.armor}/{latestRunRecord.finalResources.signal}/{latestRunRecord.finalResources.mainAmmo}/{latestRunRecord.finalResources.seAmmo}</strong></p>
                </div>
                : <p>{getDialogueLine('ui.common.no_previous_run', 'No previous run data')}</p>}
              {latestRunRecord && <div className="command-window">
                <strong>M.O.E. Suggestion</strong>
                <p>M.O.E.: 「{latestRunRecord.moeComment ?? '-'}」</p>
              </div>}
              <div className="command-window command-list">
                <button className="command-button command-button--system command-button--inline" onClick={() => onSetShowRunHistory(!showRunHistory)}>
                  {showRunHistory ? 'HIDE RUN HISTORY' : 'SHOW RUN HISTORY'}
                </button>
              </div>
              {showRunHistory && <div className="next-node-list">
                {latest3Runs.map((run) => <div key={run.id} className="next-node">
                  <span>◎</span>
                  <strong>{new Date(run.endedAt).toLocaleString()} / {resultLabel(run.resultType)}</strong>
                  <small>contracts: {run.contractsAcquired.length} / boss: {run.bossChallenged ? (run.bossCleared ? 'cleared' : 'challenged') : 'no'} / encounters: {run.encountersCleared}</small>
                </div>)}
              </div>}
            </div>
          </details>
          <details className="garage-fold">
            <summary>ARCHIVE / ROUTE LOG / M.O.E. MEMORY</summary>
            <div className="garage-fold__body">
              <h3>Archive</h3>
              <div className="negotiation-grid">
                <p><span>Chapter</span><strong>{state.story.chapter}</strong></p>
                <p><span>M.O.E. Memory</span><strong>{state.story.moeMemory}</strong></p>
                <p><span>Driver Clues</span><strong>{state.story.previousDriverClues}</strong></p>
                <p><span>Recovered</span><strong>{state.story.recoveredLogs.length}/{storyLogCatalog.length}</strong></p>
              </div>
              <h3>ROUTE LOG</h3>
              <div className="negotiation-grid">
                <p><span>Routes discovered</span><strong>{routeLogEntries.length}</strong></p>
              </div>
              {routeLogEntries.length > 0
                ? <div className="next-node-list">
                  {routeLogEntries.slice(0, 8).map((entry) => <div key={entry.id} className="next-node">
                    <span>◎</span>
                    <strong>{entry.name}</strong>
                    <small>chosen {entry.seenCount}x / {new Date(entry.lastChosenAt).toLocaleString()}</small>
                    <small>{entry.notes?.[0] ?? 'Route trace recorded.'}</small>
                  </div>)}
                </div>
                : <p>No route records yet.</p>}
              <h3>M.O.E. MEMORY</h3>
              <div className="negotiation-grid">
                <p><span>Unlocked memories</span><strong>{moeMemoryEntries.length}</strong></p>
              </div>
              {moeMemoryEntries.length > 0
                ? <div className="next-node-list">
                  {moeMemoryEntries.slice(0, 10).map((entry) => <div key={entry.id} className="next-node">
                    <span>◎</span>
                    <strong>{entry.title}</strong>
                    <small>{entry.text}</small>
                    <small>{new Date(entry.unlockedAt).toLocaleString()} / {entry.source.toUpperCase()}</small>
                  </div>)}
                </div>
                : <p>No memory fragments unlocked yet.</p>}
              <h3>Story Logs</h3>
              <div className="next-node-list">
                {storyLogCatalog.map((entry) => {
                  const unlocked = state.story.recoveredLogs.includes(entry.id);
                  return <div key={entry.id} className="next-node">
                    <span>{unlocked ? '◎' : '□'}</span>
                    <strong>{entry.id}: {entry.title}</strong>
                    <small>{unlocked ? entry.text : 'LOCKED'}</small>
                  </div>;
                })}
              </div>
              <p>M.O.E.: 「{getDialogueLine('moe.garage.memory', '断片が増えるほど、わたしの地図も変わる。')}」</p>
            </div>
          </details>
        </div>
        <div className="garage-block">
          <h3>Loadout</h3>
          <details className="garage-fold" open>
            <summary>MAIN GUN</summary>
            <div className="garage-fold__body">
              <div className="garage-select-grid">
                {garageMainGunOrder.map((id) => <button
                  key={id}
                  className={`command-button command-button--danger ${state.selectedLoadout.mainGunId === id ? 'is-selected' : ''}`}
                  onClick={() => onSetMainGun(id)}
                  data-desc={`DMG ${getMainGunSpec(id).damage} / AMMO ${getMainGunSpec(id).ammo} / ${mainGunCatalog[id].description}`}
                >
                  {mainGunCatalog[id].name}
                </button>)}
              </div>
            </div>
          </details>

          <details className="garage-fold">
            <summary>SUB GUN</summary>
            <div className="garage-fold__body">
              <div className="garage-select-grid">
                {garageSubGunOrder.map((id) => <button
                  key={id}
                  className={`command-button command-button--route ${state.selectedLoadout.subGunId === id ? 'is-selected' : ''}`}
                  onClick={() => onSetSubGun(id)}
                  data-desc={`DMG ${getSubGunSpec(id).damage}${getSubGunSpec(id).hits ? ` / HITS ${getSubGunSpec(id).hits}` : ''} / ${subGunCatalog[id].description}`}
                >
                  {subGunCatalog[id].name}
                </button>)}
              </div>
            </div>
          </details>

          <details className="garage-fold">
            <summary>S-E</summary>
            <div className="garage-fold__body">
              <div className="garage-select-grid">
                {garageSEOrder.map((id) => <button
                  key={id}
                  className={`command-button command-button--contract ${state.selectedLoadout.specialEquipmentId === id ? 'is-selected' : ''}`}
                  onClick={() => onSetSpecial(id)}
                  data-desc={`DMG ${getSpecialEquipmentSpec(id).damage} / COST ${getSpecialEquipmentSpec(id).seAmmoCost} / AMMO ${getSpecialEquipmentSpec(id).ammo} / ${specialEquipmentCatalog[id].description}`}
                >
                  {specialEquipmentCatalog[id].name}
                </button>)}
              </div>
            </div>
          </details>

          <details className="garage-fold">
            <summary>SUPPORT SLOT</summary>
            <div className="garage-fold__body">
              <div className="garage-select-grid">
                {garageSupportOrder.map((id) => <button
                  key={id}
                  className={`command-button ${state.selectedLoadout.contractSupportId === id ? 'is-selected' : ''}`}
                  onClick={() => onSetSupport(id)}
                  data-desc={contractSupportCatalog[id].description}
                >
                  {id === 'none' ? 'Support: None' : `Support: ${contractSupportCatalog[id].name}`}
                </button>)}
              </div>
            </div>
          </details>
        </div>
        <div className="garage-block">
          <h3>Growth Resources</h3>
          <div className="negotiation-grid">
            <p><span>Driver XP</span><strong>{state.driverXpBank}</strong></p>
            <p><span>M.O.E. Sync</span><strong>{state.moeSyncBank}</strong></p>
            <p><span>Credits</span><strong>{state.creditBank}</strong></p>
          </div>
          <details className="garage-fold">
            <summary>{`DRIVER SKILL (XP)${canUpdateDriverSkill ? ' / UPDATE READY' : ''}`}</summary>
            <div className="garage-fold__body">
              <div className="garage-select-grid">
                {skillOrder.filter((skillId) => skillId === 'ram_control' || skillId === 'gunnery').map((skillId) => {
                  const level = state.skillLevels[skillId];
                  const cost = getSkillCost(level);
                  const canBuy = state.driverXpBank >= cost;
                  return <button
                    key={skillId}
                    className={`command-button ${level > 0 ? 'is-selected' : ''}`}
                    disabled={!canBuy}
                    onClick={() => onPurchaseSkill(skillId)}
                    data-desc={`Lv${level} -> Lv${level + 1} / COST ${cost} XP`}
                  >
                    {skillLabels[skillId]} <span>Lv{level}</span>
                  </button>;
                })}
              </div>
            </div>
          </details>
          <details className="garage-fold">
            <summary>{`M.O.E. SKILL (SYNC)${canUpdateMoeSkill ? ' / UPDATE READY' : ''}`}</summary>
            <div className="garage-fold__body">
              <div className="garage-select-grid">
                {skillOrder.filter((skillId) => skillId === 'scan_boost' || skillId === 'translation_assist').map((skillId) => {
                  const level = state.skillLevels[skillId];
                  const cost = getSkillCost(level);
                  const canBuy = state.moeSyncBank >= cost;
                  return <button
                    key={skillId}
                    className={`command-button ${level > 0 ? 'is-selected' : ''}`}
                    disabled={!canBuy}
                    onClick={() => onPurchaseSkill(skillId)}
                    data-desc={`Lv${level} -> Lv${level + 1} / COST ${cost} SYNC`}
                  >
                    {skillLabels[skillId]} <span>Lv{level}</span>
                  </button>;
                })}
              </div>
            </div>
          </details>

          <details className="garage-fold">
            <summary>{`VEHICLE TUNING (CREDITS)${canUpdateVehicleTune ? ' / UPDATE READY' : ''}`}</summary>
            <div className="garage-fold__body">
              <div className="garage-select-grid">
                {vehicleUpgradeOrder.map((upgradeId) => {
                  const level = state.vehicleUpgrades[upgradeId];
                  const cost = getVehicleUpgradeCost(level);
                  const canBuy = state.creditBank >= cost;
                  return <button
                    key={upgradeId}
                    className={`command-button command-button--route ${level > 0 ? 'is-selected' : ''}`}
                    disabled={!canBuy}
                    onClick={() => onPurchaseVehicleUpgrade(upgradeId)}
                    data-desc={`Lv${level} -> Lv${level + 1} / COST ${cost} CREDIT`}
                  >
                    {vehicleUpgradeLabels[upgradeId]} <span>Lv{level}</span>
                  </button>;
                })}
              </div>
            </div>
          </details>
          <details className="garage-fold">
            <summary>AUTOPLAY LAB (OPTIONAL)</summary>
            <div className="garage-fold__body">
              <p>Balance Profile: runtime</p>
              <div className="autoplay-controls">
                <label>
                  Runs
                  <input
                    type="number"
                    min={autoplayMinRuns}
                    max={autoplayMaxRuns}
                    step={10}
                    value={autoplayRuns}
                    onChange={(event) => onSetAutoplayRuns(
                      clamp(
                        Number(event.target.value) || autoplayMinRuns,
                        autoplayMinRuns,
                        autoplayMaxRuns,
                      ),
                    )}
                  />
                </label>
                <label>
                  Strategy
                  <select value={autoplayStrategy} onChange={(event) => onSetAutoplayStrategy(event.target.value as AutoPlayStrategy)}>
                    <option value="balanced">Balanced</option>
                    <option value="aggressive">Aggressive</option>
                    <option value="safe">Safe</option>
                    <option value="contract">Contract</option>
                  </select>
                </label>
                <button className="command-button command-button--system" onClick={onRunAutoplay}>RUN AUTOPLAY</button>
              </div>
              {autoplayReport && <div className="autoplay-report">
                <p><span>Runs</span><strong>{autoplayReport.runs}</strong></p>
                <p><span>Win Rate</span><strong>{autoplayReport.winRate.toFixed(1)}%</strong></p>
                <p><span>Boss Cleared</span><strong>{autoplayReport.counts['Boss Cleared']}</strong></p>
                <p><span>Boss Avoided</span><strong>{autoplayReport.counts['Boss Avoided']}</strong></p>
                <p><span>Early Return</span><strong>{autoplayReport.counts['Early Return']}</strong></p>
                <p><span>Disabled</span><strong>{autoplayReport.counts['Vehicle Disabled']}</strong></p>
                <p><span>Avg Encounter</span><strong>{autoplayReport.avgEncounters.toFixed(2)}</strong></p>
                <p><span>Avg Contract</span><strong>{autoplayReport.avgContracts.toFixed(2)}</strong></p>
                <p><span>Avg Salvage</span><strong>{autoplayReport.avgSalvage.toFixed(2)}</strong></p>
                <p><span>Avg Fuel</span><strong>{autoplayReport.avgFuel.toFixed(2)}</strong></p>
                <p><span>Avg Armor</span><strong>{autoplayReport.avgArmor.toFixed(2)}</strong></p>
                <p><span>Avg Signal</span><strong>{autoplayReport.avgSignal.toFixed(2)}</strong></p>
                <p><span>Avg S-E Ammo</span><strong>{autoplayReport.avgSeAmmo.toFixed(2)}</strong></p>
              </div>}
            </div>
          </details>
        </div>
      </div>
    </section>
  );
};
