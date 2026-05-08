export type EnemyAssetEntry = string | {
  idle?: string;
  moveFrames?: string[];
};

export type AssetManifest = {
  version: string;
  media: {
    bgm?: string;
    sfx?: Record<string, string>;
  };
  images: {
    player?: string;
    moe?: string;
    moeVariants?: Record<string, string>;
    logo?: string;
    enemies?: Record<string, EnemyAssetEntry>;
    ui?: Record<string, string>;
  };
  ui: {
    shellClass?: string;
    cssVars?: Record<string, string>;
  };
};

export const defaultAssetManifest: AssetManifest = {
  version: 'builtin',
  media: {},
  images: {
    enemies: {
      unknown_sign: 'images/devil/unknown_idle.png',
    },
  },
  ui: {},
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asStringMap = (value: unknown): Record<string, string> => {
  const raw = asRecord(value);
  const out: Record<string, string> = {};
  for (const [key, v] of Object.entries(raw)) {
    if (typeof v === 'string' && v.trim().length > 0) out[key] = v.trim();
  }
  return out;
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
};

const asEnemyAssetMap = (value: unknown): Record<string, EnemyAssetEntry> => {
  const raw = asRecord(value);
  const out: Record<string, EnemyAssetEntry> = {};
  for (const [key, v] of Object.entries(raw)) {
    if (typeof v === 'string' && v.trim().length > 0) {
      out[key] = v.trim();
      continue;
    }

    const entry = asRecord(v);
    const idle = typeof entry.idle === 'string' ? entry.idle.trim() : '';
    const moveFrames = asStringArray(entry.moveFrames);
    if (idle || moveFrames.length > 0) out[key] = { idle: idle || undefined, moveFrames };
  }
  return out;
};

const parseScalar = (raw: string): unknown => {
  const value = raw.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return null;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
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

    if (rest.length === 0) {
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

const toAssetManifest = (raw: Record<string, unknown>): AssetManifest => {
  const media = asRecord(raw.media);
  const images = asRecord(raw.images);
  const ui = asRecord(raw.ui);
  return {
    version: typeof raw.version === 'string' ? raw.version : defaultAssetManifest.version,
    media: {
      bgm: typeof media.bgm === 'string' ? media.bgm : undefined,
      sfx: asStringMap(media.sfx),
    },
    images: {
      player: typeof images.player === 'string' ? images.player : undefined,
      moe: typeof images.moe === 'string' ? images.moe : undefined,
      moeVariants: asStringMap(images.moeVariants),
      logo: typeof images.logo === 'string' ? images.logo : undefined,
      enemies: asEnemyAssetMap(images.enemies),
      ui: asStringMap(images.ui),
    },
    ui: {
      shellClass: typeof ui.shellClass === 'string' ? ui.shellClass : undefined,
      cssVars: asStringMap(ui.cssVars),
    },
  };
};

export const resolveAssetUrl = (value?: string): string | undefined => {
  if (!value) return undefined;
  const path = value.trim();
  if (!path) return undefined;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('/')) return path;
  return `/assets/${path.replace(/^\.?\//, '')}`;
};

export const getEnemyAssetIdlePath = (entry?: EnemyAssetEntry): string | undefined => {
  if (typeof entry === 'string') return entry;
  return entry?.idle ?? entry?.moveFrames?.[0];
};

export const resolveEnemyAssetEntryUrl = (entry?: EnemyAssetEntry): string | undefined =>
  resolveAssetUrl(getEnemyAssetIdlePath(entry));

export const resolveEnemyAssetEntryFrameUrls = (entry?: EnemyAssetEntry): string[] => {
  const frames = typeof entry === 'string'
    ? [entry]
    : entry?.moveFrames && entry.moveFrames.length > 0
      ? entry.moveFrames
      : entry?.idle
        ? [entry.idle]
        : [];
  return frames
    .map((frame) => resolveAssetUrl(frame))
    .filter((frame): frame is string => !!frame);
};

const parseManifestText = (text: string): AssetManifest => {
  const trimmed = text.trim();
  if (!trimmed) return defaultAssetManifest;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return toAssetManifest(parsed);
  } catch {
    const parsed = parseYamlLikeObject(trimmed);
    return toAssetManifest(parsed);
  }
};

export const loadAssetManifest = async (): Promise<AssetManifest> => {
  const candidates = ['/assets/manifest.yaml', '/assets/manifest.yml', '/assets/manifest.json'];
  for (const path of candidates) {
    try {
      const res = await fetch(path, { cache: 'no-cache' });
      if (!res.ok) continue;
      const text = await res.text();
      return parseManifestText(text);
    } catch {
      continue;
    }
  }
  return defaultAssetManifest;
};
