import type { UnlockState } from './game/types';

export type UnlockCurrency = 'credits' | 'driverXp' | 'moeSync';
export type UnlockRuleType =
  | 'purchase'
  | 'milestone'
  | 'boss_clear'
  | 'early_return'
  | 'contract'
  | 'archive'
  | 'story_log'
  | 'rare_route';
export type UnlockCategory = keyof UnlockState;

export type UnlockRule = {
  id: string;
  category: UnlockCategory;
  type: UnlockRuleType;
  currency?: UnlockCurrency;
  cost?: number;
  milestone?: string;
  contract?: string;
  enemy?: string;
  storyLog?: string;
  route?: string;
  reason?: string;
};

export type ProgressionConfig = {
  version: string;
  fallbackMode: 'initial' | 'all';
  initialUnlocks: UnlockState;
  unlockRules: Record<string, UnlockRule>;
};

export const defaultProgressionConfig: ProgressionConfig = {
  version: 'builtin-progression-v1',
  fallbackMode: 'initial',
  initialUnlocks: {
    mainGuns: ['light_cannon'],
    subGuns: ['hood_mg'],
    specialEquipment: ['signal_harpoon'],
    support: ['none'],
  },
  unlockRules: {
    needle_cannon: {
      id: 'needle_cannon',
      category: 'mainGuns',
      type: 'purchase',
      currency: 'driverXp',
      cost: 1,
      reason: 'Train Gunnery 1',
    },
    heavy_cannon: {
      id: 'heavy_cannon',
      category: 'mainGuns',
      type: 'purchase',
      currency: 'credits',
      cost: 2,
      reason: 'Buy with 2 Credits',
    },
    burst_cannon: {
      id: 'burst_cannon',
      category: 'mainGuns',
      type: 'milestone',
      milestone: 'clear_stage_1',
      reason: 'Clear Stage 1',
    },
    rail_cannon: {
      id: 'rail_cannon',
      category: 'mainGuns',
      type: 'boss_clear',
      reason: 'Boss clear',
    },
    siege_cannon: {
      id: 'siege_cannon',
      category: 'mainGuns',
      type: 'milestone',
      milestone: 'clear_stage_2',
      reason: 'Clear Stage 2',
    },
    sigil_driver: {
      id: 'sigil_driver',
      category: 'mainGuns',
      type: 'contract',
      contract: 'radio_voice',
      reason: 'Contract Radio Voice',
    },
    rusted_cannon: {
      id: 'rusted_cannon',
      category: 'mainGuns',
      type: 'early_return',
      reason: 'Return early once',
    },
    twin_mg: {
      id: 'twin_mg',
      category: 'subGuns',
      type: 'purchase',
      currency: 'credits',
      cost: 1,
      reason: 'Buy with 1 Credit',
    },
    intent_jammer: {
      id: 'intent_jammer',
      category: 'subGuns',
      type: 'early_return',
      reason: 'Return early once',
    },
    suppression_mg: {
      id: 'suppression_mg',
      category: 'subGuns',
      type: 'purchase',
      currency: 'credits',
      cost: 2,
      reason: 'Buy with 2 Credits',
    },
    crowd_mg: {
      id: 'crowd_mg',
      category: 'subGuns',
      type: 'milestone',
      milestone: 'clear_stage_1',
      reason: 'Clear Stage 1',
    },
    road_sweeper: {
      id: 'road_sweeper',
      category: 'subGuns',
      type: 'boss_clear',
      reason: 'Boss clear',
    },
    counter_pod: {
      id: 'counter_pod',
      category: 'subGuns',
      type: 'milestone',
      milestone: 'clear_stage_2',
      reason: 'Clear Stage 2',
    },
    mercy_pod: {
      id: 'mercy_pod',
      category: 'subGuns',
      type: 'contract',
      contract: 'silent_shape',
      reason: 'Contract Silent Shape',
    },
    radio_voice: {
      id: 'radio_voice',
      category: 'support',
      type: 'purchase',
      currency: 'moeSync',
      cost: 1,
      reason: 'Sync 1',
    },
    scan_beacon: {
      id: 'scan_beacon',
      category: 'specialEquipment',
      type: 'rare_route',
      route: 'signal_trace',
      reason: 'Trace Signal Tunnel',
    },
    emp_flare: {
      id: 'emp_flare',
      category: 'specialEquipment',
      type: 'milestone',
      milestone: 'clear_stage_1',
      reason: 'Clear Stage 1',
    },
    binding_flare: {
      id: 'binding_flare',
      category: 'specialEquipment',
      type: 'rare_route',
      route: 'open_radio',
      reason: 'Open Radio route',
    },
    jammer_pulse: {
      id: 'jammer_pulse',
      category: 'specialEquipment',
      type: 'contract',
      contract: 'abandoned_ai_navi',
      reason: 'Contract AI Navi',
    },
    decoy_beacon: {
      id: 'decoy_beacon',
      category: 'specialEquipment',
      type: 'purchase',
      currency: 'moeSync',
      cost: 2,
      reason: 'Sync 2',
    },
    micro_missile: {
      id: 'micro_missile',
      category: 'specialEquipment',
      type: 'boss_clear',
      reason: 'Boss clear',
    },
    saint_anchor: {
      id: 'saint_anchor',
      category: 'specialEquipment',
      type: 'milestone',
      milestone: 'clear_stage_2',
      reason: 'Clear Stage 2',
    },
    silent_shape: {
      id: 'silent_shape',
      category: 'support',
      type: 'contract',
      contract: 'silent_shape',
      reason: 'Contract Silent Shape',
    },
    abandoned_ai_navi: {
      id: 'abandoned_ai_navi',
      category: 'support',
      type: 'contract',
      contract: 'abandoned_ai_navi',
      reason: 'Contract AI Navi',
    },
  },
};

