type PrologueOverlayProps = {
  visible: boolean;
  narrativeMoeLine: string;
  nightLoopIntroImage?: string;
  showFirstGarageGuide: boolean;
  onStartEngine: () => void;
  onOpenGarage: () => void;
};

export const PrologueOverlay = ({
  visible,
  narrativeMoeLine,
  nightLoopIntroImage,
  showFirstGarageGuide,
  onStartEngine,
  onOpenGarage,
}: PrologueOverlayProps) => {
  if (!visible) return null;

  return (
    <section className="prologue-overlay" role="dialog" aria-label="Night Loop Prologue">
      <div className="prologue-card">
        <div className="prologue-kicker">00:00 / MIDNIGHT WINDOW</div>
        <h2>NIGHT LOOP OPEN</h2>
        {nightLoopIntroImage && (
          <div className="prologue-visual">
            <img src={nightLoopIntroImage} alt="Night Loop entry lane" loading="eager" decoding="async" />
          </div>
        )}
        <p>M.O.E.: 「{narrativeMoeLine}」</p>
        <div className="prologue-actions">
          <button className="command-button command-button--route" onClick={onStartEngine}>START ENGINE</button>
          <button className="command-button command-button--system" onClick={onOpenGarage}>OPEN MIDNIGHT BAY</button>
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

