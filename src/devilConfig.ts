import type { AffinityRating, ContractId, EncounterId, Temperament } from './game/types';

export type EncounterProfile = {
  label: string;
  subtitle: string;
  threat: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
  signal: string;
  contractable: boolean;
};

export type DevilTemplate = {
  name: string;
  maxHp: number;
  temperament: Temperament;
  contractable: boolean;
  profile: EncounterId;
  targetModuleId?: ContractId;
  armored?: boolean;
  affinities: Record<'ballistic' | 'suppressive' | 'impact' | 'signal' | 'talk', AffinityRating>;
};

export type DevilConfig = {
  version: string;
  encounterProfiles: Record<EncounterId, EncounterProfile>;
  devilTemplates: Record<EncounterId, DevilTemplate>;
  lineups: {
    enc1: EncounterId[];
    enc2: EncounterId[];
    boss: EncounterId[];
  };
  support: {
    effects: Record<EncounterId, string>;
    linkLogs: Record<EncounterId, string>;
    stability: Partial<Record<EncounterId, 'STABLE' | 'NOISY' | 'HUNGRY' | 'UNKNOWN'>>;
  };
};

const encounterIds: EncounterId[] = [
  'whisper_broker',
  'roadside_phone',
  'pixie_shibuya_glow',
  'foxfire_navi',
  'no_face_taxi_passenger',
  'silent_shape',
  'abandoned_ai_navi',
  'road_reaper',
  'toll_gate_saint',
];

const defaultAffinity = {
  ballistic: 'normal',
  suppressive: 'normal',
  impact: 'normal',
  signal: 'normal',
  talk: 'normal',
} as const;

