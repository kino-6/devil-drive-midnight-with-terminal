import { getProgressionConfig, type UnlockCategory, type UnlockCurrency, type UnlockRule } from '../progressionConfig';
import {
  contractSupportCatalog,
  defaultLoadout,
  garageMainGunOrder,
  garageSEOrder,
  garageSubGunOrder,
  garageSupportOrder,
  mainGunCatalog,
  specialEquipmentCatalog,
  subGunCatalog,
} from './catalogs';
import type {
  ContractSupportId,
  Loadout,
  MainGunId,
  SpecialEquipmentId,
  State,
  SubGunId,
  UnlockState,
} from './types';

type UnlockRewardEvent =
  | { type: 'boss_clear' }
  | { type: 'early_return' }
  | { type: 'milestone'; id: string }
  | { type: 'contract'; id: string }
  | { type: 'archive'; enemy: string }
  | { type: 'story_log'; id: string }
  | { type: 'rare_route'; id: string };

export type PurchasableUnlock = {
  id: string;
  category: UnlockCategory;
  label: string;
  currency: UnlockCurrency;
  cost: number;
  reason: string;
};

const idsByCategory: Record<UnlockCategory, string[]> = {
  mainGuns: garageMainGunOrder,
  subGuns: garageSubGunOrder,
  specialEquipment: garageSEOrder,
  support: garageSupportOrder,
};

const categoryLabels: Record<UnlockCategory, string> = {
  mainGuns: 'Main Gun',
  subGuns: 'Sub Gun',
  specialEquipment: 'S-E',
  support: 'Support',
};

const currencyLabels: Record<UnlockCurrency, string> = {
  credits: 'Credits',
  driverXp: 'Driver XP',
  moeSync: 'M.O.E. Sync',
};

const emptyUnlocks = (): UnlockState => ({
  mainGuns: [],
  subGuns: [],
  specialEquipment: [],
  support: [],
});

const uniqueKnown = <T extends string>(values: unknown, known: readonly T[], fallback: readonly T[]): T[] => {
  const source = Array.isArray(values) ? values : fallback;
  const out: T[] = [];
  for (const item of source) {
    if (known.includes(item as T) && !out.includes(item as T)) out.push(item as T);
  }
  return out.length > 0 ? out : [...fallback];
};

export const getAllUnlocks = (): UnlockState => ({
  mainGuns: [...garageMainGunOrder],
  subGuns: [...garageSubGunOrder],
  specialEquipment: [...garageSEOrder],
  support: [...garageSupportOrder],
});

export const getInitialUnlocks = (): UnlockState => {
  const initial = getProgressionConfig().initialUnlocks;
  return {
    mainGuns: uniqueKnown(initial.mainGuns, garageMainGunOrder, [defaultLoadout.mainGunId]),
    subGuns: uniqueKnown(initial.subGuns, garageSubGunOrder, [defaultLoadout.subGunId]),
    specialEquipment: uniqueKnown(initial.specialEquipment, garageSEOrder, [defaultLoadout.specialEquipmentId]),
    support: uniqueKnown(initial.support, garageSupportOrder, [defaultLoadout.contractSupportId]),
  };
};

export const normalizeUnlockState = (value: unknown, fallback: UnlockState = getInitialUnlocks()): UnlockState => {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    mainGuns: uniqueKnown(raw.mainGuns, garageMainGunOrder, fallback.mainGuns),
    subGuns: uniqueKnown(raw.subGuns, garageSubGunOrder, fallback.subGuns),
    specialEquipment: uniqueKnown(raw.specialEquipment, garageSEOrder, fallback.specialEquipment),
    support: uniqueKnown(raw.support, garageSupportOrder, fallback.support),
  };
};

export const mergeUnlocks = (...states: UnlockState[]): UnlockState => normalizeUnlockState({
  mainGuns: states.flatMap((state) => state.mainGuns),
  subGuns: states.flatMap((state) => state.subGuns),
  specialEquipment: states.flatMap((state) => state.specialEquipment),
  support: states.flatMap((state) => state.support),
}, emptyUnlocks());

const addUnlock = (state: UnlockState, category: UnlockCategory, id: string): UnlockState =>
  normalizeUnlockState({
    ...state,
    [category]: [...(state[category] as string[]), id],
  }, state);

export const isEquipmentUnlocked = (unlocks: UnlockState, category: UnlockCategory, id: string): boolean =>
  (unlocks[category] as string[]).includes(id);

