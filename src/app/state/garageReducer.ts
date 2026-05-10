import { getMoeLine } from '../../game/moeDialogue';
import type { Action, State } from '../../game/types';
import { clamp } from '../../game/runtimeHelpers';
import { contractSupportCatalog } from '../../game/catalogs';
import { getMainGunSpec, getSpecialEquipmentSpec, getSubGunSpec } from '../../game/runtimeHelpers';
import {
  getLoadoutLockReason,
  getUnlockReason,
  isEquipmentUnlocked,
  isLoadoutUnlocked,
  purchaseUnlock,
} from '../../game/progression';
import {
  getSkillCost,
  getVehicleUpgradeCost,
  initRunWithLoadout,
} from './stateRuntime';
import { getGarageStageAdvisory } from './storyProgression';

export function reduceGarage(state: State, action: Action): State {
  if (action.type === 'GARAGE_SET_MAIN_GUN') {
    if (state.gamePhase !== 'garage') return state;
    if (!isEquipmentUnlocked(state.unlocks, 'mainGuns', action.id)) {
      return { ...state, moeLine: getUnlockReason(state.unlocks, 'mainGuns', action.id) };
    }
    return {
      ...state,
      selectedLoadout: { ...state.selectedLoadout, mainGunId: action.id },
      moeLine: getMoeLine('moe.garage.set_main_gun', '主砲を重くするとBossは楽。でも弾切れは早いよ。', undefined, 'soft'),
    };
  }

  if (action.type === 'GARAGE_SET_SUB_GUN') {
    if (state.gamePhase !== 'garage') return state;
    if (!isEquipmentUnlocked(state.unlocks, 'subGuns', action.id)) {
      return { ...state, moeLine: getUnlockReason(state.unlocks, 'subGuns', action.id) };
    }
    return {
      ...state,
      selectedLoadout: { ...state.selectedLoadout, subGunId: action.id },
      moeLine: getMoeLine('moe.garage.set_sub_gun', '副砲は戦い方が出る。牽制か、手数か。', undefined, 'soft'),
    };
  }

  if (action.type === 'GARAGE_SET_SPECIAL') {
    if (state.gamePhase !== 'garage') return state;
    if (!isEquipmentUnlocked(state.unlocks, 'specialEquipment', action.id)) {
      return { ...state, moeLine: getUnlockReason(state.unlocks, 'specialEquipment', action.id) };
    }
    return {
      ...state,
      selectedLoadout: { ...state.selectedLoadout, specialEquipmentId: action.id },
      moeLine: getMoeLine('moe.garage.set_se', 'S-Eは切り札。契約狙いか、殲滅寄りか選んで。', undefined, 'soft'),
    };
  }

  if (action.type === 'GARAGE_SET_SUPPORT') {
    if (state.gamePhase !== 'garage') return state;
    if (!isEquipmentUnlocked(state.unlocks, 'support', action.id)) {
      return { ...state, moeLine: getUnlockReason(state.unlocks, 'support', action.id) };
    }
    return {
      ...state,
      selectedLoadout: { ...state.selectedLoadout, contractSupportId: action.id },
      moeLine: getMoeLine('moe.garage.set_support', '契約サポートは一つだけ。何を車に残す？', undefined, 'soft'),
    };
  }

  if (action.type === 'GARAGE_SET_STAGE') {
    if (state.gamePhase !== 'garage') return state;
    const nextStage = clamp(action.stage, 1, state.stageCount);
    return {
      ...state,
      stage: nextStage,
      moeLine: getGarageStageAdvisory(state, nextStage),
    };
  }

  if (action.type === 'GARAGE_ENTER_RUN') {
    if (state.gamePhase !== 'garage') return state;
    if (!isLoadoutUnlocked(state.selectedLoadout, state.unlocks)) {
      const reason = getLoadoutLockReason(state.selectedLoadout, state.unlocks) ?? 'Locked loadout';
      return {
        ...state,
        logs: [...state.logs, `> SORTIE BLOCKED: ${reason.toUpperCase()}`],
        moeLine: reason,
      };
    }
    return initRunWithLoadout(state, [
      '> GARAGE: MIDNIGHT BAY ONLINE',
      `> MAIN GUN SELECTED: ${getMainGunSpec(state.selectedLoadout.mainGunId).name.toUpperCase()}`,
      `> SUB GUN SELECTED: ${getSubGunSpec(state.selectedLoadout.subGunId).name.toUpperCase()}`,
      `> S-E SELECTED: ${getSpecialEquipmentSpec(state.selectedLoadout.specialEquipmentId).name.toUpperCase()}`,
      `> CONTRACT SUPPORT: ${contractSupportCatalog[state.selectedLoadout.contractSupportId].name.toUpperCase()}`,
      '> DEEP SIGNAL DETECTED: TOLL GATE SAINT',
    ]);
  }

  if (action.type === 'PURCHASE_SKILL') {
    if (state.gamePhase !== 'garage') return state;
    const currentLevel = state.skillLevels[action.upgrade];
    const cost = getSkillCost(currentLevel);
    const isMoeSkill = action.upgrade === 'scan_boost' || action.upgrade === 'translation_assist' || action.upgrade === 'signal_tuning';
    if (isMoeSkill) {
      if (state.moeSyncBank < cost) return state;
      return {
        ...state,
        moeSyncBank: state.moeSyncBank - cost,
        skillLevels: { ...state.skillLevels, [action.upgrade]: currentLevel + 1 },
        logs: [...state.logs, `> SKILL UPGRADE: ${action.upgrade.toUpperCase()} Lv${currentLevel + 1}`],
        moeLine: getMoeLine('moe.garage.skill_sync', '同期率を使って調整した。次Runで効く。', undefined, 'soft'),
      };
    }
    if (state.driverXpBank < cost) return state;
    return {
      ...state,
      driverXpBank: state.driverXpBank - cost,
      skillLevels: { ...state.skillLevels, [action.upgrade]: currentLevel + 1 },
      logs: [...state.logs, `> SKILL UPGRADE: ${action.upgrade.toUpperCase()} Lv${currentLevel + 1}`],
      moeLine: getMoeLine('moe.garage.skill_driver', '操縦技能を更新。次Runの反応が変わるはず。', undefined, 'soft'),
    };
  }

  if (action.type === 'PURCHASE_VEHICLE_UPGRADE') {
    if (state.gamePhase !== 'garage') return state;
    if (!isEquipmentUnlocked(state.unlocks, 'vehicleUpgrades', action.id)) {
      return { ...state, moeLine: getUnlockReason(state.unlocks, 'vehicleUpgrades', action.id) };
    }
    const currentLevel = state.vehicleUpgrades[action.id];
    const cost = getVehicleUpgradeCost(currentLevel);
    if (state.creditBank < cost) return state;
    return {
      ...state,
      creditBank: state.creditBank - cost,
      vehicleUpgrades: { ...state.vehicleUpgrades, [action.id]: currentLevel + 1 },
      logs: [...state.logs, `> VEHICLE TUNE: ${action.id.toUpperCase()} Lv${currentLevel + 1}`],
      moeLine: getMoeLine('moe.garage.vehicle_tune', '改装完了。車体側の余裕が増える。', undefined, 'soft'),
    };
  }

  if (action.type === 'PURCHASE_UNLOCK') {
    if (state.gamePhase !== 'garage') return state;
    const next = purchaseUnlock(state, action.id);
    if (next === state) return state;
    return {
      ...next,
      moeLine: getMoeLine('moe.garage.unlock_purchase', 'アンロック完了。選択肢が増えたよ。', undefined, 'soft'),
    };
  }

  return state;
}
