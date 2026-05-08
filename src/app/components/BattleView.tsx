import { ApproachContactMarker, BattleDevilSprite } from '../../components/EncounterVisuals';
import { getEnemyRevealState } from '../../game/runtimeHelpers';
import type { NaviRouteCandidate, NaviRouteIntelStatus } from '../state/routeGraph';
import type { EncounterProfile } from '../../devilConfig';
import type { Devil, EncounterId, GamePhase, HitFxTone, Intent } from '../../game/types';

type IngressStep = {
  label: string;
  done: boolean;
};

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
  aliveEnemiesCount: number;
  ingressSteps: IngressStep[];
  windshieldThreatLabel: string;
  routeCandidates?: NaviRouteCandidate[];
  routeIntelStatus?: NaviRouteIntelStatus;
  detailEnemy?: Devil;
  detailIntentIconMap: Record<Intent, string>;
  profiles: Record<EncounterId, EncounterProfile>;
  getContractHint: (enemy: Devil) => string;
  isBossProfile: (profile: EncounterId) => boolean;
  resolveUnknownEnemyAsset: (index: number) => string | undefined;
  resolveUnknownEnemyAnimationFrames: () => string[];
  resolveEnemyAsset: (profile: EncounterId) => string | undefined;
  resolveEnemyAnimationFrames: (profile: EncounterId) => string[];
  resolveEnemyLane: (index: number, total: number, isBoss: boolean) => 'left' | 'center' | 'right';
  getLikelyWeaknessSummary: (profile: EncounterId) => string;
  showDebugBadges?: boolean;
  onSelectEnemy: (enemyId: string) => void;
  onHoverEnemy: (enemyId: string | null) => void;
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
  aliveEnemiesCount,
  ingressSteps,
  windshieldThreatLabel,
  routeCandidates = [],
  routeIntelStatus,
  detailEnemy,
  detailIntentIconMap,
  profiles,
  getContractHint,
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
}: BattleViewProps) => {
  const detailReveal = detailEnemy ? getEnemyRevealState(detailEnemy, analyzedEnemyIds) : undefined;
  const detailIntelCurrent = detailEnemy ? Math.max(0, Math.floor(detailEnemy.intelProgress)) : 0;
  const detailIntelMax = detailEnemy ? Math.max(1, detailEnemy.intelThreshold) : 1;
  const detailAffinityUnlockAt = Math.floor(detailIntelMax * 0.7);
  const detailAffinityRemaining = Math.max(0, detailAffinityUnlockAt - detailIntelCurrent);
  const analyzeIntelGain = 55;
  const analyzesToAffinityReveal = detailEnemy?.affinityRevealed
    ? 0
    : Math.ceil(detailAffinityRemaining / analyzeIntelGain);

  return (
    <section
    className={`battle-view ${isEncounterActive ? 'is-hot' : ''} ${isRoadMoving ? 'is-cruising' : ''} ${isRoadStopped ? 'is-stopped' : ''} ${isBossPhase ? 'is-boss' : ''} ${hitFxTone ? `is-hitfx-${hitFxTone}` : ''} ${isArmorCritical ? 'is-armor-critical' : ''} ${isWindshieldFolded ? 'is-folded' : ''}`}
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
      <span className="battle-view__speedlines" />
      <span className="battle-view__mist" />
      <span className="battle-view__headlights" />
      <span className="battle-view__armor-crack" />
      <span key={`hitfx-${hitFxPulse}`} className="battle-view__impact-fx" />
    </div>
    <div className="battle-view__hud">
      <span>THREAT FIELD {aliveEnemiesCount > 0 && (gamePhase === 'encounter' || gamePhase === 'boss_encounter') ? 'ACTIVE' : 'CLEAR'}</span>
      <strong>{windshieldThreatLabel}</strong>
    </div>
    {gamePhase === 'route_choice' && routeCandidates.length > 0 && (
      <div className="battle-view__route-preview" aria-label="Route candidates">
        {routeIntelStatus?.isLimited && (
          <div className={`battle-view__route-status battle-view__route-status--${routeIntelStatus.level}`}>
            <strong>{routeIntelStatus.label}</strong>
            <small>{routeIntelStatus.detail}</small>
          </div>
        )}
        {routeCandidates.slice(0, 3).map((candidate, index) => (
          <div key={`${candidate.nodeId}-${candidate.choiceId}`} className={`battle-view__route-card battle-view__route-card--${index}`}>
            <span>{index === 0 ? 'LEFT' : index === 1 ? 'STRAIGHT' : 'RIGHT'}</span>
            <strong>{candidate.title}</strong>
            <small>{candidate.tags}</small>
            <small>{candidate.forecast.join(' > ')}</small>
            <small>BOSS IN {candidate.bossSteps ?? '--'}</small>
          </div>
        ))}
      </div>
    )}
    {isBossPhase && (
      <div className="battle-view__boss-alert">
        <span>BOSS SIGNAL</span>
        <strong>TOLL GATE SAINT</strong>
      </div>
    )}
    {gamePhase === 'approach' && (
      <div className="battle-view__ingress" aria-label="Approach progress">
        {ingressSteps.map((step, idx) => (
          <div
            key={step.label}
            className={`battle-view__ingress-step ${step.done ? 'is-done' : ''} ${idx === ingressSteps.length - 1 ? 'is-current' : ''}`}
            aria-label={step.label}
          >
            <span aria-hidden="true" />
          </div>
        ))}
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
    {(gamePhase === 'encounter' || gamePhase === 'boss_encounter') && detailEnemy && (
      <section className="target-detail-panel target-detail-panel--overlay">
        <div className="target-detail-panel__head">
          <strong>TARGET DETAIL</strong>
          <small>{detailReveal?.showName ? detailEnemy.name.toUpperCase() : 'UNKNOWN SIGN'}</small>
        </div>
        <div className="target-detail-panel__core">
          <span className={`target-detail-panel__intent intent--${detailEnemy.intent}`}>
            {detailIntentIconMap[detailEnemy.intent]} {detailReveal?.showIntent ? detailEnemy.intent.toUpperCase() : 'UNKNOWN'}
          </span>
          {detailReveal?.showHp && <span>HP {detailEnemy.hp}/{detailEnemy.maxHp}</span>}
          <span>{detailReveal?.showName ? `${profiles[detailEnemy.profile].contractable ? 'CONTRACTABLE' : 'HOSTILE'} / ${profiles[detailEnemy.profile].threat}` : 'UNKNOWN / ---'}</span>
          {detailReveal?.showHint && <span>INTEL {detailIntelCurrent}/{detailIntelMax}</span>}
        </div>
        <div className="target-detail-panel__intel">
          {detailReveal?.showHint
            ? <small>{getContractHint(detailEnemy)}</small>
            : <small>INTEL LOCKED / HOVER + ANALYZE TO REVEAL</small>}
          {detailReveal?.showHint && !detailEnemy.affinityRevealed && (
            <small>
              {analyzesToAffinityReveal <= 1
                ? 'NEXT ANALYZE: WEAK/RESIST DECODE'
                : `AFFINITY LOCKED / ~${analyzesToAffinityReveal} ANALYZE TO DECODE`}
            </small>
          )}
          {detailEnemy.contractWindow && <small className="battle-devil__window">CONTRACT WINDOW OPEN</small>}
        </div>
      </section>
    )}
    <div className="battle-view__folded-note">WINDSHIELD VIEW FOLDED IN GARAGE MODE</div>
    </section>
  );
};
