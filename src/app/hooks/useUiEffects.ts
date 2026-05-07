import { useEffect, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { commandOptions } from '../../game/catalogs';
import type { Action, GamePhase, HitFxTone, State } from '../../game/types';

type UseUiEffectsParams = {
  state: State;
  dispatch: Dispatch<Action>;
  showGarageLaunchConfirm: boolean;
  setShowGarageLaunchConfirm: Dispatch<SetStateAction<boolean>>;
  terminalLogRef: RefObject<HTMLUListElement | null>;
  resetAutoplayReport: () => void;
  clearHoveredHint: () => void;
};

export const useUiEffects = ({
  state,
  dispatch,
  showGarageLaunchConfirm,
  setShowGarageLaunchConfirm,
  terminalLogRef,
  resetAutoplayReport,
  clearHoveredHint,
}: UseUiEffectsParams) => {
  const [hitFxTone, setHitFxTone] = useState<HitFxTone | null>(null);
  const [hitFxPulse, setHitFxPulse] = useState(0);

  useEffect(() => {
    if (state.gamePhase !== 'garage' && showGarageLaunchConfirm) {
      setShowGarageLaunchConfirm(false);
    }
  }, [state.gamePhase, showGarageLaunchConfirm, setShowGarageLaunchConfirm]);

  useEffect(() => {
    const log = state.logs[state.logs.length - 1] ?? '';
    let nextTone: HitFxTone | null = null;
    if (log.includes('WEAK POINT DETECTED')) nextTone = 'weak';
    else if (log.includes('RESISTED')) nextTone = 'resist';
    else if (
      log.includes('IMPACT CONFIRMED')
      || log.includes('MULTI TARGET HIT')
      || log.includes('CHASSIS IMPACT CONFIRMED')
    ) {
      nextTone = 'hit';
    }
    if (!nextTone) return;
    setHitFxTone(nextTone);
    setHitFxPulse((prev) => prev + 1);
    const timer = setTimeout(() => setHitFxTone(null), 420);
    return () => clearTimeout(timer);
  }, [state.logs]);

  useEffect(() => {
    if (!terminalLogRef.current) return;
    terminalLogRef.current.scrollTop = terminalLogRef.current.scrollHeight;
  }, [state.logs.length, terminalLogRef]);

  useEffect(() => {
    if (!(state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter')) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const commandIds = commandOptions.map((option) => option.id);
      const currentIndex = commandIds.findIndex((id) => id === state.encounter.selectedCommand);
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        dispatch({ type: 'SELECT_COMMAND', command: commandIds[(currentIndex - 1 + commandIds.length) % commandIds.length] });
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        dispatch({ type: 'SELECT_COMMAND', command: commandIds[(currentIndex + 1) % commandIds.length] });
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const live = state.encounter.enemies.filter((enemy) => enemy.hp > 0);
        if (live.length <= 1) return;
        const idx = live.findIndex((enemy) => enemy.id === state.encounter.selectedEnemyId);
        const next = event.key === 'ArrowLeft' ? (idx - 1 + live.length) % live.length : (idx + 1) % live.length;
        dispatch({ type: 'SELECT_ENEMY', enemyId: live[next].id });
      } else if (event.key === 'Enter') {
        event.preventDefault();
        dispatch({ type: 'EXECUTE_COMMAND' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.gamePhase, state.encounter, dispatch]);

  useEffect(() => {
    resetAutoplayReport();
  }, [
    state.selectedLoadout.mainGunId,
    state.selectedLoadout.subGunId,
    state.selectedLoadout.specialEquipmentId,
    state.selectedLoadout.contractSupportId,
    resetAutoplayReport,
  ]);

  useEffect(() => {
    clearHoveredHint();
  }, [state.gamePhase, clearHoveredHint]);

  return {
    hitFxTone,
    hitFxPulse,
  };
};

export const isBattlePhase = (phase: GamePhase) => phase === 'encounter' || phase === 'boss_encounter';
