import { getBalanceConfig } from '../balanceConfig';
import { getDevilConfig } from '../devilConfig';
import type {
  ApproachKind,
  ContractModule,
  ContractSupportId,
  Devil,
  EncounterId,
  EncounterState,
  ForecastMap,
  Intent,
  Loadout,
  VehicleUpgradeLevels,
} from './types';
import { defaultVehicleUpgrades, mainGunCatalog, specialEquipmentCatalog } from './catalogs';
import { assignTalkPersona } from './talkRules';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const isAlive = (d: Devil) => d.hp > 0 && !d.exit;
const devilTemplates = () => getDevilConfig().devilTemplates;
const hasAiNaviContract = (contracts: ContractModule[]) => contracts.some((module) => module.id === 'abandoned_ai_navi');

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

export const getScanChance = (
  state: { selectedLoadout: Loadout; signal: number; skillLevels: { scan_boost: number } },
  kind: ApproachKind,
  lineup: EncounterId[],
): number => {
  const scan = getBalanceConfig().scan;
  let chance = scan.baseChance;
  if (state.selectedLoadout.contractSupportId === 'abandoned_ai_navi') chance += scan.aiSupportBonus;
  if (state.signal >= scan.highSignalThreshold) chance += scan.highSignalBonus;
  if (kind === 'boss') chance -= scan.bossPenalty;
  if (lineup.includes('silent_shape')) chance -= scan.stealthPenalty;
  chance += state.skillLevels.scan_boost * scan.scanBoostPerLevel;
  return clamp(chance, 15, 95);
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
    talkPersona: assignTalkPersona(t.profile, `${kind}-${index}`, stage),
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

const getMainGunAmmo = (id: Loadout['mainGunId']) => {
  const base = mainGunCatalog[id];
  const tuned = getBalanceConfig().weapons.mainGun[id];
  return tuned?.ammo ?? base.ammo;
};

const getSpecialEquipmentAmmo = (id: Loadout['specialEquipmentId']) => {
  const base = specialEquipmentCatalog[id];
  const tuned = getBalanceConfig().weapons.specialEquipment[id];
  return tuned?.ammo ?? base.ammo;
};

export const getRunStartResources = (
  loadout: Loadout,
  vehicleUpgrades: VehicleUpgradeLevels = defaultVehicleUpgrades,
) => {
  const mainAmmo = getMainGunAmmo(loadout.mainGunId) + vehicleUpgrades.ammo_rack;
  const seAmmo = getSpecialEquipmentAmmo(loadout.specialEquipmentId) + vehicleUpgrades.se_rack;
  return {
    fuel: getBalanceConfig().resources.baseFuel + vehicleUpgrades.fuel_tank,
    armor: getBalanceConfig().resources.baseArmor + vehicleUpgrades.armor_plating,
    signal: getBalanceConfig().resources.baseSignal,
    mainAmmo,
    maxMainAmmo: mainAmmo,
    seAmmo,
    maxSeAmmo: seAmmo,
  };
};
