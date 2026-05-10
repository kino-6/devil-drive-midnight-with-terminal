import { useEffect, useMemo, useRef, useState } from 'react';
import {
  listDebugSaveHeaders,
  loadAutoSaveSnapshot,
  loadSaveData,
  recordRunResult,
  saveAutoSaveSnapshot,
  savePersistentProgression,
  unlockMoeMemory,
  updateSaveData,
  type RunRecord,
} from '../../saveSystem';
import { buildMoeRunComment } from '../../game/runInsights';
import type { GamePhase, State } from '../../game/types';

export type AppRuntimeSaveSnapshot = {
  state: State;
  runIndex: number;
  activeRun: RunRecord | null;
};

type UseSaveRuntimeParams = {
  state: State;
  narrativeMoeLine: string;
};

export const useSaveRuntime = ({ state, narrativeMoeLine }: UseSaveRuntimeParams) => {
  const [saveRefresh, setSaveRefresh] = useState(0);
  const [saveMessage, setSaveMessage] = useState('');
  const [debugSaveHeaders, setDebugSaveHeaders] = useState<Array<{ id: string; label?: string; createdAt: number }>>([]);

  const phaseRef = useRef<GamePhase>(state.gamePhase);
  const bossChallengedRef = useRef(state.bossChallenged);
  const runIndexRef = useRef(0);
  const processedLogCountRef = useRef(0);
  const loadoutHashRef = useRef(JSON.stringify(state.selectedLoadout));
  const activeRunRef = useRef<RunRecord | null>(null);
  const lastAutoSaveAtRef = useRef(0);
  const latestStateRef = useRef(state);

  const saveSnapshot = useMemo(() => loadSaveData(), [saveRefresh]);
  const autoSaveSnapshot = useMemo(() => loadAutoSaveSnapshot<AppRuntimeSaveSnapshot>(), [saveRefresh]);
  const persistentProgressionHash = useMemo(() => JSON.stringify({
    stage: state.stage,
    selectedLoadout: state.selectedLoadout,
    skillLevels: state.skillLevels,
    vehicleUpgrades: state.vehicleUpgrades,
    unlocks: state.unlocks,
    driverXpBank: state.driverXpBank,
    moeSyncBank: state.moeSyncBank,
    creditBank: state.creditBank,
    story: state.story,
  }), [
    state.stage,
    state.selectedLoadout,
    state.skillLevels,
    state.vehicleUpgrades,
    state.unlocks,
    state.driverXpBank,
    state.moeSyncBank,
    state.creditBank,
    state.story,
  ]);

  const refreshSaveSnapshot = () => setSaveRefresh((value) => value + 1);
  const refreshDebugHeaders = () => setDebugSaveHeaders(listDebugSaveHeaders());

  const buildRuntimeSnapshot = (): AppRuntimeSaveSnapshot => ({
    state: latestStateRef.current,
    runIndex: runIndexRef.current,
    activeRun: activeRunRef.current,
  });

  const autoSaveNow = (reason: string) => {
    const saved = saveAutoSaveSnapshot(buildRuntimeSnapshot(), reason);
    if (saved) {
      lastAutoSaveAtRef.current = saved.savedAt;
      setSaveMessage(`AutoSaved: ${new Date(saved.savedAt).toLocaleTimeString()} (${reason})`);
      refreshSaveSnapshot();
    }
  };

  const beginRunRecord = () => {
    const ts = Date.now();
    const id = `run-${ts}-${Math.random().toString(36).slice(2, 8)}`;
    activeRunRef.current = {
      id,
      startedAt: ts,
      endedAt: ts,
      encountersCleared: 0,
      bossChallenged: false,
      bossCleared: false,
      contractsAcquired: [],
      defeatedEnemies: [],
      analyzedEnemies: [],
      routeChoices: [],
      returnGateUsed: false,
      finalResources: {
        fuel: state.fuel,
        armor: state.armor,
        signal: state.signal,
        mainAmmo: state.mainAmmo,
        seAmmo: state.seAmmo,
      },
      moeComment: narrativeMoeLine,
    };
    updateSaveData((current) => ({ ...current, totalRuns: current.totalRuns + 1 }));
    refreshSaveSnapshot();
    autoSaveNow('run_start');
  };

  const finalizeRunRecord = (resultType: string, gameOverReason?: string) => {
    const current = activeRunRef.current;
    if (!current) return;
    const endedAt = Date.now();
    const finalizedBase: RunRecord = {
      ...current,
      endedAt,
      resultType,
      encountersCleared: state.runSummary.cleared,
      bossChallenged: state.bossChallenged,
      bossCleared: resultType === 'Boss Cleared',
      returnGateUsed: resultType === 'Early Return' || resultType === 'Boss Avoided' || resultType === 'Boss Cleared',
      contractsAcquired: Array.from(new Set([...current.contractsAcquired, ...state.contracts.map((contract) => contract.id)])),
      finalResources: {
        fuel: state.fuel,
        armor: state.armor,
        signal: state.signal,
        mainAmmo: state.mainAmmo,
        seAmmo: state.seAmmo,
      },
      moeComment: undefined,
      gameOverReason,
    };
    const finalized: RunRecord = {
      ...finalizedBase,
      moeComment: buildMoeRunComment(finalizedBase),
    };
    recordRunResult(finalized);
    if (resultType === 'Boss Cleared') {
      unlockMoeMemory({
        id: `boss-clear-${state.stage}`,
        title: `Stage ${state.stage} Cleared`,
        text: 'Toll Gate Saint route stabilized. M.O.E. memory trace deepened.',
        source: 'boss',
      });
      unlockMoeMemory({
        id: 'memory_previous_driver',
        title: 'Previous Driver',
        text: 'M.O.E., if you hear this, do not trust the toll gate.',
        source: 'boss',
      });
    }
    activeRunRef.current = null;
    refreshSaveSnapshot();
    autoSaveNow('run_end');
  };

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  useEffect(() => {
    savePersistentProgression(state);
    refreshSaveSnapshot();
  }, [persistentProgressionHash]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      autoSaveNow('interval');
    }, 20000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    autoSaveNow(`phase:${state.gamePhase}`);
  }, [state.gamePhase]);

  return {
    saveRefresh,
    saveSnapshot,
    autoSaveSnapshot,
    saveMessage,
    setSaveMessage,
    debugSaveHeaders,
    setDebugSaveHeaders,
    refreshSaveSnapshot,
    refreshDebugHeaders,
    buildRuntimeSnapshot,
    autoSaveNow,
    beginRunRecord,
    finalizeRunRecord,
    phaseRef,
    bossChallengedRef,
    runIndexRef,
    processedLogCountRef,
    loadoutHashRef,
    activeRunRef,
    lastAutoSaveAtRef,
    latestStateRef,
  };
};
