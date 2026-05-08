export type EventPoolCategory = 'route' | 'salvage' | 'anomaly';

export type RouteEventEntry = {
  id: string;
  category: EventPoolCategory;
  title: string;
  pool: string;
  weight: number;
  tags: string[];
  log?: string;
  moeLine?: string;
  rewardId?: string;
  routeChoice?: string;
};

export type EventConfig = {
  version: string;
  events: Record<EventPoolCategory, Record<string, RouteEventEntry>>;
};

export const defaultEventConfig: EventConfig = {
  version: 'builtin-events-v1',
  events: {
    route: {
      salvage_lane: {
        id: 'salvage_lane',
        category: 'route',
        title: 'Salvage Lane',
        pool: 'route.stage_1',
        weight: 1,
        tags: ['safe', 'reward'],
        routeChoice: 'salvage',
        log: 'ROUTE EVENT: SALVAGE LANE',
        moeLine: '補給反応あり。拾うなら今。',
      },
      signal_tunnel: {
        id: 'signal_tunnel',
        category: 'route',
        title: 'Signal Tunnel',
        pool: 'route.stage_1',
        weight: 1,
        tags: ['signal', 'analyze'],
        routeChoice: 'signal',
        log: 'ROUTE EVENT: SIGNAL TUNNEL',
        moeLine: '信号帯が開いてる。読むか、抜けるか選べる。',
      },
    },
    salvage: {
      main_ammo_cache: {
        id: 'main_ammo_cache',
        category: 'salvage',
        title: 'Main Ammo Cache',
        pool: 'salvage.stage_1',
        weight: 1,
        tags: ['ammo', 'common'],
        rewardId: 'main_ammo',
        log: 'SALVAGE EVENT: MAIN AMMO CACHE',
        moeLine: '主砲弾、まだ使える。',
      },
      armor_patch: {
        id: 'armor_patch',
        category: 'salvage',
        title: 'Armor Patch',
        pool: 'salvage.stage_1',
        weight: 1,
        tags: ['armor', 'common'],
        rewardId: 'armor_patch',
        log: 'SALVAGE EVENT: ARMOR PATCH',
        moeLine: '応急装甲材。今なら貼れる。',
      },
    },
    anomaly: {
      memory_trace: {
        id: 'memory_trace',
        category: 'anomaly',
        title: 'Memory Trace',
        pool: 'anomaly.stage_1',
        weight: 1,
        tags: ['story', 'analyze'],
        log: 'ANOMALY EVENT: MEMORY TRACE',
        moeLine: '前任者ログに似た波形。慎重に拾おう。',
      },
      open_radio: {
        id: 'open_radio',
        category: 'anomaly',
        title: 'Open Radio',
        pool: 'anomaly.stage_1',
        weight: 1,
        tags: ['talk', 'signal'],
        routeChoice: 'open_radio',
        log: 'ANOMALY EVENT: AM 666.0 OPEN',
        moeLine: 'AM帯が開いた。声を返せるかも。',
      },
    },
  },
};

let runtimeEventConfig: EventConfig = defaultEventConfig;

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

const parseCsvTags = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
  if (typeof value !== 'string') return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
};

const normalizeCategory = (value: string): EventPoolCategory | undefined => {
  if (value === 'route' || value === 'salvage' || value === 'anomaly') return value;
  return undefined;
};

const toEventConfig = (raw: Record<string, unknown>): EventConfig => {
  const eventsRaw = asRecord(raw.events);
  const events: EventConfig['events'] = { route: {}, salvage: {}, anomaly: {} };

  for (const categoryKey of ['route', 'salvage', 'anomaly'] as const) {
    const categoryRaw = asRecord(eventsRaw[categoryKey]);
    for (const [eventId, value] of Object.entries(categoryRaw)) {
      const eventRaw = asRecord(value);
      events[categoryKey][eventId] = {
        id: eventId,
        category: categoryKey,
        title: asString(eventRaw.title, eventId),
        pool: asString(eventRaw.pool, `${categoryKey}.stage_1`),
        weight: Math.max(0, asNumber(eventRaw.weight, 1)),
        tags: parseCsvTags(eventRaw.tags),
        log: typeof eventRaw.log === 'string' && eventRaw.log.trim() ? eventRaw.log.trim() : undefined,
        moeLine: typeof eventRaw.moeLine === 'string' && eventRaw.moeLine.trim() ? eventRaw.moeLine.trim() : undefined,
        rewardId: typeof eventRaw.rewardId === 'string' && eventRaw.rewardId.trim() ? eventRaw.rewardId.trim() : undefined,
        routeChoice: typeof eventRaw.routeChoice === 'string' && eventRaw.routeChoice.trim() ? eventRaw.routeChoice.trim() : undefined,
      };
    }
  }

  return {
    version: asString(raw.version, defaultEventConfig.version),
    events: {
      route: Object.keys(events.route).length > 0 ? events.route : defaultEventConfig.events.route,
      salvage: Object.keys(events.salvage).length > 0 ? events.salvage : defaultEventConfig.events.salvage,
      anomaly: Object.keys(events.anomaly).length > 0 ? events.anomaly : defaultEventConfig.events.anomaly,
    },
  };
};

export const getEventsByPool = (pool: string): RouteEventEntry[] => {
  const out: RouteEventEntry[] = [];
  for (const category of Object.keys(runtimeEventConfig.events)) {
    const normalized = normalizeCategory(category);
    if (!normalized) continue;
    for (const entry of Object.values(runtimeEventConfig.events[normalized])) {
      if (entry.pool === pool) out.push(entry);
    }
  }
  return out;
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

export const getEventConfig = () => runtimeEventConfig;

export const loadEventConfig = async (): Promise<EventConfig> => {
  const indexPaths = ['/events/index.yaml', '/events/index.yml', '/events/index.json'];
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

      runtimeEventConfig = toEventConfig(merged);
      return runtimeEventConfig;
    } catch {
      continue;
    }
  }

  runtimeEventConfig = defaultEventConfig;
  return runtimeEventConfig;
};
