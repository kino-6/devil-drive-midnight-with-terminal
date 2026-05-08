import { getBalanceConfig } from '../balanceConfig';
import type { AffinityRating } from './types';

export const computeAffinityDamage = (baseDamage: number, rating: AffinityRating) => {
  const affinity = getBalanceConfig().affinity;
  if (baseDamage <= 0) return 0;
  if (rating === 'weak') return Math.max(1, Math.floor(baseDamage * affinity.weakMultiplier));
  if (rating === 'resist') return Math.max(1, Math.floor(baseDamage * affinity.resistMultiplier));
  return baseDamage;
};

export const getAffinityTag = (rating: AffinityRating) => {
  if (rating === 'weak') return 'WEAK';
  if (rating === 'resist') return 'RESIST';
  return 'NORMAL';
};

export const damageVarianceByCommand = {
  main_gun: 0.2,
  sub_gun: 0.2,
  se_harpoon: 0.25,
  ram: 0.2,
  approach_main_gun: 0.15,
} as const;

export const getRollBounds = (adjustedBase: number, variance: number) => {
  const floor = Math.max(1, Math.floor(adjustedBase * (1 - variance)));
  const ceil = Math.max(floor, Math.ceil(adjustedBase * (1 + variance)));
  return { min: floor, max: ceil };
};

type ResolveDamageRollInput = {
  baseDamage: number;
  affinity: AffinityRating;
  variance: number;
  flatReduction?: number;
  armored?: boolean;
};

export const resolveDamageRoll = ({
  baseDamage,
  affinity,
  variance,
  flatReduction = 0,
  armored = false,
}: ResolveDamageRollInput): { damage: number; min: number; max: number } => {
  const adjustedBase = computeAffinityDamage(baseDamage, affinity);
  const rawBounds = getRollBounds(adjustedBase, variance);
  const armorPenalty = armored ? 1 : 0;
  const min = Math.max(1, rawBounds.min - flatReduction - armorPenalty);
  const max = Math.max(min, rawBounds.max - flatReduction - armorPenalty);
  const damage = Math.floor(min + Math.random() * (max - min + 1));
  return { damage, min, max };
};
