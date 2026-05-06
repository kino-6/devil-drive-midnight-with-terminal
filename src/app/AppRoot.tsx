import { useEffect, useMemo, useReducer, useRef, useState, type ChangeEvent } from 'react';
import { defaultAssetManifest, resolveAssetUrl, type AssetManifest } from '../assetManifest';
import { defaultBalanceConfig, getBalanceConfig, type BalanceConfig } from '../balanceConfig';
import { getDialogueConfig, getDialogueLine } from '../dialogueConfig';
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
} from '../saveSystem';
import {
  buildPlaytestReport,
  clearTelemetryEvents,
  exportTelemetryJson,
  getTelemetryEvents,
  trackEvent,
  type PersistentProgressionSnapshot,
  type TelemetryEventName,
} from '../telemetry';
import {
  getRouteEventScenario,
} from '../scenario/scenarioLoader';
import { ResourceMeter } from '../components/DashboardWidgets';
import { AssetFigure } from '../components/EncounterVisuals';
import { buildMoeRunComment, resultLabel } from '../game/runInsights';
import { getDevilConfig } from '../devilConfig';
import {
  type AffinityRating,
  type AffinityType,
  type AutoPlayReport,
  type AutoPlayStrategy,
  type CommandId,
  type GamePhase,
  type HitFxTone,
  type Intent,
  type State,
  type UpgradeId,
  type VehicleUpgradeId,
} from '../game/types';
import {
  bossIntel,
  commandAffinityMap,
  commandOptions,
  contractLabels,
  contractSupportCatalog,
  demonArchiveFlavor,
  routeIntelCatalog,
  routeLogCatalog,
  routeScenarioIdMap,
  storyLogById,
} from '../game/catalogs';
import {
  devilTemplates,
  encounterProfiles,
  getMainGunSpec,
  getMoeCommandGuide,
  getSpecialEquipmentSpec,
  getSubGunSpec,
  getSupportDaemonStability,
  isAlive,
  resolveEnemyAsset,
} from '../game/runtimeHelpers';