export const defaultDevilConfig: DevilConfig = {
  version: 'builtin',
  encounterProfiles: {
    whisper_broker: { label: 'WHISPER BROKER', subtitle: 'A slim broker exchanging routes for promises.', threat: 'MED', signal: 'CONTRACT TRACE / VIOLET BAND', contractable: true },
    roadside_phone: { label: 'ROADSIDE PHONE', subtitle: 'Ringing public line with an impossible child voice.', threat: 'MED', signal: 'VOICE CARRIER / AM 666.0', contractable: true },
    pixie_shibuya_glow: { label: 'PIXIE // SHIBUYA GLOW', subtitle: 'Tiny city-light fairy that plays with lane signals.', threat: 'LOW', signal: 'STREETLIGHT FRACTAL / SOFT CHIME', contractable: true },
    foxfire_navi: { label: 'FOXFIRE NAVI', subtitle: 'Kitsunebi guide flickering between shrine lanes and flyovers.', threat: 'MED', signal: 'KITSUNEBI TRACE / ROUTE SPOOF', contractable: true },
    no_face_taxi_passenger: { label: 'NO-FACE TAXI PASSENGER', subtitle: 'A faceless rider waiting in the rear-view mirror.', threat: 'HIGH', signal: 'METER DRIFT / BLANK ID', contractable: true },
    silent_shape: { label: 'SILENT SHAPE', subtitle: 'A black mass that swallows engine noise.', threat: 'HIGH', signal: 'AUDIO NULL / EDGE BLUR', contractable: true },
    abandoned_ai_navi: { label: 'ABANDONED AI NAVI', subtitle: 'Cracked guidance unit with haunted pathing.', threat: 'LOW', signal: 'LEGACY BUS / GHOST ARROW', contractable: true },
    road_reaper: { label: 'ROAD REAPER', subtitle: 'Traffic marshal silhouette with terminal intent.', threat: 'CRITICAL', signal: 'HOSTILE SIGNAL / COLLISION VECTOR', contractable: false },
    toll_gate_saint: { label: 'TOLL GATE SAINT', subtitle: 'Armored toll keeper demanding passage.', threat: 'CRITICAL', signal: 'DEEP SIGNAL / TOLL DEMAND', contractable: true },
  },
  devilTemplates: {
    whisper_broker: {
      name: 'Whisper Broker', maxHp: 6, temperament: 'hungry', contractable: true, profile: 'whisper_broker', targetModuleId: 'radio_voice',
      affinities: { ...defaultAffinity, signal: 'weak', talk: 'weak', ballistic: 'resist' },
    },
    roadside_phone: {
      name: 'Roadside Phone', maxHp: 6, temperament: 'lonely', contractable: true, profile: 'roadside_phone', targetModuleId: 'radio_voice',
      affinities: { ...defaultAffinity, signal: 'weak', talk: 'weak', ballistic: 'resist' },
    },
    pixie_shibuya_glow: {
      name: 'Pixie', maxHp: 5, temperament: 'curious', contractable: true, profile: 'pixie_shibuya_glow', targetModuleId: 'radio_voice',
      affinities: { ballistic: 'resist', suppressive: 'normal', impact: 'normal', signal: 'weak', talk: 'weak' },
    },
    foxfire_navi: {
      name: 'Foxfire Navi', maxHp: 6, temperament: 'hungry', contractable: true, profile: 'foxfire_navi', targetModuleId: 'radio_voice',
      affinities: { ballistic: 'normal', suppressive: 'normal', impact: 'resist', signal: 'weak', talk: 'weak' },
    },
    no_face_taxi_passenger: {
      name: 'No-Face Taxi Passenger', maxHp: 7, temperament: 'lonely', contractable: true, profile: 'no_face_taxi_passenger', targetModuleId: 'silent_shape',
      affinities: { ballistic: 'resist', suppressive: 'normal', impact: 'normal', signal: 'normal', talk: 'weak' },
    },
    silent_shape: {
      name: 'Silent Shape', maxHp: 7, temperament: 'hostile', contractable: true, profile: 'silent_shape', targetModuleId: 'silent_shape',
      affinities: { ballistic: 'normal', suppressive: 'resist', impact: 'normal', signal: 'weak', talk: 'normal' },
    },
    abandoned_ai_navi: {
      name: 'Abandoned AI Navi', maxHp: 6, temperament: 'machine', contractable: true, profile: 'abandoned_ai_navi', targetModuleId: 'abandoned_ai_navi',
      affinities: { ballistic: 'normal', suppressive: 'normal', impact: 'resist', signal: 'weak', talk: 'normal' },
    },
    road_reaper: {
      name: 'Road Reaper', maxHp: 9, temperament: 'proud', contractable: false, profile: 'road_reaper',
      affinities: { ballistic: 'weak', suppressive: 'normal', impact: 'normal', signal: 'normal', talk: 'resist' },
    },
    toll_gate_saint: {
      name: 'Toll Gate Saint', maxHp: 16, temperament: 'proud', contractable: true, profile: 'toll_gate_saint', armored: true,
      affinities: { ballistic: 'normal', suppressive: 'resist', impact: 'resist', signal: 'weak', talk: 'normal' },
    },
  },
  lineups: {
    enc1: ['pixie_shibuya_glow', 'whisper_broker'],
    enc2: ['no_face_taxi_passenger', 'abandoned_ai_navi'],
    boss: ['toll_gate_saint'],
  },
  support: {
    effects: {
      whisper_broker: 'Bargain traces boost negotiation readouts.',
      roadside_phone: 'Talk effect +1 while AM 666.0 stays linked.',
      pixie_shibuya_glow: 'Lane lights favor hidden routes and contract rewards.',
      foxfire_navi: 'Route danger signatures become easier to read.',
      no_face_taxi_passenger: 'Rear-view anomalies expose hostile intent shifts.',
      silent_shape: 'Guard absorbs +1 damage once per encounter.',
      abandoned_ai_navi: 'Analyze support + forecast stability improved.',
      road_reaper: 'Hostile lane vectors are marked before impact.',
      toll_gate_saint: 'Toll pulse stabilizes deep-route signal negotiation.',
    },
    linkLogs: {
      whisper_broker: 'WHISPER LINK: bargain static syncs with lane chatter.',
      roadside_phone: "AM 666.0 LINK: a child's voice counts your remaining exits.",
      pixie_shibuya_glow: 'PIXIE LINK: lane lights flicker in a playful rhythm.',
      foxfire_navi: 'FOXFIRE LINK: shrine-lights trace the next ramp.',
      no_face_taxi_passenger: 'NO-FACE LINK: rear-view reflections delay by one breath.',
      silent_shape: 'SILENT LINK: engine noise drops below measurable range.',
      abandoned_ai_navi: 'NAVI LINK: an obsolete route map overlays the windshield.',
      road_reaper: 'REAPER LINK: hostile vectors etch into the guardrail glow.',
      toll_gate_saint: 'TOLL LINK: gate pulse resonates through the dashboard frame.',
    },
    stability: {
      pixie_shibuya_glow: 'NOISY',
      roadside_phone: 'NOISY',
      silent_shape: 'UNKNOWN',
      abandoned_ai_navi: 'NOISY',
      foxfire_navi: 'STABLE',
      whisper_broker: 'HUNGRY',
      no_face_taxi_passenger: 'UNKNOWN',
      toll_gate_saint: 'STABLE',
    },
  },
};

let runtimeDevilConfig: DevilConfig = defaultDevilConfig;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asNum = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const asStr = (value: unknown, fallback: string) => (typeof value === 'string' && value.trim() ? value.trim() : fallback);
const asBool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

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

const parseCsvIds = (value: unknown, fallback: EncounterId[]): EncounterId[] => {
  if (typeof value !== 'string') return fallback;
  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is EncounterId => encounterIds.includes(item as EncounterId));
  return parsed.length ? parsed : fallback;
};

const parseAffinityMap = (value: unknown, fallback: DevilTemplate['affinities']): DevilTemplate['affinities'] => {
  const raw = asRecord(value);
  const read = (k: keyof DevilTemplate['affinities']) => {
    const v = raw[k];
    return v === 'weak' || v === 'normal' || v === 'resist' ? v : fallback[k];
  };
  return {
    ballistic: read('ballistic'),
    suppressive: read('suppressive'),
    impact: read('impact'),
    signal: read('signal'),
    talk: read('talk'),
  };
};

