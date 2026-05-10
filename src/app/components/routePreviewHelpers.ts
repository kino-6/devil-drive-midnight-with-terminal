import type { NaviRouteCandidate } from '../state/routeGraph';

export const routeLaneLabels = ['LEFT', 'STRAIGHT', 'RIGHT'] as const;

export const routeStepToken = (step: string) => {
  if (step === 'SUPPLY') return 'SUP';
  if (step === 'SIGNAL') return 'SIG';
  if (step === 'CONTACT') return 'CNT';
  if (step === 'BOSS GATE') return 'GATE';
  if (step === 'BOSS') return 'BOSS';
  if (step === 'EXTRACT') return 'EXT';
  if (step === 'CHECKPOINT') return 'CHK';
  if (step === 'FORK') return 'FORK';
  return '?';
};

export const routeStepClass = (step: string) => step.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export const formatRouteForecast = (forecast: string[]) => forecast.map(routeStepToken).join(' > ');

export const buildRouteCandidateTitle = (candidate: NaviRouteCandidate, laneLabel: string) => [
  `${laneLabel}: ${candidate.title}`,
  `risk: ${candidate.risk}`,
  `reward: ${candidate.reward}`,
  candidate.resourceWarning,
  formatRouteForecast(candidate.forecast),
  `BOSS IN ${candidate.bossSteps ?? '--'}`,
].filter(Boolean).join(' / ');
