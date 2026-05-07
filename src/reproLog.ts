import { limitStateLogs, limitTail, MAX_REPRO_ACTIONS, MAX_REPRO_SESSIONS } from './runtimeLimits';
import type { Action, State } from './game/types';

export const REPRO_LOG_STORAGE_KEY = 'devil-drive-midnight.repro.v1';

type ReproSnapshot = {
  gamePhase: State['gamePhase'];
  stage: number;
  stageCount: number;
  encounterIndex: number;
  turn: number;
  fuel: number;
  armor: number;
  signal: number;
  mainAmmo: number;
  seAmmo: number;
  selectedEnemyId: string;
  selectedCommand: State['encounter']['selectedCommand'];
  bossChallenged: boolean;
  resultType?: State['resultType'];
  contracts: string[];
  enemies: Array<{
    id: string;
    profile: string;
    hp: number;
    maxHp: number;
    intent: string;
    trust: number;
    interest: number;
    pressure: number;
    intelProgress: number;
    revealed: boolean;
    affinityRevealed: boolean;
    contractWindow: boolean;
    exit?: string;
  }>;
};

export type ReproActionLog = {
  at: number;
  index: number;
  actionType: Action['type'];
  action: Record<string, unknown>;
  randomTape: number[];
  pre: ReproSnapshot;
};

export type ReproSession = {
  id: string;
  seed: number;
  startedAt: number;
  stageAtStart: number;
  phaseAtStart: State['gamePhase'];
  baseState: State;
  actions: ReproActionLog[];
};

type ReproStore = {
  version: 1;
  sessions: ReproSession[];
};

const createSeed = () => {
  const ts = Date.now() % 1_000_000_000;
  const salt = Math.floor(Math.random() * 1_000_000);
  return ts * 1_000_000 + salt;
};

const createEmptyStore = (): ReproStore => ({
  version: 1,
  sessions: [],
});

const safeCloneState = (state: State): State => {
  const copied = JSON.parse(JSON.stringify(state)) as State;
  copied.logs = limitStateLogs(copied.logs ?? []);
  return copied;
};

const safeReadStore = (): ReproStore => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return createEmptyStore();
    const raw = window.localStorage.getItem(REPRO_LOG_STORAGE_KEY);
    if (!raw) return createEmptyStore();
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return createEmptyStore();
    const rec = parsed as Record<string, unknown>;
    if (rec.version !== 1) return createEmptyStore();
    const sessionsRaw = Array.isArray(rec.sessions) ? rec.sessions : [];
    const sessions = sessionsRaw.filter((item): item is ReproSession => {
      if (!item || typeof item !== 'object') return false;
      const value = item as Record<string, unknown>;
      return typeof value.id === 'string' && typeof value.seed === 'number' && Array.isArray(value.actions);
    });
    return { version: 1, sessions: limitTail(sessions, MAX_REPRO_SESSIONS) };
  } catch {
    return createEmptyStore();
  }
};

const safeWriteStore = (store: ReproStore) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(REPRO_LOG_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage errors
  }
};

const startsNewRun = (action: Action) =>
  action.type === 'START_ENGINE'
  || action.type === 'GARAGE_ENTER_RUN'
  || action.type === 'START_NEXT_RUN'
  || action.type === 'RETRY';

const sanitizeAction = (action: Action): Record<string, unknown> => {
  if (action.type === 'DEBUG_RESTORE') return { type: action.type };
  return action as unknown as Record<string, unknown>;
};

const compactSnapshot = (state: State): ReproSnapshot => ({
  gamePhase: state.gamePhase,
  stage: state.stage,
  stageCount: state.stageCount,
  encounterIndex: state.encounterIndex,
  turn: state.encounter.turn,
  fuel: state.fuel,
  armor: state.armor,
  signal: state.signal,
  mainAmmo: state.mainAmmo,
  seAmmo: state.seAmmo,
  selectedEnemyId: state.encounter.selectedEnemyId,
  selectedCommand: state.encounter.selectedCommand,
  bossChallenged: state.bossChallenged,
  resultType: state.resultType,
  contracts: state.contracts.map((contract) => contract.id),
  enemies: state.encounter.enemies.map((enemy) => ({
    id: enemy.id,
    profile: enemy.profile,
    hp: enemy.hp,
    maxHp: enemy.maxHp,
    intent: enemy.intent,
    trust: enemy.trust,
    interest: enemy.interest,
    pressure: enemy.pressure,
    intelProgress: enemy.intelProgress,
    revealed: enemy.revealed,
    affinityRevealed: !!enemy.affinityRevealed,
    contractWindow: enemy.contractWindow,
    exit: enemy.exit,
  })),
});

export const getReproSessions = (): ReproSession[] => safeReadStore().sessions;

export const clearReproSessions = () => {
  safeWriteStore(createEmptyStore());
};

export const exportReproLogJson = () => JSON.stringify(safeReadStore(), null, 2);

const ensureSession = (store: ReproStore, prevState: State, action: Action): ReproSession => {
  const sessions = store.sessions;
  const latest = sessions[sessions.length - 1];
  if (!latest || startsNewRun(action)) {
    const seed = createSeed();
    const session: ReproSession = {
      id: `seed-${seed}`,
      seed,
      startedAt: Date.now(),
      stageAtStart: prevState.stage,
      phaseAtStart: prevState.gamePhase,
      baseState: safeCloneState(prevState),
      actions: [],
    };
    sessions.push(session);
    store.sessions = limitTail(sessions, MAX_REPRO_SESSIONS);
    return store.sessions[store.sessions.length - 1];
  }
  return latest;
};

export const dispatchWithReproLog = (
  prevState: State,
  action: Action,
  dispatchCore: () => void,
) => {
  const randomTape: number[] = [];
  const originalRandom = Math.random;
  Math.random = () => {
    const next = originalRandom();
    randomTape.push(next);
    return next;
  };
  try {
    dispatchCore();
  } finally {
    Math.random = originalRandom;
  }

  const store = safeReadStore();
  const session = ensureSession(store, prevState, action);
  const index = session.actions.length + 1;
  session.actions.push({
    at: Date.now(),
    index,
    actionType: action.type,
    action: sanitizeAction(action),
    randomTape,
    pre: compactSnapshot(prevState),
  });
  session.actions = limitTail(session.actions, MAX_REPRO_ACTIONS);
  safeWriteStore(store);
};
