import { commandAffinityMap } from '../../game/catalogs';
import type { AffinityRating, AffinityType, CommandId, Devil, SpecialEquipment, State, SubGun, MainGun } from '../../game/types';
import { getEnemyRevealState, isAlive } from '../../game/runtimeHelpers';
import { damageVarianceByCommand, getAffinityTag, getRollBounds, resolveDamageBounds } from '../state/stateReducer';

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
  const selectedEnemyReveal = selectedEnemy ? getEnemyRevealState(selectedEnemy, state.encounter.analyzedEnemyIds) : undefined;
  const selectedEnemyKnown = !!selectedEnemyReveal?.showName;
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
    talk: (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') && selectedEnemyAlive && selectedEnemyKnown,
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
    const estimateDamage = ({
      baseDamage,
      affinityType,
      variance,
      armored = false,
    }: {
      baseDamage: number;
      affinityType: AffinityType;
      variance: number;
      armored?: boolean;
    }) => {
      const ratings: AffinityRating[] = target && !targetAnalyzed
        ? ['resist', 'normal', 'weak']
        : [getAffinityFor(affinityType)];
      const bounds = ratings.map((affinity) => resolveDamageBounds({
        baseDamage,
        affinity,
        variance,
        flatReduction: shield,
        armored,
      }));
      const min = Math.min(...bounds.map((range) => range.min));
      const max = Math.max(...bounds.map((range) => range.max));
      return `${target && !targetAnalyzed ? '~' : ''}${min}-${max}`;
    };
    const shield = target?.guardStacks && target.guardStacks > 0 ? 1 : 0;
    if (commandId === 'main_gun') {
      return estimateDamage({
        baseDamage: selectedMainGun.damage + state.skillLevels.gunnery,
        affinityType: 'ballistic',
        variance: damageVarianceByCommand.main_gun,
        armored: !!target?.armored && targetAnalyzed,
      });
    }
    if (commandId === 'sub_gun') {
      return estimateDamage({
        baseDamage: selectedSubGun.damage,
        affinityType: 'suppressive',
        variance: damageVarianceByCommand.sub_gun,
        armored: !!target?.armored && targetAnalyzed,
      });
    }
    if (commandId === 'se_harpoon') {
      return estimateDamage({
        baseDamage: selectedSE.damage,
        affinityType: 'signal',
        variance: damageVarianceByCommand.se_harpoon,
      });
    }
    const ramBase = target?.intent === 'guard' ? 2 : 3;
    return estimateDamage({
      baseDamage: ramBase,
      affinityType: 'impact',
      variance: damageVarianceByCommand.ram,
      armored: !!target?.armored && targetAnalyzed,
    });
  };

  const approachMainGunDesc = `先制主砲。与ダメ目安 ${getRollBounds(selectedMainGun.damage + state.skillLevels.gunnery, damageVarianceByCommand.approach_main_gun).min}-${getRollBounds(selectedMainGun.damage + state.skillLevels.gunnery, damageVarianceByCommand.approach_main_gun).max} / MainAmmo-1 / 交渉難化`;

  return {
    contractEnabled,
    commandAffinityTagMap,
    commandEnabledMap,
    getPredictedDamageLabel,
    approachMainGunDesc,
  };
};
