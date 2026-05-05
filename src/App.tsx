import { useEffect, useMemo, useReducer, useRef, useState } from 'react';

type ContractId = 'radio_voice' | 'silent_shape' | 'abandoned_ai_navi';
type TerminalLogKind = 'warning' | 'contract' | 'damage' | 'system' | 'route';
type EncounterId =
  | 'whisper_broker'
  | 'roadside_phone'
  | 'pixie_shibuya_glow'
  | 'foxfire_navi'
  | 'no_face_taxi_passenger'
  | 'silent_shape'
  | 'abandoned_ai_navi'
  | 'road_reaper'
  | 'toll_gate_saint';
type CommandId = 'main_gun' | 'sub_gun' | 'se_harpoon' | 'analyze' | 'talk' | 'contract' | 'ram' | 'guard' | 'escape';
type AffinityType = 'ballistic' | 'suppressive' | 'impact' | 'signal' | 'talk';
type AffinityRating = 'weak' | 'normal' | 'resist';
type DevilAffinity = Record<AffinityType, AffinityRating>;
type MainGunId = 'rusted_cannon' | 'light_cannon' | 'heavy_cannon';
type SubGunId = 'hood_mg' | 'twin_mg' | 'suppression_mg';
type SpecialEquipmentId = 'signal_harpoon' | 'micro_missile' | 'emp_flare';
type ContractSupportId = 'empty' | ContractId;
type Temperament = 'hungry' | 'proud' | 'lonely' | 'machine' | 'hostile' | 'curious';
type Intent = 'attack' | 'curse' | 'bargain' | 'guard' | 'flee';
type EncounterPhase = 'command' | 'resolving' | 'finished';
type GamePhase =
  | 'prologue'
  | 'approach'
  | 'encounter'
  | 'reward'
  | 'route_choice'
  | 'salvage'
  | 'signal'
  | 'boss_preview'
  | 'boss_encounter'
  | 'return_gate'
  | 'result'
  | 'garage'
  | 'game_over';

type ResultType = 'Early Return' | 'Boss Cleared' | 'Boss Avoided' | 'Vehicle Disabled';
type RewardTarget = 'encounter2' | 'boss';
type RewardScope = 'post_enc1' | 'post_enc2';

type ContractModule = { id: ContractId; name: string; effect: string };
type ForecastMap = Record<string, Intent[]>;
type RewardOption = { id: string; label: string; detail: string; fuel?: number; armor?: number; signal?: number; mainAmmo?: number; seAmmo?: number };
type MainGun = { id: MainGunId; name: string; damage: number; ammo: number; description: string };
type SubGun = { id: SubGunId; name: string; damage: number; mode: 'all' | 'random_hits'; hits?: number; softenChance?: number; description: string };
type SpecialEquipment = { id: SpecialEquipmentId; name: string; damage: number; seAmmoCost: number; ammo: number; effect: 'interest' | 'all_damage' | 'emp'; description: string };
type ContractSupport = { id: ContractSupportId; name: string; description: string };
type Loadout = {
  mainGunId: MainGunId;
  subGunId: SubGunId;
  specialEquipmentId: SpecialEquipmentId;
  contractSupportId: ContractSupportId;
};

type Devil = {
  id: string;
  name: string;
  maxHp: number;
  hp: number;
  temperament: Temperament;
  intent: Intent;
  contractable: boolean;
  revealed: boolean;
  targetModuleId?: ContractId;
  trust: number;
  pressure: number;
  interest: number;
  guardStacks: number;
  contractWindow: boolean;
  armored?: boolean;
  affinities: DevilAffinity;
  affinityRevealed?: boolean;
  profile: EncounterId;
  empDisabledTurns: number;
  exit?: 'defeated' | 'contracted' | 'fled';
};

type EncounterState = {
  kind: 'enc1' | 'enc2' | 'boss';
  enemies: Devil[];
  selectedEnemyId: string;
  selectedCommand: CommandId;
  turn: number;
  phase: EncounterPhase;
  guardActive: boolean;
  analyzedEnemyIds: string[];
  forecast: ForecastMap;
  forecastUnstable: boolean;
  supportArmorGuardReady: boolean;
};

type EncounterReport = {
  wave: number;
  defeated: number;
  contracted: number;
  fled: number;
  escaped: boolean;
};

type RunSummary = {
  cleared: number;
  defeated: number;
  contracted: number;
  escaped: number;
};

type PreviousRunSummary = {
  resultType: ResultType;
  encountersCleared: number;
  bossChallenged: boolean;
  contractsAcquired: number;
  salvageGained: number;
  fuel: number;
  armor: number;
  signal: number;
  mainAmmo: number;
  seAmmo: number;
};

type AutoPlayStrategy = 'balanced' | 'aggressive' | 'safe' | 'contract';
type AutoPlayReport = {
  runs: number;
  strategy: AutoPlayStrategy;
  winRate: number;
  avgEncounters: number;
  avgContracts: number;
  avgSalvage: number;
  avgFuel: number;
  avgArmor: number;
  avgSignal: number;
  avgMainAmmo: number;
  avgSeAmmo: number;
  counts: Record<ResultType, number>;
};

type StoryLogId = 'LOG_00' | 'LOG_01' | 'LOG_02' | 'LOG_03' | 'LOG_04';
type StoryLogEntry = { id: StoryLogId; title: string; text: string };
type StoryState = {
  chapter: number;
  recoveredLogs: StoryLogId[];
  moeMemory: number;
  previousDriverClues: number;
  recentRecoveredLogs: StoryLogId[];
};

type ApproachKind = EncounterState['kind'];
type ApproachOption = 'preemptive_main_gun' | 'hit_and_run_ram' | 'silent_coast' | 'open_channel';
type UpgradeId = 'ram_control' | 'gunnery' | 'scan_boost' | 'translation_assist';
type VehicleUpgradeId = 'fuel_tank' | 'armor_plating' | 'ammo_rack' | 'se_rack';
type SkillLevels = Record<UpgradeId, number>;
type VehicleUpgradeLevels = Record<VehicleUpgradeId, number>;
type ApproachState = {
  pendingKind: ApproachKind;
  scanSuccess: boolean;
  scanChance: number;
  lineup: EncounterId[];
};
type EncounterPrep = {
  approachLabel?: string;
  firstStrike: boolean;
  ambushed: boolean;
  talkPrepared: boolean;
  intentDisrupted: boolean;
  firstTalkBonus: number;
  firstTalkPending: boolean;
};

type State = {
  gamePhase: GamePhase;
  fuel: number;
  armor: number;
  signal: number;
  mainAmmo: number;
  maxMainAmmo: number;
  seAmmo: number;
  maxSeAmmo: number;
  contracts: ContractModule[];
  logs: string[];
  salvageCredits: number;
  encounterIndex: number;
  encounter: EncounterState;
  rewardOptions: RewardOption[];
  rewardTarget?: RewardTarget;
  rewardScope?: RewardScope;
  routeBoostReward: boolean;
  tempForecastBoost: number;
  lastReport?: EncounterReport;
  runSummary: RunSummary;
  resultType?: ResultType;
  bossChallenged: boolean;
  moeLine: string;
  selectedLoadout: Loadout;
  previousRun?: PreviousRunSummary;
  approach?: ApproachState;
  encounterPrep: EncounterPrep;
  skillLevels: SkillLevels;
  vehicleUpgrades: VehicleUpgradeLevels;
  driverXpBank: number;
  moeSyncBank: number;
  creditBank: number;
  growthClaimed: boolean;
  analyzeSuccessCount: number;
  story: StoryState;
};

type Action =
  | { type: 'ADVANCE_PROLOGUE' }
  | { type: 'START_ENGINE' }
  | { type: 'APPROACH_CHOOSE'; option: ApproachOption }
  | { type: 'APPROACH_CONTINUE' }
  | { type: 'PURCHASE_SKILL'; upgrade: UpgradeId }
  | { type: 'PURCHASE_VEHICLE_UPGRADE'; id: VehicleUpgradeId }
  | { type: 'SELECT_ENEMY'; enemyId: string }
  | { type: 'SELECT_COMMAND'; command: CommandId }
  | { type: 'EXECUTE_COMMAND'; command?: CommandId }
  | { type: 'REWARD_CONTINUE' }
  | { type: 'ROUTE_CHOICE'; lane: 'salvage' | 'signal' | 'push_forward' | 'return_gate' }
  | { type: 'SALVAGE_PICK'; rewardId: string }
  | { type: 'SIGNAL_CONTINUE' }
  | { type: 'BOSS_PREVIEW_CHOICE'; choice: 'challenge' | 'emergency_salvage' | 'return_gate' }
  | { type: 'RETURN_TO_SURFACE' }
  | { type: 'OPEN_GARAGE' }
  | { type: 'GARAGE_SET_MAIN_GUN'; id: MainGunId }
  | { type: 'GARAGE_SET_SUB_GUN'; id: SubGunId }
  | { type: 'GARAGE_SET_SPECIAL'; id: SpecialEquipmentId }
  | { type: 'GARAGE_SET_SUPPORT'; id: ContractSupportId }
  | { type: 'GARAGE_ENTER_RUN' }
  | { type: 'START_NEXT_RUN' }
  | { type: 'RETRY' };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const isAlive = (d: Devil) => d.hp > 0;

const contractModules: Record<ContractId, ContractModule> = {
  radio_voice: { id: 'radio_voice', name: 'Radio Voice', effect: 'AM 666.0 link gain / Talk synergy' },
  silent_shape: { id: 'silent_shape', name: 'Silent Shape', effect: 'Guard posture stability' },
  abandoned_ai_navi: { id: 'abandoned_ai_navi', name: 'Abandoned AI Navi', effect: 'NAVI forecast +2 turn (unstable)' },
};

const contractLabels: Record<ContractId, string> = {
  radio_voice: 'AM 666.0',
  silent_shape: 'SILENT',
  abandoned_ai_navi: 'AI NAVI',
};

const defaultLoadout: Loadout = {
  mainGunId: 'rusted_cannon',
  subGunId: 'hood_mg',
  specialEquipmentId: 'signal_harpoon',
  contractSupportId: 'empty',
};

const mainGunCatalog: Record<MainGunId, MainGun> = {
  rusted_cannon: { id: 'rusted_cannon', name: 'Rusted Cannon', damage: 4, ammo: 8, description: '標準的な主砲。単体に安定した大ダメージ。' },
  light_cannon: { id: 'light_cannon', name: 'Light Cannon', damage: 3, ammo: 12, description: '火力は低いが弾数が多い。長期戦向き。' },
  heavy_cannon: { id: 'heavy_cannon', name: 'Heavy Cannon', damage: 6, ammo: 5, description: '高火力だが弾数が少ない。Boss向き。' },
};

const subGunCatalog: Record<SubGunId, SubGun> = {
  hood_mg: { id: 'hood_mg', name: 'Hood MG', damage: 1, mode: 'all', description: '全体に小ダメージ。標準的な副砲。' },
  twin_mg: { id: 'twin_mg', name: 'Twin MG', damage: 1, mode: 'random_hits', hits: 2, description: 'ランダム対象に2回攻撃。少数戦向き。' },
  suppression_mg: { id: 'suppression_mg', name: 'Suppression MG', damage: 1, mode: 'all', softenChance: 0.4, description: '牽制射撃。被害を抑えたい時に使う。' },
};

const specialEquipmentCatalog: Record<SpecialEquipmentId, SpecialEquipment> = {
  signal_harpoon: { id: 'signal_harpoon', name: 'Signal Harpoon', damage: 2, seAmmoCost: 1, ammo: 4, effect: 'interest', description: '契約を狙うための特殊兵装。' },
  micro_missile: { id: 'micro_missile', name: 'Micro Missile', damage: 3, seAmmoCost: 1, ammo: 3, effect: 'all_damage', description: '全体攻撃。契約より撃破向き。' },
  emp_flare: { id: 'emp_flare', name: 'EMP Flare', damage: 1, seAmmoCost: 1, ammo: 4, effect: 'emp', description: '機械霊対策。AI系の行動を鈍らせる。' },
};

const contractSupportCatalog: Record<ContractSupportId, ContractSupport> = {
  empty: { id: 'empty', name: 'Empty', description: '効果なし' },
  radio_voice: { id: 'radio_voice', name: 'Radio Voice', description: 'Talk成功率 +5% / Signal Lane強化 / AM 666.0ノイズ' },
  silent_shape: { id: 'silent_shape', name: 'Silent Shape', description: '各Encounter最初のArmorダメージ-1 / 20%で開始時Fuel-1' },
  abandoned_ai_navi: { id: 'abandoned_ai_navi', name: 'Abandoned AI Navi', description: 'NAVI Forecast +1 turn / 20%で誤予測' },
};

const commandOptions: { id: CommandId; label: string; tone: 'danger' | 'contract' | 'route' | 'system'; group: 'WEAPON' | 'TERMINAL' | 'DRIVE' }[] = [
  { id: 'main_gun', label: 'Main Gun', tone: 'danger', group: 'WEAPON' },
  { id: 'sub_gun', label: 'Sub Gun', tone: 'danger', group: 'WEAPON' },
  { id: 'se_harpoon', label: 'S-E', tone: 'contract', group: 'WEAPON' },
  { id: 'analyze', label: 'Analyze', tone: 'system', group: 'TERMINAL' },
  { id: 'talk', label: 'Talk', tone: 'route', group: 'TERMINAL' },
  { id: 'contract', label: 'Contract', tone: 'contract', group: 'TERMINAL' },
  { id: 'ram', label: 'Ram', tone: 'danger', group: 'DRIVE' },
  { id: 'guard', label: 'Guard', tone: 'system', group: 'DRIVE' },
  { id: 'escape', label: 'Escape', tone: 'route', group: 'DRIVE' },
];

const commandDescriptions: Record<CommandId, { description: string }> = {
  main_gun: { description: '選択中のMain Gunで高火力単体攻撃。' },
  sub_gun: { description: '選択中のSub Gunで牽制射撃。' },
  se_harpoon: { description: '選択中S-Eを発動。S-E Ammoを消費。' },
  analyze: { description: 'Signal-1で敵情報を開示。' },
  talk: { description: '気質に応じて trust / interest / pressure を変化。' },
  contract: { description: '契約窓が開いた対象へ契約を試行。' },
  ram: { description: '体当たり3ダメージ。Armor-1。' },
  guard: { description: '次の被弾を軽減。' },
  escape: { description: 'Fuel-1で70%離脱。' },
};

const affinityOrder: AffinityType[] = ['ballistic', 'suppressive', 'impact', 'signal', 'talk'];
const affinityLabel: Record<AffinityType, string> = {
  ballistic: 'Ballistic',
  suppressive: 'Suppressive',
  impact: 'Impact',
  signal: 'Signal',
  talk: 'Talk',
};
const commandAffinityMap: Partial<Record<CommandId, AffinityType>> = {
  main_gun: 'ballistic',
  sub_gun: 'suppressive',
  ram: 'impact',
  se_harpoon: 'signal',
  talk: 'talk',
};
const defaultAffinity: DevilAffinity = {
  ballistic: 'normal',
  suppressive: 'normal',
  impact: 'normal',
  signal: 'normal',
  talk: 'normal',
};

const encounterProfiles: Record<EncounterId, { label: string; subtitle: string; threat: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL'; signal: string; contractable: boolean }> = {
  whisper_broker: { label: 'WHISPER BROKER', subtitle: 'A slim broker exchanging routes for promises.', threat: 'MED', signal: 'CONTRACT TRACE / VIOLET BAND', contractable: true },
  roadside_phone: { label: 'ROADSIDE PHONE', subtitle: 'Ringing public line with an impossible child voice.', threat: 'MED', signal: 'VOICE CARRIER / AM 666.0', contractable: true },
  pixie_shibuya_glow: { label: 'PIXIE // SHIBUYA GLOW', subtitle: 'Tiny city-light fairy that plays with lane signals.', threat: 'LOW', signal: 'STREETLIGHT FRACTAL / SOFT CHIME', contractable: true },
  foxfire_navi: { label: 'FOXFIRE NAVI', subtitle: 'Kitsunebi guide flickering between shrine lanes and flyovers.', threat: 'MED', signal: 'KITSUNEBI TRACE / ROUTE SPOOF', contractable: true },
  no_face_taxi_passenger: { label: 'NO-FACE TAXI PASSENGER', subtitle: 'A faceless rider waiting in the rear-view mirror.', threat: 'HIGH', signal: 'METER DRIFT / BLANK ID', contractable: true },
  silent_shape: { label: 'SILENT SHAPE', subtitle: 'A black mass that swallows engine noise.', threat: 'HIGH', signal: 'AUDIO NULL / EDGE BLUR', contractable: true },
  abandoned_ai_navi: { label: 'ABANDONED AI NAVI', subtitle: 'Cracked guidance unit with haunted pathing.', threat: 'LOW', signal: 'LEGACY BUS / GHOST ARROW', contractable: true },
  road_reaper: { label: 'ROAD REAPER', subtitle: 'Traffic marshal silhouette with terminal intent.', threat: 'CRITICAL', signal: 'HOSTILE SIGNAL / COLLISION VECTOR', contractable: false },
  toll_gate_saint: { label: 'TOLL GATE SAINT', subtitle: 'Armored toll keeper demanding passage.', threat: 'CRITICAL', signal: 'DEEP SIGNAL / TOLL DEMAND', contractable: true },
};

type DevilTemplate = {
  name: string;
  maxHp: number;
  temperament: Temperament;
  contractable: boolean;
  profile: EncounterId;
  targetModuleId?: ContractId;
  armored?: boolean;
  affinities: DevilAffinity;
};

const devilTemplates: Record<EncounterId, DevilTemplate> = {
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
    name: 'Toll Gate Saint', maxHp: 13, temperament: 'proud', contractable: true, profile: 'toll_gate_saint', armored: true,
    affinities: { ballistic: 'normal', suppressive: 'resist', impact: 'resist', signal: 'weak', talk: 'normal' },
  },
};

const rewardCatalog: RewardOption[] = [
  { id: 'fuel_cell', label: 'Fuel Cell', detail: 'Fuel +2', fuel: 2 },
  { id: 'armor_patch', label: 'Armor Patch', detail: 'Armor +2', armor: 2 },
  { id: 'signal_core', label: 'Signal Core', detail: 'Signal +1', signal: 1 },
  { id: 'cannon_shell', label: 'Cannon Shell', detail: 'Main Ammo +1', mainAmmo: 1 },
  { id: 'se_cell', label: 'S-E Cell', detail: 'S-E Ammo +1', seAmmo: 1 },
];

const emergencyRewardCatalog: RewardOption[] = [
  { id: 'fuel_kit', label: 'Emergency Fuel', detail: 'Fuel +1', fuel: 1 },
  { id: 'armor_kit', label: 'Emergency Armor', detail: 'Armor +1', armor: 1 },
  { id: 'ammo_kit', label: 'Emergency Shell', detail: 'Main Ammo +1', mainAmmo: 1 },
  { id: 'se_kit', label: 'Emergency S-E Cell', detail: 'S-E Ammo +1', seAmmo: 1 },
];

