import type { CommandId, Devil } from './types';

export type ActionRisk = 'neutral' | 'warning' | 'danger';

export const formatIntentLabel = (intent: Devil['intent']) => intent.toUpperCase();

export const getIntentImpactLabel = (intent?: Devil['intent'], vulnerable = false) => {
  if (!intent) return '--';
  if (intent === 'attack') return vulnerable ? 'ARMOR -1' : 'ARMOR -2';
  if (intent === 'curse') return 'SIGNAL -1';
  if (intent === 'bargain') return 'FUEL/SIGNAL -1';
  if (intent === 'guard') return 'GUARD +1';
  return 'FLEE';
};

export const getIntentRisk = (intent?: Devil['intent']): ActionRisk => {
  if (intent === 'attack' || intent === 'curse') return 'danger';
  if (intent === 'bargain' || intent === 'flee') return 'warning';
  return 'neutral';
};

export const getIntentOutcome = (intent: Devil['intent']) => {
  if (intent === 'attack') return 'Armor hit';
  if (intent === 'curse') return 'Signal noise';
  if (intent === 'bargain') return 'Fuel/Signal cost';
  if (intent === 'guard') return 'Damage down';
  return 'May flee';
};

export const getActionLockedReason = ({
  targetKnown,
  signal,
}: {
  targetKnown: boolean;
  signal: number;
}) => {
  if (signal <= 0) return 'SIGNAL NEEDED';
  return targetKnown ? 'ANALYZE TO READ' : 'ID / ACTION LOCKED';
};

export const getCommandActionHint = ({
  commandId,
  intent,
  actionReadable,
  targetKnown,
  signal,
  contractEnabled,
}: {
  commandId: CommandId;
  intent?: Devil['intent'];
  actionReadable: boolean;
  targetKnown: boolean;
  signal: number;
  contractEnabled: boolean;
}) => {
  if (!actionReadable || !intent) {
    if (commandId === 'analyze') {
      return signal > 0 ? 'Reads Action' : 'No Signal: action stays locked';
    }
    if (commandId === 'talk' && !targetKnown) return 'Analyze first';
    if (commandId === 'contract' && !contractEnabled) return 'No contract window';
    return getActionLockedReason({ targetKnown, signal });
  }

  if (commandId === 'guard') {
    if (intent === 'attack') return 'Covers Attack';
    if (intent === 'curse') return 'Mitigates Curse';
    if (intent === 'bargain') return 'Bargain still costs';
    if (intent === 'guard') return 'Safe into Guard';
    return 'Covers failed escape';
  }
  if (commandId === 'sub_gun') {
    if (intent === 'attack') return 'Can soften Attack';
    if (intent === 'guard') return 'Chips Guard';
    if (intent === 'flee') return 'Tags fleeing target';
    return 'Pressure all targets';
  }
  if (commandId === 'se_harpoon') {
    if (intent === 'guard') return 'Breaks Guard';
    if (intent === 'curse') return 'Disrupts signal action';
    if (intent === 'bargain') return 'Opens talk window';
    return 'High pressure window';
  }
  if (commandId === 'main_gun') {
    if (intent === 'guard') return 'Reduced by Guard';
    if (intent === 'attack') return 'Race damage';
    if (intent === 'flee') return 'Stop escape now';
    return 'Direct pressure';
  }
  if (commandId === 'ram') {
    if (intent === 'guard') return 'Risk: Guard blocks';
    if (intent === 'attack') return 'Risk: armor trade';
    if (intent === 'flee') return 'Cuts off escape';
    return 'Fast impact';
  }
  if (commandId === 'talk') {
    if (!targetKnown) return 'Analyze first';
    if (intent === 'attack') return 'Talk Break: shift Attack';
    if (intent === 'guard') return 'Talk Break: safe setup';
    if (intent === 'bargain') return 'Talk Break: bargain risk';
    return 'Talk Break + route read';
  }
  if (commandId === 'contract') return contractEnabled ? 'Use open window' : 'No contract window';
  if (commandId === 'escape') {
    if (intent === 'attack') return 'Risk: hit on exit';
    if (intent === 'guard') return 'Safe exit chance';
    if (intent === 'flee') return 'Both sides disengage';
    return 'Fuel for distance';
  }
  return 'Reads Action';
};
