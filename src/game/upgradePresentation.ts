import { getBalanceConfig } from '../balanceConfig';
import { getSignalCapacity, getSignalLaneGain } from './signalSystem';
import type { UpgradeId, VehicleUpgradeId } from './types';

export const skillEffectText: Record<UpgradeId, string> = {
  ram_control: 'Approach ram stability',
  gunnery: 'Main Gun damage stability',
  scan_boost: 'NAVI scan chance',
  translation_assist: 'Talk success support',
  signal_tuning: 'Start Signal +1 / Signal Lane +1',
};

export const vehicleUpgradeEffectText: Record<VehicleUpgradeId, string> = {
  fuel_tank: 'Start Fuel +1',
  armor_plating: 'Start Armor +1',
  ammo_rack: 'Start Main Ammo +1',
  se_rack: 'Start S-E Ammo +1',
  signal_antenna: 'Analyze Intel gain',
  noise_filter: 'Talk failure pressure damp',
  daemon_bus: 'Support daemon backlash reduction',
};

export const getSkillUpgradeChips = (skillId: UpgradeId, level: number): string[] => {
  const nextLevel = level + 1;
  if (skillId === 'scan_boost') {
    const perLevel = getBalanceConfig().scan.scanBoostPerLevel;
    return [
      `Scan +${level * perLevel}% -> +${nextLevel * perLevel}%`,
      `Route read ${level} -> ${nextLevel}`,
    ];
  }
  if (skillId === 'translation_assist') {
    return [
      `First Talk +${level * 3}% -> +${nextLevel * 3}%`,
      nextLevel > 0 ? 'Talk assist active' : 'Talk assist locked',
    ];
  }
  if (skillId === 'signal_tuning') {
    const currentCapacity = getSignalCapacity({
      ram_control: 0,
      gunnery: 0,
      scan_boost: 0,
      translation_assist: 0,
      signal_tuning: level,
    });
    const nextCapacity = getSignalCapacity({
      ram_control: 0,
      gunnery: 0,
      scan_boost: 0,
      translation_assist: 0,
      signal_tuning: nextLevel,
    });
    return [
      `Start Signal ${currentCapacity} -> ${nextCapacity}`,
      `Signal Lane +${getSignalLaneGain({
        ram_control: 0,
        gunnery: 0,
        scan_boost: 0,
        translation_assist: 0,
        signal_tuning: level,
      })} -> +${getSignalLaneGain({
        ram_control: 0,
        gunnery: 0,
        scan_boost: 0,
        translation_assist: 0,
        signal_tuning: nextLevel,
      })}`,
    ];
  }
  if (skillId === 'gunnery') return [`Main damage +${level} -> +${nextLevel}`];
  return [`Ram control Lv${level} -> Lv${nextLevel}`];
};
