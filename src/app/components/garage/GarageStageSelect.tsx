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
  const readiness = [
    { id: 'fuel', icon: 'F', label: 'Fuel', value: nextRunPreview.fuel, status: nextRunPreview.fuel >= 6 ? 'ready' : 'tight' },
    { id: 'armor', icon: 'A', label: 'Armor', value: nextRunPreview.armor, status: nextRunPreview.armor >= 6 ? 'ready' : 'tight' },
    { id: 'signal', icon: 'S', label: 'Signal', value: nextRunPreview.signal, status: nextRunPreview.signal >= 2 ? 'ready' : 'tight' },
    { id: 'main', icon: 'M', label: 'Main', value: nextRunPreview.mainAmmo, status: nextRunPreview.mainAmmo >= 4 ? 'ready' : 'tight' },
    { id: 'se', icon: 'SE', label: 'S-E', value: nextRunPreview.seAmmo, status: nextRunPreview.seAmmo >= 1 ? 'ready' : 'tight' },
    {
      id: 'return',
      icon: 'R',
      label: 'Return',
      value: nextRunPreview.fuel >= 4 && nextRunPreview.armor >= 4 ? 'OK' : 'TIGHT',
      status: nextRunPreview.fuel >= 4 && nextRunPreview.armor >= 4 ? 'ready' : 'tight',
    },
  ] as const;

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
    <div className="command-window">
      <strong>LAUNCH READINESS</strong>
      <div className="launch-readiness-grid" aria-label="Launch readiness">
        {readiness.map((item) => (
          <div key={item.id} className={`launch-readiness-tile launch-readiness-tile--${item.status}`}>
            <span>{item.icon}</span>
            <small>{item.label}</small>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
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
