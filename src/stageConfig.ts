export type StageNodeType =
  | 'encounter'
  | 'route_choice'
  | 'salvage'
  | 'signal'
  | 'boss_preview'
  | 'boss'
  | 'return_gate'
  | 'result';

export type StageEncounterKind = 'enc1' | 'enc2' | 'boss';

export type StageRouteNode = {
  id: string;
  type: StageNodeType;
  label: string;
  encounterKind?: StageEncounterKind;
  eventPool?: string;
  next?: string;
  choices?: Record<string, string>;
};

export type StageDefinition = {
  id: string;
  stage: number;
  title: string;
  entryNode: string;
  nodes: Record<string, StageRouteNode>;
};

export type StageConfig = {
  version: string;
  defaultStageId: string;
  stages: Record<string, StageDefinition>;
};

export const defaultStageConfig: StageConfig = {
  version: 'builtin-stages-v1',
  defaultStageId: 'stage_1',
  stages: {
    stage_1: {
      id: 'stage_1',
      stage: 1,
      title: 'Shallow Night Loop',
      entryNode: 'entry',
      nodes: {
        entry: { id: 'entry', type: 'encounter', encounterKind: 'enc1', label: 'Entry Contact', next: 'post_encounter_1' },
        post_encounter_1: {
          id: 'post_encounter_1',
          type: 'route_choice',
          label: 'Route Split',
          eventPool: 'route.stage_1',
          choices: {
            salvage: 'salvage_lane',
            signal: 'signal_tunnel',
            push_forward: 'forward_contact',
            return_gate: 'early_return',
          },
        },
        salvage_lane: { id: 'salvage_lane', type: 'salvage', label: 'Salvage Lane', eventPool: 'salvage.stage_1', next: 'encounter_2' },
        signal_tunnel: { id: 'signal_tunnel', type: 'signal', label: 'Signal Tunnel', eventPool: 'anomaly.stage_1', next: 'encounter_2' },
        forward_contact: { id: 'forward_contact', type: 'encounter', encounterKind: 'enc2', label: 'Forward Contact', next: 'boss_preview' },
        encounter_2: { id: 'encounter_2', type: 'encounter', encounterKind: 'enc2', label: 'Second Contact', next: 'boss_preview' },
        early_return: { id: 'early_return', type: 'return_gate', label: 'Early Return Gate', next: 'result' },
        boss_preview: {
          id: 'boss_preview',
          type: 'boss_preview',
          label: 'Deep Signal Preview',
          choices: {
            challenge: 'boss_contact',
            emergency_salvage: 'boss_salvage',
            return_gate: 'boss_return',
          },
        },
        boss_salvage: { id: 'boss_salvage', type: 'salvage', label: 'Emergency Salvage', eventPool: 'salvage.boss_prep', next: 'boss_contact' },
        boss_return: { id: 'boss_return', type: 'return_gate', label: 'Boss Return Gate', next: 'result' },
        boss_contact: { id: 'boss_contact', type: 'boss', encounterKind: 'boss', label: 'Toll Gate Saint', next: 'result' },
        result: { id: 'result', type: 'result', label: 'Surface Result' },
      },
    },
  },
};

let runtimeStageConfig: StageConfig = defaultStageConfig;
let runtimeStageConfigLoaded = false;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asString = (value: unknown, fallback: string) => (typeof value === 'string' && value.trim() ? value.trim() : fallback);

const asNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const parseScalar = (raw: string): unknown => {
  const value = raw.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return null;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1);
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
};

const parseYamlLikeObject = (text: string): Record<string, unknown> => {
  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; node: Record<string, unknown> | unknown[] }> = [{ indent: -1, node: root }];
  const lines = text.replace(/\r\n/g, '\n').split('\n');

  const nextContentLine = (start: number) => {
    for (let i = start + 1; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line.trim() || line.trimStart().startsWith('#')) continue;
      return {
        indent: line.match(/^\s*/)?.[0].length ?? 0,
        trimmed: line.trim(),
      };
    }
    return undefined;
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const sourceLine = lines[lineIndex];
    if (!sourceLine.trim() || sourceLine.trimStart().startsWith('#')) continue;
    const indent = sourceLine.match(/^\s*/)?.[0].length ?? 0;
    const trimmed = sourceLine.trim();

    if (trimmed.startsWith('- ')) {
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
      const parent = stack[stack.length - 1].node;
      if (Array.isArray(parent)) parent.push(parseScalar(trimmed.slice(2)));
      continue;
    }

    const idx = trimmed.indexOf(':');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const rest = trimmed.slice(idx + 1).trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].node;
    if (Array.isArray(parent)) continue;

    if (!rest) {
      const nextLine = nextContentLine(lineIndex);
      const next: Record<string, unknown> | unknown[] =
        nextLine && nextLine.indent > indent && nextLine.trimmed.startsWith('- ') ? [] : {};
      parent[key] = next;
      stack.push({ indent, node: next });
      continue;
    }

    parent[key] = parseScalar(rest);
  }

  return root;
};

const parseCsvPaths = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  if (typeof value !== 'string') return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
};

