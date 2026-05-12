import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  defaultAssetManifest,
  resolveAssetUrl,
  resolveEnemyAssetEntryUrl,
  type AssetManifest,
} from '../assetManifest';
import { defaultBalanceConfig, getBalanceConfig, type BalanceConfig } from '../balanceConfig';
import { getDialogueConfig, getDialogueLine } from '../dialogueConfig';
import { getMoeVariantForState, type MoeVariant } from '../game/moeDialogue';
import { getSignalCapacity } from '../game/signalSystem';
import {
} from '../saveSystem';
import {
  buildPlaytestReport,
  getTelemetryEvents,
  type PersistentProgressionSnapshot,
} from '../telemetry';
import { dispatchWithReproLog } from '../reproLog';
import {
  getRouteEventScenario,
} from '../scenario/scenarioLoader';
import { buildMoeRunComment, resultLabel } from '../game/runInsights';
import { getDevilConfig } from '../devilConfig';
import {
  type Action,
  type AutoPlayReport,
  type AutoPlayStrategy,
  type FunTestId,
  type UpgradeId,
  type VehicleUpgradeId,
} from '../game/types';
import {
  contractSupportCatalog,
  demonArchiveFlavor,
} from '../game/catalogs';
import {
  encounterProfiles,
  getMainGunSpec,
  getMoeCommandGuide,
  getSpecialEquipmentSpec,
  getSubGunSpec,
  getEnemyRevealState,
  isAlive,
  resolveEnemyAnimationFrames,
  resolveEnemyAsset,
  resolveUnknownEnemyAnimationFrames,
  UNKNOWN_SIGN_LABEL,
} from '../game/runtimeHelpers';

// Contributor note:
// Editing guide for LLM/agents lives in docs/llm-code-map.md
import {
  classifyLog,
  getGarageStageAdvisory,
  getLogBadge,
  getPseudoTimecode,
  getRunGrowth,
  getRunStartResources,
  getSelectedEnemy,
  getSkillCost,
  getStageProfile,
  getVehicleUpgradeCost,
  getLikelyWeaknessSummary,
  getNarrativeMoeLine,
  isBossProfile,
  initState,
  pickSfxCueFromLog,
  reducer,
  runAutoplayBatch,
  sanitizeRestoredState,
  stageProfiles,
} from './state/stateReducer';
import { useRuntimeConfigEffects } from './hooks/useRuntimeConfigEffects';
import { useAudioEffects } from './hooks/useAudioEffects';
import { useCommandDerived } from './hooks/useCommandDerived';
import { useUiEffects } from './hooks/useUiEffects';
import { useSaveRuntime } from './hooks/useSaveRuntime';
import { useSaveTools } from './hooks/useSaveTools';
import { useTelemetryEffects } from './hooks/useTelemetryEffects';
import { useRunBeatQueue } from './hooks/useRunBeatQueue';
import { getNaviRouteCandidates, getNaviRouteIntelStatus } from './state/routeGraph';
import { getNaviRouteMap } from './state/routeMap';
import { CockpitHeader } from './components/CockpitHeader';
import { PrologueOverlay } from './components/PrologueOverlay';
import { BattleView } from './components/BattleView';
import { TerminalPanel } from './components/TerminalPanel';
import { CommandPanel, type SignalChoice } from './components/CommandPanel';
import { VehiclePanel } from './components/VehiclePanel';
import { SystemEventPanel } from './components/SystemEventPanel';
import { RunBeatOverlay } from './components/RunBeatOverlay';

const hasBootDebugFlag = () => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.has('debug')
    || params.has('debugSave')
    || params.has('devtools')
    || params.has('debugState')
    || params.has('funTest')
    || window.location.hash.includes('debug');
};

type BootDebugPreset =
  | { type: 'garage' }
  | { type: 'funTest'; id: FunTestId };

