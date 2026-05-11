import type {
  ConversationDemand,
  ResourceCost,
  TalkAttitude,
  TalkMood,
  TalkPersona,
} from './talkTypes';
import type { EncounterIdValue } from './encounterIds';

export type ContractId = 'radio_voice' | 'silent_shape' | 'abandoned_ai_navi';
export type TerminalLogKind = 'warning' | 'contract' | 'damage' | 'system' | 'route';
export type EncounterId = EncounterIdValue;
export type CommandId = 'main_gun' | 'sub_gun' | 'se_harpoon' | 'analyze' | 'talk' | 'contract' | 'ram' | 'guard' | 'escape';
export type AffinityType = 'ballistic' | 'suppressive' | 'impact' | 'signal' | 'talk';
export type AffinityRating = 'weak' | 'normal' | 'resist';
export type DevilAffinity = Record<AffinityType, AffinityRating>;
export type MainGunId =
  | 'rusted_cannon'
  | 'light_cannon'
  | 'needle_cannon'
  | 'heavy_cannon'
  | 'siege_cannon'
  | 'burst_cannon'
  | 'rail_cannon'
  | 'sigil_driver';
export type SubGunId =
  | 'hood_mg'
  | 'twin_mg'
  | 'intent_jammer'
  | 'suppression_mg'
  | 'road_sweeper'
  | 'crowd_mg'
  | 'counter_pod'
  | 'mercy_pod';
export type SpecialEquipmentId =
  | 'signal_harpoon'
  | 'scan_beacon'
  | 'micro_missile'
  | 'emp_flare'
  | 'binding_flare'
  | 'jammer_pulse'
  | 'decoy_beacon'
  | 'saint_anchor';
export type ContractSupportId = 'none' | ContractId;
export type Temperament = 'hungry' | 'proud' | 'lonely' | 'machine' | 'hostile' | 'curious';
export type Intent = 'attack' | 'curse' | 'bargain' | 'guard' | 'flee';
export type EncounterPhase = 'command' | 'conversation' | 'resolving' | 'finished';
export type GamePhase =
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

export type ResultType = 'Early Return' | 'Boss Cleared' | 'Boss Avoided' | 'Vehicle Disabled';
export type RewardTarget = 'encounter2' | 'boss';
export type RewardScope = 'post_enc1' | 'post_enc2';

export type ContractModule = { id: ContractId; name: string; effect: string };
export type ForecastMap = Record<string, Intent[]>;
export type RewardOption = {
  id: string;
  label: string;
  detail: string;
  fuel?: number;
  armor?: number;
  signal?: number;
  mainAmmo?: number;
  seAmmo?: number;
  salvageContext?: string;
  salvageConsequence?: string;
  salvagePriority?: 'critical' | 'useful' | 'prep' | 'event';
  salvageTags?: string[];
};
export type MainGun = { id: MainGunId; name: string; damage: number; ammo: number; effect?: 'intel' | 'contract'; description: string };
export type SubGun = { id: SubGunId; name: string; damage: number; mode: 'all' | 'random_hits'; hits?: number; softenChance?: number; pressureMode?: 'build' | 'cool'; description: string };
export type SpecialEquipment = { id: SpecialEquipmentId; name: string; damage: number; seAmmoCost: number; ammo: number; effect: 'interest' | 'all_damage' | 'emp' | 'analyze_lock' | 'contract_window' | 'boss_breaker'; description: string };
export type ContractSupport = { id: ContractSupportId; name: string; description: string };
export type Loadout = {
  mainGunId: MainGunId;
  subGunId: SubGunId;
  specialEquipmentId: SpecialEquipmentId;
  contractSupportId: ContractSupportId;
};

export type Devil = {
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
  intelProgress: number;
  intelThreshold: number;
  analyzeVulnerableTurns?: number;
  talkBreakTurns?: number;
  profile: EncounterId;
  empDisabledTurns: number;
  exit?: 'defeated' | 'contracted' | 'fled';
  talkPersona?: TalkPersona;
};