export const isLoadoutUnlocked = (loadout: Loadout, unlocks: UnlockState): boolean =>
  isEquipmentUnlocked(unlocks, 'mainGuns', loadout.mainGunId)
  && isEquipmentUnlocked(unlocks, 'subGuns', loadout.subGunId)
  && isEquipmentUnlocked(unlocks, 'specialEquipment', loadout.specialEquipmentId)
  && isEquipmentUnlocked(unlocks, 'support', loadout.contractSupportId);

export const sanitizeLoadoutForUnlocks = (loadout: Loadout, unlocks: UnlockState): Loadout => ({
  mainGunId: isEquipmentUnlocked(unlocks, 'mainGuns', loadout.mainGunId)
    ? loadout.mainGunId
    : unlocks.mainGuns[0] ?? defaultLoadout.mainGunId,
  subGunId: isEquipmentUnlocked(unlocks, 'subGuns', loadout.subGunId)
    ? loadout.subGunId
    : unlocks.subGuns[0] ?? defaultLoadout.subGunId,
  specialEquipmentId: isEquipmentUnlocked(unlocks, 'specialEquipment', loadout.specialEquipmentId)
    ? loadout.specialEquipmentId
    : unlocks.specialEquipment[0] ?? defaultLoadout.specialEquipmentId,
  contractSupportId: isEquipmentUnlocked(unlocks, 'support', loadout.contractSupportId)
    ? loadout.contractSupportId
    : unlocks.support[0] ?? defaultLoadout.contractSupportId,
});

export const getLoadoutLockReason = (loadout: Loadout, unlocks: UnlockState): string | undefined => {
  if (!isEquipmentUnlocked(unlocks, 'mainGuns', loadout.mainGunId)) return getUnlockReason(unlocks, 'mainGuns', loadout.mainGunId);
  if (!isEquipmentUnlocked(unlocks, 'subGuns', loadout.subGunId)) return getUnlockReason(unlocks, 'subGuns', loadout.subGunId);
  if (!isEquipmentUnlocked(unlocks, 'specialEquipment', loadout.specialEquipmentId)) return getUnlockReason(unlocks, 'specialEquipment', loadout.specialEquipmentId);
  if (!isEquipmentUnlocked(unlocks, 'support', loadout.contractSupportId)) return getUnlockReason(unlocks, 'support', loadout.contractSupportId);
  return undefined;
};

const getRule = (category: UnlockCategory, id: string): UnlockRule | undefined => {
  const rule = getProgressionConfig().unlockRules[id];
  return rule?.category === category ? rule : undefined;
};

const ruleReason = (rule: UnlockRule): string => {
  if (rule.reason) return rule.reason;
  if (rule.type === 'purchase' && rule.currency) return `${rule.cost ?? 0} ${currencyLabels[rule.currency]}`;
  if (rule.type === 'milestone') return rule.milestone ? `Milestone: ${rule.milestone}` : 'Milestone';
  if (rule.type === 'boss_clear') return 'Boss clear';
  if (rule.type === 'contract') return rule.contract ? `Contract ${rule.contract}` : 'Contract reward';
  if (rule.type === 'archive') return 'Archive reward';
  if (rule.type === 'story_log') return 'Story log reward';
  if (rule.type === 'rare_route') return 'Rare route reward';
  return 'Locked';
};

export const getUnlockReason = (unlocks: UnlockState, category: UnlockCategory, id: string): string => {
  if (isEquipmentUnlocked(unlocks, category, id)) return 'Unlocked';
  const rule = getRule(category, id);
  return rule ? ruleReason(rule) : 'Locked';
};

const getItemLabel = (category: UnlockCategory, id: string): string => {
  if (category === 'mainGuns' && id in mainGunCatalog) return mainGunCatalog[id as MainGunId].name;
  if (category === 'subGuns' && id in subGunCatalog) return subGunCatalog[id as SubGunId].name;
  if (category === 'specialEquipment' && id in specialEquipmentCatalog) return specialEquipmentCatalog[id as SpecialEquipmentId].name;
  if (category === 'support' && id in contractSupportCatalog) return contractSupportCatalog[id as ContractSupportId].name;
  return id;
};

export const getPurchasableUnlocks = (unlocks: UnlockState): PurchasableUnlock[] =>
  Object.values(getProgressionConfig().unlockRules)
    .filter((rule) => rule.type === 'purchase' && !!rule.currency && !isEquipmentUnlocked(unlocks, rule.category, rule.id))
    .filter((rule) => idsByCategory[rule.category].includes(rule.id))
    .map((rule) => ({
      id: rule.id,
      category: rule.category,
      label: `${categoryLabels[rule.category]}: ${getItemLabel(rule.category, rule.id)}`,
      currency: rule.currency as UnlockCurrency,
      cost: rule.cost ?? 0,
      reason: ruleReason(rule),
    }));