const storyLogCatalog: StoryLogEntry[] = [
  { id: 'LOG_00', title: 'Previous Driver', text: 'M.O.E., if you hear this, do not trust the toll gate.' },
  { id: 'LOG_01', title: 'Toll', text: 'The toll is not fuel, not a name. It is the will to return.' },
  { id: 'LOG_02', title: 'AM 666.0', text: 'AM 666.0 does not broadcast the future. It broadcasts the roads we did not choose.' },
  { id: 'LOG_03', title: 'Pixie', text: 'Small light always knew a path first. It was not always the right one.' },
  { id: 'LOG_04', title: 'M.O.E.', text: 'I am registered as a navigation AI. Then who recorded this voice?' },
];

const storyLogById: Record<StoryLogId, StoryLogEntry> = Object.fromEntries(
  storyLogCatalog.map((entry) => [entry.id, entry]),
) as Record<StoryLogId, StoryLogEntry>;

const createInitialStoryState = (): StoryState => ({
  chapter: 1,
  recoveredLogs: [],
  moeMemory: 0,
  previousDriverClues: 0,
  recentRecoveredLogs: [],
});

const defaultSkillLevels: SkillLevels = {
  ram_control: 0,
  gunnery: 0,
  scan_boost: 0,
  translation_assist: 0,
};

const defaultVehicleUpgrades: VehicleUpgradeLevels = {
  fuel_tank: 0,
  armor_plating: 0,
  ammo_rack: 0,
  se_rack: 0,
};

const skillLabels: Record<UpgradeId, string> = {
  ram_control: 'Driver: Ram Control',
  gunnery: 'Driver: Gunnery',
  scan_boost: 'M.O.E.: Scan Boost',
  translation_assist: 'M.O.E.: Translation Assist',
};

const vehicleUpgradeLabels: Record<VehicleUpgradeId, string> = {
  fuel_tank: 'Fuel Tank',
  armor_plating: 'Armor Plating',
  ammo_rack: 'Main Ammo Rack',
  se_rack: 'S-E Rack',
};

const hasAiNaviContract = (contracts: ContractModule[]) => contracts.some((module) => module.id === 'abandoned_ai_navi');

const getRunStartResources = (loadout: Loadout, vehicleUpgrades: VehicleUpgradeLevels = defaultVehicleUpgrades) => ({
  fuel: 12 + vehicleUpgrades.fuel_tank,
  armor: 12 + vehicleUpgrades.armor_plating,
  signal: 5,
  mainAmmo: mainGunCatalog[loadout.mainGunId].ammo + vehicleUpgrades.ammo_rack,
  maxMainAmmo: mainGunCatalog[loadout.mainGunId].ammo + vehicleUpgrades.ammo_rack,
  seAmmo: specialEquipmentCatalog[loadout.specialEquipmentId].ammo + vehicleUpgrades.se_rack,
  maxSeAmmo: specialEquipmentCatalog[loadout.specialEquipmentId].ammo + vehicleUpgrades.se_rack,
});

const lineupByKind = (kind: ApproachKind): EncounterId[] =>
  kind === 'enc1'
    ? ['pixie_shibuya_glow', 'whisper_broker']
    : kind === 'enc2'
      ? ['no_face_taxi_passenger', 'abandoned_ai_navi']
      : ['toll_gate_saint'];

const createEmptyEncounterPrep = (): EncounterPrep => ({
  firstStrike: false,
  ambushed: false,
  talkPrepared: false,
  intentDisrupted: false,
  firstTalkBonus: 0,
  firstTalkPending: false,
});

const getScanChance = (state: State, kind: ApproachKind, lineup: EncounterId[]): number => {
  let chance = 60;
  if (state.selectedLoadout.contractSupportId === 'abandoned_ai_navi') chance += 20;
  if (state.signal >= 4) chance += 10;
  if (kind === 'boss') chance -= 15;
  if (lineup.includes('silent_shape')) chance -= 15;
  chance += state.skillLevels.scan_boost * 5;
  return clamp(chance, 15, 95);
};

const nextIntent = (profile?: EncounterId): Intent => {
  const roll = Math.random();
  if (profile === 'toll_gate_saint') {
    if (roll < 0.25) return 'attack';
    if (roll < 0.55) return 'bargain';
    if (roll < 0.85) return 'guard';
    return 'curse';
  }
  if (roll < 0.4) return 'attack';
  if (roll < 0.62) return 'curse';
  if (roll < 0.8) return 'bargain';
  if (roll < 0.95) return 'guard';
  return 'flee';
};

const buildDevil = (kind: EncounterId, index: number): Devil => {
  const t = devilTemplates[kind];
  return {
    id: `${kind}-${index}`,
    name: t.name,
    maxHp: t.maxHp,
    hp: t.maxHp,
    temperament: t.temperament,
    intent: nextIntent(t.profile),
    contractable: t.contractable,
    revealed: false,
    targetModuleId: t.targetModuleId,
    trust: 0,
    pressure: 0,
    interest: 0,
    guardStacks: 0,
    contractWindow: false,
    armored: t.armored,
    affinities: { ...t.affinities },
    affinityRevealed: false,
    profile: t.profile,
    empDisabledTurns: 0,
  };
};

const buildForecast = (
  enemies: Devil[],
  hasAiNaviModule: boolean,
  supportId: ContractSupportId,
  extraTurns = 0,
): { forecast: ForecastMap; unstable: boolean } => {
  const supportTurns = supportId === 'abandoned_ai_navi' ? 1 : 0;
  const horizon = 1 + extraTurns + (hasAiNaviModule ? 2 : 0) + supportTurns;
  const forecast: ForecastMap = {};
  for (const enemy of enemies.filter(isAlive)) {
    forecast[enemy.id] = Array.from({ length: horizon }, () => nextIntent(enemy.profile));
  }
  const unstableSource = hasAiNaviModule || supportId === 'abandoned_ai_navi';
  const unstable = unstableSource && Math.random() < 0.2;
  if (unstable) {
    const ids = Object.keys(forecast);
    if (ids.length > 0) {
      const id = ids[Math.floor(Math.random() * ids.length)];
      const idx = Math.floor(Math.random() * forecast[id].length);
      const intents: Intent[] = ['attack', 'curse', 'bargain', 'guard', 'flee'];
      const alt = intents.filter((it) => it !== forecast[id][idx]);
      forecast[id][idx] = alt[Math.floor(Math.random() * alt.length)];
    }
  }
  return { forecast, unstable };
};

const buildEncounter = (
  kind: EncounterState['kind'],
  contracts: ContractModule[],
  supportId: ContractSupportId,
  extraForecast = 0,
): EncounterState => {
  const lineup: EncounterId[] =
    kind === 'enc1'
      ? ['pixie_shibuya_glow', 'whisper_broker']
      : kind === 'enc2'
        ? ['no_face_taxi_passenger', 'abandoned_ai_navi']
        : ['toll_gate_saint', 'foxfire_navi'];
  const enemies = lineup.map((id, i) => buildDevil(id, i));
  const { forecast, unstable } = buildForecast(enemies, hasAiNaviContract(contracts), supportId, extraForecast);
  return {
    kind,
    enemies,
    selectedEnemyId: enemies[0]?.id ?? '',
    selectedCommand: 'analyze',
    turn: 1,
    phase: 'command',
    guardActive: false,
    analyzedEnemyIds: [],
    forecast,
    forecastUnstable: unstable,
    supportArmorGuardReady: supportId === 'silent_shape',
  };
};

const getSelectedEnemy = (encounter: EncounterState): Devil | undefined =>
  encounter.enemies.find((enemy) => enemy.id === encounter.selectedEnemyId && enemy.hp > 0) ?? encounter.enemies.find(isAlive);

const canOpenContractWindow = (enemy: Devil) =>
  enemy.interest >= 2 || enemy.trust >= 2 || (enemy.trust >= 1 && enemy.interest >= 1) || (enemy.hp <= enemy.maxHp / 2 && enemy.pressure >= 1);

const meetsContractCondition = (enemy: Devil) =>
  enemy.contractWindow && (enemy.trust >= 2 || enemy.interest >= 2 || (enemy.hp <= enemy.maxHp / 2 && enemy.pressure >= 1));

const getContractHint = (enemy: Devil): string => {
  if (enemy.profile === 'toll_gate_saint') return 'Hint: trust>=2 or hp<=50% with pressure';
  if (enemy.temperament === 'hungry') return 'Hint: Offer / interest line';
  if (enemy.temperament === 'machine') return 'Hint: Logic / signal pin';
  if (enemy.temperament === 'lonely') return 'Hint: trust line';
  if (enemy.temperament === 'proud') return 'Hint: trust + pressure';
  if (enemy.temperament === 'curious') return 'Hint: interest + trust mix';
  return 'Hint: weaken then force contract window';
};

const routeIntelCatalog: Record<'salvage' | 'signal' | 'push_forward' | 'return_gate', {
  label: string;
  likelyEnemyTags: string;
  likelyWeaknesses: string;
  riskTags: string;
  rewardTags: string;
}> = {
  salvage: {
    label: 'Salvage Lane',
    likelyEnemyTags: 'machine spirit / roadside relic',
    likelyWeaknesses: 'Signal / Talk',
    riskTags: 'curse / attrition',
    rewardTags: 'Fuel / Armor / Main Ammo',
  },
  signal: {
    label: 'Signal Lane',
    likelyEnemyTags: 'urban legend / broadcast trace',
    likelyWeaknesses: 'Talk / Signal',
    riskTags: 'noise spike',
    rewardTags: 'Signal boost / NAVI clarity',
  },
  push_forward: {
    label: 'Push Forward',
    likelyEnemyTags: 'road entity / hostile lane',
    likelyWeaknesses: 'Ballistic / Impact',
    riskTags: 'high armor damage',
    rewardTags: 'higher salvage value',
  },
  return_gate: {
    label: 'Return Gate',
    likelyEnemyTags: 'no further contact',
    likelyWeaknesses: 'N/A',
    riskTags: 'lower payout',
    rewardTags: 'safe extraction',
  },
};

const bossIntel = {
  likelyEnemyTags: 'road entity / toll guardian',
  likelyWeaknesses: 'Signal / Ballistic',
  riskTags: 'guard / bargain / armor break',
  rewardTags: 'deep salvage / gate control',
};

const computeAffinityDamage = (baseDamage: number, rating: AffinityRating) => {
  if (baseDamage <= 0) return 0;
  if (rating === 'weak') return Math.max(1, Math.floor(baseDamage * 1.5));
  if (rating === 'resist') return Math.max(1, Math.floor(baseDamage * 0.5));
  return baseDamage;
};

const getAffinityTag = (rating: AffinityRating) => {
  if (rating === 'weak') return 'WEAK';
  if (rating === 'resist') return 'RESIST';
  return 'NORMAL';
};

const affinityToCommandLabel: Record<AffinityType, string> = {
  ballistic: 'Main Gun',
  suppressive: 'Sub Gun',
  impact: 'Ram',
  signal: 'S-E',
  talk: 'Talk',
};

const getLikelyWeaknessSummary = (profile: EncounterId): string => {
  const affinities = devilTemplates[profile].affinities;
  const weak = affinityOrder.filter((affinity) => affinities[affinity] === 'weak');
  if (weak.length === 0) return 'No clear weakness';
  return weak.map((affinity) => affinityToCommandLabel[affinity]).join(' / ');
};

const buildMoeActionLine = (action: string, result: string, target?: string) =>
  target ? `${target}へ${action}。${result}` : `${action}。${result}`;

const applyTalkTemperament = (enemy: Devil): Devil => {
  if (enemy.temperament === 'hungry') return { ...enemy, interest: enemy.interest + 2 };
  if (enemy.temperament === 'lonely') return { ...enemy, trust: enemy.trust + 2 };
  if (enemy.temperament === 'machine') return { ...enemy, interest: enemy.interest + 1, trust: enemy.trust + 1 };
  if (enemy.temperament === 'proud') return { ...enemy, trust: enemy.trust + 1, pressure: enemy.pressure + 1 };
  if (enemy.temperament === 'curious') return { ...enemy, interest: enemy.interest + 1, trust: enemy.trust + 1 };
  return { ...enemy, pressure: enemy.pressure + 1, interest: enemy.interest + 1 };
};

const makeEncounterReport = (wave: number, enemies: Devil[], escaped: boolean): EncounterReport => ({
  wave,
  defeated: enemies.filter((enemy) => enemy.exit === 'defeated').length,
  contracted: enemies.filter((enemy) => enemy.exit === 'contracted').length,
  fled: enemies.filter((enemy) => enemy.exit === 'fled').length,
  escaped,
});

const accumulateSummary = (summary: RunSummary, report: EncounterReport): RunSummary => ({
  cleared: summary.cleared + 1,
  defeated: summary.defeated + report.defeated,
  contracted: summary.contracted + report.contracted,
  escaped: summary.escaped + (report.escaped ? 1 : 0),
});

const classifyLog = (log: string): TerminalLogKind => {
  if (log.includes('CONTRACT') || log.includes('MODULE')) return 'contract';
  if (log.includes('ARMOR -') || log.includes('FUEL -') || log.includes('IMPACT') || log.includes('DAMAGE') || log.includes('DISABLED')) return 'damage';
  if (log.includes('WARNING') || log.includes('CURSE') || log.includes('ANOMALY')) return 'warning';
  if (log.includes('RUN START') || log.includes('ENCOUNTER') || log.includes('REWARD') || log.includes('RETURN GATE') || log.includes('FORECAST')) return 'route';
  return 'system';
};

const getLogBadge = (kind: TerminalLogKind) => {
  if (kind === 'warning') return 'WARN';
  if (kind === 'contract') return 'CNTR';
  if (kind === 'damage') return 'DMG';
  if (kind === 'route') return 'ROUTE';
  return 'SYS';
};

const getPseudoTimecode = (index: number, total: number, wave: number, turn: number) => {
  const recentStart = Math.max(0, total - 14);
  const localOrder = Math.max(0, index - recentStart);
  const elapsedSec = wave * 22 + Math.max(0, turn - 1) * 3 + localOrder * 0.6;
  return `+${elapsedSec.toFixed(1)}s`;
};

const initState = (): State => {
  const start = getRunStartResources(defaultLoadout, defaultVehicleUpgrades);
  return {
    gamePhase: 'prologue',
    fuel: start.fuel,
    armor: start.armor,
    signal: start.signal,
    mainAmmo: start.mainAmmo,
    maxMainAmmo: start.maxMainAmmo,
    seAmmo: start.seAmmo,
    maxSeAmmo: start.maxSeAmmo,
    contracts: [],
    logs: ['> DEVIL TERMINAL: ONLINE'],
    salvageCredits: 0,
    encounterIndex: 0,
    encounter: buildEncounter('enc1', [], defaultLoadout.contractSupportId),
    rewardOptions: rewardCatalog,
    rewardTarget: undefined,
    rewardScope: undefined,
    routeBoostReward: false,
    tempForecastBoost: 0,
    lastReport: undefined,
    runSummary: { cleared: 0, defeated: 0, contracted: 0, escaped: 0 },
    resultType: undefined,
    bossChallenged: false,
    moeLine: '午前0時。夜環、開いたよ。',
    selectedLoadout: defaultLoadout,
    previousRun: undefined,
    approach: undefined,
    encounterPrep: createEmptyEncounterPrep(),
    skillLevels: { ...defaultSkillLevels },
    vehicleUpgrades: { ...defaultVehicleUpgrades },
    driverXpBank: 1,
    moeSyncBank: 0,
    creditBank: 0,
    growthClaimed: false,
    analyzeSuccessCount: 0,
    story: createInitialStoryState(),
  };
};

const makePreviousRunSummary = (state: State, resultType: ResultType): PreviousRunSummary => ({
  resultType,
  encountersCleared: state.runSummary.cleared,
  bossChallenged: state.bossChallenged,
  contractsAcquired: state.runSummary.contracted,
  salvageGained: state.salvageCredits,
  fuel: state.fuel,
  armor: state.armor,
  signal: state.signal,
  mainAmmo: state.mainAmmo,
  seAmmo: state.seAmmo,
});

const getRunGrowth = (state: State) => {
  const isReturned = state.gamePhase === 'result';
  const driverXp = state.runSummary.cleared + ((state.resultType ?? 'Early Return') === 'Boss Cleared' ? 2 : 0);
  const moeSync = state.runSummary.contracted + state.analyzeSuccessCount;
  const salvageCreditGain = state.salvageCredits + (isReturned ? 1 : 0);
  return { driverXp, moeSync, salvageCreditGain };
};

const claimRunGrowthIfNeeded = (state: State): State => {
  if (state.growthClaimed || !(state.gamePhase === 'result' || state.gamePhase === 'game_over')) return state;
  const growth = getRunGrowth(state);
  return {
    ...state,
    driverXpBank: state.driverXpBank + growth.driverXp,
    moeSyncBank: state.moeSyncBank + growth.moeSync,
    creditBank: state.creditBank + growth.salvageCreditGain,
    growthClaimed: true,
  };
};

const getSkillCost = (currentLevel: number) => currentLevel + 1;
const getVehicleUpgradeCost = (currentLevel: number) => 2 + currentLevel;

const resolveStoryFromRun = (state: State, resultType: ResultType): StoryState => {
  const recovered = [...state.story.recoveredLogs];
  const newly: StoryLogId[] = [];
  const unlock = (id: StoryLogId) => {
    if (!recovered.includes(id)) {
      recovered.push(id);
      newly.push(id);
    }
  };

  if (resultType !== 'Vehicle Disabled') unlock('LOG_00');
  if (state.bossChallenged) unlock('LOG_01');
  if (state.bossChallenged && resultType !== 'Vehicle Disabled') unlock('LOG_02');
  if (state.contracts.some((module) => module.id === 'radio_voice')) unlock('LOG_03');
  if (state.contracts.some((module) => module.id === 'abandoned_ai_navi')) unlock('LOG_04');

  const chapter = recovered.length >= 4 ? 3 : recovered.length >= 2 ? 2 : 1;
  const clueBonus = newly.filter((id) => id === 'LOG_00' || id === 'LOG_01' || id === 'LOG_02').length;
  const memoryBonus = newly.filter((id) => id === 'LOG_04').length * 2 + newly.length;

  return {
    chapter,
    recoveredLogs: recovered,
    moeMemory: state.story.moeMemory + memoryBonus,
    previousDriverClues: state.story.previousDriverClues + clueBonus,
    recentRecoveredLogs: newly,
  };
};

const getNarrativeMoeLine = (state: State): string => {
  if (state.gamePhase === 'prologue') {
    return '午前0時。夜環、開いたよ。浅層サルベージ任務……ってことになってる。本命は、前任者のログ反応。まだ消えてない。';
  }
  if (state.story.recoveredLogs.includes('LOG_01') && state.gamePhase === 'boss_preview') {
    return '料金所の反応、前よりは読める。通行料を払う相手を間違えないで。';
  }
  if (state.story.recoveredLogs.includes('LOG_00') && state.gamePhase === 'garage') {
    return '前任者の声……記録には残ってない。でも、知ってる気がする。';
  }
  return state.moeLine;
};

