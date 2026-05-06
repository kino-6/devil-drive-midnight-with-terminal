import { useEffect, useState } from 'react';
import type { AffinityType, Devil, EncounterId, HitFxTone } from '../game/types';

function renderDevilArt(profile: EncounterId) {
  if (profile === 'whisper_broker') {
    return <svg viewBox="0 0 180 180" role="img" aria-label="Whisper Broker silhouette">
      <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M90 28c10 0 18 8 18 18v10h-36V46c0-10 8-18 18-18z" />
        <path d="M68 62c8-8 36-8 44 0l-8 64H76z" fill="currentColor" fillOpacity=".3" />
        <path d="M76 74c6-5 22-5 28 0M78 90c6-5 20-5 26 0" />
        <path d="M90 126v34m0-22l-20 20m20-16l20 20" />
      </g>
    </svg>;
  }
  if (profile === 'toll_gate_saint') {
    return <svg viewBox="0 0 180 180" role="img" aria-label="Toll Gate Saint silhouette">
      <g fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="54" y="38" width="72" height="44" rx="4" />
        <path d="M90 82v56m0-28l-26 24m26-20l26 24" />
        <path d="M67 52h46m-46 9h46" />
        <path d="M46 146h88" />
        <path d="M54 38l-16 14m88-14l16 14" opacity=".55" />
      </g>
    </svg>;
  }
  if (profile === 'road_reaper') {
    return <svg viewBox="0 0 180 180" role="img" aria-label="Road Reaper silhouette">
      <g fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M88 18h4v20h-4z" />
        <rect x="64" y="40" width="52" height="34" />
        <path d="M90 74v52m0-30l-26 26m26-22l26 26" />
      </g>
    </svg>;
  }
  if (profile === 'silent_shape') {
    return <svg viewBox="0 0 180 180" role="img" aria-label="Silent Shape silhouette">
      <defs>
        <radialGradient id="silentMass" cx="50%" cy="48%" r="58%">
          <stop offset="0%" stopColor="currentColor" stopOpacity=".62" />
          <stop offset="100%" stopColor="currentColor" stopOpacity=".05" />
        </radialGradient>
      </defs>
      <ellipse cx="90" cy="94" rx="62" ry="52" fill="url(#silentMass)" />
      <path d="M62 136c11-25-8-43 15-74 9-12 25-12 34 0 24 31 5 48 17 74-17-10-34-12-66 0z" fill="currentColor" fillOpacity=".4" />
    </svg>;
  }
  if (profile === 'roadside_phone') {
    return <svg viewBox="0 0 180 180" role="img" aria-label="Roadside Phone silhouette">
      <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="64" y="36" width="52" height="88" rx="5" />
        <rect x="74" y="48" width="32" height="26" rx="2" />
      </g>
    </svg>;
  }
  return <svg viewBox="0 0 180 180" role="img" aria-label="Abandoned AI Navi silhouette">
    <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="40" y="44" width="100" height="70" rx="9" />
      <path d="M54 58h72v42H54z" opacity=".45" />
      <path d="M66 86l22-16 16 8 18-14" />
    </g>
  </svg>;
}

export function AssetFigure({
  src,
  alt,
  className,
  fallback,
}: {
  src?: string;
  alt: string;
  className?: string;
  fallback: JSX.Element;
}) {
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setBroken(false);
    setLoaded(false);
  }, [src]);
  if (!src || broken) return fallback;
  return <img
    className={className}
    src={src}
    alt={alt}
    loading="lazy"
    decoding="async"
    style={{ visibility: loaded ? 'visible' : 'hidden' }}
    onLoad={() => setLoaded(true)}
    onError={() => setBroken(true)}
  />;
}

