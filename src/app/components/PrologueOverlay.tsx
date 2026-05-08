import { useState } from 'react';

type PrologueOverlayProps = {
  visible: boolean;
  narrativeMoeLine: string;
  nightLoopIntroImage?: string;
  garageIntroImage?: string;
  showFirstGarageGuide: boolean;
  onStartEngine: () => void;
  onOpenGarage: () => void;
};

export const PrologueOverlay = ({
  visible,
  narrativeMoeLine,
  nightLoopIntroImage,
  garageIntroImage,
  showFirstGarageGuide,
  onStartEngine,
  onOpenGarage,
}: PrologueOverlayProps) => {
  const [previewMode, setPreviewMode] = useState<'nightloop' | 'garage'>('nightloop');
  if (!visible) return null;

  const previewImage = previewMode === 'garage'
    ? garageIntroImage ?? nightLoopIntroImage
    : nightLoopIntroImage ?? garageIntroImage;
  const previewAlt = previewMode === 'garage' ? 'Midnight Bay Garage' : 'Night Loop entry lane';

  return (
    <section className="prologue-overlay" role="dialog" aria-label="Night Loop Prologue">
      <div className="prologue-card">
        <div className="prologue-kicker">00:00 / MIDNIGHT WINDOW</div>
        <h2>NIGHT LOOP OPEN</h2>
        {previewImage && (
          <div className={`prologue-visual prologue-visual--${previewMode}`}>
            <img src={previewImage} alt={previewAlt} loading="eager" decoding="async" />
          </div>
        )}
        <p>M.O.E.: 「{narrativeMoeLine}」</p>
        <div className="prologue-actions" onMouseLeave={() => setPreviewMode('nightloop')}>
          <button
            className="command-button command-button--route"
            onClick={onStartEngine}
            onFocus={() => setPreviewMode('nightloop')}
            onMouseEnter={() => setPreviewMode('nightloop')}
            onPointerDown={() => setPreviewMode('nightloop')}
          >
            START ENGINE
          </button>
          <button
            className="command-button command-button--system"
            onClick={onOpenGarage}
            onFocus={() => setPreviewMode('garage')}
            onMouseEnter={() => setPreviewMode('garage')}
            onPointerDown={() => setPreviewMode('garage')}
          >
            ENTER GARAGE
          </button>
        </div>
        {showFirstGarageGuide && (
          <div className="prologue-guide">
            <strong>NAVI TIP</strong>
            <span>初回だけ案内: 出撃前に Garage で積み替えや成長ができます</span>
            <em>GARAGE ↓</em>
          </div>
        )}
      </div>
    </section>
  );
};
