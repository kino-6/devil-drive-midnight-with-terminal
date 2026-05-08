import { useEffect, useState } from 'react';
import type { Devil, EncounterId, HitFxTone } from '../game/types';
import type { EnemyRevealState } from '../game/runtimeHelpers';

const transparencyCache = new Map<string, string>();

const colorDistance = (a: [number, number, number], b: [number, number, number]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const buildCornerKeyedImage = async (src: string): Promise<string | undefined> => {
  if (transparencyCache.has(src)) return transparencyCache.get(src);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.decoding = 'async';
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = src;
    });
    const width = Math.max(1, Math.floor(img.naturalWidth || img.width));
    const height = Math.max(1, Math.floor(img.naturalHeight || img.height));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(img, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    const sample = (x: number, y: number): [number, number, number] => {
      const i = (y * width + x) * 4;
      return [pixels[i], pixels[i + 1], pixels[i + 2]];
    };
    const corners: [number, number, number][] = [
      sample(0, 0),
      sample(width - 1, 0),
      sample(0, height - 1),
      sample(width - 1, height - 1),
    ];
    const avg: [number, number, number] = [
      Math.round((corners[0][0] + corners[1][0] + corners[2][0] + corners[3][0]) / 4),
      Math.round((corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) / 4),
      Math.round((corners[0][2] + corners[1][2] + corners[2][2] + corners[3][2]) / 4),
    ];
    const isConsistent = corners.every((c) => colorDistance(c, avg) <= 20);
    if (!isConsistent) {
      transparencyCache.set(src, src);
      return src;
    }

    for (let i = 0; i < pixels.length; i += 4) {
      const p: [number, number, number] = [pixels[i], pixels[i + 1], pixels[i + 2]];
      const distance = colorDistance(p, avg);
      if (distance <= 18) {
        pixels[i + 3] = 0;
      } else if (distance <= 28) {
        pixels[i + 3] = Math.min(pixels[i + 3], 90);
      }
    }
    ctx.putImageData(imageData, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    transparencyCache.set(src, dataUrl);
    return dataUrl;
  } catch {
    return undefined;
  }
};

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
  transparencyMode = 'none',
}: {
  src?: string;
  alt: string;
  className?: string;
  fallback: JSX.Element;
  transparencyMode?: 'none' | 'auto-corner';
}) {
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(src);
  useEffect(() => {
    setBroken(false);
    setLoaded(false);
    setResolvedSrc(src);
    if (!src || transparencyMode === 'none') return;
    let alive = true;
    buildCornerKeyedImage(src).then((processed) => {
      if (!alive || !processed) return;
      setResolvedSrc(processed);
    }).catch(() => {
      if (!alive) return;
      setResolvedSrc(src);
    });
    return () => {
      alive = false;
    };
  }, [src, transparencyMode]);
  if (!src || broken) return fallback;
  return <img
    className={className}
    src={resolvedSrc ?? src}
    alt={alt}
    loading="lazy"
    decoding="async"
    style={{ visibility: loaded ? 'visible' : 'hidden' }}
    onLoad={() => setLoaded(true)}
    onError={() => setBroken(true)}
  />;
}

function DevilAnimationFigure({
  frames,
  alt,
  className,
  fallback,
}: {
  frames: string[];
  alt: string;
  className?: string;
  fallback: JSX.Element;
}) {
  const [idleFrame, moveFrame] = frames;
  if (!idleFrame || !moveFrame) return fallback;
  const idleClassName = `${className ?? ''} battle-devil__frame battle-devil__frame--idle`.trim();
  const moveClassName = `${className ?? ''} battle-devil__frame battle-devil__frame--move`.trim();
  return <div className="battle-devil__frames" role="img" aria-label={alt}>
    <AssetFigure
      src={idleFrame}
      alt=""
      className={idleClassName}
      fallback={fallback}
      transparencyMode="auto-corner"
    />
    <AssetFigure
      src={moveFrame}
      alt=""
      className={moveClassName}
      fallback={<AssetFigure
        src={idleFrame}
        alt=""
        className={moveClassName}
        fallback={<span />}
        transparencyMode="auto-corner"
      />}
      transparencyMode="auto-corner"
    />
  </div>;
}

