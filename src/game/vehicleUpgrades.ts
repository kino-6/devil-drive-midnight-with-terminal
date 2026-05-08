import { defaultVehicleUpgrades } from './catalogs';
import { getBalanceConfig } from '../balanceConfig';
import type { VehicleUpgradeLevels } from './types';

export type VehicleResourceBonuses = {
  fuel: number;
  armor: number;
  mainAmmo: number;
  seAmmo: number;
};

export type VehicleUtilityEffects = {
  analyzeIntelBonus: number;
  talkFailurePressureReduction: number;
  supportBacklashReduction: number;
};

export const getVehicleUpgradeResourceBonuses = (
  vehicleUpgrades: VehicleUpgradeLevels = defaultVehicleUpgrades,
): VehicleResourceBonuses => ({
  fuel: vehicleUpgrades.fuel_tank,
  armor: vehicleUpgrades.armor_plating,
  mainAmmo: vehicleUpgrades.ammo_rack,
  seAmmo: vehicleUpgrades.se_rack,
});

export const getVehicleUpgradeUtilityEffects = (
  vehicleUpgrades: VehicleUpgradeLevels = defaultVehicleUpgrades,
): VehicleUtilityEffects => {
  const cfg = getBalanceConfig().vehicleUpgrades;
  return {
    analyzeIntelBonus: vehicleUpgrades.signal_antenna * cfg.signalAntennaAnalyzeBonus,
    talkFailurePressureReduction: vehicleUpgrades.noise_filter * cfg.noiseFilterPressureReduction,
    supportBacklashReduction: vehicleUpgrades.daemon_bus * cfg.daemonBusBacklashReduction,
  };
};

export const getSupportBacklashChance = (
  baseChance: number,
  vehicleUpgrades: VehicleUpgradeLevels = defaultVehicleUpgrades,
) => Math.max(0, baseChance - getVehicleUpgradeUtilityEffects(vehicleUpgrades).supportBacklashReduction);
