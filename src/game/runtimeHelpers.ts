import { getDialogueLine } from '../dialogueConfig';
import { getEncounterScenario, getMoeLine, getScenarioLine } from '../scenario/scenarioLoader';
import { getBalanceConfig } from '../balanceConfig';
import { getDevilConfig } from '../devilConfig';
import { resolveAssetUrl } from '../assetManifest';
import {
  commandDescriptions,
  mainGunCatalog,
  specialEquipmentCatalog,
  subGunCatalog,
  defaultVehicleUpgrades,
  defaultLoadout,
  defaultSkillLevels,
  rewardCatalog,
  storyLogById,
} from './catalogs';
import type {
  AutoPlayStrategy,
  ActiveSupportDaemon,
  AffinityRating,
  AffinityType,
  ApproachKind,
  CommandId,
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
  MainGun,
  MainGunId,
  RewardOption,
  RunSummary,
  SfxCue,
  SpecialEquipment,
  SpecialEquipmentId,
  State,
  StoryState,
  StoryLogId,
  SubGun,
  SubGunId,
  Temperament,
  TerminalLogKind,
  PreviousRunSummary,
  ResultType,
  VehicleUpgradeLevels,
} from './types';

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const isAlive = (d: Devil) => d.hp > 0;
export const UNKNOWN_SIGN_LABEL = 'UNKNOWN SIGN';
export const isEnemyIdentityKnown = (
  enemy: Devil,
  analyzedEnemyIds: string[] = [],
  alwaysReveal = false,
) => alwaysReveal || enemy.revealed || !!enemy.affinityRevealed || analyzedEnemyIds.includes(enemy.id);

export type EnemyRevealStage = 'unknown' | 'silhouette' | 'name' | 'intent' | 'affinity' | 'hint';
export type EnemyRevealState = {
  stage: EnemyRevealStage;
  showSilhouette: boolean;
  showName: boolean;
  showIntent: boolean;
  showHp: boolean;
  showAffinity: boolean;
  showHint: boolean;
  label: string;
};

type EnemyRevealOptions = {
  alwaysReveal?: boolean;
  forceUnknown?: boolean;
  bossProfile?: EncounterId;
};

export const getEnemyRevealState = (
  enemy: Devil,
  analyzedEnemyIds: string[] = [],
  options: EnemyRevealOptions = {},
): EnemyRevealState => {
  const alwaysReveal = !!options.alwaysReveal;
  const forceUnknown = !!options.forceUnknown;
  const bossProfile = options.bossProfile ?? 'toll_gate_saint';

  if (forceUnknown) {
    return {
      stage: 'unknown',
      showSilhouette: false,
      showName: false,
      showIntent: false,
      showHp: false,
      showAffinity: false,
      showHint: false,
      label: UNKNOWN_SIGN_LABEL,
    };
  }

  if (alwaysReveal) {
    return {
      stage: 'hint',
      showSilhouette: false,
      showName: true,
      showIntent: true,
      showHp: true,
      showAffinity: true,
      showHint: true,
      label: enemy.name.toUpperCase(),
    };
  }

  if (enemy.profile === bossProfile) {
    const intelRatio = clamp(enemy.intelThreshold > 0 ? enemy.intelProgress / enemy.intelThreshold : 1, 0, 1);
    const stage: EnemyRevealStage = intelRatio < 0.2
      ? 'silhouette'
      : intelRatio < 0.45
        ? 'name'
        : intelRatio < 0.7
          ? 'intent'
          : intelRatio < 0.9
            ? 'affinity'
            : 'hint';
    const showName = stage !== 'silhouette';
    const showIntent = stage === 'intent' || stage === 'affinity' || stage === 'hint';
    const showAffinity = stage === 'affinity' || stage === 'hint';
    const showHint = stage === 'hint';
    return {
      stage,
      showSilhouette: stage === 'silhouette',
      showName,
      showIntent,
      showHp: showName,
      showAffinity,
      showHint,
      label: showName ? enemy.name.toUpperCase() : UNKNOWN_SIGN_LABEL,
    };
  }

  const known = isEnemyIdentityKnown(enemy, analyzedEnemyIds, false);
  if (!known) {
    return {
      stage: 'unknown',
      showSilhouette: false,
      showName: false,
      showIntent: false,
      showHp: false,
      showAffinity: false,
      showHint: false,
      label: UNKNOWN_SIGN_LABEL,
    };
  }

  const showAffinity = !!enemy.affinityRevealed;
  const showHint = enemy.intelProgress >= enemy.intelThreshold;
  return {
    stage: showHint ? 'hint' : showAffinity ? 'affinity' : 'intent',
    showSilhouette: false,
    showName: true,
    showIntent: true,
    showHp: true,
    showAffinity,
    showHint,
    label: enemy.name.toUpperCase(),
  };
};
export const asRec = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
export const asNum = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
export const asStr = (value: unknown, fallback: string) => (typeof value === 'string' ? value : fallback);

