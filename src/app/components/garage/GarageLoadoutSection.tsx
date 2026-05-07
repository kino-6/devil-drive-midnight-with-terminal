import {
  contractSupportCatalog,
  garageMainGunOrder,
  garageSEOrder,
  garageSubGunOrder,
  garageSupportOrder,
  mainGunCatalog,
  specialEquipmentCatalog,
  subGunCatalog,
} from '../../../game/catalogs';
import { getMainGunSpec, getSpecialEquipmentSpec, getSubGunSpec } from '../../../game/runtimeHelpers';
import type { ContractSupportId, MainGunId, SpecialEquipmentId, State, SubGunId } from '../../../game/types';

type GarageLoadoutSectionProps = {
  state: State;
  onSetMainGun: (id: MainGunId) => void;
  onSetSubGun: (id: SubGunId) => void;
  onSetSpecial: (id: SpecialEquipmentId) => void;
  onSetSupport: (id: ContractSupportId) => void;
};

export const GarageLoadoutSection = ({
  state,
  onSetMainGun,
  onSetSubGun,
  onSetSpecial,
  onSetSupport,
}: GarageLoadoutSectionProps) => (
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
);
