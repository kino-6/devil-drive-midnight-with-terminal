import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { commandOptions } from '../../game/catalogs';
import { collectCombatFxCues } from '../../game/combatFx';
import type { Action, CombatFxCue, DamagePop, GamePhase, HitFxTone, State } from '../../game/types';
import { isAlive } from '../../game/runtimeHelpers';

type UseUiEffectsParams = {
  state: State;
  dispatch: Dispatch<Action>;
  playCombatEffects: boolean;
  showGarageLaunchConfirm: boolean;
  setShowGarageLaunchConfirm: Dispatch<SetStateAction<boolean>>;
  terminalLogRef: RefObject<HTMLUListElement | null>;
  resetAutoplayReport: () => void;
  clearHoveredHint: () => void;
};

export const useUiEffects = ({
  state,
  dispatch,
  playCombatEffects,
  showGarageLaunchConfirm,
  setShowGarageLaunchConfirm,
  terminalLogRef,
  resetAutoplayReport,
  clearHoveredHint,
}: UseUiEffectsParams) => {
  const [hitFxTone, setHitFxTone] = useState<HitFxTone | null>(null);
  const [hitFxPulse, setHitFxPulse] = useState(0);
  const [combatFxCue, setCombatFxCue] = useState<CombatFxCue | null>(null);
  const [combatFxPulse, setCombatFxPulse] = useState(0);
  const [combatFxQueue, setCombatFxQueue] = useState<CombatFxCue[]>([]);
  const [damagePops, setDamagePops] = useState<DamagePop[]>([]);
  const previousLogLengthRef = useRef(state.logs.length);
  const previousEnemyHpRef = useRef(new Map(state.encounter.enemies.map((enemy) => [enemy.id, enemy.hp])));
  const damagePopIdRef = useRef(0);

  useEffect(() => {
    if (state.gamePhase !== 'garage' && showGarageLaunchConfirm) {
      setShowGarageLaunchConfirm(false);
    }
  }, [state.gamePhase, showGarageLaunchConfirm, setShowGarageLaunchConfirm]);

  useEffect(() => {
    if (!playCombatEffects) {
      setHitFxTone(null);
      return;
    }
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
  }, [playCombatEffects, state.logs]);

  useEffect(() => {
    const previousLength = previousLogLengthRef.current;
    const nextLogs = state.logs.length >= previousLength ? state.logs.slice(previousLength) : state.logs;
    previousLogLengthRef.current = state.logs.length;
    if (!playCombatEffects) {
      setCombatFxQueue([]);
      setCombatFxCue(null);
      return;
    }
    if (nextLogs.length === 0) return;
    const cues = collectCombatFxCues(nextLogs);
    if (cues.length === 0) return;
    setCombatFxQueue((current) => [...current, ...cues]);
  }, [playCombatEffects, state.logs]);

  useEffect(() => {
    if (!playCombatEffects) return;
    if (combatFxCue || combatFxQueue.length === 0) return;
    const [nextCue, ...remaining] = combatFxQueue;
    setCombatFxQueue(remaining);
    setCombatFxCue(nextCue);
    setCombatFxPulse((prev) => prev + 1);
  }, [combatFxCue, combatFxQueue, playCombatEffects]);

  useEffect(() => {
    if (!combatFxCue) return;
    const timer = setTimeout(() => setCombatFxCue(null), 860);
    return () => clearTimeout(timer);
  }, [combatFxCue, combatFxPulse]);

  useEffect(() => {
    const previousHp = previousEnemyHpRef.current;
    const nextHp = new Map(state.encounter.enemies.map((enemy) => [enemy.id, enemy.hp]));
    previousEnemyHpRef.current = nextHp;
    if (!playCombatEffects) {
      setDamagePops([]);
      return;
    }
    const nextPops = state.encounter.enemies.flatMap((enemy) => {
      const before = previousHp.get(enemy.id);
      if (typeof before !== 'number' || enemy.hp >= before) return [];
      damagePopIdRef.current += 1;
      return [{ id: damagePopIdRef.current, enemyId: enemy.id, amount: before - enemy.hp }];
    });
    if (nextPops.length > 0) setDamagePops((current) => [...current, ...nextPops].slice(-8));
  }, [playCombatEffects, state.encounter.enemies]);

  useEffect(() => {
    if (damagePops.length === 0) return;
    const timer = setTimeout(() => setDamagePops([]), 900);
    return () => clearTimeout(timer);
  }, [damagePops]);

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
        const live = state.encounter.enemies.filter(isAlive);
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
    combatFxCue,
    combatFxPulse,
    damagePops,
  };
};

export const isBattlePhase = (phase: GamePhase) => phase === 'encounter' || phase === 'boss_encounter';
