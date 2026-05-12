import { rewardCatalog } from '../../game/catalogs';
import { getMoeLine } from '../../game/moeDialogue';
import type { Devil, EncounterId, EncounterState, FunTestId, Loadout, State } from '../../game/types';
import { buildDevil, buildForecast, createEmptyEncounterPrep, pickRewardChoices } from './stateRuntime';

type FunTestSpec = {
  id: FunTestId;
  label: string;
  target: string;
  description: string;
  phase: 'encounter' | 'boss_encounter';
  kind: EncounterState['kind'];
  enemyProfile: EncounterId;
  resources: {
    fuel: number;
    armor: number;
    signal: number;
    mainAmmo: number;
    seAmmo: number;
  };
  loadout: Loadout;
  selectedCommand: EncounterState['selectedCommand'];
  intent?: Devil['intent'];
  enemySetup?: (enemy: Devil) => Devil;
  logs: string[];
  moeLine: string;
};

export const funTestSpecs: Record<FunTestId, FunTestSpec> = {
  pixie_talk: {
    id: 'pixie_talk',
    label: 'Test Pixie Talk',
    target: 'Pixie',
    description: 'Talk / Contract reward check',
    phase: 'encounter',
    kind: 'enc1',
    enemyProfile: 'pixie_shibuya_glow',
    resources: { fuel: 8, armor: 12, signal: 6, mainAmmo: 5, seAmmo: 5 },
    loadout: {
      mainGunId: 'sigil_driver',
      subGunId: 'mercy_pod',
      specialEquipmentId: 'binding_flare',
      contractSupportId: 'radio_voice',
    },
    selectedCommand: 'talk',
    intent: 'bargain',
    enemySetup: (enemy) => ({
      ...enemy,
      trust: 2,
      interest: 2,
      contractWindow: true,
    }),
    logs: [
      '> FUN TEST MODE: PIXIE TALK',
      '> TARGET LOCK: PIXIE / ANALYZED',
      '> CONTRACT WINDOW OPEN',
    ],
    moeLine: getMoeLine('moe.dynamic.battle.idle', 'この子は撃つより話した方が早いかも。たぶん、信号の光が好き。', undefined, 'soft'),
  },
  road_reaper_combat: {
    id: 'road_reaper_combat',
    label: 'Test Road Reaper Combat',
    target: 'Road Reaper',
    description: 'Ballistic Weak / vehicle combat check',
    phase: 'encounter',
    kind: 'enc2',
    enemyProfile: 'road_reaper',
    resources: { fuel: 8, armor: 12, signal: 4, mainAmmo: 8, seAmmo: 3 },
    loadout: {
      mainGunId: 'light_cannon',
      subGunId: 'suppression_mg',
      specialEquipmentId: 'jammer_pulse',
      contractSupportId: 'none',
    },
    selectedCommand: 'main_gun',
    intent: 'attack',
    logs: [
      '> FUN TEST MODE: ROAD REAPER COMBAT',
      '> TARGET LOCK: ROAD REAPER / ANALYZED',
      '> WEAKNESS VISIBLE: BALLISTIC WEAK / TALK RESIST',
    ],
    moeLine: getMoeLine('moe.dynamic.battle.idle', 'こいつは会話が通りにくい。主砲で標識ごと止めた方が早いかも。', undefined, 'serious'),
  },
  toll_gate_boss: {
    id: 'toll_gate_boss',
    label: 'Test Toll Gate Boss',
    target: 'Toll Gate Saint',
    description: 'Fuel / Signal / Main / Contract route check',
    phase: 'boss_encounter',
    kind: 'boss',
    enemyProfile: 'toll_gate_saint',
    resources: { fuel: 6, armor: 14, signal: 6, mainAmmo: 6, seAmmo: 4 },
    loadout: {
      mainGunId: 'heavy_cannon',
      subGunId: 'mercy_pod',
      specialEquipmentId: 'signal_harpoon',
      contractSupportId: 'radio_voice',
    },
    selectedCommand: 'talk',
    intent: 'bargain',
    enemySetup: (enemy) => ({
      ...enemy,
      trust: 1,
      interest: 1,
    }),
    logs: [
      '> FUN TEST MODE: TOLL GATE BOSS',
      '> BOSS PREVIEW: TOLL GATE SAINT',
      '> SOLUTIONS: FUEL / SIGNAL / MAIN GUN / CONTRACT',
    ],
    moeLine: getMoeLine('moe.run.boss_preview', '料金所型の強い反応。主砲かSignal、どっちかは残しておきたいね。', undefined, 'serious'),
  },
};

const makeAnalyzedEnemy = (profile: EncounterId, setup: FunTestSpec['enemySetup'], intent?: Devil['intent']): Devil => {
  const enemy = buildDevil(profile, 0, 1);
  const analyzed: Devil = {
    ...enemy,
    revealed: true,
    affinityRevealed: true,
    intelProgress: enemy.intelThreshold,
    intent: intent ?? enemy.intent,
  };
  return setup ? setup(analyzed) : analyzed;
};

export const startFunTest = (state: State, id: FunTestId): State => {
  const spec = funTestSpecs[id];
  const enemy = makeAnalyzedEnemy(spec.enemyProfile, spec.enemySetup, spec.intent);
  const contracts: State['contracts'] = [];
  const forecast = buildForecast([enemy], false, spec.loadout.contractSupportId, undefined, 1);
  const encounter: EncounterState = {
    kind: spec.kind,
    enemies: [enemy],
    selectedEnemyId: enemy.id,
    selectedCommand: spec.selectedCommand,
    turn: 1,
    phase: 'command',
    guardActive: false,
    analyzedEnemyIds: [enemy.id],
    forecast: forecast.forecast,
    forecastUnstable: false,
    supportArmorGuardReady: false,
  };

  return {
    ...state,
    gamePhase: spec.phase,
    fuel: spec.resources.fuel,
    armor: spec.resources.armor,
    signal: spec.resources.signal,
    mainAmmo: spec.resources.mainAmmo,
    maxMainAmmo: spec.resources.mainAmmo,
    seAmmo: spec.resources.seAmmo,
    maxSeAmmo: spec.resources.seAmmo,
    contracts,
    salvageCredits: 0,
    encounterIndex: 0,
    encounter,
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
    bossChallenged: spec.phase === 'boss_encounter',
    selectedLoadout: spec.loadout,
    activeSupportDaemon: undefined,
    activeConversation: undefined,
    approach: undefined,
    encounterPrep: {
      ...createEmptyEncounterPrep(),
      talkPrepared: id === 'pixie_talk',
      firstTalkBonus: id === 'pixie_talk' ? 0.2 : 0,
      firstTalkPending: id === 'pixie_talk',
    },
    analyzeSuccessCount: 1,
    growthClaimed: true,
    funTestMode: {
      id: spec.id,
      label: spec.label,
      target: spec.target,
      description: spec.description,
      returnLoadout: state.selectedLoadout,
    },
    logs: ['> DEVIL TERMINAL: ONLINE', ...spec.logs],
    moeLine: spec.moeLine,
  };
};
