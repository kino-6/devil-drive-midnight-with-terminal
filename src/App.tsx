import { useEffect, useMemo, useReducer, useRef, useState, type ChangeEvent } from 'react';
import { defaultAssetManifest, loadAssetManifest, resolveAssetUrl, type AssetManifest } from './assetManifest';
import { defaultBalanceConfig, getBalanceConfig, loadBalanceConfig, type BalanceConfig } from './balanceConfig';
import { getDialogueConfig, getDialogueLine, getDialogueLineWithVars, loadDialogueConfig } from './dialogueConfig';
import {
  clearAutoSaveSnapshot,
  clearSaveData,
  clearDebugSaves,
  exportAutoSaveJson,
  exportCorruptSaveBackupJson,
  exportDebugSavesJson,
  exportSaveJson,
  importSaveJson,
  listDebugSaveHeaders,
  loadAutoSaveSnapshot,
  loadDebugSnapshotById,
  loadLatestDebugSnapshot,
  loadSaveData,
  recordRunResult,
  saveAutoSaveSnapshot,
  saveDebugSnapshot,
  touchDemonArchive,
  touchRouteLog,
  unlockMoeMemory,
  updateSaveData,
  type RunRecord,
} from './saveSystem';
import {
  buildPlaytestReport,
  clearTelemetryEvents,
  exportTelemetryJson,
  getTelemetryEvents,
  trackEvent,
  type PersistentProgressionSnapshot,
  type TelemetryEventName,
} from './telemetry';
import {
  getEncounterScenario,
  getMoeLine,
  getRouteEventScenario,
  getScenarioLine,
  loadScenarioPack,
} from './scenario/scenarioLoader';
import { ResourceMeter, StatusLamp } from './components/DashboardWidgets';
import { ApproachContactMarker, AssetFigure, BattleDevilSprite } from './components/EncounterVisuals';
import { buildMoeRunComment, resultLabel } from './game/runInsights';
import { getDevilConfig, loadDevilConfig } from './devilConfig';
import {
  type Action,
  type ActiveSupportDaemon,
  type AffinityRating,
  type AffinityType,
  type ApproachKind,
  type AutoPlayReport,
  type AutoPlayStrategy,
  type ApproachOption,
  type CommandId,
  type ContractModule,
  type ContractSupportId,
  type Devil,
  type EncounterId,
  type EncounterPrep,
  type EncounterReport,
  type EncounterState,
  type ForecastMap,
  type GamePhase,
  type HitFxTone,
  type Intent,
  type Loadout,
  type MainGunId,
  type PreviousRunSummary,
  type ResultType,
  type RewardOption,
  type RunSummary,
  type SfxCue,
  type SpecialEquipmentId,
  type State,
  type StoryLogId,
  type StoryState,
  type SubGunId,
  type Temperament,
  type TerminalLogKind,
  type UpgradeId,
  type VehicleUpgradeId,
  type VehicleUpgradeLevels,
} from './game/types';
import {
  affinityLabel,
  affinityOrder,
  bossIntel,
  commandAffinityMap,
  commandDescriptions,
  commandOptions,
  contractLabels,
  contractModules,
  contractSupportCatalog,
  defaultLoadout,
  defaultSkillLevels,
  defaultVehicleUpgrades,
  demonArchiveFlavor,
  emergencyRewardCatalog,
  garageMainGunOrder,
  garageSEOrder,
  garageSubGunOrder,
  garageSupportOrder,
  mainGunCatalog,
  rewardCatalog,
  routeIntelCatalog,
  routeLogCatalog,
  routeScenarioIdMap,
  skillLabels,
  specialEquipmentCatalog,
  storyLogById,
  storyLogCatalog,
  subGunCatalog,
  vehicleUpgradeLabels,
} from './game/catalogs';
import {
  appendSupportDaemonDisconnectLogs,
  asNum,
  asRec,
  asStr,
  clamp,
  devilTemplates,
  encounterProfiles,
  getMainGunSpec,
  getMoeCommandGuide,
  getSpecialEquipmentSpec,
  getSubGunSpec,
  getSupportDaemonStability,
  isAlive,
  makeActiveSupportDaemon,
  resolveEnemyAsset,
  supportDaemonEffectLabels,
  supportDaemonLinkFlavorLogs,
  supportDaemonMoeLinkLines,
} from './game/runtimeHelpers';

// Contributor note:
// Editing guide for LLM/agents lives in docs/llm-code-map.md
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

const hasAiNaviContract = (contracts: ContractModule[]) => contracts.some((module) => module.id === 'abandoned_ai_navi');

