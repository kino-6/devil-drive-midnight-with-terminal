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
import { getUnlockReason, isEquipmentUnlocked } from '../../../game/progression';
import { getMainGunSpec, getSpecialEquipmentSpec, getSubGunSpec } from '../../../game/runtimeHelpers';
import type { ContractSupportId, MainGunId, SpecialEquipmentId, State, SubGunId } from '../../../game/types';
import type { UnlockCategory } from '../../../progressionConfig';

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
}: GarageLoadoutSectionProps) => {
  const lockLabel = (category: UnlockCategory, id: string) =>
    isEquipmentUnlocked(state.unlocks, category, id) ? undefined : getUnlockReason(state.unlocks, category, id);

  return <div className="garage-block">
    <h3>Loadout</h3>
    <details className="garage-fold" open>
      <summary>MAIN GUN</summary>
      <div className="garage-fold__body">
        <div className="garage-select-grid">
          {garageMainGunOrder.map((id) => {
            const locked = lockLabel('mainGuns', id);
            const desc = locked ?? `DMG ${getMainGunSpec(id).damage} / AMMO ${getMainGunSpec(id).ammo} / ${mainGunCatalog[id].description}`;
            return <button
              key={id}
              className={`command-button command-button--danger ${state.selectedLoadout.mainGunId === id ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}`}
              disabled={!!locked}
              onClick={() => onSetMainGun(id)}
              data-desc={desc}
            >
              {mainGunCatalog[id].name} {locked && <span>{locked}</span>}
            </button>;
          })}
        </div>
      </div>
    </details>

    <details className="garage-fold">
      <summary>SUB GUN</summary>
      <div className="garage-fold__body">
        <div className="garage-select-grid">
          {garageSubGunOrder.map((id) => {
            const locked = lockLabel('subGuns', id);
            const desc = locked ?? `DMG ${getSubGunSpec(id).damage}${getSubGunSpec(id).hits ? ` / HITS ${getSubGunSpec(id).hits}` : ''} / ${subGunCatalog[id].description}`;
            return <button
              key={id}
              className={`command-button command-button--route ${state.selectedLoadout.subGunId === id ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}`}
              disabled={!!locked}
              onClick={() => onSetSubGun(id)}
              data-desc={desc}
            >
              {subGunCatalog[id].name} {locked && <span>{locked}</span>}
            </button>;
          })}
        </div>
      </div>
    </details>

    <details className="garage-fold">
      <summary>S-E</summary>
      <div className="garage-fold__body">
        <div className="garage-select-grid">
          {garageSEOrder.map((id) => {
            const locked = lockLabel('specialEquipment', id);
            const desc = locked ?? `DMG ${getSpecialEquipmentSpec(id).damage} / COST ${getSpecialEquipmentSpec(id).seAmmoCost} / AMMO ${getSpecialEquipmentSpec(id).ammo} / ${specialEquipmentCatalog[id].description}`;
            return <button
              key={id}
              className={`command-button command-button--contract ${state.selectedLoadout.specialEquipmentId === id ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}`}
              disabled={!!locked}
              onClick={() => onSetSpecial(id)}
              data-desc={desc}
            >
              {specialEquipmentCatalog[id].name} {locked && <span>{locked}</span>}
            </button>;
          })}
        </div>
      </div>
    </details>

    <details className="garage-fold">
      <summary>SUPPORT SLOT</summary>
      <div className="garage-fold__body">
        <div className="garage-select-grid">
          {garageSupportOrder.map((id) => {
            const locked = lockLabel('support', id);
            const desc = locked ?? contractSupportCatalog[id].description;
            return <button
              key={id}
              className={`command-button ${state.selectedLoadout.contractSupportId === id ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}`}
              disabled={!!locked}
              onClick={() => onSetSupport(id)}
              data-desc={desc}
            >
              {id === 'none' ? 'Support: None' : `Support: ${contractSupportCatalog[id].name}`} {locked && <span>{locked}</span>}
            </button>;
          })}
        </div>
      </div>
    </details>
  </div>;
};