const getCurrencyBank = (state: State, currency: UnlockCurrency): number => {
  if (currency === 'credits') return state.creditBank;
  if (currency === 'driverXp') return state.driverXpBank;
  return state.moeSyncBank;
};

const spendCurrency = (state: State, currency: UnlockCurrency, cost: number): State => {
  if (currency === 'credits') return { ...state, creditBank: state.creditBank - cost };
  if (currency === 'driverXp') return { ...state, driverXpBank: state.driverXpBank - cost };
  return { ...state, moeSyncBank: state.moeSyncBank - cost };
};

export const canPurchaseUnlock = (state: State, id: string): { ok: boolean; reason: string; offer?: PurchasableUnlock } => {
  const offer = getPurchasableUnlocks(state.unlocks).find((item) => item.id === id);
  if (!offer) return { ok: false, reason: 'Unavailable' };
  const bank = getCurrencyBank(state, offer.currency);
  if (bank < offer.cost) return { ok: false, reason: `${offer.cost} ${currencyLabels[offer.currency]}`, offer };
  return { ok: true, reason: offer.reason, offer };
};

export const purchaseUnlock = (state: State, id: string): State => {
  const status = canPurchaseUnlock(state, id);
  if (!status.ok || !status.offer) return state;
  const next = spendCurrency(state, status.offer.currency, status.offer.cost);
  return {
    ...next,
    unlocks: addUnlock(next.unlocks, status.offer.category, status.offer.id),
    logs: [...next.logs, `> UNLOCK PURCHASED: ${status.offer.label.toUpperCase()}`],
  };
};

const matchesEvent = (rule: UnlockRule, event: UnlockRewardEvent): boolean => {
  if (rule.type === 'boss_clear') return event.type === 'boss_clear';
  if (rule.type === 'early_return') return event.type === 'early_return';
  if (rule.type === 'milestone') return event.type === 'milestone' && !!rule.milestone && rule.milestone === event.id;
  if (rule.type === 'contract') return event.type === 'contract' && !!rule.contract && rule.contract === event.id;
  if (rule.type === 'archive') return event.type === 'archive' && !!rule.enemy && rule.enemy === event.enemy;
  if (rule.type === 'story_log') return event.type === 'story_log' && !!rule.storyLog && rule.storyLog === event.id;
  if (rule.type === 'rare_route') return event.type === 'rare_route' && !!rule.route && rule.route === event.id;
  return false;
};

export const applyUnlockRewardEvents = (unlocks: UnlockState, events: UnlockRewardEvent[]) => {
  let next = unlocks;
  const newlyUnlocked: PurchasableUnlock[] = [];
  for (const rule of Object.values(getProgressionConfig().unlockRules)) {
    if (rule.type === 'purchase') continue;
    if (isEquipmentUnlocked(next, rule.category, rule.id)) continue;
    if (!idsByCategory[rule.category].includes(rule.id)) continue;
    if (!events.some((event) => matchesEvent(rule, event))) continue;
    next = addUnlock(next, rule.category, rule.id);
    newlyUnlocked.push({
      id: rule.id,
      category: rule.category,
      label: `${categoryLabels[rule.category]}: ${getItemLabel(rule.category, rule.id)}`,
      currency: 'credits',
      cost: 0,
      reason: ruleReason(rule),
    });
  }
  return { unlocks: next, newlyUnlocked };
};

export const getRunUnlockRewardEvents = (state: State): UnlockRewardEvent[] => {
  const events: UnlockRewardEvent[] = [];
  if (state.resultType === 'Boss Cleared') {
    events.push({ type: 'boss_clear' });
    events.push({ type: 'milestone', id: `clear_stage_${state.stage}` });
  }
  if (state.resultType === 'Early Return' || state.resultType === 'Boss Avoided') events.push({ type: 'early_return' });
  for (const contract of state.contracts) events.push({ type: 'contract', id: contract.id });
  for (const logId of state.story.recentRecoveredLogs) events.push({ type: 'story_log', id: logId });
  return events;
};

export const applyRunUnlockRewards = (state: State) =>
  applyUnlockRewardEvents(state.unlocks, getRunUnlockRewardEvents(state));