const getRunStartResources = (loadout: Loadout, vehicleUpgrades: VehicleUpgradeLevels = defaultVehicleUpgrades) => ({
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

const createEmptyEncounterPrep = (): EncounterPrep => ({
  firstStrike: false,
  ambushed: false,
  talkPrepared: false,
  intentDisrupted: false,
  firstTalkBonus: 0,
  firstTalkPending: false,
});

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

const buildDevil = (kind: EncounterId, index: number, stage = 1): Devil => {
  const t = devilTemplates()[kind];
  const stageHpBonus = t.profile === 'toll_gate_saint'
    ? (stage - 1) * 5
    : (stage - 1) * 2;
  const scaledMaxHp = t.maxHp + stageHpBonus;
  return {
    id: `${kind}-${index}`,
    name: t.name,
    maxHp: scaledMaxHp,
    hp: scaledMaxHp,
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
): EncounterState => {
  const lineup = lineupByKind(kind);
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


const computeAffinityDamage = (baseDamage: number, rating: AffinityRating) => {
  const affinity = getBalanceConfig().affinity;
  if (baseDamage <= 0) return 0;
  if (rating === 'weak') return Math.max(1, Math.floor(baseDamage * affinity.weakMultiplier));
  if (rating === 'resist') return Math.max(1, Math.floor(baseDamage * affinity.resistMultiplier));
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

const pickSfxCueFromLog = (log: string, phase: GamePhase): SfxCue | undefined => {
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

const initState = (): State => {
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
  const lineup = lineupByKind('enc1');
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
    encounter: buildEncounter('enc1', [], state.selectedLoadout.contractSupportId, undefined, 0, state.stage),
    rewardOptions: pickRewardChoices(rewardCatalog),
    rewardTarget: undefined,
    rewardScope: undefined,
    routeBoostReward: false,
    tempForecastBoost: 0,
    lastReport: undefined,
    runSummary: { cleared: 0, defeated: 0, contracted: 0, escaped: 0 },
    resultType: undefined,
    bossChallenged: false,
    activeSupportDaemon: undefined,
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
  const auto = getBalanceConfig().autoplay;
  if (strategy === 'safe' && (state.armor <= 3 || state.fuel <= 2)) return 'return_gate';
  if (state.signal <= 2) return 'signal';
  if (state.armor <= 5 || state.fuel <= 3 || state.mainAmmo <= 1) return 'salvage';
  if (strategy === 'aggressive') return 'push_forward';
  if (strategy === 'contract') return 'signal';
  if (Math.random() < auto.pushForwardChance) return 'push_forward';
  return 'salvage';
};

const chooseAutoplayBossPreview = (state: State, strategy: AutoPlayStrategy): 'challenge' | 'emergency_salvage' | 'return_gate' => {
  if (strategy === 'safe' && (state.armor <= 4 || state.fuel <= 2)) return 'return_gate';
  if (state.mainAmmo <= 0 || state.seAmmo <= 0 || state.armor <= 4 || state.signal <= 1) return 'emergency_salvage';
  if (strategy === 'contract' && state.signal <= 2) return 'emergency_salvage';
  return 'challenge';
};

const chooseAutoplayCommand = (state: State, strategy: AutoPlayStrategy): CommandId => {
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
        s = reducer(s, { type: 'SIGNAL_ROUTE_CHOICE', choiceId: 'analyze_trace' });
      } else if (s.gamePhase === 'boss_preview') {
        s = reducer(s, { type: 'BOSS_PREVIEW_CHOICE', choice: chooseAutoplayBossPreview(s, strategy) });
      } else if (s.gamePhase === 'return_gate') {
        s = reducer(s, { type: 'RETURN_TO_SURFACE' });
      } else if (s.gamePhase === 'garage') {
        s = reducer(s, { type: 'GARAGE_ENTER_RUN' });
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

const sanitizeRestoredState = (raw: unknown, fallback: State): State => {
  const source = asRec(raw);
  if (!Object.keys(source).length) return fallback;
  const base = initState();

  const normalizeMainGun = (id: unknown): MainGunId =>
    id === 'light_cannon' || id === 'heavy_cannon' || id === 'burst_cannon' || id === 'rusted_cannon' || id === 'rail_cannon'
      ? id
      : fallback.selectedLoadout.mainGunId;
  const normalizeSubGun = (id: unknown): SubGunId =>
    id === 'hood_mg' || id === 'twin_mg' || id === 'suppression_mg' || id === 'road_sweeper' || id === 'counter_pod'
      ? id
      : fallback.selectedLoadout.subGunId;
  const normalizeSE = (id: unknown): SpecialEquipmentId =>
    id === 'signal_harpoon' || id === 'micro_missile' || id === 'emp_flare' || id === 'jammer_pulse' || id === 'decoy_beacon'
      ? id
      : fallback.selectedLoadout.specialEquipmentId;
  const normalizeSupport = (id: unknown): ContractSupportId => {
    if (id === 'radio_voice' || id === 'silent_shape' || id === 'abandoned_ai_navi' || id === 'none') return id;
    if (id === 'moe_core') return 'none';
    return fallback.selectedLoadout.contractSupportId;
  };
  const normalizePhase = (value: unknown): GamePhase => {
    const phases: GamePhase[] = [
      'prologue',
      'approach',
      'encounter',
      'reward',
      'route_choice',
      'salvage',
      'signal',
      'boss_preview',
      'boss_encounter',
      'return_gate',
      'result',
      'garage',
      'game_over',
    ];
    return phases.includes(value as GamePhase) ? (value as GamePhase) : fallback.gamePhase;
  };
  const normalizeCommand = (value: unknown): CommandId => {
    const commands: CommandId[] = ['main_gun', 'sub_gun', 'se_harpoon', 'analyze', 'talk', 'contract', 'ram', 'guard', 'escape'];
    return commands.includes(value as CommandId) ? (value as CommandId) : 'analyze';
  };
  const pickContracts = (value: unknown): ContractModule[] =>
    Array.isArray(value)
      ? value
        .map((item) => asRec(item))
        .map((item) => {
          const id = asStr(item.id, '');
          return id === 'radio_voice' || id === 'silent_shape' || id === 'abandoned_ai_navi'
            ? contractModules[id]
            : null;
        })
        .filter((item): item is ContractModule => !!item)
      : fallback.contracts;
  const normalizeEncounterId = (value: unknown): EncounterId | undefined =>
    value === 'whisper_broker'
      || value === 'roadside_phone'
      || value === 'pixie_shibuya_glow'
      || value === 'foxfire_navi'
      || value === 'no_face_taxi_passenger'
      || value === 'silent_shape'
      || value === 'abandoned_ai_navi'
      || value === 'road_reaper'
      || value === 'toll_gate_saint'
      ? value
      : undefined;
  const normalizeTemperament = (value: unknown): Temperament =>
    value === 'hungry' || value === 'proud' || value === 'lonely' || value === 'machine' || value === 'hostile' || value === 'curious'
      ? value
      : 'curious';

  const selectedLoadoutRaw = asRec(source.selectedLoadout);
  const selectedLoadout: Loadout = {
    mainGunId: normalizeMainGun(selectedLoadoutRaw.mainGunId),
    subGunId: normalizeSubGun(selectedLoadoutRaw.subGunId),
    specialEquipmentId: normalizeSE(selectedLoadoutRaw.specialEquipmentId),
    contractSupportId: normalizeSupport(selectedLoadoutRaw.contractSupportId),
  };
  const activeSupportRaw = asRec(source.activeSupportDaemon);
  const activeSupportProfile = normalizeEncounterId(activeSupportRaw.profile);
  const activeSupportDaemon: ActiveSupportDaemon | undefined = activeSupportProfile
    ? {
      id: normalizeEncounterId(activeSupportRaw.id) ?? activeSupportProfile,
      name: asStr(activeSupportRaw.name, encounterProfiles()[activeSupportProfile].label),
      profile: activeSupportProfile,
      temperament: normalizeTemperament(activeSupportRaw.temperament),
      effectLabel: asStr(activeSupportRaw.effectLabel, supportDaemonEffectLabels()[activeSupportProfile]),
      expiresAt: 'run_end',
    }
    : undefined;

  const restored: State = {
    ...base,
    ...fallback,
    gamePhase: normalizePhase(source.gamePhase),
    stage: Math.max(1, asNum(source.stage, fallback.stage)),
    stageCount: Math.max(1, asNum(source.stageCount, fallback.stageCount)),
    fuel: asNum(source.fuel, fallback.fuel),
    armor: asNum(source.armor, fallback.armor),
    signal: asNum(source.signal, fallback.signal),
    mainAmmo: asNum(source.mainAmmo, fallback.mainAmmo),
    maxMainAmmo: asNum(source.maxMainAmmo, fallback.maxMainAmmo),
    seAmmo: asNum(source.seAmmo, fallback.seAmmo),
    maxSeAmmo: asNum(source.maxSeAmmo, fallback.maxSeAmmo),
    salvageCredits: asNum(source.salvageCredits, fallback.salvageCredits),
    encounterIndex: Math.max(0, asNum(source.encounterIndex, fallback.encounterIndex)),
    contracts: pickContracts(source.contracts),
    logs: Array.isArray(source.logs)
      ? source.logs.filter((line): line is string => typeof line === 'string').slice(-200)
      : fallback.logs,
    selectedLoadout,
    activeSupportDaemon,
    runSummary: {
      cleared: asNum(asRec(source.runSummary).cleared, fallback.runSummary.cleared),
      defeated: asNum(asRec(source.runSummary).defeated, fallback.runSummary.defeated),
      contracted: asNum(asRec(source.runSummary).contracted, fallback.runSummary.contracted),
      escaped: asNum(asRec(source.runSummary).escaped, fallback.runSummary.escaped),
    },
    resultType: typeof source.resultType === 'string' ? (source.resultType as ResultType) : fallback.resultType,
    bossChallenged: typeof source.bossChallenged === 'boolean' ? source.bossChallenged : fallback.bossChallenged,
    moeLine: asStr(source.moeLine, fallback.moeLine),
    growthClaimed: typeof source.growthClaimed === 'boolean' ? source.growthClaimed : fallback.growthClaimed,
    analyzeSuccessCount: asNum(source.analyzeSuccessCount, fallback.analyzeSuccessCount),
    driverXpBank: asNum(source.driverXpBank, fallback.driverXpBank),
    moeSyncBank: asNum(source.moeSyncBank, fallback.moeSyncBank),
    creditBank: asNum(source.creditBank, fallback.creditBank),
  };

  const encounterRaw = asRec(source.encounter);
  const fallbackEncounter = buildEncounter('enc1', restored.contracts, restored.selectedLoadout.contractSupportId, restored.activeSupportDaemon?.profile, 0, restored.stage);
  restored.encounter = {
    ...fallbackEncounter,
    ...fallback.encounter,
    turn: Math.max(1, asNum(encounterRaw.turn, fallback.encounter.turn)),
    selectedEnemyId: asStr(encounterRaw.selectedEnemyId, fallback.encounter.selectedEnemyId),
    selectedCommand: normalizeCommand(encounterRaw.selectedCommand),
    guardActive: typeof encounterRaw.guardActive === 'boolean' ? encounterRaw.guardActive : fallback.encounter.guardActive,
    phase: encounterRaw.phase === 'command' || encounterRaw.phase === 'resolving' || encounterRaw.phase === 'finished'
      ? encounterRaw.phase
      : fallback.encounter.phase,
  };
  restored.encounterPrep = {
    ...fallback.encounterPrep,
    ...asRec(source.encounterPrep),
    firstStrike: !!asRec(source.encounterPrep).firstStrike,
    ambushed: !!asRec(source.encounterPrep).ambushed,
    talkPrepared: !!asRec(source.encounterPrep).talkPrepared,
    intentDisrupted: !!asRec(source.encounterPrep).intentDisrupted,
    firstTalkBonus: asNum(asRec(source.encounterPrep).firstTalkBonus, fallback.encounterPrep.firstTalkBonus),
    firstTalkPending: !!asRec(source.encounterPrep).firstTalkPending,
  };

  return restored;
};

function reducer(state: State, action: Action): State {
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
        const gunDmg = getMainGunSpec(state.selectedLoadout.mainGunId).damage + state.skillLevels.gunnery;
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
      activeSupportDaemon: undefined,
      story,
      logs: appendRecoveredStoryLogLines([...disconnectLogs, '> RUN COMPLETE'], story),
      moeLine: getDialogueLine('moe.run.result', '帰れたね。積んだもの、確認しよっか。'),
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
  let activeSupportDaemon = state.activeSupportDaemon;
  let salvageCredits = state.salvageCredits;
  let analyzeSuccessCount = state.analyzeSuccessCount;
  const encounterPrep = { ...state.encounterPrep };
  let moeLine = getDialogueLine('moe.dynamic.battle.idle', '次の手を選んで。');
  let skipEnemyResolution = false;
  let escaped = false;
  const selectedMainGun = getMainGunSpec(state.selectedLoadout.mainGunId);
  const selectedSubGun = getSubGunSpec(state.selectedLoadout.subGunId);
  const selectedSE = getSpecialEquipmentSpec(state.selectedLoadout.specialEquipmentId);
  const getMoeTargetName = (enemy: Devil) =>
    (encounter.analyzedEnemyIds.includes(enemy.id) || enemy.revealed || enemy.affinityRevealed)
      ? enemy.name
      : 'Unknown Sign';
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
      const targetName = getMoeTargetName(encounter.enemies[idx]);
      moeLine = affinity === 'weak'
        ? getDialogueLineWithVars('moe.dynamic.battle.main_gun.weak', '{target}へ主砲射撃。刺さった。押し切れる。', { target: targetName })
        : affinity === 'resist'
          ? getDialogueLineWithVars('moe.dynamic.battle.main_gun.resist', '{target}へ主砲射撃。効きが薄い。別の手に切り替えよう。', { target: targetName })
          : getDialogueLineWithVars('moe.dynamic.battle.main_gun.normal', '{target}へ主砲射撃。命中。警戒は上がってる。', { target: targetName });
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
      moeLine = getDialogueLine('moe.dynamic.battle.sub_gun.resist', '副砲制圧。効きが浅い。相性が悪い。');
    } else if (weakHits > 0) {
      moeLine = getDialogueLine('moe.dynamic.battle.sub_gun.weak', '副砲制圧。刺さってる。崩せるよ。');
    } else {
      moeLine = selectedSubGun.id === 'suppression_mg'
        ? getDialogueLine('moe.dynamic.battle.sub_gun.suppress', '副砲制圧。攻勢が鈍るかも。')
        : getDialogueLine('moe.dynamic.battle.sub_gun.normal', '副砲制圧。足止めにはなる。');
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
        moeLine = getDialogueLine('moe.dynamic.battle.se.all_damage', 'S-E発射。制圧寄りにまとめて焼いた。');
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
          const targetName = getMoeTargetName(encounter.enemies[idx]);
          moeLine = affinity === 'weak'
            ? getDialogueLineWithVars('moe.dynamic.battle.se.interest.weak', '{target}へS-E発射。署名が浮いた。契約窓が開きやすい。', { target: targetName })
            : affinity === 'resist'
              ? getDialogueLineWithVars('moe.dynamic.battle.se.interest.resist', '{target}へS-E発射。信号が弾かれた。窓が閉じる。', { target: targetName })
              : getDialogueLineWithVars('moe.dynamic.battle.se.interest.normal', '{target}へS-E発射。署名を掴んだ。会話が通じやすい。', { target: targetName });
        } else if (selectedSE.effect === 'emp') {
          if (encounter.enemies[idx].temperament === 'machine' || encounter.enemies[idx].profile === 'abandoned_ai_navi') {
            encounter.enemies[idx].empDisabledTurns = 1;
            logs.push('> EMP LOCK: NEXT INTENT DISABLED');
          } else {
            logs.push('> EMP BURST: NO MACHINE RESPONSE');
          }
          moeLine = getDialogueLineWithVars('moe.dynamic.battle.se.emp', '{target}へEMPフレア。機械霊の挙動が鈍る。', {
            target: getMoeTargetName(encounter.enemies[idx]),
          });
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
      moeLine = getDialogueLine('moe.dynamic.battle.signal_low', 'Signalが足りない。');
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
      moeLine = getDialogueLineWithVars(
        'moe.dynamic.battle.analyze.success',
        '{target}の解析完了。気質と相性を掴んだ。交渉の順番を合わせよう。',
        { target: getMoeTargetName(selectedEnemy) },
      );
    }
  }

  if (command === 'talk' && selectedEnemy) {
    const idx = encounter.enemies.findIndex((enemy) => enemy.id === selectedEnemy.id);
    if (idx >= 0) {
      const talkTendency = getTalkTendencyFor(encounter.enemies[idx].profile);
      const talkCfg = getBalanceConfig().talk;
      const analyzedBonus = encounter.analyzedEnemyIds.includes(selectedEnemy.id) || encounter.enemies[idx].revealed ? talkCfg.analyzeBonus : 0;
      const supportBonus = state.selectedLoadout.contractSupportId === 'radio_voice' ? 0.05 : 0;
      const firstTalkBonus = encounterPrep.firstTalkPending ? encounterPrep.firstTalkBonus : 0;
      const affinity = logAffinityReaction(encounter.enemies[idx], 'talk');
      const affinityRateBonus = affinity === 'weak' ? 0.1 : affinity === 'resist' ? -0.15 : 0;
      const successRate = clamp(
        talkCfg.baseSuccess
          + analyzedBonus
          + supportBonus
          + firstTalkBonus
          + (talkTendency?.successBias ?? 0)
          + affinityRateBonus
          - encounter.enemies[idx].pressure * talkCfg.pressurePenaltyPerStack,
        talkCfg.minSuccess,
        talkCfg.maxSuccess,
      );
      logs.push('> TALK CHANNEL OPEN');
      if (Math.random() < successRate) {
        encounter.enemies[idx] = applyTalkTemperament(encounter.enemies[idx]);
        if (activeSupportDaemon?.profile === 'roadside_phone') {
          if (encounter.enemies[idx].interest <= encounter.enemies[idx].trust) {
            encounter.enemies[idx].interest += 1;
            logs.push('> SUPPORT DAEMON: ROADSIDE PHONE / INTEREST +1');
          } else {
            encounter.enemies[idx].trust += 1;
            logs.push('> SUPPORT DAEMON: ROADSIDE PHONE / TRUST +1');
          }
        }
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
          moeLine = getDialogueLineWithVars(
            'moe.dynamic.battle.talk.boss_clear',
            '{target}との交渉成立。通行許可が出た。ボス反応が引いた。',
            { target: getMoeTargetName(encounter.enemies[idx]) },
          );
        } else {
          if (canOpenContractWindow(encounter.enemies[idx])) {
            encounter.enemies[idx].contractWindow = true;
            logs.push('> CONTRACT WINDOW OPEN');
          }
          logs.push('> NEGOTIATION RESPONSE: ACCEPTED');
          const targetName = getMoeTargetName(encounter.enemies[idx]);
          moeLine = affinity === 'weak'
            ? getDialogueLineWithVars('moe.dynamic.battle.talk.success.weak', '{target}への交信成功。返事が柔らかい。契約窓を狙える。', { target: targetName })
            : affinity === 'resist'
              ? getDialogueLineWithVars('moe.dynamic.battle.talk.success.resist', '{target}への交信成功。通ったけど警戒が強い。押しすぎ注意。', { target: targetName })
              : encounter.enemies[idx].contractWindow
                ? getDialogueLineWithVars('moe.dynamic.battle.talk.success.window_open', '{target}への交信成功。会話に乗った。今なら積める。', { target: targetName })
                : getDialogueLineWithVars('moe.dynamic.battle.talk.success.normal', '{target}への交信成功。反応は良い。もう一押し。', { target: targetName });
        }
      } else {
        encounter.enemies[idx].pressure += Math.max(1, talkTendency?.failPressure ?? 1);
        if (Math.random() < 0.45 && signal > 0) {
          signal -= 1;
          logs.push('> SIGNAL -1');
        }
        encounter.enemies[idx].intent = talkTendency?.failIntent ?? (encounter.enemies[idx].temperament === 'hostile' ? 'attack' : 'curse');
        logs.push('> NEGOTIATION RESPONSE: REJECTED');
        moeLine = getDialogueLineWithVars(
          'moe.dynamic.battle.talk.failure',
          '{target}への交信失敗。怒りが上がった。次手を変えよう。',
          { target: getMoeTargetName(encounter.enemies[idx]) },
        );
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
        moeLine = getDialogueLineWithVars(
          'moe.dynamic.battle.contract.no_window',
          '{target}へ契約試行。契約窓が未開放。TalkかS-Eを先に。',
          { target: getMoeTargetName(target) },
        );
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
        moeLine = getDialogueLineWithVars(
          'moe.dynamic.battle.contract.condition_fail',
          '{target}へ契約失敗。条件不足。反動が来る。',
          { target: getMoeTargetName(target) },
        );
      } else {
        const contractCfg = getBalanceConfig().contract;
        const analyzedBonus = encounter.analyzedEnemyIds.includes(target.id) || target.revealed ? contractCfg.analyzeBonus : 0;
        const baseSuccess = target.profile === 'toll_gate_saint' ? contractCfg.bossBaseSuccess : contractCfg.normalBaseSuccess;
        const successRate = clamp(
          baseSuccess + analyzedBonus - target.pressure * contractCfg.pressurePenaltyPerStack,
          contractCfg.minSuccess,
          contractCfg.maxSuccess,
        );
        logs.push('> CONTRACT PROTOCOL START');
        if (Math.random() < successRate) {
          logs.push('> ENTITY SIGNATURE CAPTURED');
          if (target.targetModuleId && !contracts.some((module) => module.id === target.targetModuleId)) {
            contracts = [...contracts, contractModules[target.targetModuleId]];
            logs.push(`> MODULE SLOT UPDATED: ${contractModules[target.targetModuleId].name.toUpperCase()}`);
          }
          logs.push(`> CONTRACT REGISTERED: ${target.name.toUpperCase()}`);
          const contractSuccessLine = getScenarioLine(getEncounterScenario(target.profile)?.contract?.success);
          if (contractSuccessLine) logs.push(`> ${contractSuccessLine}`);
          activeSupportDaemon = makeActiveSupportDaemon(target);
          logs.push(`> SUPPORT DAEMON LINKED: ${target.name.toUpperCase()} // ${activeSupportDaemon.effectLabel.toUpperCase()}`);
          logs.push(`> ${supportDaemonLinkFlavorLogs()[activeSupportDaemon.profile]}`);
          encounter.enemies[idx].hp = 0;
          encounter.enemies[idx].contractWindow = false;
          encounter.enemies[idx].exit = 'contracted';
          if (activeSupportDaemon.profile === 'silent_shape') {
            encounter.supportArmorGuardReady = true;
          }
          moeLine = `M.O.E.: ${supportDaemonMoeLinkLines[Math.floor(Math.random() * supportDaemonMoeLinkLines.length)]}`;
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
          moeLine = getDialogueLineWithVars(
            'moe.dynamic.battle.contract.reject',
            '{target}へ契約失敗。拒否された。まだ早い。',
            { target: getMoeTargetName(target) },
          );
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
      const targetName = getMoeTargetName(encounter.enemies[idx]);
      moeLine = affinity === 'weak'
        ? getDialogueLineWithVars('moe.dynamic.battle.ram.weak', '{target}へラムアタック。効いてる。押し切れる。', { target: targetName })
        : affinity === 'resist'
          ? getDialogueLineWithVars('moe.dynamic.battle.ram.resist', '{target}へラムアタック。固い。正面突破は不利。', { target: targetName })
          : getDialogueLineWithVars('moe.dynamic.battle.ram.normal', '{target}へラムアタック。衝突確認。こちらの装甲も削れてる。', { target: targetName });
      if (encounter.enemies[idx].hp <= 0 && !encounter.enemies[idx].exit) {
        encounter.enemies[idx].exit = 'defeated';
        salvageCredits += 1;
      }
    }
  }

  if (command === 'guard') {
    encounter.guardActive = true;
    logs.push('> DEFENSIVE POSTURE LOCKED');
    moeLine = getDialogueLine('moe.dynamic.battle.guard', '防御姿勢、固定。次の被弾を抑える。');
  }

  if (command === 'escape' && fuel > 0) {
    fuel = Math.max(0, fuel - 1);
    const reaperLike = encounter.enemies.some((enemy) => isAlive(enemy) && (enemy.profile === 'road_reaper' || enemy.profile === 'toll_gate_saint'));
    const escapeCfg = getBalanceConfig().escape;
    const successRate = reaperLike ? Math.max(0.01, escapeCfg.baseChance - escapeCfg.reaperPenalty) : escapeCfg.baseChance;
    logs.push('> DRIVE COMMAND: ESCAPE');
    logs.push('> THROTTLE OVERRIDE');
    if (Math.random() < successRate) {
      logs.push('> ESCAPE ROUTE FOUND');
      escaped = true;
      skipEnemyResolution = true;
      moeLine = getDialogueLine('moe.dynamic.battle.escape.success', '離脱。ルート確保。接触を切った。');
    } else {
      logs.push('> ESCAPE FAILED');
      moeLine = getDialogueLine('moe.dynamic.battle.escape.fail', '離脱失敗。受ける準備して。');
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
    const disconnectLogs = appendSupportDaemonDisconnectLogs(logs, activeSupportDaemon, 'archive');
    return {
      ...state,
      gamePhase: 'game_over',
      activeSupportDaemon: undefined,
      fuel,
      armor,
      signal,
      mainAmmo,
      seAmmo,
      contracts,
      salvageCredits,
      logs: appendRecoveredStoryLogLines([...disconnectLogs, '> SIGNAL LOST', '> VEHICLE DISABLED'], story),
      encounter: { ...encounter, phase: 'finished' },
      lastReport: report,
      runSummary: accumulateSummary(state.runSummary, report),
      resultType,
      story,
      encounterPrep,
      analyzeSuccessCount,
      moeLine: getDialogueLine('moe.run.game_over', '応答して。……だめ、車両信号が落ちてる。'),
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
        activeSupportDaemon,
        salvageCredits,
        logs: [...logsWithClear, '> RETURN GATE ROUTE OPEN'],
        encounter: { ...encounter, phase: 'finished' },
        lastReport: report,
        runSummary: summary,
        resultType: 'Boss Cleared',
        encounterPrep,
        analyzeSuccessCount,
        moeLine: getDialogueLine('moe.run.return_gate_seen', '帰還ゲート、見えた。まだ車は動くね。'),
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
      activeSupportDaemon,
      salvageCredits,
      logs: [...logsWithClear, '> SALVAGE RESULT READY'],
      encounter: { ...encounter, phase: 'finished' },
      lastReport: report,
      runSummary: summary,
      rewardScope: state.encounter.kind === 'enc1' ? 'post_enc1' : 'post_enc2',
      encounterPrep,
      analyzeSuccessCount,
      moeLine: getDialogueLine('moe.run.encounter_clear', '遭遇クリア。次の判断に備えよう。'),
    };
  }

  const alive = encounter.enemies.filter(isAlive);
  if (alive.length > 0 && !alive.some((enemy) => enemy.id === encounter.selectedEnemyId)) encounter.selectedEnemyId = alive[0].id;
  const { forecast, unstable } = buildForecast(
    encounter.enemies,
    hasAiNaviContract(contracts),
    state.selectedLoadout.contractSupportId,
    activeSupportDaemon?.profile,
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
    activeSupportDaemon,
    salvageCredits,
    logs,
    encounterPrep,
    analyzeSuccessCount,
    moeLine,
    encounter,
  };
}

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const [balanceConfig, setBalanceConfig] = useState<BalanceConfig>(defaultBalanceConfig);
  const [devilConfigVersion, setDevilConfigVersion] = useState(getDevilConfig().version);
  const [dialogueConfigVersion, setDialogueConfigVersion] = useState(getDialogueConfig().version);
  const [autoplayRuns, setAutoplayRuns] = useState(() => defaultBalanceConfig.autoplay.defaultRuns);
  const [autoplayStrategy, setAutoplayStrategy] = useState<AutoPlayStrategy>('balanced');
  const [autoplayReport, setAutoplayReport] = useState<AutoPlayReport | null>(null);
  const [showPlaytestReport, setShowPlaytestReport] = useState(false);
  const [showSaveTools, setShowSaveTools] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showUtilityPanels, setShowUtilityPanels] = useState(false);
  const [showRunHistory, setShowRunHistory] = useState(false);
  const [, setHoveredMoeHint] = useState('');
  const [hoveredEnemyId, setHoveredEnemyId] = useState<string | null>(null);
  const [telemetryRefresh, setTelemetryRefresh] = useState(0);
  const [saveRefresh, setSaveRefresh] = useState(0);
  const [debugSaveHeaders, setDebugSaveHeaders] = useState<Array<{ id: string; label?: string; createdAt: number }>>([]);
  const [saveMessage, setSaveMessage] = useState('');
  const [hitFxTone, setHitFxTone] = useState<HitFxTone | null>(null);
  const [hitFxPulse, setHitFxPulse] = useState(0);
  const [assetManifest, setAssetManifest] = useState<AssetManifest>(defaultAssetManifest);
  const [assetManifestLoaded, setAssetManifestLoaded] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const terminalLogRef = useRef<HTMLUListElement | null>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const lastSfxAtRef = useRef(0);
  const phaseRef = useRef<GamePhase>(state.gamePhase);
  const bossChallengedRef = useRef(state.bossChallenged);
  const runIndexRef = useRef(0);
  const processedLogCountRef = useRef(0);
  const loadoutHashRef = useRef(JSON.stringify(state.selectedLoadout));
  const activeRunRef = useRef<RunRecord | null>(null);
  const lastAutoSaveAtRef = useRef(0);
  const latestStateRef = useRef(state);
  const saveImportInputRef = useRef<HTMLInputElement | null>(null);
  const selectedMainGun = getMainGunSpec(state.selectedLoadout.mainGunId);
  const selectedSubGun = getSubGunSpec(state.selectedLoadout.subGunId);
  const selectedSE = getSpecialEquipmentSpec(state.selectedLoadout.specialEquipmentId);
  const selectedSupport = contractSupportCatalog[state.selectedLoadout.contractSupportId];
  const nextRunPreview = getRunStartResources(state.selectedLoadout, state.vehicleUpgrades);
  const balance = getBalanceConfig();
  const dashboardFuelCapBase = balance.resources.baseFuel + state.vehicleUpgrades.fuel_tank;
  const dashboardArmorCapBase = balance.resources.baseArmor + state.vehicleUpgrades.armor_plating;
  const dashboardSignalCapBase = balance.resources.baseSignal;
  const dashboardFuelMax = Math.max(dashboardFuelCapBase, state.fuel);
  const dashboardArmorMax = Math.max(dashboardArmorCapBase, state.armor);
  const dashboardSignalMax = Math.max(dashboardSignalCapBase, state.signal);
  const armorCriticalRatio = dashboardArmorMax > 0 ? state.armor / dashboardArmorMax : 1;
  const isArmorCritical = armorCriticalRatio <= 0.25;
  const skillOrder: UpgradeId[] = ['ram_control', 'gunnery', 'scan_boost', 'translation_assist'];
  const vehicleUpgradeOrder: VehicleUpgradeId[] = ['fuel_tank', 'armor_plating', 'ammo_rack', 'se_rack'];

  const selectedEnemy = useMemo(() => getSelectedEnemy(state.encounter), [state.encounter]);
  const hoveredEnemy = useMemo(
    () => (hoveredEnemyId ? state.encounter.enemies.find((enemy) => enemy.id === hoveredEnemyId) : undefined),
    [hoveredEnemyId, state.encounter.enemies],
  );
  const detailEnemy = hoveredEnemy && isAlive(hoveredEnemy) ? hoveredEnemy : selectedEnemy;
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
    ? `STG ${String(state.stage).padStart(2, '0')} / WAVE ${String(state.encounterIndex + 1).padStart(2, '0')}`
    : state.gamePhase.toUpperCase();
  const depth = (state.stage - 1) * 3 + state.encounterIndex + 1;
  const isBattlePhase = state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter';
  const isBossPhase = state.gamePhase === 'boss_preview' || state.gamePhase === 'boss_encounter';
  const isRoadMoving = ['approach', 'route_choice', 'salvage', 'signal', 'boss_preview', 'reward', 'return_gate'].includes(state.gamePhase);
  const isRoadStopped = isBattlePhase || state.gamePhase === 'garage' || state.gamePhase === 'result' || state.gamePhase === 'game_over';
  const isEncounterActive = (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') && state.encounter.phase === 'command';
  const isWindshieldFolded = state.gamePhase === 'garage';
  const speed = isBattlePhase ? 0 : isRoadMoving ? 122 : state.gamePhase === 'prologue' ? 64 : 8;
  const enemyAssetMap = assetManifest.images.enemies ?? {};
  const unknownEnemyPool = [
    resolveAssetUrl(enemyAssetMap.unknown_sign),
    resolveAssetUrl(enemyAssetMap.unknown),
    resolveAssetUrl(enemyAssetMap.unknown_mask_a),
    resolveAssetUrl(enemyAssetMap.unknown_mask_b),
    resolveAssetUrl('images/devil/UNKNOWN.png'),
    resolveAssetUrl('images/devil/MirrorCurve.png'),
    resolveAssetUrl('images/devil/ConeSwarm.png'),
  ].filter((value): value is string => !!value);
  const resolveUnknownEnemyAsset = (index: number): string | undefined =>
    unknownEnemyPool.length ? unknownEnemyPool[index % unknownEnemyPool.length] : undefined;
  const playerAsset = resolveAssetUrl(assetManifest.images.player);
  const moeVariantMap = assetManifest.images.moeVariants ?? {};
  const resolveMoeAsset = (
    variant: 'default' | 'smile' | 'serious' | 'confused' | 'relaxed' | 'hud',
  ): string | undefined => resolveAssetUrl(moeVariantMap[variant]) ?? resolveAssetUrl(assetManifest.images.moe);
  const selectedMoeVariant: 'default' | 'smile' | 'serious' | 'confused' | 'relaxed' | 'hud' =
    state.gamePhase === 'game_over'
      ? 'confused'
      : state.gamePhase === 'boss_encounter' || state.gamePhase === 'boss_preview'
        ? 'serious'
        : state.gamePhase === 'route_choice' || state.gamePhase === 'approach'
          ? 'hud'
          : state.gamePhase === 'garage'
            ? 'relaxed'
            : state.gamePhase === 'result' || state.gamePhase === 'reward' || state.gamePhase === 'return_gate'
              ? 'smile'
              : (state.armor <= 3 || state.signal <= 1)
                ? 'serious'
                : 'default';
  const moeAsset = resolveMoeAsset(selectedMoeVariant);
  const logoAsset = resolveAssetUrl(assetManifest.images.logo);
  const windshieldImage = resolveAssetUrl(assetManifest.images.ui?.windshield);
  const nightLoopIntroImage = resolveAssetUrl(assetManifest.images.ui?.nightloop) ?? windshieldImage;
  const roadOverlayImage = resolveAssetUrl(assetManifest.images.ui?.roadOverlay);
  const shellClassName = assetManifest.ui.shellClass?.trim() ?? '';

  const terminalStatus = [
    state.signal <= 1 ? 'SIGNAL WEAK' : 'SIGNAL LOCKED',
    `TURN ${String(state.encounter.turn).padStart(2, '0')}`,
    state.encounter.guardActive ? 'GUARD ACTIVE' : 'GUARD OFF',
    `MAIN AMMO ${state.mainAmmo}/${state.maxMainAmmo}`,
    `S-E AMMO ${state.seAmmo}/${state.maxSeAmmo}`,
    `MAIN ${selectedMainGun.name.toUpperCase()}`,
    isBossPhase ? 'BOSS CONTACT' : 'PATROL CONTACT',
    assetManifestLoaded ? `ASSET ${assetManifest.version.toUpperCase()}` : 'ASSET DEFAULT',
    `DEVIL CFG ${devilConfigVersion.toUpperCase()}`,
    `DIALOGUE ${dialogueConfigVersion.toUpperCase()}`,
  ];

  const tacticalLines = [
    aliveEnemies.length > 0 ? 'ENTITY DETECTED' : 'NO HOSTILES IN LANE',
    selectedEnemy ? `CURRENT INTENT ${selectedEnemy.intent.toUpperCase()}` : 'NO ACTIVE TARGET',
    (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter')
      ? `STAGE ${state.stage}/${state.stageCount} - ENCOUNTER ${state.encounterIndex + 1}/3`
      : state.gamePhase.toUpperCase(),
  ];

  const contractEnabled = !!selectedEnemy && selectedEnemy.contractWindow && selectedEnemy.contractable;
  const selectedEnemyAnalyzed = !!selectedEnemy && (state.encounter.analyzedEnemyIds.includes(selectedEnemy.id) || selectedEnemy.affinityRevealed);
  const detailEnemyAnalyzed = !!detailEnemy && (state.encounter.analyzedEnemyIds.includes(detailEnemy.id) || detailEnemy.affinityRevealed);
  const selectedEnemyDisplayLabel = selectedEnemyAnalyzed && selectedEnemy
    ? encounterProfiles()[selectedEnemy.profile].label
    : 'UNKNOWN SIGN';
  const signalTunnelScenario = getRouteEventScenario('signal_tunnel_01');
  const detailIntentIconMap: Record<Intent, string> = {
    attack: '⚔',
    curse: '☣',
    bargain: '◇',
    guard: '🛡',
    flee: '↯',
  };
  const resolveEnemyLane = (index: number, total: number, isBoss: boolean): 'left' | 'center' | 'right' => {
    if (isBoss || total <= 1) return 'center';
    if (total === 2) return index === 0 ? 'left' : 'right';
    if (index === 0) return 'left';
    if (index === 1) return 'center';
    return 'right';
  };
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
  type AppRuntimeSaveSnapshot = {
    state: State;
    runIndex: number;
    activeRun: RunRecord | null;
  };
  const saveSnapshot = useMemo(() => loadSaveData(), [saveRefresh]);
  const autoSaveSnapshot = useMemo(() => loadAutoSaveSnapshot<AppRuntimeSaveSnapshot>(), [saveRefresh]);
  const archiveEntries = useMemo(
    () =>
      Object.values(saveSnapshot.demonArchive)
        .filter((entry) => entry.seenCount > 0)
        .sort((a, b) => b.lastSeenAt - a.lastSeenAt),
    [saveSnapshot.demonArchive],
  );
  const latestRunRecord = useMemo(
    () => [...saveSnapshot.runHistory].sort((a, b) => b.endedAt - a.endedAt)[0],
    [saveSnapshot.runHistory],
  );
  const latest3Runs = useMemo(
    () => [...saveSnapshot.runHistory].sort((a, b) => b.endedAt - a.endedAt).slice(0, 3),
    [saveSnapshot.runHistory],
  );
  const routeLogEntries = useMemo(
    () => Object.values(saveSnapshot.routeLog).sort((a, b) => b.lastChosenAt - a.lastChosenAt),
    [saveSnapshot.routeLog],
  );
  const moeMemoryEntries = useMemo(
    () => Object.values(saveSnapshot.moeMemory).sort((a, b) => b.unlockedAt - a.unlockedAt),
    [saveSnapshot.moeMemory],
  );
  const telemetryEvents = useMemo(() => getTelemetryEvents(), [telemetryRefresh]);
  const contractsAcquiredTotal = useMemo(
    () => saveSnapshot.runHistory.reduce((acc, run) => acc + run.contractsAcquired.length, 0),
    [saveSnapshot.runHistory],
  );
  const latestResult = latestRunRecord?.resultType ?? 'N/A';
  const persistentProgression: PersistentProgressionSnapshot = useMemo(
    () => ({
      persistedRuns: saveSnapshot.runHistory.length,
      archiveDiscoveryCount: archiveEntries.length,
      routeLogCount: routeLogEntries.length,
      memoryUnlockCount: moeMemoryEntries.length,
      previousRunSummaryText: latestRunRecord
        ? `${resultLabel(latestRunRecord.resultType)} / encounters ${latestRunRecord.encountersCleared} / contracts ${latestRunRecord.contractsAcquired.length}`
        : getDialogueLine('ui.common.no_previous_run', 'No previous run data'),
      latestMoeSuggestion: latestRunRecord?.moeComment ?? (latestRunRecord ? buildMoeRunComment(latestRunRecord) : 'No suggestion yet'),
    }),
    [saveSnapshot.runHistory.length, archiveEntries.length, routeLogEntries.length, moeMemoryEntries.length, latestRunRecord],
  );
  const playtestReport = useMemo(
    () => buildPlaytestReport(telemetryEvents, persistentProgression),
    [telemetryEvents, persistentProgression],
  );

  const buildTelemetryContext = (): Record<string, unknown> => ({
    gamePhase: state.gamePhase,
    runIndex: runIndexRef.current,
    stage: state.stage,
    encounterIndex: state.encounterIndex,
    turn: state.encounter.turn,
    resources: {
      fuel: state.fuel,
      armor: state.armor,
      signal: state.signal,
      mainAmmo: state.mainAmmo,
      seAmmo: state.seAmmo,
    },
    contracts: state.contracts.map((contract) => contract.id),
    loadout: {
      mainGunId: state.selectedLoadout.mainGunId,
      subGunId: state.selectedLoadout.subGunId,
      specialEquipmentId: state.selectedLoadout.specialEquipmentId,
      contractSupportId: state.selectedLoadout.contractSupportId,
    },
  });

  const emitTelemetry = (name: TelemetryEventName, payload: Record<string, unknown> = {}) => {
    trackEvent(name, { ...buildTelemetryContext(), ...payload });
    setTelemetryRefresh((value) => value + 1);
  };
  const refreshSaveSnapshot = () => setSaveRefresh((value) => value + 1);
  const buildRuntimeSnapshot = (): AppRuntimeSaveSnapshot => ({
    state: latestStateRef.current,
    runIndex: runIndexRef.current,
    activeRun: activeRunRef.current,
  });
  const autoSaveNow = (reason: string) => {
    const saved = saveAutoSaveSnapshot(buildRuntimeSnapshot(), reason);
    if (saved) {
      lastAutoSaveAtRef.current = saved.savedAt;
      setSaveMessage(`AutoSaved: ${new Date(saved.savedAt).toLocaleTimeString()} (${reason})`);
      refreshSaveSnapshot();
    }
  };
  const refreshDebugHeaders = () => {
    setDebugSaveHeaders(listDebugSaveHeaders());
  };
  const beginRunRecord = () => {
    const ts = Date.now();
    const id = `run-${ts}-${Math.random().toString(36).slice(2, 8)}`;
    activeRunRef.current = {
      id,
      startedAt: ts,
      endedAt: ts,
      encountersCleared: 0,
      bossChallenged: false,
      bossCleared: false,
      contractsAcquired: [],
      defeatedEnemies: [],
      analyzedEnemies: [],
      routeChoices: [],
      returnGateUsed: false,
      finalResources: {
        fuel: state.fuel,
        armor: state.armor,
        signal: state.signal,
        mainAmmo: state.mainAmmo,
        seAmmo: state.seAmmo,
      },
      moeComment: narrativeMoeLine,
    };
    updateSaveData((current) => ({ ...current, totalRuns: current.totalRuns + 1 }));
    refreshSaveSnapshot();
    autoSaveNow('run_start');
  };
  const finalizeRunRecord = (resultType: string, gameOverReason?: string) => {
    const current = activeRunRef.current;
    if (!current) return;
    const endedAt = Date.now();
    const finalizedBase: RunRecord = {
      ...current,
      endedAt,
      resultType,
      encountersCleared: state.runSummary.cleared,
      bossChallenged: state.bossChallenged,
      bossCleared: resultType === 'Boss Cleared',
      returnGateUsed: resultType === 'Early Return' || resultType === 'Boss Avoided' || resultType === 'Boss Cleared',
      contractsAcquired: Array.from(new Set([...current.contractsAcquired, ...state.contracts.map((contract) => contract.id)])),
      finalResources: {
        fuel: state.fuel,
        armor: state.armor,
        signal: state.signal,
        mainAmmo: state.mainAmmo,
        seAmmo: state.seAmmo,
      },
      moeComment: undefined,
      gameOverReason,
    };
    const finalized: RunRecord = {
      ...finalizedBase,
      moeComment: buildMoeRunComment(finalizedBase),
    };
    recordRunResult(finalized);
    if (resultType === 'Boss Cleared') {
      unlockMoeMemory({
        id: `boss-clear-${state.stage}`,
        title: `Stage ${state.stage} Cleared`,
        text: 'Toll Gate Saint route stabilized. M.O.E. memory trace deepened.',
        source: 'boss',
      });
      unlockMoeMemory({
        id: 'memory_previous_driver',
        title: 'Previous Driver',
        text: 'M.O.E., if you hear this, do not trust the toll gate.',
        source: 'boss',
      });
    }
    activeRunRef.current = null;
    refreshSaveSnapshot();
    autoSaveNow('run_end');
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const loaded = await loadAssetManifest();
      if (!cancelled) {
        setAssetManifest(loaded);
        setAssetManifestLoaded(true);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const loaded = await loadBalanceConfig();
      if (!cancelled) {
        setBalanceConfig(loaded);
        setAutoplayRuns((prev) => (prev === defaultBalanceConfig.autoplay.defaultRuns ? loaded.autoplay.defaultRuns : prev));
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const loaded = await loadDevilConfig();
      if (!cancelled) setDevilConfigVersion(loaded.version);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadScenarioPack();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const loaded = await loadDialogueConfig();
      if (!cancelled) setDialogueConfigVersion(loaded.version);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cssVars = assetManifest.ui.cssVars ?? {};
    const root = document.documentElement;
    const touched: string[] = [];
    for (const [rawKey, value] of Object.entries(cssVars)) {
      const key = rawKey.startsWith('--') ? rawKey : `--${rawKey}`;
      root.style.setProperty(key, value);
      touched.push(key);
    }
    return () => {
      for (const key of touched) root.style.removeProperty(key);
    };
  }, [assetManifest.ui.cssVars]);

  useEffect(() => {
    const unlock = () => setAudioUnlocked(true);
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    const bgmUrl = resolveAssetUrl(assetManifest.media.bgm);
    if (bgmRef.current) {
      bgmRef.current.pause();
      bgmRef.current = null;
    }
    if (!bgmUrl) return;
    const audio = new Audio(bgmUrl);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.35;
    bgmRef.current = audio;
    if (audioUnlocked) void audio.play().catch(() => undefined);
    return () => {
      audio.pause();
    };
  }, [assetManifest.media.bgm, audioUnlocked]);

  useEffect(() => {
    if (!audioUnlocked) return;
    const log = state.logs[state.logs.length - 1] ?? '';
    const cue = pickSfxCueFromLog(log, state.gamePhase);
    if (!cue) return;
    const sfxMap = assetManifest.media.sfx ?? {};
    const src = resolveAssetUrl(sfxMap[cue]);
    if (!src) return;
    const now = Date.now();
    if (now - lastSfxAtRef.current < 80) return;
    lastSfxAtRef.current = now;
    const audio = new Audio(src);
    audio.volume = 0.45;
    void audio.play().catch(() => undefined);
  }, [state.logs, state.gamePhase, assetManifest.media.sfx, audioUnlocked]);

  useEffect(() => {
    const log = state.logs[state.logs.length - 1] ?? '';
    let nextTone: HitFxTone | null = null;
    if (log.includes('WEAK POINT DETECTED')) nextTone = 'weak';
    else if (log.includes('RESISTED')) nextTone = 'resist';
    else if (log.includes('IMPACT CONFIRMED') || log.includes('MULTI TARGET HIT') || log.includes('CHASSIS IMPACT CONFIRMED')) nextTone = 'hit';
    if (!nextTone) return;
    setHitFxTone(nextTone);
    setHitFxPulse((prev) => prev + 1);
    const timer = setTimeout(() => setHitFxTone(null), 420);
    return () => clearTimeout(timer);
  }, [state.logs]);

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

  useEffect(() => {
    setHoveredMoeHint('');
  }, [state.gamePhase]);

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  useEffect(() => {
    emitTelemetry('app_loaded');
    emitTelemetry('prologue_started');
    updateSaveData((current) => current);
    refreshSaveSnapshot();
    refreshDebugHeaders();
    phaseRef.current = state.gamePhase;
    bossChallengedRef.current = state.bossChallenged;
    processedLogCountRef.current = state.logs.length;
    autoSaveNow('app_loaded');
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      autoSaveNow('interval');
    }, 20000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    autoSaveNow(`phase:${state.gamePhase}`);
  }, [state.gamePhase]);

  useEffect(() => {
    const prevPhase = phaseRef.current;
    if (prevPhase !== state.gamePhase) {
      if (state.gamePhase === 'prologue') emitTelemetry('prologue_started');
      if (state.gamePhase === 'approach') emitTelemetry('approach_started');
      if (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') {
        emitTelemetry('encounter_started', {
          encounterKind: state.encounter.kind,
          enemies: state.encounter.enemies.map((enemy) => ({ id: enemy.id, profile: enemy.profile })),
        });
        for (const enemy of state.encounter.enemies) {
          touchDemonArchive(enemy.profile, {
            name: enemy.name,
            profile: enemy.profile,
          });
        }
        refreshSaveSnapshot();
      }
      if (state.gamePhase === 'reward') emitTelemetry('reward_shown');
      if (state.gamePhase === 'route_choice') emitTelemetry('route_choice_shown');
      if (state.gamePhase === 'boss_preview') {
        emitTelemetry('boss_preview_seen');
        unlockMoeMemory({
          id: 'memory_toll_gate',
          title: 'Toll Gate Signal',
          text: 'The toll is not fuel, not a name. It is the will to return.',
          source: 'boss',
        });
        refreshSaveSnapshot();
      }
      if (state.gamePhase === 'garage') emitTelemetry('garage_entered');
      if (state.gamePhase === 'game_over') emitTelemetry('game_over');
      if (state.gamePhase === 'result') {
        emitTelemetry('result_shown', { resultType: state.resultType ?? 'unknown' });
        if (prevPhase === 'return_gate' || state.resultType === 'Early Return' || state.resultType === 'Boss Avoided') {
          emitTelemetry('return_gate_used', { resultType: state.resultType ?? 'unknown' });
        }
        if (state.resultType === 'Early Return' || state.resultType === 'Boss Avoided') {
          emitTelemetry('route_choice_selected', { route: 'return_gate' });
        }
        if (state.resultType === 'Boss Cleared') emitTelemetry('boss_cleared');
        finalizeRunRecord(state.resultType ?? 'Unknown');
      }
      if (state.gamePhase === 'game_over') {
        finalizeRunRecord('Vehicle Disabled', 'fuel_or_armor_zero');
      }
      phaseRef.current = state.gamePhase;
    }
  }, [state.gamePhase, state.encounter, state.resultType]);

  useEffect(() => {
    if (!bossChallengedRef.current && state.bossChallenged) emitTelemetry('boss_challenged');
    if (!bossChallengedRef.current && state.bossChallenged && activeRunRef.current) {
      activeRunRef.current.bossChallenged = true;
    }
    bossChallengedRef.current = state.bossChallenged;
  }, [state.bossChallenged]);

  useEffect(() => {
    if (state.gamePhase !== 'garage') return;
    const nextHash = JSON.stringify(state.selectedLoadout);
    if (loadoutHashRef.current !== nextHash) {
      emitTelemetry('loadout_changed', { loadout: state.selectedLoadout });
      loadoutHashRef.current = nextHash;
    }
  }, [state.gamePhase, state.selectedLoadout]);

  useEffect(() => {
    if (state.story.recentRecoveredLogs.length === 0) return;
    for (const id of state.story.recentRecoveredLogs) {
      const log = storyLogById[id];
      if (!log) continue;
      unlockMoeMemory({
        id: `story-${id}`,
        title: log.title,
        text: log.text,
        source: 'story',
      });
      if (id === 'LOG_00') {
        unlockMoeMemory({
          id: 'memory_previous_driver',
          title: 'Previous Driver',
          text: 'M.O.E., if you hear this, do not trust the toll gate.',
          source: 'story',
        });
      }
      if (id === 'LOG_02') {
        unlockMoeMemory({
          id: 'memory_am_666',
          title: 'AM 666.0',
          text: 'AM 666.0 does not broadcast the future. It broadcasts the roads we did not choose.',
          source: 'story',
        });
      }
    }
    refreshSaveSnapshot();
  }, [state.story.recentRecoveredLogs]);

  useEffect(() => {
    const startIndex = processedLogCountRef.current;
    if (startIndex >= state.logs.length) return;
    const fresh = state.logs.slice(startIndex);
    for (const line of fresh) {
      const clean = line.replace(/^>\s*/, '').trim();
      if (clean.startsWith('RUN START')) {
        runIndexRef.current += 1;
        emitTelemetry('run_started', { runIndex: runIndexRef.current });
        if (runIndexRef.current >= 2) emitTelemetry('next_run_started', { runIndex: runIndexRef.current });
        beginRunRecord();
      }
      if (clean.startsWith('COMMAND:')) {
        const token = clean.split(':')[1]?.split('/')[0]?.trim().toLowerCase() ?? 'unknown';
        const commandId = token;
        const selected = getSelectedEnemy(state.encounter);
        emitTelemetry('command_used', {
          commandId,
          enemyId: selected?.id,
          enemyProfile: selected?.profile,
        });
        if (commandId === 'analyze') emitTelemetry('analyze_used');
        if (commandId === 'talk') emitTelemetry('talk_used');
        if (commandId === 'contract') emitTelemetry('contract_attempted');
      }
      if (clean.includes('SIGNATURE SCAN COMPLETE')) {
        emitTelemetry('analyze_success');
        const selected = getSelectedEnemy(state.encounter);
        if (selected && activeRunRef.current) {
          activeRunRef.current.analyzedEnemies = Array.from(new Set([...activeRunRef.current.analyzedEnemies, selected.profile]));
          touchDemonArchive(selected.profile, {
            name: selected.name,
            profile: selected.profile,
            analyzed: true,
            affinityRevealed: true,
            affinities: Object.fromEntries(
              Object.entries(selected.affinities).map(([key, value]) => [key, String(value)]),
            ),
          });
          refreshSaveSnapshot();
        }
      }
      if (clean.includes('CONTRACT WINDOW OPEN') || clean.includes('CONTRACT WINDOW: PARTIAL OPEN')) emitTelemetry('contract_window_opened');
      if (clean.includes('CONTRACT REGISTERED')) {
        emitTelemetry('contract_success');
        if (activeRunRef.current) {
          activeRunRef.current.contractsAcquired = Array.from(new Set([
            ...activeRunRef.current.contractsAcquired,
            ...state.contracts.map((contract) => contract.id),
          ]));
        }
        const contractTargetName = clean.split('CONTRACT REGISTERED:')[1]?.trim();
        if (contractTargetName) {
          const match = Object.entries(devilTemplates()).find(([, template]) => template.name.toUpperCase() === contractTargetName.toUpperCase());
          if (match) {
            const [profile, template] = match;
            touchDemonArchive(profile, {
              name: template.name,
              profile,
              analyzed: true,
            });
            if (profile === 'abandoned_ai_navi') {
              unlockMoeMemory({
                id: 'memory_moe_identity',
                title: 'M.O.E. Identity',
                text: 'I am registered as a navigation AI. Then who recorded this voice?',
                source: 'contract',
              });
            }
            refreshSaveSnapshot();
          }
        }
      }
      if (clean.includes('SUPPORT DAEMON LINKED:')) {
        const daemonName = clean.split('SUPPORT DAEMON LINKED:')[1]?.split('//')[0]?.trim();
        if (daemonName) {
          const match = Object.entries(devilTemplates()).find(([, template]) => template.name.toUpperCase() === daemonName.toUpperCase());
          if (match) {
            const [profile, template] = match;
            touchDemonArchive(profile, {
              name: template.name,
              profile,
              contractedDelta: 1,
              analyzed: true,
            });
            refreshSaveSnapshot();
          }
        }
      }
      if (clean.includes('TARGET DOWN:')) {
        const enemyName = clean.split('TARGET DOWN:')[1]?.split('/')[0]?.trim();
        emitTelemetry('enemy_defeated', { enemyName });
        const match = Object.entries(devilTemplates()).find(([, template]) => template.name.toUpperCase() === (enemyName ?? '').toUpperCase());
        if (match && activeRunRef.current) {
          const [profile, template] = match;
          activeRunRef.current.defeatedEnemies = Array.from(new Set([...activeRunRef.current.defeatedEnemies, profile]));
          touchDemonArchive(profile, {
            name: template.name,
            profile,
            defeatedDelta: 1,
          });
          refreshSaveSnapshot();
        }
      }
      if (clean.includes('SALVAGE APPLIED:')) {
        const rewardName = clean.split('SALVAGE APPLIED:')[1]?.trim();
        emitTelemetry('reward_selected', { rewardName });
      }
      if (clean === 'SALVAGE LANE SELECTED') {
        emitTelemetry('route_choice_selected', { route: 'salvage' });
        if (activeRunRef.current) activeRunRef.current.routeChoices.push('salvage');
        touchRouteLog('salvage', routeLogCatalog.salvage.name, routeLogCatalog.salvage.note);
        refreshSaveSnapshot();
      }
      if (clean === 'SIGNAL LANE SELECTED') {
        emitTelemetry('route_choice_selected', { route: 'signal' });
        if (activeRunRef.current) activeRunRef.current.routeChoices.push('signal');
        touchRouteLog('signal', routeLogCatalog.signal.name, routeLogCatalog.signal.note);
        refreshSaveSnapshot();
      }
      if (clean.startsWith('SIGNAL TUNNEL CHOICE:')) {
        const rawChoice = clean.split('SIGNAL TUNNEL CHOICE:')[1]?.trim().toLowerCase();
        if (rawChoice) emitTelemetry('route_choice_selected', { route: `signal:${rawChoice}` });
      }
      if (clean === 'PUSH FORWARD SELECTED') {
        emitTelemetry('route_choice_selected', { route: 'push_forward' });
        if (activeRunRef.current) activeRunRef.current.routeChoices.push('push_forward');
        touchRouteLog('push_forward', routeLogCatalog.push_forward.name, routeLogCatalog.push_forward.note);
        refreshSaveSnapshot();
      }
      if (clean.includes('RETURN GATE ROUTE OPEN')) {
        emitTelemetry('route_choice_selected', { route: 'return_gate' });
        if (activeRunRef.current) activeRunRef.current.routeChoices.push('return_gate');
        touchRouteLog('return_gate', routeLogCatalog.return_gate.name, routeLogCatalog.return_gate.note);
        refreshSaveSnapshot();
      }
      if (clean.includes('BOSS ENCOUNTER: TOLL GATE SAINT')) {
        if (activeRunRef.current) activeRunRef.current.routeChoices.push('boss');
        touchRouteLog('boss', routeLogCatalog.boss.name, routeLogCatalog.boss.note);
        refreshSaveSnapshot();
      }
      if (clean.includes('AM 666.0')) {
        unlockMoeMemory({
          id: 'memory_am_666',
          title: 'AM 666.0',
          text: 'AM 666.0 does not broadcast the future. It broadcasts the roads we did not choose.',
          source: 'run',
        });
        refreshSaveSnapshot();
      }
    }
    processedLogCountRef.current = state.logs.length;
  }, [state.logs, state.encounter, state.gamePhase]);

  const logLines = state.logs.slice(-24);
  const groupOrder: ('WEAPON' | 'TERMINAL' | 'DRIVE')[] = ['WEAPON', 'TERMINAL', 'DRIVE'];
  const runAutoplay = () => {
    setAutoplayReport(runAutoplayBatch(state.selectedLoadout, autoplayRuns, autoplayStrategy));
  };
  const showFirstGarageGuide = state.gamePhase === 'prologue' && !state.previousRun;
  const saveDebugNow = () => {
    const label = `${state.gamePhase} / STG${state.stage}-ENC${state.encounterIndex + 1}`;
    const saved = saveDebugSnapshot(buildRuntimeSnapshot(), label);
    if (saved) {
      setSaveMessage(`Debug saved: ${new Date(saved.createdAt).toLocaleTimeString()}`);
      refreshDebugHeaders();
      refreshSaveSnapshot();
    }
  };
  const restoreAutoSaveNow = () => {
    const snap = loadAutoSaveSnapshot<AppRuntimeSaveSnapshot>();
    if (!snap?.snapshot?.state) {
      setSaveMessage('AutoSave not found.');
      return;
    }
    const safeState = sanitizeRestoredState(snap.snapshot.state, state);
    dispatch({ type: 'DEBUG_RESTORE', snapshot: safeState });
    runIndexRef.current = typeof snap.snapshot.runIndex === 'number' ? snap.snapshot.runIndex : runIndexRef.current;
    activeRunRef.current = snap.snapshot.activeRun ?? null;
    phaseRef.current = safeState.gamePhase;
    bossChallengedRef.current = safeState.bossChallenged;
    processedLogCountRef.current = safeState.logs.length;
    loadoutHashRef.current = JSON.stringify(safeState.selectedLoadout);
    setSaveMessage(`Restored AutoSave (${new Date(snap.savedAt).toLocaleTimeString()})`);
    refreshSaveSnapshot();
  };
  const restoreLatestDebugNow = () => {
    const latest = loadLatestDebugSnapshot<AppRuntimeSaveSnapshot>();
    if (!latest?.snapshot?.state) {
      setSaveMessage('Debug save not found.');
      return;
    }
    const safeState = sanitizeRestoredState(latest.snapshot.state, state);
    dispatch({ type: 'DEBUG_RESTORE', snapshot: safeState });
    runIndexRef.current = typeof latest.snapshot.runIndex === 'number' ? latest.snapshot.runIndex : runIndexRef.current;
    activeRunRef.current = latest.snapshot.activeRun ?? null;
    phaseRef.current = safeState.gamePhase;
    bossChallengedRef.current = safeState.bossChallenged;
    processedLogCountRef.current = safeState.logs.length;
    loadoutHashRef.current = JSON.stringify(safeState.selectedLoadout);
    setSaveMessage(`Restored Debug: ${latest.label ?? latest.id}`);
    refreshSaveSnapshot();
  };
  const restoreDebugById = (id: string) => {
    const entry = loadDebugSnapshotById<AppRuntimeSaveSnapshot>(id);
    if (!entry?.snapshot?.state) {
      setSaveMessage('Selected debug save is invalid.');
      return;
    }
    const safeState = sanitizeRestoredState(entry.snapshot.state, state);
    dispatch({ type: 'DEBUG_RESTORE', snapshot: safeState });
    runIndexRef.current = typeof entry.snapshot.runIndex === 'number' ? entry.snapshot.runIndex : runIndexRef.current;
    activeRunRef.current = entry.snapshot.activeRun ?? null;
    phaseRef.current = safeState.gamePhase;
    bossChallengedRef.current = safeState.bossChallenged;
    processedLogCountRef.current = safeState.logs.length;
    loadoutHashRef.current = JSON.stringify(safeState.selectedLoadout);
    setSaveMessage(`Restored Debug Slot: ${entry.label ?? entry.id}`);
    refreshSaveSnapshot();
  };
  const clearAutoSaveNow = () => {
    clearAutoSaveSnapshot();
    setSaveMessage('AutoSave cleared.');
    refreshSaveSnapshot();
  };
  const clearDebugSavesNow = () => {
    clearDebugSaves();
    refreshDebugHeaders();
    setSaveMessage('Debug saves cleared.');
  };
  const downloadSaveJson = () => {
    const blob = new Blob([exportSaveJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'devil-drive-midnight-save.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const resetMainSaveNow = () => {
    const agreed = window.confirm('Reset local main save data? This cannot be undone.');
    if (!agreed) return;
    clearSaveData();
    setSaveMessage('Main save reset. Reloading...');
    setTimeout(() => window.location.reload(), 150);
  };
  const triggerSaveImport = () => {
    saveImportInputRef.current?.click();
  };
  const onImportSaveFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const result = importSaveJson(text);
      if (!result.ok) {
        setSaveMessage(`Import failed: ${result.error}`);
        return;
      }
      refreshSaveSnapshot();
      refreshDebugHeaders();
      setSaveMessage(`Save imported: ${new Date(result.data.updatedAt).toLocaleString()}`);
    } catch {
      setSaveMessage('Import failed: unable to read file.');
    } finally {
      event.currentTarget.value = '';
    }
  };
  const downloadDebugSavesJson = () => {
    const blob = new Blob([exportDebugSavesJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devil-drive-debug-saves-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const downloadAutoSaveJson = () => {
    const blob = new Blob([exportAutoSaveJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devil-drive-autosave-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const downloadCorruptBackupJson = () => {
    const blob = new Blob([exportCorruptSaveBackupJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devil-drive-save-corrupt-backup-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const copyMarkdownReport = async () => {
    const text = playtestReport.markdown;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch {
      // fallback below
    }
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    document.body.removeChild(area);
  };
  const downloadTelemetryJson = () => {
    const blob = new Blob([exportTelemetryJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devil-drive-telemetry-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const resetTelemetry = () => {
    clearTelemetryEvents();
    setTelemetryRefresh((value) => value + 1);
  };

  const isRunFitPhase = state.gamePhase === 'approach'
    || state.gamePhase === 'encounter'
    || state.gamePhase === 'boss_encounter'
    || state.gamePhase === 'route_choice'
    || state.gamePhase === 'salvage'
    || state.gamePhase === 'signal'
    || state.gamePhase === 'boss_preview'
    || state.gamePhase === 'reward'
    || state.gamePhase === 'return_gate';

  return <div className={`dashboard-shell ${isEncounterActive ? 'is-encounter' : ''} ${shellClassName}`.trim()}>
    <div
      className="road-runner-bg"
      aria-hidden="true"
      style={{
        ['--asset-windshield-bg' as string]: windshieldImage ? `url("${windshieldImage}")` : 'none',
        ['--asset-road-overlay' as string]: roadOverlayImage ? `url("${roadOverlayImage}")` : 'none',
      }}
    >
      <span className="road-runner-bg__lane" />
      <span className="road-runner-bg__lights" />
      <span className="road-runner-bg__fog" />
      <span className="road-runner-bg__noise" />
    </div>

    {state.gamePhase === 'prologue' && <section className="prologue-overlay" role="dialog" aria-label="Night Loop Prologue">
      <div className="prologue-card">
      <div className="prologue-kicker">00:00 / MIDNIGHT WINDOW</div>
      <h2>NIGHT LOOP OPEN</h2>
      {nightLoopIntroImage && <div className="prologue-visual">
        <img src={nightLoopIntroImage} alt="Night Loop entry lane" loading="eager" decoding="async" />
      </div>}
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
          <AssetFigure
            src={logoAsset}
            alt="Midnight Terminal logo"
            className="brand-stack__logo"
            fallback={<></>}
            transparencyMode="auto-corner"
          />
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

      <main className={`action-panel panel ${state.gamePhase === 'garage' ? 'action-panel--garage-focus' : ''} ${isRunFitPhase ? 'action-panel--run-fit' : ''}`}>
        <div className="panel-title">
          <span>WINDSHIELD ENCOUNTER VIEW</span>
          <small>{isWindshieldFolded ? 'GARAGE / FOLDED' : state.gamePhase.toUpperCase()}</small>
        </div>

        <section className={`battle-view ${isEncounterActive ? 'is-hot' : ''} ${isRoadMoving ? 'is-cruising' : ''} ${isRoadStopped ? 'is-stopped' : ''} ${isBossPhase ? 'is-boss' : ''} ${hitFxTone ? `is-hitfx-${hitFxTone}` : ''} ${isArmorCritical ? 'is-armor-critical' : ''} ${isWindshieldFolded ? 'is-folded' : ''}`}>
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
            <span className="battle-view__armor-crack" />
            <span key={`hitfx-${hitFxPulse}`} className="battle-view__impact-fx" />
          </div>
          <div className="battle-view__hud">
            <span>THREAT FIELD {aliveEnemies.length > 0 && (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') ? 'ACTIVE' : 'CLEAR'}</span>
            <strong>{selectedEnemy ? selectedEnemyDisplayLabel : 'ROAD OPEN'}</strong>
          </div>
          {isBossPhase && <div className="battle-view__boss-alert">
            <span>BOSS SIGNAL</span>
            <strong>TOLL GATE SAINT</strong>
          </div>}
          {state.gamePhase === 'approach' && <div className="battle-view__ingress">
            {ingressSteps.map((step, idx) => <div key={step.label} className={`battle-view__ingress-step ${step.done ? 'is-done' : ''} ${idx === ingressSteps.length - 1 ? 'is-current' : ''}`}>
              <span>{step.label}</span>
            </div>)}
          </div>}
          <div className="battle-view__devils">
            {(state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter' || state.gamePhase === 'reward') && state.encounter.enemies.map((enemy, index) => {
              const analyzed = state.encounter.analyzedEnemyIds.includes(enemy.id) || enemy.revealed;
              const imageSrc = analyzed
                ? resolveEnemyAsset(enemy.profile, enemyAssetMap)
                : resolveUnknownEnemyAsset(index);
              return <BattleDevilSprite
                key={enemy.id}
                devil={enemy}
                lane={resolveEnemyLane(index, state.encounter.enemies.length, state.gamePhase === 'boss_encounter')}
                focused={enemy.id === state.encounter.selectedEnemyId}
                analyzed={analyzed}
                imageSrc={imageSrc}
                hitFx={enemy.id === state.encounter.selectedEnemyId ? hitFxTone ?? undefined : undefined}
                onSelect={() => dispatch({ type: 'SELECT_ENEMY', enemyId: enemy.id })}
                onHoverEnemy={setHoveredEnemyId}
                encounterProfiles={encounterProfiles()}
              />;
            })}
            {state.gamePhase === 'approach' && approachLineup.map((profile, index) => <ApproachContactMarker
              key={`${profile}-${index}`}
              profile={profile}
              lane={index === 0 ? 'left' : index === 1 ? 'center' : 'right'}
              scanSuccess={!!state.approach?.scanSuccess}
              imageSrc={state.approach?.scanSuccess ? resolveEnemyAsset(profile, enemyAssetMap) : resolveUnknownEnemyAsset(index)}
              encounterProfiles={encounterProfiles()}
              getLikelyWeaknessSummary={getLikelyWeaknessSummary}
            />)}
          </div>
          {(state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') && detailEnemy && <section className="target-detail-panel target-detail-panel--overlay">
            <div className="target-detail-panel__head">
              <strong>TARGET DETAIL</strong>
              <small>{detailEnemyAnalyzed ? detailEnemy.name.toUpperCase() : 'UNKNOWN SIGN'}</small>
            </div>
            <div className="target-detail-panel__core">
              <span className={`target-detail-panel__intent intent--${detailEnemy.intent}`}>
                {detailIntentIconMap[detailEnemy.intent]} {detailEnemyAnalyzed ? detailEnemy.intent.toUpperCase() : 'UNKNOWN'}
              </span>
              <span>HP {detailEnemy.hp}/{detailEnemy.maxHp}</span>
              <span>{detailEnemyAnalyzed ? `${encounterProfiles()[detailEnemy.profile].contractable ? 'CONTRACTABLE' : 'HOSTILE'} / ${encounterProfiles()[detailEnemy.profile].threat}` : 'UNKNOWN / ---'}</span>
            </div>
            <div className="target-detail-panel__intel">
              {detailEnemyAnalyzed
                ? <>
                  <small>TEMP: {detailEnemy.temperament.toUpperCase()}</small>
                  <small>{getContractHint(detailEnemy)}</small>
                  <small>
                    AFF:
                    {affinityOrder.map((affinity) => ` ${affinityLabel[affinity].slice(0, 3).toUpperCase()}-${getAffinityTag(detailEnemy.affinities[affinity])}`).join(' /')}
                  </small>
                </>
                : <small>INTEL LOCKED / HOVER + ANALYZE TO REVEAL</small>}
              {detailEnemy.contractWindow && <small className="battle-devil__window">CONTRACT WINDOW OPEN</small>}
            </div>
          </section>}
          <div className="battle-view__folded-note">WINDSHIELD VIEW FOLDED IN GARAGE MODE</div>
        </section>

        <section className="battle-deck">
          <section className="terminal-stack panel">
            <section className="radio-panel radio-panel--terminal">
              <div className="radio-panel__head">
                <span>
                  <AssetFigure
                    src={moeAsset}
                    alt="M.O.E."
                    className="radio-panel__avatar radio-panel__avatar--moe"
                    fallback={<></>}
                    transparencyMode="auto-corner"
                  />
                  M.O.E. // NAVI AI
                </span>
                <small>{state.gamePhase.toUpperCase()} / {state.signal <= 2 ? 'NOISY' : 'CLEAR'}</small>
              </div>
              <div className="radio-bubble">
                <p className="moe-live">「{narrativeMoeLine}」</p>
              </div>
            </section>
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

          </section>

          <section className={`command-core ${!(state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') ? 'command-core--standby' : ''}`}>
            <div className="panel-title panel-title--compact">
              <span>COMMAND</span>
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
                      onMouseEnter={() => {
                        const hint = command.id === 'main_gun'
                          ? `主砲 ${selectedMainGun.name}。威力 ${selectedMainGun.damage}、残弾 ${state.mainAmmo}。`
                          : command.id === 'sub_gun'
                            ? `副砲 ${selectedSubGun.name}。${selectedSubGun.description}`
                            : command.id === 'se_harpoon'
                              ? `S-E ${selectedSE.name}。${selectedSE.description}（残弾 ${state.seAmmo}）`
                              : command.id === 'contract'
                                ? (
                                    contractEnabled
                                      ? getDialogueLine('hint.contract.window_open', '契約窓が開いてる。今なら接続できる。')
                                      : getDialogueLine('hint.contract.window_closed', '契約窓がまだ開いていない。TalkかS-Eを先に。')
                                  )
                                : getMoeCommandGuide(command.id);
                        setHoveredMoeHint(hint);
                      }}
                      onMouseLeave={() => setHoveredMoeHint('')}
                      onFocus={() => setHoveredMoeHint(getMoeCommandGuide(command.id))}
                      onBlur={() => setHoveredMoeHint('')}
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
              <button
                className="command-button command-button--route"
                onMouseEnter={() => setHoveredMoeHint(getDialogueLine('hint.hover.proceed', '回収結果をまとめて次フェーズへ移る。'))}
                onMouseLeave={() => setHoveredMoeHint('')}
                onClick={() => dispatch({ type: 'REWARD_CONTINUE' })}
              >
                PROCEED
              </button>
            </div>}

            {state.gamePhase === 'approach' && state.approach && <div className="command-window command-list">
              {state.approach.scanSuccess
                ? <>
                  <button
                    className="command-button command-button--danger"
                    onMouseEnter={() => setHoveredMoeHint(getDialogueLine('hint.hover.approach.preemptive', '先制主砲。接敵前に削るけど交渉は荒れる。'))}
                    onMouseLeave={() => setHoveredMoeHint('')}
                    onClick={() => dispatch({ type: 'APPROACH_CHOOSE', option: 'preemptive_main_gun' })}
                    disabled={state.mainAmmo <= 0}
                    data-desc="先制主砲。接敵前に削る / MainAmmo-1 / 交渉難化"
                  >
                    Preemptive Main Gun
                  </button>
                  <button className="command-button command-button--danger" onMouseEnter={() => setHoveredMoeHint(getDialogueLine('hint.hover.approach.hit_and_run', '轢き逃げ突破。成功すれば接敵を飛ばせる。'))} onMouseLeave={() => setHoveredMoeHint('')} onClick={() => dispatch({ type: 'APPROACH_CHOOSE', option: 'hit_and_run_ram' })} data-desc="轢き逃げ突破。Armor-1 Fuel-1 / 成功で遭遇回避">
                    Hit-and-Run Ram
                  </button>
                  <button className="command-button command-button--route" onMouseEnter={() => setHoveredMoeHint(getDialogueLine('hint.hover.approach.silent_coast', '静穏接近。交渉初手を通しやすくする。'))} onMouseLeave={() => setHoveredMoeHint('')} onClick={() => dispatch({ type: 'APPROACH_CHOOSE', option: 'silent_coast' })} data-desc="静穏接近。Fuel-1 / 初手Talk成功率上昇 / 敵攻勢鈍化">
                    Silent Coast
                  </button>
                  <button
                    className="command-button command-button--contract"
                    onMouseEnter={() => setHoveredMoeHint(getDialogueLine('hint.hover.approach.open_channel', '先行交信。契約窓を開けたい時の前振り。'))}
                    onMouseLeave={() => setHoveredMoeHint('')}
                    onClick={() => dispatch({ type: 'APPROACH_CHOOSE', option: 'open_channel' })}
                    disabled={state.signal <= 0}
                    data-desc="先行交信。Signal-1 / interest上昇 / hostile相手は逆上リスク"
                  >
                    Open Channel
                  </button>
                </>
                : <button className="command-button command-button--danger" onMouseEnter={() => setHoveredMoeHint(getDialogueLine('hint.hover.approach.brace', '不意打ち受領。被害を抑える準備を。'))} onMouseLeave={() => setHoveredMoeHint('')} onClick={() => dispatch({ type: 'APPROACH_CONTINUE' })}>
                  Brace for Contact
                </button>}
            </div>}

            {state.gamePhase === 'route_choice' && <div className="command-window command-list">
              <button className="command-button command-button--route" onMouseEnter={() => setHoveredMoeHint(getDialogueLine('hint.hover.route.salvage', '補給寄りレーン。立て直し向け。'))} onMouseLeave={() => setHoveredMoeHint('')} onClick={() => dispatch({ type: 'ROUTE_CHOICE', lane: 'salvage' })}>Salvage Lane</button>
              <button className="command-button command-button--route" onMouseEnter={() => setHoveredMoeHint(getDialogueLine('hint.hover.route.signal', 'Signal寄りレーン。解析と交渉を伸ばせる。'))} onMouseLeave={() => setHoveredMoeHint('')} onClick={() => dispatch({ type: 'ROUTE_CHOICE', lane: 'signal' })}>Signal Lane</button>
              <button className="command-button command-button--route" onMouseEnter={() => setHoveredMoeHint(getDialogueLine('hint.hover.route.push_forward', '強行前進。次報酬は良いが被害リスク高。'))} onMouseLeave={() => setHoveredMoeHint('')} onClick={() => dispatch({ type: 'ROUTE_CHOICE', lane: 'push_forward' })}>Push Forward</button>
              <button className="command-button command-button--danger" onMouseEnter={() => setHoveredMoeHint(getDialogueLine('hint.hover.route.return_gate', 'ここで帰還。戦果を確実に持ち帰る。'))} onMouseLeave={() => setHoveredMoeHint('')} onClick={() => dispatch({ type: 'ROUTE_CHOICE', lane: 'return_gate' })}>Return Gate</button>
            </div>}

            {state.gamePhase === 'salvage' && <div className="command-window command-list">
              {state.rewardOptions.map((option) => <button
                key={option.id}
                className="command-button command-button--route"
                onMouseEnter={() => setHoveredMoeHint(`回収候補: ${option.label} / ${option.detail}`)}
                onMouseLeave={() => setHoveredMoeHint('')}
                onClick={() => dispatch({ type: 'SALVAGE_PICK', rewardId: option.id })}
              >
                {option.label} <span>{option.detail}</span>
              </button>)}
            </div>}

            {state.gamePhase === 'signal' && <div className="command-window command-list">
              {(signalTunnelScenario?.choices && signalTunnelScenario.choices.length > 0
                ? signalTunnelScenario.choices
                : [
                  { id: 'analyze_trace', label: 'Analyze Trace', text: '干渉源を解析し、断片ログを抽出する。' },
                  { id: 'hold_lane', label: 'Keep Driving', text: '速度を維持し、次接敵を優先する。' },
                  { id: 'open_radio', label: 'Open Radio Channel', text: 'AM帯を開いて交信を試みる。' },
                ])
                .map((choice) => {
                  const choiceId = (choice.id === 'analyze_trace' || choice.id === 'hold_lane' || choice.id === 'open_radio')
                    ? choice.id
                    : 'hold_lane';
                  const disabled = (choiceId === 'analyze_trace' || choiceId === 'open_radio') && state.signal <= 0;
                  return (
                    <button
                      key={choice.id}
                      className={choiceId === 'open_radio' ? 'command-button command-button--contract' : 'command-button command-button--route'}
                      onMouseEnter={() => setHoveredMoeHint(choice.text || '')}
                      onMouseLeave={() => setHoveredMoeHint('')}
                      onClick={() => dispatch({ type: 'SIGNAL_ROUTE_CHOICE', choiceId })}
                      disabled={disabled}
                    >
                      {choice.label}
                    </button>
                  );
                })}
            </div>}

            {state.gamePhase === 'boss_preview' && <div className="command-window command-list">
              <button className="command-button command-button--danger" onMouseEnter={() => setHoveredMoeHint(getDialogueLine('hint.hover.boss.challenge', '深層反応に挑む。高リスク高リターン。'))} onMouseLeave={() => setHoveredMoeHint('')} onClick={() => dispatch({ type: 'BOSS_PREVIEW_CHOICE', choice: 'challenge' })}>Challenge Deep Signal</button>
              <button className="command-button command-button--route" onMouseEnter={() => setHoveredMoeHint(getDialogueLine('hint.hover.boss.emergency_salvage', '応急補給してから突入。安定重視。'))} onMouseLeave={() => setHoveredMoeHint('')} onClick={() => dispatch({ type: 'BOSS_PREVIEW_CHOICE', choice: 'emergency_salvage' })}>Emergency Salvage</button>
              <button className="command-button command-button--route" onMouseEnter={() => setHoveredMoeHint(getDialogueLine('hint.hover.boss.return_gate', 'ここで撤退。戦果の確保を優先。'))} onMouseLeave={() => setHoveredMoeHint('')} onClick={() => dispatch({ type: 'BOSS_PREVIEW_CHOICE', choice: 'return_gate' })}>Return Gate</button>
            </div>}

            {state.gamePhase === 'return_gate' && <div className="command-window command-list">
              <button className="command-button command-button--route" onMouseEnter={() => setHoveredMoeHint(getDialogueLine('hint.hover.return_to_surface', '帰還処理を実行。地上へ戻る。'))} onMouseLeave={() => setHoveredMoeHint('')} onClick={() => dispatch({ type: 'RETURN_TO_SURFACE' })}>RETURN TO SURFACE</button>
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
              <span>
                <AssetFigure
                  src={playerAsset}
                  alt="Driver unit"
                  className="vehicle-panel__avatar"
                  fallback={<></>}
                  transparencyMode="auto-corner"
                />
                VEHICLE DASHBOARD
              </span>
              <small>SPD {String(speed).padStart(3, '0')} km/h</small>
            </div>
            <div className="vehicle-panel__meters">
              <ResourceMeter label="Fuel" value={state.fuel} max={dashboardFuelMax} tone="fuel" />
              <ResourceMeter label="Armor" value={state.armor} max={dashboardArmorMax} tone="armor" />
              <ResourceMeter label="Signal" value={state.signal} max={dashboardSignalMax} tone="signal" />
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
              <div className="panel-title panel-title--compact">
                <span>SUPPORT DAEMON</span>
                <small>{state.activeSupportDaemon ? 'ACTIVE' : 'OFFLINE'}</small>
              </div>
              {state.activeSupportDaemon
                ? <article className={`module-card module-card--${state.activeSupportDaemon.profile.split('_').join('-')}`}>
                  <strong>{state.activeSupportDaemon.name}</strong>
                  <p>TEMPERAMENT: {state.activeSupportDaemon.temperament.toUpperCase()}</p>
                  <p>LINK STABILITY: {getSupportDaemonStability(state.activeSupportDaemon)}</p>
                  <p>{state.activeSupportDaemon.effectLabel}</p>
                  <span className="module-card__band">EXPIRES: RUN END</span>
                </article>
                : <div className="empty-slot">No active support. Contract a demon to establish a temporary daemon link.</div>}
              <div className="empty-slot">NAVI: M.O.E. CORE (DEFAULT)</div>
              <div className="empty-slot">SUPPORT SLOT: {selectedSupport.name}</div>
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
          <div className="utility-strip">
            <button
              className="command-button command-button--ghost command-button--inline"
              onClick={() => setShowUtilityPanels((open) => !open)}
            >
              {showUtilityPanels ? '▼ HIDE DEV PANELS' : '▶ DEV PANELS'}
            </button>
            {showUtilityPanels && <div className="utility-strip__toggles">
              <button className="command-button command-button--system command-button--inline" onClick={() => setShowPlaytestReport((open) => !open)}>
                {showPlaytestReport ? 'HIDE REPORT' : 'PLAYTEST REPORT'}
              </button>
              <button className="command-button command-button--system command-button--inline" onClick={() => setShowSaveTools((open) => !open)}>
                {showSaveTools ? 'HIDE SAVE' : 'SAVE TOOLS'}
              </button>
              <button className="command-button command-button--system command-button--inline" onClick={() => setShowArchive((open) => !open)}>
                {showArchive ? 'HIDE ARCHIVE' : 'ARCHIVE'}
              </button>
            </div>}
          </div>

          {state.gamePhase === 'garage' && <section className="event-card garage-grid-card">
            <div className="event-header">
              <div className="event-kicker">GARAGE // MIDNIGHT BAY</div>
              <span className="event-chip event-chip--route">LOADOUT READY</span>
            </div>
            <h2>Next Sortie Setup</h2>
            <p>M.O.E.: 「{getDialogueLine('moe.garage.enter', '戻れたね。次は出る前に少し積み替えよっか。')}」</p>
            <div className="command-window command-list">
              <button className="command-button command-button--route" onClick={() => dispatch({ type: 'GARAGE_ENTER_RUN' })}>ENTER NIGHT LOOP</button>
            </div>
            <div className="garage-columns">
              <div className="garage-block">
                <h3>PREVIOUS RUN</h3>
                <div className="negotiation-grid">
                  <p><span>Total Runs</span><strong>{saveSnapshot.totalRuns}</strong></p>
                  <p><span>Best Result</span><strong>{saveSnapshot.bestResult ?? '-'}</strong></p>
                  <p><span>Demon Archive</span><strong>{Object.keys(saveSnapshot.demonArchive).length}</strong></p>
                  <p><span>Route Log</span><strong>{Object.keys(saveSnapshot.routeLog).length}</strong></p>
                  <p><span>M.O.E. Memory</span><strong>{Object.keys(saveSnapshot.moeMemory).length}</strong></p>
                  <p><span>Run History</span><strong>{saveSnapshot.runHistory.length}</strong></p>
                </div>
                {latestRunRecord
                  ? <div className="negotiation-grid">
                    <p><span>Result</span><strong>{resultLabel(latestRunRecord.resultType)}</strong></p>
                    <p><span>Ended</span><strong>{new Date(latestRunRecord.endedAt).toLocaleString()}</strong></p>
                    <p><span>Encounters</span><strong>{latestRunRecord.encountersCleared}</strong></p>
                    <p><span>Boss</span><strong>{latestRunRecord.bossChallenged ? (latestRunRecord.bossCleared ? 'Cleared' : 'Challenged') : 'Not challenged'}</strong></p>
                    <p><span>Contracts</span><strong>{latestRunRecord.contractsAcquired.length}</strong></p>
                    <p><span>Return Gate</span><strong>{latestRunRecord.returnGateUsed ? 'Used' : 'No'}</strong></p>
                    <p><span>Final</span><strong>{latestRunRecord.finalResources.fuel}/{latestRunRecord.finalResources.armor}/{latestRunRecord.finalResources.signal}/{latestRunRecord.finalResources.mainAmmo}/{latestRunRecord.finalResources.seAmmo}</strong></p>
                  </div>
                  : <p>{getDialogueLine('ui.common.no_previous_run', 'No previous run data')}</p>}
                {latestRunRecord && <div className="command-window">
                  <strong>M.O.E. Suggestion</strong>
                  <p>M.O.E.: 「{latestRunRecord.moeComment ?? buildMoeRunComment(latestRunRecord)}」</p>
                </div>}
                <div className="command-window command-list">
                  <button className="command-button command-button--system command-button--inline" onClick={() => setShowRunHistory((open) => !open)}>
                    {showRunHistory ? 'HIDE RUN HISTORY' : 'SHOW RUN HISTORY'}
                  </button>
                </div>
                {showRunHistory && <div className="next-node-list">
                  {latest3Runs.map((run) => <div key={run.id} className="next-node">
                    <span>◎</span>
                    <strong>{new Date(run.endedAt).toLocaleString()} / {resultLabel(run.resultType)}</strong>
                    <small>contracts: {run.contractsAcquired.length} / boss: {run.bossChallenged ? (run.bossCleared ? 'cleared' : 'challenged') : 'no'} / encounters: {run.encountersCleared}</small>
                  </div>)}
                </div>}
                <details className="garage-fold">
                  <summary>ARCHIVE / ROUTE LOG / M.O.E. MEMORY</summary>
                  <div className="garage-fold__body">
                    <h3>Archive</h3>
                    <div className="negotiation-grid">
                      <p><span>Chapter</span><strong>{state.story.chapter}</strong></p>
                      <p><span>M.O.E. Memory</span><strong>{state.story.moeMemory}</strong></p>
                      <p><span>Driver Clues</span><strong>{state.story.previousDriverClues}</strong></p>
                      <p><span>Recovered</span><strong>{state.story.recoveredLogs.length}/{storyLogCatalog.length}</strong></p>
                    </div>
                    <h3>ROUTE LOG</h3>
                    <div className="negotiation-grid">
                      <p><span>Routes discovered</span><strong>{routeLogEntries.length}</strong></p>
                    </div>
                    {routeLogEntries.length > 0
                      ? <div className="next-node-list">
                        {routeLogEntries.slice(0, 8).map((entry) => <div key={entry.id} className="next-node">
                          <span>◎</span>
                          <strong>{entry.name}</strong>
                          <small>chosen {entry.seenCount}x / {new Date(entry.lastChosenAt).toLocaleString()}</small>
                          <small>{entry.notes?.[0] ?? 'Route trace recorded.'}</small>
                        </div>)}
                      </div>
                      : <p>No route records yet.</p>}
                    <h3>M.O.E. MEMORY</h3>
                    <div className="negotiation-grid">
                      <p><span>Unlocked memories</span><strong>{moeMemoryEntries.length}</strong></p>
                    </div>
                    {moeMemoryEntries.length > 0
                      ? <div className="next-node-list">
                        {moeMemoryEntries.slice(0, 10).map((entry) => <div key={entry.id} className="next-node">
                          <span>◎</span>
                          <strong>{entry.title}</strong>
                          <small>{entry.text}</small>
                          <small>{new Date(entry.unlockedAt).toLocaleString()} / {entry.source.toUpperCase()}</small>
                        </div>)}
                      </div>
                      : <p>No memory fragments unlocked yet.</p>}
                    <h3>Story Logs</h3>
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
                    <p>M.O.E.: 「{getDialogueLine('moe.garage.memory', '断片が増えるほど、わたしの地図も変わる。')}」</p>
                  </div>
                </details>
              </div>
              <div className="garage-block">
                <h3>Loadout</h3>
                <details className="garage-fold" open>
                  <summary>MAIN GUN</summary>
                  <div className="garage-fold__body">
                    <div className="garage-select-grid">
                      {garageMainGunOrder.map((id) => <button
                        key={id}
                        className={`command-button command-button--danger ${state.selectedLoadout.mainGunId === id ? 'is-selected' : ''}`}
                        onClick={() => dispatch({ type: 'GARAGE_SET_MAIN_GUN', id })}
                        data-desc={`DMG ${getMainGunSpec(id).damage} / AMMO ${getMainGunSpec(id).ammo} / ${mainGunCatalog[id].description}`}
                      >
                        {mainGunCatalog[id].name}
                      </button>)}
                    </div>
                  </div>
                </details>

                <details className="garage-fold">
                  <summary>SUB GUN</summary>
                  <div className="garage-fold__body">
                    <div className="garage-select-grid">
                      {garageSubGunOrder.map((id) => <button
                        key={id}
                        className={`command-button command-button--route ${state.selectedLoadout.subGunId === id ? 'is-selected' : ''}`}
                        onClick={() => dispatch({ type: 'GARAGE_SET_SUB_GUN', id })}
                        data-desc={`DMG ${getSubGunSpec(id).damage}${getSubGunSpec(id).hits ? ` / HITS ${getSubGunSpec(id).hits}` : ''} / ${subGunCatalog[id].description}`}
                      >
                        {subGunCatalog[id].name}
                      </button>)}
                    </div>
                  </div>
                </details>

                <details className="garage-fold">
                  <summary>S-E</summary>
                  <div className="garage-fold__body">
                    <div className="garage-select-grid">
                      {garageSEOrder.map((id) => <button
                        key={id}
                        className={`command-button command-button--contract ${state.selectedLoadout.specialEquipmentId === id ? 'is-selected' : ''}`}
                        onClick={() => dispatch({ type: 'GARAGE_SET_SPECIAL', id })}
                        data-desc={`DMG ${getSpecialEquipmentSpec(id).damage} / COST ${getSpecialEquipmentSpec(id).seAmmoCost} / AMMO ${getSpecialEquipmentSpec(id).ammo} / ${specialEquipmentCatalog[id].description}`}
                      >
                        {specialEquipmentCatalog[id].name}
                      </button>)}
                    </div>
                  </div>
                </details>

                <details className="garage-fold">
                  <summary>SUPPORT SLOT</summary>
                  <div className="garage-fold__body">
                    <div className="garage-select-grid">
                      {garageSupportOrder.map((id) => <button
                        key={id}
                        className={`command-button ${state.selectedLoadout.contractSupportId === id ? 'is-selected' : ''}`}
                        onClick={() => dispatch({ type: 'GARAGE_SET_SUPPORT', id })}
                        data-desc={contractSupportCatalog[id].description}
                      >
                        {id === 'none' ? 'Support: None' : `Support: ${contractSupportCatalog[id].name}`}
                      </button>)}
                    </div>
                  </div>
                </details>
              </div>
              <div className="garage-block">
                <h3>Growth Resources</h3>
                <div className="negotiation-grid">
                  <p><span>Driver XP</span><strong>{state.driverXpBank}</strong></p>
                  <p><span>M.O.E. Sync</span><strong>{state.moeSyncBank}</strong></p>
                  <p><span>Credits</span><strong>{state.creditBank}</strong></p>
                </div>
                <details className="garage-fold">
                  <summary>DRIVER SKILL (XP)</summary>
                  <div className="garage-fold__body">
                    <div className="garage-select-grid">
                      {skillOrder.filter((skillId) => skillId === 'ram_control' || skillId === 'gunnery').map((skillId) => {
                        const level = state.skillLevels[skillId];
                        const cost = getSkillCost(level);
                        const canBuy = state.driverXpBank >= cost;
                        return <button
                          key={skillId}
                          className={`command-button ${level > 0 ? 'is-selected' : ''}`}
                          disabled={!canBuy}
                          onClick={() => dispatch({ type: 'PURCHASE_SKILL', upgrade: skillId })}
                          data-desc={`Lv${level} -> Lv${level + 1} / COST ${cost} XP`}
                        >
                          {skillLabels[skillId]} <span>Lv{level}</span>
                        </button>;
                      })}
                    </div>
                  </div>
                </details>
                <details className="garage-fold">
                  <summary>M.O.E. SKILL (SYNC)</summary>
                  <div className="garage-fold__body">
                    <div className="garage-select-grid">
                      {skillOrder.filter((skillId) => skillId === 'scan_boost' || skillId === 'translation_assist').map((skillId) => {
                        const level = state.skillLevels[skillId];
                        const cost = getSkillCost(level);
                        const canBuy = state.moeSyncBank >= cost;
                        return <button
                          key={skillId}
                          className={`command-button ${level > 0 ? 'is-selected' : ''}`}
                          disabled={!canBuy}
                          onClick={() => dispatch({ type: 'PURCHASE_SKILL', upgrade: skillId })}
                          data-desc={`Lv${level} -> Lv${level + 1} / COST ${cost} SYNC`}
                        >
                          {skillLabels[skillId]} <span>Lv{level}</span>
                        </button>;
                      })}
                    </div>
                  </div>
                </details>

                <details className="garage-fold">
                  <summary>VEHICLE TUNING (CREDITS)</summary>
                  <div className="garage-fold__body">
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
                  </div>
                </details>
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
                <p>M.O.E.: 「{getDialogueLine('moe.garage.boss_tip', '料金所型の強い反応。主砲弾かS-E弾、どっちかは残しておきたいね。')}」</p>
                <details className="garage-fold">
                  <summary>AUTOPLAY LAB (OPTIONAL)</summary>
                  <div className="garage-fold__body">
                    <p>Balance Profile: {balanceConfig.version}</p>
                    <div className="autoplay-controls">
                      <label>
                        Runs
                        <input
                          type="number"
                          min={balanceConfig.autoplay.minRuns}
                          max={balanceConfig.autoplay.maxRuns}
                          step={10}
                          value={autoplayRuns}
                          onChange={(event) => setAutoplayRuns(
                            clamp(
                              Number(event.target.value) || balanceConfig.autoplay.minRuns,
                              balanceConfig.autoplay.minRuns,
                              balanceConfig.autoplay.maxRuns,
                            ),
                          )}
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
                </details>
              </div>
            </div>
          </section>}

          {showPlaytestReport && <section className="event-card playtest-report-card">
            <div className="event-header">
              <div className="event-kicker">PLAYTEST ANALYTICS (LOCAL)</div>
              <span className="event-chip event-chip--route">{telemetryEvents.length} EVENTS</span>
            </div>
            <div className="negotiation-grid">
              <p><span>Runs started</span><strong>{playtestReport.runsStarted}</strong></p>
              <p><span>Runs finished</span><strong>{playtestReport.runsFinished}</strong></p>
              <p><span>Completion rate</span><strong>{playtestReport.completionRate.toFixed(1)}%</strong></p>
              <p><span>Garage entries</span><strong>{playtestReport.garageEntries}</strong></p>
              <p><span>Next run starts</span><strong>{playtestReport.nextRunStarts}</strong></p>
              <p><span>Second-run rate</span><strong>{playtestReport.secondRunStartRate.toFixed(1)}%</strong></p>
              <p><span>Boss challenged</span><strong>{playtestReport.bossChallenged}</strong></p>
              <p><span>Boss cleared</span><strong>{playtestReport.bossCleared}</strong></p>
              <p><span>Return gate used</span><strong>{playtestReport.returnGateUsed}</strong></p>
              <p><span>Game over</span><strong>{playtestReport.gameOverCount}</strong></p>
              <p><span>Analyze used</span><strong>{playtestReport.analyzeUsed}</strong></p>
              <p><span>Talk used</span><strong>{playtestReport.talkUsed}</strong></p>
              <p><span>Contract attempts</span><strong>{playtestReport.contractAttempts}</strong></p>
              <p><span>Contract success</span><strong>{playtestReport.contractSuccesses}</strong></p>
              <p><span>Contract success rate</span><strong>{playtestReport.contractSuccessRate.toFixed(1)}%</strong></p>
              <p><span>Direct attack ratio</span><strong>{playtestReport.directAttackRatio.toFixed(1)}%</strong></p>
              <p><span>Saved runs</span><strong>{playtestReport.persistedRuns}</strong></p>
              <p><span>Demon archive</span><strong>{playtestReport.archiveDiscoveryCount}</strong></p>
              <p><span>Route log</span><strong>{playtestReport.routeLogCount}</strong></p>
              <p><span>M.O.E. memories</span><strong>{playtestReport.memoryUnlockCount}</strong></p>
            </div>
            <div className="next-node-list">
              <div className="next-node">
                <span>◎</span>
                <strong>Most Used Commands</strong>
                <small>{playtestReport.mostUsedCommands.map((command) => `${command.id} (${command.count})`).join(' / ') || 'no data yet'}</small>
              </div>
              <div className="next-node">
                <span>{playtestReport.directAttackRatio > 70 ? '▲' : '◎'}</span>
                <strong>Combat Behavior</strong>
                <small>{playtestReport.directAttackRatio > 70 ? 'Direct attacks dominate (>70%). Analyze/Talk incentives may be too weak.' : 'Command mix looks reasonably varied.'}</small>
              </div>
              <div className="next-node">
                <span>◎</span>
                <strong>MVP Judgment</strong>
                <small>{playtestReport.judgment}</small>
              </div>
              <div className="next-node">
                <span>◎</span>
                <strong>Persistent Progression</strong>
                <small>{playtestReport.previousRunSummaryText}</small>
                <small>M.O.E.: {playtestReport.latestMoeSuggestion}</small>
              </div>
            </div>
            <div className="next-node-list">
              {playtestReport.notes.map((note, index) => <div key={`note-${index}`} className="next-node">
                <span>•</span>
                <small>{note}</small>
              </div>)}
            </div>
            <div className="command-window command-list">
              <button className="command-button command-button--system" onClick={() => void copyMarkdownReport()}>Copy Markdown Report</button>
              <button className="command-button command-button--route" onClick={downloadTelemetryJson}>Download Telemetry JSON</button>
              <button className="command-button command-button--danger" onClick={resetTelemetry}>Clear Telemetry</button>
            </div>
          </section>}

          {showSaveTools && <section className="event-card playtest-report-card">
            <div className="event-header">
              <div className="event-kicker">LOCAL SAVE TOOLS</div>
              <span className="event-chip event-chip--route">MAIN SAVE / AUTOSAVE / DEBUG</span>
            </div>
            <div className="negotiation-grid">
              <p><span>Total runs</span><strong>{saveSnapshot.totalRuns}</strong></p>
              <p><span>Latest result</span><strong>{latestResult}</strong></p>
              <p><span>Best result</span><strong>{saveSnapshot.bestResult ?? '-'}</strong></p>
              <p><span>Demons discovered</span><strong>{archiveEntries.length}</strong></p>
              <p><span>Contracts acquired total</span><strong>{contractsAcquiredTotal}</strong></p>
              <p><span>Routes discovered</span><strong>{routeLogEntries.length}</strong></p>
              <p><span>M.O.E. memories unlocked</span><strong>{moeMemoryEntries.length}</strong></p>
              <p><span>Main Save Updated</span><strong>{new Date(saveSnapshot.updatedAt).toLocaleString()}</strong></p>
              <p><span>AutoSave</span><strong>{autoSaveSnapshot ? new Date(autoSaveSnapshot.savedAt).toLocaleString() : 'none'}</strong></p>
              <p><span>AutoSave Reason</span><strong>{autoSaveSnapshot?.reason ?? '-'}</strong></p>
              <p><span>Debug Slots</span><strong>{debugSaveHeaders.length}</strong></p>
            </div>
            <div className="command-window command-list">
              <button className="command-button command-button--route" onClick={downloadSaveJson}>Export Save JSON</button>
              <button className="command-button command-button--route" onClick={triggerSaveImport}>Import Save JSON</button>
              <button className="command-button command-button--danger" onClick={resetMainSaveNow}>Reset Save</button>
              <button className="command-button command-button--system" onClick={saveDebugNow}>Save Debug Snapshot</button>
              <button className="command-button command-button--route" onClick={restoreAutoSaveNow}>Restore AutoSave</button>
              <button className="command-button command-button--route" onClick={restoreLatestDebugNow}>Restore Latest Debug</button>
              <button className="command-button command-button--route" onClick={downloadAutoSaveJson}>Download AutoSave JSON</button>
              <button className="command-button command-button--route" onClick={downloadDebugSavesJson}>Download Debug Saves JSON</button>
              <button className="command-button command-button--route" onClick={downloadCorruptBackupJson}>Download Corrupt Backup</button>
              <button className="command-button command-button--danger" onClick={clearAutoSaveNow}>Clear AutoSave</button>
              <button className="command-button command-button--danger" onClick={clearDebugSavesNow}>Clear Debug Saves</button>
            </div>
            <input
              ref={saveImportInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={onImportSaveFile}
            />
            {saveMessage && <p className="event-layer__system">{saveMessage}</p>}
            {debugSaveHeaders.length > 0 && <div className="next-node-list">
              {debugSaveHeaders.slice(0, 5).map((entry) => <div key={entry.id} className="next-node">
                <span>◎</span>
                <strong>{entry.label ?? entry.id}</strong>
                <small>{new Date(entry.createdAt).toLocaleString()}</small>
                <button className="command-button command-button--system command-button--inline" onClick={() => restoreDebugById(entry.id)}>Restore</button>
              </div>)}
            </div>}
          </section>}

          {showArchive && <section className="event-card playtest-report-card">
            <div className="event-header">
              <div className="event-kicker">DEMON ARCHIVE</div>
              <span className="event-chip event-chip--route">{archiveEntries.length} ENTRIES</span>
            </div>
            {archiveEntries.length === 0
              ? <p>No demon profile recorded yet. Enter an encounter to initialize archive data.</p>
              : <div className="next-node-list">
                {archiveEntries.map((entry) => {
                  const profileId = entry.profile as EncounterId | undefined;
                  const profile = profileId ? encounterProfiles()[profileId] : undefined;
                  return <div key={entry.id} className="next-node">
                    <span>{entry.analyzed ? '◎' : '□'}</span>
                    <strong>{entry.name.toUpperCase()}</strong>
                    <small>
                      seen:{entry.seenCount} / defeated:{entry.defeatedCount} / contracted:{entry.contractedCount}
                    </small>
                    <small>
                      analyze:{entry.analyzed ? 'yes' : 'no'} / affinity:{entry.affinityRevealed ? 'revealed' : 'locked'}
                    </small>
                    {!entry.analyzed
                      ? <small>Profile locked. Use Analyze to reveal more.</small>
                      : <small>{(profile?.subtitle || (profileId ? demonArchiveFlavor[profileId] : undefined)) ?? 'No additional profile note.'}</small>}
                    {entry.affinityRevealed && entry.affinities && (
                      <small>
                        AFF: {Object.entries(entry.affinities).map(([k, v]) => `${k}:${v}`).join(' / ')}
                      </small>
                    )}
                  </div>;
                })}
              </div>}
          </section>}

          {state.gamePhase === 'route_choice' && <section className="event-card">
            <div className="event-header">
              <div className="event-kicker">NIGHT LOOP ROUTE</div>
              <span className="event-chip event-chip--route">CHOOSE NEXT LANE</span>
            </div>
            <div className="next-node-list">
              {(['salvage', 'signal', 'push_forward', 'return_gate'] as const).map((lane) => {
                const scenario = routeScenarioIdMap[lane] ? getRouteEventScenario(routeScenarioIdMap[lane] ?? '') : undefined;
                return <div key={lane} className="next-node">
                  <span>◎</span>
                  <strong>{routeIntelCatalog[lane].label}</strong>
                  <small>likely: {routeIntelCatalog[lane].likelyEnemyTags}</small>
                  <small>suggested: {routeIntelCatalog[lane].likelyWeaknesses}</small>
                  <small>risk: {routeIntelCatalog[lane].riskTags} / reward: {routeIntelCatalog[lane].rewardTags}</small>
                  {scenario?.body && <small>{scenario.body}</small>}
                </div>;
              })}
            </div>
          </section>}

          {state.gamePhase === 'signal' && <section className="event-card">
            <div className="event-header">
              <div className="event-kicker">SIGNAL LANE</div>
              <span className="event-chip event-chip--route">BOOSTED</span>
            </div>
            <p>{signalTunnelScenario?.title ?? 'Signal Tunnel'}: {signalTunnelScenario?.body ?? 'AM帯干渉を検知。進入手順を選択してください。'}</p>
            <div className="next-node-list">
              {(signalTunnelScenario?.choices ?? []).map((choice) => <div key={`signal-choice-${choice.id}`} className="next-node">
                <span>◎</span>
                <strong>{choice.label}</strong>
                <small>{choice.text}</small>
              </div>)}
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
            <p>M.O.E.: 「{getDialogueLine('moe.run.boss_preview', '料金所型の強い反応。無理なら引き返そ。')}」</p>
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
