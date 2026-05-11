import { getBalanceConfig } from '../../balanceConfig';
import { getMoeLine } from '../../game/moeDialogue';
import { limitStateLogs } from '../../runtimeLimits';
import { getEncounterScenario, getScenarioLine } from '../../scenario/scenarioLoader';
import { getDevilConfig } from '../../devilConfig';
import { loadSaveData } from '../../saveSystem';
import { sanitizeLoadoutForUnlocks } from '../../game/progression';
import type {
  AffinityRating,
  AffinityType,
  ApproachKind,
  ContractModule,
  ContractSupportId,
  Devil,
  EncounterId,
  EncounterPrep,
  EncounterReport,
  EncounterState,
  ForecastMap,
  GamePhase,
  Intent,
  Loadout,
  RewardOption,
  RunSummary,
  SfxCue,
  State,
  TerminalLogKind,
  VehicleUpgradeLevels,
} from '../../game/types';
import {
  affinityOrder,
  defaultSkillLevels,
  defaultVehicleUpgrades,
  rewardCatalog,
} from '../../game/catalogs';
import {
  clamp,
  devilTemplates,
  getMainGunSpec,
  getSpecialEquipmentSpec,
  isAlive,
} from '../../game/runtimeHelpers';
import { assignTalkPersona } from '../../game/talkRules';
import { getSupportBacklashChance, getVehicleUpgradeResourceBonuses } from '../../game/vehicleUpgrades';
import { chooseNextIntent } from '../../game/intentWeights';
import { getSignalCapacity } from '../../game/signalSystem';
import { initRouteStateForStage } from './routeGraph';

