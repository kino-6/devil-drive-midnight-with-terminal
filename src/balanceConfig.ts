type MainGunId = 'rusted_cannon' | 'light_cannon' | 'heavy_cannon';
type SubGunId = 'hood_mg' | 'twin_mg' | 'suppression_mg';
type SpecialEquipmentId = 'signal_harpoon' | 'micro_missile' | 'emp_flare';

export type BalanceConfig = {
  version: string;
  resources: {
    baseFuel: number;
    baseArmor: number;
    baseSignal: number;
  };
  scan: {
    baseChance: number;
    aiSupportBonus: number;
    highSignalThreshold: number;
    highSignalBonus: number;
    bossPenalty: number;
    stealthPenalty: number;
    scanBoostPerLevel: number;
  };
  affinity: {
    weakMultiplier: number;
    resistMultiplier: number;
  };
  talk: {
    baseSuccess: number;
    analyzeBonus: number;
    pressurePenaltyPerStack: number;
    minSuccess: number;
    maxSuccess: number;
  };
  contract: {
    normalBaseSuccess: number;
    bossBaseSuccess: number;
    analyzeBonus: number;
    pressurePenaltyPerStack: number;
    minSuccess: number;
    maxSuccess: number;
  };
  escape: {
    baseChance: number;
    reaperPenalty: number;
  };
  approach: {
    hitAndRunBaseChance: number;
    ramControlBonusPerLevel: number;
    minChance: number;
    maxChance: number;
  };
  autoplay: {
    defaultRuns: number;
    minRuns: number;
    maxRuns: number;
    pushForwardChance: number;
    talkProbeChance: number;
  };
  weapons: {
    mainGun: Partial<Record<MainGunId, { damage?: number; ammo?: number }>>;
    subGun: Partial<Record<SubGunId, { damage?: number; hits?: number; softenChance?: number }>>;
    specialEquipment: Partial<Record<SpecialEquipmentId, { damage?: number; ammo?: number; seAmmoCost?: number }>>;
  };
};

export const defaultBalanceConfig: BalanceConfig = {
  version: 'builtin',
  resources: {
    baseFuel: 12,
    baseArmor: 12,
    baseSignal: 5,
  },
  scan: {
    baseChance: 60,
    aiSupportBonus: 20,
    highSignalThreshold: 4,
    highSignalBonus: 10,
    bossPenalty: 15,
    stealthPenalty: 15,
    scanBoostPerLevel: 5,
  },
  affinity: {
    weakMultiplier: 1.5,
    resistMultiplier: 0.5,
  },
  talk: {
    baseSuccess: 0.7,
    analyzeBonus: 0.15,
    pressurePenaltyPerStack: 0.1,
    minSuccess: 0.1,
    maxSuccess: 0.95,
  },
  contract: {
    normalBaseSuccess: 0.8,
    bossBaseSuccess: 0.45,
    analyzeBonus: 0.1,
    pressurePenaltyPerStack: 0.1,
    minSuccess: 0.1,
    maxSuccess: 0.95,
  },
  escape: {
    baseChance: 0.7,
    reaperPenalty: 0.15,
  },
  approach: {
    hitAndRunBaseChance: 0.6,
    ramControlBonusPerLevel: 0.05,
    minChance: 0.6,
    maxChance: 0.9,
  },
  autoplay: {
    defaultRuns: 120,
    minRuns: 10,
    maxRuns: 1000,
    pushForwardChance: 0.35,
    talkProbeChance: 0.35,
  },
  weapons: {
    mainGun: {},
    subGun: {},
    specialEquipment: {},
  },
};

let runtimeBalanceConfig: BalanceConfig = defaultBalanceConfig;

export const getBalanceConfig = () => runtimeBalanceConfig;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asNum = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const asStr = (value: unknown, fallback: string) => (typeof value === 'string' && value.trim() ? value.trim() : fallback);

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
  const stack: Array<{ indent: number; node: Record<string, unknown> }> = [{ indent: -1, node: root }];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  for (const sourceLine of lines) {
    if (!sourceLine.trim() || sourceLine.trimStart().startsWith('#')) continue;
    const indent = sourceLine.match(/^\s*/)?.[0].length ?? 0;
    const trimmed = sourceLine.trim();
    const idx = trimmed.indexOf(':');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const rest = trimmed.slice(idx + 1).trim();
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].node;
    if (!rest.length) {
      const next: Record<string, unknown> = {};
      parent[key] = next;
      stack.push({ indent, node: next });
    } else {
      parent[key] = parseScalar(rest);
    }
  }
  return root;
};

