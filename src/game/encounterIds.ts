export const ENCOUNTER_IDS = [
  'whisper_broker',
  'roadside_phone',
  'pixie_shibuya_glow',
  'foxfire_navi',
  'no_face_taxi_passenger',
  'silent_shape',
  'abandoned_ai_navi',
  'road_reaper',
  'toll_gate_saint',
  'tunnel_rider',
  'closure_ogre',
  'tow_collector',
  'ghost_chaser',
  'vending_spirit',
  'phantom_patrol',
  'midnight_taxi',
  'cone_swarm',
  'mirror_curve',
  'fuel_tanker_saint',
  'hearse_meridian',
  'jackknife_trailer',
  'kuchisake_onna',
  'siren_ambulance',
  'siren_ambulance_v2',
] as const;

export type EncounterIdValue = (typeof ENCOUNTER_IDS)[number];

const ENCOUNTER_ID_SET = new Set<string>(ENCOUNTER_IDS);

export const isEncounterId = (value: unknown): value is EncounterIdValue =>
  typeof value === 'string' && ENCOUNTER_ID_SET.has(value);
