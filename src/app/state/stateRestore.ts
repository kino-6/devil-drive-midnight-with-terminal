import { contractModules, defaultSkillLevels, garageMainGunOrder, garageSEOrder, garageSubGunOrder } from '../../game/catalogs';
import { isEncounterId } from '../../game/encounterIds';
import { normalizeUnlockState, sanitizeLoadoutForUnlocks } from '../../game/progression';
import { limitStateLogs } from '../../runtimeLimits';
import { getStageConfig, isStageConfigRuntimeLoaded } from '../../stageConfig';
import {
  asNum,
  asRec,
  asStr,
  encounterProfiles,
  supportDaemonEffectLabels,
} from '../../game/runtimeHelpers';
import type {
  ActiveSupportDaemon,
  CommandId,
  ContractModule,
  ContractSupportId,
  EncounterId,
  GamePhase,
  Loadout,
  MainGunId,
  ResultType,
  RouteState,
  SpecialEquipmentId,
  State,
  SubGunId,
  Temperament,
} from '../../game/types';

export type RestoreDeps = {
  initState: () => State;
  buildEncounter: (kind: 'enc1' | 'enc2' | 'boss', contracts: ContractModule[], supportId: ContractSupportId, activeSupportProfile: EncounterId | undefined, extraForecast?: number, stage?: number, lineupOverride?: EncounterId[]) => State['encounter'];
};

export const sanitizeRestoredStateWithDeps = (raw: unknown, fallback: State, deps: RestoreDeps): State => {
  const source = asRec(raw);
  if (!Object.keys(source).length) return fallback;
  const base = deps.initState();

  const normalizeMainGun = (id: unknown): MainGunId =>
    garageMainGunOrder.includes(id as MainGunId)
      ? id as MainGunId
      : fallback.selectedLoadout.mainGunId;
  const normalizeSubGun = (id: unknown): SubGunId =>
    garageSubGunOrder.includes(id as SubGunId)
      ? id as SubGunId
      : fallback.selectedLoadout.subGunId;
  const normalizeSE = (id: unknown): SpecialEquipmentId =>
    garageSEOrder.includes(id as SpecialEquipmentId)
      ? id as SpecialEquipmentId
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
    isEncounterId(value) ? value : undefined;
  const normalizeTemperament = (value: unknown): Temperament =>
    value === 'hungry' || value === 'proud' || value === 'lonely' || value === 'machine' || value === 'hostile' || value === 'curious'
      ? value
      : 'curious';

  const unlocks = normalizeUnlockState(source.unlocks, fallback.unlocks);
  const skillLevelsRaw = asRec(source.skillLevels);
  const skillLevels = Object.fromEntries(
    Object.entries(defaultSkillLevels).map(([skillId, fallbackLevel]) => [
      skillId,
      Math.max(0, asNum(skillLevelsRaw[skillId], fallback.skillLevels[skillId as keyof typeof defaultSkillLevels] ?? fallbackLevel)),
    ]),
  ) as State['skillLevels'];
  const selectedLoadoutRaw = asRec(source.selectedLoadout);
  const selectedLoadout: Loadout = sanitizeLoadoutForUnlocks({
    mainGunId: normalizeMainGun(selectedLoadoutRaw.mainGunId),
    subGunId: normalizeSubGun(selectedLoadoutRaw.subGunId),
    specialEquipmentId: normalizeSE(selectedLoadoutRaw.specialEquipmentId),
    contractSupportId: normalizeSupport(selectedLoadoutRaw.contractSupportId),
  }, unlocks);
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
  const normalizeRouteState = (value: unknown): RouteState | undefined => {
    const raw = asRec(value);
    const stageRouteId = asStr(raw.stageRouteId, '');
    const currentNodeId = asStr(raw.currentNodeId, '');
    if (!stageRouteId || !currentNodeId) return fallback.routeState;
    const route = isStageConfigRuntimeLoaded() ? getStageConfig().stages[stageRouteId] : undefined;
    if (isStageConfigRuntimeLoaded() && !route?.nodes[currentNodeId]) return fallback.routeState;
    const visitedNodeIds = Array.isArray(raw.visitedNodeIds)
      ? raw.visitedNodeIds.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : fallback.routeState?.visitedNodeIds ?? [];
    const validVisitedNodeIds = route
      ? visitedNodeIds.filter((nodeId) => !!route.nodes[nodeId])
      : visitedNodeIds;
    const rawCheckpointId = asStr(raw.lastReturnCheckpointId, '');
    const lastReturnCheckpointId = rawCheckpointId && (!route || route.nodes[rawCheckpointId])
      ? rawCheckpointId
      : undefined;
    const rawReturnIntent = asStr(raw.returnIntent, 'none');
    return {
      stageRouteId,
      currentNodeId,
      visitedNodeIds: validVisitedNodeIds.length > 0 ? validVisitedNodeIds : [currentNodeId],
      currentEventId: asStr(raw.currentEventId, undefined as unknown as string) || undefined,
      lastReturnCheckpointId,
      returnIntent: rawReturnIntent === 'backtracking' || rawReturnIntent === 'extracting' ? rawReturnIntent : 'none',
    };
  };

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
      ? limitStateLogs(source.logs.filter((line): line is string => typeof line === 'string'))
      : fallback.logs,
    selectedLoadout,
    skillLevels,
    unlocks,
    routeState: normalizeRouteState(source.routeState),
    activeSupportDaemon,
    activeConversation: undefined,
    negotiationRewards: Array.isArray(source.negotiationRewards)
      ? source.negotiationRewards.filter((entry): entry is string => typeof entry === 'string').slice(0, 16)
      : fallback.negotiationRewards,
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
  const fallbackEncounter = deps.buildEncounter('enc1', restored.contracts, restored.selectedLoadout.contractSupportId, restored.activeSupportDaemon?.profile, 0, restored.stage);
  restored.encounter = {
    ...fallbackEncounter,
    ...fallback.encounter,
    turn: Math.max(1, asNum(encounterRaw.turn, fallback.encounter.turn)),
    selectedEnemyId: asStr(encounterRaw.selectedEnemyId, fallback.encounter.selectedEnemyId),
    selectedCommand: normalizeCommand(encounterRaw.selectedCommand),
    guardActive: typeof encounterRaw.guardActive === 'boolean' ? encounterRaw.guardActive : fallback.encounter.guardActive,
    phase: encounterRaw.phase === 'command' || encounterRaw.phase === 'conversation' || encounterRaw.phase === 'resolving' || encounterRaw.phase === 'finished'
      ? encounterRaw.phase
      : fallback.encounter.phase,
  };
  restored.encounterPrep = {
    ...fallback.encounterPrep,
    ...asRec(source.encounterPrep),
    firstStrike: !!asRec(source.encounterPrep).firstStrike,
    firstStrikeDamage: (() => {
      const value = asNum(asRec(source.encounterPrep).firstStrikeDamage, Number.NaN);
      return Number.isFinite(value) && value > 0 ? value : undefined;
    })(),
    ambushed: !!asRec(source.encounterPrep).ambushed,
    talkPrepared: !!asRec(source.encounterPrep).talkPrepared,
    intentDisrupted: !!asRec(source.encounterPrep).intentDisrupted,
    firstTalkBonus: asNum(asRec(source.encounterPrep).firstTalkBonus, fallback.encounterPrep.firstTalkBonus),
    firstTalkPending: !!asRec(source.encounterPrep).firstTalkPending,
  };

  return restored;
};
