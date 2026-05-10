import type { Devil } from './types';

export const getDevilTacticalHint = (devil: Devil, identityKnown: boolean): string => {
  if (!identityKnown) return 'Analyze first: name, action, and weakness are masked.';
  if (devil.armored) return 'Armored: Main/Ram lose bite. Use S-E, Signal, or Analyze lock.';
  switch (devil.temperament) {
    case 'hostile':
      return 'Hostile: Guard or jam intent before trading shots.';
    case 'machine':
      return 'Machine: EMP and Signal tools can stall its loop.';
    case 'lonely':
      return 'Lonely: Talk builds trust; avoid pressure spikes.';
    case 'hungry':
      return 'Hungry: Offer lines open contracts faster.';
    case 'curious':
      return 'Curious: Talk/Signal works, but it may flee.';
    case 'proud':
      return 'Proud: pressure plus patience; watch guard turns.';
    default:
      return 'Read weakness, then choose the counter.';
  }
};
