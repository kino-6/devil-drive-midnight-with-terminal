import { buildRouteCandidateTitle, routeLaneLabels, routeStepClass } from './routePreviewHelpers';
import type { NaviRouteCandidate, NaviRouteIntelStatus } from '../state/routeGraph';

type RoutePreviewMapProps = {
  candidates: NaviRouteCandidate[];
  intelStatus?: NaviRouteIntelStatus;
  onRouteChoice?: (lane: NaviRouteCandidate['choiceId']) => void;
};

const RouteMapIcon = ({ step }: { step: string }) => (
  <span className={`route-map__map-icon route-map__map-icon--${routeStepClass(step)}`} aria-hidden="true" />
);

export const RoutePreviewMap = ({ candidates, intelStatus, onRouteChoice }: RoutePreviewMapProps) => {
  const routePreviewCandidates = candidates.slice(0, 3);
  const activeSignalBars = intelStatus?.level === 'high' ? 3 : intelStatus?.level === 'medium' ? 2 : 1;
  if (routePreviewCandidates.length === 0) return null;

  return (
    <div className="battle-view__route-preview" aria-label="Route candidates">
      <div className="battle-view__route-map" aria-label="Route map">
        {intelStatus?.isLimited && (
          <div
            className={`route-map__signal-state route-map__signal-state--${intelStatus.level}`}
            title={`${intelStatus.label}: ${intelStatus.detail}`}
            aria-label={`${intelStatus.label}: ${intelStatus.detail}`}
          >
            <span className="route-map__signal-bars" aria-hidden="true">
              {[1, 2, 3].map((bar) => (
                <i key={bar} className={bar <= activeSignalBars ? 'is-active' : ''} />
              ))}
            </span>
            <span className="route-map__signal-mask" aria-hidden="true" />
          </div>
        )}
        <span className="route-map__boss" title="Boss" aria-label="Boss">
          <RouteMapIcon step="BOSS" />
        </span>
        <span className="route-map__origin" title="Current position" aria-label="Current position">
          <RouteMapIcon step="ORIGIN" />
        </span>
        {routePreviewCandidates.map((candidate, index) => {
          const laneLabel = routeLaneLabels[index] ?? 'LANE';
          const forecastSteps = candidate.forecast.length > 0 ? candidate.forecast.slice(0, 4) : ['FORK'];
          const routeTitle = buildRouteCandidateTitle(candidate, laneLabel);
          return (
            <button
              key={`route-map-${candidate.nodeId}-${candidate.choiceId}`}
              className={`route-map__lane route-map__lane--${index}`}
              type="button"
              onClick={() => onRouteChoice?.(candidate.choiceId)}
              disabled={!onRouteChoice}
              aria-label={routeTitle}
              title={routeTitle}
            >
              <span className="route-map__path" aria-hidden="true">
                {forecastSteps.map((step, stepIndex) => (
                  <span
                    key={`${candidate.nodeId}-${step}-${stepIndex}`}
                    className={`route-map__path-node route-map__path-node--${stepIndex} route-map__step--${routeStepClass(step)}`}
                  >
                    <RouteMapIcon step={step} />
                  </span>
                ))}
              </span>
              <small className="route-map__boss-steps" title="Steps to boss">
                <RouteMapIcon step="BOSS" />
                <span>{candidate.bossSteps ?? '--'}</span>
              </small>
            </button>
          );
        })}
      </div>
    </div>
  );
};