export const getMainGunSpec = (id: MainGunId): MainGun => {
  const base = mainGunCatalog[id];
  const tuned = getBalanceConfig().weapons.mainGun[id];
  return {
    ...base,
    damage: tuned?.damage ?? base.damage,
    ammo: tuned?.ammo ?? base.ammo,
  };
};

export const getSubGunSpec = (id: SubGunId): SubGun => {
  const base = subGunCatalog[id];
  const tuned = getBalanceConfig().weapons.subGun[id];
  return {
    ...base,
    damage: tuned?.damage ?? base.damage,
    hits: tuned?.hits ?? base.hits,
    softenChance: tuned?.softenChance ?? base.softenChance,
  };
};

export const getSpecialEquipmentSpec = (id: SpecialEquipmentId): SpecialEquipment => {
  const base = specialEquipmentCatalog[id];
  const tuned = getBalanceConfig().weapons.specialEquipment[id];
  return {
    ...base,
    damage: tuned?.damage ?? base.damage,
    ammo: tuned?.ammo ?? base.ammo,
    seAmmoCost: tuned?.seAmmoCost ?? base.seAmmoCost,
  };
};

export const getMoeCommandGuide = (command: CommandId): string =>
  getDialogueLine(`hint.command.${command}`, commandDescriptions[command].description);

export const encounterProfiles = () => getDevilConfig().encounterProfiles;
export const devilTemplates = () => getDevilConfig().devilTemplates;
export const supportDaemonEffectLabels = () => getDevilConfig().support.effects;
export const supportDaemonLinkFlavorLogs = () => getDevilConfig().support.linkLogs;
export const supportDaemonLinkStability = () => getDevilConfig().support.stability;

