import type { ContractSupportId, MainGunId, SpecialEquipmentId, State, SubGunId } from '../../../game/types';
import { buildGarageLoadoutGroups, type GarageLoadoutGroupId } from './loadoutOptions';

type GarageLoadoutSectionProps = {
  state: State;
  onSetMainGun: (id: MainGunId) => void;
  onSetSubGun: (id: SubGunId) => void;
  onSetSpecial: (id: SpecialEquipmentId) => void;
  onSetSupport: (id: ContractSupportId) => void;
};

export const GarageLoadoutSection = ({
  state,
  onSetMainGun,
  onSetSubGun,
  onSetSpecial,
  onSetSupport,
}: GarageLoadoutSectionProps) => {
  const groups = buildGarageLoadoutGroups(state);

  const onChooseLoadout = (groupId: GarageLoadoutGroupId, id: string) => {
    if (groupId === 'mainGuns') onSetMainGun(id as MainGunId);
    if (groupId === 'subGuns') onSetSubGun(id as SubGunId);
    if (groupId === 'specialEquipment') onSetSpecial(id as SpecialEquipmentId);
    if (groupId === 'support') onSetSupport(id as ContractSupportId);
  };

  return <div className="garage-block">
    <h3>Loadout</h3>
    {groups.map((group) => <details key={group.id} className="garage-fold" open={group.id === 'mainGuns'}>
      <summary>{group.title}</summary>
      <div className="garage-fold__body">
        <div className="garage-select-grid">
          {group.options.map((option) => <button
            key={option.id}
            className={option.className}
            disabled={!!option.lockedReason}
            onClick={() => onChooseLoadout(group.id, option.id)}
            data-desc={option.desc}
          >
            {option.label} {option.lockedReason && <span>{option.lockedReason}</span>}
          </button>)}
        </div>
      </div>
    </details>)}
  </div>;
};
