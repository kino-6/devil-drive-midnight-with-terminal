import type { ChangeEvent, Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react';
import {
  clearAutoSaveSnapshot,
  clearDebugSaves,
  clearSaveData,
  exportAutoSaveJson,
  exportCorruptSaveBackupJson,
  exportDebugSavesJson,
  exportSaveJson,
  importSaveJson,
  loadAutoSaveSnapshot,
  loadDebugSnapshotById,
  loadLatestDebugSnapshot,
  saveDebugSnapshot,
  type RunRecord,
} from '../../saveSystem';
import { clearTelemetryEvents, exportTelemetryJson } from '../../telemetry';
import type { Action, State } from '../../game/types';
import type { AppRuntimeSaveSnapshot } from './useSaveRuntime';

type UseSaveToolsParams = {
  state: State;
  dispatch: Dispatch<Action>;
  playtestMarkdown: string;
  saveImportInputRef: RefObject<HTMLInputElement | null>;
  setTelemetryRefresh: Dispatch<SetStateAction<number>>;
  setSaveMessage: Dispatch<SetStateAction<string>>;
  refreshSaveSnapshot: () => void;
  refreshDebugHeaders: () => void;
  buildRuntimeSnapshot: () => AppRuntimeSaveSnapshot;
  sanitizeRestoredState: (snapshot: State, fallback: State) => State;
  runIndexRef: MutableRefObject<number>;
  activeRunRef: MutableRefObject<RunRecord | null>;
  phaseRef: MutableRefObject<State['gamePhase']>;
  bossChallengedRef: MutableRefObject<boolean>;
  processedLogCountRef: MutableRefObject<number>;
  loadoutHashRef: MutableRefObject<string>;
};

const downloadJson = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const useSaveTools = ({
  state,
  dispatch,
  playtestMarkdown,
  saveImportInputRef,
  setTelemetryRefresh,
  setSaveMessage,
  refreshSaveSnapshot,
  refreshDebugHeaders,
  buildRuntimeSnapshot,
  sanitizeRestoredState,
  runIndexRef,
  activeRunRef,
  phaseRef,
  bossChallengedRef,
  processedLogCountRef,
  loadoutHashRef,
}: UseSaveToolsParams) => {
  const saveDebugNow = () => {
    const label = `${state.gamePhase} / STG${state.stage}-ENC${state.encounterIndex + 1}`;
    const saved = saveDebugSnapshot(buildRuntimeSnapshot(), label);
    if (saved) {
      setSaveMessage(`Debug saved: ${new Date(saved.createdAt).toLocaleTimeString()}`);
      refreshDebugHeaders();
      refreshSaveSnapshot();
    }
  };

  const restoreSnapshotCommon = (snapshot: AppRuntimeSaveSnapshot, message: string) => {
    const safeState = sanitizeRestoredState(snapshot.state, state);
    dispatch({ type: 'DEBUG_RESTORE', snapshot: safeState });
    runIndexRef.current = typeof snapshot.runIndex === 'number' ? snapshot.runIndex : runIndexRef.current;
    activeRunRef.current = snapshot.activeRun ?? null;
    phaseRef.current = safeState.gamePhase;
    bossChallengedRef.current = safeState.bossChallenged;
    processedLogCountRef.current = safeState.logs.length;
    loadoutHashRef.current = JSON.stringify(safeState.selectedLoadout);
    setSaveMessage(message);
    refreshSaveSnapshot();
  };

  const restoreAutoSaveNow = () => {
    const snap = loadAutoSaveSnapshot<AppRuntimeSaveSnapshot>();
    if (!snap?.snapshot?.state) {
      setSaveMessage('AutoSave not found.');
      return;
    }
    restoreSnapshotCommon(snap.snapshot, `Restored AutoSave (${new Date(snap.savedAt).toLocaleTimeString()})`);
  };

  const restoreLatestDebugNow = () => {
    const latest = loadLatestDebugSnapshot<AppRuntimeSaveSnapshot>();
    if (!latest?.snapshot?.state) {
      setSaveMessage('Debug save not found.');
      return;
    }
    restoreSnapshotCommon(latest.snapshot, `Restored Debug: ${latest.label ?? latest.id}`);
  };

  const restoreDebugById = (id: string) => {
    const entry = loadDebugSnapshotById<AppRuntimeSaveSnapshot>(id);
    if (!entry?.snapshot?.state) {
      setSaveMessage('Selected debug save is invalid.');
      return;
    }
    restoreSnapshotCommon(entry.snapshot, `Restored Debug Slot: ${entry.label ?? entry.id}`);
  };

  const clearAutoSaveNow = () => {
    clearAutoSaveSnapshot();
    setSaveMessage('AutoSave cleared.');
    refreshSaveSnapshot();
  };

  const clearDebugSavesNow = () => {
    clearDebugSaves();
    refreshDebugHeaders();
    setSaveMessage('Debug saves cleared.');
  };

  const downloadSaveJson = () => {
    downloadJson('devil-drive-midnight-save.json', exportSaveJson());
  };

  const resetMainSaveNow = () => {
    const agreed = window.confirm('Reset local main save data? This cannot be undone.');
    if (!agreed) return;
    clearSaveData();
    setSaveMessage('Main save reset. Reloading...');
    setTimeout(() => window.location.reload(), 150);
  };

  const triggerSaveImport = () => {
    saveImportInputRef.current?.click();
  };

  const onImportSaveFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const result = importSaveJson(text);
      if (!result.ok) {
        setSaveMessage(`Import failed: ${result.error}`);
        return;
      }
      refreshSaveSnapshot();
      refreshDebugHeaders();
      setSaveMessage(`Save imported: ${new Date(result.data.updatedAt).toLocaleString()}`);
    } catch {
      setSaveMessage('Import failed: unable to read file.');
    } finally {
      event.currentTarget.value = '';
    }
  };

  const downloadDebugSavesJson = () => {
    downloadJson(
      `devil-drive-debug-saves-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`,
      exportDebugSavesJson(),
    );
  };

  const downloadAutoSaveJson = () => {
    downloadJson(
      `devil-drive-autosave-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`,
      exportAutoSaveJson(),
    );
  };

  const downloadCorruptBackupJson = () => {
    downloadJson(
      `devil-drive-save-corrupt-backup-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`,
      exportCorruptSaveBackupJson(),
    );
  };

  const copyMarkdownReport = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(playtestMarkdown);
        return;
      }
    } catch {
      // fallback below
    }
    const area = document.createElement('textarea');
    area.value = playtestMarkdown;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    document.body.removeChild(area);
  };

  const downloadTelemetryJson = () => {
    downloadJson(
      `devil-drive-telemetry-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`,
      exportTelemetryJson(),
    );
  };

  const resetTelemetry = () => {
    clearTelemetryEvents();
    setTelemetryRefresh((value) => value + 1);
  };

  return {
    saveDebugNow,
    restoreAutoSaveNow,
    restoreLatestDebugNow,
    restoreDebugById,
    clearAutoSaveNow,
    clearDebugSavesNow,
    downloadSaveJson,
    resetMainSaveNow,
    triggerSaveImport,
    onImportSaveFile,
    downloadDebugSavesJson,
    downloadAutoSaveJson,
    downloadCorruptBackupJson,
    copyMarkdownReport,
    downloadTelemetryJson,
    resetTelemetry,
  };
};