const parseChoices = (value: unknown): Record<string, string> | undefined => {
  if (typeof value !== 'string') {
    const raw = asRecord(value);
    const out: Record<string, string> = {};
    for (const [key, target] of Object.entries(raw)) {
      if (typeof target === 'string' && target.trim()) out[key] = target.trim();
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }

  const out: Record<string, string> = {};
  for (const pair of value.split(',')) {
    const [key, target] = pair.split(':').map((part) => part.trim());
    if (key && target) out[key] = target;
  }
  return Object.keys(out).length > 0 ? out : undefined;
};

const normalizeNodeType = (value: unknown): StageNodeType | undefined => {
  if (
    value === 'encounter'
    || value === 'route_choice'
    || value === 'salvage'
    || value === 'signal'
    || value === 'boss_preview'
    || value === 'boss'
    || value === 'return_gate'
    || value === 'result'
  ) return value;
  return undefined;
};

const normalizeEncounterKind = (value: unknown): StageEncounterKind | undefined => {
  if (value === 'enc1' || value === 'enc2' || value === 'boss') return value;
  return undefined;
};

const toStageConfig = (raw: Record<string, unknown>): StageConfig => {
  const stagesRaw = asRecord(raw.stages);
  const stages: Record<string, StageDefinition> = {};

  for (const [stageId, stageValue] of Object.entries(stagesRaw)) {
    const stageRaw = asRecord(stageValue);
    const nodesRaw = asRecord(stageRaw.nodes);
    const nodes: Record<string, StageRouteNode> = {};
    for (const [nodeId, nodeValue] of Object.entries(nodesRaw)) {
      const nodeRaw = asRecord(nodeValue);
      const type = normalizeNodeType(nodeRaw.type);
      if (!type) continue;
      nodes[nodeId] = {
        id: nodeId,
        type,
        label: asString(nodeRaw.label, nodeId),
        encounterKind: normalizeEncounterKind(nodeRaw.encounterKind),
        eventPool: typeof nodeRaw.eventPool === 'string' && nodeRaw.eventPool.trim() ? nodeRaw.eventPool.trim() : undefined,
        next: typeof nodeRaw.next === 'string' && nodeRaw.next.trim() ? nodeRaw.next.trim() : undefined,
        choices: parseChoices(nodeRaw.choices),
      };
    }

    const fallbackStage = defaultStageConfig.stages[stageId] ?? defaultStageConfig.stages.stage_1;
    const entryNode = asString(stageRaw.entryNode, fallbackStage.entryNode);
    stages[stageId] = {
      id: asString(stageRaw.id, stageId),
      stage: Math.max(1, Math.floor(asNumber(stageRaw.stage, fallbackStage.stage))),
      title: asString(stageRaw.title, fallbackStage.title),
      entryNode,
      nodes: Object.keys(nodes).length > 0 ? nodes : fallbackStage.nodes,
    };
  }

  return {
    version: asString(raw.version, defaultStageConfig.version),
    defaultStageId: asString(raw.defaultStageId, defaultStageConfig.defaultStageId),
    stages: Object.keys(stages).length > 0 ? stages : defaultStageConfig.stages,
  };
};

const parseConfigRecordText = (text: string): Record<string, unknown> => {
  const trimmed = text.trim();
  if (!trimmed) return {};
  try {
    return asRecord(JSON.parse(trimmed));
  } catch {
    return parseYamlLikeObject(trimmed);
  }
};

const mergeRecords = (base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> => {
  const next: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const current = next[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      current &&
      typeof current === 'object' &&
      !Array.isArray(current)
    ) {
      next[key] = mergeRecords(asRecord(current), asRecord(value));
    } else {
      next[key] = value;
    }
  }
  return next;
};

const resolveIncludePath = (indexPath: string, includePath: string): string => {
  const raw = includePath.trim();
  if (!raw) return '';
  if (raw.startsWith('/')) return raw;
  const normalizedIndex = indexPath.startsWith('/') ? indexPath : `/${indexPath}`;
  const slash = normalizedIndex.lastIndexOf('/');
  const dir = slash >= 0 ? normalizedIndex.slice(0, slash + 1) : '/';
  return `${dir}${raw}`.replace(/\/{2,}/g, '/');
};

export const getStageConfig = () => runtimeStageConfig;

export const loadStageConfig = async (): Promise<StageConfig> => {
  const indexPaths = ['/stages/index.yaml', '/stages/index.yml', '/stages/index.json'];
  for (const indexPath of indexPaths) {
    try {
      const indexRes = await fetch(indexPath, { cache: 'no-cache' });
      if (!indexRes.ok) continue;
      const indexRaw = parseConfigRecordText(await indexRes.text());
      const includePaths = parseCsvPaths(indexRaw.includes);

      let merged = mergeRecords({}, indexRaw);
      delete merged.includes;

      for (const includePath of includePaths) {
        const resolved = resolveIncludePath(indexPath, includePath);
        if (!resolved) continue;
        try {
          const includeRes = await fetch(resolved, { cache: 'no-cache' });
          if (!includeRes.ok) continue;
          merged = mergeRecords(merged, parseConfigRecordText(await includeRes.text()));
        } catch {
          continue;
        }
      }

      runtimeStageConfig = toStageConfig(merged);
      runtimeStageConfigLoaded = true;
      return runtimeStageConfig;
    } catch {
      continue;
    }
  }

  runtimeStageConfig = defaultStageConfig;
  runtimeStageConfigLoaded = false;
  return runtimeStageConfig;
};

export const isStageConfigRuntimeLoaded = () => runtimeStageConfigLoaded;
