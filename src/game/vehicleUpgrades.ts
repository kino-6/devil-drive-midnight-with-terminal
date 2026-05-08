import { defaultVehicleUpgrades } from './catalogs';
import type { VehicleUpgradeLevels } from './types';

export type VehicleResourceBonuses = {
  fuel: number;
  armor: number;
  mainAmmo: number;
  seAmmo: number;
};

export const getVehicleUpgradeResourceBonuses = (
  vehicleUpgrades: VehicleUpgradeLevels = defaultVehicleUpgrades,
): VehicleResourceBonuses => ({
  fuel: vehicleUpgrades.fuel_tank,
  armor: vehicleUpgrades.armor_plating,
  mainAmmo: vehicleUpgrades.ammo_rack,
  seAmmo: vehicleUpgrades.se_rack,
});
