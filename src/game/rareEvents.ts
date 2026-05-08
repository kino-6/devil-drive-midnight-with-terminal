import { getDialogueLine } from '../dialogueConfig';
import type { RewardOption, State } from './types';

type RareSalvageId = 'blueprint_signal_antenna' | 'strange_part_daemon_bus';

const rareSalvageIds: RareSalvageId[] = ['blueprint_signal_antenna', 'strange_part_daemon_bus'];

export const isRareSalvageReward = (id: string): id is RareSalvageId =>
  rareSalvageIds.includes(id as RareSalvageId);

export const getRareSalvageReward = (id: RareSalvageId): RewardOption => ({
  id,
  label: getDialogueLine(`rare.salvage.${id}.label`, id),
  detail: getDialogueLine(`rare.salvage.${id}.detail`, 'Unlock material'),
});

export const maybeAddRareSalvageReward = (state: State, rewards: RewardOption[]): RewardOption[] => {
  const rareChance = state.stage >= 2 || state.story.recoveredLogs.length > 0 ? 0.22 : 0.14;
  if (Math.random() >= rareChance) return rewards;
  const candidates = rareSalvageIds.filter((id) => {
    if (id === 'blueprint_signal_antenna') return !state.unlocks.vehicleUpgrades.includes('signal_antenna');
    if (id === 'strange_part_daemon_bus') return !state.unlocks.vehicleUpgrades.includes('daemon_bus');
    return true;
  });
  const id = candidates[Math.floor(Math.random() * candidates.length)];
  return id ? [getRareSalvageReward(id), ...rewards.slice(0, Math.max(0, rewards.length - 1))] : rewards;
};

export const getRareSalvageLog = (id: RareSalvageId): string =>
  getDialogueLine(`rare.salvage.${id}.log`, `RARE SALVAGE ACQUIRED: ${id.toUpperCase()}`);

export const getRareSalvageMoeLine = (id: RareSalvageId): string =>
  getDialogueLine(`rare.salvage.${id}.moe`, '珍しい部品。持ち帰ればGarageで使える。');
