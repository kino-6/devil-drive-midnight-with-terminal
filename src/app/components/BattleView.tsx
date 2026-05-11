import { ApproachContactMarker, BattleDevilSprite } from '../../components/EncounterVisuals';
import { getEnemyRevealState } from '../../game/runtimeHelpers';
import { RoutePreviewMap } from './RoutePreviewMap';
import type { NaviRouteCandidate, NaviRouteIntelStatus } from '../state/routeGraph';
import type { EncounterProfile } from '../../devilConfig';
import type { CombatFxCue, DamagePop, Devil, EncounterId, ForecastMap, GamePhase, HitFxTone } from '../../game/types';

type BattleViewProps = {
  gamePhase: GamePhase;
  enemies: Devil[];
  selectedEnemyId: string;
  analyzedEnemyIds: string[];
  approachLineup: EncounterId[];
  approachScanSuccess: boolean;
  approachRevealIdentity: boolean;
  isEncounterActive: boolean;
  isRoadMoving: boolean;
  isRoadStopped: boolean;
  isBossPhase: boolean;
  isArmorCritical: boolean;
  isWindshieldFolded: boolean;
  hitFxTone: HitFxTone | null;
  hitFxPulse: number;
  combatFxCue: CombatFxCue | null;
  combatFxPulse: number;
  damagePops: DamagePop[];
  aliveEnemiesCount: number;
  forecast: ForecastMap;
  forecastUnstable: boolean;
  windshieldThreatLabel: string;
  routeCandidates?: NaviRouteCandidate[];
  routeIntelStatus?: NaviRouteIntelStatus;
  profiles: Record<EncounterId, EncounterProfile>;
  isBossProfile: (profile: EncounterId) => boolean;
  resolveUnknownEnemyAsset: (index: number) => string | undefined;
  resolveUnknownEnemyAnimationFrames: () => string[];
  resolveEnemyAsset: (profile: EncounterId) => string | undefined;
  resolveEnemyAnimationFrames: (profile: EncounterId) => string[];
  resolveEnemyLane: (index: number, total: number, isBoss: boolean) => 'left' | 'center' | 'right';
  getLikelyWeaknessSummary: (profile: EncounterId) => string;
  showDebugBadges?: boolean;
  onSelectEnemy: (enemyId: string) => void;
  onHoverEnemy?: (enemyId: string | null) => void;
  onRouteChoice?: (lane: NaviRouteCandidate['choiceId']) => void;
};