const appendRecoveredStoryLogLines = (logs: string[], story: StoryState): string[] => {
  if (story.recentRecoveredLogs.length === 0) return logs;
  const out = [...logs, '> STORY LOG RECOVERED'];
  for (const id of story.recentRecoveredLogs) {
    out.push(`> ${id}: ${storyLogById[id].title.toUpperCase()}`);
  }
  return out;
};

const initRunWithLoadout = (state: State, logsPrefix: string[] = []): State => {
  const start = getRunStartResources(state.selectedLoadout, state.vehicleUpgrades);
  const lineup = lineupByKind('enc1');
  const scanChance = getScanChance({ ...state, signal: start.signal }, 'enc1', lineup);
  const scanSuccess = Math.random() * 100 < scanChance;
  let fuel = start.fuel;
  const logs = [...state.logs, ...logsPrefix, '> RUN START', '> NAVI SCAN START', '> SIGNAL SWEEP: NIGHT LOOP LANE'];
  if (scanSuccess) {
    logs.push('> CONTACT DETECTED', '> APPROACH WINDOW OPEN');
  } else {
    logs.push('> NAVI SCAN FAILED', '> AMBUSH WARNING');
  }
  if (state.selectedLoadout.contractSupportId === 'silent_shape' && Math.random() < 0.2) {
    fuel = Math.max(0, fuel - 1);
    logs.push('> SUPPORT BACKLASH: SILENT SHAPE / FUEL -1');
  }
  if (state.selectedLoadout.contractSupportId === 'radio_voice' && Math.random() < 0.35) logs.push('> WARNING: AM 666.0 CARRIER GHOST');
  return {
    ...state,
    gamePhase: 'approach',
    fuel,
    armor: start.armor,
    signal: start.signal,
    mainAmmo: start.mainAmmo,
    maxMainAmmo: start.maxMainAmmo,
    seAmmo: start.seAmmo,
    maxSeAmmo: start.maxSeAmmo,
    contracts: [],
    salvageCredits: 0,
    encounterIndex: 0,
    encounter: buildEncounter('enc1', [], state.selectedLoadout.contractSupportId),
    rewardOptions: rewardCatalog,
    rewardTarget: undefined,
    rewardScope: undefined,
    routeBoostReward: false,
    tempForecastBoost: 0,
    lastReport: undefined,
    runSummary: { cleared: 0, defeated: 0, contracted: 0, escaped: 0 },
    resultType: undefined,
    bossChallenged: false,
    approach: { pendingKind: 'enc1', scanSuccess, scanChance, lineup },
    encounterPrep: createEmptyEncounterPrep(),
    analyzeSuccessCount: 0,
    growthClaimed: false,
    story: { ...state.story, recentRecoveredLogs: [] },
    logs,
    moeLine: scanSuccess ? '先に見つけた。どう入る？' : 'ごめん、遅れた。来るよ。',
  };
};

const applyRewardOption = (state: State, option: RewardOption) => ({
  fuel: state.fuel + (option.fuel ?? 0),
  armor: state.armor + (option.armor ?? 0),
  signal: state.signal + (option.signal ?? 0),
  mainAmmo: Math.min(state.maxMainAmmo, state.mainAmmo + (option.mainAmmo ?? 0)),
  seAmmo: Math.min(state.maxSeAmmo, state.seAmmo + (option.seAmmo ?? 0)),
});

const chooseAutoplayReward = (state: State): RewardOption => {
  const options = state.rewardOptions;
  const lowArmor = state.armor <= 5;
  const lowFuel = state.fuel <= 3;
  const lowSignal = state.signal <= 2;
  const lowAmmo = state.mainAmmo <= 1;
  const lowSeAmmo = state.seAmmo <= 1;
  if (lowArmor) return options.find((r) => r.armor) ?? options[0];
  if (lowFuel) return options.find((r) => r.fuel) ?? options[0];
  if (lowSignal) return options.find((r) => r.signal) ?? options[0];
  if (lowSeAmmo) return options.find((r) => r.seAmmo) ?? options[0];
  if (lowAmmo) return options.find((r) => r.mainAmmo) ?? options[0];
  return options.find((r) => r.mainAmmo) ?? options[0];
};

const chooseAutoplayRoute = (state: State, strategy: AutoPlayStrategy): 'salvage' | 'signal' | 'push_forward' | 'return_gate' => {
  if (strategy === 'safe' && (state.armor <= 3 || state.fuel <= 2)) return 'return_gate';
  if (state.signal <= 2) return 'signal';
  if (state.armor <= 5 || state.fuel <= 3 || state.mainAmmo <= 1) return 'salvage';
  if (strategy === 'aggressive') return 'push_forward';
  if (strategy === 'contract') return 'signal';
  if (Math.random() < 0.35) return 'push_forward';
  return 'salvage';
};

const chooseAutoplayBossPreview = (state: State, strategy: AutoPlayStrategy): 'challenge' | 'emergency_salvage' | 'return_gate' => {
  if (strategy === 'safe' && (state.armor <= 4 || state.fuel <= 2)) return 'return_gate';
  if (state.mainAmmo <= 0 || state.seAmmo <= 0 || state.armor <= 4 || state.signal <= 1) return 'emergency_salvage';
  if (strategy === 'contract' && state.signal <= 2) return 'emergency_salvage';
  return 'challenge';
};

const chooseAutoplayCommand = (state: State, strategy: AutoPlayStrategy): CommandId => {
  const selected = getSelectedEnemy(state.encounter);
  const alive = state.encounter.enemies.filter(isAlive);
  if (!selected || alive.length === 0) return 'guard';
  const mainGun = mainGunCatalog[state.selectedLoadout.mainGunId];
  const se = specialEquipmentCatalog[state.selectedLoadout.specialEquipmentId];

  if (selected.contractWindow && selected.contractable) return 'contract';
  if ((!selected.revealed || !state.encounter.analyzedEnemyIds.includes(selected.id)) && state.signal > 0) return 'analyze';
  if (strategy === 'contract' && selected.contractable && selected.pressure <= 2 && !selected.contractWindow) {
    if (state.seAmmo >= se.seAmmoCost) return 'se_harpoon';
    return 'talk';
  }
  if (selected.contractable && selected.pressure <= 1 && selected.hp > 2 && Math.random() < 0.35) return 'talk';
  if (state.gamePhase === 'boss_encounter' && state.mainAmmo > 0) return 'main_gun';
  if (state.mainAmmo > 0 && selected.hp >= mainGun.damage) return 'main_gun';
  if (alive.length >= 2) return 'sub_gun';
  if (state.seAmmo >= se.seAmmoCost && selected.hp > 1) return 'se_harpoon';
  if (state.armor <= 3 && state.fuel > 0 && Math.random() < 0.4) return 'escape';
  if (state.mainAmmo > 0) return 'main_gun';
  if (state.seAmmo >= se.seAmmoCost) return 'se_harpoon';
  if (state.armor > 1) return 'ram';
  return 'guard';
};

const runAutoplayBatch = (loadout: Loadout, runs: number, strategy: AutoPlayStrategy): AutoPlayReport => {
  const total = Math.max(1, Math.min(1000, Math.floor(runs)));
  const counts: Record<ResultType, number> = {
    'Early Return': 0,
    'Boss Cleared': 0,
    'Boss Avoided': 0,
    'Vehicle Disabled': 0,
  };
  let sumEncounters = 0;
  let sumContracts = 0;
  let sumSalvage = 0;
  let sumFuel = 0;
  let sumArmor = 0;
  let sumSignal = 0;
  let sumMainAmmo = 0;
  let sumSeAmmo = 0;

  for (let i = 0; i < total; i += 1) {
    let s = initState();
    s = { ...s, gamePhase: 'garage', selectedLoadout: { ...loadout }, logs: [] };
    s = reducer(s, { type: 'GARAGE_ENTER_RUN' });
    let guard = 0;
    while (guard < 800 && !(s.gamePhase === 'result' || s.gamePhase === 'game_over')) {
      if (s.gamePhase === 'approach') {
        if (s.approach?.scanSuccess) {
          const choice: ApproachOption =
            strategy === 'aggressive'
              ? 'preemptive_main_gun'
              : strategy === 'contract'
                ? (s.signal > 0 ? 'open_channel' : 'silent_coast')
                : strategy === 'safe'
                  ? 'silent_coast'
                  : (s.mainAmmo > 0 ? 'preemptive_main_gun' : 'silent_coast');
          s = reducer(s, { type: 'APPROACH_CHOOSE', option: choice });
        } else {
          s = reducer(s, { type: 'APPROACH_CONTINUE' });
        }
      } else if (s.gamePhase === 'encounter' || s.gamePhase === 'boss_encounter') {
        const command = chooseAutoplayCommand(s, strategy);
        s = reducer(s, { type: 'EXECUTE_COMMAND', command });
      } else if (s.gamePhase === 'reward') {
        s = reducer(s, { type: 'REWARD_CONTINUE' });
      } else if (s.gamePhase === 'route_choice') {
        s = reducer(s, { type: 'ROUTE_CHOICE', lane: chooseAutoplayRoute(s, strategy) });
      } else if (s.gamePhase === 'salvage') {
        const reward = chooseAutoplayReward(s);
        s = reducer(s, { type: 'SALVAGE_PICK', rewardId: reward.id });
      } else if (s.gamePhase === 'signal') {
        s = reducer(s, { type: 'SIGNAL_CONTINUE' });
      } else if (s.gamePhase === 'boss_preview') {
        s = reducer(s, { type: 'BOSS_PREVIEW_CHOICE', choice: chooseAutoplayBossPreview(s, strategy) });
      } else if (s.gamePhase === 'return_gate') {
        s = reducer(s, { type: 'RETURN_TO_SURFACE' });
      } else if (s.gamePhase === 'prologue') {
        s = reducer(s, { type: 'START_ENGINE' });
      } else {
        break;
      }
      guard += 1;
    }
    const result = s.resultType ?? (s.gamePhase === 'game_over' ? 'Vehicle Disabled' : 'Early Return');
    counts[result] += 1;
    sumEncounters += s.runSummary.cleared;
    sumContracts += s.runSummary.contracted;
    sumSalvage += s.salvageCredits;
    sumFuel += s.fuel;
    sumArmor += s.armor;
    sumSignal += s.signal;
    sumMainAmmo += s.mainAmmo;
    sumSeAmmo += s.seAmmo;
  }

  return {
    runs: total,
    strategy,
    winRate: ((counts['Boss Cleared'] + counts['Boss Avoided'] + counts['Early Return']) / total) * 100,
    avgEncounters: sumEncounters / total,
    avgContracts: sumContracts / total,
    avgSalvage: sumSalvage / total,
    avgFuel: sumFuel / total,
    avgArmor: sumArmor / total,
    avgSignal: sumSignal / total,
    avgMainAmmo: sumMainAmmo / total,
    avgSeAmmo: sumSeAmmo / total,
    counts,
  };
};

