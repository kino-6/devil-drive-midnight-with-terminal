import { builtInScenarioPack } from './builtins';
import {
  isScenarioPack,
  normalizeScenarioPack,
  type EncounterScenario,
  type RouteEventScenario,
  type ScenarioLine,
  type ScenarioPack,
} from './scenarioTypes';

const DEFAULT_SCENARIO_PATH = '/scenarios/night-loop-demo.scenario.json';
const SCENARIO_INDEX_PATH = '/scenarios/index.json';

let activeScenarioPack: ScenarioPack = builtInScenarioPack;

type ScenarioIndexPack = {
  id: string;
  title?: string;
  path: string;
  enabled?: boolean;
};

type ScenarioIndex = {
  version: 1;
  default?: string;
  packs?: ScenarioIndexPack[];
};

const pickRandom = <T,>(list: T[]): T | undefined => {
  if (list.length === 0) return undefined;
  return list[Math.floor(Math.random() * list.length)];
};

const compactText = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const getActiveScenarioPack = (): ScenarioPack => activeScenarioPack;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const parseScenarioIndex = (value: unknown): ScenarioIndex | undefined => {
  const raw = asRecord(value);
  if (raw.version !== 1) return undefined;
  const packsRaw = Array.isArray(raw.packs) ? raw.packs : [];
  const packs = packsRaw
    .map((entry): ScenarioIndexPack | undefined => {
      const e = asRecord(entry);
      if (typeof e.id !== 'string' || typeof e.path !== 'string') return undefined;
      return {
        id: e.id,
        path: e.path,
        title: typeof e.title === 'string' ? e.title : undefined,
        enabled: typeof e.enabled === 'boolean' ? e.enabled : true,
      };
    })
    .filter((entry): entry is ScenarioIndexPack => !!entry);
  return {
    version: 1,
    default: typeof raw.default === 'string' ? raw.default : undefined,
    packs: packs.length > 0 ? packs : undefined,
  };
};

const resolveScenarioPathFromIndex = async (): Promise<string> => {
  try {
    const response = await fetch(SCENARIO_INDEX_PATH, { cache: 'no-store' });
    if (!response.ok) return DEFAULT_SCENARIO_PATH;
    const raw = await response.json() as unknown;
    const index = parseScenarioIndex(raw);
    if (!index) {
      console.warn('[scenario] invalid index.json. Using default scenario path.');
      return DEFAULT_SCENARIO_PATH;
    }
    if (index.default) return `/scenarios/${index.default.replace(/^\/+/, '')}`;
    const enabledPack = index.packs?.find((entry) => entry.enabled !== false);
    if (enabledPack) return `/scenarios/${enabledPack.path.replace(/^\/+/, '')}`;
    return DEFAULT_SCENARIO_PATH;
  } catch {
    return DEFAULT_SCENARIO_PATH;
  }
};

export const loadScenarioPack = async (path?: string): Promise<ScenarioPack> => {
  const resolvedPath = path ?? await resolveScenarioPathFromIndex();
  try {
    const response = await fetch(resolvedPath, { cache: 'no-store' });
    if (!response.ok) {
      console.warn(`[scenario] missing scenario file (${response.status}): ${resolvedPath}. Using built-in fallback.`);
      activeScenarioPack = builtInScenarioPack;
      return activeScenarioPack;
    }
    const raw = await response.json() as unknown;
    if (!isScenarioPack(raw)) {
      console.warn('[scenario] invalid scenario shape. Using built-in fallback.');
      activeScenarioPack = builtInScenarioPack;
      return activeScenarioPack;
    }
    const normalized = normalizeScenarioPack(raw);
    if (!normalized) {
      console.warn('[scenario] could not normalize scenario. Using built-in fallback.');
      activeScenarioPack = builtInScenarioPack;
      return activeScenarioPack;
    }
    activeScenarioPack = normalized;
    return activeScenarioPack;
  } catch (error) {
    console.warn('[scenario] failed to load scenario pack. Using built-in fallback.', error);
    activeScenarioPack = builtInScenarioPack;
    return activeScenarioPack;
  }
};

export const getScenarioLine = (
  lines?: string[] | ScenarioLine[],
  fallback?: string,
): string | undefined => {
  if (!lines || lines.length === 0) return fallback;
  if (typeof lines[0] === 'string') {
    const picked = pickRandom(lines as string[]);
    return picked ? compactText(picked) ?? fallback : fallback;
  }
  const picked = pickRandom(lines as ScenarioLine[]);
  return picked ? compactText(picked.text) ?? fallback : fallback;
};

export const getEncounterScenario = (id: string): EncounterScenario | undefined =>
  getActiveScenarioPack().encounters?.find((entry) => entry.id === id);

export const getMoeLine = (key: string, fallback?: string): string => {
  const lines = getActiveScenarioPack().moeLines?.[key];
  return getScenarioLine(lines, fallback) ?? fallback ?? '';
};

export const getRouteEventScenario = (id: string): RouteEventScenario | undefined =>
  getActiveScenarioPack().routeEvents?.find((entry) => entry.id === id);
