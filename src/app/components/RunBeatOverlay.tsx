import type { RunBeat } from '../hooks/useRunBeatQueue';

type RunBeatOverlayProps = {
  beat: RunBeat | null;
  onDismiss: () => void;
};

export const RunBeatOverlay = ({ beat, onDismiss }: RunBeatOverlayProps) => {
  if (!beat) return null;

  return (
    <button
      type="button"
      className={`run-beat-overlay run-beat-overlay--${beat.tone ?? 'system'}`}
      onClick={onDismiss}
      aria-label="Skip run beat"
    >
      <div className="run-beat-overlay__title">{beat.title}</div>
      {beat.subtitle && <div className="run-beat-overlay__subtitle">{beat.subtitle}</div>}
      {beat.moe && <div className="run-beat-overlay__moe">M.O.E.: 「{beat.moe}」</div>}
      <div className="run-beat-overlay__skip">Enter / Click to skip</div>
    </button>
  );
};