function reducer(state: State, action: Action): State {
  if (action.type === 'RETRY') {
    const claimed = claimRunGrowthIfNeeded(state);
    const fresh = initState();
    return {
      ...fresh,
      gamePhase: 'prologue',
      selectedLoadout: claimed.selectedLoadout,
      story: claimed.story,
      skillLevels: claimed.skillLevels,
      vehicleUpgrades: claimed.vehicleUpgrades,
      driverXpBank: claimed.driverXpBank,
      moeSyncBank: claimed.moeSyncBank,
      creditBank: claimed.creditBank,
    };
  }

  if (action.type === 'START_NEXT_RUN') {
    if (!(state.gamePhase === 'result' || state.gamePhase === 'game_over')) return state;
    const claimed = claimRunGrowthIfNeeded(state);
    return {
      ...claimed,
      gamePhase: 'garage',
      previousRun: makePreviousRunSummary(claimed, claimed.resultType ?? 'Early Return'),
      logs: [...claimed.logs, '> GARAGE: MIDNIGHT BAY ONLINE'],
      moeLine: '戻れたね。次は出る前に少し積み替えよっか。',
    };
  }

  if (action.type === 'OPEN_GARAGE') {
    if (!(state.gamePhase === 'prologue' || state.gamePhase === 'result' || state.gamePhase === 'game_over' || state.gamePhase === 'garage')) return state;
    const claimed = claimRunGrowthIfNeeded(state);
    const previousRun = claimed.gamePhase === 'result' || claimed.gamePhase === 'game_over'
      ? makePreviousRunSummary(claimed, claimed.resultType ?? 'Early Return')
      : claimed.previousRun;
    return {
      ...claimed,
      gamePhase: 'garage',
      previousRun,
      logs: [...claimed.logs, '> GARAGE: MIDNIGHT BAY ONLINE'],
      moeLine: '戻れたね。次は出る前に少し積み替えよっか。',
    };
  }

  if (action.type === 'GARAGE_SET_MAIN_GUN') {
    if (state.gamePhase !== 'garage') return state;
    return {
      ...state,
      selectedLoadout: { ...state.selectedLoadout, mainGunId: action.id },
      moeLine: '主砲を重くするとBossは楽。でも弾切れは早いよ。',
    };
  }

  if (action.type === 'GARAGE_SET_SUB_GUN') {
    if (state.gamePhase !== 'garage') return state;
    return {
      ...state,
      selectedLoadout: { ...state.selectedLoadout, subGunId: action.id },
      moeLine: '副砲は戦い方が出る。牽制か、手数か。',
    };
  }

  if (action.type === 'GARAGE_SET_SPECIAL') {
    if (state.gamePhase !== 'garage') return state;
    return {
      ...state,
      selectedLoadout: { ...state.selectedLoadout, specialEquipmentId: action.id },
      moeLine: 'S-Eは切り札。契約狙いか、殲滅寄りか選んで。',
    };
  }

  if (action.type === 'GARAGE_SET_SUPPORT') {
    if (state.gamePhase !== 'garage') return state;
    return {
      ...state,
      selectedLoadout: { ...state.selectedLoadout, contractSupportId: action.id },
      moeLine: '契約サポートは一つだけ。何を車に残す？',
    };
  }

  if (action.type === 'GARAGE_ENTER_RUN') {
    if (state.gamePhase !== 'garage') return state;
    return initRunWithLoadout(state, [
      '> GARAGE: MIDNIGHT BAY ONLINE',
      `> MAIN GUN SELECTED: ${mainGunCatalog[state.selectedLoadout.mainGunId].name.toUpperCase()}`,
      `> SUB GUN SELECTED: ${subGunCatalog[state.selectedLoadout.subGunId].name.toUpperCase()}`,
      `> S-E SELECTED: ${specialEquipmentCatalog[state.selectedLoadout.specialEquipmentId].name.toUpperCase()}`,
      `> CONTRACT SUPPORT: ${contractSupportCatalog[state.selectedLoadout.contractSupportId].name.toUpperCase()}`,
      '> DEEP SIGNAL DETECTED: TOLL GATE SAINT',
    ]);
  }

  const moveToApproach = (
    nextState: State,
    kind: ApproachKind,
    extraLogs: string[] = [],
  ): State => {
    const lineup = lineupByKind(kind);
    const scanChance = getScanChance(nextState, kind, lineup);
    const scanSuccess = Math.random() * 100 < scanChance;
    const logs = [...nextState.logs, ...extraLogs, '> NAVI SCAN START', '> SIGNAL SWEEP: NIGHT LOOP LANE'];
    if (scanSuccess) {
      logs.push('> CONTACT DETECTED', '> APPROACH WINDOW OPEN');
    } else {
      logs.push('> NAVI SCAN FAILED', '> AMBUSH WARNING');
    }
    return {
      ...nextState,
      gamePhase: 'approach',
      approach: { pendingKind: kind, scanSuccess, scanChance, lineup },
      encounterPrep: createEmptyEncounterPrep(),
      logs,
      moeLine: scanSuccess
        ? kind === 'boss'
          ? '強い反応。見えてるけど、近づき方は選べる。'
          : '先に見つけた。どう入る？'
        : 'ごめん、遅れた。来るよ。',
    };
  };

  const createEncounterFromApproach = (baseState: State): State => {
    if (!baseState.approach) return baseState;
    const kind = baseState.approach.pendingKind;
    const encounter = buildEncounter(kind, baseState.contracts, baseState.selectedLoadout.contractSupportId, baseState.tempForecastBoost);
    let fuel = baseState.fuel;
    let armor = baseState.armor;
    let signal = baseState.signal;
    let mainAmmo = baseState.mainAmmo;
    let seAmmo = baseState.seAmmo;
    const logs = [...baseState.logs];
    const prep = { ...baseState.encounterPrep };

    if (!baseState.approach.scanSuccess) {
      const enemyIdx = encounter.enemies.findIndex(isAlive);
      if (enemyIdx >= 0) {
        encounter.enemies[enemyIdx].intent = 'attack';
        encounter.enemies[enemyIdx].pressure += 1;
      }
      if (Math.random() < 0.5) {
        armor = Math.max(0, armor - 1);
        logs.push('> AMBUSH CONTACT', '> ARMOR -1');
      } else {
        signal = Math.max(0, signal - 1);
        logs.push('> AMBUSH CONTACT', '> SIGNAL -1');
      }
      prep.ambushed = true;
      prep.approachLabel = 'AMBUSHED';
      prep.intentDisrupted = false;
      prep.firstTalkBonus = baseState.skillLevels.translation_assist * 0.03;
      prep.firstTalkPending = prep.firstTalkBonus > 0;
      if (armor <= 0 || fuel <= 0) {
        const resultType: ResultType = 'Vehicle Disabled';
        const story = resolveStoryFromRun(baseState, resultType);
        return {
          ...baseState,
          fuel,
          armor,
          signal,
          logs: appendRecoveredStoryLogLines([...logs, '> SIGNAL LOST', '> VEHICLE DISABLED'], story),
          gamePhase: 'game_over',
          resultType,
          story,
          approach: undefined,
          encounterPrep: prep,
        };
      }
      return {
        ...baseState,
        gamePhase: kind === 'boss' ? 'boss_encounter' : 'encounter',
        encounterIndex: kind === 'enc1' ? 0 : kind === 'enc2' ? 1 : 2,
        encounter,
        fuel,
        armor,
        signal,
        mainAmmo,
        seAmmo,
        encounterPrep: prep,
        logs,
        moeLine: '見落とした。ごめん、初撃来る。',
        approach: undefined,
      };
    }

    return {
      ...baseState,
      gamePhase: kind === 'boss' ? 'boss_encounter' : 'encounter',
      encounterIndex: kind === 'enc1' ? 0 : kind === 'enc2' ? 1 : 2,
      encounter,
      fuel,
      armor,
      signal,
      mainAmmo,
      seAmmo,
      encounterPrep: {
        ...prep,
        firstTalkBonus: prep.firstTalkBonus + baseState.skillLevels.translation_assist * 0.03,
        firstTalkPending: prep.firstTalkPending || baseState.skillLevels.translation_assist > 0,
      },
      logs: [...logs, '> NAVI FORECAST UPDATED'],
      moeLine: '接触。コマンド選択へ。',
      approach: undefined,
    };
  };

  if (action.type === 'APPROACH_CONTINUE') {
    if (state.gamePhase !== 'approach' || !state.approach) return state;
    return createEncounterFromApproach(state);
  }

  if (action.type === 'APPROACH_CHOOSE') {
    if (state.gamePhase !== 'approach' || !state.approach?.scanSuccess) return state;
    const kind = state.approach.pendingKind;
    const encounter = buildEncounter(kind, state.contracts, state.selectedLoadout.contractSupportId, state.tempForecastBoost);
    let fuel = state.fuel;
    let armor = state.armor;
    let signal = state.signal;
    let mainAmmo = state.mainAmmo;
    let seAmmo = state.seAmmo;
    let salvageCredits = state.salvageCredits;
    const logs = [...state.logs];
    const prep = createEmptyEncounterPrep();
    const baseTalkBonus = state.skillLevels.translation_assist * 0.03;

    if (action.option === 'preemptive_main_gun') {
      if (mainAmmo <= 0) return { ...state, logs: [...state.logs, '> WARNING: MAIN AMMO EMPTY'], moeLine: '主砲弾がない。別の入り方にして。' };
      const target = encounter.enemies.findIndex(isAlive);
      if (target >= 0) {
        mainAmmo -= 1;
        const gunDmg = mainGunCatalog[state.selectedLoadout.mainGunId].damage + state.skillLevels.gunnery;
        encounter.enemies[target].hp = Math.max(0, encounter.enemies[target].hp - gunDmg);
        encounter.enemies[target].pressure += 1;
        encounter.enemies[target].intent = 'guard';
        if (encounter.enemies[target].hp <= 0 && !encounter.enemies[target].exit) {
          encounter.enemies[target].exit = 'defeated';
          salvageCredits += 1;
        }
      }
      logs.push('> APPROACH: PREEMPTIVE MAIN GUN', '> FIRST STRIKE CONFIRMED');
      prep.firstStrike = true;
      prep.intentDisrupted = true;
      prep.approachLabel = 'FIRST STRIKE';
    }

    if (action.option === 'hit_and_run_ram') {
      armor = Math.max(0, armor - 1);
      fuel = Math.max(0, fuel - 1);
      logs.push('> APPROACH: HIT-AND-RUN RAM', '> CHASSIS IMPACT');
      const successRate = clamp(0.6 + state.skillLevels.ram_control * 0.05, 0.6, 0.9);
      if (Math.random() < successRate) {
        logs.push('> BYPASS SUCCESS');
        const clearedEncounter = {
          ...encounter,
          enemies: encounter.enemies.map((enemy) => ({ ...enemy, hp: 0, exit: enemy.exit ?? 'fled' })),
          phase: 'finished' as const,
        };
        const report = makeEncounterReport(kind === 'enc1' ? 1 : kind === 'enc2' ? 2 : 3, clearedEncounter.enemies, true);
        const summary = accumulateSummary(state.runSummary, report);
        if (kind === 'boss') {
          return {
            ...state,
            fuel,
            armor,
            signal,
            mainAmmo,
            seAmmo,
            salvageCredits,
            logs,
            runSummary: summary,
            lastReport: report,
            encounter: clearedEncounter,
            encounterPrep: { ...prep, approachLabel: 'BYPASS' },
            gamePhase: 'return_gate',
            resultType: 'Boss Avoided',
            moeLine: 'ひき逃げ成功。突破した。',
            approach: undefined,
          };
        }
        return {
          ...state,
          fuel,
          armor,
          signal,
          mainAmmo,
          seAmmo,
          salvageCredits,
          logs,
          runSummary: summary,
          lastReport: report,
          encounter: clearedEncounter,
          encounterPrep: { ...prep, approachLabel: 'BYPASS' },
          gamePhase: 'reward',
          rewardScope: kind === 'enc1' ? 'post_enc1' : 'post_enc2',
          moeLine: 'ひき逃げ成功。接敵を回避した。',
          approach: undefined,
        };
      }
      logs.push('> BYPASS FAILED');
      encounter.enemies = encounter.enemies.map((enemy) => (isAlive(enemy) ? { ...enemy, pressure: enemy.pressure + 1 } : enemy));
      prep.approachLabel = 'BYPASS FAILED';
    }

    if (action.option === 'silent_coast') {
      fuel = Math.max(0, fuel - 1);
      encounter.enemies = encounter.enemies.map((enemy) => (enemy.intent === 'attack' ? { ...enemy, intent: 'guard' } : enemy));
      prep.talkPrepared = true;
      prep.intentDisrupted = true;
      prep.firstTalkBonus = 0.1 + baseTalkBonus;
      prep.firstTalkPending = true;
      prep.approachLabel = 'TALK BOOST';
      logs.push('> APPROACH: SILENT COAST', '> ENGINE NOISE SUPPRESSED', '> TALK CHANNEL STABLE');
    }

    if (action.option === 'open_channel') {
      if (signal <= 0) return { ...state, logs: [...state.logs, '> WARNING: SIGNAL TOO LOW'], moeLine: 'Signalが足りない。' };
      signal = Math.max(0, signal - 1);
      const target = encounter.enemies.findIndex(isAlive);
      if (target >= 0) {
        encounter.enemies[target].interest += 1;
        if (encounter.enemies[target].temperament === 'hostile') encounter.enemies[target].pressure += 1;
      }
      prep.firstTalkBonus = 0.2 + baseTalkBonus;
      prep.firstTalkPending = true;
      prep.talkPrepared = true;
      prep.approachLabel = 'OPEN CHANNEL';
      logs.push('> APPROACH: OPEN CHANNEL', '> NEGOTIATION CHANNEL PRE-OPENED');
    }

    if (prep.firstTalkBonus === 0 && baseTalkBonus > 0) {
      prep.firstTalkBonus = baseTalkBonus;
      prep.firstTalkPending = true;
    }

    const { forecast, unstable } = buildForecast(encounter.enemies, hasAiNaviContract(state.contracts), state.selectedLoadout.contractSupportId, state.tempForecastBoost);
    encounter.forecast = forecast;
    encounter.forecastUnstable = unstable;
    encounter.phase = 'command';
    logs.push('> NAVI FORECAST UPDATED');
    if (unstable) logs.push('> WARNING: FORECAST RELIABILITY UNSTABLE');

    return {
      ...state,
      fuel,
      armor,
      signal,
      mainAmmo,
      seAmmo,
      salvageCredits,
      gamePhase: kind === 'boss' ? 'boss_encounter' : 'encounter',
      encounterIndex: kind === 'enc1' ? 0 : kind === 'enc2' ? 1 : 2,
      encounter,
      encounterPrep: prep,
      approach: undefined,
      logs,
      moeLine:
        action.option === 'preemptive_main_gun'
          ? '先に撃つ。交渉は少し荒れるよ。'
          : action.option === 'hit_and_run_ram'
            ? 'ひき逃げルート。成功すれば早いけど、車体は削れるよ。'
            : action.option === 'silent_coast'
              ? '静かに寄る。話すならこれが一番マシ。'
              : '先に声をかけるね。返事が人間向けとは限らないけど。',
    };
  }

  if (action.type === 'PURCHASE_SKILL') {
    if (state.gamePhase !== 'garage') return state;
    const currentLevel = state.skillLevels[action.upgrade];
    const cost = getSkillCost(currentLevel);
    const isMoeSkill = action.upgrade === 'scan_boost' || action.upgrade === 'translation_assist';
    if (isMoeSkill) {
      if (state.moeSyncBank < cost) return state;
      return {
        ...state,
        moeSyncBank: state.moeSyncBank - cost,
        skillLevels: { ...state.skillLevels, [action.upgrade]: currentLevel + 1 },
        logs: [...state.logs, `> SKILL UPGRADE: ${action.upgrade.toUpperCase()} Lv${currentLevel + 1}`],
        moeLine: '同期率を使って調整した。次Runで効く。',
      };
    }
    if (state.driverXpBank < cost) return state;
    return {
      ...state,
      driverXpBank: state.driverXpBank - cost,
      skillLevels: { ...state.skillLevels, [action.upgrade]: currentLevel + 1 },
      logs: [...state.logs, `> SKILL UPGRADE: ${action.upgrade.toUpperCase()} Lv${currentLevel + 1}`],
      moeLine: '操縦技能を更新。次Runの反応が変わるはず。',
    };
  }

  if (action.type === 'PURCHASE_VEHICLE_UPGRADE') {
    if (state.gamePhase !== 'garage') return state;
    const currentLevel = state.vehicleUpgrades[action.id];
    const cost = getVehicleUpgradeCost(currentLevel);
    if (state.creditBank < cost) return state;
    return {
      ...state,
      creditBank: state.creditBank - cost,
      vehicleUpgrades: { ...state.vehicleUpgrades, [action.id]: currentLevel + 1 },
      logs: [...state.logs, `> VEHICLE TUNE: ${action.id.toUpperCase()} Lv${currentLevel + 1}`],
      moeLine: '改装完了。車体側の余裕が増える。',
    };
  }

  if (action.type === 'ADVANCE_PROLOGUE') {
    if (state.gamePhase !== 'prologue') return state;
    return state;
  }

  if (action.type === 'START_ENGINE') {
    if (state.gamePhase !== 'prologue') return state;
    return initRunWithLoadout(state, ['> RUN START: SHALLOW NIGHT LOOP SALVAGE', '> ENGINE START', '> NIGHT LOOP ENTRY CONFIRMED']);
  }

  if (action.type === 'REWARD_CONTINUE') {
    if (state.gamePhase !== 'reward') return state;
    if (state.rewardScope === 'post_enc1') {
      return { ...state, gamePhase: 'route_choice', logs: [...state.logs, '> ROUTE CHOICE AVAILABLE'], moeLine: '次の車線を選んで。補給・信号強化・強行突破・帰還、どれも正解になり得る。' };
    }
    return { ...state, gamePhase: 'boss_preview', logs: [...state.logs, '> DEEP SIGNAL DETECTED: TOLL GATE SAINT'], moeLine: '料金所型の強い反応。無理なら引き返そ。' };
  }

  if (action.type === 'ROUTE_CHOICE') {
    if (state.gamePhase !== 'route_choice') return state;
    if (action.lane === 'return_gate') {
      const resultType: ResultType = 'Early Return';
      const story = resolveStoryFromRun(state, resultType);
      return {
        ...state,
        gamePhase: 'result',
        resultType,
        story,
        logs: appendRecoveredStoryLogLines([...state.logs, '> RETURN GATE ROUTE OPEN', '> RUN COMPLETE'], story),
        moeLine: '帰るのも仕事だよ。持ち帰れなきゃ、全部ゼロ。',
      };
    }
    if (action.lane === 'salvage') {
      return {
        ...state,
        gamePhase: 'salvage',
        rewardTarget: 'encounter2',
        rewardOptions: rewardCatalog,
        logs: [...state.logs, '> SALVAGE LANE SELECTED'],
        moeLine: '補給反応あり。ひとつだけ拾える。',
      };
    }
    if (action.lane === 'signal') {
      const signalGain = state.selectedLoadout.contractSupportId === 'radio_voice' ? 2 : 1;
      const forecastGain = state.selectedLoadout.contractSupportId === 'radio_voice' ? 2 : 1;
      const signalLogs = [...state.logs, '> SIGNAL LANE SELECTED', `> SIGNAL +${signalGain}`];
      if (state.selectedLoadout.contractSupportId === 'radio_voice' && Math.random() < 0.4) signalLogs.push('> WARNING: AM 666.0 FALSE CARRIER');
      return {
        ...state,
        gamePhase: 'signal',
        signal: state.signal + signalGain,
        tempForecastBoost: forecastGain,
        logs: signalLogs,
        moeLine: '信号帯がクリアになった。次の予測が少し長く見える。',
      };
    }
    const logs = [...state.logs, '> PUSH FORWARD SELECTED', '> ENCOUNTER 2: FORWARD CONTACT'];
    let fuel = state.fuel;
    if (state.selectedLoadout.contractSupportId === 'silent_shape' && Math.random() < 0.2) {
      fuel = Math.max(0, fuel - 1);
      logs.push('> SUPPORT BACKLASH: SILENT SHAPE / FUEL -1');
    }
    return moveToApproach({
      ...state,
      fuel,
      routeBoostReward: true,
      logs,
      encounterIndex: 1,
      moeLine: '回復なしで進むのね。報酬は少し盛れるかも。',
    }, 'enc2');
  }

  if (action.type === 'SALVAGE_PICK') {
    if (state.gamePhase !== 'salvage') return state;
    const selected = state.rewardOptions.find((reward) => reward.id === action.rewardId);
    if (!selected) return state;
    const patched = applyRewardOption(state, selected);
    const toBoss = state.rewardTarget === 'boss';
    const logs = [...state.logs, `> SALVAGE APPLIED: ${selected.label.toUpperCase()}`, `> ${toBoss ? 'BOSS CONTACT' : 'ENCOUNTER 2: SIGNAL CONTACT'}`];
    let fuel = patched.fuel;
    if (state.selectedLoadout.contractSupportId === 'silent_shape' && Math.random() < 0.2) {
      fuel = Math.max(0, fuel - 1);
      logs.push('> SUPPORT BACKLASH: SILENT SHAPE / FUEL -1');
    }
    return moveToApproach({
      ...state,
      ...patched,
      fuel,
      rewardTarget: undefined,
      tempForecastBoost: 0,
      logs,
      bossChallenged: toBoss ? true : state.bossChallenged,
      encounterIndex: toBoss ? 2 : 1,
      moeLine: toBoss ? '応急補給完了。Toll Gate Saintへ向かう。' : '補給完了。次の区画へ。',
    }, toBoss ? 'boss' : 'enc2');
  }

  if (action.type === 'SIGNAL_CONTINUE') {
    if (state.gamePhase !== 'signal') return state;
    const logs = [...state.logs, '> ENCOUNTER 2: SIGNAL CONTACT'];
    let fuel = state.fuel;
    if (state.selectedLoadout.contractSupportId === 'silent_shape' && Math.random() < 0.2) {
      fuel = Math.max(0, fuel - 1);
      logs.push('> SUPPORT BACKLASH: SILENT SHAPE / FUEL -1');
    }
    return moveToApproach({
      ...state,
      fuel,
      encounterIndex: 1,
      tempForecastBoost: 0,
      logs,
      moeLine: 'Signal強化、効いてる。次の反応へ。',
    }, 'enc2');
  }

  if (action.type === 'BOSS_PREVIEW_CHOICE') {
    if (state.gamePhase !== 'boss_preview') return state;
    if (action.choice === 'return_gate') {
      const resultType: ResultType = 'Boss Avoided';
      const story = resolveStoryFromRun(state, resultType);
      return {
        ...state,
        gamePhase: 'result',
        resultType,
        story,
        logs: appendRecoveredStoryLogLines([...state.logs, '> RETURN GATE ROUTE OPEN', '> RUN COMPLETE'], story),
        moeLine: '引き返す判断、正解。持ち帰ることが最優先。',
      };
    }
    if (action.choice === 'emergency_salvage') {
      return {
        ...state,
        gamePhase: 'salvage',
        rewardTarget: 'boss',
        rewardOptions: state.routeBoostReward
          ? emergencyRewardCatalog.map((reward) => (reward.mainAmmo ? { ...reward, detail: 'Main Ammo +2', mainAmmo: 2 } : reward))
          : emergencyRewardCatalog,
        logs: [...state.logs, '> EMERGENCY SALVAGE OPEN'],
        moeLine: '主砲弾か装甲を足してから行ける。選んで。',
      };
    }
    const logs = [...state.logs, '> BOSS ENCOUNTER: TOLL GATE SAINT'];
    let fuel = state.fuel;
    if (state.selectedLoadout.contractSupportId === 'silent_shape' && Math.random() < 0.2) {
      fuel = Math.max(0, fuel - 1);
      logs.push('> SUPPORT BACKLASH: SILENT SHAPE / FUEL -1');
    }
    return moveToApproach({
      ...state,
      fuel,
      encounterIndex: 2,
      bossChallenged: true,
      tempForecastBoost: 0,
      logs,
      moeLine: '深層料金所、突入。主砲を温存しすぎないで。',
    }, 'boss');
  }

  if (action.type === 'RETURN_TO_SURFACE') {
    if (state.gamePhase !== 'return_gate') return state;
    const resultType = state.resultType ?? 'Boss Cleared';
    const story = resolveStoryFromRun(state, resultType);
    return {
      ...state,
      gamePhase: 'result',
      resultType,
      story,
      logs: appendRecoveredStoryLogLines([...state.logs, '> RUN COMPLETE'], story),
      moeLine: '帰れたね。積んだもの、確認しよっか。',
    };
  }

  if (action.type === 'SELECT_ENEMY') {
    if (!(state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') || state.encounter.phase !== 'command') return state;
    const target = state.encounter.enemies.find((enemy) => enemy.id === action.enemyId && enemy.hp > 0);
    if (!target) return state;
    return { ...state, encounter: { ...state.encounter, selectedEnemyId: action.enemyId } };
  }

  if (action.type === 'SELECT_COMMAND') {
    if (!(state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') || state.encounter.phase !== 'command') return state;
    return { ...state, encounter: { ...state.encounter, selectedCommand: action.command } };
  }

  if (action.type !== 'EXECUTE_COMMAND' || !(state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') || state.encounter.phase !== 'command') return state;

  const encounter: EncounterState = {
    ...state.encounter,
    enemies: state.encounter.enemies.map((enemy) => ({ ...enemy })),
    analyzedEnemyIds: [...state.encounter.analyzedEnemyIds],
    phase: 'resolving',
  };
  const command = action.command ?? encounter.selectedCommand;
  encounter.selectedCommand = command;
  const selectedEnemy = getSelectedEnemy(encounter);
  const logs = [...state.logs];
  let fuel = state.fuel;
  let armor = state.armor;
  let signal = state.signal;
  let mainAmmo = state.mainAmmo;
  let seAmmo = state.seAmmo;
  let contracts = [...state.contracts];
  let salvageCredits = state.salvageCredits;
  let analyzeSuccessCount = state.analyzeSuccessCount;
  const encounterPrep = { ...state.encounterPrep };
  let moeLine = '次の手を選んで。';
  let skipEnemyResolution = false;
  let escaped = false;
  const selectedMainGun = mainGunCatalog[state.selectedLoadout.mainGunId];
  const selectedSubGun = subGunCatalog[state.selectedLoadout.subGunId];
  const selectedSE = specialEquipmentCatalog[state.selectedLoadout.specialEquipmentId];
  const logAffinityReaction = (enemy: Devil, affinityType: AffinityType) => {
    const rating = enemy.affinities[affinityType];
    if (rating === 'weak') {
      logs.push(`> WEAK POINT DETECTED: ${affinityType.toUpperCase()}`);
    } else if (rating === 'resist') {
      logs.push(`> RESISTED: ${affinityType.toUpperCase()}`);
    }
    return rating;
  };

  logs.push(`> COMMAND: ${command.toUpperCase()}${selectedEnemy ? ` / ${selectedEnemy.name.toUpperCase()}` : ''}`);

  if (command === 'main_gun' && selectedEnemy && mainAmmo > 0) {
    const idx = encounter.enemies.findIndex((enemy) => enemy.id === selectedEnemy.id);
    if (idx >= 0) {
      mainAmmo -= 1;
      const shield = encounter.enemies[idx].guardStacks > 0 ? 1 : 0;
      const affinity = logAffinityReaction(encounter.enemies[idx], 'ballistic');
      const adjustedBase = computeAffinityDamage(selectedMainGun.damage, affinity);
      const damage = Math.max(0, adjustedBase - shield);
      encounter.enemies[idx].hp = Math.max(0, encounter.enemies[idx].hp - damage);
      encounter.enemies[idx].guardStacks = Math.max(0, encounter.enemies[idx].guardStacks - 1);
      encounter.enemies[idx].pressure += 1;
      if (affinity === 'resist') {
        encounter.enemies[idx].pressure += 1;
        encounter.enemies[idx].contractWindow = false;
      }
      encounter.enemies[idx].trust = Math.max(0, encounter.enemies[idx].trust - 1);
      encounter.enemies[idx].contractWindow = false;
      logs.push(`> MAIN GUN: ${selectedMainGun.name.toUpperCase()} / TARGET: ${encounter.enemies[idx].name.toUpperCase()}`);
      logs.push(`> IMPACT CONFIRMED: ${damage} DAMAGE`);
      moeLine = affinity === 'weak'
        ? buildMoeActionLine('主砲射撃', '刺さった。押し切れる。', encounter.enemies[idx].name)
        : affinity === 'resist'
          ? buildMoeActionLine('主砲射撃', '効きが薄い。別の手に切り替えよう。', encounter.enemies[idx].name)
          : buildMoeActionLine('主砲射撃', '命中。警戒は上がってる。', encounter.enemies[idx].name);
      if (encounter.enemies[idx].hp <= 0 && !encounter.enemies[idx].exit) {
        encounter.enemies[idx].exit = 'defeated';
        salvageCredits += 1;
        logs.push(`> TARGET DOWN: ${encounter.enemies[idx].name.toUpperCase()} / SALVAGE +1`);
      }
    }
  }

  if (command === 'sub_gun') {
    logs.push(`> SUB GUN: ${selectedSubGun.name.toUpperCase()}`);
    let weakHits = 0;
    let resistHits = 0;
    const applySubHit = (enemyIndex: number) => {
      if (!isAlive(encounter.enemies[enemyIndex])) return;
      const affinity = logAffinityReaction(encounter.enemies[enemyIndex], 'suppressive');
      const shield = encounter.enemies[enemyIndex].guardStacks > 0 ? 1 : 0;
      let adjustedBase = computeAffinityDamage(selectedSubGun.damage, affinity);
      let damage = Math.max(0, adjustedBase - shield);
      if (encounter.enemies[enemyIndex].armored) damage = Math.max(0, damage - 1);
      encounter.enemies[enemyIndex].hp = Math.max(0, encounter.enemies[enemyIndex].hp - damage);
      encounter.enemies[enemyIndex].guardStacks = Math.max(0, encounter.enemies[enemyIndex].guardStacks - 1);
      encounter.enemies[enemyIndex].pressure += 1;
      if (affinity === 'weak') weakHits += 1;
      if (affinity === 'resist') {
        resistHits += 1;
        encounter.enemies[enemyIndex].pressure += 1;
        encounter.enemies[enemyIndex].contractWindow = false;
      }
      if (selectedSubGun.softenChance && Math.random() < selectedSubGun.softenChance && encounter.enemies[enemyIndex].intent === 'attack') {
        encounter.enemies[enemyIndex].intent = 'guard';
      }
      if (encounter.enemies[enemyIndex].hp <= 0 && !encounter.enemies[enemyIndex].exit) {
        encounter.enemies[enemyIndex].exit = 'defeated';
        salvageCredits += 1;
      }
    };

    if (selectedSubGun.mode === 'all') {
      for (let i = 0; i < encounter.enemies.length; i += 1) applySubHit(i);
      logs.push('> MULTI TARGET HIT');
    } else {
      const hits = selectedSubGun.hits ?? 2;
      for (let i = 0; i < hits; i += 1) {
        const aliveTargets = encounter.enemies.map((enemy, idx) => ({ enemy, idx })).filter(({ enemy }) => isAlive(enemy));
        if (aliveTargets.length === 0) break;
        const pick = aliveTargets[Math.floor(Math.random() * aliveTargets.length)];
        applySubHit(pick.idx);
      }
      logs.push(`> RANDOM HIT x${hits}`);
    }
    if (resistHits > weakHits && resistHits > 0) {
      moeLine = buildMoeActionLine('副砲制圧', '効きが浅い。相性が悪い。');
    } else if (weakHits > 0) {
      moeLine = buildMoeActionLine('副砲制圧', '刺さってる。崩せるよ。');
    } else {
      moeLine = selectedSubGun.id === 'suppression_mg'
        ? buildMoeActionLine('副砲制圧', '攻勢が鈍るかも。')
        : buildMoeActionLine('副砲制圧', '足止めにはなる。');
    }
  }

  if (command === 'se_harpoon' && selectedEnemy && seAmmo >= selectedSE.seAmmoCost) {
    const idx = encounter.enemies.findIndex((enemy) => enemy.id === selectedEnemy.id);
    if (idx >= 0) {
      seAmmo -= selectedSE.seAmmoCost;
      logs.push(`> S-E: ${selectedSE.name.toUpperCase()} FIRED`);
      if (selectedSE.effect === 'all_damage') {
        for (let i = 0; i < encounter.enemies.length; i += 1) {
          if (!isAlive(encounter.enemies[i])) continue;
          const affinity = logAffinityReaction(encounter.enemies[i], 'signal');
          const guardShield = encounter.enemies[i].guardStacks > 0 ? 1 : 0;
          let aoeDamage = Math.max(0, computeAffinityDamage(selectedSE.damage, affinity) - guardShield);
          if (encounter.enemies[i].armored) aoeDamage = Math.max(0, aoeDamage - 1);
          encounter.enemies[i].hp = Math.max(0, encounter.enemies[i].hp - aoeDamage);
          encounter.enemies[i].guardStacks = Math.max(0, encounter.enemies[i].guardStacks - 1);
          encounter.enemies[i].pressure += 1;
          if (affinity === 'weak') {
            encounter.enemies[i].interest += 1;
            if (canOpenContractWindow(encounter.enemies[i])) encounter.enemies[i].contractWindow = true;
          }
          if (affinity === 'resist') {
            encounter.enemies[i].pressure += 1;
            encounter.enemies[i].contractWindow = false;
          }
          if (encounter.enemies[i].hp <= 0 && !encounter.enemies[i].exit) {
            encounter.enemies[i].exit = 'defeated';
            salvageCredits += 1;
          }
        }
        logs.push('> MICRO MISSILE SALVO: ALL TARGETS');
        moeLine = buildMoeActionLine('S-E発射', '制圧寄りにまとめて焼いた。');
      } else {
        const affinity = logAffinityReaction(encounter.enemies[idx], 'signal');
        const shield = encounter.enemies[idx].guardStacks > 0 ? 1 : 0;
        const adjustedDamage = Math.max(0, computeAffinityDamage(selectedSE.damage, affinity) - shield);
        encounter.enemies[idx].hp = Math.max(0, encounter.enemies[idx].hp - adjustedDamage);
        encounter.enemies[idx].guardStacks = Math.max(0, encounter.enemies[idx].guardStacks - 1);
        if (selectedSE.effect === 'interest') {
          encounter.enemies[idx].interest += 1 + (affinity === 'weak' ? 1 : 0);
          if (encounter.enemies[idx].temperament === 'machine' || encounter.enemies[idx].temperament === 'curious') encounter.enemies[idx].interest += 1;
          if (affinity === 'resist') {
            encounter.enemies[idx].pressure += 1;
            encounter.enemies[idx].contractWindow = false;
          }
          if (canOpenContractWindow(encounter.enemies[idx])) encounter.enemies[idx].contractWindow = true;
          logs.push('> ENTITY SIGNATURE PINNED');
          logs.push(`> SIGNAL EFFECT: ${getAffinityTag(affinity)}`);
          if (encounter.enemies[idx].contractWindow) logs.push('> CONTRACT WINDOW: PARTIAL OPEN');
          moeLine = affinity === 'weak'
            ? buildMoeActionLine('S-E発射', '署名が浮いた。契約窓が開きやすい。', encounter.enemies[idx].name)
            : affinity === 'resist'
              ? buildMoeActionLine('S-E発射', '信号が弾かれた。窓が閉じる。', encounter.enemies[idx].name)
              : buildMoeActionLine('S-E発射', '署名を掴んだ。会話が通じやすい。', encounter.enemies[idx].name);
        } else if (selectedSE.effect === 'emp') {
          if (encounter.enemies[idx].temperament === 'machine' || encounter.enemies[idx].profile === 'abandoned_ai_navi') {
            encounter.enemies[idx].empDisabledTurns = 1;
            logs.push('> EMP LOCK: NEXT INTENT DISABLED');
          } else {
            logs.push('> EMP BURST: NO MACHINE RESPONSE');
          }
          moeLine = buildMoeActionLine('EMPフレア', '機械霊の挙動が鈍る。', encounter.enemies[idx].name);
        }
        if (affinity === 'resist' && selectedSE.effect !== 'interest') {
          encounter.enemies[idx].pressure += 1;
        }
        if (encounter.enemies[idx].hp <= 0 && !encounter.enemies[idx].exit) {
          encounter.enemies[idx].exit = 'defeated';
          salvageCredits += 1;
        }
      }
    }
  }

  if (command === 'analyze' && selectedEnemy) {
    if (signal <= 0) {
      logs.push('> WARNING: SIGNAL TOO LOW FOR SCAN');
      moeLine = 'Signalが足りない。';
    } else {
      signal -= 1;
      const idx = encounter.enemies.findIndex((enemy) => enemy.id === selectedEnemy.id);
      if (idx >= 0) {
        encounter.enemies[idx].revealed = true;
        encounter.enemies[idx].affinityRevealed = true;
        encounter.analyzedEnemyIds = Array.from(new Set([...encounter.analyzedEnemyIds, selectedEnemy.id]));
        for (const affinity of affinityOrder) {
          logs.push(`> AFFINITY ${affinityLabel[affinity].toUpperCase()}: ${encounter.enemies[idx].affinities[affinity].toUpperCase()}`);
        }
      }
      logs.push('> SIGNATURE SCAN COMPLETE');
      logs.push(`> TEMPERAMENT: ${selectedEnemy.temperament.toUpperCase()}`);
      logs.push(`> CONTRACT HINT: ${getContractHint(selectedEnemy).toUpperCase()}`);
      analyzeSuccessCount += 1;
      moeLine = buildMoeActionLine('解析完了', '気質と相性を掴んだ。交渉の順番を合わせよう。', selectedEnemy.name);
    }
  }

  if (command === 'talk' && selectedEnemy) {
    const idx = encounter.enemies.findIndex((enemy) => enemy.id === selectedEnemy.id);
    if (idx >= 0) {
      const analyzedBonus = encounter.analyzedEnemyIds.includes(selectedEnemy.id) || encounter.enemies[idx].revealed ? 0.15 : 0;
      const supportBonus = state.selectedLoadout.contractSupportId === 'radio_voice' ? 0.05 : 0;
      const firstTalkBonus = encounterPrep.firstTalkPending ? encounterPrep.firstTalkBonus : 0;
      const affinity = logAffinityReaction(encounter.enemies[idx], 'talk');
      const affinityRateBonus = affinity === 'weak' ? 0.1 : affinity === 'resist' ? -0.15 : 0;
      const successRate = clamp(0.7 + analyzedBonus + supportBonus + firstTalkBonus + affinityRateBonus - encounter.enemies[idx].pressure * 0.1, 0.1, 0.95);
      logs.push('> TALK CHANNEL OPEN');
      if (Math.random() < successRate) {
        encounter.enemies[idx] = applyTalkTemperament(encounter.enemies[idx]);
        if (affinity === 'weak') {
          encounter.enemies[idx].trust += 1;
          encounter.enemies[idx].interest += 1;
        }
        if (affinity === 'resist') {
          encounter.enemies[idx].trust = Math.max(0, encounter.enemies[idx].trust - 1);
          encounter.enemies[idx].interest = Math.max(0, encounter.enemies[idx].interest - 1);
          encounter.enemies[idx].pressure += 1;
          encounter.enemies[idx].contractWindow = false;
        }
        if (encounter.enemies[idx].profile === 'toll_gate_saint' && encounter.enemies[idx].trust >= 2) {
          encounter.enemies[idx].hp = 0;
          encounter.enemies[idx].exit = 'fled';
          logs.push('> TOLL NEGOTIATION ACCEPTED / PASSAGE GRANTED');
          moeLine = buildMoeActionLine('交渉成立', '通行許可が出た。ボス反応が引いた。', encounter.enemies[idx].name);
        } else {
          if (canOpenContractWindow(encounter.enemies[idx])) {
            encounter.enemies[idx].contractWindow = true;
            logs.push('> CONTRACT WINDOW OPEN');
          }
          logs.push('> NEGOTIATION RESPONSE: ACCEPTED');
          moeLine = affinity === 'weak'
            ? buildMoeActionLine('交信成功', '返事が柔らかい。契約窓を狙える。', encounter.enemies[idx].name)
            : affinity === 'resist'
              ? buildMoeActionLine('交信成功', '通ったけど警戒が強い。押しすぎ注意。', encounter.enemies[idx].name)
              : encounter.enemies[idx].contractWindow
                ? buildMoeActionLine('交信成功', '会話に乗った。今なら積める。', encounter.enemies[idx].name)
                : buildMoeActionLine('交信成功', '反応は良い。もう一押し。', encounter.enemies[idx].name);
        }
      } else {
        encounter.enemies[idx].pressure += 1;
        if (Math.random() < 0.45 && signal > 0) {
          signal -= 1;
          logs.push('> SIGNAL -1');
        }
        encounter.enemies[idx].intent = encounter.enemies[idx].temperament === 'hostile' ? 'attack' : 'curse';
        logs.push('> NEGOTIATION RESPONSE: REJECTED');
        moeLine = buildMoeActionLine('交信失敗', '怒りが上がった。次手を変えよう。', encounter.enemies[idx].name);
      }
      encounterPrep.firstTalkPending = false;
    }
  }

  if (command === 'contract' && selectedEnemy) {
    const idx = encounter.enemies.findIndex((enemy) => enemy.id === selectedEnemy.id);
    if (idx >= 0) {
      const target = encounter.enemies[idx];
      if (!target.contractable || !target.contractWindow) {
        logs.push('> CONTRACT REJECTED: NO CONTRACT WINDOW');
        moeLine = buildMoeActionLine('契約試行', '契約窓が未開放。TalkかS-Eを先に。', target.name);
      } else if (!meetsContractCondition(target)) {
        logs.push('> CONTRACT REJECTED: CONDITION NOT MET');
        target.contractWindow = false;
        if (Math.random() < 0.5 && signal > 0) {
          signal -= 1;
          logs.push('> SIGNAL -1');
        } else {
          armor = Math.max(0, armor - 1);
          logs.push('> ARMOR -1');
        }
        moeLine = buildMoeActionLine('契約失敗', '条件不足。反動が来る。', target.name);
      } else {
        const analyzedBonus = encounter.analyzedEnemyIds.includes(target.id) || target.revealed ? 0.1 : 0;
        const successRate = clamp((target.profile === 'toll_gate_saint' ? 0.45 : 0.8) + analyzedBonus - target.pressure * 0.1, 0.1, 0.95);
        logs.push('> CONTRACT PROTOCOL START');
        if (Math.random() < successRate) {
          logs.push('> ENTITY SIGNATURE CAPTURED');
          if (target.targetModuleId && !contracts.some((module) => module.id === target.targetModuleId)) {
            contracts = [...contracts, contractModules[target.targetModuleId]];
            logs.push(`> MODULE SLOT UPDATED: ${contractModules[target.targetModuleId].name.toUpperCase()}`);
          }
          logs.push(`> CONTRACT REGISTERED: ${target.name.toUpperCase()}`);
          encounter.enemies[idx].hp = 0;
          encounter.enemies[idx].contractWindow = false;
          encounter.enemies[idx].exit = 'contracted';
          moeLine = buildMoeActionLine('契約成立', '車載スロットへ登録完了。', target.name);
        } else {
          encounter.enemies[idx].contractWindow = false;
          logs.push('> CONTRACT FAILED: SIGNAL REJECTED');
          if (Math.random() < 0.5 && signal > 0) {
            signal -= 1;
            logs.push('> SIGNAL -1');
          } else {
            armor = Math.max(0, armor - 1);
            logs.push('> ARMOR -1');
          }
          moeLine = buildMoeActionLine('契約失敗', '拒否された。まだ早い。', target.name);
        }
      }
    }
  }

  if (command === 'ram' && selectedEnemy && armor > 0) {
    const idx = encounter.enemies.findIndex((enemy) => enemy.id === selectedEnemy.id);
    if (idx >= 0) {
      armor = Math.max(0, armor - 1);
      let damage = encounter.enemies[idx].intent === 'guard' ? 2 : 3;
      const affinity = logAffinityReaction(encounter.enemies[idx], 'impact');
      damage = computeAffinityDamage(damage, affinity);
      const shield = encounter.enemies[idx].guardStacks > 0 ? 1 : 0;
      damage = Math.max(0, damage - shield);
      encounter.enemies[idx].hp = Math.max(0, encounter.enemies[idx].hp - damage);
      encounter.enemies[idx].guardStacks = Math.max(0, encounter.enemies[idx].guardStacks - 1);
      encounter.enemies[idx].pressure += 2;
      if (affinity === 'resist') encounter.enemies[idx].pressure += 1;
      encounter.enemies[idx].contractWindow = false;
      encounter.guardActive = false;
      logs.push('> DRIVE COMMAND: RAM');
      logs.push('> CHASSIS IMPACT CONFIRMED');
      logs.push('> ARMOR -1');
      moeLine = affinity === 'weak'
        ? buildMoeActionLine('ラムアタック', '効いてる。押し切れる。', encounter.enemies[idx].name)
        : affinity === 'resist'
          ? buildMoeActionLine('ラムアタック', '固い。正面突破は不利。', encounter.enemies[idx].name)
          : buildMoeActionLine('ラムアタック', '衝突確認。こちらの装甲も削れてる。', encounter.enemies[idx].name);
      if (encounter.enemies[idx].hp <= 0 && !encounter.enemies[idx].exit) {
        encounter.enemies[idx].exit = 'defeated';
        salvageCredits += 1;
      }
    }
  }

  if (command === 'guard') {
    encounter.guardActive = true;
    logs.push('> DEFENSIVE POSTURE LOCKED');
    moeLine = buildMoeActionLine('防御姿勢', '固定。次の被弾を抑える。');
  }

  if (command === 'escape' && fuel > 0) {
    fuel = Math.max(0, fuel - 1);
    const reaperLike = encounter.enemies.some((enemy) => isAlive(enemy) && (enemy.profile === 'road_reaper' || enemy.profile === 'toll_gate_saint'));
    const successRate = reaperLike ? 0.55 : 0.7;
    logs.push('> DRIVE COMMAND: ESCAPE');
    logs.push('> THROTTLE OVERRIDE');
    if (Math.random() < successRate) {
      logs.push('> ESCAPE ROUTE FOUND');
      escaped = true;
      skipEnemyResolution = true;
      moeLine = buildMoeActionLine('離脱', 'ルート確保。接触を切った。');
    } else {
      logs.push('> ESCAPE FAILED');
      moeLine = buildMoeActionLine('離脱', '失敗。受ける準備して。');
    }
  }

  if (!skipEnemyResolution) {
    let guardBudget = encounter.guardActive ? 2 : 0;
    for (const enemy of encounter.enemies.filter(isAlive)) {
      const enemyIntent = enemy.empDisabledTurns > 0 ? 'guard' : enemy.intent;
      logs.push(`> ENEMY INTENT: ${enemy.name.toUpperCase()} -> ${enemyIntent.toUpperCase()}`);
      if (enemy.empDisabledTurns > 0) logs.push('> EMP DISRUPTION: INTENT JAMMED');
      if (enemyIntent === 'attack') {
        let damage = 2;
        if (guardBudget > 0) {
          const reduced = Math.min(guardBudget, damage);
          damage -= reduced;
          guardBudget -= reduced;
        }
        if (encounter.supportArmorGuardReady && damage > 0) {
          damage = Math.max(0, damage - 1);
          encounter.supportArmorGuardReady = false;
          logs.push('> SUPPORT SHIELD: SILENT SHAPE ABSORBED 1');
        }
        if (damage > 0) {
          armor = Math.max(0, armor - damage);
          logs.push(`> ARMOR -${damage}`);
        } else logs.push('> GUARD ABSORBED IMPACT');
      } else if (enemyIntent === 'curse') {
        let sigDamage = 1;
        if (encounter.guardActive) sigDamage = Math.max(0, sigDamage - 1);
        if (sigDamage > 0) {
          signal = Math.max(0, signal - sigDamage);
          logs.push(`> SIGNAL -${sigDamage}`);
        } else logs.push('> CURSE MITIGATED');
      } else if (enemyIntent === 'bargain') {
        if (signal > fuel && signal > 0) {
          signal -= 1;
          logs.push('> SIGNAL -1 (BARGAIN)');
        } else {
          fuel = Math.max(0, fuel - 1);
          logs.push('> FUEL -1 (BARGAIN)');
        }
      } else if (enemyIntent === 'guard') {
        const idx = encounter.enemies.findIndex((d) => d.id === enemy.id);
        if (idx >= 0) {
          encounter.enemies[idx].guardStacks += 1;
          logs.push('> ENEMY GUARD STACK +1');
        }
      } else if (enemyIntent === 'flee') {
        const idx = encounter.enemies.findIndex((d) => d.id === enemy.id);
        if (idx >= 0) {
          if (encounter.enemies[idx].hp <= 2) {
            encounter.enemies[idx].hp = 0;
            encounter.enemies[idx].exit = encounter.enemies[idx].exit ?? 'fled';
            logs.push(`> TARGET FLED: ${enemy.name.toUpperCase()}`);
          } else {
            encounter.enemies[idx].intent = 'guard';
            logs.push(`> FLEE ABORTED: ${enemy.name.toUpperCase()} / HOLDING POSITION`);
          }
        }
      }
    }
    encounter.guardActive = false;
    encounter.turn += 1;
    encounter.enemies = encounter.enemies.map((enemy) => {
      if (!isAlive(enemy)) return enemy;
      const next = nextIntent(enemy.profile);
      const remainingEmp = Math.max(0, enemy.empDisabledTurns - 1);
      return { ...enemy, intent: next, empDisabledTurns: remainingEmp };
    });
  }

  if (armor <= 0 || fuel <= 0) {
    const report = makeEncounterReport(state.encounterIndex + 1, encounter.enemies, escaped);
    const resultType: ResultType = 'Vehicle Disabled';
    const story = resolveStoryFromRun(state, resultType);
    return {
      ...state,
      gamePhase: 'game_over',
      fuel,
      armor,
      signal,
      mainAmmo,
      seAmmo,
      contracts,
      salvageCredits,
      logs: appendRecoveredStoryLogLines([...logs, '> SIGNAL LOST', '> VEHICLE DISABLED'], story),
      encounter: { ...encounter, phase: 'finished' },
      lastReport: report,
      runSummary: accumulateSummary(state.runSummary, report),
      resultType,
      story,
      encounterPrep,
      analyzeSuccessCount,
      moeLine: '応答して。……だめ、車両信号が落ちてる。',
    };
  }

  const cleared = escaped || encounter.enemies.every((enemy) => !isAlive(enemy));
  if (cleared) {
    const report = makeEncounterReport(state.encounterIndex + 1, encounter.enemies, escaped);
    const summary = accumulateSummary(state.runSummary, report);
    const logsWithClear = [...logs, '> ENCOUNTER CLEARED'];

    if (state.gamePhase === 'boss_encounter') {
      return {
        ...state,
        gamePhase: 'return_gate',
        fuel,
        armor,
        signal,
        mainAmmo,
        seAmmo,
        contracts,
        salvageCredits,
        logs: [...logsWithClear, '> RETURN GATE ROUTE OPEN'],
        encounter: { ...encounter, phase: 'finished' },
        lastReport: report,
        runSummary: summary,
        resultType: 'Boss Cleared',
        encounterPrep,
        analyzeSuccessCount,
        moeLine: '帰還ゲート、見えた。まだ車は動くね。',
      };
    }

    return {
      ...state,
      gamePhase: 'reward',
      fuel,
      armor,
      signal,
      mainAmmo,
      seAmmo,
      contracts,
      salvageCredits,
      logs: [...logsWithClear, '> SALVAGE RESULT READY'],
      encounter: { ...encounter, phase: 'finished' },
      lastReport: report,
      runSummary: summary,
      rewardScope: state.encounter.kind === 'enc1' ? 'post_enc1' : 'post_enc2',
      encounterPrep,
      analyzeSuccessCount,
      moeLine: '遭遇クリア。次の判断に備えよう。',
    };
  }

  const alive = encounter.enemies.filter(isAlive);
  if (alive.length > 0 && !alive.some((enemy) => enemy.id === encounter.selectedEnemyId)) encounter.selectedEnemyId = alive[0].id;
  const { forecast, unstable } = buildForecast(
    encounter.enemies,
    hasAiNaviContract(contracts),
    state.selectedLoadout.contractSupportId,
    state.tempForecastBoost,
  );
  encounter.forecast = forecast;
  encounter.forecastUnstable = unstable;
  encounter.phase = 'command';
  logs.push('> NAVI FORECAST UPDATED');
  if (unstable) logs.push('> WARNING: FORECAST RELIABILITY UNSTABLE');

  return {
    ...state,
    fuel,
    armor,
    signal,
    mainAmmo,
    seAmmo,
    contracts,
    salvageCredits,
    logs,
    encounterPrep,
    analyzeSuccessCount,
    moeLine,
    encounter,
  };
}

function StatusLamp({ label, active = false, tone = 'green' }: { label: string; active?: boolean; tone?: 'green' | 'red' | 'amber' | 'cyan' }) {
  return <span className={`status-lamp status-lamp--${tone} ${active ? 'is-active' : ''}`}>
    <span className="status-lamp__bulb" />
    <span>{label}</span>
  </span>;
}

function ResourceMeter({ label, value, max, tone }: { label: string; value: number; max: number; tone: 'fuel' | 'armor' | 'signal' | 'ammo' | 'seammo' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const isLow = tone !== 'signal' && pct <= 35;
  const blockCount = Math.min(max, 12);
  const filledBlocks = Math.round((pct / 100) * blockCount);
  const blocks = Array.from({ length: blockCount }, (_, index) => index < filledBlocks);
  return <div className={`resource-meter resource-meter--${tone} ${isLow ? 'resource-meter--low' : ''}`}>
    <div className="resource-meter__head">
      <span>{label.toUpperCase()}</span>
      <span>{String(Math.max(0, value)).padStart(2, '0')} / {String(max).padStart(2, '0')}</span>
    </div>
    <div className="resource-meter__bar" aria-label={`${label} ${value} of ${max}`}>
      <span style={{ width: `${pct}%` }} />
    </div>
    <div className="resource-meter__blocks" aria-hidden="true">
      {blocks.map((filled, index) => <span key={index} className={filled ? 'is-filled' : ''} />)}
    </div>
  </div>;
}

function renderDevilArt(profile: EncounterId) {
  if (profile === 'whisper_broker') {
    return <svg viewBox="0 0 180 180" role="img" aria-label="Whisper Broker silhouette">
      <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M90 28c10 0 18 8 18 18v10h-36V46c0-10 8-18 18-18z" />
        <path d="M68 62c8-8 36-8 44 0l-8 64H76z" fill="currentColor" fillOpacity=".3" />
        <path d="M76 74c6-5 22-5 28 0M78 90c6-5 20-5 26 0" />
        <path d="M90 126v34m0-22l-20 20m20-16l20 20" />
      </g>
    </svg>;
  }
  if (profile === 'toll_gate_saint') {
    return <svg viewBox="0 0 180 180" role="img" aria-label="Toll Gate Saint silhouette">
      <g fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="54" y="38" width="72" height="44" rx="4" />
        <path d="M90 82v56m0-28l-26 24m26-20l26 24" />
        <path d="M67 52h46m-46 9h46" />
        <path d="M46 146h88" />
        <path d="M54 38l-16 14m88-14l16 14" opacity=".55" />
      </g>
    </svg>;
  }
  if (profile === 'road_reaper') {
    return <svg viewBox="0 0 180 180" role="img" aria-label="Road Reaper silhouette">
      <g fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M88 18h4v20h-4z" />
        <rect x="64" y="40" width="52" height="34" />
        <path d="M90 74v52m0-30l-26 26m26-22l26 26" />
      </g>
    </svg>;
  }
  if (profile === 'silent_shape') {
    return <svg viewBox="0 0 180 180" role="img" aria-label="Silent Shape silhouette">
      <defs>
        <radialGradient id="silentMass" cx="50%" cy="48%" r="58%">
          <stop offset="0%" stopColor="currentColor" stopOpacity=".62" />
          <stop offset="100%" stopColor="currentColor" stopOpacity=".05" />
        </radialGradient>
      </defs>
      <ellipse cx="90" cy="94" rx="62" ry="52" fill="url(#silentMass)" />
      <path d="M62 136c11-25-8-43 15-74 9-12 25-12 34 0 24 31 5 48 17 74-17-10-34-12-66 0z" fill="currentColor" fillOpacity=".4" />
    </svg>;
  }
  if (profile === 'roadside_phone') {
    return <svg viewBox="0 0 180 180" role="img" aria-label="Roadside Phone silhouette">
      <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="64" y="36" width="52" height="88" rx="5" />
        <rect x="74" y="48" width="32" height="26" rx="2" />
      </g>
    </svg>;
  }
  return <svg viewBox="0 0 180 180" role="img" aria-label="Abandoned AI Navi silhouette">
    <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="40" y="44" width="100" height="70" rx="9" />
      <path d="M54 58h72v42H54z" opacity=".45" />
      <path d="M66 86l22-16 16 8 18-14" />
    </g>
  </svg>;
}

function BattleDevilSprite({
  devil,
  focused,
  lane,
  analyzed,
  onSelect,
}: {
  devil: Devil;
  focused: boolean;
  lane: 'left' | 'center' | 'right';
  analyzed: boolean;
  onSelect: () => void;
}) {
  const profile = encounterProfiles[devil.profile];
  const hpPct = Math.max(0, (devil.hp / devil.maxHp) * 100);
  return <article
    className={`battle-devil battle-devil--${lane} ${focused ? 'is-focused' : ''} ${profile.contractable ? 'is-contractable' : 'is-hostile'} ${devil.hp <= 0 ? 'is-defeated' : ''}`}
    onClick={onSelect}
    role="button"
    tabIndex={0}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect();
      }
    }}
  >
    <div className="battle-devil__body">
      <div className="battle-devil__art">{renderDevilArt(devil.profile)}</div>
      <div className="battle-devil__label">
        <strong>{analyzed ? devil.name.toUpperCase() : 'UNKNOWN SIGN'}</strong>
        <span>{profile.contractable ? 'CONTRACTABLE' : 'HOSTILE'} / {profile.threat}</span>
      </div>
      <div className="battle-devil__hp">
        <span>HP {devil.hp}/{devil.maxHp}</span>
        <div><i style={{ width: `${hpPct}%` }} /></div>
      </div>
      <div className="battle-devil__intel">
        {analyzed
          ? <>
            <small>TEMP: {devil.temperament.toUpperCase()}</small>
            <small>INTENT: {devil.intent.toUpperCase()}</small>
            <small className="battle-devil__affinity">
              AFF:
              {affinityOrder.map((affinity) => <span key={`${devil.id}-${affinity}`} className={`affinity-chip affinity-chip--${devil.affinities[affinity]}`}>
                {affinityLabel[affinity].slice(0, 3).toUpperCase()} {getAffinityTag(devil.affinities[affinity])}
              </span>)}
            </small>
            <small>{getContractHint(devil)}</small>
          </>
          : <>
            <small>INTEL: UNKNOWN / ANALYZE REQUIRED</small>
            <small className="battle-devil__affinity">AFF: UNKNOWN</small>
          </>}
        {devil.contractWindow && <small className="battle-devil__window">CONTRACT WINDOW OPEN</small>}
      </div>
    </div>
    {focused && <span className="battle-devil__target">TARGET LOCK</span>}
  </article>;
}

function ApproachContactMarker({
  profile,
  lane,
  scanSuccess,
}: {
  profile: EncounterId;
  lane: 'left' | 'center' | 'right';
  scanSuccess: boolean;
}) {
  const info = encounterProfiles[profile];
  return <article className={`approach-contact approach-contact--${lane}`}>
    <div className="approach-contact__sigil">?</div>
    <div className="approach-contact__meta">
      <strong>{scanSuccess ? info.label : 'UNKNOWN CONTACT'}</strong>
      <small>{scanSuccess ? `suggested: ${getLikelyWeaknessSummary(profile)}` : 'suggested: Analyze / Guard'}</small>
      <small>{scanSuccess ? info.signal.toLowerCase() : 'signal noise / unknown lane object'}</small>
    </div>
  </article>;
}

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const [autoplayRuns, setAutoplayRuns] = useState(120);
  const [autoplayStrategy, setAutoplayStrategy] = useState<AutoPlayStrategy>('balanced');
  const [autoplayReport, setAutoplayReport] = useState<AutoPlayReport | null>(null);
  const terminalLogRef = useRef<HTMLUListElement | null>(null);
  const selectedMainGun = mainGunCatalog[state.selectedLoadout.mainGunId];
  const selectedSubGun = subGunCatalog[state.selectedLoadout.subGunId];
  const selectedSE = specialEquipmentCatalog[state.selectedLoadout.specialEquipmentId];
  const selectedSupport = contractSupportCatalog[state.selectedLoadout.contractSupportId];
  const nextRunPreview = getRunStartResources(state.selectedLoadout, state.vehicleUpgrades);
  const skillOrder: UpgradeId[] = ['ram_control', 'gunnery', 'scan_boost', 'translation_assist'];
  const vehicleUpgradeOrder: VehicleUpgradeId[] = ['fuel_tank', 'armor_plating', 'ammo_rack', 'se_rack'];

  const selectedEnemy = useMemo(() => getSelectedEnemy(state.encounter), [state.encounter]);
  const runGrowth = useMemo(() => getRunGrowth(state), [state]);
  const narrativeMoeLine = useMemo(() => getNarrativeMoeLine(state), [state]);
  const aliveEnemies = state.encounter.enemies.filter(isAlive);
  const approachLineup = state.approach?.lineup ?? [];
  const ingressSteps = [
    { label: 'ENTRY RAMP', done: true },
    { label: 'MIDNIGHT GATE', done: true },
    { label: 'NAVI SWEEP', done: state.gamePhase !== 'approach' || !!state.approach?.scanSuccess },
    { label: 'CONTACT', done: state.gamePhase !== 'approach' || !!state.approach },
  ];
  const runStatus = state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter'
    ? `WAVE ${String(state.encounterIndex + 1).padStart(2, '0')}`
    : state.gamePhase.toUpperCase();
  const depth = state.encounterIndex + 1;
  const isBattlePhase = state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter';
  const isRoadMoving = ['approach', 'route_choice', 'salvage', 'signal', 'boss_preview', 'reward', 'return_gate'].includes(state.gamePhase);
  const isRoadStopped = isBattlePhase || state.gamePhase === 'garage' || state.gamePhase === 'result' || state.gamePhase === 'game_over';
  const isEncounterActive = (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') && state.encounter.phase === 'command';
  const speed = isBattlePhase ? 0 : isRoadMoving ? 122 : state.gamePhase === 'prologue' ? 64 : 8;

  const terminalStatus = [
    state.signal <= 1 ? 'SIGNAL WEAK' : 'SIGNAL LOCKED',
    `TURN ${String(state.encounter.turn).padStart(2, '0')}`,
    state.encounter.guardActive ? 'GUARD ACTIVE' : 'GUARD OFF',
    `MAIN AMMO ${state.mainAmmo}/${state.maxMainAmmo}`,
    `S-E AMMO ${state.seAmmo}/${state.maxSeAmmo}`,
    `MAIN ${selectedMainGun.name.toUpperCase()}`,
  ];

  const tacticalLines = [
    aliveEnemies.length > 0 ? 'ENTITY DETECTED' : 'NO HOSTILES IN LANE',
    selectedEnemy ? `CURRENT INTENT ${selectedEnemy.intent.toUpperCase()}` : 'NO ACTIVE TARGET',
    (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') ? `ENCOUNTER ${state.encounterIndex + 1}/3` : state.gamePhase.toUpperCase(),
  ];

  const contractEnabled = !!selectedEnemy && selectedEnemy.contractWindow && selectedEnemy.contractable;
  const selectedEnemyAnalyzed = !!selectedEnemy && (state.encounter.analyzedEnemyIds.includes(selectedEnemy.id) || selectedEnemy.affinityRevealed);
  const commandAffinityTagMap: Partial<Record<CommandId, string>> = selectedEnemyAnalyzed && selectedEnemy
    ? Object.fromEntries(
      (Object.entries(commandAffinityMap) as Array<[CommandId, AffinityType]>).map(([commandId, affinity]) => [commandId, getAffinityTag(selectedEnemy.affinities[affinity])]),
    )
    : {};
  const commandEnabledMap: Record<CommandId, boolean> = {
    main_gun: (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') && !!selectedEnemy && selectedEnemy.hp > 0 && state.mainAmmo > 0,
    sub_gun: (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') && aliveEnemies.length > 0,
    se_harpoon: (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') && !!selectedEnemy && selectedEnemy.hp > 0 && state.seAmmo >= selectedSE.seAmmoCost,
    analyze: (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') && !!selectedEnemy && selectedEnemy.hp > 0 && state.signal > 0,
    talk: (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') && !!selectedEnemy && selectedEnemy.hp > 0,
    contract: (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') && contractEnabled,
    ram: (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') && !!selectedEnemy && selectedEnemy.hp > 0 && state.armor > 0,
    guard: state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter',
    escape: (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') && state.fuel > 0,
  };

  useEffect(() => {
    if (!terminalLogRef.current) return;
    terminalLogRef.current.scrollTop = terminalLogRef.current.scrollHeight;
  }, [state.logs.length]);

  useEffect(() => {
    if (!(state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter')) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const commandIds = commandOptions.map((option) => option.id);
      const currentIndex = commandIds.findIndex((id) => id === state.encounter.selectedCommand);
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        dispatch({ type: 'SELECT_COMMAND', command: commandIds[(currentIndex - 1 + commandIds.length) % commandIds.length] });
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        dispatch({ type: 'SELECT_COMMAND', command: commandIds[(currentIndex + 1) % commandIds.length] });
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const live = state.encounter.enemies.filter((enemy) => enemy.hp > 0);
        if (live.length <= 1) return;
        const idx = live.findIndex((enemy) => enemy.id === state.encounter.selectedEnemyId);
        const next = event.key === 'ArrowLeft' ? (idx - 1 + live.length) % live.length : (idx + 1) % live.length;
        dispatch({ type: 'SELECT_ENEMY', enemyId: live[next].id });
      } else if (event.key === 'Enter') {
        event.preventDefault();
        dispatch({ type: 'EXECUTE_COMMAND' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.gamePhase, state.encounter]);

  useEffect(() => {
    setAutoplayReport(null);
  }, [
    state.selectedLoadout.mainGunId,
    state.selectedLoadout.subGunId,
    state.selectedLoadout.specialEquipmentId,
    state.selectedLoadout.contractSupportId,
  ]);

  const logLines = state.logs.slice(-24);
  const groupOrder: ('WEAPON' | 'TERMINAL' | 'DRIVE')[] = ['WEAPON', 'TERMINAL', 'DRIVE'];
  const runAutoplay = () => {
    setAutoplayReport(runAutoplayBatch(state.selectedLoadout, autoplayRuns, autoplayStrategy));
  };
  const showFirstGarageGuide = state.gamePhase === 'prologue'
    && !state.previousRun
    && state.driverXpBank === 0
    && state.moeSyncBank === 0
    && state.creditBank === 0;

  return <div className={`dashboard-shell ${isEncounterActive ? 'is-encounter' : ''}`}>
    <div className="road-runner-bg" aria-hidden="true">
      <span className="road-runner-bg__lane" />
      <span className="road-runner-bg__lights" />
      <span className="road-runner-bg__fog" />
      <span className="road-runner-bg__noise" />
    </div>

    {state.gamePhase === 'prologue' && <section className="prologue-overlay" role="dialog" aria-label="Night Loop Prologue">
      <div className="prologue-card">
        <div className="prologue-kicker">00:00 / MIDNIGHT WINDOW</div>
        <h2>NIGHT LOOP OPEN</h2>
        <p>M.O.E.: 「{narrativeMoeLine}」</p>
        <div className="prologue-actions">
          <button className="command-button command-button--route" onClick={() => dispatch({ type: 'START_ENGINE' })}>START ENGINE</button>
          <button className="command-button command-button--system" onClick={() => dispatch({ type: 'OPEN_GARAGE' })}>OPEN MIDNIGHT BAY</button>
        </div>
        {showFirstGarageGuide && <div className="prologue-guide">
          <strong>NAVI TIP</strong>
          <span>初回だけ案内: 出撃前に Garage で積み替えや成長ができます</span>
          <em>GARAGE ↓</em>
        </div>}
      </div>
    </section>}

    <div className="cockpit-frame">
      <header className="cockpit-header panel">
        <div className="brand-stack" aria-label="Devil Drive Midnight Terminal">
          <span>DEVIL DRIVE</span>
          <strong>MIDNIGHT TERMINAL</strong>
        </div>
        <div className="header-readouts">
          <div className="readout"><span>RUN STATUS</span><strong>{runStatus}</strong></div>
          <div className="readout"><span>DEPTH</span><strong>{String(depth).padStart(2, '0')}</strong></div>
          <div className="readout readout--wide"><span>CURRENT NODE</span><strong>{state.gamePhase}</strong></div>
          <div className="readout"><span>TIME</span><strong>00:00</strong></div>
        </div>
        <div className="lamp-row" aria-label="System indicators">
          <StatusLamp label="SYS" active tone={state.gamePhase === 'game_over' ? 'red' : 'green'} />
          <StatusLamp label="NAVI" active={state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter'} tone="cyan" />
          <StatusLamp label="WARN" active={state.fuel <= 3 || state.armor <= 3 || state.signal <= 1} tone="red" />
        </div>
      </header>

      <main className="action-panel panel">
        <div className="panel-title">
          <span>WINDSHIELD ENCOUNTER VIEW</span>
          <small>{state.gamePhase.toUpperCase()}</small>
        </div>

        <section className={`battle-view ${isEncounterActive ? 'is-hot' : ''} ${isRoadMoving ? 'is-cruising' : ''} ${isRoadStopped ? 'is-stopped' : ''}`}>
          <div className="battle-view__frame" aria-hidden="true">
            <span className="battle-view__pillar battle-view__pillar--left" />
            <span className="battle-view__pillar battle-view__pillar--right" />
            <span className="battle-view__dashboard-lip" />
          </div>
          <div className="battle-view__road">
            <span className="battle-view__roadline" />
            <span className="battle-view__rail battle-view__rail--left" />
            <span className="battle-view__rail battle-view__rail--right" />
            <span className="battle-view__viaduct" />
            <span className="battle-view__streetlights" />
            <span className="battle-view__city" />
            <span className="battle-view__speedlines" />
            <span className="battle-view__mist" />
            <span className="battle-view__headlights" />
          </div>
          <div className="battle-view__hud">
            <span>THREAT FIELD {aliveEnemies.length > 0 && (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') ? 'ACTIVE' : 'CLEAR'}</span>
            <strong>{selectedEnemy ? encounterProfiles[selectedEnemy.profile].label : 'ROAD OPEN'}</strong>
          </div>
          {state.gamePhase === 'approach' && <div className="battle-view__ingress">
            {ingressSteps.map((step, idx) => <div key={step.label} className={`battle-view__ingress-step ${step.done ? 'is-done' : ''} ${idx === ingressSteps.length - 1 ? 'is-current' : ''}`}>
              <span>{step.label}</span>
            </div>)}
          </div>}
          <div className="battle-view__devils">
            {(state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter' || state.gamePhase === 'reward') && state.encounter.enemies.map((enemy, index) => <BattleDevilSprite
              key={enemy.id}
              devil={enemy}
              lane={index === 0 ? 'left' : index === 1 ? 'center' : 'right'}
              focused={enemy.id === state.encounter.selectedEnemyId}
              analyzed={state.encounter.analyzedEnemyIds.includes(enemy.id) || enemy.revealed}
              onSelect={() => dispatch({ type: 'SELECT_ENEMY', enemyId: enemy.id })}
            />)}
            {state.gamePhase === 'approach' && approachLineup.map((profile, index) => <ApproachContactMarker
              key={`${profile}-${index}`}
              profile={profile}
              lane={index === 0 ? 'left' : index === 1 ? 'center' : 'right'}
              scanSuccess={!!state.approach?.scanSuccess}
            />)}
          </div>
        </section>

        <section className="battle-deck">
          <section className="terminal-stack panel">
            <section className={`terminal terminal-log ${isEncounterActive ? 'terminal--anomaly' : ''}`}>
              <div className="terminal__head terminal-status">
                <strong>DEVIL TERMINAL</strong>
                <span>{runStatus}</span>
              </div>
              <div className="terminal-status__chips">
                {terminalStatus.map((status) => <span key={status} className="terminal-status__chip">{status}</span>)}
                {tacticalLines.map((line) => <span key={line} className="terminal-status__chip terminal-status__chip--tactical">{line}</span>)}
              </div>
              <ul ref={terminalLogRef} className="terminal-log__list">
                {logLines.map((log, i, logs) => {
                  const kind = classifyLog(log);
                  return <li key={`${log}-${i}`} className={`terminal-log__line log-${kind} ${i === logs.length - 1 ? 'is-latest' : ''}`}>
                    <span className="terminal-log__time">{getPseudoTimecode(i, logs.length, state.encounterIndex, state.encounter.turn)}</span>
                    <span className="terminal-log__badge">{getLogBadge(kind)}</span>
                    <span className="terminal-log__caret">&gt;</span>
                    <span className="terminal-log__text">{log}</span>
                  </li>;
                })}
              </ul>
            </section>

            <section className="radio-panel">
              <div className="radio-panel__head">
                <span>RADIO // M.O.E.</span>
                <small>{state.gamePhase.toUpperCase()} / {state.signal <= 2 ? 'NOISY' : 'CLEAR'}</small>
              </div>
              <div className="radio-bubble">
                <p className="moe-live">「{narrativeMoeLine}」</p>
                {selectedEnemy && (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') && <p className="moe-command">
                  「{selectedEnemy.contractWindow ? '契約窓、開いてる。今なら積める。' : getContractHint(selectedEnemy)}」
                </p>}
              </div>
            </section>
          </section>

          <section className={`command-core ${!(state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') ? 'command-core--standby' : ''}`}>
            <div className="panel-title panel-title--compact">
              <span>RPG COMMAND</span>
              <small>{(state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') ? 'SELECT ACTION' : state.gamePhase.toUpperCase()}</small>
            </div>

            {(state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') && <>
              <div className="command-groups">
                {groupOrder.map((group) => <div key={group} className="command-group">
                  <div className="command-group__title">{group}</div>
                  <div className="command-window command-list command-window--grid">
                    {commandOptions.filter((option) => option.group === group).map((command) => <button
                      key={command.id}
                      className={`command-button command-button--${command.tone} ${state.encounter.selectedCommand === command.id ? 'is-selected' : ''}`}
                      onClick={() => {
                        if (commandEnabledMap[command.id]) {
                          dispatch({ type: 'EXECUTE_COMMAND', command: command.id });
                          return;
                        }
                        dispatch({ type: 'SELECT_COMMAND', command: command.id });
                      }}
                      disabled={!commandEnabledMap[command.id]}
                      type="button"
                      data-desc={
                        command.id === 'main_gun'
                          ? `${selectedMainGun.name}: DMG ${selectedMainGun.damage} / AMMO ${state.mainAmmo}`
                          : command.id === 'sub_gun'
                            ? `${selectedSubGun.name}: ${selectedSubGun.description}`
                            : command.id === 'se_harpoon'
                              ? `${selectedSE.name}: ${selectedSE.description} / S-E AMMO ${state.seAmmo}`
                              : command.id === 'contract'
                                ? (contractEnabled ? 'Window Open' : 'No contract window')
                                : commandDescriptions[command.id].description
                      }
                    >
                      <span className="command-button__label">{command.label}</span>
                      {commandAffinityTagMap[command.id] && <span className={`command-button__affinity command-button__affinity--${commandAffinityTagMap[command.id]?.toLowerCase()}`}>{commandAffinityTagMap[command.id]}</span>}
                    </button>)}
                  </div>
                </div>)}
              </div>
              <div className="command-window">
                <div className="command-instant">Tap command to execute instantly</div>
              </div>
            </>}

            {state.gamePhase === 'reward' && <div className="command-window command-list">
              <button className="command-button command-button--route" onClick={() => dispatch({ type: 'REWARD_CONTINUE' })}>PROCEED</button>
            </div>}

            {state.gamePhase === 'approach' && state.approach && <div className="command-window command-list">
              {state.approach.scanSuccess
                ? <>
                  <button
                    className="command-button command-button--danger"
                    onClick={() => dispatch({ type: 'APPROACH_CHOOSE', option: 'preemptive_main_gun' })}
                    disabled={state.mainAmmo <= 0}
                    data-desc="先制主砲。接敵前に削る / MainAmmo-1 / 交渉難化"
                  >
                    Preemptive Main Gun
                  </button>
                  <button className="command-button command-button--danger" onClick={() => dispatch({ type: 'APPROACH_CHOOSE', option: 'hit_and_run_ram' })} data-desc="轢き逃げ突破。Armor-1 Fuel-1 / 成功で遭遇回避">
                    Hit-and-Run Ram
                  </button>
                  <button className="command-button command-button--route" onClick={() => dispatch({ type: 'APPROACH_CHOOSE', option: 'silent_coast' })} data-desc="静穏接近。Fuel-1 / 初手Talk成功率上昇 / 敵攻勢鈍化">
                    Silent Coast
                  </button>
                  <button
                    className="command-button command-button--contract"
                    onClick={() => dispatch({ type: 'APPROACH_CHOOSE', option: 'open_channel' })}
                    disabled={state.signal <= 0}
                    data-desc="先行交信。Signal-1 / interest上昇 / hostile相手は逆上リスク"
                  >
                    Open Channel
                  </button>
                </>
                : <button className="command-button command-button--danger" onClick={() => dispatch({ type: 'APPROACH_CONTINUE' })}>
                  Brace for Contact
                </button>}
            </div>}

            {state.gamePhase === 'route_choice' && <div className="command-window command-list">
              <button className="command-button command-button--route" onClick={() => dispatch({ type: 'ROUTE_CHOICE', lane: 'salvage' })}>Salvage Lane</button>
              <button className="command-button command-button--route" onClick={() => dispatch({ type: 'ROUTE_CHOICE', lane: 'signal' })}>Signal Lane</button>
              <button className="command-button command-button--route" onClick={() => dispatch({ type: 'ROUTE_CHOICE', lane: 'push_forward' })}>Push Forward</button>
              <button className="command-button command-button--danger" onClick={() => dispatch({ type: 'ROUTE_CHOICE', lane: 'return_gate' })}>Return Gate</button>
            </div>}

            {state.gamePhase === 'salvage' && <div className="command-window command-list">
              {state.rewardOptions.map((option) => <button
                key={option.id}
                className="command-button command-button--route"
                onClick={() => dispatch({ type: 'SALVAGE_PICK', rewardId: option.id })}
              >
                {option.label} <span>{option.detail}</span>
              </button>)}
            </div>}

            {state.gamePhase === 'signal' && <div className="command-window command-list">
              <button className="command-button command-button--route" onClick={() => dispatch({ type: 'SIGNAL_CONTINUE' })}>ENTER ENCOUNTER 2</button>
            </div>}

            {state.gamePhase === 'boss_preview' && <div className="command-window command-list">
              <button className="command-button command-button--danger" onClick={() => dispatch({ type: 'BOSS_PREVIEW_CHOICE', choice: 'challenge' })}>Challenge Deep Signal</button>
              <button className="command-button command-button--route" onClick={() => dispatch({ type: 'BOSS_PREVIEW_CHOICE', choice: 'emergency_salvage' })}>Emergency Salvage</button>
              <button className="command-button command-button--route" onClick={() => dispatch({ type: 'BOSS_PREVIEW_CHOICE', choice: 'return_gate' })}>Return Gate</button>
            </div>}

            {state.gamePhase === 'return_gate' && <div className="command-window command-list">
              <button className="command-button command-button--route" onClick={() => dispatch({ type: 'RETURN_TO_SURFACE' })}>RETURN TO SURFACE</button>
            </div>}

            {state.gamePhase === 'garage' && <div className="command-window command-list">
              <button className="command-button command-button--route" onClick={() => dispatch({ type: 'GARAGE_ENTER_RUN' })}>ENTER NIGHT LOOP</button>
            </div>}

            {(state.gamePhase === 'result' || state.gamePhase === 'game_over') && <div className="command-window command-list">
              <button className="command-button command-button--route" onClick={() => dispatch({ type: 'START_NEXT_RUN' })}>START NEXT RUN</button>
              <button className="command-button command-button--route" onClick={() => dispatch({ type: 'OPEN_GARAGE' })}>RETURN TO GARAGE</button>
              <button className="command-button command-button--route" onClick={() => dispatch({ type: 'RETRY' })}>RETRY</button>
            </div>}

            <small className="command-hint">Keys: ↑↓ command / ←→ target / Enter execute selected</small>
          </section>

          <section className="vehicle-panel vehicle-panel--inline panel">
            <div className="panel-title">
              <span>VEHICLE DASHBOARD</span>
              <small>SPD {String(speed).padStart(3, '0')} km/h</small>
            </div>
            <div className="vehicle-panel__meters">
              <ResourceMeter label="Fuel" value={state.fuel} max={12} tone="fuel" />
              <ResourceMeter label="Armor" value={state.armor} max={12} tone="armor" />
              <ResourceMeter label="Signal" value={state.signal} max={10} tone="signal" />
              <ResourceMeter label="Main Ammo" value={state.mainAmmo} max={state.maxMainAmmo} tone="ammo" />
              <ResourceMeter label="S-E Ammo" value={state.seAmmo} max={state.maxSeAmmo} tone="seammo" />
            </div>
            <div className="contract-slots">
              <div className="panel-title panel-title--compact">
                <span>CONTRACT SLOTS</span>
                <small>{state.contracts.length}/3</small>
              </div>
              {state.contracts.length === 0
                ? <div className="empty-slot">[EMPTY] No entity bound to the vehicle bus.</div>
                : state.contracts.map((contract) => <article key={contract.id} className={`module-card module-card--${contract.id.split('_').join('-')}`}>
                  <span className="module-card__band">[{contractLabels[contract.id]}]</span>
                  <strong>{contract.name}</strong>
                  <p>{contract.effect}</p>
                </article>)}
              <div className="empty-slot">SUPPORT: {selectedSupport.name}</div>
              <div className="empty-slot">MAIN: {selectedMainGun.name} / SUB: {selectedSubGun.name} / S-E: {selectedSE.name} ({state.seAmmo}/{state.maxSeAmmo})</div>
              <div className="empty-slot">GUARD: {state.encounter.guardActive ? 'ACTIVE' : 'OFF'}</div>
              <div className="empty-slot">SALVAGE CREDIT: {state.salvageCredits}</div>
            </div>
          </section>
        </section>

        <section className="system-event-panel">
          <div className="encounter-stinger">
            <span>{state.gamePhase.toUpperCase()}</span>
            <strong>{state.gamePhase === 'garage' ? 'MIDNIGHT BAY' : state.resultType ?? `ENCOUNTER ${state.encounterIndex + 1}/3`}</strong>
          </div>

          {state.gamePhase === 'garage' && <section className="event-card garage-grid-card">
            <div className="event-header">
              <div className="event-kicker">GARAGE // MIDNIGHT BAY</div>
              <span className="event-chip event-chip--route">LOADOUT READY</span>
            </div>
            <h2>Next Sortie Setup</h2>
            <p>M.O.E.: 「戻れたね。次は出る前に少し積み替えよっか。」</p>
            <div className="garage-columns">
              <div className="garage-block">
                <h3>Previous Run</h3>
                {state.previousRun
                  ? <div className="negotiation-grid">
                    <p><span>Result</span><strong>{state.previousRun.resultType}</strong></p>
                    <p><span>Encounters</span><strong>{state.previousRun.encountersCleared}</strong></p>
                    <p><span>Boss</span><strong>{state.previousRun.bossChallenged ? 'Challenged' : 'Avoided'}</strong></p>
                    <p><span>Contracts</span><strong>{state.previousRun.contractsAcquired}</strong></p>
                    <p><span>Salvage</span><strong>{state.previousRun.salvageGained}</strong></p>
                    <p><span>Remaining</span><strong>{state.previousRun.fuel}/{state.previousRun.armor}/{state.previousRun.signal}/{state.previousRun.mainAmmo}/{state.previousRun.seAmmo}</strong></p>
                  </div>
                  : <p>No previous run data</p>}
                <h3>Archive</h3>
                <div className="negotiation-grid">
                  <p><span>Chapter</span><strong>{state.story.chapter}</strong></p>
                  <p><span>M.O.E. Memory</span><strong>{state.story.moeMemory}</strong></p>
                  <p><span>Driver Clues</span><strong>{state.story.previousDriverClues}</strong></p>
                  <p><span>Recovered</span><strong>{state.story.recoveredLogs.length}/{storyLogCatalog.length}</strong></p>
                </div>
                <div className="next-node-list">
                  {storyLogCatalog.map((entry) => {
                    const unlocked = state.story.recoveredLogs.includes(entry.id);
                    return <div key={entry.id} className="next-node">
                      <span>{unlocked ? '◎' : '□'}</span>
                      <strong>{entry.id}: {entry.title}</strong>
                      <small>{unlocked ? entry.text : 'LOCKED'}</small>
                    </div>;
                  })}
                </div>
                <p>M.O.E.: 「断片が増えるほど、わたしの地図も変わる。」</p>
              </div>
              <div className="garage-block">
                <h3>Loadout</h3>
                <div className="garage-select-grid">
                  <button className={`command-button command-button--danger ${state.selectedLoadout.mainGunId === 'rusted_cannon' ? 'is-selected' : ''}`} onClick={() => dispatch({ type: 'GARAGE_SET_MAIN_GUN', id: 'rusted_cannon' })}>Rusted Cannon</button>
                  <button className={`command-button command-button--danger ${state.selectedLoadout.mainGunId === 'light_cannon' ? 'is-selected' : ''}`} onClick={() => dispatch({ type: 'GARAGE_SET_MAIN_GUN', id: 'light_cannon' })}>Light Cannon</button>
                  <button className={`command-button command-button--danger ${state.selectedLoadout.mainGunId === 'heavy_cannon' ? 'is-selected' : ''}`} onClick={() => dispatch({ type: 'GARAGE_SET_MAIN_GUN', id: 'heavy_cannon' })}>Heavy Cannon</button>

                  <button className={`command-button command-button--route ${state.selectedLoadout.subGunId === 'hood_mg' ? 'is-selected' : ''}`} onClick={() => dispatch({ type: 'GARAGE_SET_SUB_GUN', id: 'hood_mg' })}>Hood MG</button>
                  <button className={`command-button command-button--route ${state.selectedLoadout.subGunId === 'twin_mg' ? 'is-selected' : ''}`} onClick={() => dispatch({ type: 'GARAGE_SET_SUB_GUN', id: 'twin_mg' })}>Twin MG</button>
                  <button className={`command-button command-button--route ${state.selectedLoadout.subGunId === 'suppression_mg' ? 'is-selected' : ''}`} onClick={() => dispatch({ type: 'GARAGE_SET_SUB_GUN', id: 'suppression_mg' })}>Suppression MG</button>

                  <button className={`command-button command-button--contract ${state.selectedLoadout.specialEquipmentId === 'signal_harpoon' ? 'is-selected' : ''}`} onClick={() => dispatch({ type: 'GARAGE_SET_SPECIAL', id: 'signal_harpoon' })}>Signal Harpoon</button>
                  <button className={`command-button command-button--contract ${state.selectedLoadout.specialEquipmentId === 'micro_missile' ? 'is-selected' : ''}`} onClick={() => dispatch({ type: 'GARAGE_SET_SPECIAL', id: 'micro_missile' })}>Micro Missile</button>
                  <button className={`command-button command-button--contract ${state.selectedLoadout.specialEquipmentId === 'emp_flare' ? 'is-selected' : ''}`} onClick={() => dispatch({ type: 'GARAGE_SET_SPECIAL', id: 'emp_flare' })}>EMP Flare</button>

                  <button className={`command-button ${state.selectedLoadout.contractSupportId === 'empty' ? 'is-selected' : ''}`} onClick={() => dispatch({ type: 'GARAGE_SET_SUPPORT', id: 'empty' })}>Support: Empty</button>
                  <button className={`command-button ${state.selectedLoadout.contractSupportId === 'radio_voice' ? 'is-selected' : ''}`} onClick={() => dispatch({ type: 'GARAGE_SET_SUPPORT', id: 'radio_voice' })}>Support: Radio Voice</button>
                  <button className={`command-button ${state.selectedLoadout.contractSupportId === 'silent_shape' ? 'is-selected' : ''}`} onClick={() => dispatch({ type: 'GARAGE_SET_SUPPORT', id: 'silent_shape' })}>Support: Silent Shape</button>
                  <button className={`command-button ${state.selectedLoadout.contractSupportId === 'abandoned_ai_navi' ? 'is-selected' : ''}`} onClick={() => dispatch({ type: 'GARAGE_SET_SUPPORT', id: 'abandoned_ai_navi' })}>Support: AI Navi</button>
                </div>
              </div>
              <div className="garage-block">
                <h3>Growth Resources</h3>
                <div className="negotiation-grid">
                  <p><span>Driver XP</span><strong>{state.driverXpBank}</strong></p>
                  <p><span>M.O.E. Sync</span><strong>{state.moeSyncBank}</strong></p>
                  <p><span>Credits</span><strong>{state.creditBank}</strong></p>
                </div>
                <h3>Skill Growth (XP / Sync)</h3>
                <div className="garage-select-grid">
                  {skillOrder.map((skillId) => {
                    const level = state.skillLevels[skillId];
                    const cost = getSkillCost(level);
                    const isMoeSkill = skillId === 'scan_boost' || skillId === 'translation_assist';
                    const canBuy = (isMoeSkill ? state.moeSyncBank : state.driverXpBank) >= cost;
                    return <button
                      key={skillId}
                      className={`command-button ${level > 0 ? 'is-selected' : ''}`}
                      disabled={!canBuy}
                      onClick={() => dispatch({ type: 'PURCHASE_SKILL', upgrade: skillId })}
                      data-desc={`Lv${level} -> Lv${level + 1} / COST ${cost} ${isMoeSkill ? 'SYNC' : 'XP'}`}
                    >
                      {skillLabels[skillId]} <span>Lv{level}</span>
                    </button>;
                  })}
                </div>
                <h3>Vehicle Tuning (Credits)</h3>
                <div className="garage-select-grid">
                  {vehicleUpgradeOrder.map((upgradeId) => {
                    const level = state.vehicleUpgrades[upgradeId];
                    const cost = getVehicleUpgradeCost(level);
                    const canBuy = state.creditBank >= cost;
                    return <button
                      key={upgradeId}
                      className={`command-button command-button--route ${level > 0 ? 'is-selected' : ''}`}
                      disabled={!canBuy}
                      onClick={() => dispatch({ type: 'PURCHASE_VEHICLE_UPGRADE', id: upgradeId })}
                      data-desc={`Lv${level} -> Lv${level + 1} / COST ${cost} CREDIT`}
                    >
                      {vehicleUpgradeLabels[upgradeId]} <span>Lv{level}</span>
                    </button>;
                  })}
                </div>
                <h3>Starting Resources Preview</h3>
                <div className="negotiation-grid">
                  <p><span>Fuel</span><strong>{nextRunPreview.fuel}</strong></p>
                  <p><span>Armor</span><strong>{nextRunPreview.armor}</strong></p>
                  <p><span>Signal</span><strong>{nextRunPreview.signal}</strong></p>
                  <p><span>Main Ammo</span><strong>{nextRunPreview.mainAmmo}</strong></p>
                  <p><span>S-E Ammo</span><strong>{nextRunPreview.seAmmo}</strong></p>
                </div>
                <h3>Tonight's Deep Signal</h3>
                <p>TOLL GATE SAINT // armored / bargain / guard / toll demand</p>
                <p>M.O.E.: 「料金所型の強い反応。主砲弾かS-E弾、どっちかは残しておきたいね。」</p>
                <h3>AUTOPLAY LAB</h3>
                <div className="autoplay-controls">
                  <label>
                    Runs
                    <input
                      type="number"
                      min={10}
                      max={1000}
                      step={10}
                      value={autoplayRuns}
                      onChange={(event) => setAutoplayRuns(clamp(Number(event.target.value) || 10, 10, 1000))}
                    />
                  </label>
                  <label>
                    Strategy
                    <select value={autoplayStrategy} onChange={(event) => setAutoplayStrategy(event.target.value as AutoPlayStrategy)}>
                      <option value="balanced">Balanced</option>
                      <option value="aggressive">Aggressive</option>
                      <option value="safe">Safe</option>
                      <option value="contract">Contract</option>
                    </select>
                  </label>
                  <button className="command-button command-button--system" onClick={runAutoplay}>RUN AUTOPLAY</button>
                </div>
                {autoplayReport && <div className="autoplay-report">
                  <p><span>Runs</span><strong>{autoplayReport.runs}</strong></p>
                  <p><span>Win Rate</span><strong>{autoplayReport.winRate.toFixed(1)}%</strong></p>
                  <p><span>Boss Cleared</span><strong>{autoplayReport.counts['Boss Cleared']}</strong></p>
                  <p><span>Boss Avoided</span><strong>{autoplayReport.counts['Boss Avoided']}</strong></p>
                  <p><span>Early Return</span><strong>{autoplayReport.counts['Early Return']}</strong></p>
                  <p><span>Disabled</span><strong>{autoplayReport.counts['Vehicle Disabled']}</strong></p>
                  <p><span>Avg Encounter</span><strong>{autoplayReport.avgEncounters.toFixed(2)}</strong></p>
                  <p><span>Avg Contract</span><strong>{autoplayReport.avgContracts.toFixed(2)}</strong></p>
                  <p><span>Avg Salvage</span><strong>{autoplayReport.avgSalvage.toFixed(2)}</strong></p>
                  <p><span>Avg Fuel</span><strong>{autoplayReport.avgFuel.toFixed(2)}</strong></p>
                  <p><span>Avg Armor</span><strong>{autoplayReport.avgArmor.toFixed(2)}</strong></p>
                  <p><span>Avg Signal</span><strong>{autoplayReport.avgSignal.toFixed(2)}</strong></p>
                  <p><span>Avg S-E Ammo</span><strong>{autoplayReport.avgSeAmmo.toFixed(2)}</strong></p>
                </div>}
              </div>
            </div>
          </section>}

          {state.gamePhase === 'route_choice' && <section className="event-card">
            <div className="event-header">
              <div className="event-kicker">NIGHT LOOP ROUTE</div>
              <span className="event-chip event-chip--route">CHOOSE NEXT LANE</span>
            </div>
            <div className="next-node-list">
              {(['salvage', 'signal', 'push_forward', 'return_gate'] as const).map((lane) => <div key={lane} className="next-node">
                <span>◎</span>
                <strong>{routeIntelCatalog[lane].label}</strong>
                <small>likely: {routeIntelCatalog[lane].likelyEnemyTags}</small>
                <small>suggested: {routeIntelCatalog[lane].likelyWeaknesses}</small>
                <small>risk: {routeIntelCatalog[lane].riskTags} / reward: {routeIntelCatalog[lane].rewardTags}</small>
              </div>)}
            </div>
          </section>}

          {state.gamePhase === 'signal' && <section className="event-card">
            <div className="event-header">
              <div className="event-kicker">SIGNAL LANE</div>
              <span className="event-chip event-chip--route">BOOSTED</span>
            </div>
            <p>Signal boosted / NAVI Forecast temporarily enhanced ({state.tempForecastBoost > 1 ? '+2' : '+1'} lane gain).</p>
          </section>}

          {state.gamePhase === 'boss_preview' && <section className="event-card">
            <div className="event-header">
              <div className="event-kicker">BOSS PREVIEW</div>
              <span className="event-chip event-chip--danger">DEEP SIGNAL</span>
            </div>
            <h2>Toll Gate Saint</h2>
            <div className="next-node-list">
              <div className="next-node"><span>▲</span><strong>Traits</strong><small>armored / bargain / guard / toll demand</small></div>
              <div className="next-node"><span>▲</span><strong>Likely</strong><small>{bossIntel.likelyEnemyTags}</small></div>
              <div className="next-node"><span>▲</span><strong>Suggested Weakness</strong><small>{bossIntel.likelyWeaknesses}</small></div>
              <div className="next-node"><span>▲</span><strong>Risk / Reward</strong><small>{bossIntel.riskTags} / {bossIntel.rewardTags}</small></div>
            </div>
            <p>M.O.E.: 「主砲弾かS-E弾が足りないなら、帰るのも正解。」</p>
          </section>}

          {(state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') && <section className="event-card">
            <div className="event-header">
              <div className="event-kicker">NAVI FORECAST</div>
              <span className={`event-chip ${state.encounter.forecastUnstable ? 'event-chip--danger' : 'event-chip--route'}`}>
                {hasAiNaviContract(state.contracts)
                  ? 'AI NAVI +2'
                  : state.selectedLoadout.contractSupportId === 'abandoned_ai_navi'
                    ? 'SUPPORT NAVI +1'
                    : 'TURN +1'}
              </span>
            </div>
            <div className="next-node-list">
              {aliveEnemies.map((enemy) => <div key={`forecast-${enemy.id}`} className="next-node">
                <span>◎</span>
                <strong>{enemy.name}</strong>
                <small>{(state.encounter.forecast[enemy.id] ?? []).map((intent, idx) => `T+${idx + 1}:${intent}`).join(' / ') || 'NO DATA'}</small>
              </div>)}
            </div>
            <div className="next-node-list">
              {state.encounterPrep.approachLabel && <div className="next-node"><span>▲</span><strong>{state.encounterPrep.approachLabel}</strong><small>Approach effect active</small></div>}
              {state.encounterPrep.firstStrike && <div className="next-node"><span>▲</span><strong>FIRST STRIKE</strong><small>Preemptive hit applied</small></div>}
              {state.encounterPrep.talkPrepared && <div className="next-node"><span>▲</span><strong>TALK BOOST</strong><small>First Talk bonus +{Math.round(state.encounterPrep.firstTalkBonus * 100)}%</small></div>}
              {state.encounterPrep.ambushed && <div className="next-node"><span>▲</span><strong>AMBUSHED</strong><small>Opening disadvantage applied</small></div>}
              {state.encounterPrep.intentDisrupted && <div className="next-node"><span>▲</span><strong>INTENT DISRUPTED</strong><small>Opening hostile intent weakened</small></div>}
            </div>
            {state.encounter.forecastUnstable && <p className="event-layer__system">WARNING: FORECAST RELIABILITY UNSTABLE</p>}
          </section>}

          {state.gamePhase === 'reward' && <section className="event-card">
            <div className="event-header">
              <div className="event-kicker">SALVAGE RESULT</div>
              <span className="event-chip event-chip--route">REPORT</span>
            </div>
            {state.lastReport && <div className="negotiation-grid">
              <p><span>Defeated</span><strong>{state.lastReport.defeated}</strong></p>
              <p><span>Contracted</span><strong>{state.lastReport.contracted}</strong></p>
              <p><span>Fled</span><strong>{state.lastReport.fled}</strong></p>
              <p><span>Escaped</span><strong>{state.lastReport.escaped ? 'YES' : 'NO'}</strong></p>
            </div>}
          </section>}

          {state.gamePhase === 'return_gate' && <section className="event-card">
            <div className="event-header">
              <div className="event-kicker">RETURN GATE</div>
              <span className="event-chip event-chip--route">LOCK ACQUIRED</span>
            </div>
            <p>RETURN GATE LOCK ACQUIRED</p>
            <div className="negotiation-grid">
              <p><span>Fuel</span><strong>{state.fuel}</strong></p>
              <p><span>Armor</span><strong>{state.armor}</strong></p>
              <p><span>Signal</span><strong>{state.signal}</strong></p>
              <p><span>Main Ammo</span><strong>{state.mainAmmo}</strong></p>
              <p><span>S-E Ammo</span><strong>{state.seAmmo}</strong></p>
            </div>
          </section>}

          {(state.gamePhase === 'result' || state.gamePhase === 'game_over') && <section className="event-card event-card--result">
            <div className="event-header">
              <div className="event-kicker">{state.gamePhase === 'result' ? 'RUN COMPLETE' : 'SIGNAL LOST'}</div>
              <span className={`event-chip ${state.gamePhase === 'result' ? 'event-chip--route' : 'event-chip--danger'}`}>{state.resultType ?? 'Vehicle Disabled'}</span>
            </div>
            <h2>{state.resultType ?? 'Vehicle Disabled'}</h2>
            <div className="negotiation-grid">
              <p><span>Encounters cleared</span><strong>{state.runSummary.cleared}</strong></p>
              <p><span>Boss challenged</span><strong>{state.bossChallenged ? 'YES' : 'NO'}</strong></p>
              <p><span>Contracts acquired</span><strong>{state.runSummary.contracted}</strong></p>
              <p><span>Salvage gained</span><strong>{state.salvageCredits}</strong></p>
              <p><span>Fuel / Armor</span><strong>{state.fuel} / {state.armor}</strong></p>
              <p><span>Signal / Main / S-E</span><strong>{state.signal} / {state.mainAmmo} / {state.seAmmo}</strong></p>
              <p><span>Driver XP gained</span><strong>{runGrowth.driverXp}</strong></p>
              <p><span>M.O.E. Sync gained</span><strong>{runGrowth.moeSync}</strong></p>
              <p><span>Salvage Credit gained</span><strong>{runGrowth.salvageCreditGain}</strong></p>
            </div>
            <div className="command-window">
              <p>次Run前に Garage で成長・改装できます。</p>
              <p>見込み獲得: Driver XP +{runGrowth.driverXp} / M.O.E. Sync +{runGrowth.moeSync} / Credit +{runGrowth.salvageCreditGain}</p>
            </div>
            <div className="command-window">
              <div className="panel-title panel-title--compact">
                <span>RECOVERED LOG</span>
                <small>{state.story.recentRecoveredLogs.length > 0 ? `${state.story.recentRecoveredLogs.length} NEW` : 'NO NEW'}</small>
              </div>
              {state.story.recentRecoveredLogs.length > 0
                ? <div className="next-node-list">
                  {state.story.recentRecoveredLogs.map((id) => <div key={`recent-${id}`} className="next-node">
                    <span>◎</span>
                    <strong>{id}: {storyLogById[id].title}</strong>
                    <small>{storyLogById[id].text}</small>
                  </div>)}
                </div>
                : <p>No new story logs recovered this run.</p>}
            </div>
          </section>}
        </section>
      </main>
    </div>
  </div>;
}