export const getProfileAssetPath = (profile: EncounterId): string | undefined => {
  const value = encounterProfiles()[profile].assetImage;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

export const resolveEnemyAsset = (profile: EncounterId, manifestMap: Record<string, string>): string | undefined =>
  resolveAssetUrl(manifestMap[profile]) ?? resolveAssetUrl(getProfileAssetPath(profile));

const supportDaemonStabilityByTemperament: Record<Temperament, 'STABLE' | 'NOISY' | 'HUNGRY' | 'UNKNOWN'> = {
  hungry: 'HUNGRY',
  proud: 'STABLE',
  lonely: 'NOISY',
  machine: 'STABLE',
  hostile: 'UNKNOWN',
  curious: 'NOISY',
};

export const supportDaemonMoeLinkLines = [
  'Support daemon accepted. I will monitor corruption drift.',
  'Contract signature detected. This passenger is not registered.',
  'Do not let the support daemon answer in your voice.',
];

export const getSupportDaemonStability = (daemon: ActiveSupportDaemon): 'STABLE' | 'NOISY' | 'HUNGRY' | 'UNKNOWN' =>
  supportDaemonLinkStability()[daemon.profile] ?? supportDaemonStabilityByTemperament[daemon.temperament];

export const appendSupportDaemonDisconnectLogs = (
  logs: string[],
  daemon: ActiveSupportDaemon | undefined,
  mode: 'return_gate' | 'archive',
): string[] => {
  if (!daemon) return logs;
  const line = mode === 'return_gate'
    ? '> SUPPORT DAEMON DISCONNECTED: signal lost at Return Gate.'
    : '> SUPPORT DAEMON DISCONNECTED: contract archived in M.O.E. memory.';
  return [...logs, line];
};

export const makeActiveSupportDaemon = (enemy: Devil): ActiveSupportDaemon => ({
  id: enemy.profile,
  name: enemy.name,
  profile: enemy.profile,
  temperament: enemy.temperament,
  effectLabel: supportDaemonEffectLabels()[enemy.profile],
  expiresAt: 'run_end',
});

export const pickRewardChoices = (pool: RewardOption[], count = 3): RewardOption[] => {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

export const createInitialStoryState = (): StoryState => ({
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

export const lineupByKind = (kind: ApproachKind): EncounterId[] =>
  kind === 'enc1'
    ? [...getDevilConfig().lineups.enc1]
    : kind === 'enc2'
      ? [...getDevilConfig().lineups.enc2]
      : [...getDevilConfig().lineups.boss];

export const pickEncounterEnemyCount = (kind: EncounterState['kind'], stage: number, available: number): number => {
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

export const buildDevil = (kind: EncounterId, index: number, stage = 1): Devil => {
  const t = devilTemplates()[kind];
  const stageHpBonus = t.profile === 'toll_gate_saint'
    ? (stage - 1) * 5
    : (stage - 1) * 2;
  const scaledMaxHp = t.maxHp + stageHpBonus;
  const intelThreshold = t.profile === 'toll_gate_saint' ? 170 : 100;
  return {
    id: `${kind}-${index}`,
    name: t.name,
    maxHp: scaledMaxHp,
    hp: scaledMaxHp,
    temperament: t.temperament,
    intent: nextIntent(t.profile),
    contractable: t.contractable,
    revealed: t.profile === 'toll_gate_saint',
    targetModuleId: t.targetModuleId,
    trust: 0,
    pressure: 0,
    interest: 0,
    guardStacks: 0,
    contractWindow: false,
    armored: t.armored,
    affinities: { ...t.affinities },
    affinityRevealed: false,
    intelProgress: t.profile === 'toll_gate_saint' ? 40 : 0,
    intelThreshold,
    profile: t.profile,
    empDisabledTurns: 0,
  };
};

export const buildForecast = (
  enemies: Devil[],
  hasAiNaviModule: boolean,
  supportId: ContractSupportId,
  activeSupportProfile: EncounterId | undefined,
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
    supportArmorGuardReady: supportId === 'silent_shape' || activeSupportProfile === 'silent_shape',
  };
};

export const getSelectedEnemy = (encounter: EncounterState): Devil | undefined =>
  encounter.enemies.find((enemy) => enemy.id === encounter.selectedEnemyId && enemy.hp > 0) ?? encounter.enemies.find(isAlive);

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

export const computeAffinityDamage = (baseDamage: number, rating: AffinityRating) => {
  const affinity = getBalanceConfig().affinity;
  if (baseDamage <= 0) return 0;
  if (rating === 'weak') return Math.max(1, Math.floor(baseDamage * affinity.weakMultiplier));
  if (rating === 'resist') return Math.max(1, Math.floor(baseDamage * affinity.resistMultiplier));
  return baseDamage;
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
  const weak = ['ballistic', 'suppressive', 'impact', 'signal', 'talk']
    .filter((affinity) => affinities[affinity as AffinityType] === 'weak') as AffinityType[];
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

export const applyRewardOption = (state: State, option: RewardOption) => ({
  fuel: state.fuel + (option.fuel ?? 0),
  armor: state.armor + (option.armor ?? 0),
  signal: state.signal + (option.signal ?? 0),
  mainAmmo: Math.min(state.maxMainAmmo, state.mainAmmo + (option.mainAmmo ?? 0)),
  seAmmo: Math.min(state.maxSeAmmo, state.seAmmo + (option.seAmmo ?? 0)),
});

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
    activeConversation: undefined,
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

export const makePreviousRunSummary = (state: State, resultType: ResultType): PreviousRunSummary => ({
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

export const claimRunGrowthIfNeeded = (state: State): State => {
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

export const resolveStoryFromRun = (state: State, resultType: ResultType): StoryState => {
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

export const appendRecoveredStoryLogLines = (logs: string[], story: StoryState): string[] => {
  if (story.recentRecoveredLogs.length === 0) return logs;
  const out = [...logs, '> STORY LOG RECOVERED'];
  for (const id of story.recentRecoveredLogs) {
    out.push(`> ${id}: ${storyLogById[id].title.toUpperCase()}`);
  }
  return out;
};

export const initRunWithLoadout = (state: State, logsPrefix: string[] = []): State => {
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

export const chooseAutoplayReward = (state: State): RewardOption => {
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

export const chooseAutoplayRoute = (state: State, strategy: AutoPlayStrategy): 'salvage' | 'signal' | 'push_forward' | 'return_gate' => {
  const auto = getBalanceConfig().autoplay;
  if (strategy === 'safe' && (state.armor <= 3 || state.fuel <= 2)) return 'return_gate';
  if (state.signal <= 2) return 'signal';
  if (state.armor <= 5 || state.fuel <= 3 || state.mainAmmo <= 1) return 'salvage';
  if (strategy === 'aggressive') return 'push_forward';
  if (strategy === 'contract') return 'signal';
  if (Math.random() < auto.pushForwardChance) return 'push_forward';
  return 'salvage';
};

export const chooseAutoplayBossPreview = (state: State, strategy: AutoPlayStrategy): 'challenge' | 'emergency_salvage' | 'return_gate' => {
  if (strategy === 'safe' && (state.armor <= 4 || state.fuel <= 2)) return 'return_gate';
  if (state.mainAmmo <= 0 || state.seAmmo <= 0 || state.armor <= 4 || state.signal <= 1) return 'emergency_salvage';
  if (strategy === 'contract' && state.signal <= 2) return 'emergency_salvage';
  return 'challenge';
};

export const chooseAutoplayCommand = (state: State, strategy: AutoPlayStrategy): CommandId => {
  const auto = getBalanceConfig().autoplay;
  const selected = getSelectedEnemy(state.encounter);
  const alive = state.encounter.enemies.filter(isAlive);
  if (!selected || alive.length === 0) return 'guard';
  const mainGun = getMainGunSpec(state.selectedLoadout.mainGunId);
  const se = getSpecialEquipmentSpec(state.selectedLoadout.specialEquipmentId);

  if (selected.contractWindow && selected.contractable) return 'contract';
  if ((!selected.revealed || !state.encounter.analyzedEnemyIds.includes(selected.id)) && state.signal > 0) return 'analyze';
  if (strategy === 'contract' && selected.contractable && selected.pressure <= 2 && !selected.contractWindow) {
    if (state.seAmmo >= se.seAmmoCost) return 'se_harpoon';
    return 'talk';
  }
  if (selected.contractable && selected.pressure <= 1 && selected.hp > 2 && Math.random() < auto.talkProbeChance) return 'talk';
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
