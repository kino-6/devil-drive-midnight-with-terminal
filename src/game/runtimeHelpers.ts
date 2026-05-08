import { getDialogueLine } from '../dialogueConfig';
import { getEncounterScenario, getMoeLine, getScenarioLine } from '../scenario/scenarioLoader';
import { getBalanceConfig } from '../balanceConfig';
import { getDevilConfig } from '../devilConfig';
import {
  resolveAssetUrl,
  resolveEnemyAssetEntryFrameUrls,
  resolveEnemyAssetEntryUrl,
  type EnemyAssetEntry,
} from '../assetManifest';
import {
  commandDescriptions,
  mainGunCatalog,
  specialEquipmentCatalog,
  subGunCatalog,
  defaultVehicleUpgrades,
  defaultLoadout,
  defaultSkillLevels,
  rewardCatalog,
} from './catalogs';
import {
  buildEncounter,
  getRunStartResources,
  getScanChance,
  pickEncounterLineup,
} from './encounterFactory';
import { getInitialUnlocks, sanitizeLoadoutForUnlocks } from './progression';

export {
  UNKNOWN_SIGN_LABEL,
  getEnemyRevealState,
  isEnemyIdentityKnown,
  type EnemyRevealStage,
  type EnemyRevealState,
} from './enemyReveal';
export {
  buildDevil,
  buildEncounter,
  buildForecast,
  getRunStartResources,
  getScanChance,
  nextIntent,
  pickEncounterLineup,
} from './encounterFactory';
export {
  computeAffinityDamage,
  damageVarianceByCommand,
  getAffinityTag,
  getRollBounds,
  resolveDamageRoll,
} from './combatMath';
export { classifyLog, getLogBadge, getPseudoTimecode, pickSfxCueFromLog } from './logPresentation';
export {
  appendRecoveredStoryLogLines,
  claimRunGrowthIfNeeded,
  getRunGrowth,
  makePreviousRunSummary,
  resolveStoryFromRun,
} from './runProgression';
import type {
  AutoPlayStrategy,
  ActiveSupportDaemon,
  AffinityType,
  CommandId,
  ContractModule,
  Devil,
  EncounterId,
  EncounterPrep,
  EncounterReport,
  EncounterState,
  MainGun,
  MainGunId,
  RewardOption,
  RunSummary,
  SpecialEquipment,
  SpecialEquipmentId,
  State,
  StoryState,
  SubGun,
  SubGunId,
  Temperament,
} from './types';

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const isAlive = (d: Devil) => d.hp > 0 && !d.exit;
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

export const resolveEnemyAsset = (profile: EncounterId, manifestMap: Record<string, EnemyAssetEntry>): string | undefined =>
  resolveEnemyAssetEntryUrl(manifestMap[profile]) ?? resolveAssetUrl(getProfileAssetPath(profile));

export const resolveEnemyAnimationFrames = (
  profile: EncounterId,
  manifestMap: Record<string, EnemyAssetEntry>,
): string[] => {
  const resolved = resolveEnemyAssetEntryFrameUrls(manifestMap[profile]);
  if (resolved.length > 0) return resolved;
  const profileAsset = resolveAssetUrl(getProfileAssetPath(profile));
  return profileAsset ? [profileAsset] : [];
};

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

export const createEmptyEncounterPrep = (): EncounterPrep => ({
  firstStrike: false,
  ambushed: false,
  talkPrepared: false,
  intentDisrupted: false,
  firstTalkBonus: 0,
  firstTalkPending: false,
});

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

export const applyRewardOption = (state: State, option: RewardOption) => ({
  fuel: state.fuel + (option.fuel ?? 0),
  armor: state.armor + (option.armor ?? 0),
  signal: state.signal + (option.signal ?? 0),
  mainAmmo: Math.min(state.maxMainAmmo, state.mainAmmo + (option.mainAmmo ?? 0)),
  seAmmo: Math.min(state.maxSeAmmo, state.seAmmo + (option.seAmmo ?? 0)),
});

export const initState = (): State => {
  const unlocks = getInitialUnlocks();
  const selectedLoadout = sanitizeLoadoutForUnlocks(defaultLoadout, unlocks);
  const start = getRunStartResources(selectedLoadout, defaultVehicleUpgrades);
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
    encounter: buildEncounter('enc1', [], selectedLoadout.contractSupportId, undefined, 0, 1),
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
    selectedLoadout,
    activeSupportDaemon: undefined,
    activeConversation: undefined,
    previousRun: undefined,
    approach: undefined,
    encounterPrep: createEmptyEncounterPrep(),
    skillLevels: { ...defaultSkillLevels },
    vehicleUpgrades: { ...defaultVehicleUpgrades },
    unlocks,
    driverXpBank: 1,
    moeSyncBank: 0,
    creditBank: 0,
    growthClaimed: false,
    analyzeSuccessCount: 0,
    story: createInitialStoryState(),
  };
};

export const getSkillCost = (currentLevel: number) => currentLevel + 1;
export const getVehicleUpgradeCost = (currentLevel: number) => 2 + currentLevel;


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
