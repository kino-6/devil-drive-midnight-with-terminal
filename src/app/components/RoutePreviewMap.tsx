import { buildRouteCandidateTitle, routeLaneLabels, routeStepClass, routeStepToken } from './routePreviewHelpers';
import type { NaviRouteCandidate, NaviRouteIntelStatus } from '../state/routeGraph';

type RoutePreviewMapProps = {
  candidates: NaviRouteCandidate[];
  intelStatus?: NaviRouteIntelStatus;
  onRouteChoice?: (lane: NaviRouteCandidate['choiceId']) => void;
};

export const RoutePreviewMap = ({ candidates, intelStatus, onRouteChoice }: RoutePreviewMapProps) => {
  const routePreviewCandidates = candidates.slice(0, 3);
  if (routePreviewCandidates.length === 0) return null;

  return (
    <div className="battle-view__route-preview" aria-label="Route candidates">
      {intelStatus?.isLimited && (
        <div className={`battle-view__route-status battle-view__route-status--${intelStatus.level}`} title={intelStatus.detail}>
          <strong>{intelStatus.label}</strong>
        </div>
      )}
      <div className="battle-view__route-map" aria-label="Route map">
        <span className="route-map__boss">BOSS</span>
        <span className="route-map__origin">NOW</span>
        <span className="route-map__trunk" />
        <span className="route-map__branch route-map__branch--left" />
        <span className="route-map__branch route-map__branch--straight" />
        <span className="route-map__branch route-map__branch--right" />
        {routePreviewCandidates.map((candidate, index) => {
          const laneLabel = routeLaneLabels[index] ?? 'LANE';
          const primaryStep = candidate.forecast[0] ?? 'FORK';
          const futureSteps = candidate.forecast.slice(1, 4);
          const routeTitle = buildRouteCandidateTitle(candidate, laneLabel);
          return (
            <div key={`route-map-${candidate.nodeId}-${candidate.choiceId}`} className={`route-map__lane route-map__lane--${index}`}>
              <button
                className={`route-map__node route-map__node--${index}`}
                type="button"
                onClick={() => onRouteChoice?.(candidate.choiceId)}
                disabled={!onRouteChoice}
                aria-label={routeTitle}
                title={routeTitle}
              >
                <span className={`route-map__node-token route-map__step--${routeStepClass(primaryStep)}`}>
                  {routeStepToken(primaryStep)}
                </span>
              </button>
              <div className="route-map__future" aria-hidden="true">
                {futureSteps.map((step, stepIndex) => (
                  <span
                    key={`${candidate.nodeId}-${step}-${stepIndex}`}
                    className={`route-map__step route-map__step--${routeStepClass(step)}`}
                  >
                    {routeStepToken(step)}
                  </span>
                ))}
              </div>
              <small className="route-map__boss-steps">B{candidate.bossSteps ?? '--'}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
};
