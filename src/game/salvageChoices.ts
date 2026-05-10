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
    use: '進路選択、Escape、撤退の余裕を戻す。',
    prep: '帰還や寄り道を残す保険。',
  },
  armor: {
    label: 'Armor',
    use: '被弾とRamの余裕を戻す。',
    prep: '次接敵でGuardに頼り切らない保険。',
  },
  signal: {
    label: 'Signal',
    use: 'Analyze、Talk支払い、進路予測を戻す。',
    prep: 'UNKNOWN相手と分岐判断を読む保険。',
  },
  mainAmmo: {
    label: 'Main Ammo',
    use: '単体撃破とBoss押し込みの弾を戻す。',
    prep: '硬い敵を削り切るための保険。',
  },
  seAmmo: {
    label: 'S-E Ammo',
    use: 'Analyze補助、EMP、契約窓、Boss対策を戻す。',
    prep: 'Signal寄りの戦術を残す保険。',
  },
  mixed: {
    label: 'Mixed',
    use: '複数資源を少しずつ戻して事故を減らす。',
    prep: '尖らない代わりに次区画の安定を取る。',
  },
};

export const buildSituationalSalvageChoices = (
  state: State,
  rewards: RewardOption[],
  eventId: string | undefined,
): RewardOption[] => {
  const status = getResourceStatus(state);
  const eventRewardId = getEventById(eventId)?.rewardId;
  return rewards.map((reward) => {
    const primary = getPrimaryResource(reward);
    if (primary === 'mixed') {
      return {
        ...reward,
        salvageContext: resourceCopy.mixed.use,
        salvageConsequence: '一つ拾うと、残りの補給反応は閉じる。',
        salvagePriority: eventRewardId === reward.id ? 'event' : 'prep',
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
      ? `${copy.label} ${res.current}/${res.max}。今いちばん事故りやすい不足。`
      : res.current < res.max
        ? `${copy.label} ${res.current}/${res.max}。削れた分を戻せる。`
        : `${copy.label} ${res.current}/${res.max}。満タン寄り、先の備え。`;
    return {
      ...reward,
      salvageContext: eventRewardId === reward.id
        ? `この地点の本命反応。${copy.use}`
        : `${needLine} ${res.critical ? copy.use : copy.prep}`,
      salvageConsequence: '一つ拾うと、残りの補給反応は閉じる。',
      salvagePriority: priority,
    };
  });
};
