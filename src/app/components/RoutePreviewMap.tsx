import { routeStepClass } from './routePreviewHelpers';
import type { NaviRouteCandidate, NaviRouteIntelStatus } from '../state/routeGraph';
import type { NaviRouteMap, NaviRouteMapNode } from '../state/routeMap';

type RoutePreviewMapProps = {
  candidates: NaviRouteCandidate[];
  intelStatus?: NaviRouteIntelStatus;
  routeMap?: NaviRouteMap;
  onRouteChoice?: (lane: NaviRouteCandidate['choiceId']) => void;
};

const RouteMapIcon = ({ step }: { step: string }) => (
  <span className={`route-map__map-icon route-map__map-icon--${routeStepClass(step)}`} aria-hidden="true" />
);

const RouteMapNode = ({
  node,
  onRouteChoice,
}: {
  node: NaviRouteMapNode;
  onRouteChoice?: (lane: NaviRouteCandidate['choiceId']) => void;
}) => {
  const className = [
    'route-map__node',
    `route-map__node--${node.status}`,
    `route-map__step--${routeStepClass(node.step)}`,
  ].join(' ');
  const style = {
    left: `${node.x}%`,
    top: `${node.y}%`,
  };
  const label = `${node.title}${node.bossSteps ? ` / Boss in ${node.bossSteps}` : ''}`;

  if (node.choiceId && onRouteChoice) {
    return (
      <button
        key={node.id}
        className={className}
        type="button"
        style={style}
        onClick={() => onRouteChoice(node.choiceId!)}
        aria-label={label}
        title={label}
      >
        <RouteMapIcon step={node.step} />
      </button>
    );
  }

  return (
    <span key={node.id} className={className} style={style} aria-label={label} title={label}>
      <RouteMapIcon step={node.step} />
    </span>
  );
};

export const RoutePreviewMap = ({ candidates, intelStatus, routeMap, onRouteChoice }: RoutePreviewMapProps) => {
  const visibleIntelStatus = routeMap?.intelStatus ?? intelStatus;
  const activeSignalBars = visibleIntelStatus?.level === 'high' ? 3 : visibleIntelStatus?.level === 'medium' ? 2 : 1;
  if (!routeMap || routeMap.nodes.length === 0 || candidates.length === 0) return null;

  return (
    <div className="battle-view__route-preview" aria-label="Route candidates">
      <div className="battle-view__route-map" aria-label="Route map">
        {visibleIntelStatus?.isLimited && (
          <div
            className={`route-map__signal-state route-map__signal-state--${visibleIntelStatus.level}`}
            title={`${visibleIntelStatus.label}: ${visibleIntelStatus.detail}`}
            aria-label={`${visibleIntelStatus.label}: ${visibleIntelStatus.detail}`}
          >
            <span className="route-map__signal-bars" aria-hidden="true">
              {[1, 2, 3].map((bar) => (
                <i key={bar} className={bar <= activeSignalBars ? 'is-active' : ''} />
              ))}
            </span>
            <span className="route-map__signal-mask" aria-hidden="true" />
          </div>
        )}
        <svg className="route-map__edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {routeMap.edges.map((edge) => (
            <line
              key={edge.id}
              className={`route-map__edge route-map__edge--${edge.status}`}
              x1={edge.fromX}
              y1={edge.fromY}
              x2={edge.toX}
              y2={edge.toY}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        {routeMap.nodes.map((node) => (
          <RouteMapNode key={node.id} node={node} onRouteChoice={onRouteChoice} />
        ))}
      </div>
    </div>
  );
};
