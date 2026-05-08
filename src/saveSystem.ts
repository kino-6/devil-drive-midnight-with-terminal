import { MAX_DEBUG_SAVE_ENTRIES, limitStateLogs } from './runtimeLimits';
import { getAllUnlocks, getInitialUnlocks, mergeUnlocks, normalizeUnlockState } from './game/progression';
import type { UnlockState } from './game/types';

export type SaveVersion = 1;

export type RunRecord = {
  id: string;
  startedAt: number;
  endedAt: number;
  resultType?: string;
  encountersCleared: number;
  bossChallenged: boolean;
  bossCleared: boolean;
  contractsAcquired: string[];
  defeatedEnemies: string[];
  analyzedEnemies: string[];
  routeChoices: string[];
  returnGateUsed: boolean;
  gameOverReason?: string;
  finalResources: {
    fuel: number;
    armor: number;
    signal: number;
    mainAmmo: number;
    seAmmo: number;
  };
  moeComment?: string;
};

export type DemonArchiveEntry = {
  id: string;
  name: string;
  profile?: string;
  firstSeenAt: number;
  seenCount: number;
  defeatedCount: number;
  contractedCount: number;
  analyzed: boolean;
  affinityRevealed: boolean;
  intelProgress?: number;
  affinities?: Record<string, string>;
  lastSeenAt: number;
};

export type RouteLogEntry = {
  id: string;
  name: string;
  firstSeenAt: number;
  seenCount: number;
  lastChosenAt: number;
  notes?: string[];
};

export type MoeMemoryEntry = {
  id: string;
  title: string;
  text: string;
  unlockedAt: number;
  source: 'story' | 'run' | 'contract' | 'route' | 'boss';
};

export type SaveData = {
  version: SaveVersion;
  createdAt: number;
  updatedAt: number;
  totalRuns: number;
  bestResult?: string;
  runHistory: RunRecord[];
  demonArchive: Record<string, DemonArchiveEntry>;
  routeLog: Record<string, RouteLogEntry>;
  moeMemory: Record<string, MoeMemoryEntry>;
  unlocks: UnlockState;
  settings: {
    audioMuted?: boolean;
    reducedMotion?: boolean;
  };
};

export const SAVE_STORAGE_KEY = 'devil-drive-midnight.save.v1';
export const AUTOSAVE_STORAGE_KEY = 'devil-drive-midnight.autosave.v1';
export const DEBUG_SAVE_STORAGE_KEY = 'devil-drive-midnight.debugsave.v1';
export const SAVE_CORRUPT_BACKUP_KEY = 'devil-drive-midnight.save.corrupt.backup';
const LEGACY_SAVE_KEYS = ['devil-drive-midnight.save', 'devil-drive.save.v0'];

export type AutoSaveSnapshot<T = unknown> = {
  version: SaveVersion;
  savedAt: number;
  reason: string;
  snapshot: T;
};

export type DebugSaveEntry<T = unknown> = {
  id: string;
  label?: string;
  createdAt: number;
  snapshot: T;
};

const now = () => Date.now();

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const asString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

const asBool = (value: unknown, fallback = false) =>
  typeof value === 'boolean' ? value : fallback;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export const createInitialSaveData = (): SaveData => {
  const ts = now();
  return {
    version: 1,
    createdAt: ts,
    updatedAt: ts,
    totalRuns: 0,
    bestResult: undefined,
    runHistory: [],
    demonArchive: {},
    routeLog: {},
    moeMemory: {},
    unlocks: getInitialUnlocks(),
    settings: {},
  };
};

const normalizeRunRecord = (raw: unknown): RunRecord | null => {
  const item = asObject(raw);
  const finalResources = asObject(item.finalResources);
  const id = asString(item.id);
  if (!id) return null;
  return {
    id,
    startedAt: asNumber(item.startedAt, 0),
    endedAt: asNumber(item.endedAt, 0),
    resultType: asString(item.resultType, undefined as unknown as string) || undefined,
    encountersCleared: asNumber(item.encountersCleared, 0),
    bossChallenged: asBool(item.bossChallenged),
    bossCleared: asBool(item.bossCleared),
    contractsAcquired: asStringArray(item.contractsAcquired),
    defeatedEnemies: asStringArray(item.defeatedEnemies),
    analyzedEnemies: asStringArray(item.analyzedEnemies),
    routeChoices: asStringArray(item.routeChoices),
    returnGateUsed: asBool(item.returnGateUsed),
    gameOverReason: asString(item.gameOverReason, undefined as unknown as string) || undefined,
    finalResources: {
      fuel: asNumber(finalResources.fuel, 0),
      armor: asNumber(finalResources.armor, 0),
      signal: asNumber(finalResources.signal, 0),
      mainAmmo: asNumber(finalResources.mainAmmo, 0),
      seAmmo: asNumber(finalResources.seAmmo, 0),
    },
    moeComment: asString(item.moeComment, undefined as unknown as string) || undefined,
  };
};

