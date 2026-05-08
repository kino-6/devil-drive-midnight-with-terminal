import type { State } from './types';

export type RunGrowth = {
  driverXp: number;
  moeSync: number;
  salvageCreditGain: number;
};

export const WIPEOUT_CARRYBACK_RATE = 0.2;

export const isWipeoutCarryback = (state: State): boolean =>
  state.gamePhase === 'game_over' || state.resultType === 'Vehicle Disabled';

const carrybackValue = (value: number): number => {
  if (value <= 0) return 0;
  return Math.max(1, Math.floor(value * WIPEOUT_CARRYBACK_RATE));
};

export const applyWipeoutCarryback = (growth: RunGrowth): RunGrowth => ({
  driverXp: carrybackValue(growth.driverXp),
  moeSync: carrybackValue(growth.moeSync),
  salvageCreditGain: carrybackValue(growth.salvageCreditGain),
});

export const formatWipeoutCarrybackLog = (): string =>
  `> WIPEOUT CARRYBACK: ${Math.round(WIPEOUT_CARRYBACK_RATE * 100)}% DATA RECOVERED`;
