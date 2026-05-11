import { getBalanceConfig } from '../balanceConfig';
import { getEventById } from '../eventConfig';
import type { RewardOption, State } from './types';
import { getSignalCapacity } from './signalSystem';

const hasReward = (option: RewardOption, key: 'fuel' | 'armor' | 'signal' | 'mainAmmo' | 'seAmmo') =>
  (option[key] ?? 0) > 0;

const getPrimaryResource = (option: RewardOption): 'fuel' | 'armor' | 'signal' | 'mainAmmo' | 'seAmmo' | 'mixed' => {
  const keys = (['fuel', 'armor', 'signal', 'mainAmmo', 'seAmmo'] as const).filter((key) => hasReward(option, key));
  return keys.length === 1 ? keys[0] : 'mixed';
};

const getResourceStatus = (state: State) => {
  const balance = getBalanceConfig();
  const fuelMax = balance.resources.baseFuel + state.vehicleUpgrades.fuel_tank;
  const armorMax = balance.resources.baseArmor + state.vehicleUpgrades.armor_plating;
  const signalMax = getSignalCapacity(state.skillLevels);
  return {
    fuel: { current: state.fuel, max: fuelMax, critical: state.fuel <= 3 },
    armor: { current: state.armor, max: armorMax, critical: state.armor <= 4 },
    signal: { current: state.signal, max: signalMax, critical: state.signal <= 1 },
    mainAmmo: { current: state.mainAmmo, max: state.maxMainAmmo, critical: state.mainAmmo <= 2 },
    seAmmo: { current: state.seAmmo, max: state.maxSeAmmo, critical: state.seAmmo <= 1 },
  };
};

const resourceCopy: Record<'fuel' | 'armor' | 'signal' | 'mainAmmo' | 'seAmmo' | 'mixed', {
  label: string;
  use: string;
  prep: string;
}> = {
  fuel: {
    label: 'Fuel',
    use: 'Route margin',
    prep: 'Return margin',
  },
  armor: {
    label: 'Armor',
    use: 'Hit margin',
    prep: 'Guard buffer',
  },
  signal: {
    label: 'Signal',
    use: 'Read/Talk margin',
    prep: 'Forecast buffer',
  },
  mainAmmo: {
    label: 'Main Ammo',
    use: 'Kill pressure',
    prep: 'Boss buffer',
  },
  seAmmo: {
    label: 'S-E Ammo',
    use: 'EMP/Contract',
    prep: 'Signal tactic',
  },
  mixed: {
    label: 'Mixed',
    use: 'All-round buffer',
    prep: 'Stable next lane',
  },
};

export const buildSituationalSalvageChoices = (
  state: State,
  rewards: RewardOption[],
  eventId: string | undefined,
): RewardOption[] => {
  const status = getResourceStatus(state);
  const event = getEventById(eventId);
  const eventRewardId = event?.rewardId;
  const eventTagLabels = (event?.tags ?? [])
    .filter((tag) => tag !== 'one_pull')
    .slice(0, 2)
    .map((tag) => tag.toUpperCase());
  const siteTag = event?.title ? event.title.toUpperCase() : 'SALVAGE SITE';
  const buildTags = (resourceLabel: string, priority: RewardOption['salvagePriority']) => [
    siteTag,
    priority === 'critical' ? `${resourceLabel.toUpperCase()} LOW` : priority === 'event' ? 'SITE MATCH' : resourceLabel.toUpperCase(),
    ...eventTagLabels,
    'ONE PULL',
  ].slice(0, 4);

  return rewards.map((reward) => {
    const primary = getPrimaryResource(reward);
    if (primary === 'mixed') {
      const priority: RewardOption['salvagePriority'] = eventRewardId === reward.id ? 'event' : 'prep';
      return {
        ...reward,
        salvageContext: eventRewardId === reward.id
          ? `SITE MATCH / ${resourceCopy.mixed.use}`
          : resourceCopy.mixed.use,
        salvageConsequence: 'ONE PULL',
        salvagePriority: priority,
        salvageTags: buildTags(resourceCopy.mixed.label, priority),
      };
    }
    const res = status[primary];
    const copy = resourceCopy[primary];
    const priority: RewardOption['salvagePriority'] = eventRewardId === reward.id
      ? 'event'
      : res.critical
        ? 'critical'
        : res.current < res.max
          ? 'useful'
          : 'prep';
    const needLine = res.critical
      ? `${copy.label} ${res.current}/${res.max} LOW`
      : res.current < res.max
        ? `${copy.label} ${res.current}/${res.max} REFILL`
        : `${copy.label} ${res.current}/${res.max} PREP`;
    return {
      ...reward,
      salvageContext: eventRewardId === reward.id
        ? `SITE MATCH / ${copy.use}`
        : `${needLine} / ${res.critical ? copy.use : copy.prep}`,
      salvageConsequence: 'ONE PULL',
      salvagePriority: priority,
      salvageTags: buildTags(copy.label, priority),
    };
  });
};
