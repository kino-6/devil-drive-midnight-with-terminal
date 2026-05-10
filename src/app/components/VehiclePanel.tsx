import { ResourceMeter } from '../../components/DashboardWidgets';
import { AssetFigure } from '../../components/EncounterVisuals';
import { contractLabels } from '../../game/catalogs';
import { resourceDescriptions } from '../../game/resourceGlossary';
import { getSupportDaemonStability } from '../../game/runtimeHelpers';
import type { State } from '../../game/types';

type VehiclePanelProps = {
  playerAsset?: string;
  state: State;
  dashboardFuelMax: number;
  dashboardArmorMax: number;
  dashboardSignalMax: number;
  selectedSupportName: string;
  selectedMainGunName: string;
  selectedSubGunName: string;
  selectedSEName: string;
};

export const VehiclePanel = ({
  playerAsset,
  state,
  dashboardFuelMax,
  dashboardArmorMax,
  dashboardSignalMax,
  selectedSupportName,
  selectedMainGunName,
  selectedSubGunName,
  selectedSEName,
}: VehiclePanelProps) => (
  <section className="vehicle-panel vehicle-panel--inline panel">
    <div className="panel-title">
      <span>
        <AssetFigure
          src={playerAsset}
          alt="Driver unit"
          className="vehicle-panel__avatar"
          fallback={<></>}
          transparencyMode="auto-corner"
        />
        VEHICLE DASHBOARD
      </span>
    </div>
    <div className="vehicle-panel__meters">
      <ResourceMeter label="Fuel" value={state.fuel} max={dashboardFuelMax} tone="fuel" description={resourceDescriptions.fuel} />
      <ResourceMeter label="Armor" value={state.armor} max={dashboardArmorMax} tone="armor" description={resourceDescriptions.armor} />
      <ResourceMeter label="Signal" value={state.signal} max={dashboardSignalMax} tone="signal" description={resourceDescriptions.signal} />
      <ResourceMeter label="Main Ammo" value={state.mainAmmo} max={state.maxMainAmmo} tone="ammo" description={resourceDescriptions.mainAmmo} />
      <ResourceMeter label="S-E Ammo" value={state.seAmmo} max={state.maxSeAmmo} tone="seammo" description={resourceDescriptions.seAmmo} />
    </div>
    <div className="contract-slots">
      <div className="panel-title panel-title--compact">
        <span>CONTRACT SLOTS</span>
        <small>{state.contracts.length}/3</small>
      </div>
      {state.contracts.length === 0
        ? <div className="empty-slot">[EMPTY] No entity bound to the vehicle bus.</div>
        : state.contracts.map((contract) => <article key={contract.id} className={`module-card module-card--${contract.id.split('_').join('-')}`}>
          <span className="module-card__band">[{contractLabels[contract.id]}]</span>
          <strong>{contract.name}</strong>
          <p>{contract.effect}</p>
        </article>)}
      <div className="panel-title panel-title--compact">
        <span>SUPPORT DAEMON</span>
        <small>{state.activeSupportDaemon ? 'ACTIVE' : 'OFFLINE'}</small>
      </div>
      {state.activeSupportDaemon
        ? <article className={`module-card module-card--${state.activeSupportDaemon.profile.split('_').join('-')}`}>
          <strong>{state.activeSupportDaemon.name}</strong>
          <p>TEMPERAMENT: {state.activeSupportDaemon.temperament.toUpperCase()}</p>
          <p>LINK STABILITY: {getSupportDaemonStability(state.activeSupportDaemon)}</p>
          <p>{state.activeSupportDaemon.effectLabel}</p>
          <span className="module-card__band">EXPIRES: RUN END</span>
        </article>
        : <div className="empty-slot">No active support. Contract a demon to establish a temporary daemon link.</div>}
      <div className="empty-slot">NAVI: M.O.E. CORE (DEFAULT)</div>
      <div className="empty-slot">SUPPORT SLOT: {selectedSupportName}</div>
      <div className="empty-slot">MAIN: {selectedMainGunName} / SUB: {selectedSubGunName} / S-E: {selectedSEName} ({state.seAmmo}/{state.maxSeAmmo})</div>
      <div className="empty-slot">GUARD: {state.encounter.guardActive ? 'ACTIVE' : 'OFF'}</div>
      <div className="empty-slot">SALVAGE CREDIT: {state.salvageCredits}</div>
    </div>
  </section>
);
