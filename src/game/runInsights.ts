import type { RunRecord } from '../saveSystem';

export const resultLabel = (value?: string) => value ?? 'Unknown';

export const buildMoeRunComment = (record: RunRecord): string => {
  const { fuel, armor, signal } = record.finalResources;
  if (armor <= 0) {
    return 'Armor depletion detected. Consider Guard timing, Armor Patch rewards, or Silent Shape support.';
  }
  if (fuel <= 0) {
    return 'Fuel loss terminated the route. Consider Safe Mainline or earlier Return Gate.';
  }
  if (signal <= 0) {
    return 'Signal dropped below safe threshold. Consider fewer Analyze calls or Signal Core rewards.';
  }
  if (record.analyzedEnemies.length === 0) {
    return 'No Analyze record found. Revealing affinities may reduce unnecessary damage.';
  }
  if (record.contractsAcquired.length === 0 && record.analyzedEnemies.length > 0) {
    return 'No negotiation trace found. Contract modules may change the next run\'s route options.';
  }
  if (!record.bossChallenged) {
    return 'Boss route was avoided. Prepare fuel and armor before crossing the Deep Toll signal.';
  }
  if (record.bossCleared) {
    return 'Boss clear confirmed. Next objective: optimize contract route or uncover remaining memory logs.';
  }
  if (record.returnGateUsed) {
    return 'Return route completed. Next run: push one lane deeper before disengaging.';
  }
  return 'Run data logged. Tune loadout based on weakest resource and re-enter the loop.';
};