const normalizeDemonArchive = (raw: unknown): Record<string, DemonArchiveEntry> => {
  const source = asObject(raw);
  const out: Record<string, DemonArchiveEntry> = {};
  for (const [key, value] of Object.entries(source)) {
    const item = asObject(value);
    const id = asString(item.id, key);
    out[id] = {
      id,
      name: asString(item.name, id),
      profile: asString(item.profile, undefined as unknown as string) || undefined,
      firstSeenAt: asNumber(item.firstSeenAt, now()),
      seenCount: asNumber(item.seenCount, 0),
      defeatedCount: asNumber(item.defeatedCount, 0),
      contractedCount: asNumber(item.contractedCount, 0),
      analyzed: asBool(item.analyzed),
      affinityRevealed: asBool(item.affinityRevealed),
      intelProgress: (() => {
        const value = asNumber(item.intelProgress, 0);
        return Number.isFinite(value) ? Math.max(0, value) : undefined;
      })(),
      affinities: (() => {
        const aff = asObject(item.affinities);
        const normalized: Record<string, string> = {};
        for (const [k, v] of Object.entries(aff)) {
          if (typeof v === 'string') normalized[k] = v;
        }
        return Object.keys(normalized).length > 0 ? normalized : undefined;
      })(),
      lastSeenAt: asNumber(item.lastSeenAt, now()),
    };
  }
  return out;
};

const normalizeRouteLog = (raw: unknown): Record<string, RouteLogEntry> => {
  const source = asObject(raw);
  const out: Record<string, RouteLogEntry> = {};
  for (const [key, value] of Object.entries(source)) {
    const item = asObject(value);
    const id = asString(item.id, key);
    out[id] = {
      id,
      name: asString(item.name, id),
      firstSeenAt: asNumber(item.firstSeenAt, now()),
      seenCount: asNumber(item.seenCount, 0),
      lastChosenAt: asNumber(item.lastChosenAt, 0),
      notes: asStringArray(item.notes),
    };
  }
  return out;
};

const normalizeMoeMemory = (raw: unknown): Record<string, MoeMemoryEntry> => {
  const source = asObject(raw);
  const out: Record<string, MoeMemoryEntry> = {};
  for (const [key, value] of Object.entries(source)) {
    const item = asObject(value);
    const id = asString(item.id, key);
    const src = asString(item.source, 'story');
    const sourceType: MoeMemoryEntry['source'] =
      src === 'run' || src === 'contract' || src === 'route' || src === 'boss' ? src : 'story';
    out[id] = {
      id,
      title: asString(item.title, id),
      text: asString(item.text),
      unlockedAt: asNumber(item.unlockedAt, now()),
      source: sourceType,
    };
  }
  return out;
};

export const sanitizeSaveData = (raw: unknown): SaveData => {
  const fallback = createInitialSaveData();
  const source = asObject(raw);
  const settingsRaw = asObject(source.settings);
  const runHistoryRaw = Array.isArray(source.runHistory) ? source.runHistory : [];
  const runHistory = runHistoryRaw.map(normalizeRunRecord).filter((value): value is RunRecord => !!value);
  const createdAt = asNumber(source.createdAt, fallback.createdAt);
  const updatedAt = asNumber(source.updatedAt, createdAt);
  const unlocks = 'unlocks' in source
    ? normalizeUnlockState(source.unlocks, fallback.unlocks)
    : getAllUnlocks();
  return {
    version: 1,
    createdAt,
    updatedAt,
    totalRuns: asNumber(source.totalRuns, runHistory.length),
    bestResult: asString(source.bestResult, undefined as unknown as string) || undefined,
    runHistory,
    demonArchive: normalizeDemonArchive(source.demonArchive),
    routeLog: normalizeRouteLog(source.routeLog),
    moeMemory: normalizeMoeMemory(source.moeMemory),
    unlocks,
    settings: {
      audioMuted: settingsRaw.audioMuted === undefined ? undefined : asBool(settingsRaw.audioMuted),
      reducedMotion: settingsRaw.reducedMotion === undefined ? undefined : asBool(settingsRaw.reducedMotion),
    },
  };
};

export const loadSaveData = (): SaveData => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return createInitialSaveData();
    const keys = [SAVE_STORAGE_KEY, ...LEGACY_SAVE_KEYS];
    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as unknown;
        const sanitized = sanitizeSaveData(parsed);
        if (key !== SAVE_STORAGE_KEY) {
          window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(sanitized));
        }
        return sanitized;
      } catch {
        try {
          window.localStorage.setItem(
            SAVE_CORRUPT_BACKUP_KEY,
            JSON.stringify({
              key,
              backedUpAt: now(),
              raw,
            }),
          );
        } catch {
          // ignore backup errors
        }
      }
    }
    return createInitialSaveData();
  } catch {
    return createInitialSaveData();
  }
};

