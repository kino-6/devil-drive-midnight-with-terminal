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
import type { State } from '../../../game/types';
import type { UnlockCategory } from '../../../progressionConfig';

export type GarageLoadoutGroupId = 'mainGuns' | 'subGuns' | 'specialEquipment' | 'support';

export type GarageLoadoutOption = {
  id: string;
  label: string;
  desc: string;
  className: string;
  lockedReason?: string;
};

export type GarageLoadoutGroup = {
  id: GarageLoadoutGroupId;
  title: string;
  options: GarageLoadoutOption[];
};

const getLockedReason = (state: State, category: UnlockCategory, id: string): string | undefined =>
  isEquipmentUnlocked(state.unlocks, category, id) ? undefined : getUnlockReason(state.unlocks, category, id);

export const buildGarageLoadoutGroups = (state: State): GarageLoadoutGroup[] => [
  {
    id: 'mainGuns',
    title: 'MAIN GUN',
    options: garageMainGunOrder.map((id) => {
      const spec = getMainGunSpec(id);
      const lockedReason = getLockedReason(state, 'mainGuns', id);
      return {
        id,
        label: mainGunCatalog[id].name,
        desc: lockedReason ?? `DMG ${spec.damage} / AMMO ${spec.ammo} / ${mainGunCatalog[id].description}`,
        className: `command-button command-button--danger ${state.selectedLoadout.mainGunId === id ? 'is-selected' : ''} ${lockedReason ? 'is-locked' : ''}`,
        lockedReason,
      };
    }),
  },
  {
    id: 'subGuns',
    title: 'SUB GUN',
    options: garageSubGunOrder.map((id) => {
      const spec = getSubGunSpec(id);
      const lockedReason = getLockedReason(state, 'subGuns', id);
      const hits = spec.hits ? ` / HITS ${spec.hits}` : '';
      return {
        id,
        label: subGunCatalog[id].name,
        desc: lockedReason ?? `DMG ${spec.damage}${hits} / ${subGunCatalog[id].description}`,
        className: `command-button command-button--route ${state.selectedLoadout.subGunId === id ? 'is-selected' : ''} ${lockedReason ? 'is-locked' : ''}`,
        lockedReason,
      };
    }),
  },
  {
    id: 'specialEquipment',
    title: 'S-E',
    options: garageSEOrder.map((id) => {
      const spec = getSpecialEquipmentSpec(id);
      const lockedReason = getLockedReason(state, 'specialEquipment', id);
      return {
        id,
        label: specialEquipmentCatalog[id].name,
        desc: lockedReason ?? `DMG ${spec.damage} / COST ${spec.seAmmoCost} / AMMO ${spec.ammo} / ${specialEquipmentCatalog[id].description}`,
        className: `command-button command-button--contract ${state.selectedLoadout.specialEquipmentId === id ? 'is-selected' : ''} ${lockedReason ? 'is-locked' : ''}`,
        lockedReason,
      };
    }),
  },
  {
    id: 'support',
    title: 'SUPPORT SLOT',
    options: garageSupportOrder.map((id) => {
      const lockedReason = getLockedReason(state, 'support', id);
      return {
        id,
        label: id === 'none' ? 'Support: None' : `Support: ${contractSupportCatalog[id].name}`,
        desc: lockedReason ?? contractSupportCatalog[id].description,
        className: `command-button ${state.selectedLoadout.contractSupportId === id ? 'is-selected' : ''} ${lockedReason ? 'is-locked' : ''}`,
        lockedReason,
      };
    }),
  },
];
