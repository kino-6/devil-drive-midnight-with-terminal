import { getBalanceConfig } from '../../balanceConfig';
import { getDialogueLine } from '../../dialogueConfig';
import {
  getEncounterScenario,
  getMoeLine,
  getScenarioLine,
} from '../../scenario/scenarioLoader';
import { getDevilConfig } from '../../devilConfig';
import { loadSaveData } from '../../saveSystem';
import {
  type Action,
  type AffinityRating,
  type AffinityType,
  type ApproachKind,
  type AutoPlayReport,
  type AutoPlayStrategy,
  type ContractModule,
  type ContractSupportId,
  type Devil,
  type EncounterId,
  type EncounterPrep,
  type EncounterReport,
  type EncounterState,
  type ForecastMap,
  type GamePhase,
  type Intent,
  type Loadout,
  type PreviousRunSummary,
  type ResultType,
  type RewardOption,
  type RunSummary,
  type SfxCue,
  type State,
  type StoryLogId,
  type StoryState,
  type TerminalLogKind,
  type VehicleUpgradeLevels,
} from '../../game/types';
import {
  affinityOrder,
  contractSupportCatalog,
  defaultLoadout,
  defaultSkillLevels,
  defaultVehicleUpgrades,
  emergencyRewardCatalog,
  rewardCatalog,
  storyLogById,
} from '../../game/catalogs';
import {
  appendSupportDaemonDisconnectLogs,
  clamp,
  devilTemplates,
  getMainGunSpec,
  getSpecialEquipmentSpec,
  getSubGunSpec,
  isAlive,
} from '../../game/runtimeHelpers';
import { resolveExecuteCommand, resolveTalkChoice } from './combatReducer';
import { runAutoplayBatchWithDeps } from './stateAutoplay';
import { sanitizeRestoredStateWithDeps } from './stateRestore';

