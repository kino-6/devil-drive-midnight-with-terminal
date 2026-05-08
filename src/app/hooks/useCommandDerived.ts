import { commandAffinityMap } from '../../game/catalogs';
import type { AffinityRating, AffinityType, CommandId, Devil, SpecialEquipment, State, SubGun, MainGun } from '../../game/types';
import { getEnemyRevealState, isAlive } from '../../game/runtimeHelpers';
import { damageVarianceByCommand, getAffinityTag, getRollBounds, resolveDamageRoll } from '../state/stateReducer';

type UseCommandDerivedArgs = {
  state: State;
  selectedEnemy?: Devil;
  selectedEnemyAnalyzed: boolean;
  selectedMainGun: MainGun;
  selectedSubGun: SubGun;
  selectedSE: SpecialEquipment;
};

type UseCommandDerivedResult = {
  contractEnabled: boolean;
  commandAffinityTagMap: Partial<Record<CommandId, string>>;
  commandEnabledMap: Record<CommandId, boolean>;
  getPredictedDamageLabel: (commandId: 'main_gun' | 'sub_gun' | 'se_harpoon' | 'ram') => string;
  approachMainGunDesc: string;
};

export const useCommandDerived = ({
  state,
  selectedEnemy,
  selectedEnemyAnalyzed,
  selectedMainGun,
  selectedSubGun,
  selectedSE,
}: UseCommandDerivedArgs): UseCommandDerivedResult => {
  const aliveEnemies = state.encounter.enemies.filter(isAlive);
  const selectedEnemyAlive = !!selectedEnemy && isAlive(selectedEnemy);
  const contractEnabled = !!selectedEnemy && selectedEnemy.contractWindow && selectedEnemy.contractable;

  const commandAffinityTagMap: Partial<Record<CommandId, string>> = selectedEnemyAnalyzed && selectedEnemy
    ? Object.fromEntries(
      (Object.entries(commandAffinityMap) as Array<[CommandId, AffinityType]>).map(([commandId, affinity]) => [commandId, getAffinityTag(selectedEnemy.affinities[affinity])]),
    )
    : {};

  const commandEnabledMap: Record<CommandId, boolean> = {
    main_gun: (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') && selectedEnemyAlive && state.mainAmmo > 0,
    sub_gun: (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') && aliveEnemies.length > 0,
    se_harpoon: (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') && selectedEnemyAlive && state.seAmmo >= selectedSE.seAmmoCost,
    analyze: (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') && selectedEnemyAlive && state.signal > 0,
    talk: (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') && selectedEnemyAlive,
    contract: (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') && contractEnabled,
    ram: (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') && selectedEnemyAlive && state.armor > 0,
    guard: state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter',
    escape: (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') && state.fuel > 0,
  };

  const getPredictedDamageLabel = (commandId: 'main_gun' | 'sub_gun' | 'se_harpoon' | 'ram') => {
    const target = selectedEnemy;
    const targetAnalyzed = !!target && getEnemyRevealState(target, state.encounter.analyzedEnemyIds).showAffinity;
    const getAffinityFor = (affinity: AffinityType): AffinityRating =>
      target && targetAnalyzed ? target.affinities[affinity] : 'normal';
    const shield = target?.guardStacks && target.guardStacks > 0 ? 1 : 0;
    if (commandId === 'main_gun') {
      const roll = resolveDamageRoll({
        baseDamage: selectedMainGun.damage + state.skillLevels.gunnery,
        affinity: getAffinityFor('ballistic'),
        variance: damageVarianceByCommand.main_gun,
        flatReduction: shield,
      });
      return `${roll.min}-${roll.max}`;
    }
    if (commandId === 'sub_gun') {
      const roll = resolveDamageRoll({
        baseDamage: selectedSubGun.damage,
        affinity: getAffinityFor('suppressive'),
        variance: damageVarianceByCommand.sub_gun,
        flatReduction: shield,
        armored: !!target?.armored,
      });
      return `${roll.min}-${roll.max}`;
    }
    if (commandId === 'se_harpoon') {
      const roll = resolveDamageRoll({
        baseDamage: selectedSE.damage,
        affinity: getAffinityFor('signal'),
        variance: damageVarianceByCommand.se_harpoon,
        flatReduction: shield,
      });
      return `${roll.min}-${roll.max}`;
    }
    const ramBase = target?.intent === 'guard' ? 2 : 3;
    const roll = resolveDamageRoll({
      baseDamage: ramBase,
      affinity: getAffinityFor('impact'),
      variance: damageVarianceByCommand.ram,
      flatReduction: shield,
    });
    return `${roll.min}-${roll.max}`;
  };

  const approachMainGunDesc = `先制主砲。予測DMG ${getRollBounds(selectedMainGun.damage + state.skillLevels.gunnery, damageVarianceByCommand.approach_main_gun).min}-${getRollBounds(selectedMainGun.damage + state.skillLevels.gunnery, damageVarianceByCommand.approach_main_gun).max} / MainAmmo-1 / 交渉難化`;

  return {
    contractEnabled,
    commandAffinityTagMap,
    commandEnabledMap,
    getPredictedDamageLabel,
    approachMainGunDesc,
  };
};