// Contributor note:
// Editing guide for LLM/agents lives in docs/llm-code-map.md
import {
  classifyLog,
  damageVarianceByCommand,
  getGarageStageAdvisory,
  getLogBadge,
  getPseudoTimecode,
  getRollBounds,
  getRunGrowth,
  getRunStartResources,
  getSelectedEnemy,
  getSkillCost,
  getStageProfile,
  getVehicleUpgradeCost,
  getLikelyWeaknessSummary,
  getNarrativeMoeLine,
  getContractHint,
  getAffinityTag,
  hasAiNaviContract,
  isBossProfile,
  initState,
  pickSfxCueFromLog,
  reducer,
  resolveDamageRoll,
  runAutoplayBatch,
  sanitizeRestoredState,
  stageProfiles,
} from './state/stateReducer';
import { useRuntimeConfigEffects } from './hooks/useRuntimeConfigEffects';
import { useAudioEffects } from './hooks/useAudioEffects';
import { CockpitHeader } from './components/CockpitHeader';
import { PrologueOverlay } from './components/PrologueOverlay';
import { BattleView } from './components/BattleView';
import { TerminalPanel } from './components/TerminalPanel';
import { CommandPanel, type SignalChoice } from './components/CommandPanel';
import { GaragePanel } from './components/GaragePanel';
import { UtilityPanels } from './components/UtilityPanels';

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
  const [showGarageLaunchConfirm, setShowGarageLaunchConfirm] = useState(false);
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
  const terminalLogRef = useRef<HTMLUListElement>(null);
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
  const saveImportInputRef = useRef<HTMLInputElement>(null);
  const selectedMainGun = getMainGunSpec(state.selectedLoadout.mainGunId);
  const selectedSubGun = getSubGunSpec(state.selectedLoadout.subGunId);
  const selectedSE = getSpecialEquipmentSpec(state.selectedLoadout.specialEquipmentId);
  const selectedSupport = contractSupportCatalog[state.selectedLoadout.contractSupportId];
  const encounterProfileMap = encounterProfiles();
  const selectedStageProfile = getStageProfile(state.stage);
  const selectedStageAdvisory = getGarageStageAdvisory(state, state.stage);
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
  const liveMoeLine = state.gamePhase === 'garage' ? state.moeLine : narrativeMoeLine;
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
  // Keep UNKNOWN SIGN strictly separated from mask/effect assets like MirrorCurve.
  // Do not fallback to generic `unknown` key to avoid accidental asset mix-ups.
  const unknownEnemyAsset =
    resolveAssetUrl(enemyAssetMap.unknown_sign)
    ?? resolveAssetUrl('images/devil/UNKNOWN.png');
  const resolveUnknownEnemyAsset = (_index: number): string | undefined => unknownEnemyAsset;
  const playerAsset = resolveAssetUrl(assetManifest.images.player);
  const moeVariantMap = assetManifest.images.moeVariants ?? {};
  const resolveMoeAsset = (
    variant: 'default' | 'smile' | 'serious' | 'confused' | 'relaxed',
  ): string | undefined => resolveAssetUrl(moeVariantMap[variant]) ?? resolveAssetUrl(assetManifest.images.moe);
  const selectedMoeVariant: 'default' | 'smile' | 'serious' | 'confused' | 'relaxed' =
    state.gamePhase === 'game_over'
      ? 'confused'
      : state.gamePhase === 'boss_encounter' || state.gamePhase === 'boss_preview'
        ? 'serious'
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
  const garageImage = resolveAssetUrl(assetManifest.images.ui?.garage);
  const shellClassName = assetManifest.ui.shellClass?.trim() ?? '';

  useRuntimeConfigEffects({
    setAssetManifest,
    setAssetManifestLoaded,
    setBalanceConfig,
    setAutoplayRuns,
    setDevilConfigVersion,
    setDialogueConfigVersion,
    cssVars: assetManifest.ui.cssVars,
  });

  useAudioEffects({
    assetManifest,
    audioUnlocked,
    setAudioUnlocked,
    logs: state.logs,
    gamePhase: state.gamePhase,
    pickSfxCueFromLog,
    bgmRef,
    lastSfxAtRef,
  });

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
  const terminalStatusCompact = terminalStatus
    .filter((status) => !status.startsWith('ASSET ') && !status.startsWith('DEVIL CFG ') && !status.startsWith('DIALOGUE '))
    .slice(0, 7);
