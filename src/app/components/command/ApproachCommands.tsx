import type { State } from '../../../game/types';

type ApproachCommandsProps = {
  state: State;
  approachMainGunDesc: string;
  getDialogueLine: (key: string, fallback: string) => string;
  setHoveredHint: (hint: string) => void;
  clearHoveredHint: () => void;
  onApproachChoose: (option: 'preemptive_main_gun' | 'hit_and_run_ram' | 'silent_coast' | 'open_channel') => void;
  onApproachContinue: () => void;
};

export const ApproachCommands = ({
  state,
  approachMainGunDesc,
  getDialogueLine,
  setHoveredHint,
  clearHoveredHint,
  onApproachChoose,
  onApproachContinue,
}: ApproachCommandsProps) => {
  if (state.gamePhase !== 'approach' || !state.approach) return null;

  return (
    <div className="command-window command-list">
      {state.approach.scanSuccess
        ? <>
          <button
            className="command-button command-button--danger"
            onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.approach.preemptive', '先制主砲。接敵前に削るけど交渉は荒れる。'))}
            onMouseLeave={clearHoveredHint}
            onClick={() => onApproachChoose('preemptive_main_gun')}
            disabled={state.mainAmmo <= 0}
            data-desc={approachMainGunDesc}
          >
            Preemptive Main Gun
          </button>
          <button className="command-button command-button--danger" onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.approach.hit_and_run', '轢き逃げ突破。成功すれば接敵を飛ばせる。'))} onMouseLeave={clearHoveredHint} onClick={() => onApproachChoose('hit_and_run_ram')} data-desc="轢き逃げ突破。Armor-1 Fuel-1 / 成功で遭遇回避">
            Hit-and-Run Ram
          </button>
          <button className="command-button command-button--route" onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.approach.silent_coast', '静穏接近。交渉初手を通しやすくする。'))} onMouseLeave={clearHoveredHint} onClick={() => onApproachChoose('silent_coast')} data-desc="静穏接近。Fuel-1 / 初手Talk成功率上昇 / 敵攻勢鈍化">
            Silent Coast
          </button>
          <button
            className="command-button command-button--contract"
            onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.approach.open_channel', '先行交信。契約窓を開けたい時の前振り。'))}
            onMouseLeave={clearHoveredHint}
            onClick={() => onApproachChoose('open_channel')}
            disabled={state.signal <= 0}
            data-desc="先行交信。Signal-1 / interest上昇 / hostile相手は逆上リスク"
          >
            Open Channel
          </button>
        </>
        : <button className="command-button command-button--danger" onMouseEnter={() => setHoveredHint(getDialogueLine('hint.hover.approach.brace', '不意打ち受領。被害を抑える準備を。'))} onMouseLeave={clearHoveredHint} onClick={onApproachContinue}>
          Brace for Contact
        </button>}
    </div>
  );
};
