import { getDevilConfig } from '../devilConfig';
import type { EncounterId, Intent } from './types';

type IntentWeight = [Intent, number];

const pickWeightedIntent = (weights: IntentWeight[]): Intent => {
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [intent, weight] of weights) {
    roll -= weight;
    if (roll <= 0) return intent;
  }
  return weights[weights.length - 1]?.[0] ?? 'attack';
};

export const chooseNextIntent = (profile?: EncounterId): Intent => {
  const template = profile ? getDevilConfig().devilTemplates[profile] : undefined;
  if (profile === 'toll_gate_saint') {
    return pickWeightedIntent([
      ['guard', 34],
      ['bargain', 30],
      ['attack', 22],
      ['curse', 14],
    ]);
  }
  if (profile === 'road_reaper') {
    return pickWeightedIntent([
      ['attack', 58],
      ['guard', 24],
      ['curse', 10],
      ['bargain', 6],
      ['flee', 2],
    ]);
  }
  if (template?.armored) {
    return pickWeightedIntent([
      ['guard', 34],
      ['attack', 30],
      ['bargain', 18],
      ['curse', 14],
      ['flee', 4],
    ]);
  }
  switch (template?.temperament) {
    case 'hostile':
      return pickWeightedIntent([
        ['attack', 56],
        ['guard', 18],
        ['curse', 16],
        ['bargain', 8],
        ['flee', 2],
      ]);
    case 'machine':
      return pickWeightedIntent([
        ['guard', 34],
        ['curse', 24],
        ['attack', 22],
        ['bargain', 12],
        ['flee', 8],
      ]);
    case 'lonely':
      return pickWeightedIntent([
        ['curse', 34],
        ['bargain', 24],
        ['guard', 18],
        ['attack', 14],
        ['flee', 10],
      ]);
    case 'hungry':
      return pickWeightedIntent([
        ['bargain', 40],
        ['attack', 24],
        ['curse', 16],
        ['guard', 16],
        ['flee', 4],
      ]);
    case 'curious':
      return pickWeightedIntent([
        ['bargain', 26],
        ['flee', 24],
        ['curse', 18],
        ['attack', 16],
        ['guard', 16],
      ]);
    case 'proud':
      return pickWeightedIntent([
        ['attack', 34],
        ['guard', 34],
        ['bargain', 16],
        ['curse', 14],
        ['flee', 2],
      ]);
    default:
      return pickWeightedIntent([
        ['attack', 40],
        ['curse', 22],
        ['bargain', 18],
        ['guard', 15],
        ['flee', 5],
      ]);
  }
};