const fromRecord = (raw: Record<string, unknown>): DevilConfig => {
  const profilesRaw = asRecord(raw.profiles);
  const templatesRaw = asRecord(raw.templates);
  const lineupsRaw = asRecord(raw.lineups);
  const supportRaw = asRecord(raw.support);
  const supportEffectsRaw = asRecord(supportRaw.effects);
  const supportLinkRaw = asRecord(supportRaw.linkLogs);
  const supportStabilityRaw = asRecord(supportRaw.stability);

  const encounterProfiles = { ...defaultDevilConfig.encounterProfiles };
  const devilTemplates = { ...defaultDevilConfig.devilTemplates };

  for (const id of encounterIds) {
    const baseProfile = defaultDevilConfig.encounterProfiles[id];
    const profileRaw = asRecord(profilesRaw[id]);
    encounterProfiles[id] = {
      label: asStr(profileRaw.label, baseProfile.label),
      subtitle: asStr(profileRaw.subtitle, baseProfile.subtitle),
      threat:
        profileRaw.threat === 'LOW' || profileRaw.threat === 'MED' || profileRaw.threat === 'HIGH' || profileRaw.threat === 'CRITICAL'
          ? profileRaw.threat
          : baseProfile.threat,
      signal: asStr(profileRaw.signal, baseProfile.signal),
      contractable: asBool(profileRaw.contractable, baseProfile.contractable),
    };

    const baseTemplate = defaultDevilConfig.devilTemplates[id];
    const templateRaw = asRecord(templatesRaw[id]);
    devilTemplates[id] = {
      ...baseTemplate,
      name: asStr(templateRaw.name, baseTemplate.name),
      maxHp: asNum(templateRaw.maxHp, baseTemplate.maxHp),
      temperament:
        templateRaw.temperament === 'hungry' || templateRaw.temperament === 'proud' || templateRaw.temperament === 'lonely' || templateRaw.temperament === 'machine' || templateRaw.temperament === 'hostile' || templateRaw.temperament === 'curious'
          ? templateRaw.temperament
          : baseTemplate.temperament,
      contractable: asBool(templateRaw.contractable, baseTemplate.contractable),
      profile: id,
      targetModuleId:
        templateRaw.targetModuleId === 'radio_voice' || templateRaw.targetModuleId === 'silent_shape' || templateRaw.targetModuleId === 'abandoned_ai_navi'
          ? templateRaw.targetModuleId
          : baseTemplate.targetModuleId,
      armored: asBool(templateRaw.armored, baseTemplate.armored ?? false),
      affinities: parseAffinityMap(templateRaw.affinities, baseTemplate.affinities),
    };
  }

  const supportEffects = { ...defaultDevilConfig.support.effects };
  const supportLinkLogs = { ...defaultDevilConfig.support.linkLogs };
  const supportStability = { ...defaultDevilConfig.support.stability };

  for (const id of encounterIds) {
    supportEffects[id] = asStr(supportEffectsRaw[id], supportEffects[id]);
    supportLinkLogs[id] = asStr(supportLinkRaw[id], supportLinkLogs[id]);
    const stability = supportStabilityRaw[id];
    if (stability === 'STABLE' || stability === 'NOISY' || stability === 'HUNGRY' || stability === 'UNKNOWN') {
      supportStability[id] = stability;
    }
  }

  return {
    version: asStr(raw.version, defaultDevilConfig.version),
    encounterProfiles,
    devilTemplates,
    lineups: {
      enc1: parseCsvIds(lineupsRaw.enc1, defaultDevilConfig.lineups.enc1),
      enc2: parseCsvIds(lineupsRaw.enc2, defaultDevilConfig.lineups.enc2),
      boss: parseCsvIds(lineupsRaw.boss, defaultDevilConfig.lineups.boss),
    },
    support: {
      effects: supportEffects,
      linkLogs: supportLinkLogs,
      stability: supportStability,
    },
  };
};

const parseDevilConfigText = (text: string): DevilConfig => {
  const trimmed = text.trim();
  if (!trimmed) return defaultDevilConfig;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return fromRecord(parsed);
  } catch {
    return fromRecord(parseYamlLikeObject(trimmed));
  }
};

export const getDevilConfig = (): DevilConfig => runtimeDevilConfig;

export const loadDevilConfig = async (): Promise<DevilConfig> => {
  const paths = ['/devils.yaml', '/devils.yml', '/devils.json'];
  for (const path of paths) {
    try {
      const res = await fetch(path, { cache: 'no-cache' });
      if (!res.ok) continue;
      const text = await res.text();
      const parsed = parseDevilConfigText(text);
      runtimeDevilConfig = parsed;
      return parsed;
    } catch {
      continue;
    }
  }
  runtimeDevilConfig = defaultDevilConfig;
  return defaultDevilConfig;
};