export const saveSaveData = (data: SaveData): SaveData => {
  const safe = sanitizeSaveData(data);
  const next: SaveData = { ...safe, updatedAt: now() };
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // ignore storage errors
  }
  return next;
};

export const clearSaveData = (): SaveData => {
  const fresh = createInitialSaveData();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(SAVE_STORAGE_KEY);
      for (const key of LEGACY_SAVE_KEYS) window.localStorage.removeItem(key);
    }
  } catch {
    // ignore storage errors
  }
  return fresh;
};

export const updateSaveData = (updater: (current: SaveData) => SaveData): SaveData => {
  const current = loadSaveData();
  const updated = updater(current);
  return saveSaveData(updated);
};

export const saveUnlockState = (unlocks: UnlockState): SaveData =>
  updateSaveData((current) => ({
    ...current,
    unlocks: mergeUnlocks(current.unlocks, unlocks),
  }));

const safeJsonClone = <T>(value: T): T | null => {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return null;
  }
};

const trimSnapshotLogsInPlace = (snapshot: unknown) => {
  if (!snapshot || typeof snapshot !== 'object') return;
  const root = snapshot as Record<string, unknown>;

  if (Array.isArray(root.logs)) {
    root.logs = limitStateLogs(root.logs.filter((line): line is string => typeof line === 'string'));
  }

  const nestedState = root.state;
  if (!nestedState || typeof nestedState !== 'object') return;
  const nested = nestedState as Record<string, unknown>;
  if (Array.isArray(nested.logs)) {
    nested.logs = limitStateLogs(nested.logs.filter((line): line is string => typeof line === 'string'));
  }
};

export const saveAutoSaveSnapshot = <T>(snapshot: T, reason = 'auto'): AutoSaveSnapshot<T> | null => {
  const cloned = safeJsonClone(snapshot);
  if (!cloned) return null;
  trimSnapshotLogsInPlace(cloned);
  const payload: AutoSaveSnapshot<T> = {
    version: 1,
    savedAt: now(),
    reason,
    snapshot: cloned,
  };
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(payload));
    }
    return payload;
  } catch {
    return null;
  }
};

export const loadAutoSaveSnapshot = <T>(): AutoSaveSnapshot<T> | null => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(AUTOSAVE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    const obj = asObject(parsed);
    if (!('snapshot' in obj)) return null;
    return {
      version: 1,
      savedAt: asNumber(obj.savedAt, 0),
      reason: asString(obj.reason, 'auto'),
      snapshot: obj.snapshot as T,
    };
  } catch {
    return null;
  }
};

export const clearAutoSaveSnapshot = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
};

const loadDebugSaveStore = <T>(): DebugSaveEntry<T>[] => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(DEBUG_SAVE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => {
        const obj = asObject(value);
        const id = asString(obj.id);
        if (!id || !('snapshot' in obj)) return null;
        return {
          id,
          label: asString(obj.label, undefined as unknown as string) || undefined,
          createdAt: asNumber(obj.createdAt, 0),
          snapshot: obj.snapshot as T,
        } as DebugSaveEntry<T>;
      })
      .filter((value): value is DebugSaveEntry<T> => !!value);
  } catch {
    return [];
  }
};

const writeDebugSaveStore = <T>(entries: DebugSaveEntry<T>[]) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(DEBUG_SAVE_STORAGE_KEY, JSON.stringify(entries));
    }
  } catch {
    // ignore
  }
};

