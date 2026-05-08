import { clamp } from '../../../game/runtimeHelpers';
import { canPurchaseUnlock, getPurchasableUnlocks } from '../../../game/progression';
import {
  skillLabels,
  vehicleUpgradeLabels,
} from '../../../game/catalogs';
import { getSkillCost, getVehicleUpgradeCost } from '../../state/stateReducer';
import type {
  AutoPlayReport,
  AutoPlayStrategy,
  State,
  UpgradeId,
  VehicleUpgradeId,
} from '../../../game/types';

type GarageGrowthSectionProps = {
  state: State;
  canUpdateDriverSkill: boolean;
  canUpdateMoeSkill: boolean;
  canUpdateVehicleTune: boolean;
  autoplayRuns: number;
  autoplayStrategy: AutoPlayStrategy;
  autoplayReport: AutoPlayReport | null;
  autoplayMinRuns: number;
  autoplayMaxRuns: number;
  onPurchaseSkill: (upgrade: UpgradeId) => void;
  onPurchaseVehicleUpgrade: (id: VehicleUpgradeId) => void;
  onPurchaseUnlock: (id: string) => void;
  onSetAutoplayRuns: (runs: number) => void;
  onSetAutoplayStrategy: (strategy: AutoPlayStrategy) => void;
  onRunAutoplay: () => void;
};

const skillOrder: UpgradeId[] = ['ram_control', 'gunnery', 'scan_boost', 'translation_assist'];
const vehicleUpgradeOrder: VehicleUpgradeId[] = ['fuel_tank', 'armor_plating', 'ammo_rack', 'se_rack'];
const skillEffectText: Record<UpgradeId, string> = {
  ram_control: 'Approach ram stability',
  gunnery: 'Main Gun damage stability',
  scan_boost: 'NAVI scan chance',
  translation_assist: 'Talk success support',
};

export const GarageGrowthSection = ({
  state,
  canUpdateDriverSkill,
  canUpdateMoeSkill,
  canUpdateVehicleTune,
  autoplayRuns,
  autoplayStrategy,
  autoplayReport,
  autoplayMinRuns,
  autoplayMaxRuns,
  onPurchaseSkill,
  onPurchaseVehicleUpgrade,
  onPurchaseUnlock,
  onSetAutoplayRuns,
  onSetAutoplayStrategy,
  onRunAutoplay,
}: GarageGrowthSectionProps) => {
  const unlockOffers = getPurchasableUnlocks(state.unlocks);

  return <div className="garage-block">
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
              data-desc={`${skillEffectText[skillId]} / Lv${level} -> Lv${level + 1} / COST ${cost} XP`}
            >
              {skillLabels[skillId]} <span>Lv{level}</span>
            </button>;
          })}
        </div>
      </div>
    </details>

    <details className="garage-fold">
      <summary>{`UNLOCK SHOP (HOOK)${unlockOffers.some((offer) => canPurchaseUnlock(state, offer.id).ok) ? ' / UPDATE READY' : ''}`}</summary>
      <div className="garage-fold__body">
        {unlockOffers.length === 0 ? <p>All current purchase unlocks are open.</p> : <div className="garage-select-grid">
          {unlockOffers.map((offer) => {
            const status = canPurchaseUnlock(state, offer.id);
            return <button
              key={offer.id}
              className="command-button command-button--system"
              disabled={!status.ok}
              onClick={() => onPurchaseUnlock(offer.id)}
              data-desc={`${offer.reason} / COST ${offer.cost} ${offer.currency}`}
            >
              {offer.label} <span>{offer.cost} {offer.currency}</span>
            </button>;
          })}
        </div>}
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
              data-desc={`${skillEffectText[skillId]} / Lv${level} -> Lv${level + 1} / COST ${cost} SYNC`}
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
  </div>;
};
