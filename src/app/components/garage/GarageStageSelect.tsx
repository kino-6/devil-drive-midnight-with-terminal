import { useMemo } from 'react';
import { getMoeLine } from '../../../game/moeDialogue';
import type { StageProfile } from './types';

type GarageStageSelectProps = {
  stageProfiles: StageProfile[];
  stageCount: number;
  selectedStage: number;
  selectedStageProfile: StageProfile;
  selectedStageAdvisory: string;
  showGarageLaunchConfirm: boolean;
  nextRunPreview: { fuel: number; armor: number; signal: number; mainAmmo: number; seAmmo: number };
  onSetStage: (stage: number) => void;
  onGarageEnterNightLoop: () => void;
  onGarageLaunchConfirm: () => void;
  onGarageLaunchCancel: () => void;
};

export const GarageStageSelect = ({
  stageProfiles,
  stageCount,
  selectedStage,
  selectedStageProfile,
  selectedStageAdvisory,
  showGarageLaunchConfirm,
  nextRunPreview,
  onSetStage,
  onGarageEnterNightLoop,
  onGarageLaunchConfirm,
  onGarageLaunchCancel,
}: GarageStageSelectProps) => {
  const sortieConfirmLine = useMemo(
    () => getMoeLine('moe.garage.sortie_confirm', '準備完了なら、出る。まだならここで調整して。', undefined, 'soft'),
    [showGarageLaunchConfirm],
  );

  return <>
    <div className="command-window">
      <strong>STAGE SELECT</strong>
      <div className="garage-select-grid">
        {stageProfiles
          .filter((profile) => profile.id <= stageCount)
          .map((profile) => <button
            key={`stage-${profile.id}`}
            className={`command-button command-button--route ${selectedStage === profile.id ? 'is-selected' : ''}`}
            onClick={() => onSetStage(profile.id)}
            data-desc={profile.hoverHint}
          >
            {profile.label}
          </button>)}
      </div>
      <small>
        現在選択: {selectedStageProfile.label}
        {' / '}
        {selectedStageProfile.subtitle}
      </small>
      <small>戦力判定: {selectedStageAdvisory}</small>
    </div>
    <div className="command-window command-list">
      {!showGarageLaunchConfirm
        ? <button className="command-button command-button--route" onClick={onGarageEnterNightLoop}>ENTER NIGHT LOOP</button>
        : <>
          <div className="command-window">
            <strong>Sortie Confirmation</strong>
            <p>M.O.E.: 「{sortieConfirmLine}」</p>
            <details className="garage-fold">
              <summary>STARTING RESOURCES PREVIEW</summary>
              <div className="garage-fold__body">
                <p>Fuel {nextRunPreview.fuel} / Armor {nextRunPreview.armor} / Signal {nextRunPreview.signal} / Main {nextRunPreview.mainAmmo} / S-E {nextRunPreview.seAmmo}</p>
              </div>
            </details>
          </div>
          <button className="command-button command-button--danger" onClick={onGarageLaunchConfirm}>CONFIRM SORTIE</button>
          <button className="command-button command-button--system" onClick={onGarageLaunchCancel}>KEEP TUNING</button>
        </>}
    </div>
  </>;
};