const normalizeFunTestId = (value: string | null): FunTestId | undefined => {
  const key = value?.trim().toLowerCase().replace(/[-\s]/g, '_');
  if (!key) return undefined;
  if (key === 'pixie' || key === 'fun_pixie' || key === 'pixie_talk' || key === 'test_pixie_talk') return 'pixie_talk';
  if (key === 'reaper' || key === 'road_reaper' || key === 'fun_reaper' || key === 'road_reaper_combat') return 'road_reaper_combat';
  if (key === 'toll' || key === 'boss' || key === 'fun_toll' || key === 'toll_gate' || key === 'toll_gate_boss') return 'toll_gate_boss';
  return undefined;
};

const getBootDebugPreset = (): BootDebugPreset | undefined => {
  if (typeof window === 'undefined') return undefined;
  const params = new URLSearchParams(window.location.search);
  const funTestId = normalizeFunTestId(params.get('funTest')) ?? normalizeFunTestId(params.get('debugState'));
  if (funTestId) return { type: 'funTest', id: funTestId };
  const debugState = params.get('debugState')?.trim().toLowerCase();
  if (debugState === 'garage') return { type: 'garage' };
  return undefined;
};

export function App() {
  const bootDebugEnabled = import.meta.env.DEV && hasBootDebugFlag();
  const bootDebugPreset = useMemo(() => import.meta.env.DEV ? getBootDebugPreset() : undefined, []);
  const [state, rawDispatch] = useReducer(reducer, undefined, initState);
  const bootDebugPresetAppliedRef = useRef(false);
  const stateBeforeDispatchRef = useRef(state);
  useEffect(() => {
    stateBeforeDispatchRef.current = state;
  }, [state]);
  const dispatch = useCallback((action: Action) => {
    dispatchWithReproLog(stateBeforeDispatchRef.current, action, () => rawDispatch(action));
  }, [rawDispatch]);
  useEffect(() => {
    if (!bootDebugPreset || bootDebugPresetAppliedRef.current) return;
    bootDebugPresetAppliedRef.current = true;
    if (bootDebugPreset.type === 'garage') {
      dispatch({ type: 'OPEN_GARAGE' });
      return;
    }
    dispatch({ type: 'START_FUN_TEST', id: bootDebugPreset.id });
  }, [bootDebugPreset, dispatch]);
  const [balanceConfig, setBalanceConfig] = useState<BalanceConfig>(defaultBalanceConfig);
  const [devilConfigVersion, setDevilConfigVersion] = useState(getDevilConfig().version);
  const [dialogueConfigVersion, setDialogueConfigVersion] = useState(getDialogueConfig().version);
  const [autoplayRuns, setAutoplayRuns] = useState(() => defaultBalanceConfig.autoplay.defaultRuns);
  const [autoplayStrategy, setAutoplayStrategy] = useState<AutoPlayStrategy>('balanced');
  const [autoplayReport, setAutoplayReport] = useState<AutoPlayReport | null>(null);
  const [showPlaytestReport, setShowPlaytestReport] = useState(false);
  const [showSaveTools, setShowSaveTools] = useState(bootDebugEnabled);
  const [showArchive, setShowArchive] = useState(false);
  const [showUtilityPanels, setShowUtilityPanels] = useState(bootDebugEnabled);
  const [showRunHistory, setShowRunHistory] = useState(false);
  const [showGarageLaunchConfirm, setShowGarageLaunchConfirm] = useState(false);
  const [, setHoveredMoeHint] = useState('');
  const [telemetryRefresh, setTelemetryRefresh] = useState(0);
  const [assetManifest, setAssetManifest] = useState<AssetManifest>(defaultAssetManifest);
  const [assetManifestLoaded, setAssetManifestLoaded] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [animationMode, setAnimationMode] = useState<'play' | 'skip'>('play');
  const terminalLogRef = useRef<HTMLUListElement>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const lastSfxAtRef = useRef(0);
  const saveImportInputRef = useRef<HTMLInputElement>(null);
  const selectedMainGun = getMainGunSpec(state.selectedLoadout.mainGunId);
  const selectedSubGun = getSubGunSpec(state.selectedLoadout.subGunId);
  const selectedSE = getSpecialEquipmentSpec(state.selectedLoadout.specialEquipmentId);
  const selectedSupport = contractSupportCatalog[state.selectedLoadout.contractSupportId];
  const encounterProfileMap = encounterProfiles();
  const selectedStageProfile = getStageProfile(state.stage);
  const selectedStageAdvisory = getGarageStageAdvisory(state, state.stage);
  const nextRunPreview = getRunStartResources(state.selectedLoadout, state.vehicleUpgrades, state.skillLevels);
  const balance = getBalanceConfig();
  const dashboardFuelCapBase = balance.resources.baseFuel + state.vehicleUpgrades.fuel_tank;
  const dashboardArmorCapBase = balance.resources.baseArmor + state.vehicleUpgrades.armor_plating;
  const dashboardSignalCapBase = getSignalCapacity(state.skillLevels);
  const dashboardFuelMax = Math.max(dashboardFuelCapBase, state.fuel);
  const dashboardArmorMax = Math.max(dashboardArmorCapBase, state.armor);
  const dashboardSignalMax = Math.max(dashboardSignalCapBase, state.signal);
  const armorCriticalRatio = dashboardArmorMax > 0 ? state.armor / dashboardArmorMax : 1;
  const isArmorCritical = armorCriticalRatio <= 0.25;
  const skillOrder: UpgradeId[] = ['ram_control', 'gunnery', 'scan_boost', 'translation_assist', 'signal_tuning'];
  const vehicleUpgradeOrder: VehicleUpgradeId[] = ['fuel_tank', 'armor_plating', 'ammo_rack', 'se_rack', 'signal_antenna', 'noise_filter', 'daemon_bus'];

  const selectedEnemy = useMemo(() => getSelectedEnemy(state.encounter), [state.encounter]);
  const runGrowth = useMemo(() => getRunGrowth(state), [state]);
  const narrativeMoeLine = useMemo(() => getNarrativeMoeLine(state), [state]);
  const liveMoeLine = state.gamePhase === 'garage' ? state.moeLine : narrativeMoeLine;
  const aliveEnemies = state.encounter.enemies.filter(isAlive);
  const approachLineup = state.approach?.lineup ?? [];
  const runStatus = state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter'
    ? `STG ${String(state.stage).padStart(2, '0')} / WAVE ${String(state.encounterIndex + 1).padStart(2, '0')}`
    : state.gamePhase.toUpperCase();
  const devBuildLabel = import.meta.env.DEV ? __APP_COMMIT_HASH__ : undefined;
  const depth = (state.stage - 1) * 3 + state.encounterIndex + 1;
  const isBattlePhase = state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter';
  const isBossPhase = state.gamePhase === 'boss_preview' || state.gamePhase === 'boss_encounter';
  const isRoadMoving = ['approach', 'route_choice', 'salvage', 'signal', 'boss_preview', 'reward', 'return_gate'].includes(state.gamePhase);
  const isRoadStopped = isBattlePhase || state.gamePhase === 'garage' || state.gamePhase === 'result' || state.gamePhase === 'game_over';
  const isEncounterActive = (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') && state.encounter.phase === 'command';
  const isWindshieldFolded = state.gamePhase === 'garage';
  const enemyAssetMap = assetManifest.images.enemies ?? {};
  const defaultEnemyAssetMap = defaultAssetManifest.images.enemies ?? {};
  // Keep UNKNOWN SIGN strictly separated from mask/effect assets like MirrorCurve.
  // Do not fallback to generic `unknown` key to avoid accidental asset mix-ups.
  const unknownEnemyAsset =
    resolveEnemyAssetEntryUrl(enemyAssetMap.unknown_sign)
    ?? resolveEnemyAssetEntryUrl(defaultEnemyAssetMap.unknown_sign);
  const resolveUnknownEnemyAsset = (_index: number): string | undefined => unknownEnemyAsset;
  const unknownEnemyAnimationFrames = resolveUnknownEnemyAnimationFrames(enemyAssetMap, defaultEnemyAssetMap);
  const playerAsset = resolveAssetUrl(assetManifest.images.player);
  const moeVariantMap = assetManifest.images.moeVariants ?? {};
  const resolveMoeAsset = (variant: MoeVariant): string | undefined =>
    resolveAssetUrl(moeVariantMap[variant]) ?? resolveAssetUrl(assetManifest.images.moe);
  const selectedMoeVariant = getMoeVariantForState(state);
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

  const selectedEnemyReveal = selectedEnemy ? getEnemyRevealState(selectedEnemy, state.encounter.analyzedEnemyIds) : undefined;
  const selectedEnemyAnalyzed = !!selectedEnemyReveal?.showAffinity;
  const selectedEnemyDisplayLabel = selectedEnemyReveal?.showName && selectedEnemy
    ? encounterProfileMap[selectedEnemy.profile].label
    : UNKNOWN_SIGN_LABEL;
  const approachRevealIdentity = false;
  const windshieldThreatLabel = (() => {
    if (state.gamePhase === 'approach') return UNKNOWN_SIGN_LABEL;
    if (state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter') {
      if (state.gamePhase === 'boss_encounter') return 'TOLL GATE SAINT';
      return selectedEnemy ? selectedEnemyDisplayLabel : UNKNOWN_SIGN_LABEL;
    }
    return 'ROAD OPEN';
  })();
  const naviRouteCandidates = state.gamePhase === 'route_choice' ? getNaviRouteCandidates(state) : [];
  const naviRouteIntelStatus = state.gamePhase === 'route_choice' ? getNaviRouteIntelStatus(state) : undefined;
  const naviRouteMap = state.gamePhase === 'route_choice' ? getNaviRouteMap(state, naviRouteCandidates) : undefined;
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
  const resolveEnemyLane = (index: number, total: number, isBoss: boolean): 'left' | 'center' | 'right' => {
    if (isBoss || total <= 1) return 'center';
    if (total === 2) return index === 0 ? 'left' : 'right';
    if (index === 0) return 'left';
    if (index === 1) return 'center';
    return 'right';
  };
  const {
    contractEnabled,
    commandAffinityTagMap,
    commandEnabledMap,
    getPredictedDamageLabel,
    approachMainGunDesc,
  } = useCommandDerived({
    state,
    selectedEnemy,
    selectedEnemyAnalyzed,
    selectedMainGun,
    selectedSubGun,
    selectedSE,
  });
  const {
    saveSnapshot,
    autoSaveSnapshot,
    saveMessage,
    setSaveMessage,
    debugSaveHeaders,
    refreshSaveSnapshot,
    refreshDebugHeaders,
    buildRuntimeSnapshot,
    autoSaveNow,
    beginRunRecord,
    finalizeRunRecord,
    phaseRef,
    bossChallengedRef,
    runIndexRef,
    processedLogCountRef,
    loadoutHashRef,
    activeRunRef,
  } = useSaveRuntime({
    state,
    narrativeMoeLine,
  });
  const canUpdateDriverSkill = skillOrder
    .filter((skillId) => skillId === 'ram_control' || skillId === 'gunnery')
    .some((skillId) => state.driverXpBank >= getSkillCost(state.skillLevels[skillId]));
  const canUpdateMoeSkill = skillOrder
    .filter((skillId) => skillId === 'scan_boost' || skillId === 'translation_assist' || skillId === 'signal_tuning')
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
  const { hitFxTone, hitFxPulse, combatFxCue, combatFxPulse, damagePops } = useUiEffects({
    state,
    dispatch,
    playCombatEffects: animationMode === 'play',
    showGarageLaunchConfirm,
    setShowGarageLaunchConfirm,
    terminalLogRef,
    resetAutoplayReport: () => setAutoplayReport(null),
    clearHoveredHint: () => setHoveredMoeHint(''),
  });
  const { activeBeat, dismissBeat } = useRunBeatQueue({
    enabled: animationMode === 'play',
    gamePhase: state.gamePhase,
    encounterIndex: state.encounterIndex,
    stage: state.stage,
    encounterPrep: state.encounterPrep,
    approachScanSuccess: state.approach?.scanSuccess,
    approachKind: state.approach?.pendingKind,
  });

  useTelemetryEffects({
    state,
    setTelemetryRefresh,
    runIndexRef,
    phaseRef,
    bossChallengedRef,
    processedLogCountRef,
    loadoutHashRef,
    activeRunRef,
    beginRunRecord,
    finalizeRunRecord,
    refreshSaveSnapshot,
    refreshDebugHeaders,
    autoSaveNow,
  });

  const {
    saveDebugNow,
    restoreAutoSaveNow,
    restoreLatestDebugNow,
    restoreDebugById,
    clearAutoSaveNow,
    clearDebugSavesNow,
    downloadSaveJson,
    resetMainSaveNow,
    triggerSaveImport,
    onImportSaveFile,
    downloadDebugSavesJson,
    downloadAutoSaveJson,
    downloadCorruptBackupJson,
    copyMarkdownReport,
    downloadTelemetryJson,
    resetTelemetry,
  } = useSaveTools({
    state,
    dispatch,
    playtestMarkdown: playtestReport.markdown,
    saveImportInputRef,
    setTelemetryRefresh,
    setSaveMessage,
    refreshSaveSnapshot,
    refreshDebugHeaders,
    buildRuntimeSnapshot,
    sanitizeRestoredState,
    runIndexRef,
    activeRunRef,
    phaseRef,
    bossChallengedRef,
    processedLogCountRef,
    loadoutHashRef,
  });

  const logLines = state.logs.slice(-24);
  const groupOrder: ('WEAPON' | 'TERMINAL' | 'DRIVE')[] = ['WEAPON', 'TERMINAL', 'DRIVE'];
  const runAutoplay = () => {
    setAutoplayReport(runAutoplayBatch(state.selectedLoadout, autoplayRuns, autoplayStrategy));
  };
  const showFirstGarageGuide = state.gamePhase === 'prologue' && !state.previousRun;
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

  return <div className={`dashboard-shell ${isEncounterActive ? 'is-encounter' : ''} ${state.funTestMode ? 'is-fun-test' : ''} ${shellClassName}`.trim()}>
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
      garageIntroImage={garageImage}
      showFirstGarageGuide={showFirstGarageGuide}
      showDebugSaveBoot={bootDebugEnabled}
      mainSaveSummary={`${saveSnapshot.totalRuns} runs / best ${saveSnapshot.bestResult ?? '-'}`}
      autoSaveLabel={autoSaveSnapshot ? new Date(autoSaveSnapshot.savedAt).toLocaleString() : 'none'}
      autoSaveReason={autoSaveSnapshot?.reason ?? '-'}
      autoSaveAvailable={!!autoSaveSnapshot}
      debugSaveHeaders={debugSaveHeaders}
      onStartEngine={() => dispatch({ type: 'START_ENGINE' })}
      onOpenGarage={() => dispatch({ type: 'OPEN_GARAGE' })}
      onRestoreAutoSave={restoreAutoSaveNow}
      onRestoreDebugSave={restoreDebugById}
    />

    <div className="cockpit-frame">
      {state.funTestMode && <div className="fun-test-badge" aria-label={state.funTestMode.label}>
        <span>FUN TEST MODE</span>
        <strong>{state.funTestMode.target}</strong>
        <small>{state.funTestMode.description}</small>
        <button type="button" onClick={() => dispatch({ type: 'OPEN_GARAGE' })}>Exit Test Mode</button>
      </div>}
      <RunBeatOverlay beat={activeBeat} onDismiss={dismissBeat} />

      <CockpitHeader
        logoAsset={logoAsset}
        runStatus={runStatus}
        depth={depth}
        currentNode={state.gamePhase}
        animationMode={animationMode}
        isNaviActive={state.gamePhase === 'encounter' || state.gamePhase === 'boss_encounter'}
        isWarnActive={state.fuel <= 3 || state.armor <= 3 || state.signal <= 1}
        isGameOver={state.gamePhase === 'game_over'}
        devBuildLabel={devBuildLabel}
        onAnimationModeChange={setAnimationMode}
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
          signal={state.signal}
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
          combatFxCue={combatFxCue}
          combatFxPulse={combatFxPulse}
          damagePops={damagePops}
          aliveEnemiesCount={aliveEnemies.length}
          forecast={state.encounter.forecast}
          forecastUnstable={state.encounter.forecastUnstable}
          windshieldThreatLabel={windshieldThreatLabel}
          routeCandidates={naviRouteCandidates}
          routeIntelStatus={naviRouteIntelStatus}
          routeMap={naviRouteMap}
          profiles={encounterProfileMap}
          isBossProfile={isBossProfile}
          resolveUnknownEnemyAsset={resolveUnknownEnemyAsset}
          resolveUnknownEnemyAnimationFrames={() => unknownEnemyAnimationFrames}
          resolveEnemyAsset={(profile) => resolveEnemyAsset(profile, enemyAssetMap)}
          resolveEnemyAnimationFrames={(profile) => resolveEnemyAnimationFrames(profile, enemyAssetMap)}
          resolveEnemyLane={resolveEnemyLane}
          getLikelyWeaknessSummary={getLikelyWeaknessSummary}
          showDebugBadges={bootDebugEnabled}
          onSelectEnemy={(enemyId) => dispatch({ type: 'SELECT_ENEMY', enemyId })}
          onRouteChoice={(lane) => dispatch({ type: 'ROUTE_CHOICE', lane })}
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
            onTalkChoose={(choiceId) => dispatch({ type: 'TALK_CHOOSE', choiceId })}
            onTalkCancel={() => dispatch({ type: 'TALK_CANCEL' })}
            onRewardContinue={() => dispatch({ type: 'REWARD_CONTINUE' })}
            onApproachChoose={(option) => dispatch({ type: 'APPROACH_CHOOSE', option })}
            onApproachContinue={() => dispatch({ type: 'APPROACH_CONTINUE' })}
            onRouteChoice={(lane) => dispatch({ type: 'ROUTE_CHOICE', lane })}
            onSalvagePick={(rewardId) => dispatch({ type: 'SALVAGE_PICK', rewardId })}
            signalChoices={signalChoices}
            onSignalRouteChoice={(choiceId) => dispatch({ type: 'SIGNAL_ROUTE_CHOICE', choiceId })}
            onBossPreviewChoice={(choice) => dispatch({ type: 'BOSS_PREVIEW_CHOICE', choice })}
            onReturnExtract={() => dispatch({ type: 'RETURN_EXTRACT' })}
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

          <VehiclePanel
            playerAsset={playerAsset}
            state={state}
            dashboardFuelMax={dashboardFuelMax}
            dashboardArmorMax={dashboardArmorMax}
            dashboardSignalMax={dashboardSignalMax}
            selectedSupportName={selectedSupport.name}
            selectedMainGunName={selectedMainGun.name}
            selectedSubGunName={selectedSubGun.name}
            selectedSEName={selectedSE.name}
          />
        </section>

        <SystemEventPanel
          phaseLabel={state.gamePhase.toUpperCase()}
          stingerLabel={state.gamePhase === 'garage' ? 'MIDNIGHT BAY' : state.resultType ?? `ENCOUNTER ${state.encounterIndex + 1}/3`}
          utilityPanelsProps={{
            showUtilityPanels,
            showPlaytestReport,
            showSaveTools,
            showArchive,
            telemetryEvents,
            playtestReport,
            saveSnapshot,
            latestResult,
            archiveEntries,
            contractsAcquiredTotal,
            routeLogEntriesCount: routeLogEntries.length,
            moeMemoryEntriesCount: moeMemoryEntries.length,
            autoSaveSnapshotLabel: autoSaveSnapshot ? new Date(autoSaveSnapshot.savedAt).toLocaleString() : 'none',
            autoSaveReason: autoSaveSnapshot?.reason ?? '-',
            debugSaveHeaders,
            saveMessage,
            saveImportInputRef,
            encounterProfileMap,
            demonArchiveFlavor,
            onToggleUtilityPanels: () => setShowUtilityPanels((open) => !open),
            onTogglePlaytestReport: () => setShowPlaytestReport((open) => !open),
            onToggleSaveTools: () => setShowSaveTools((open) => !open),
            onToggleArchive: () => setShowArchive((open) => !open),
            onCopyMarkdownReport: copyMarkdownReport,
            onDownloadTelemetryJson: downloadTelemetryJson,
            onResetTelemetry: resetTelemetry,
            onDownloadSaveJson: downloadSaveJson,
            onTriggerSaveImport: triggerSaveImport,
            onResetMainSave: resetMainSaveNow,
            onSaveDebugNow: saveDebugNow,
            onRestoreAutoSaveNow: restoreAutoSaveNow,
            onRestoreLatestDebugNow: restoreLatestDebugNow,
            onDownloadAutoSaveJson: downloadAutoSaveJson,
            onDownloadDebugSavesJson: downloadDebugSavesJson,
            onDownloadCorruptBackupJson: downloadCorruptBackupJson,
            onClearAutoSaveNow: clearAutoSaveNow,
            onClearDebugSavesNow: clearDebugSavesNow,
            onImportSaveFile,
            onRestoreDebugById: restoreDebugById,
          }}
          garagePanelProps={{
            visible: state.gamePhase === 'garage',
            state,
            moeAsset,
            garageImage,
            selectedStageProfile,
            selectedStageAdvisory,
            stageProfiles,
            nextRunPreview,
            showGarageLaunchConfirm,
            showRunHistory,
            saveSnapshot,
            latestRunRecord,
            latest3Runs,
            routeLogEntries,
            moeMemoryEntries,
            canUpdateDriverSkill,
            canUpdateMoeSkill,
            canUpdateVehicleTune,
            autoplayRuns,
            autoplayStrategy,
            autoplayReport,
            autoplayMinRuns: balanceConfig.autoplay.minRuns,
            autoplayMaxRuns: balanceConfig.autoplay.maxRuns,
            onSetShowRunHistory: setShowRunHistory,
            onGarageEnterNightLoop,
            onGarageLaunchConfirm,
            onGarageLaunchCancel,
            onSetStage: (stage) => dispatch({ type: 'GARAGE_SET_STAGE', stage }),
            onSetMainGun: (id) => dispatch({ type: 'GARAGE_SET_MAIN_GUN', id }),
            onSetSubGun: (id) => dispatch({ type: 'GARAGE_SET_SUB_GUN', id }),
            onSetSpecial: (id) => dispatch({ type: 'GARAGE_SET_SPECIAL', id }),
            onSetSupport: (id) => dispatch({ type: 'GARAGE_SET_SUPPORT', id }),
            onPurchaseSkill: (upgrade) => dispatch({ type: 'PURCHASE_SKILL', upgrade }),
            onPurchaseVehicleUpgrade: (id) => dispatch({ type: 'PURCHASE_VEHICLE_UPGRADE', id }),
            onPurchaseUnlock: (id) => dispatch({ type: 'PURCHASE_UNLOCK', id }),
            onSetAutoplayRuns: setAutoplayRuns,
            onSetAutoplayStrategy: setAutoplayStrategy,
            onRunAutoplay: runAutoplay,
            onStartFunTest: (id) => dispatch({ type: 'START_FUN_TEST', id }),
          }}
          eventPanelsProps={{
            state,
            runGrowth,
          }}
        />
      </main>
    </div>
  </div>;
}
