import { getBalanceConfig } from '../balanceConfig';
import { defaultSkillLevels } from './catalogs';
import type { SkillLevels } from './types';

export const getSignalCapacity = (skillLevels: SkillLevels = defaultSkillLevels): number =>
  getBalanceConfig().resources.baseSignal + skillLevels.signal_tuning;

export const getSignalLaneGain = (
  skillLevels: SkillLevels = defaultSkillLevels,
  supportBoost = 0,
): number => 1 + supportBoost + skillLevels.signal_tuning;
