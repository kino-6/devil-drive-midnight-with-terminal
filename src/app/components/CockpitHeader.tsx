import { AssetFigure } from '../../components/EncounterVisuals';
import { StatusLamp } from '../../components/DashboardWidgets';

type CockpitHeaderProps = {
  logoAsset?: string;
  runStatus: string;
  depth: number;
  currentNode: string;
  animationMode: 'play' | 'skip';
  isNaviActive: boolean;
  isWarnActive: boolean;
  isGameOver: boolean;
  devBuildLabel?: string;
  onAnimationModeChange: (mode: 'play' | 'skip') => void;
};

export const CockpitHeader = ({
  logoAsset,
  runStatus,
  depth,
  currentNode,
  animationMode,
  isNaviActive,
  isWarnActive,
  isGameOver,
  devBuildLabel,
  onAnimationModeChange,
}: CockpitHeaderProps) => (
  <header className="cockpit-header panel">
    <div className="brand-stack" aria-label="Devil Drive Midnight Terminal">
      <AssetFigure
        src={logoAsset}
        alt="Midnight Terminal logo"
        className="brand-stack__logo"
        fallback={<></>}
        transparencyMode="auto-corner"
      />
      <span>DEVIL DRIVE</span>
      <strong>MIDNIGHT TERMINAL</strong>
    </div>
    <div className="header-readouts">
      <div className="readout"><span>RUN STATUS</span><strong>{runStatus}</strong></div>
      <div className="readout"><span>DEPTH</span><strong>{String(depth).padStart(2, '0')}</strong></div>
      <div className="readout readout--wide"><span>CURRENT NODE</span><strong>{currentNode}</strong></div>
      <div className="readout"><span>TIME</span><strong>00:00</strong></div>
    </div>
    <div className="lamp-row" aria-label="System indicators">
      <div className="fx-mode-toggle" aria-label="Effect playback mode">
        <button
          type="button"
          className={animationMode === 'play' ? 'is-active' : ''}
          aria-pressed={animationMode === 'play'}
          title="演出を再生"
          onClick={() => onAnimationModeChange('play')}
        >
          ▶
        </button>
        <button
          type="button"
          className={animationMode === 'skip' ? 'is-active' : ''}
          aria-pressed={animationMode === 'skip'}
          title="演出を省略"
          onClick={() => onAnimationModeChange('skip')}
        >
          ▶▶
        </button>
      </div>
      <StatusLamp label="SYS" active tone={isGameOver ? 'red' : 'green'} />
      <StatusLamp label="NAVI" active={isNaviActive} tone="cyan" />
      <StatusLamp label="WARN" active={isWarnActive} tone="red" />
      {devBuildLabel && <span className="build-chip">REV {devBuildLabel}</span>}
    </div>
  </header>
);