const tacticalLinesCompact = tacticalLines
    .filter((_, index) => index === 0 || (isEncounterActive && index === 1))
    .slice(0, 2);

  const contractEnabled = !!selectedEnemy && selectedEnemy.contractWindow && selectedEnemy.contractable;
  const selectedEnemyAnalyzed = !!selectedEnemy && (isBossProfile(selectedEnemy.profile) || state.encounter.analyzedEnemyIds.includes(selectedEnemy.id) || !!selectedEnemy.affinityRevealed);
  const detailEnemyAnalyzed = !!detailEnemy && (isBossProfile(detailEnemy.profile) || state.encounter.analyzedEnemyIds.includes(detailEnemy.id) || !!detailEnemy.affinityRevealed);
  const selectedEnemyDisplayLabel = selectedEnemyAnalyzed && selectedEnemy
    ? encounterProfileMap[selectedEnemy.profile].label
    : 'UNKNOWN SIGN';
  const approachRevealIdentity = false;
  const windshieldThreatLabel = (() => {
    if (state.gamePhase === 'approach') return 'UNKNOWN SIGN';
    if (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') {
      if (state.gamePhase === 'boss_encounter') return 'TOLL GATE SAINT';
      return selectedEnemy ? selectedEnemyDisplayLabel : 'UNKNOWN SIGN';
    }
    return 'ROAD OPEN';
  })();
  const signalTunnelScenario = getRouteEventScenario('signal_tunnel_01');
  const signalChoices: SignalChoice[] = (signalTunnelScenario?.choices && signalTunnelScenario.choices.length > 0
    ? signalTunnelScenario.choices
    : [
      { id: 'analyze_trace', label: 'Analyze Trace', text: '干渉源を解析し、断片ログを抽出する。' },
      { id: 'hold_lane', label: 'Keep Driving', text: '速度を維持し、次接敵を優先する。' },
      { id: 'open_radio', label: 'Open Radio Channel', text: 'AM帯を開いて交信を試みる。' },
    ]).map((choice) => {
    const choiceId = (choice.id === 'analyze_trace' || choice.id === 'hold_lane' || choice.id === 'open_radio')
      ? choice.id
      : 'hold_lane';
    const disabled = (choiceId === 'analyze_trace' || choiceId === 'open_radio') && state.signal <= 0;
    return {
      ...choice,
      choiceId,
      disabled,
    } as SignalChoice;
  });
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
  const getPredictedDamageLabel = (commandId: 'main_gun' | 'sub_gun' | 'se_harpoon' | 'ram') => {
    const target = selectedEnemy;
    const targetAnalyzed = !!target && (state.encounter.analyzedEnemyIds.includes(target.id) || target.revealed || target.affinityRevealed);
    const getAffinityFor = (affinity: AffinityType): AffinityRating =>
      target && targetAnalyzed ? target.affinities[affinity] : 'normal';
    const shield = target?.guardStacks && target.guardStacks > 0 ? 1 : 0;
    if (commandId === 'main_gun') {
      const roll = resolveDamageRoll({
        baseDamage: selectedMainGun.damage,
        affinity: getAffinityFor('ballistic'),
        variance: damageVarianceByCommand.main_gun,
        flatReduction: shield,
      });
      return `${roll.min}-${roll.max}`;
    }
    if (commandId === 'sub_gun') {
      const roll = resolveDamageRoll({
        baseDamage: selectedSubGun.damage,
        affinity: getAffinityFor('suppressive'),
        variance: damageVarianceByCommand.sub_gun,
        flatReduction: shield,
        armored: !!target?.armored,
      });
      return `${roll.min}-${roll.max}`;
    }
    if (commandId === 'se_harpoon') {
      const roll = resolveDamageRoll({
        baseDamage: selectedSE.damage,
        affinity: getAffinityFor('signal'),
        variance: damageVarianceByCommand.se_harpoon,
        flatReduction: shield,
      });
      return `${roll.min}-${roll.max}`;
    }
    const ramBase = target?.intent === 'guard' ? 2 : 3;
    const roll = resolveDamageRoll({
      baseDamage: ramBase,
      affinity: getAffinityFor('impact'),
      variance: damageVarianceByCommand.ram,
      flatReduction: shield,
    });
    return `${roll.min}-${roll.max}`;
  };
  type AppRuntimeSaveSnapshot = {
    state: State;
    runIndex: number;
    activeRun: RunRecord | null;
  };
  const saveSnapshot = useMemo(() => loadSaveData(), [saveRefresh]);
  const autoSaveSnapshot = useMemo(() => loadAutoSaveSnapshot<AppRuntimeSaveSnapshot>(), [saveRefresh]);
  const canUpdateDriverSkill = skillOrder
    .filter((skillId) => skillId === 'ram_control' || skillId === 'gunnery')
    .some((skillId) => state.driverXpBank >= getSkillCost(state.skillLevels[skillId]));
  const canUpdateMoeSkill = skillOrder
    .filter((skillId) => skillId === 'scan_boost' || skillId === 'translation_assist')
    .some((skillId) => state.moeSyncBank >= getSkillCost(state.skillLevels[skillId]));
  const canUpdateVehicleTune = vehicleUpgradeOrder
    .some((upgradeId) => state.creditBank >= getVehicleUpgradeCost(state.vehicleUpgrades[upgradeId]));
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
    if (state.gamePhase !== 'garage' && showGarageLaunchConfirm) {
      setShowGarageLaunchConfirm(false);
    }
  }, [state.gamePhase, showGarageLaunchConfirm]);

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
            intelProgress: enemy.intelProgress,
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
          if (selected.intelProgress >= selected.intelThreshold) {
            activeRunRef.current.analyzedEnemies = Array.from(new Set([...activeRunRef.current.analyzedEnemies, selected.profile]));
          }
          touchDemonArchive(selected.profile, {
            name: selected.name,
            profile: selected.profile,
            analyzed: selected.intelProgress >= selected.intelThreshold,
            affinityRevealed: !!selected.affinityRevealed,
            intelProgress: selected.intelProgress,
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
            intelProgress: Math.max(100, state.encounter.enemies.find((enemy) => enemy.profile === profile)?.intelProgress ?? 0),
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
  const approachMainGunDesc = `先制主砲。予測DMG ${getRollBounds(selectedMainGun.damage + state.skillLevels.gunnery, damageVarianceByCommand.approach_main_gun).min}-${getRollBounds(selectedMainGun.damage + state.skillLevels.gunnery, damageVarianceByCommand.approach_main_gun).max} / MainAmmo-1 / 交渉難化`;
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
  const onGarageEnterNightLoop = () => {
    setShowGarageLaunchConfirm(true);
  };
  const onGarageLaunchCancel = () => {
    setShowGarageLaunchConfirm(false);
  };
  const onGarageLaunchConfirm = () => {
    setShowGarageLaunchConfirm(false);
    dispatch({ type: 'GARAGE_ENTER_RUN' });
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

    <PrologueOverlay
      visible={state.gamePhase === 'prologue'}
      narrativeMoeLine={narrativeMoeLine}
      nightLoopIntroImage={nightLoopIntroImage}
      showFirstGarageGuide={showFirstGarageGuide}
      onStartEngine={() => dispatch({ type: 'START_ENGINE' })}
      onOpenGarage={() => dispatch({ type: 'OPEN_GARAGE' })}
    />

    <div className="cockpit-frame">
      <CockpitHeader
        logoAsset={logoAsset}
        runStatus={runStatus}
        depth={depth}
        currentNode={state.gamePhase}
        isNaviActive={state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter'}
        isWarnActive={state.fuel <= 3 || state.armor <= 3 || state.signal <= 1}
        isGameOver={state.gamePhase === 'game_over'}
      />

      <main className={`action-panel panel ${state.gamePhase === 'garage' ? 'action-panel--garage-focus' : ''} ${isRunFitPhase ? 'action-panel--run-fit' : ''}`}>
        <div className="panel-title">
          <span>WINDSHIELD ENCOUNTER VIEW</span>
          <small>{isWindshieldFolded ? 'GARAGE / FOLDED' : state.gamePhase.toUpperCase()}</small>
        </div>

        <BattleView
          gamePhase={state.gamePhase}
          enemies={state.encounter.enemies}
          selectedEnemyId={state.encounter.selectedEnemyId}
          analyzedEnemyIds={state.encounter.analyzedEnemyIds}
          approachLineup={approachLineup}
          approachScanSuccess={!!state.approach?.scanSuccess}
          approachRevealIdentity={approachRevealIdentity}
          isEncounterActive={isEncounterActive}
          isRoadMoving={isRoadMoving}
          isRoadStopped={isRoadStopped}
          isBossPhase={isBossPhase}
          isArmorCritical={isArmorCritical}
          isWindshieldFolded={isWindshieldFolded}
          hitFxTone={hitFxTone}
          hitFxPulse={hitFxPulse}
          aliveEnemiesCount={aliveEnemies.length}
          ingressSteps={ingressSteps}
          windshieldThreatLabel={windshieldThreatLabel}
          detailEnemy={detailEnemy}
          detailEnemyAnalyzed={detailEnemyAnalyzed}
          detailIntentIconMap={detailIntentIconMap}
          profiles={encounterProfileMap}
          getContractHint={getContractHint}
          isBossProfile={isBossProfile}
          resolveUnknownEnemyAsset={resolveUnknownEnemyAsset}
          resolveEnemyAsset={(profile) => resolveEnemyAsset(profile, enemyAssetMap)}
          resolveEnemyLane={resolveEnemyLane}
          getLikelyWeaknessSummary={getLikelyWeaknessSummary}
          onSelectEnemy={(enemyId) => dispatch({ type: 'SELECT_ENEMY', enemyId })}
          onHoverEnemy={setHoveredEnemyId}
        />

        <section className="battle-deck">
          <TerminalPanel
            moeAsset={moeAsset}
            gamePhase={state.gamePhase}
            signal={state.signal}
            liveMoeLine={liveMoeLine}
            runStatus={runStatus}
            terminalStatus={terminalStatusCompact}
            tacticalLines={tacticalLinesCompact}
            logLines={logLines}
            encounterIndex={state.encounterIndex}
            encounterTurn={state.encounter.turn}
            isEncounterActive={isEncounterActive}
            terminalLogRef={terminalLogRef}
            classifyLog={classifyLog}
            getLogBadge={getLogBadge}
            getPseudoTimecode={getPseudoTimecode}
          />

          <CommandPanel
            gamePhase={state.gamePhase}
            state={state}
            groupOrder={groupOrder}
            commandEnabledMap={commandEnabledMap}
            commandAffinityTagMap={commandAffinityTagMap}
            contractEnabled={contractEnabled}
            selectedMainGunName={selectedMainGun.name}
            selectedSubGunName={selectedSubGun.name}
            selectedSubGunDescription={selectedSubGun.description}
            selectedSEName={selectedSE.name}
            selectedSEDescription={selectedSE.description}
            getPredictedDamageLabel={getPredictedDamageLabel}
            getMoeCommandGuide={getMoeCommandGuide}
            getDialogueLine={getDialogueLine}
            setHoveredHint={setHoveredMoeHint}
            clearHoveredHint={() => setHoveredMoeHint('')}
            onExecuteCommand={(command) => dispatch({ type: 'EXECUTE_COMMAND', command })}
            onSelectCommand={(command) => dispatch({ type: 'SELECT_COMMAND', command })}
            onRewardContinue={() => dispatch({ type: 'REWARD_CONTINUE' })}
            onApproachChoose={(option) => dispatch({ type: 'APPROACH_CHOOSE', option })}
            onApproachContinue={() => dispatch({ type: 'APPROACH_CONTINUE' })}
            onRouteChoice={(lane) => dispatch({ type: 'ROUTE_CHOICE', lane })}
            onSalvagePick={(rewardId) => dispatch({ type: 'SALVAGE_PICK', rewardId })}
            signalChoices={signalChoices}
            onSignalRouteChoice={(choiceId) => dispatch({ type: 'SIGNAL_ROUTE_CHOICE', choiceId })}
            onBossPreviewChoice={(choice) => dispatch({ type: 'BOSS_PREVIEW_CHOICE', choice })}
            onReturnToSurface={() => dispatch({ type: 'RETURN_TO_SURFACE' })}
            showGarageLaunchConfirm={showGarageLaunchConfirm}
            onGarageEnterNightLoop={onGarageEnterNightLoop}
            onGarageLaunchConfirm={onGarageLaunchConfirm}
            onGarageLaunchCancel={onGarageLaunchCancel}
            onStartNextRun={() => dispatch({ type: 'START_NEXT_RUN' })}
            onOpenGarage={() => dispatch({ type: 'OPEN_GARAGE' })}
            onRetry={() => dispatch({ type: 'RETRY' })}
            approachMainGunDesc={approachMainGunDesc}
          />

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
          <UtilityPanels
            showUtilityPanels={showUtilityPanels}
            showPlaytestReport={showPlaytestReport}
            showSaveTools={showSaveTools}
            showArchive={showArchive}
            telemetryEvents={telemetryEvents}
            playtestReport={playtestReport}
            saveSnapshot={saveSnapshot}
            latestResult={latestResult}
            archiveEntries={archiveEntries}
            contractsAcquiredTotal={contractsAcquiredTotal}
            routeLogEntriesCount={routeLogEntries.length}
            moeMemoryEntriesCount={moeMemoryEntries.length}
            autoSaveSnapshotLabel={autoSaveSnapshot ? new Date(autoSaveSnapshot.savedAt).toLocaleString() : 'none'}
            autoSaveReason={autoSaveSnapshot?.reason ?? '-'}
            debugSaveHeaders={debugSaveHeaders}
            saveMessage={saveMessage}
            saveImportInputRef={saveImportInputRef}
            encounterProfileMap={encounterProfileMap}
            demonArchiveFlavor={demonArchiveFlavor}
            onToggleUtilityPanels={() => setShowUtilityPanels((open) => !open)}
            onTogglePlaytestReport={() => setShowPlaytestReport((open) => !open)}
            onToggleSaveTools={() => setShowSaveTools((open) => !open)}
            onToggleArchive={() => setShowArchive((open) => !open)}
            onCopyMarkdownReport={copyMarkdownReport}
            onDownloadTelemetryJson={downloadTelemetryJson}
            onResetTelemetry={resetTelemetry}
            onDownloadSaveJson={downloadSaveJson}
            onTriggerSaveImport={triggerSaveImport}
            onResetMainSave={resetMainSaveNow}
            onSaveDebugNow={saveDebugNow}
            onRestoreAutoSaveNow={restoreAutoSaveNow}
            onRestoreLatestDebugNow={restoreLatestDebugNow}
            onDownloadAutoSaveJson={downloadAutoSaveJson}
            onDownloadDebugSavesJson={downloadDebugSavesJson}
            onDownloadCorruptBackupJson={downloadCorruptBackupJson}
            onClearAutoSaveNow={clearAutoSaveNow}
            onClearDebugSavesNow={clearDebugSavesNow}
            onImportSaveFile={onImportSaveFile}
            onRestoreDebugById={restoreDebugById}
          />

          <GaragePanel
            visible={state.gamePhase === 'garage'}
            state={state}
            moeAsset={moeAsset}
            garageImage={garageImage}
            selectedStageProfile={selectedStageProfile}
            selectedStageAdvisory={selectedStageAdvisory}
            stageProfiles={stageProfiles}
            nextRunPreview={nextRunPreview}
            showGarageLaunchConfirm={showGarageLaunchConfirm}
            showRunHistory={showRunHistory}
            saveSnapshot={saveSnapshot}
            latestRunRecord={latestRunRecord}
            latest3Runs={latest3Runs}
            routeLogEntries={routeLogEntries}
            moeMemoryEntries={moeMemoryEntries}
            canUpdateDriverSkill={canUpdateDriverSkill}
            canUpdateMoeSkill={canUpdateMoeSkill}
            canUpdateVehicleTune={canUpdateVehicleTune}
            autoplayRuns={autoplayRuns}
            autoplayStrategy={autoplayStrategy}
            autoplayReport={autoplayReport}
            autoplayMinRuns={balanceConfig.autoplay.minRuns}
            autoplayMaxRuns={balanceConfig.autoplay.maxRuns}
            onSetShowRunHistory={setShowRunHistory}
            onGarageEnterNightLoop={onGarageEnterNightLoop}
            onGarageLaunchConfirm={onGarageLaunchConfirm}
            onGarageLaunchCancel={onGarageLaunchCancel}
            onSetStage={(stage) => dispatch({ type: 'GARAGE_SET_STAGE', stage })}
            onSetMainGun={(id) => dispatch({ type: 'GARAGE_SET_MAIN_GUN', id })}
            onSetSubGun={(id) => dispatch({ type: 'GARAGE_SET_SUB_GUN', id })}
            onSetSpecial={(id) => dispatch({ type: 'GARAGE_SET_SPECIAL', id })}
            onSetSupport={(id) => dispatch({ type: 'GARAGE_SET_SUPPORT', id })}
            onPurchaseSkill={(upgrade) => dispatch({ type: 'PURCHASE_SKILL', upgrade })}
            onPurchaseVehicleUpgrade={(id) => dispatch({ type: 'PURCHASE_VEHICLE_UPGRADE', id })}
            onSetAutoplayRuns={setAutoplayRuns}
            onSetAutoplayStrategy={setAutoplayStrategy}
            onRunAutoplay={runAutoplay}
          />


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