export type ConversationEffect =
  | { type: 'trust'; amount: number }
  | { type: 'interest'; amount: number }
  | { type: 'pressure'; amount: number }
  | { type: 'openContractWindow' }
  | { type: 'revealAffinity' }
  | { type: 'revealIntent' }
  | { type: 'routeHint' }
  | { type: 'bossTraitHint' }
  | { type: 'recover'; resource: 'fuel' | 'armor' | 'signal' | 'mainAmmo'; amount: number }
  | { type: 'enemyLeaves' }
  | { type: 'cancelNextIntent' }
  | { type: 'storyLog'; logId: StoryLogId }
  | { type: 'moeSync'; amount: number };

export type ConversationChoice = {
  id: string;
  label: string;
  playerLine: string;
  successText: string;
  failText: string;
  preferredTemperaments?: Temperament[];
  affinityType?: AffinityType;
  attitude?: TalkAttitude;
  demand?: ConversationDemand;
  hintKey?: string;
  successBias?: number;
  cost?: ResourceCost;
  effectsOnSuccess?: ConversationEffect[];
  effectsOnFail?: ConversationEffect[];
};

export type DevilConversationProfile = {
  introLine: string;
  choices: ConversationChoice[];
  contractOfferLine?: string;
  refusalLine?: string;
  moeHint?: string;
};

