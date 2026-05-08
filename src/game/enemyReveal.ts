import type { Devil, EncounterId } from './types';

export const UNKNOWN_SIGN_LABEL = 'UNKNOWN SIGN';

export const isEnemyIdentityKnown = (
  enemy: Devil,
  analyzedEnemyIds: string[] = [],
  alwaysReveal = false,
) => alwaysReveal || enemy.revealed || !!enemy.affinityRevealed || analyzedEnemyIds.includes(enemy.id);

export type EnemyRevealStage = 'unknown' | 'silhouette' | 'name' | 'intent' | 'affinity' | 'hint';
export type EnemyRevealState = {
  stage: EnemyRevealStage;
  showSilhouette: boolean;
  showName: boolean;
  showIntent: boolean;
  showHp: boolean;
  showAffinity: boolean;
  showHint: boolean;
  label: string;
};

type EnemyRevealOptions = {
  alwaysReveal?: boolean;
  forceUnknown?: boolean;
  bossProfile?: EncounterId;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const getEnemyRevealState = (
  enemy: Devil,
  analyzedEnemyIds: string[] = [],
  options: EnemyRevealOptions = {},
): EnemyRevealState => {
  const alwaysReveal = !!options.alwaysReveal;
  const forceUnknown = !!options.forceUnknown;
  const bossProfile = options.bossProfile ?? 'toll_gate_saint';

  if (forceUnknown) {
    return {
      stage: 'unknown',
      showSilhouette: false,
      showName: false,
      showIntent: false,
      showHp: false,
      showAffinity: false,
      showHint: false,
      label: UNKNOWN_SIGN_LABEL,
    };
  }

  if (alwaysReveal) {
    return {
      stage: 'hint',
      showSilhouette: false,
      showName: true,
      showIntent: true,
      showHp: true,
      showAffinity: true,
      showHint: true,
      label: enemy.name.toUpperCase(),
    };
  }

  if (enemy.profile === bossProfile) {
    const intelRatio = clamp(enemy.intelThreshold > 0 ? enemy.intelProgress / enemy.intelThreshold : 1, 0, 1);
    const stage: EnemyRevealStage = intelRatio < 0.2
      ? 'silhouette'
      : intelRatio < 0.45
        ? 'name'
        : intelRatio < 0.7
          ? 'intent'
          : intelRatio < 0.9
            ? 'affinity'
            : 'hint';
    const showName = stage !== 'silhouette';
    const showIntent = stage === 'intent' || stage === 'affinity' || stage === 'hint';
    const showAffinity = stage === 'affinity' || stage === 'hint';
    const showHint = stage === 'hint';
    return {
      stage,
      showSilhouette: stage === 'silhouette',
      showName,
      showIntent,
      showHp: showName,
      showAffinity,
      showHint,
      label: showName ? enemy.name.toUpperCase() : UNKNOWN_SIGN_LABEL,
    };
  }

  const known = isEnemyIdentityKnown(enemy, analyzedEnemyIds, false);
  if (!known) {
    return {
      stage: 'unknown',
      showSilhouette: false,
      showName: false,
      showIntent: false,
      showHp: false,
      showAffinity: false,
      showHint: false,
      label: UNKNOWN_SIGN_LABEL,
    };
  }

  const showAffinity = !!enemy.affinityRevealed;
  const showHint = enemy.intelProgress >= enemy.intelThreshold;
  return {
    stage: showHint ? 'hint' : showAffinity ? 'affinity' : 'intent',
    showSilhouette: false,
    showName: true,
    showIntent: true,
    showHp: true,
    showAffinity,
    showHint,
    label: enemy.name.toUpperCase(),
  };
};
