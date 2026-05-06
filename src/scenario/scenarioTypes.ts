export type ScenarioSpeaker =
  | 'SYSTEM'
  | 'M.O.E.'
  | 'DRIVER'
  | 'RADIO'
  | 'DEMON'
  | 'UNKNOWN';

export type ScenarioLine = {
  speaker: ScenarioSpeaker | string;
  text: string;
  tags?: string[];
};

export type StoryScene = {
  id: string;
  title?: string;
  phase?: string;
  lines: ScenarioLine[];
  next?: string;
};

export type EncounterScenario = {
  id: string;
  name: string;
  intro?: string[];
  analyze?: {
    success?: string[];
    fail?: string[];
  };
  talk?: Record<string, string[]>;
  contract?: {
    offer?: string[];
    success?: string[];
    failure?: string[];
  };
  supportDaemon?: {
    linked?: string[];
    disconnected?: string[];
  };
};

export type RouteEventScenario = {
  id: string;
  title: string;
  body: string;
  choices?: {
    id: string;
    label: string;
    text?: string;
  }[];
};

export type ScenarioPack = {
  version: 1;
  id: string;
  title: string;
  storyScenes?: StoryScene[];
  encounters?: EncounterScenario[];
  routeEvents?: RouteEventScenario[];
  moeLines?: Record<string, string[]>;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const asStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const normalized = value.map(asString).filter((entry): entry is string => !!entry);
  return normalized.length > 0 ? normalized : undefined;
};

const normalizeScenarioLine = (value: unknown): ScenarioLine | undefined => {
  const raw = asRecord(value);
  const text = asString(raw.text);
  if (!text) return undefined;
  return {
    speaker: asString(raw.speaker) ?? 'UNKNOWN',
    text,
    tags: asStringArray(raw.tags),
  };
};

const normalizeStoryScene = (value: unknown): StoryScene | undefined => {
  const raw = asRecord(value);
  const id = asString(raw.id);
  if (!id) return undefined;
  const linesRaw = Array.isArray(raw.lines) ? raw.lines.map(normalizeScenarioLine).filter((line): line is ScenarioLine => !!line) : [];
  if (linesRaw.length === 0) return undefined;
  return {
    id,
    title: asString(raw.title),
    phase: asString(raw.phase),
    lines: linesRaw,
    next: asString(raw.next),
  };
};

const normalizeEncounterScenario = (value: unknown): EncounterScenario | undefined => {
  const raw = asRecord(value);
  const id = asString(raw.id);
  const name = asString(raw.name);
  if (!id || !name) return undefined;

  const analyzeRaw = asRecord(raw.analyze);
  const talkRaw = asRecord(raw.talk);
  const contractRaw = asRecord(raw.contract);
  const supportRaw = asRecord(raw.supportDaemon);

  const talk: Record<string, string[]> = {};
  for (const [key, entry] of Object.entries(talkRaw)) {
    const lines = asStringArray(entry);
    if (lines) talk[key] = lines;
  }

  return {
    id,
    name,
    intro: asStringArray(raw.intro),
    analyze: {
      success: asStringArray(analyzeRaw.success),
      fail: asStringArray(analyzeRaw.fail),
    },
    talk: Object.keys(talk).length > 0 ? talk : undefined,
    contract: {
      offer: asStringArray(contractRaw.offer),
      success: asStringArray(contractRaw.success),
      failure: asStringArray(contractRaw.failure),
    },
    supportDaemon: {
      linked: asStringArray(supportRaw.linked),
      disconnected: asStringArray(supportRaw.disconnected),
    },
  };
};

const normalizeRouteEventScenario = (value: unknown): RouteEventScenario | undefined => {
  const raw = asRecord(value);
  const id = asString(raw.id);
  const title = asString(raw.title);
  const body = asString(raw.body);
  if (!id || !title || !body) return undefined;
  const choicesRaw = Array.isArray(raw.choices) ? raw.choices : [];
  const choices = choicesRaw.map((choice) => {
    const c = asRecord(choice);
    const cid = asString(c.id);
    const label = asString(c.label);
    if (!cid || !label) return undefined;
    const text = asString(c.text);
    return text ? { id: cid, label, text } : { id: cid, label };
  }).filter((choice): choice is { id: string; label: string; text?: string } => !!choice);

  return {
    id,
    title,
    body,
    choices: choices.length > 0 ? choices : undefined,
  };
};

export const isScenarioPack = (value: unknown): value is ScenarioPack => {
  const raw = asRecord(value);
  return raw.version === 1 && typeof raw.id === 'string' && typeof raw.title === 'string';
};

export const normalizeScenarioPack = (value: unknown): ScenarioPack | undefined => {
  const raw = asRecord(value);
  if (raw.version !== 1) return undefined;
  const id = asString(raw.id);
  const title = asString(raw.title);
  if (!id || !title) return undefined;

  const storyScenes = Array.isArray(raw.storyScenes)
    ? raw.storyScenes.map(normalizeStoryScene).filter((scene): scene is StoryScene => !!scene)
    : undefined;
  const encounters = Array.isArray(raw.encounters)
    ? raw.encounters.map(normalizeEncounterScenario).filter((entry): entry is EncounterScenario => !!entry)
    : undefined;
  const routeEvents = Array.isArray(raw.routeEvents)
    ? raw.routeEvents.map(normalizeRouteEventScenario).filter((event): event is RouteEventScenario => !!event)
    : undefined;
  const moeLinesRaw = asRecord(raw.moeLines);
  const moeLines: Record<string, string[]> = {};
  for (const [key, entry] of Object.entries(moeLinesRaw)) {
    const lines = asStringArray(entry);
    if (lines) moeLines[key] = lines;
  }

  return {
    version: 1,
    id,
    title,
    storyScenes: storyScenes && storyScenes.length > 0 ? storyScenes : undefined,
    encounters: encounters && encounters.length > 0 ? encounters : undefined,
    routeEvents: routeEvents && routeEvents.length > 0 ? routeEvents : undefined,
    moeLines: Object.keys(moeLines).length > 0 ? moeLines : undefined,
  };
};
