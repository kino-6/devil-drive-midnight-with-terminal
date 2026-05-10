import { useMemo } from 'react';
import { getMoeLine } from '../../../game/moeDialogue';

type GarageCommandsProps = {
  showGarageLaunchConfirm: boolean;
  onGarageEnterNightLoop: () => void;
  onGarageLaunchConfirm: () => void;
  onGarageLaunchCancel: () => void;
};

export const GarageCommands = ({
  showGarageLaunchConfirm,
  onGarageEnterNightLoop,
  onGarageLaunchConfirm,
  onGarageLaunchCancel,
}: GarageCommandsProps) => {
  const readyCheckLine = useMemo(
    () => getMoeLine('moe.garage.ready_check', '積み替え、終わった？ このまま夜環へ入る。', undefined, 'soft'),
    [showGarageLaunchConfirm],
  );

  return <div className="command-window command-list">
    {!showGarageLaunchConfirm
      ? <button className="command-button command-button--route" onClick={onGarageEnterNightLoop}>ENTER NIGHT LOOP</button>
      : <>
        <div className="command-window">
          <strong>READY CHECK</strong>
          <p>M.O.E.: 「{readyCheckLine}」</p>
        </div>
        <button className="command-button command-button--danger" onClick={onGarageLaunchConfirm}>YES, ENTER NIGHT LOOP</button>
        <button className="command-button command-button--system" onClick={onGarageLaunchCancel}>NOT YET</button>
      </>}
  </div>;
};