export const saveDebugSnapshot = <T>(snapshot: T, label?: string): DebugSaveEntry<T> | null => {
  const cloned = safeJsonClone(snapshot);
  if (!cloned) return null;
  trimSnapshotLogsInPlace(cloned);
  const entry: DebugSaveEntry<T> = {
    id: `dbg-${now()}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    createdAt: now(),
    snapshot: cloned,
  };
  const current = loadDebugSaveStore<T>();
  const next = [entry, ...current].slice(0, MAX_DEBUG_SAVE_ENTRIES);
  writeDebugSaveStore(next);
  return entry;
};

export const listDebugSaveHeaders = () =>
  loadDebugSaveStore<unknown>().map((entry) => ({
    id: entry.id,
    label: entry.label,
    createdAt: entry.createdAt,
  }));

export const loadDebugSnapshotById = <T>(id: string): DebugSaveEntry<T> | null => {
  const found = loadDebugSaveStore<T>().find((entry) => entry.id === id);
  return found ?? null;
};

export const loadLatestDebugSnapshot = <T>(): DebugSaveEntry<T> | null => {
  const [head] = loadDebugSaveStore<T>();
  return head ?? null;
};

export const clearDebugSaves = () => {
  writeDebugSaveStore([]);
};

export const exportDebugSavesJson = () => JSON.stringify(loadDebugSaveStore<unknown>(), null, 2);
export const exportAutoSaveJson = () => JSON.stringify(loadAutoSaveSnapshot<unknown>(), null, 2);
export const exportSaveJson = () => JSON.stringify(loadSaveData(), null, 2);
export const exportCorruptSaveBackupJson = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return 'null';
    return window.localStorage.getItem(SAVE_CORRUPT_BACKUP_KEY) ?? 'null';
  } catch {
    return 'null';
  }
};

export const importSaveJson = (rawJson: string): { ok: true; data: SaveData } | { ok: false; error: string } => {
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Invalid JSON shape. Expected object root.' };
    }
    const source = parsed as Record<string, unknown>;
    if (source.version !== undefined && source.version !== 1) {
      return { ok: false, error: `Unsupported save version: ${String(source.version)}` };
    }
    const sanitized = sanitizeSaveData(parsed);
    const saved = saveSaveData(sanitized);
    return { ok: true, data: saved };
  } catch {
    return { ok: false, error: 'Failed to parse JSON.' };
  }
};

export const recordRun = (record: RunRecord): SaveData =>
  updateSaveData((current) => {
    const history = [...current.runHistory];
    const idx = history.findIndex((item) => item.id === record.id);
    if (idx >= 0) history[idx] = record;
    else history.push(record);
    const bestResult = record.bossCleared
      ? 'Boss Cleared'
      : current.bestResult ?? record.resultType;
    return {
      ...current,
      totalRuns: Math.max(current.totalRuns, history.length),
      bestResult,
      runHistory: history,
    };
  });

export const recordRunResult = (record: RunRecord): SaveData => recordRun(record);

export const touchDemonArchive = (
  id: string,
  input: {
    name: string;
    profile?: string;
    defeatedDelta?: number;
    contractedDelta?: number;
    analyzed?: boolean;
    affinityRevealed?: boolean;
    intelProgress?: number;
    affinities?: Record<string, string>;
  },
): SaveData =>
  updateSaveData((current) => {
    const ts = now();
    const prev = current.demonArchive[id];
    const next: DemonArchiveEntry = prev
      ? {
        ...prev,
        name: input.name || prev.name,
        profile: input.profile ?? prev.profile,
        seenCount: prev.seenCount + 1,
        defeatedCount: prev.defeatedCount + (input.defeatedDelta ?? 0),
        contractedCount: prev.contractedCount + (input.contractedDelta ?? 0),
        analyzed: prev.analyzed || !!input.analyzed,
        affinityRevealed: prev.affinityRevealed || !!input.affinityRevealed,
        intelProgress: Math.max(prev.intelProgress ?? 0, input.intelProgress ?? 0),
        affinities: input.affinities
          ? { ...(prev.affinities ?? {}), ...input.affinities }
          : prev.affinities,
        lastSeenAt: ts,
      }
      : {
        id,
        name: input.name,
        profile: input.profile,
        firstSeenAt: ts,
        seenCount: 1,
        defeatedCount: input.defeatedDelta ?? 0,
        contractedCount: input.contractedDelta ?? 0,
        analyzed: !!input.analyzed,
        affinityRevealed: !!input.affinityRevealed,
        intelProgress: Math.max(0, input.intelProgress ?? 0),
        affinities: input.affinities,
        lastSeenAt: ts,
      };
    return {
      ...current,
      demonArchive: {
        ...current.demonArchive,
        [id]: next,
      },
    };
  });

export const touchRouteLog = (
  id: string,
  name: string,
  note?: string,
): SaveData =>
  updateSaveData((current) => {
    const ts = now();
    const prev = current.routeLog[id];
    const next: RouteLogEntry = prev
      ? {
        ...prev,
        seenCount: prev.seenCount + 1,
        lastChosenAt: ts,
        notes: note ? Array.from(new Set([...(prev.notes ?? []), note])) : prev.notes,
      }
      : {
        id,
        name,
        firstSeenAt: ts,
        seenCount: 1,
        lastChosenAt: ts,
        notes: note ? [note] : [],
      };
    return {
      ...current,
      routeLog: {
        ...current.routeLog,
        [id]: next,
      },
    };
  });

export const unlockMoeMemory = (entry: Omit<MoeMemoryEntry, 'unlockedAt'>): SaveData =>
  updateSaveData((current) => {
    if (current.moeMemory[entry.id]) return current;
    return {
      ...current,
      moeMemory: {
        ...current.moeMemory,
        [entry.id]: {
          ...entry,
          unlockedAt: now(),
        },
      },
    };
  });
