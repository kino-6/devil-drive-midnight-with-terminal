import { useState } from 'react';

type ProloguePreviewMode = 'nightloop' | 'garage';

type DebugSaveHeader = { id: string; label?: string; createdAt: number };

type PrologueOverlayProps = {
  visible: boolean;
  narrativeMoeLine: string;
  nightLoopIntroImage?: string;
  garageIntroImage?: string;
  showFirstGarageGuide: boolean;
  showDebugSaveBoot?: boolean;
  mainSaveSummary?: string;
  autoSaveLabel?: string;
  autoSaveReason?: string;
  autoSaveAvailable?: boolean;
  debugSaveHeaders?: DebugSaveHeader[];
  onStartEngine: () => void;
  onOpenGarage: () => void;
  onRestoreAutoSave?: () => void;
  onRestoreDebugSave?: (id: string) => void;
};

export const PrologueOverlay = ({
  visible,
  narrativeMoeLine,
  nightLoopIntroImage,
  garageIntroImage,
  showFirstGarageGuide,
  showDebugSaveBoot = false,
  mainSaveSummary = 'Main save loaded',
  autoSaveLabel = 'none',
  autoSaveReason = '-',
  autoSaveAvailable = false,
  debugSaveHeaders = [],
  onStartEngine,
  onOpenGarage,
  onRestoreAutoSave,
  onRestoreDebugSave,
}: PrologueOverlayProps) => {
  const [previewMode, setPreviewMode] = useState<ProloguePreviewMode>('garage');
  if (!visible) return null;

  const showNightLoopPreview = () => setPreviewMode('nightloop');
  const showGaragePreview = () => setPreviewMode('garage');
  const previewEvents = (mode: ProloguePreviewMode) => {
    const showPreview = mode === 'garage' ? showGaragePreview : showNightLoopPreview;
    return {
      onFocus: showPreview,
      onMouseEnter: showPreview,
      onPointerDown: showPreview,
    };
  };
  const previewImage = previewMode === 'garage'
    ? garageIntroImage ?? nightLoopIntroImage
    : nightLoopIntroImage ?? garageIntroImage;
  const previewAlt = previewMode === 'garage' ? 'Midnight Bay Garage' : 'Night Loop entry lane';
  const previewTitle = previewMode === 'garage' ? 'GARAGE BAY / SAFE PREP' : 'NIGHT LOOP / DIRECT SORTIE';
  const previewCaption = previewMode === 'garage'
    ? '装備、Unlock、Stageを確認してから出る。'
    : '今の構成でそのまま夜環へ入る。';

  return (
    <section className="prologue-overlay" role="dialog" aria-label="Night Loop Prologue">
      <div className="prologue-card">
        <div className="prologue-kicker">00:00 / MIDNIGHT WINDOW</div>
        <h2>ENTER GARAGE</h2>
        {previewImage && (
          <div className={`prologue-visual prologue-visual--${previewMode}`}>
            <img src={previewImage} alt={previewAlt} loading="eager" decoding="async" />
            <div className="prologue-visual__label">
              <strong>{previewTitle}</strong>
              <span>{previewCaption}</span>
            </div>
          </div>
        )}
        <p>M.O.E.: 「{narrativeMoeLine}」</p>
        <div className="prologue-actions" onMouseLeave={showGaragePreview}>
          <button
            className="command-button command-button--route prologue-action prologue-action--primary"
            onClick={onOpenGarage}
            {...previewEvents('garage')}
          >
            <span>ENTER GARAGE</span>
            <small>Check loadout first</small>
          </button>
          <button
            className="command-button command-button--system prologue-action"
            onClick={onStartEngine}
            {...previewEvents('nightloop')}
          >
            <span>START ENGINE</span>
            <small>Direct sortie</small>
          </button>
        </div>
        {showFirstGarageGuide && (
          <div className="prologue-guide">
            <strong>NAVI TIP</strong>
            <span>初回だけ案内: 出撃前に Garage で積み替えや成長ができます</span>
            <em>GARAGE ↓</em>
          </div>
        )}
        {showDebugSaveBoot && (
          <details className="prologue-save-picker" open>
            <summary>DEBUG SAVE BOOT</summary>
            <div className="prologue-save-picker__body">
              <div className="prologue-save-row">
                <span>MAIN</span>
                <strong>{mainSaveSummary}</strong>
                <small>loaded</small>
              </div>
              <button
                className="command-button command-button--route"
                disabled={!autoSaveAvailable}
                onClick={onRestoreAutoSave}
              >
                Restore AutoSave <span>{autoSaveLabel} / {autoSaveReason}</span>
              </button>
              {debugSaveHeaders.length > 0
                ? debugSaveHeaders.slice(0, 5).map((entry) => (
                  <button
                    key={entry.id}
                    className="command-button command-button--system"
                    onClick={() => onRestoreDebugSave?.(entry.id)}
                  >
                    Debug: {entry.label ?? entry.id}
                    <span>{new Date(entry.createdAt).toLocaleString()}</span>
                  </button>
                ))
                : <p>No debug save slots found.</p>}
            </div>
          </details>
        )}
      </div>
    </section>
  );
};