type EncounterProfile = { label: string; threat: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL'; signal: string; contractable: boolean };

export function BattleDevilSprite({
  devil,
  focused,
  lane,
  analyzed,
  onSelect,
  imageSrc,
  hitFx,
  encounterProfiles,
  affinityOrder,
  affinityLabel,
  getAffinityTag,
  getContractHint,
}: {
  devil: Devil;
  focused: boolean;
  lane: 'left' | 'center' | 'right';
  analyzed: boolean;
  onSelect: () => void;
  imageSrc?: string;
  hitFx?: HitFxTone;
  encounterProfiles: Record<EncounterId, EncounterProfile>;
  affinityOrder: AffinityType[];
  affinityLabel: Record<AffinityType, string>;
  getAffinityTag: (rating: Devil['affinities'][AffinityType]) => string;
  getContractHint: (enemy: Devil) => string;
}) {
  const profile = encounterProfiles[devil.profile];
  const hpPct = Math.max(0, (devil.hp / devil.maxHp) * 100);
  return <article
    className={`battle-devil battle-devil--${lane} ${focused ? 'is-focused' : ''} ${profile.contractable ? 'is-contractable' : 'is-hostile'} ${devil.hp <= 0 ? 'is-defeated' : ''} ${hitFx ? `is-hitfx-${hitFx}` : ''}`}
    onClick={onSelect}
    role="button"
    tabIndex={0}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect();
      }
    }}
  >
    <div className="battle-devil__body">
      <div className="battle-devil__art">
        <AssetFigure
          src={imageSrc}
          alt={`${profile.label} visual`}
          className="battle-devil__asset"
          fallback={renderDevilArt(devil.profile)}
        />
      </div>
      <div className="battle-devil__label">
        <strong>{analyzed ? devil.name.toUpperCase() : 'UNKNOWN SIGN'}</strong>
        <span>{profile.contractable ? 'CONTRACTABLE' : 'HOSTILE'} / {profile.threat}</span>
      </div>
      <div className="battle-devil__hp">
        <span>HP {devil.hp}/{devil.maxHp}</span>
        <div><i style={{ width: `${hpPct}%` }} /></div>
      </div>
      <div className="battle-devil__intel">
        {analyzed
          ? <>
            <small>TEMP: {devil.temperament.toUpperCase()}</small>
            <small>INTENT: {devil.intent.toUpperCase()}</small>
            <small className="battle-devil__affinity">
              AFF:
              {affinityOrder.map((affinity) => <span key={`${devil.id}-${affinity}`} className={`affinity-chip affinity-chip--${devil.affinities[affinity]}`}>
                {affinityLabel[affinity].slice(0, 3).toUpperCase()} {getAffinityTag(devil.affinities[affinity])}
              </span>)}
            </small>
            <small>{getContractHint(devil)}</small>
          </>
          : <>
            <small>INTEL: UNKNOWN / ANALYZE REQUIRED</small>
            <small className="battle-devil__affinity">AFF: UNKNOWN</small>
          </>}
        {devil.contractWindow && <small className="battle-devil__window">CONTRACT WINDOW OPEN</small>}
      </div>
    </div>
    {focused && <span className="battle-devil__target">TARGET LOCK</span>}
  </article>;
}

export function ApproachContactMarker({
  profile,
  lane,
  scanSuccess,
  imageSrc,
  encounterProfiles,
  getLikelyWeaknessSummary,
}: {
  profile: EncounterId;
  lane: 'left' | 'center' | 'right';
  scanSuccess: boolean;
  imageSrc?: string;
  encounterProfiles: Record<EncounterId, EncounterProfile>;
  getLikelyWeaknessSummary: (id: EncounterId) => string;
}) {
  const info = encounterProfiles[profile];
  return <article className={`approach-contact approach-contact--${lane}`}>
    <div className="approach-contact__sigil">
      <AssetFigure
        src={imageSrc}
        alt={`${info.label} contact`}
        className="approach-contact__asset"
        fallback={<span className="approach-contact__fallback">?</span>}
      />
    </div>
    <div className="approach-contact__meta">
      <strong>{scanSuccess ? info.label : 'UNKNOWN CONTACT'}</strong>
      <small>{scanSuccess ? `suggested: ${getLikelyWeaknessSummary(profile)}` : 'suggested: Analyze / Guard'}</small>
      <small>{scanSuccess ? info.signal.toLowerCase() : 'signal noise / unknown lane object'}</small>
    </div>
  </article>;
}
