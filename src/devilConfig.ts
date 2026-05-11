import type { AffinityRating, ContractId, EncounterId, Intent, Temperament } from './game/types';
import { ENCOUNTER_IDS, isEncounterId } from './game/encounterIds';

export type EncounterProfile = {
  label: string;
  subtitle: string;
  threat: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
  signal: string;
  contractable: boolean;
  assetImage?: string;
};

export type TalkTendency = {
  successBias: number;
  trustBonus: number;
  interestBonus: number;
  failPressure: number;
  failIntent?: Intent;
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
  talkTendency?: TalkTendency;
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
    whisper_broker: { label: 'WHISPER BROKER', subtitle: 'A slim broker exchanging routes for promises.', threat: 'MED', signal: 'CONTRACT TRACE / VIOLET BAND', contractable: true, assetImage: 'images/devil/whisper_broker_idle.png' },
    roadside_phone: { label: 'ROADSIDE PHONE', subtitle: 'Ringing public line with an impossible child voice.', threat: 'MED', signal: 'VOICE CARRIER / AM 666.0', contractable: true, assetImage: 'images/devil/roadside_phone_idle.png' },
    pixie_shibuya_glow: { label: 'PIXIE // SHIBUYA GLOW', subtitle: 'Tiny city-light fairy that plays with lane signals.', threat: 'LOW', signal: 'STREETLIGHT FRACTAL / SOFT CHIME', contractable: true, assetImage: 'images/devil/pixie_idle.png' },
    foxfire_navi: { label: 'FOXFIRE NAVI', subtitle: 'Kitsunebi guide flickering between shrine lanes and flyovers.', threat: 'MED', signal: 'KITSUNEBI TRACE / ROUTE SPOOF', contractable: true, assetImage: 'images/devil/foxfire_navi_idle.png' },
    no_face_taxi_passenger: { label: 'NO-FACE TAXI PASSENGER', subtitle: 'A faceless rider waiting in the rear-view mirror.', threat: 'HIGH', signal: 'METER DRIFT / BLANK ID', contractable: true, assetImage: 'images/devil/no_face_taxi_passenger_idle.png' },
    silent_shape: { label: 'SILENT SHAPE', subtitle: 'A black mass that swallows engine noise.', threat: 'HIGH', signal: 'AUDIO NULL / EDGE BLUR', contractable: true, assetImage: 'images/devil/silent_shape_idle.png' },
    abandoned_ai_navi: { label: 'ABANDONED AI NAVI', subtitle: 'Cracked guidance unit with haunted pathing.', threat: 'LOW', signal: 'LEGACY BUS / GHOST ARROW', contractable: true, assetImage: 'images/devil/abandoned_ai_navi_idle.png' },
    road_reaper: { label: 'ROAD REAPER', subtitle: 'Traffic marshal silhouette with terminal intent.', threat: 'CRITICAL', signal: 'HOSTILE SIGNAL / COLLISION VECTOR', contractable: false, assetImage: 'images/devil/road_reaper_idle.png' },
    toll_gate_saint: { label: 'TOLL GATE SAINT', subtitle: 'Armored toll keeper demanding passage.', threat: 'CRITICAL', signal: 'DEEP SIGNAL / TOLL DEMAND', contractable: true, assetImage: 'images/devil/toll_gate_saint_idle.png' },
    tunnel_rider: { label: 'TUNNEL RIDER', subtitle: 'A phantom bike weaving through non-existent lanes.', threat: 'HIGH', signal: 'TUNNEL ECHO / SHADOW TRAIL', contractable: true, assetImage: 'images/devil/tunnel_rider_idle.png' },
    closure_ogre: { label: 'CLOSURE OGRE', subtitle: 'Ramp-closure brute forged from barricades and cones.', threat: 'CRITICAL', signal: 'RAMP BLOCK / IMPACT RISK', contractable: false, assetImage: 'images/devil/closure_ogre_idle.png' },
    tow_collector: { label: 'TOW COLLECTOR', subtitle: 'A haunted tow rig demanding unpaid passage.', threat: 'HIGH', signal: 'TOW HOOK / DEBT TRACE', contractable: true, assetImage: 'images/devil/tow_collector_idle.png' },
    ghost_chaser: { label: 'GHOST CHASER', subtitle: 'Siren-lit pursuit spirit that never loses lock.', threat: 'HIGH', signal: 'CHASE VECTOR / SIREN BLEED', contractable: false, assetImage: 'images/devil/ghost_chaser_idle.png' },
    vending_spirit: { label: 'VENDING SPIRIT', subtitle: 'Neon can-machine entity whispering route favors.', threat: 'LOW', signal: 'COIN LOOP / COLD STATIC', contractable: true, assetImage: 'images/devil/vending_spirit_idle.png' },
    phantom_patrol: { label: 'PHANTOM PATROL', subtitle: 'Ghostly patrol car scanning forbidden exits.', threat: 'MED', signal: 'PATROL BAND / BLIND SPOT', contractable: true, assetImage: 'images/devil/phantom_patrol_idle.png' },
    midnight_taxi: { label: 'MIDNIGHT TAXI', subtitle: 'An empty cab that offers one-way fares at 00:00.', threat: 'MED', signal: 'METER PULSE / EMPTY CAB', contractable: true, assetImage: 'images/devil/midnight_taxi_idle.png' },
    cone_swarm: { label: 'CONE SWARM', subtitle: 'Warning cones moving in a synchronized lane blockade.', threat: 'LOW', signal: 'WORK ZONE STATIC / ORANGE BAND', contractable: false, assetImage: 'images/devil/cone_swarm_idle.png' },
    mirror_curve: { label: 'MIRROR CURVE', subtitle: 'A blind bend reflecting the route you refused to take.', threat: 'MED', signal: 'REFLECTION LOOP / EDGE NOISE', contractable: true, assetImage: 'images/devil/mirror_curve_idle.png' },
    fuel_tanker_saint: { label: 'FUEL TANKER SAINT', subtitle: 'A fuel-hauling saint leaking midnight blessings and fumes.', threat: 'HIGH', signal: 'FUEL CHOIR / PRESSURE VALVE', contractable: true, assetImage: 'images/devil/fuel_tanker_saint_idle.png' },
    hearse_meridian: { label: 'HEARSE MERIDIAN', subtitle: 'A black hearse cruising the centerline between exits.', threat: 'HIGH', signal: 'FUNERAL BAND / CENTERLINE DRIFT', contractable: true, assetImage: 'images/devil/hearse_meridian_idle.png' },
    jackknife_trailer: { label: 'JACKKNIFE TRAILER', subtitle: 'A folded trailer blocking three futures at once.', threat: 'CRITICAL', signal: 'FOLDED VECTOR / IMPACT WALL', contractable: false, assetImage: 'images/devil/jackknife_trailer_idle.png' },
    kuchisake_onna: { label: 'KUCHISAKE-ONNA', subtitle: 'A slit-smile passenger asking if the road is beautiful.', threat: 'HIGH', signal: 'SMILE STATIC / BACKSEAT WHISPER', contractable: true, assetImage: 'images/devil/kuchisake_onna_idle.png' },
    siren_ambulance: { label: 'SIREN AMBULANCE', subtitle: 'An emergency vehicle answering accidents before they happen.', threat: 'MED', signal: 'SIREN PULSE / MEDICAL GHOST', contractable: true, assetImage: 'images/devil/siren_ambulance_idle.png' },
    siren_ambulance_v2: { label: 'SIREN AMBULANCE V2', subtitle: 'A deeper siren unit with a corrupted rescue protocol.', threat: 'HIGH', signal: 'SIREN PULSE / RED TRIAGE', contractable: false, assetImage: 'images/devil/siren_ambulance_v2_idle.png' },
  },
  devilTemplates: {
    whisper_broker: {
      name: 'Whisper Broker', maxHp: 6, temperament: 'hungry', contractable: true, profile: 'whisper_broker', targetModuleId: 'radio_voice',
      affinities: { ...defaultAffinity, signal: 'weak', talk: 'weak', ballistic: 'normal' },
      talkTendency: { successBias: 0.05, trustBonus: 0, interestBonus: 1, failPressure: 1, failIntent: 'bargain' },
    },
    roadside_phone: {
      name: 'Roadside Phone', maxHp: 6, temperament: 'lonely', contractable: true, profile: 'roadside_phone', targetModuleId: 'radio_voice',
      affinities: { ...defaultAffinity, signal: 'weak', talk: 'weak', ballistic: 'normal' },
      talkTendency: { successBias: 0.08, trustBonus: 1, interestBonus: 0, failPressure: 1, failIntent: 'curse' },
    },
    pixie_shibuya_glow: {
      name: 'Pixie', maxHp: 5, temperament: 'curious', contractable: true, profile: 'pixie_shibuya_glow', targetModuleId: 'radio_voice',
      affinities: { ballistic: 'normal', suppressive: 'normal', impact: 'normal', signal: 'weak', talk: 'weak' },
      talkTendency: { successBias: 0.12, trustBonus: 1, interestBonus: 1, failPressure: 0, failIntent: 'flee' },
    },
    foxfire_navi: {
      name: 'Foxfire Navi', maxHp: 6, temperament: 'hungry', contractable: true, profile: 'foxfire_navi', targetModuleId: 'radio_voice',
      affinities: { ballistic: 'normal', suppressive: 'normal', impact: 'resist', signal: 'weak', talk: 'weak' },
      talkTendency: { successBias: 0.07, trustBonus: 0, interestBonus: 1, failPressure: 1, failIntent: 'guard' },
    },
    no_face_taxi_passenger: {
      name: 'No-Face Taxi Passenger', maxHp: 7, temperament: 'lonely', contractable: true, profile: 'no_face_taxi_passenger', targetModuleId: 'silent_shape',
      affinities: { ballistic: 'resist', suppressive: 'normal', impact: 'normal', signal: 'normal', talk: 'weak' },
      talkTendency: { successBias: -0.03, trustBonus: 1, interestBonus: 0, failPressure: 2, failIntent: 'curse' },
    },
    silent_shape: {
      name: 'Silent Shape', maxHp: 7, temperament: 'hostile', contractable: true, profile: 'silent_shape', targetModuleId: 'silent_shape',
      affinities: { ballistic: 'normal', suppressive: 'resist', impact: 'normal', signal: 'weak', talk: 'normal' },
      talkTendency: { successBias: -0.1, trustBonus: 0, interestBonus: 0, failPressure: 2, failIntent: 'attack' },
    },
    abandoned_ai_navi: {
      name: 'Abandoned AI Navi', maxHp: 6, temperament: 'machine', contractable: true, profile: 'abandoned_ai_navi', targetModuleId: 'abandoned_ai_navi',
      affinities: { ballistic: 'normal', suppressive: 'normal', impact: 'resist', signal: 'weak', talk: 'normal' },
      talkTendency: { successBias: 0.03, trustBonus: 1, interestBonus: 1, failPressure: 1, failIntent: 'guard' },
    },
    road_reaper: {
      name: 'Road Reaper', maxHp: 9, temperament: 'proud', contractable: false, profile: 'road_reaper',
      affinities: { ballistic: 'weak', suppressive: 'normal', impact: 'normal', signal: 'normal', talk: 'resist' },
      talkTendency: { successBias: -0.18, trustBonus: 0, interestBonus: 0, failPressure: 2, failIntent: 'attack' },
    },
    toll_gate_saint: {
      name: 'Toll Gate Saint', maxHp: 16, temperament: 'proud', contractable: true, profile: 'toll_gate_saint', armored: true,
      affinities: { ballistic: 'normal', suppressive: 'resist', impact: 'resist', signal: 'weak', talk: 'normal' },
      talkTendency: { successBias: -0.08, trustBonus: 1, interestBonus: 0, failPressure: 2, failIntent: 'bargain' },
    },
    tunnel_rider: {
      name: 'Tunnel Rider', maxHp: 8, temperament: 'hostile', contractable: true, profile: 'tunnel_rider', targetModuleId: 'silent_shape',
      affinities: { ballistic: 'normal', suppressive: 'normal', impact: 'weak', signal: 'normal', talk: 'resist' },
      talkTendency: { successBias: -0.12, trustBonus: 0, interestBonus: 0, failPressure: 2, failIntent: 'attack' },
    },
    closure_ogre: {
      name: 'Closure Ogre', maxHp: 12, temperament: 'proud', contractable: false, profile: 'closure_ogre', armored: true,
      affinities: { ballistic: 'weak', suppressive: 'resist', impact: 'resist', signal: 'normal', talk: 'resist' },
      talkTendency: { successBias: -0.2, trustBonus: 0, interestBonus: 0, failPressure: 2, failIntent: 'guard' },
    },
    tow_collector: {
      name: 'Tow Collector', maxHp: 9, temperament: 'hungry', contractable: true, profile: 'tow_collector', targetModuleId: 'radio_voice',
      affinities: { ballistic: 'normal', suppressive: 'normal', impact: 'resist', signal: 'weak', talk: 'normal' },
      talkTendency: { successBias: 0.02, trustBonus: 0, interestBonus: 1, failPressure: 1, failIntent: 'bargain' },
    },
    ghost_chaser: {
      name: 'Ghost Chaser', maxHp: 10, temperament: 'hostile', contractable: false, profile: 'ghost_chaser',
      affinities: { ballistic: 'normal', suppressive: 'weak', impact: 'normal', signal: 'resist', talk: 'resist' },
      talkTendency: { successBias: -0.16, trustBonus: 0, interestBonus: 0, failPressure: 2, failIntent: 'attack' },
    },
    vending_spirit: {
      name: 'Vending Spirit', maxHp: 6, temperament: 'curious', contractable: true, profile: 'vending_spirit', targetModuleId: 'radio_voice',
      affinities: { ballistic: 'normal', suppressive: 'normal', impact: 'normal', signal: 'weak', talk: 'weak' },
      talkTendency: { successBias: 0.1, trustBonus: 1, interestBonus: 1, failPressure: 0, failIntent: 'flee' },
    },
    phantom_patrol: {
      name: 'Phantom Patrol', maxHp: 8, temperament: 'machine', contractable: true, profile: 'phantom_patrol', targetModuleId: 'abandoned_ai_navi',
      affinities: { ballistic: 'normal', suppressive: 'resist', impact: 'normal', signal: 'weak', talk: 'normal' },
      talkTendency: { successBias: 0.03, trustBonus: 1, interestBonus: 0, failPressure: 1, failIntent: 'guard' },
    },
    midnight_taxi: {
      name: 'Midnight Taxi', maxHp: 7, temperament: 'lonely', contractable: true, profile: 'midnight_taxi', targetModuleId: 'silent_shape',
      affinities: { ballistic: 'normal', suppressive: 'normal', impact: 'normal', signal: 'normal', talk: 'weak' },
      talkTendency: { successBias: 0.05, trustBonus: 1, interestBonus: 0, failPressure: 1, failIntent: 'curse' },
    },
    cone_swarm: {
      name: 'Cone Swarm', maxHp: 5, temperament: 'machine', contractable: false, profile: 'cone_swarm',
      affinities: { ballistic: 'normal', suppressive: 'weak', impact: 'resist', signal: 'normal', talk: 'resist' },
      talkTendency: { successBias: -0.15, trustBonus: 0, interestBonus: 0, failPressure: 1, failIntent: 'guard' },
    },
    mirror_curve: {
      name: 'Mirror Curve', maxHp: 7, temperament: 'curious', contractable: true, profile: 'mirror_curve', targetModuleId: 'abandoned_ai_navi',
      affinities: { ballistic: 'normal', suppressive: 'normal', impact: 'normal', signal: 'weak', talk: 'normal' },
      talkTendency: { successBias: 0.02, trustBonus: 0, interestBonus: 1, failPressure: 1, failIntent: 'curse' },
    },
    fuel_tanker_saint: {
      name: 'Fuel Tanker Saint', maxHp: 10, temperament: 'hungry', contractable: true, profile: 'fuel_tanker_saint', targetModuleId: 'radio_voice', armored: true,
      affinities: { ballistic: 'normal', suppressive: 'normal', impact: 'resist', signal: 'weak', talk: 'normal' },
      talkTendency: { successBias: -0.02, trustBonus: 0, interestBonus: 2, failPressure: 2, failIntent: 'bargain' },
    },
    hearse_meridian: {
      name: 'Hearse Meridian', maxHp: 9, temperament: 'lonely', contractable: true, profile: 'hearse_meridian', targetModuleId: 'silent_shape',
      affinities: { ballistic: 'normal', suppressive: 'resist', impact: 'normal', signal: 'normal', talk: 'weak' },
      talkTendency: { successBias: 0.01, trustBonus: 1, interestBonus: 0, failPressure: 2, failIntent: 'curse' },
    },
    jackknife_trailer: {
      name: 'Jackknife Trailer', maxHp: 12, temperament: 'hostile', contractable: false, profile: 'jackknife_trailer', armored: true,
      affinities: { ballistic: 'weak', suppressive: 'normal', impact: 'resist', signal: 'normal', talk: 'resist' },
      talkTendency: { successBias: -0.2, trustBonus: 0, interestBonus: 0, failPressure: 2, failIntent: 'attack' },
    },
    kuchisake_onna: {
      name: 'Kuchisake-Onna', maxHp: 8, temperament: 'proud', contractable: true, profile: 'kuchisake_onna', targetModuleId: 'silent_shape',
      affinities: { ballistic: 'normal', suppressive: 'normal', impact: 'resist', signal: 'normal', talk: 'weak' },
      talkTendency: { successBias: -0.04, trustBonus: 1, interestBonus: 0, failPressure: 2, failIntent: 'bargain' },
    },
    siren_ambulance: {
      name: 'Siren Ambulance', maxHp: 8, temperament: 'machine', contractable: true, profile: 'siren_ambulance', targetModuleId: 'abandoned_ai_navi',
      affinities: { ballistic: 'normal', suppressive: 'weak', impact: 'normal', signal: 'weak', talk: 'normal' },
      talkTendency: { successBias: 0.04, trustBonus: 1, interestBonus: 1, failPressure: 1, failIntent: 'guard' },
    },
    siren_ambulance_v2: {
      name: 'Siren Ambulance V2', maxHp: 10, temperament: 'hostile', contractable: false, profile: 'siren_ambulance_v2',
      affinities: { ballistic: 'normal', suppressive: 'weak', impact: 'normal', signal: 'resist', talk: 'resist' },
      talkTendency: { successBias: -0.18, trustBonus: 0, interestBonus: 0, failPressure: 2, failIntent: 'attack' },
    },
  },
  lineups: {
    enc1: ['pixie_shibuya_glow', 'whisper_broker', 'vending_spirit', 'roadside_phone', 'abandoned_ai_navi', 'cone_swarm', 'siren_ambulance'],
    enc2: ['no_face_taxi_passenger', 'silent_shape', 'foxfire_navi', 'tunnel_rider', 'road_reaper', 'closure_ogre', 'tow_collector', 'ghost_chaser', 'phantom_patrol', 'midnight_taxi', 'mirror_curve', 'fuel_tanker_saint', 'hearse_meridian', 'jackknife_trailer', 'kuchisake_onna', 'siren_ambulance_v2'],
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
      tunnel_rider: 'First Ram gains extra pressure on the target.',
      closure_ogre: 'Barricade bulk reinforces armor checks briefly.',
      tow_collector: 'Salvage traces occasionally convert to extra credit.',
      ghost_chaser: 'Pursuit vectors reveal imminent attack lanes.',
      vending_spirit: 'Route offerings skew toward safer salvage picks.',
      phantom_patrol: 'Initial forecast noise is reduced by one step.',
      midnight_taxi: 'Talk channel opens with less static on first contact.',
      cone_swarm: 'Work-zone cones mark safer lanes before collision.',
      mirror_curve: 'Reflected route data improves anomaly reads.',
      fuel_tanker_saint: 'Fuel pressure traces reveal high-risk salvage.',
      hearse_meridian: 'Funeral-band static softens curse pressure.',
      jackknife_trailer: 'Folded vectors warn before heavy impact.',
      kuchisake_onna: 'Backseat whisper hints improve Talk timing.',
      siren_ambulance: 'Emergency triage pulses stabilize Analyze.',
      siren_ambulance_v2: 'Corrupted siren vectors flag imminent attacks.',
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
      tunnel_rider: 'RIDER LINK: tunnel echoes sync to throttle rhythm.',
      closure_ogre: 'OGRE LINK: barricade sigils latch onto the chassis frame.',
      tow_collector: 'TOW LINK: chain rattle tracks abandoned side lanes.',
      ghost_chaser: 'CHASER LINK: distant sirens mirror your steering corrections.',
      vending_spirit: 'VENDING LINK: coin drops ring from an empty shoulder.',
      phantom_patrol: 'PATROL LINK: ghost beacons sweep the next merge.',
      midnight_taxi: 'TAXI LINK: a vacant meter ticks in the back seat.',
      cone_swarm: 'CONE LINK: work-zone lights count down the next merge.',
      mirror_curve: 'MIRROR LINK: the side mirror shows the lane you skipped.',
      fuel_tanker_saint: 'TANKER LINK: fuel hymns thrum through the frame.',
      hearse_meridian: 'HEARSE LINK: centerline bells fade into the cabin.',
      jackknife_trailer: 'TRAILER LINK: folded vectors brace the chassis.',
      kuchisake_onna: 'KUCHISAKE LINK: a backseat smile watches the talk channel.',
      siren_ambulance: 'AMBULANCE LINK: triage pulses sync with the dashboard.',
      siren_ambulance_v2: 'RED SIREN LINK: corrupted rescue vectors mark impact risk.',
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
      tunnel_rider: 'NOISY',
      closure_ogre: 'HUNGRY',
      tow_collector: 'STABLE',
      ghost_chaser: 'UNKNOWN',
      vending_spirit: 'NOISY',
      phantom_patrol: 'STABLE',
      midnight_taxi: 'UNKNOWN',
      cone_swarm: 'NOISY',
      mirror_curve: 'UNKNOWN',
      fuel_tanker_saint: 'HUNGRY',
      hearse_meridian: 'UNKNOWN',
      jackknife_trailer: 'HUNGRY',
      kuchisake_onna: 'NOISY',
      siren_ambulance: 'STABLE',
      siren_ambulance_v2: 'UNKNOWN',
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
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    return inner ? inner.split(',').map((item) => parseScalar(item)) : [];
  }
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

const parseStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }
  if (typeof value !== 'string') return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
};

const parseLineupIds = (value: unknown, fallback: EncounterId[]): EncounterId[] => {
  const parsed = parseStringList(value).filter(isEncounterId);
  return parsed.length ? parsed : fallback;
};

const parseIncludePaths = (value: unknown): string[] => {
  return parseStringList(value);
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

const parseTalkTendency = (value: unknown, fallback?: TalkTendency): TalkTendency | undefined => {
  const raw = asRecord(value);
  if (!Object.keys(raw).length) return fallback;
  const failIntent = raw.failIntent;
  return {
    successBias: asNum(raw.successBias, fallback?.successBias ?? 0),
    trustBonus: asNum(raw.trustBonus, fallback?.trustBonus ?? 0),
    interestBonus: asNum(raw.interestBonus, fallback?.interestBonus ?? 0),
    failPressure: asNum(raw.failPressure, fallback?.failPressure ?? 1),
    failIntent: failIntent === 'attack' || failIntent === 'curse' || failIntent === 'bargain' || failIntent === 'guard' || failIntent === 'flee'
      ? failIntent
      : fallback?.failIntent,
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

  for (const id of ENCOUNTER_IDS) {
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
      assetImage: asStr(profileRaw.assetImage, baseProfile.assetImage ?? ''),
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
      talkTendency: parseTalkTendency(templateRaw.talkTendency, baseTemplate.talkTendency),
    };
  }

  const supportEffects = { ...defaultDevilConfig.support.effects };
  const supportLinkLogs = { ...defaultDevilConfig.support.linkLogs };
  const supportStability = { ...defaultDevilConfig.support.stability };

  for (const id of ENCOUNTER_IDS) {
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
      enc1: parseLineupIds(lineupsRaw.enc1, defaultDevilConfig.lineups.enc1),
      enc2: parseLineupIds(lineupsRaw.enc2, defaultDevilConfig.lineups.enc2),
      boss: parseLineupIds(lineupsRaw.boss, defaultDevilConfig.lineups.boss),
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

const loadSplitConfigFromIndex = async (): Promise<DevilConfig | null> => {
  const indexCandidates = ['/devils/index.yaml', '/devils/index.yml', '/devils/index.json'];
  for (const indexPath of indexCandidates) {
    try {
      const indexRes = await fetch(indexPath, { cache: 'no-cache' });
      if (!indexRes.ok) continue;
      const indexText = await indexRes.text();
      const indexRaw = parseConfigRecordText(indexText);
      const includeRaw = indexRaw.includes;
      const includePaths = Array.isArray(includeRaw)
        ? includeRaw.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        : parseIncludePaths(includeRaw);

      let merged = mergeRecords({}, indexRaw);
      delete merged.includes;

      for (const includePath of includePaths) {
        const resolved = resolveIncludePath(indexPath, includePath);
        if (!resolved) continue;
        try {
          const includeRes = await fetch(resolved, { cache: 'no-cache' });
          if (!includeRes.ok) continue;
          const includeText = await includeRes.text();
          const includeRawRecord = parseConfigRecordText(includeText);
          merged = mergeRecords(merged, includeRawRecord);
        } catch {
          continue;
        }
      }

      const parsed = fromRecord(merged);
      runtimeDevilConfig = parsed;
      return parsed;
    } catch {
      continue;
    }
  }
  return null;
};

export const getDevilConfig = (): DevilConfig => runtimeDevilConfig;

export const loadDevilConfig = async (): Promise<DevilConfig> => {
  const splitLoaded = await loadSplitConfigFromIndex();
  if (splitLoaded) return splitLoaded;

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