let activeProgressionConfig = defaultProgressionConfig;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : [];

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

const normalizeCategory = (value: unknown): UnlockCategory | undefined => {
  if (value === 'mainGuns' || value === 'mainGun') return 'mainGuns';
  if (value === 'subGuns' || value === 'subGun') return 'subGuns';
  if (value === 'specialEquipment' || value === 'special' || value === 'se') return 'specialEquipment';
  if (value === 'support' || value === 'contractSupport') return 'support';
  return undefined;
};

const normalizeCurrency = (value: unknown): UnlockCurrency | undefined => {
  if (value === 'credits' || value === 'driverXp' || value === 'moeSync') return value;
  return undefined;
};

const normalizeRuleType = (value: unknown): UnlockRuleType | undefined => {
  if (
    value === 'purchase'
    || value === 'milestone'
    || value === 'boss_clear'
    || value === 'early_return'
    || value === 'contract'
    || value === 'archive'
    || value === 'story_log'
    || value === 'rare_route'
  ) return value;
  return undefined;
};

const toProgressionConfig = (raw: Record<string, unknown>): ProgressionConfig => {
  const initial = asRecord(raw.initialUnlocks);
  const unlockRulesRaw = asRecord(raw.unlockRules);
  const unlockRules: Record<string, UnlockRule> = {};
  for (const [id, value] of Object.entries(unlockRulesRaw)) {
    const item = asRecord(value);
    const category = normalizeCategory(item.category);
    const type = normalizeRuleType(item.type);
    if (!category || !type) continue;
    unlockRules[id] = {
      id,
      category,
      type,
      currency: normalizeCurrency(item.currency),
      cost: typeof item.cost === 'number' && Number.isFinite(item.cost) ? Math.max(0, Math.floor(item.cost)) : undefined,
      milestone: typeof item.milestone === 'string' ? item.milestone : undefined,
      contract: typeof item.contract === 'string' ? item.contract : undefined,
      enemy: typeof item.enemy === 'string' ? item.enemy : undefined,
      storyLog: typeof item.storyLog === 'string' ? item.storyLog : undefined,
      route: typeof item.route === 'string' ? item.route : undefined,
      reason: typeof item.reason === 'string' ? item.reason : undefined,
    };
  }

  return {
    version: typeof raw.version === 'string' ? raw.version : defaultProgressionConfig.version,
    fallbackMode: raw.fallbackMode === 'all' ? 'all' : 'initial',
    initialUnlocks: {
      mainGuns: asStringArray(initial.mainGuns) as UnlockState['mainGuns'],
      subGuns: asStringArray(initial.subGuns) as UnlockState['subGuns'],
      specialEquipment: asStringArray(initial.specialEquipment) as UnlockState['specialEquipment'],
      support: asStringArray(initial.support) as UnlockState['support'],
    },
    unlockRules: Object.keys(unlockRules).length > 0 ? unlockRules : defaultProgressionConfig.unlockRules,
  };
};

const parseProgressionText = (text: string): ProgressionConfig => {
  const trimmed = text.trim();
  if (!trimmed) return defaultProgressionConfig;
  try {
    return toProgressionConfig(JSON.parse(trimmed) as Record<string, unknown>);
  } catch {
    return toProgressionConfig(parseYamlLikeObject(trimmed));
  }
};

export const getProgressionConfig = () => activeProgressionConfig;

export const loadProgressionConfig = async (): Promise<ProgressionConfig> => {
  for (const path of ['/progression.yaml', '/progression.yml', '/progression.json']) {
    try {
      const res = await fetch(path, { cache: 'no-cache' });
      if (!res.ok) continue;
      activeProgressionConfig = parseProgressionText(await res.text());
      return activeProgressionConfig;
    } catch {
      continue;
    }
  }
  activeProgressionConfig = defaultProgressionConfig;
  return activeProgressionConfig;
};