export type EncounterState = {
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

export type ActiveConversation = {
  enemyId: string;
  enemyProfile: EncounterId;
  introLine: string;
  choices: ConversationChoice[];
  mood?: TalkMood;
  persona?: TalkPersona;
  demand?: ConversationDemand;
  seed?: string;
};

export type EncounterReport = {
  wave: number;
  defeated: number;
  contracted: number;
  fled: number;
  escaped: boolean;
};

export type RunSummary = {
  cleared: number;
  defeated: number;
  contracted: number;
  escaped: number;
};

export type PreviousRunSummary = {
  stage: number;
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

export type AutoPlayStrategy = 'balanced' | 'aggressive' | 'safe' | 'contract';
export type AutoPlayReport = {
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

export type SfxCue =
  | 'run_start'
  | 'scan_ok'
  | 'scan_fail'
  | 'command'
  | 'hit'
  | 'contract'
  | 'warning'
  | 'reward'
  | 'result'
  | 'game_over'
  | 'garage_enter';

export type HitFxTone = 'weak' | 'resist' | 'hit';
export type DamagePop = {
  id: number;
  enemyId: string;
  amount: number;
};
export type CombatFxCue =
  | 'player_shot'
  | 'subgun_spray'
  | 'signal_burst'
  | 'analyze_scan'
  | 'talk_ping'
  | 'guard'
  | 'enemy_attack'
  | 'enemy_curse';

export type StoryLogId = 'LOG_00' | 'LOG_01' | 'LOG_02' | 'LOG_03' | 'LOG_04';
export type StoryLogEntry = { id: StoryLogId; title: string; text: string };
export type StoryState = {
  chapter: number;
  recoveredLogs: StoryLogId[];
  moeMemory: number;
  previousDriverClues: number;
  recentRecoveredLogs: StoryLogId[];
};

export type ApproachKind = EncounterState['kind'];
export type ApproachOption = 'preemptive_main_gun' | 'hit_and_run_ram' | 'silent_coast' | 'open_channel';
export type UpgradeId = 'ram_control' | 'gunnery' | 'scan_boost' | 'translation_assist' | 'signal_tuning';
export type VehicleUpgradeId = 'fuel_tank' | 'armor_plating' | 'ammo_rack' | 'se_rack' | 'signal_antenna' | 'noise_filter' | 'daemon_bus';
export type SkillLevels = Record<UpgradeId, number>;
export type VehicleUpgradeLevels = Record<VehicleUpgradeId, number>;
export type UnlockState = {
  mainGuns: MainGunId[];
  subGuns: SubGunId[];
  specialEquipment: SpecialEquipmentId[];
  support: ContractSupportId[];
  vehicleUpgrades: VehicleUpgradeId[];
};
export type ApproachState = {
  pendingKind: ApproachKind;
  scanSuccess: boolean;
  scanChance: number;
  lineup: EncounterId[];
};
export type EncounterPrep = {
  approachLabel?: string;
  firstStrike: boolean;
  firstStrikeDamage?: number;
  ambushed: boolean;
  talkPrepared: boolean;
  intentDisrupted: boolean;
  firstTalkBonus: number;
  firstTalkPending: boolean;
};

export type RouteState = {
  stageRouteId: string;
  currentNodeId: string;
  visitedNodeIds: string[];
  currentEventId?: string;
  lastReturnCheckpointId?: string;
  returnIntent?: 'none' | 'backtracking' | 'extracting';
};

export type ActiveSupportDaemon = {
  id: EncounterId;
  name: string;
  profile: EncounterId;
  temperament: Temperament;
  effectLabel: string;
  expiresAt: 'run_end';
};

export type State = {
  stage: number;
  stageCount: number;
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
  routeState?: RouteState;
  rewardTarget?: RewardTarget;
  rewardScope?: RewardScope;
  negotiationRewards: string[];
  routeBoostReward: boolean;
  tempForecastBoost: number;
  lastReport?: EncounterReport;
  runSummary: RunSummary;
  resultType?: ResultType;
  bossChallenged: boolean;
  moeLine: string;
  selectedLoadout: Loadout;
  activeSupportDaemon?: ActiveSupportDaemon;
  activeConversation?: ActiveConversation;
  previousRun?: PreviousRunSummary;
  approach?: ApproachState;
  encounterPrep: EncounterPrep;
  skillLevels: SkillLevels;
  vehicleUpgrades: VehicleUpgradeLevels;
  unlocks: UnlockState;
  driverXpBank: number;
  moeSyncBank: number;
  creditBank: number;
  growthClaimed: boolean;
  analyzeSuccessCount: number;
  story: StoryState;
};

export type Action =
  | { type: 'ADVANCE_PROLOGUE' }
  | { type: 'START_ENGINE' }
  | { type: 'APPROACH_CHOOSE'; option: ApproachOption }
  | { type: 'APPROACH_CONTINUE' }
  | { type: 'PURCHASE_SKILL'; upgrade: UpgradeId }
  | { type: 'PURCHASE_VEHICLE_UPGRADE'; id: VehicleUpgradeId }
  | { type: 'PURCHASE_UNLOCK'; id: string }
  | { type: 'SELECT_ENEMY'; enemyId: string }
  | { type: 'SELECT_COMMAND'; command: CommandId }
  | { type: 'TALK_CHOOSE'; choiceId: string }
  | { type: 'TALK_CANCEL' }
  | { type: 'EXECUTE_COMMAND'; command?: CommandId }
  | { type: 'REWARD_CONTINUE' }
  | { type: 'ROUTE_CHOICE'; lane: 'salvage' | 'signal' | 'push_forward' | 'return_gate' }
  | { type: 'ROUTE_NODE_CHOOSE'; nodeId: string }
  | { type: 'SALVAGE_PICK'; rewardId: string }
  | { type: 'SIGNAL_ROUTE_CHOICE'; choiceId: 'analyze_trace' | 'hold_lane' | 'open_radio' }
  | { type: 'SIGNAL_CONTINUE' }
  | { type: 'BOSS_PREVIEW_CHOICE'; choice: 'challenge' | 'emergency_salvage' | 'return_gate' }
  | { type: 'RETURN_BACKTRACK' }
  | { type: 'RETURN_EXTRACT' }
  | { type: 'RETURN_TO_SURFACE' }
  | { type: 'OPEN_GARAGE' }
  | { type: 'GARAGE_SET_MAIN_GUN'; id: MainGunId }
  | { type: 'GARAGE_SET_SUB_GUN'; id: SubGunId }
  | { type: 'GARAGE_SET_SPECIAL'; id: SpecialEquipmentId }
  | { type: 'GARAGE_SET_SUPPORT'; id: ContractSupportId }
  | { type: 'GARAGE_SET_STAGE'; stage: number }
  | { type: 'GARAGE_ENTER_RUN' }
  | { type: 'DEBUG_RESTORE'; snapshot: State }
  | { type: 'START_NEXT_RUN' }
  | { type: 'RETRY' };