export const BattleView = ({
  gamePhase,
  enemies,
  selectedEnemyId,
  analyzedEnemyIds,
  approachLineup,
  approachScanSuccess,
  approachRevealIdentity,
  isEncounterActive,
  isRoadMoving,
  isRoadStopped,
  isBossPhase,
  isArmorCritical,
  isWindshieldFolded,
  hitFxTone,
  hitFxPulse,
  combatFxCue,
  combatFxPulse,
  damagePops,
  aliveEnemiesCount,
  forecast,
  forecastUnstable,
  windshieldThreatLabel,
  routeCandidates = [],
  routeIntelStatus,
  profiles,
  isBossProfile,
  resolveUnknownEnemyAsset,
  resolveUnknownEnemyAnimationFrames,
  resolveEnemyAsset,
  resolveEnemyAnimationFrames,
  resolveEnemyLane,
  getLikelyWeaknessSummary,
  showDebugBadges = false,
  onSelectEnemy,
  onHoverEnemy,
  onRouteChoice,
}: BattleViewProps) => {
  return (
    <section
    className={`battle-view ${isEncounterActive ? 'is-hot' : ''} ${isRoadMoving ? 'is-cruising' : ''} ${isRoadStopped ? 'is-stopped' : ''} ${gamePhase === 'route_choice' ? 'is-route-choice' : ''} ${gamePhase === 'route_choice' || gamePhase === 'approach' ? 'is-road-perspective' : ''} ${isBossPhase ? 'is-boss' : ''} ${hitFxTone ? `is-hitfx-${hitFxTone}` : ''} ${isArmorCritical ? 'is-armor-critical' : ''} ${isWindshieldFolded ? 'is-folded' : ''}`}
    >
    <div className="battle-view__frame" aria-hidden="true">
      <span className="battle-view__pillar battle-view__pillar--left" />
      <span className="battle-view__pillar battle-view__pillar--right" />
      <span className="battle-view__dashboard-lip" />
    </div>
    <div className="battle-view__road">
      <span className="battle-view__roadline" />
      <span className="battle-view__rail battle-view__rail--left" />
      <span className="battle-view__rail battle-view__rail--right" />
      <span className="battle-view__viaduct" />
      <span className="battle-view__streetlights" />
      <span className="battle-view__city" />
      <span className="battle-view__mist" />
      <span className="battle-view__headlights" />
      <span className="battle-view__armor-crack" />
      <span key={`hitfx-${hitFxPulse}`} className="battle-view__impact-fx" />
    </div>
    <div className="battle-view__hud">
      <span>THREAT FIELD {aliveEnemiesCount > 0 && (gamePhase === 'encounter' || gamePhase === 'boss_encounter') ? 'ACTIVE' : 'CLEAR'}</span>
      <strong>{windshieldThreatLabel}</strong>
    </div>
    {gamePhase === 'route_choice' && (
      <RoutePreviewMap candidates={routeCandidates} intelStatus={routeIntelStatus} onRouteChoice={onRouteChoice} />
    )}
    {isBossPhase && (
      <div className="battle-view__boss-alert">
        <span>BOSS SIGNAL</span>
        <strong>TOLL GATE SAINT</strong>
      </div>
    )}
    <div className="battle-view__devils">
      {(gamePhase === 'encounter' || gamePhase === 'boss_encounter' || gamePhase === 'reward') &&
        enemies.map((enemy, index) => {
          const reveal = getEnemyRevealState(enemy, analyzedEnemyIds);
          const showBossSilhouette = reveal.showSilhouette && isBossProfile(enemy.profile);
          const imageSrc = reveal.showName
            ? resolveEnemyAsset(enemy.profile)
            : showBossSilhouette
              ? resolveEnemyAsset(enemy.profile)
              : resolveUnknownEnemyAsset(index);
          const imageFrames = reveal.showName
            ? resolveEnemyAnimationFrames(enemy.profile)
            : showBossSilhouette
              ? resolveEnemyAnimationFrames(enemy.profile)
              : resolveUnknownEnemyAnimationFrames();
          return (
            <BattleDevilSprite
              key={enemy.id}
              devil={enemy}
              lane={resolveEnemyLane(index, enemies.length, gamePhase === 'boss_encounter')}
              focused={enemy.id === selectedEnemyId}
              revealState={reveal}
              imageSrc={imageSrc}
              imageFrames={imageFrames}
              showDebugBadge={showDebugBadges}
              hitFx={enemy.id === selectedEnemyId ? hitFxTone ?? undefined : undefined}
              damagePops={damagePops.filter((pop) => pop.enemyId === enemy.id)}
              intentForecast={forecast[enemy.id] ?? []}
              forecastUnstable={forecastUnstable}
              onSelect={() => onSelectEnemy(enemy.id)}
              onHoverEnemy={onHoverEnemy}
              encounterProfiles={profiles}
            />
          );
        })}
      {gamePhase === 'approach' &&
        approachLineup.map((profile, index) => (
          <ApproachContactMarker
            key={`${profile}-${index}`}
            profile={profile}
            lane={index === 0 ? 'left' : index === 1 ? 'center' : 'right'}
            scanSuccess={approachScanSuccess}
            revealIdentity={approachRevealIdentity}
            imageSrc={approachRevealIdentity ? resolveEnemyAsset(profile) : resolveUnknownEnemyAsset(index)}
            imageFrames={approachRevealIdentity ? resolveEnemyAnimationFrames(profile) : resolveUnknownEnemyAnimationFrames()}
            encounterProfiles={profiles}
            getLikelyWeaknessSummary={getLikelyWeaknessSummary}
          />
        ))}
    </div>
    {combatFxCue && (
      <span
        key={`combat-fx-${combatFxPulse}`}
        className={`battle-view__combat-fx battle-view__combat-fx--${combatFxCue}`}
      />
    )}
    <div className="battle-view__folded-note">WINDSHIELD VIEW FOLDED IN GARAGE MODE</div>
    </section>
  );
};