const fromRecord = (raw: Record<string, unknown>): BalanceConfig => {
  const scan = asRecord(raw.scan);
  const resources = asRecord(raw.resources);
  const affinity = asRecord(raw.affinity);
  const talk = asRecord(raw.talk);
  const contract = asRecord(raw.contract);
  const escape = asRecord(raw.escape);
  const approach = asRecord(raw.approach);
  const autoplay = asRecord(raw.autoplay);
  const weapons = asRecord(raw.weapons);
  return {
    version: asStr(raw.version, defaultBalanceConfig.version),
    resources: {
      baseFuel: asNum(resources.baseFuel, defaultBalanceConfig.resources.baseFuel),
      baseArmor: asNum(resources.baseArmor, defaultBalanceConfig.resources.baseArmor),
      baseSignal: asNum(resources.baseSignal, defaultBalanceConfig.resources.baseSignal),
    },
    scan: {
      baseChance: asNum(scan.baseChance, defaultBalanceConfig.scan.baseChance),
      aiSupportBonus: asNum(scan.aiSupportBonus, defaultBalanceConfig.scan.aiSupportBonus),
      highSignalThreshold: asNum(scan.highSignalThreshold, defaultBalanceConfig.scan.highSignalThreshold),
      highSignalBonus: asNum(scan.highSignalBonus, defaultBalanceConfig.scan.highSignalBonus),
      bossPenalty: asNum(scan.bossPenalty, defaultBalanceConfig.scan.bossPenalty),
      stealthPenalty: asNum(scan.stealthPenalty, defaultBalanceConfig.scan.stealthPenalty),
      scanBoostPerLevel: asNum(scan.scanBoostPerLevel, defaultBalanceConfig.scan.scanBoostPerLevel),
    },
    affinity: {
      weakMultiplier: asNum(affinity.weakMultiplier, defaultBalanceConfig.affinity.weakMultiplier),
      resistMultiplier: asNum(affinity.resistMultiplier, defaultBalanceConfig.affinity.resistMultiplier),
    },
    talk: {
      baseSuccess: asNum(talk.baseSuccess, defaultBalanceConfig.talk.baseSuccess),
      analyzeBonus: asNum(talk.analyzeBonus, defaultBalanceConfig.talk.analyzeBonus),
      pressurePenaltyPerStack: asNum(talk.pressurePenaltyPerStack, defaultBalanceConfig.talk.pressurePenaltyPerStack),
      minSuccess: asNum(talk.minSuccess, defaultBalanceConfig.talk.minSuccess),
      maxSuccess: asNum(talk.maxSuccess, defaultBalanceConfig.talk.maxSuccess),
    },
    contract: {
      normalBaseSuccess: asNum(contract.normalBaseSuccess, defaultBalanceConfig.contract.normalBaseSuccess),
      bossBaseSuccess: asNum(contract.bossBaseSuccess, defaultBalanceConfig.contract.bossBaseSuccess),
      analyzeBonus: asNum(contract.analyzeBonus, defaultBalanceConfig.contract.analyzeBonus),
      pressurePenaltyPerStack: asNum(contract.pressurePenaltyPerStack, defaultBalanceConfig.contract.pressurePenaltyPerStack),
      minSuccess: asNum(contract.minSuccess, defaultBalanceConfig.contract.minSuccess),
      maxSuccess: asNum(contract.maxSuccess, defaultBalanceConfig.contract.maxSuccess),
    },
    escape: {
      baseChance: asNum(escape.baseChance, defaultBalanceConfig.escape.baseChance),
      reaperPenalty: asNum(escape.reaperPenalty, defaultBalanceConfig.escape.reaperPenalty),
    },
    approach: {
      hitAndRunBaseChance: asNum(approach.hitAndRunBaseChance, defaultBalanceConfig.approach.hitAndRunBaseChance),
      ramControlBonusPerLevel: asNum(approach.ramControlBonusPerLevel, defaultBalanceConfig.approach.ramControlBonusPerLevel),
      minChance: asNum(approach.minChance, defaultBalanceConfig.approach.minChance),
      maxChance: asNum(approach.maxChance, defaultBalanceConfig.approach.maxChance),
    },
    autoplay: {
      defaultRuns: asNum(autoplay.defaultRuns, defaultBalanceConfig.autoplay.defaultRuns),
      minRuns: asNum(autoplay.minRuns, defaultBalanceConfig.autoplay.minRuns),
      maxRuns: asNum(autoplay.maxRuns, defaultBalanceConfig.autoplay.maxRuns),
      pushForwardChance: asNum(autoplay.pushForwardChance, defaultBalanceConfig.autoplay.pushForwardChance),
      talkProbeChance: asNum(autoplay.talkProbeChance, defaultBalanceConfig.autoplay.talkProbeChance),
    },
    weapons: {
      mainGun: asRecord(weapons.mainGun) as BalanceConfig['weapons']['mainGun'],
      subGun: asRecord(weapons.subGun) as BalanceConfig['weapons']['subGun'],
      specialEquipment: asRecord(weapons.specialEquipment) as BalanceConfig['weapons']['specialEquipment'],
    },
  };
};

const parseBalanceText = (text: string): BalanceConfig => {
  const trimmed = text.trim();
  if (!trimmed) return defaultBalanceConfig;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return fromRecord(parsed);
  } catch {
    return fromRecord(parseYamlLikeObject(trimmed));
  }
};

export const loadBalanceConfig = async (): Promise<BalanceConfig> => {
  const paths = ['/balance.yaml', '/balance.yml', '/balance.json'];
  for (const path of paths) {
    try {
      const res = await fetch(path, { cache: 'no-cache' });
      if (!res.ok) continue;
      const text = await res.text();
      const parsed = parseBalanceText(text);
      runtimeBalanceConfig = parsed;
      return parsed;
    } catch {
      continue;
    }
  }
  runtimeBalanceConfig = defaultBalanceConfig;
  return defaultBalanceConfig;
};