export const pickRewardChoices = (pool: RewardOption[], count = 3): RewardOption[] => {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

export const hasAiNaviContract = (contracts: ContractModule[]) => contracts.some((module) => module.id === 'abandoned_ai_navi');

export const getRunStartResources = (
  loadout: Loadout,
  vehicleUpgrades: VehicleUpgradeLevels = defaultVehicleUpgrades,
  skillLevels = defaultSkillLevels,
) => {
  const upgradeBonuses = getVehicleUpgradeResourceBonuses(vehicleUpgrades);
  const mainAmmo = getMainGunSpec(loadout.mainGunId).ammo + upgradeBonuses.mainAmmo;
  const seAmmo = getSpecialEquipmentSpec(loadout.specialEquipmentId).ammo + upgradeBonuses.seAmmo;
  return {
    fuel: getBalanceConfig().resources.baseFuel + upgradeBonuses.fuel,
    armor: getBalanceConfig().resources.baseArmor + upgradeBonuses.armor,
    signal: getSignalCapacity(skillLevels),
    mainAmmo,
    maxMainAmmo: mainAmmo,
    seAmmo,
    maxSeAmmo: seAmmo,
  };
};

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

export const pickEncounterLineup = (kind: EncounterState['kind'], stage: number): EncounterId[] => {
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

export const createEmptyEncounterPrep = (): EncounterPrep => ({
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
    subtitle: '入口ランプ / 低耐久の交通霊と初回交渉',
    hoverHint: '入口帯。燃料と主砲弾に余裕を残し、Analyze/Talkの流れを作る。',
    recommendedScore: 24,
  },
  {
    id: 2,
    label: 'STAGE 2 // OVERPASS VEIL',
    subtitle: '高架分岐 / Signal妨害と装甲削り',
    hoverHint: '高架帯。Signal不足だと進路情報が薄く、装甲を削られやすい。',
    recommendedScore: 30,
  },
  {
    id: 3,
    label: 'STAGE 3 // TOLL SHADOW',
    subtitle: '料金所外縁 / Toll Gate Saint封鎖予兆',
    hoverHint: '料金所外縁。主砲弾、S-E、帰還ポイントの管理が重要。',
    recommendedScore: 36,
  },
  {
    id: 4,
    label: 'STAGE 4 // ABYSS LOOP',
    subtitle: '環状封鎖域 / 帰還チェックポイント不安定',
    hoverHint: '解放済み封鎖域。突破より、戻れる資源を残す計画が必要。',
    recommendedScore: 42,
  },
];

export const getStageProfile = (stage: number): StageProfile =>
  stageProfiles.find((profile) => profile.id === stage) ?? stageProfiles[stageProfiles.length - 1];

export const getScanChance = (state: State, kind: ApproachKind, lineup: EncounterId[]): number => {
  const scan = getBalanceConfig().scan;
  let chance = scan.baseChance;
  if (state.selectedLoadout.contractSupportId === 'abandoned_ai_navi') chance += scan.aiSupportBonus;
  if (state.signal >= scan.highSignalThreshold) chance += scan.highSignalBonus;
  if (kind === 'boss') chance -= scan.bossPenalty;
  if (lineup.includes('silent_shape')) chance -= scan.stealthPenalty;
  chance += state.skillLevels.scan_boost * scan.scanBoostPerLevel;
  return clamp(chance, 15, 95);
};

export const nextIntent = (profile?: EncounterId): Intent => {
  return chooseNextIntent(profile);
};

const getIntelThreshold = (profile: EncounterId) => (profile === 'toll_gate_saint' ? 170 : 100);
export const getIntelRevealThreshold = (threshold: number) => Math.floor(threshold * 0.35);
export const getIntelAffinityThreshold = (threshold: number) => Math.floor(threshold * 0.7);
export const isBossProfile = (profile: EncounterId) => profile === 'toll_gate_saint';

const getPersistedIntelProgress = (profile: EncounterId): number => {
  const archive = loadSaveData().demonArchive;
  const entry = archive[profile];
  if (!entry) return 0;
  return Math.max(0, Math.floor(entry.intelProgress ?? 0));
};

export const buildDevil = (kind: EncounterId, index: number, stage = 1): Devil => {
  const t = devilTemplates()[kind];
  const stageHpBonus = t.profile === 'toll_gate_saint'
    ? (stage - 1) * 5
    : (stage - 1) * 2;
  const scaledMaxHp = t.maxHp + stageHpBonus;
  const intelThreshold = getIntelThreshold(t.profile);
  const persistedIntel = Math.min(intelThreshold, getPersistedIntelProgress(t.profile));
  const revealed = persistedIntel >= getIntelRevealThreshold(intelThreshold);
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
    analyzeVulnerableTurns: 0,
    profile: t.profile,
    talkPersona: assignTalkPersona(t.profile, `${kind}-${index}`, stage),
    empDisabledTurns: 0,
  };
};

export const buildForecast = (
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

export const buildEncounter = (
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
  encounter.enemies.find((enemy) => enemy.id === encounter.selectedEnemyId && isAlive(enemy)) ?? encounter.enemies.find(isAlive);

export const canOpenContractWindow = (enemy: Devil) =>
  enemy.interest >= 2 || enemy.trust >= 2 || (enemy.trust >= 1 && enemy.interest >= 1) || (enemy.hp <= enemy.maxHp / 2 && enemy.pressure >= 1);

export const meetsContractCondition = (enemy: Devil) =>
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

type DamageBoundsInput = {
  baseDamage: number;
  affinity: AffinityRating;
  variance: number;
  flatReduction?: number;
  armored?: boolean;
};

export const resolveDamageBounds = ({
  baseDamage,
  affinity,
  variance,
  flatReduction = 0,
  armored = false,
}: DamageBoundsInput) => {
  const adjustedBase = computeAffinityDamage(baseDamage, affinity);
  const rawBounds = getRollBounds(adjustedBase, variance);
  const armorReduction = armored ? 1 : 0;
  const totalReduction = flatReduction + armorReduction;
  const min = Math.max(0, rawBounds.min - totalReduction);
  const max = Math.max(min, rawBounds.max - totalReduction);
  return { min, max };
};

export const resolveDamageRoll = (input: DamageBoundsInput) => {
  const { min, max } = resolveDamageBounds(input);
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

export const getEncounterIntroLine = (profile: EncounterId): string | undefined =>
  getScenarioLine(getEncounterScenario(profile)?.intro);

export const getTalkTendencyFor = (profile: EncounterId) => devilTemplates()[profile].talkTendency;

export const applyTalkTemperament = (enemy: Devil): Devil => {
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

export const makeEncounterReport = (wave: number, enemies: Devil[], escaped: boolean): EncounterReport => ({
  wave,
  defeated: enemies.filter((enemy) => enemy.exit === 'defeated').length,
  contracted: enemies.filter((enemy) => enemy.exit === 'contracted').length,
  fled: enemies.filter((enemy) => enemy.exit === 'fled').length,
  escaped,
});

export const accumulateSummary = (summary: RunSummary, report: EncounterReport): RunSummary => ({
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
  const saved = loadSaveData();
  const unlocks = saved.unlocks;
  const selectedLoadout = sanitizeLoadoutForUnlocks(saved.selectedLoadout, unlocks);
  const skillLevels = { ...saved.skillLevels };
  const vehicleUpgrades = { ...saved.vehicleUpgrades };
  const start = getRunStartResources(selectedLoadout, vehicleUpgrades, skillLevels);
  return {
    stage: saved.stage,
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
    encounter: buildEncounter('enc1', [], selectedLoadout.contractSupportId, undefined, 0, 1),
    rewardOptions: pickRewardChoices(rewardCatalog),
    routeState: undefined,
    rewardTarget: undefined,
    rewardScope: undefined,
    negotiationRewards: [],
    routeBoostReward: false,
    tempForecastBoost: 0,
    lastReport: undefined,
    runSummary: { cleared: 0, defeated: 0, contracted: 0, escaped: 0 },
    resultType: undefined,
    bossChallenged: false,
    moeLine: getMoeLine('moe.prologue.open', '午前0時。夜環、開いたよ。'),
    selectedLoadout,
    activeSupportDaemon: undefined,
    previousRun: undefined,
    approach: undefined,
    encounterPrep: createEmptyEncounterPrep(),
    skillLevels,
    vehicleUpgrades,
    unlocks,
    driverXpBank: saved.driverXpBank,
    moeSyncBank: saved.moeSyncBank,
    creditBank: saved.creditBank,
    growthClaimed: false,
    analyzeSuccessCount: 0,
    story: { ...saved.story, recentRecoveredLogs: [] },
  };
};

export const getSkillCost = (currentLevel: number) => currentLevel + 1;
export const getVehicleUpgradeCost = (currentLevel: number) => 2 + currentLevel;

export const initRunWithLoadout = (state: State, logsPrefix: string[] = []): State => {
  const start = getRunStartResources(state.selectedLoadout, state.vehicleUpgrades, state.skillLevels);
  const routeState = initRouteStateForStage(state.stage);
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
  if (state.selectedLoadout.contractSupportId === 'silent_shape' && Math.random() < getSupportBacklashChance(0.2, state.vehicleUpgrades)) {
    fuel = Math.max(0, fuel - 1);
    logs.push('> SUPPORT BACKLASH: SILENT SHAPE / FUEL -1');
  }
  if (state.selectedLoadout.contractSupportId === 'radio_voice' && Math.random() < getSupportBacklashChance(0.35, state.vehicleUpgrades)) logs.push('> WARNING: AM 666.0 CARRIER GHOST');
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
    routeState,
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
      ? getMoeLine('moe.run.scan_success', '先に見つけた。どう入る？', undefined, 'proud')
      : getMoeLine('moe.run.scan_fail', 'ごめん、遅れた。来るよ。', undefined, 'flustered'),
  };
};

export const applyRewardOption = (state: State, option: RewardOption) => ({
  fuel: state.fuel + (option.fuel ?? 0),
  armor: state.armor + (option.armor ?? 0),
  signal: Math.min(getSignalCapacity(state.skillLevels), state.signal + (option.signal ?? 0)),
  mainAmmo: Math.min(state.maxMainAmmo, state.mainAmmo + (option.mainAmmo ?? 0)),
  seAmmo: Math.min(state.maxSeAmmo, state.seAmmo + (option.seAmmo ?? 0)),
});

export const trimStateLogsIfNeeded = (state: State): State => {
  const trimmed = limitStateLogs(state.logs);
  if (trimmed.length === state.logs.length) return state;
  return { ...state, logs: trimmed };
};