type EncounterProfile = { label: string; threat: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL'; signal: string; contractable: boolean };

const intentIconMap: Record<Devil['intent'], string> = {
  attack: '⚔',
  curse: '☣',
  bargain: '◇',
  guard: '🛡',
  flee: '↯',
};

export function BattleDevilSprite({
  devil,
  focused,
  lane,
  revealState,
  onSelect,
  onHoverEnemy,
  imageSrc,
  imageFrames,
  showDebugBadge = false,
  hitFx,
  encounterProfiles,
}: {
  devil: Devil;
  focused: boolean;
  lane: 'left' | 'center' | 'right';
  revealState: EnemyRevealState;
  onSelect: () => void;
  onHoverEnemy?: (enemyId: string | null) => void;
  imageSrc?: string;
  imageFrames?: string[];
  showDebugBadge?: boolean;
  hitFx?: HitFxTone;
  encounterProfiles: Record<EncounterId, EncounterProfile>;
}) {
  const profile = encounterProfiles[devil.profile];
  const hpPct = Math.max(0, (devil.hp / devil.maxHp) * 100);
  const intelCurrent = Math.max(0, Math.floor(devil.intelProgress));
  const intelMax = Math.max(1, Math.floor(devil.intelThreshold));
  const intelPct = Math.max(0, Math.min(100, (intelCurrent / intelMax) * 100));
  const showIntelProgress = revealState.showName || intelCurrent > 0;
  const animationFrames = imageFrames?.map((frame) => frame.trim()).filter(Boolean).slice(0, 2) ?? [];
  const canAnimate = animationFrames.length >= 2;
  const staticImageSrc = animationFrames[0] ?? imageSrc;
  const unknownAssetClassName = `battle-devil__asset ${revealState.showSilhouette ? 'is-silhouette' : ''}`.trim();
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
    onMouseEnter={() => onHoverEnemy?.(devil.id)}
    onMouseLeave={() => onHoverEnemy?.(null)}
    onFocus={() => onHoverEnemy?.(devil.id)}
    onBlur={() => onHoverEnemy?.(null)}
  >
    <div className="battle-devil__body">
      <div className="battle-devil__art">
        {canAnimate
          ? <DevilAnimationFigure
            frames={animationFrames}
            alt={revealState.showName ? `${profile.label} visual` : 'Unknown signal visual'}
            className={revealState.showName ? 'battle-devil__asset' : unknownAssetClassName}
            fallback={revealState.showName ? renderDevilArt(devil.profile) : <span className="battle-devil__unknown">?</span>}
          />
          : revealState.showName
            ? <AssetFigure
              src={staticImageSrc}
              alt={`${profile.label} visual`}
              className="battle-devil__asset"
              fallback={renderDevilArt(devil.profile)}
              transparencyMode="auto-corner"
            />
            : <AssetFigure
            src={imageSrc}
            alt="Unknown signal visual"
            className={unknownAssetClassName}
            fallback={<span className="battle-devil__unknown">?</span>}
            transparencyMode="auto-corner"
          />}
      </div>
      <div className="battle-devil__label">
        <strong>{revealState.label}</strong>
      </div>
      {revealState.showHp && <div className="battle-devil__hp">
        <span>HP {devil.hp}/{devil.maxHp}</span>
        <div><i style={{ width: `${hpPct}%` }} /></div>
      </div>}
      {showIntelProgress && <div className="battle-devil__intel">
        <span>INTEL {intelCurrent}/{intelMax}</span>
        <div><i style={{ width: `${intelPct}%` }} /></div>
      </div>}
      <div className="battle-devil__intent">
        <span className={`battle-devil__intent-icon intent--${devil.intent}`}>{intentIconMap[devil.intent]}</span>
        <small>{revealState.showIntent ? devil.intent.toUpperCase() : 'UNKNOWN'}</small>
      </div>
    </div>
    {showDebugBadge && (
      <span className={`battle-devil__debug ${canAnimate ? 'is-animated' : ''}`}>
        {revealState.showName ? `ANIM ${animationFrames.length}F` : canAnimate ? `UNKNOWN ${animationFrames.length}F` : 'UNKNOWN STATIC'}
      </span>
    )}
    {focused && <span className="battle-devil__target">TARGET LOCK</span>}
  </article>;
}

export function ApproachContactMarker({
  profile,
  lane,
  scanSuccess,
  revealIdentity = false,
  imageSrc,
  imageFrames,
  encounterProfiles,
  getLikelyWeaknessSummary,
}: {
  profile: EncounterId;
  lane: 'left' | 'center' | 'right';
  scanSuccess: boolean;
  revealIdentity?: boolean;
  imageSrc?: string;
  imageFrames?: string[];
  encounterProfiles: Record<EncounterId, EncounterProfile>;
  getLikelyWeaknessSummary: (id: EncounterId) => string;
}) {
  const info = encounterProfiles[profile];
  const showIdentity = scanSuccess && revealIdentity;
  const animationFrames = imageFrames?.map((frame) => frame.trim()).filter(Boolean).slice(0, 2) ?? [];
  const canAnimate = animationFrames.length >= 2;
  return <article className={`approach-contact approach-contact--${lane}`}>
    <div className="approach-contact__sigil">
      {canAnimate
        ? <DevilAnimationFigure
          frames={animationFrames}
          alt={`${info.label} contact`}
          className="approach-contact__asset"
          fallback={<span className="approach-contact__fallback">?</span>}
        />
        : <AssetFigure
          src={imageSrc}
          alt={`${info.label} contact`}
          className="approach-contact__asset"
          fallback={<span className="approach-contact__fallback">?</span>}
          transparencyMode="auto-corner"
        />}
    </div>
    <div className="approach-contact__meta">
      <strong>{showIdentity ? info.label : 'UNKNOWN'}</strong>
      {showIdentity
        ? <>
          <small>{getLikelyWeaknessSummary(profile)}</small>
          <small>{info.signal.toLowerCase()}</small>
        </>
        : <small className="approach-contact__unknown">?</small>}
    </div>
  </article>;
}