const pickRewardChoices = (pool: RewardOption[], count = 3): RewardOption[] => {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

const createInitialStoryState = (): StoryState => ({
  chapter: 1,
  recoveredLogs: [],
  moeMemory: 0,
  previousDriverClues: 0,
  recentRecoveredLogs: [],
});

export const hasAiNaviContract = (contracts: ContractModule[]) => contracts.some((module) => module.id === 'abandoned_ai_navi');

export const getRunStartResources = (loadout: Loadout, vehicleUpgrades: VehicleUpgradeLevels = defaultVehicleUpgrades) => ({
  fuel: getBalanceConfig().resources.baseFuel + vehicleUpgrades.fuel_tank,
  armor: getBalanceConfig().resources.baseArmor + vehicleUpgrades.armor_plating,
  signal: getBalanceConfig().resources.baseSignal,
  mainAmmo: getMainGunSpec(loadout.mainGunId).ammo + vehicleUpgrades.ammo_rack,
  maxMainAmmo: getMainGunSpec(loadout.mainGunId).ammo + vehicleUpgrades.ammo_rack,
  seAmmo: getSpecialEquipmentSpec(loadout.specialEquipmentId).ammo + vehicleUpgrades.se_rack,
  maxSeAmmo: getSpecialEquipmentSpec(loadout.specialEquipmentId).ammo + vehicleUpgrades.se_rack,
});

const lineupByKind = (kind: ApproachKind): EncounterId[] =>
  kind === 'enc1'
    ? [...getDevilConfig().lineups.enc1]
    : kind === 'enc2'
      ? [...getDevilConfig().lineups.enc2]
      : [...getDevilConfig().lineups.boss];

const pickEncounterEnemyCount = (kind: EncounterState['kind'], stage: number, available: number): number => {
  if (kind === 'boss') return Math.min(1, available);
  if (available <= 1) return available;
  if (stage <= 1) return Math.random() < 0.55 ? 1 : Math.min(2, available);
  if (stage === 2) return Math.random() < 0.35 ? 2 : Math.min(3, available);
  if (stage === 3) return Math.random() < 0.2 ? 2 : Math.min(3, available);
  return Math.random() < 0.1 ? 2 : Math.min(3, available);
};

const pickEncounterLineup = (kind: EncounterState['kind'], stage: number): EncounterId[] => {
  const pool = lineupByKind(kind);
  if (pool.length <= 1) return pool;
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const count = pickEncounterEnemyCount(kind, stage, shuffled.length);
  return shuffled.slice(0, Math.max(1, count));
};

const createEmptyEncounterPrep = (): EncounterPrep => ({
  firstStrike: false,
  ambushed: false,
  talkPrepared: false,
  intentDisrupted: false,
  firstTalkBonus: 0,
  firstTalkPending: false,
});

type StageProfile = {
  id: number;
  label: string;
  subtitle: string;
  hoverHint: string;
  recommendedScore: number;
};

export const stageProfiles: StageProfile[] = [
  {
    id: 1,
    label: 'STAGE 1 // MIDNIGHT ENTRY',
    subtitle: '浅層ランプ帯 / 交通霊は軽量',
    hoverHint: '入口帯。交渉ルートを試すならここ。',
    recommendedScore: 24,
  },
  {
    id: 2,
    label: 'STAGE 2 // OVERPASS VEIL',
    subtitle: '中層高架 / 妨害反応が増える',
    hoverHint: '中層。装甲とSignal管理が問われる。',
    recommendedScore: 30,
  },
  {
    id: 3,
    label: 'STAGE 3 // TOLL SHADOW',
    subtitle: '深層料金帯 / Boss反応が濃い',
    hoverHint: '深層手前。主砲弾とS-Eの温存が鍵。',
    recommendedScore: 36,
  },
  {
    id: 4,
    label: 'STAGE 4 // ABYSS LOOP',
    subtitle: '最深層封鎖域 / 帰還難度高',
    hoverHint: '解放済み最深層。突破より帰還計画を。',
    recommendedScore: 42,
  },
];

export const getStageProfile = (stage: number): StageProfile =>
  stageProfiles.find((profile) => profile.id === stage) ?? stageProfiles[stageProfiles.length - 1];

const getScanChance = (state: State, kind: ApproachKind, lineup: EncounterId[]): number => {
  const scan = getBalanceConfig().scan;
  let chance = scan.baseChance;
  if (state.selectedLoadout.contractSupportId === 'abandoned_ai_navi') chance += scan.aiSupportBonus;
  if (state.signal >= scan.highSignalThreshold) chance += scan.highSignalBonus;
  if (kind === 'boss') chance -= scan.bossPenalty;
  if (lineup.includes('silent_shape')) chance -= scan.stealthPenalty;
  chance += state.skillLevels.scan_boost * scan.scanBoostPerLevel;
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

const getIntelThreshold = (profile: EncounterId) => (profile === 'toll_gate_saint' ? 170 : 100);
const getIntelRevealThreshold = (threshold: number) => Math.floor(threshold * 0.35);
const getIntelAffinityThreshold = (threshold: number) => Math.floor(threshold * 0.7);
export const isBossProfile = (profile: EncounterId) => profile === 'toll_gate_saint';

const getPersistedIntelProgress = (profile: EncounterId): number => {
  const archive = loadSaveData().demonArchive;
  const entry = archive[profile];
  if (!entry) return 0;
  return Math.max(0, Math.floor(entry.intelProgress ?? 0));
};

const buildDevil = (kind: EncounterId, index: number, stage = 1): Devil => {
  const t = devilTemplates()[kind];
  const stageHpBonus = t.profile === 'toll_gate_saint'
    ? (stage - 1) * 5
    : (stage - 1) * 2;
  const scaledMaxHp = t.maxHp + stageHpBonus;
  const intelThreshold = getIntelThreshold(t.profile);
  const persistedIntel = Math.min(intelThreshold, getPersistedIntelProgress(t.profile));
  const revealed = isBossProfile(t.profile) || persistedIntel >= getIntelRevealThreshold(intelThreshold);
  const affinityRevealed = persistedIntel >= getIntelAffinityThreshold(intelThreshold);
  return {
    id: `${kind}-${index}`,
    name: t.name,
    maxHp: scaledMaxHp,
    hp: scaledMaxHp,
    temperament: t.temperament,
    intent: nextIntent(t.profile),
    contractable: t.contractable,
    revealed,
    targetModuleId: t.targetModuleId,
    trust: 0,
    pressure: 0,
    interest: 0,
    guardStacks: 0,
    contractWindow: false,
    armored: t.armored,
    affinities: { ...t.affinities },
    affinityRevealed,
    intelProgress: persistedIntel,
    intelThreshold,
    profile: t.profile,
    empDisabledTurns: 0,
  };
};

const buildForecast = (
  enemies: Devil[],
  hasAiNaviModule: boolean,
  supportId: ContractSupportId,
  activeSupportProfile?: EncounterId,
  extraTurns = 0,
): { forecast: ForecastMap; unstable: boolean } => {
  const supportTurns = supportId === 'abandoned_ai_navi' ? 1 : 0;
  const daemonTurns = activeSupportProfile === 'abandoned_ai_navi' ? 1 : 0;
  const horizon = 1 + extraTurns + (hasAiNaviModule ? 2 : 0) + supportTurns;
  const horizonWithDaemon = horizon + daemonTurns;
  const forecast: ForecastMap = {};
  for (const enemy of enemies.filter(isAlive)) {
    forecast[enemy.id] = Array.from({ length: horizonWithDaemon }, () => nextIntent(enemy.profile));
  }
  const unstableSource = hasAiNaviModule || supportId === 'abandoned_ai_navi' || activeSupportProfile === 'abandoned_ai_navi';
  const unstable = unstableSource && Math.random() < (activeSupportProfile === 'abandoned_ai_navi' ? 0.1 : 0.2);
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
  activeSupportProfile: EncounterId | undefined,
  extraForecast = 0,
  stage = 1,
  lineupOverride?: EncounterId[],
): EncounterState => {
  const lineup = lineupOverride && lineupOverride.length > 0 ? lineupOverride : pickEncounterLineup(kind, stage);
  const enemies = lineup.map((id, i) => buildDevil(id, i, stage));
  const { forecast, unstable } = buildForecast(enemies, hasAiNaviContract(contracts), supportId, activeSupportProfile, extraForecast);
  const analyzedEnemyIds = enemies
    .filter((enemy) => enemy.intelProgress >= enemy.intelThreshold)
    .map((enemy) => enemy.id);
  return {
    kind,
    enemies,
    selectedEnemyId: enemies[0]?.id ?? '',
    selectedCommand: 'analyze',
    turn: 1,
    phase: 'command',
    guardActive: false,
    analyzedEnemyIds,
    forecast,
    forecastUnstable: unstable,
    supportArmorGuardReady: supportId === 'silent_shape' || activeSupportProfile === 'silent_shape',
  };
};

export const getSelectedEnemy = (encounter: EncounterState): Devil | undefined =>
  encounter.enemies.find((enemy) => enemy.id === encounter.selectedEnemyId && enemy.hp > 0) ?? encounter.enemies.find(isAlive);

const canOpenContractWindow = (enemy: Devil) =>
  enemy.interest >= 2 || enemy.trust >= 2 || (enemy.trust >= 1 && enemy.interest >= 1) || (enemy.hp <= enemy.maxHp / 2 && enemy.pressure >= 1);

const meetsContractCondition = (enemy: Devil) =>
  enemy.contractWindow && (enemy.trust >= 2 || enemy.interest >= 2 || (enemy.hp <= enemy.maxHp / 2 && enemy.pressure >= 1));

export const getContractHint = (enemy: Devil): string => {
  if (enemy.profile === 'toll_gate_saint') return 'Hint: trust>=2 or hp<=50% with pressure';
  if (enemy.temperament === 'hungry') return 'Hint: Offer / interest line';
  if (enemy.temperament === 'machine') return 'Hint: Logic / signal pin';
  if (enemy.temperament === 'lonely') return 'Hint: trust line';
  if (enemy.temperament === 'proud') return 'Hint: trust + pressure';
  if (enemy.temperament === 'curious') return 'Hint: interest + trust mix';
  return 'Hint: weaken then force contract window';
};


const computeAffinityDamage = (baseDamage: number, rating: AffinityRating) => {
  const affinity = getBalanceConfig().affinity;
  if (baseDamage <= 0) return 0;
  if (rating === 'weak') return Math.max(1, Math.floor(baseDamage * affinity.weakMultiplier));
  if (rating === 'resist') return Math.max(1, Math.floor(baseDamage * affinity.resistMultiplier));
  return baseDamage;
};

export const damageVarianceByCommand = {
  main_gun: 0.2,
  sub_gun: 0.28,
  se_harpoon: 0.24,
  ram: 0.18,
  approach_main_gun: 0.22,
} as const;

export const getRollBounds = (adjustedBase: number, variance: number) => {
  if (adjustedBase <= 0) return { min: 0, max: 0 };
  const min = Math.max(1, Math.floor(adjustedBase * (1 - variance)));
  const max = Math.max(min, Math.ceil(adjustedBase * (1 + variance)));
  return { min, max };
};

const rollInt = (min: number, max: number) =>
  min + Math.floor(Math.random() * (max - min + 1));

export const resolveDamageRoll = ({
  baseDamage,
  affinity,
  variance,
  flatReduction = 0,
  armored = false,
}: {
  baseDamage: number;
  affinity: AffinityRating;
  variance: number;
  flatReduction?: number;
  armored?: boolean;
}) => {
  const adjustedBase = computeAffinityDamage(baseDamage, affinity);
  const rawBounds = getRollBounds(adjustedBase, variance);
  const armorReduction = armored ? 1 : 0;
  const totalReduction = flatReduction + armorReduction;
  const min = Math.max(0, rawBounds.min - totalReduction);
  const max = Math.max(min, rawBounds.max - totalReduction);
  const damage = max > min ? rollInt(min, max) : min;
  return { min, max, damage };
};

export const getAffinityTag = (rating: AffinityRating) => {
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

export const getLikelyWeaknessSummary = (profile: EncounterId): string => {
  const affinities = devilTemplates()[profile].affinities;
  const weak = affinityOrder.filter((affinity) => affinities[affinity] === 'weak');
  if (weak.length === 0) return 'No clear weakness';
  return weak.map((affinity) => affinityToCommandLabel[affinity]).join(' / ');
};

const getEncounterIntroLine = (profile: EncounterId): string | undefined =>
  getScenarioLine(getEncounterScenario(profile)?.intro);

const getTalkTendencyFor = (profile: EncounterId) => devilTemplates()[profile].talkTendency;

const applyTalkTemperament = (enemy: Devil): Devil => {
  const tendency = getTalkTendencyFor(enemy.profile);
  if (enemy.temperament === 'hungry') {
    return {
      ...enemy,
      interest: enemy.interest + 2 + (tendency?.interestBonus ?? 0),
      trust: enemy.trust + (tendency?.trustBonus ?? 0),
    };
  }
  if (enemy.temperament === 'lonely') {
    return {
      ...enemy,
      trust: enemy.trust + 2 + (tendency?.trustBonus ?? 0),
      interest: enemy.interest + (tendency?.interestBonus ?? 0),
    };
  }
  if (enemy.temperament === 'machine') {
    return {
      ...enemy,
      interest: enemy.interest + 1 + (tendency?.interestBonus ?? 0),
      trust: enemy.trust + 1 + (tendency?.trustBonus ?? 0),
    };
  }
  if (enemy.temperament === 'proud') {
    return {
      ...enemy,
      trust: enemy.trust + 1 + (tendency?.trustBonus ?? 0),
      pressure: enemy.pressure + 1,
      interest: enemy.interest + (tendency?.interestBonus ?? 0),
    };
  }
  if (enemy.temperament === 'curious') {
    return {
      ...enemy,
      interest: enemy.interest + 1 + (tendency?.interestBonus ?? 0),
      trust: enemy.trust + 1 + (tendency?.trustBonus ?? 0),
    };
  }
  return {
    ...enemy,
    pressure: enemy.pressure + 1,
    interest: enemy.interest + 1 + (tendency?.interestBonus ?? 0),
    trust: enemy.trust + (tendency?.trustBonus ?? 0),
  };
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

export const classifyLog = (log: string): TerminalLogKind => {
  if (log.includes('CONTRACT') || log.includes('MODULE')) return 'contract';
  if (log.includes('ARMOR -') || log.includes('FUEL -') || log.includes('IMPACT') || log.includes('DAMAGE') || log.includes('DISABLED')) return 'damage';
  if (log.includes('WARNING') || log.includes('CURSE') || log.includes('ANOMALY')) return 'warning';
  if (log.includes('RUN START') || log.includes('ENCOUNTER') || log.includes('REWARD') || log.includes('RETURN GATE') || log.includes('FORECAST')) return 'route';
  return 'system';
};

export const getLogBadge = (kind: TerminalLogKind) => {
  if (kind === 'warning') return 'WARN';
  if (kind === 'contract') return 'CNTR';
  if (kind === 'damage') return 'DMG';
  if (kind === 'route') return 'ROUTE';
  return 'SYS';
};

export const getPseudoTimecode = (index: number, total: number, wave: number, turn: number) => {
  const recentStart = Math.max(0, total - 14);
  const localOrder = Math.max(0, index - recentStart);
  const elapsedSec = wave * 22 + Math.max(0, turn - 1) * 3 + localOrder * 0.6;
  return `+${elapsedSec.toFixed(1)}s`;
};

export const pickSfxCueFromLog = (log: string, phase: GamePhase): SfxCue | undefined => {
  if (phase === 'garage') return 'garage_enter';
  if (phase === 'game_over') return 'game_over';
  if (log.includes('RUN START')) return 'run_start';
  if (log.includes('APPROACH WINDOW OPEN') || log.includes('CONTACT DETECTED')) return 'scan_ok';
  if (log.includes('NAVI SCAN FAILED') || log.includes('AMBUSH')) return 'scan_fail';
  if (log.includes('CONTRACT REGISTERED') || log.includes('MODULE SLOT UPDATED')) return 'contract';
  if (log.includes('IMPACT CONFIRMED') || log.includes('MULTI TARGET HIT')) return 'hit';
  if (log.includes('WARNING')) return 'warning';
  if (log.includes('SALVAGE RESULT READY') || log.includes('REWARD APPLIED') || log.includes('SALVAGE APPLIED')) return 'reward';
  if (log.includes('RUN COMPLETE') || log.includes('RETURN GATE ROUTE OPEN')) return 'result';
  if (log.includes('COMMAND:') || log.includes('MAIN GUN:') || log.includes('SUB GUN:') || log.includes('S-E:') || log.includes('DRIVE COMMAND')) return 'command';
  return undefined;
};

export const initState = (): State => {
  const start = getRunStartResources(defaultLoadout, defaultVehicleUpgrades);
  return {
    stage: 1,
    stageCount: 3,
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
    encounter: buildEncounter('enc1', [], defaultLoadout.contractSupportId, undefined, 0, 1),
    rewardOptions: pickRewardChoices(rewardCatalog),
    rewardTarget: undefined,
    rewardScope: undefined,
    negotiationRewards: [],
    routeBoostReward: false,
    tempForecastBoost: 0,
    lastReport: undefined,
    runSummary: { cleared: 0, defeated: 0, contracted: 0, escaped: 0 },
    resultType: undefined,
    bossChallenged: false,
    moeLine: getDialogueLine('moe.prologue.open', '午前0時。夜環、開いたよ。'),
    selectedLoadout: defaultLoadout,
    activeSupportDaemon: undefined,
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
  stage: state.stage,
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

export const getRunGrowth = (state: State) => {
  const isReturned = state.gamePhase === 'result';
  const driverXp = state.runSummary.cleared + ((state.resultType ?? 'Early Return') === 'Boss Cleared' ? 2 : 0);
  const moeSync = state.runSummary.contracted + state.analyzeSuccessCount;
  const salvageCreditGain = state.salvageCredits + (isReturned ? 1 : 0);
  return { driverXp, moeSync, salvageCreditGain };
};

export const getGarageStageAdvisory = (state: State, stage: number): string => {
  const profile = getStageProfile(stage);
  const main = getMainGunSpec(state.selectedLoadout.mainGunId);
  const sub = getSubGunSpec(state.selectedLoadout.subGunId);
  const se = getSpecialEquipmentSpec(state.selectedLoadout.specialEquipmentId);
  const preview = getRunStartResources(state.selectedLoadout, state.vehicleUpgrades);
  const firepowerScore = main.damage + Math.floor(main.ammo / 2) + sub.damage * 2 + se.damage;
  const survivabilityScore = preview.armor + preview.fuel + preview.signal + state.skillLevels.ram_control + state.skillLevels.scan_boost;
  const totalScore = firepowerScore + survivabilityScore;
  const recommended = profile.recommendedScore;
  if (totalScore < recommended - 5) {
    return `${profile.label}は今夜だと危険域。補給か改装を優先して、装備を一段上げよう。`;
  }
  if (totalScore < recommended) {
    return `${profile.label}は接戦域。突入は可能、でも弾薬とSignalの配分はかなりシビア。`;
  }
  return `${profile.label}は突入可能域。今の構成なら深層反応にも届く。`;
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

export const getSkillCost = (currentLevel: number) => currentLevel + 1;
export const getVehicleUpgradeCost = (currentLevel: number) => 2 + currentLevel;

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

export const getNarrativeMoeLine = (state: State): string => {
  if (state.gamePhase === 'prologue') {
    return getMoeLine(
      'prologue.open',
      getDialogueLine('moe.prologue.narrative', '午前0時。夜環、開いたよ。浅層サルベージ任務……ってことになってる。本命は、前任者のログ反応。まだ消えてない。'),
    );
  }
  if (state.story.recoveredLogs.includes('LOG_01') && state.gamePhase === 'boss_preview') {
    return getMoeLine(
      'boss_preview.toll_gate',
      getDialogueLine('moe.story.boss_preview_log01', '料金所の反応、前よりは読める。通行料を払う相手を間違えないで。'),
    );
  }
  if (state.story.recoveredLogs.includes('LOG_00') && state.gamePhase === 'garage') {
    return getMoeLine(
      'garage.after_log00',
      getDialogueLine('moe.story.after_log00', '前任者の声……記録には残ってない。でも、知ってる気がする。'),
    );
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
  const lineup = pickEncounterLineup('enc1', state.stage);
  const scanChance = getScanChance({ ...state, signal: start.signal }, 'enc1', lineup);
  const scanSuccess = Math.random() * 100 < scanChance;
  let fuel = start.fuel;
  const logs = [
    ...state.logs,
    ...logsPrefix,
    `> RUN START: STAGE ${state.stage}/${state.stageCount}`,
    '> NAVI SCAN START',
    '> SIGNAL SWEEP: NIGHT LOOP LANE',
  ];
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
    encounter: buildEncounter('enc1', [], state.selectedLoadout.contractSupportId, undefined, 0, state.stage, lineup),
    rewardOptions: pickRewardChoices(rewardCatalog),
    rewardTarget: undefined,
    rewardScope: undefined,
    negotiationRewards: [],
    routeBoostReward: false,
    tempForecastBoost: 0,
    lastReport: undefined,
    runSummary: { cleared: 0, defeated: 0, contracted: 0, escaped: 0 },
    resultType: undefined,
    bossChallenged: false,
    activeSupportDaemon: undefined,
    activeConversation: undefined,
    approach: { pendingKind: 'enc1', scanSuccess, scanChance, lineup },
    encounterPrep: createEmptyEncounterPrep(),
    analyzeSuccessCount: 0,
    growthClaimed: false,
    story: { ...state.story, recentRecoveredLogs: [] },
    logs,
    moeLine: scanSuccess
      ? getDialogueLine('moe.run.scan_success', '先に見つけた。どう入る？')
      : getDialogueLine('moe.run.scan_fail', 'ごめん、遅れた。来るよ。'),
  };
};

const applyRewardOption = (state: State, option: RewardOption) => ({
  fuel: state.fuel + (option.fuel ?? 0),
  armor: state.armor + (option.armor ?? 0),
  signal: state.signal + (option.signal ?? 0),
  mainAmmo: Math.min(state.maxMainAmmo, state.mainAmmo + (option.mainAmmo ?? 0)),
  seAmmo: Math.min(state.maxSeAmmo, state.seAmmo + (option.seAmmo ?? 0)),
});

export const runAutoplayBatch = (loadout: Loadout, runs: number, strategy: AutoPlayStrategy): AutoPlayReport =>
  runAutoplayBatchWithDeps(loadout, runs, strategy, { initState, reducer });

export const sanitizeRestoredState = (raw: unknown, fallback: State): State =>
  sanitizeRestoredStateWithDeps(raw, fallback, { initState, buildEncounter });

export function reducer(state: State, action: Action): State {
  if (action.type === 'DEBUG_RESTORE') {
    return action.snapshot;
  }

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
    const nextStage = claimed.resultType === 'Boss Cleared' ? 1 : claimed.stage;
    const disconnectLogs = appendSupportDaemonDisconnectLogs(
      claimed.logs,
      claimed.activeSupportDaemon,
      claimed.gamePhase === 'result' ? 'return_gate' : 'archive',
    );
    return {
      ...claimed,
      gamePhase: 'garage',
      stage: nextStage,
      activeSupportDaemon: undefined,
      previousRun: makePreviousRunSummary(claimed, claimed.resultType ?? 'Early Return'),
      logs: [...disconnectLogs, '> GARAGE: MIDNIGHT BAY ONLINE'],
      moeLine: getDialogueLine('moe.garage.enter', '戻れたね。次は出る前に少し積み替えよっか。'),
    };
  }

  if (action.type === 'OPEN_GARAGE') {
    if (!(state.gamePhase === 'prologue' || state.gamePhase === 'result' || state.gamePhase === 'game_over' || state.gamePhase === 'garage')) return state;
    const claimed = claimRunGrowthIfNeeded(state);
    const previousRun = claimed.gamePhase === 'result' || claimed.gamePhase === 'game_over'
      ? makePreviousRunSummary(claimed, claimed.resultType ?? 'Early Return')
      : claimed.previousRun;
    const disconnectLogs = appendSupportDaemonDisconnectLogs(
      claimed.logs,
      claimed.activeSupportDaemon,
      claimed.gamePhase === 'result' ? 'return_gate' : 'archive',
    );
    return {
      ...claimed,
      gamePhase: 'garage',
      activeSupportDaemon: undefined,
      previousRun,
      logs: [...disconnectLogs, '> GARAGE: MIDNIGHT BAY ONLINE'],
      moeLine: getDialogueLine('moe.garage.enter', '戻れたね。次は出る前に少し積み替えよっか。'),
    };
  }

  if (action.type === 'GARAGE_SET_MAIN_GUN') {
    if (state.gamePhase !== 'garage') return state;
    return {
      ...state,
      selectedLoadout: { ...state.selectedLoadout, mainGunId: action.id },
      moeLine: getDialogueLine('moe.garage.set_main_gun', '主砲を重くするとBossは楽。でも弾切れは早いよ。'),
    };
  }

  if (action.type === 'GARAGE_SET_SUB_GUN') {
    if (state.gamePhase !== 'garage') return state;
    return {
      ...state,
      selectedLoadout: { ...state.selectedLoadout, subGunId: action.id },
      moeLine: getDialogueLine('moe.garage.set_sub_gun', '副砲は戦い方が出る。牽制か、手数か。'),
    };
  }

  if (action.type === 'GARAGE_SET_SPECIAL') {
    if (state.gamePhase !== 'garage') return state;
    return {
      ...state,
      selectedLoadout: { ...state.selectedLoadout, specialEquipmentId: action.id },
      moeLine: getDialogueLine('moe.garage.set_se', 'S-Eは切り札。契約狙いか、殲滅寄りか選んで。'),
    };
  }

  if (action.type === 'GARAGE_SET_SUPPORT') {
    if (state.gamePhase !== 'garage') return state;
    return {
      ...state,
      selectedLoadout: { ...state.selectedLoadout, contractSupportId: action.id },
      moeLine: getDialogueLine('moe.garage.set_support', '契約サポートは一つだけ。何を車に残す？'),
    };
  }

  if (action.type === 'GARAGE_SET_STAGE') {
    if (state.gamePhase !== 'garage') return state;
    const nextStage = clamp(action.stage, 1, state.stageCount);
    return {
      ...state,
      stage: nextStage,
      moeLine: getGarageStageAdvisory(state, nextStage),
    };
  }

  if (action.type === 'GARAGE_ENTER_RUN') {
    if (state.gamePhase !== 'garage') return state;
    return initRunWithLoadout(state, [
      '> GARAGE: MIDNIGHT BAY ONLINE',
      `> MAIN GUN SELECTED: ${getMainGunSpec(state.selectedLoadout.mainGunId).name.toUpperCase()}`,
      `> SUB GUN SELECTED: ${getSubGunSpec(state.selectedLoadout.subGunId).name.toUpperCase()}`,
      `> S-E SELECTED: ${getSpecialEquipmentSpec(state.selectedLoadout.specialEquipmentId).name.toUpperCase()}`,
      `> CONTRACT SUPPORT: ${contractSupportCatalog[state.selectedLoadout.contractSupportId].name.toUpperCase()}`,
      '> DEEP SIGNAL DETECTED: TOLL GATE SAINT',
    ]);
  }

  const moveToApproach = (
    nextState: State,
    kind: ApproachKind,
    extraLogs: string[] = [],
    prepSeed: Partial<EncounterPrep> = {},
  ): State => {
    const lineup = pickEncounterLineup(kind, nextState.stage);
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
      encounterPrep: {
        ...createEmptyEncounterPrep(),
        ...prepSeed,
      },
      logs,
      moeLine: scanSuccess
        ? kind === 'boss'
          ? getDialogueLine('moe.run.scan_success_boss', '強い反応。見えてるけど、近づき方は選べる。')
          : getDialogueLine('moe.run.scan_success', '先に見つけた。どう入る？')
        : getDialogueLine('moe.run.scan_fail', 'ごめん、遅れた。来るよ。'),
    };
  };

  const createEncounterFromApproach = (baseState: State): State => {
    if (!baseState.approach) return baseState;
    const kind = baseState.approach.pendingKind;
    const encounter = buildEncounter(
      kind,
      baseState.contracts,
      baseState.selectedLoadout.contractSupportId,
      baseState.activeSupportDaemon?.profile,
      baseState.tempForecastBoost,
      baseState.stage,
      baseState.approach.lineup,
    );
    let fuel = baseState.fuel;
    let armor = baseState.armor;
    let signal = baseState.signal;
    let mainAmmo = baseState.mainAmmo;
    let seAmmo = baseState.seAmmo;
    const logs = [...baseState.logs];
    const introTarget = encounter.enemies.find(isAlive);
    const introLine = introTarget ? getEncounterIntroLine(introTarget.profile) : undefined;
    if (introLine) logs.push(`> ${introLine}`);
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
        const disconnectLogs = appendSupportDaemonDisconnectLogs(logs, baseState.activeSupportDaemon, 'archive');
        return {
          ...baseState,
          fuel,
          armor,
          signal,
          logs: appendRecoveredStoryLogLines([...disconnectLogs, '> SIGNAL LOST', '> VEHICLE DISABLED'], story),
          gamePhase: 'game_over',
          resultType,
          story,
          activeSupportDaemon: undefined,
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
        moeLine: getDialogueLine('moe.run.ambush_contact', '見落とした。ごめん、初撃来る。'),
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
      moeLine: getDialogueLine('moe.run.contact_to_command', '接触。コマンド選択へ。'),
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
    const encounter = buildEncounter(
      kind,
      state.contracts,
      state.selectedLoadout.contractSupportId,
      state.activeSupportDaemon?.profile,
      state.tempForecastBoost,
      state.stage,
      state.approach.lineup,
    );
    let fuel = state.fuel;
    let armor = state.armor;
    let signal = state.signal;
    let mainAmmo = state.mainAmmo;
    let seAmmo = state.seAmmo;
    let salvageCredits = state.salvageCredits;
    const logs = [...state.logs];
    const introTarget = encounter.enemies.find(isAlive);
    const introLine = introTarget ? getEncounterIntroLine(introTarget.profile) : undefined;
    if (introLine) logs.push(`> ${introLine}`);
    const prep = createEmptyEncounterPrep();
    const baseTalkBonus = state.skillLevels.translation_assist * 0.03;

    if (action.option === 'preemptive_main_gun') {
      if (mainAmmo <= 0) {
        return {
          ...state,
          logs: [...state.logs, '> WARNING: MAIN AMMO EMPTY'],
          moeLine: getDialogueLine('moe.run.approach.no_main_ammo', '主砲弾がない。別の入り方にして。'),
        };
      }
      const target = encounter.enemies.findIndex(isAlive);
      if (target >= 0) {
        mainAmmo -= 1;
        const gunBase = getMainGunSpec(state.selectedLoadout.mainGunId).damage + state.skillLevels.gunnery;
        const gunRoll = resolveDamageRoll({
          baseDamage: gunBase,
          affinity: 'normal',
          variance: damageVarianceByCommand.approach_main_gun,
        });
        encounter.enemies[target].hp = Math.max(0, encounter.enemies[target].hp - gunRoll.damage);
        encounter.enemies[target].pressure += 1;
        encounter.enemies[target].intent = 'guard';
        logs.push(`> FIRST STRIKE DAMAGE: ${gunRoll.damage} (PRED ${gunRoll.min}-${gunRoll.max})`);
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
      const approach = getBalanceConfig().approach;
      const successRate = clamp(
        approach.hitAndRunBaseChance + state.skillLevels.ram_control * approach.ramControlBonusPerLevel,
        approach.minChance,
        approach.maxChance,
      );
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
          moeLine: getDialogueLine('moe.dynamic.battle.hit_and_run_success', 'ひき逃げ成功。突破した。'),
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
          moeLine: getDialogueLine('moe.dynamic.battle.hit_and_run_bypass', 'ひき逃げ成功。接敵を回避した。'),
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
      if (signal <= 0) {
        return {
          ...state,
          logs: [...state.logs, '> WARNING: SIGNAL TOO LOW'],
          moeLine: getDialogueLine('moe.run.approach.no_signal', 'Signalが足りない。'),
        };
      }
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

    const { forecast, unstable } = buildForecast(
      encounter.enemies,
      hasAiNaviContract(state.contracts),
      state.selectedLoadout.contractSupportId,
      state.activeSupportDaemon?.profile,
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
      salvageCredits,
      gamePhase: kind === 'boss' ? 'boss_encounter' : 'encounter',
      encounterIndex: kind === 'enc1' ? 0 : kind === 'enc2' ? 1 : 2,
      encounter,
      encounterPrep: prep,
      approach: undefined,
      logs,
      moeLine:
        action.option === 'preemptive_main_gun'
          ? getDialogueLine('moe.run.approach.preemptive', '先に撃つ。交渉は少し荒れるよ。')
          : action.option === 'hit_and_run_ram'
            ? getDialogueLine('moe.run.approach.hit_and_run', 'ひき逃げルート。成功すれば早いけど、車体は削れるよ。')
            : action.option === 'silent_coast'
              ? getDialogueLine('moe.run.approach.silent_coast', '静かに寄る。話すならこれが一番マシ。')
              : getDialogueLine('moe.run.approach.open_channel', '先に声をかけるね。返事が人間向けとは限らないけど。'),
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
        moeLine: getDialogueLine('moe.garage.skill_sync', '同期率を使って調整した。次Runで効く。'),
      };
    }
    if (state.driverXpBank < cost) return state;
    return {
      ...state,
      driverXpBank: state.driverXpBank - cost,
      skillLevels: { ...state.skillLevels, [action.upgrade]: currentLevel + 1 },
      logs: [...state.logs, `> SKILL UPGRADE: ${action.upgrade.toUpperCase()} Lv${currentLevel + 1}`],
      moeLine: getDialogueLine('moe.garage.skill_driver', '操縦技能を更新。次Runの反応が変わるはず。'),
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
      moeLine: getDialogueLine('moe.garage.vehicle_tune', '改装完了。車体側の余裕が増える。'),
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
      return {
        ...state,
        gamePhase: 'route_choice',
        logs: [...state.logs, '> ROUTE CHOICE AVAILABLE'],
        moeLine: getDialogueLine('moe.run.route_choice', '次の車線を選んで。補給・信号強化・強行突破・帰還、どれも正解になり得る。'),
      };
    }
    return {
      ...state,
      gamePhase: 'boss_preview',
      logs: [...state.logs, '> DEEP SIGNAL DETECTED: TOLL GATE SAINT'],
      moeLine: getDialogueLine('moe.run.boss_preview', '料金所型の強い反応。無理なら引き返そ。'),
    };
  }

  if (action.type === 'ROUTE_CHOICE') {
    if (state.gamePhase !== 'route_choice') return state;
    if (action.lane === 'return_gate') {
      const resultType: ResultType = 'Early Return';
      const story = resolveStoryFromRun(state, resultType);
      const disconnectLogs = appendSupportDaemonDisconnectLogs(state.logs, state.activeSupportDaemon, 'return_gate');
      return {
        ...state,
        gamePhase: 'result',
        resultType,
        activeSupportDaemon: undefined,
        story,
        logs: appendRecoveredStoryLogLines([...disconnectLogs, '> RETURN GATE ROUTE OPEN', '> RUN COMPLETE'], story),
        moeLine: getDialogueLine('moe.run.route_return', '帰るのも仕事だよ。持ち帰れなきゃ、全部ゼロ。'),
      };
    }
    if (action.lane === 'salvage') {
      return {
        ...state,
        gamePhase: 'salvage',
        rewardTarget: 'encounter2',
        rewardOptions: pickRewardChoices(rewardCatalog),
        logs: [...state.logs, '> SALVAGE LANE SELECTED'],
        moeLine: getDialogueLine('moe.run.salvage_ready', '補給反応あり。ひとつだけ拾える。'),
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
        moeLine: getDialogueLine('moe.run.route_signal', '信号帯がクリアになった。次の予測が少し長く見える。'),
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
      moeLine: getDialogueLine('moe.run.route_push', '回復なしで進むのね。報酬は少し盛れるかも。'),
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

  if (action.type === 'SIGNAL_ROUTE_CHOICE' || action.type === 'SIGNAL_CONTINUE') {
    if (state.gamePhase !== 'signal') return state;
    const selectedChoice = action.type === 'SIGNAL_ROUTE_CHOICE' ? action.choiceId : 'hold_lane';
    let normalizedChoice: 'analyze_trace' | 'hold_lane' | 'open_radio' = selectedChoice;
    let signal = state.signal;
    let fuel = state.fuel;
    let tempForecastBoost = state.tempForecastBoost;
    const logs = [...state.logs];
    const prepSeed: Partial<EncounterPrep> = {};

    if (normalizedChoice === 'analyze_trace') {
      logs.push('> SIGNAL TUNNEL CHOICE: ANALYZE TRACE');
      if (signal <= 0) {
        logs.push('> WARNING: SIGNAL TOO LOW / TRACE DOWNGRADED');
        normalizedChoice = 'hold_lane';
      } else {
        signal = Math.max(0, signal - 1);
        tempForecastBoost += 1;
        prepSeed.intentDisrupted = true;
        prepSeed.approachLabel = 'TRACE LOCK';
        logs.push('> MEMORY TRACE ISOLATED', '> FORECAST LANE BOOSTED');
      }
    }
    if (normalizedChoice === 'open_radio') {
      logs.push('> SIGNAL TUNNEL CHOICE: OPEN RADIO CHANNEL');
      if (signal <= 0) {
        logs.push('> WARNING: SIGNAL TOO LOW / CHANNEL CLOSED');
        normalizedChoice = 'hold_lane';
      } else {
        signal = Math.max(0, signal - 1);
        prepSeed.talkPrepared = true;
        prepSeed.firstTalkBonus = 0.12;
        prepSeed.firstTalkPending = true;
        prepSeed.approachLabel = 'OPEN CHANNEL';
        logs.push('> AM 666.0 CHANNEL OPEN', '> TALK HANDSHAKE PREPARED');
      }
    }
    if (normalizedChoice === 'hold_lane') {
      logs.push('> SIGNAL TUNNEL CHOICE: KEEP DRIVING', '> LANE HOLD / CONTACT PRIORITY');
      prepSeed.approachLabel = 'LANE HOLD';
    }

    logs.push('> ENCOUNTER 2: SIGNAL CONTACT');
    if (state.selectedLoadout.contractSupportId === 'silent_shape' && Math.random() < 0.2) {
      fuel = Math.max(0, fuel - 1);
      logs.push('> SUPPORT BACKLASH: SILENT SHAPE / FUEL -1');
    }
    return moveToApproach({
      ...state,
      signal,
      fuel,
      encounterIndex: 1,
      tempForecastBoost,
      logs,
      moeLine:
        normalizedChoice === 'analyze_trace'
          ? '断片ログを掴んだ。次接敵の読みは少し深い。'
          : normalizedChoice === 'open_radio'
            ? 'AM帯を開いた。最初の会話は通しやすい。'
            : '速度維持で抜ける。接敵優先で行くよ。',
    }, 'enc2', [], prepSeed);
  }

  if (action.type === 'BOSS_PREVIEW_CHOICE') {
    if (state.gamePhase !== 'boss_preview') return state;
    if (action.choice === 'return_gate') {
      const resultType: ResultType = 'Boss Avoided';
      const story = resolveStoryFromRun(state, resultType);
      const disconnectLogs = appendSupportDaemonDisconnectLogs(state.logs, state.activeSupportDaemon, 'return_gate');
      return {
        ...state,
        gamePhase: 'result',
        resultType,
        activeSupportDaemon: undefined,
        story,
        logs: appendRecoveredStoryLogLines([...disconnectLogs, '> RETURN GATE ROUTE OPEN', '> RUN COMPLETE'], story),
        moeLine: getDialogueLine('moe.run.boss_return', '引き返す判断、正解。持ち帰ることが最優先。'),
      };
    }
    if (action.choice === 'emergency_salvage') {
      const emergencyPool = state.routeBoostReward
        ? emergencyRewardCatalog.map((reward) => (reward.mainAmmo ? { ...reward, detail: 'Main Ammo +3', mainAmmo: 3 } : reward))
        : emergencyRewardCatalog;
      return {
        ...state,
        gamePhase: 'salvage',
        rewardTarget: 'boss',
        rewardOptions: pickRewardChoices(emergencyPool),
        logs: [...state.logs, '> EMERGENCY SALVAGE OPEN'],
        moeLine: getDialogueLine('moe.run.salvage_to_boss', '主砲弾か装甲を足してから行ける。選んで。'),
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
      moeLine: getDialogueLine('moe.run.boss_start', '深層料金所、突入。主砲を温存しすぎないで。'),
    }, 'boss');
  }

  if (action.type === 'RETURN_TO_SURFACE') {
    if (state.gamePhase !== 'return_gate') return state;
    const resultType = state.resultType ?? 'Boss Cleared';
    const disconnectLogs = appendSupportDaemonDisconnectLogs(state.logs, state.activeSupportDaemon, 'return_gate');
    const unlockedAbyssLoop = resultType === 'Boss Cleared' && state.stageCount < 4 && state.stage >= 3;
    if (resultType === 'Boss Cleared' && state.stage < state.stageCount) {
      const growth = getRunGrowth(state);
      const nextStage = state.stage + 1;
      return {
        ...state,
        gamePhase: 'garage',
        stage: nextStage,
        activeSupportDaemon: undefined,
        previousRun: makePreviousRunSummary(state, resultType),
        driverXpBank: state.driverXpBank + growth.driverXp,
        moeSyncBank: state.moeSyncBank + growth.moeSync,
        creditBank: state.creditBank + growth.salvageCreditGain,
        growthClaimed: true,
        logs: [
          ...disconnectLogs,
          `> STAGE CLEAR: ${state.stage}/${state.stageCount}`,
          `> NEXT STAGE PREP: ${nextStage}/${state.stageCount}`,
          '> GARAGE: MIDNIGHT BAY ONLINE',
        ],
        moeLine: `ステージ${state.stage}突破。次は深くなる、装備を組み直そう。`,
      };
    }
    const story = resolveStoryFromRun(state, resultType);
    return {
      ...state,
      gamePhase: 'result',
      resultType,
      stageCount: unlockedAbyssLoop ? 4 : state.stageCount,
      activeSupportDaemon: undefined,
      story,
      logs: appendRecoveredStoryLogLines([
        ...disconnectLogs,
        ...(unlockedAbyssLoop ? ['> ABYSS LOOP UNLOCKED: STAGE 4'] : []),
        '> RUN COMPLETE',
      ], story),
      moeLine: unlockedAbyssLoop
        ? '深層封鎖鍵が外れた。次から最深層、Abyss Loopに入れる。'
        : getDialogueLine('moe.run.result', '帰れたね。積んだもの、確認しよっか。'),
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

  if (action.type === 'TALK_CANCEL') {
    if (!(state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') || state.encounter.phase !== 'conversation') return state;
    return {
      ...state,
      activeConversation: undefined,
      encounter: { ...state.encounter, phase: 'command' },
      moeLine: getDialogueLine('moe.dynamic.battle.idle', '次の手を選んで。'),
    };
  }

  if (action.type === 'TALK_CHOOSE') {
    return resolveTalkChoice(state, action, {
      canOpenContractWindow,
      buildForecast,
      hasAiNaviContract,
      nextIntent,
    });
  }

  return resolveExecuteCommand(state, action, {
    getSelectedEnemy,
    damageVarianceByCommand,
    resolveDamageRoll,
    getAffinityTag,
    isBossProfile,
    getIntelRevealThreshold,
    getIntelAffinityThreshold,
    canOpenContractWindow,
    getContractHint,
    applyTalkTemperament,
    getTalkTendencyFor,
    meetsContractCondition,
    nextIntent,
    makeEncounterReport,
    resolveStoryFromRun,
    appendRecoveredStoryLogLines,
    accumulateSummary,
    buildForecast,
    hasAiNaviContract,
  });
}
