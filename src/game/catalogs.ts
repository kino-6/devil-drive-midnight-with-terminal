import type {
  AffinityType,
  CommandId,
  ContractId,
  ContractModule,
  ContractSupport,
  ContractSupportId,
  EncounterId,
  MainGun,
  MainGunId,
  RewardOption,
  SkillLevels,
  SpecialEquipment,
  SpecialEquipmentId,
  StoryLogEntry,
  StoryLogId,
  SubGun,
  SubGunId,
  VehicleUpgradeLevels,
  UpgradeId,
  VehicleUpgradeId,
} from './types';

export const contractModules: Record<ContractId, ContractModule> = {
  radio_voice: { id: 'radio_voice', name: 'Radio Voice', effect: 'AM 666.0 link gain / Talk synergy' },
  silent_shape: { id: 'silent_shape', name: 'Silent Shape', effect: 'Guard posture stability' },
  abandoned_ai_navi: { id: 'abandoned_ai_navi', name: 'Abandoned AI Navi', effect: 'NAVI forecast +2 turn (unstable)' },
};

export const contractLabels: Record<ContractId, string> = {
  radio_voice: 'AM 666.0',
  silent_shape: 'SILENT',
  abandoned_ai_navi: 'AI NAVI',
};

export const defaultLoadout = {
  mainGunId: 'light_cannon',
  subGunId: 'hood_mg',
  specialEquipmentId: 'signal_harpoon',
  contractSupportId: 'none',
} as const;

export const mainGunCatalog: Record<MainGunId, MainGun> = {
  rusted_cannon: { id: 'rusted_cannon', name: 'Rusted Cannon', damage: 4, ammo: 8, description: '標準的な主砲。単体に安定した大ダメージ。' },
  light_cannon: { id: 'light_cannon', name: 'Light Cannon', damage: 3, ammo: 12, description: '火力は低いが弾数が多い。長期戦向き。' },
  needle_cannon: { id: 'needle_cannon', name: 'Needle Cannon', damage: 2, ammo: 16, effect: 'intel', description: '低火力・多弾数の解析主砲。命中時のIntel蓄積が高い。' },
  heavy_cannon: { id: 'heavy_cannon', name: 'Heavy Cannon', damage: 6, ammo: 5, description: '高火力だが弾数が少ない。Boss向き。' },
  siege_cannon: { id: 'siege_cannon', name: 'Siege Cannon', damage: 8, ammo: 3, description: '超高火力・低弾数。短期決着用の重量主砲。' },
  burst_cannon: { id: 'burst_cannon', name: 'Burst Cannon', damage: 5, ammo: 9, description: '中火力・中弾数の連射主砲。汎用性が高い。' },
  rail_cannon: { id: 'rail_cannon', name: 'Rail Cannon', damage: 7, ammo: 4, description: '貫通重視の高精度主砲。決定打向き。' },
  sigil_driver: { id: 'sigil_driver', name: 'Sigil Driver', damage: 3, ammo: 7, effect: 'contract', description: '契約紋を撃ち込む特殊主砲。解析済み対象の契約窓を作りやすい。' },
};

export const subGunCatalog: Record<SubGunId, SubGun> = {
  hood_mg: { id: 'hood_mg', name: 'Hood MG', damage: 1, mode: 'all', description: '全体に小ダメージ。標準的な副砲。' },
  twin_mg: { id: 'twin_mg', name: 'Twin MG', damage: 1, mode: 'random_hits', hits: 2, description: 'ランダム対象に2回攻撃。少数戦向き。' },
  intent_jammer: { id: 'intent_jammer', name: 'Intent Jammer', damage: 1, mode: 'all', softenChance: 0.65, description: '攻撃Intentを鈍らせる妨害副砲。被害軽減重視。' },
  suppression_mg: { id: 'suppression_mg', name: 'Suppression MG', damage: 1, mode: 'all', softenChance: 0.4, description: '牽制射撃。被害を抑えたい時に使う。' },
  road_sweeper: { id: 'road_sweeper', name: 'Road Sweeper', damage: 2, mode: 'all', description: '全体へ中威力散弾。契約より突破向き。' },
  crowd_mg: { id: 'crowd_mg', name: 'Crowd MG', damage: 1, mode: 'random_hits', hits: 4, description: '複数敵に手数をばら撒く副砲。群れ相手の削り向き。' },
  counter_pod: { id: 'counter_pod', name: 'Counter Pod', damage: 2, mode: 'random_hits', hits: 3, description: '迎撃ポッド射出。手数で崩す。' },
  mercy_pod: { id: 'mercy_pod', name: 'Mercy Pod', damage: 0, mode: 'random_hits', hits: 2, pressureMode: 'cool', description: '圧を抜いて会話へ戻す非殺傷ポッド。Talk再挑戦向き。' },
};

export const specialEquipmentCatalog: Record<SpecialEquipmentId, SpecialEquipment> = {
  signal_harpoon: { id: 'signal_harpoon', name: 'Signal Harpoon', damage: 2, seAmmoCost: 1, ammo: 4, effect: 'interest', description: '契約を狙うための特殊兵装。' },
  scan_beacon: { id: 'scan_beacon', name: 'Scan Beacon', damage: 0, seAmmoCost: 1, ammo: 4, effect: 'analyze_lock', description: '敵シグネチャを照射し、Analyze蓄積と脆弱化を補助する。' },
  micro_missile: { id: 'micro_missile', name: 'Micro Missile', damage: 3, seAmmoCost: 1, ammo: 3, effect: 'all_damage', description: '全体攻撃。契約より撃破向き。' },
  emp_flare: { id: 'emp_flare', name: 'EMP Flare', damage: 1, seAmmoCost: 1, ammo: 4, effect: 'emp', description: '機械霊対策。AI系の行動を鈍らせる。' },
  binding_flare: { id: 'binding_flare', name: 'Binding Flare', damage: 1, seAmmoCost: 1, ammo: 3, effect: 'contract_window', description: '契約窓を押し開く拘束信号。低ダメージの交渉補助S-E。' },
  jammer_pulse: { id: 'jammer_pulse', name: 'Jammer Pulse', damage: 2, seAmmoCost: 1, ammo: 5, effect: 'emp', description: '妨害寄りS-E。命中時に意図阻害しやすい。' },
  decoy_beacon: { id: 'decoy_beacon', name: 'Decoy Beacon', damage: 1, seAmmoCost: 1, ammo: 6, effect: 'interest', description: '疑似信号で注意を逸らし、交渉窓を作る。' },
  saint_anchor: { id: 'saint_anchor', name: 'Saint Anchor', damage: 2, seAmmoCost: 2, ammo: 2, effect: 'boss_breaker', description: 'Boss級信号に強い固定杭。通常敵には重いが、関門級に刺さる。' },
};

export const garageMainGunOrder: MainGunId[] = ['light_cannon', 'needle_cannon', 'heavy_cannon', 'siege_cannon', 'burst_cannon', 'rail_cannon', 'sigil_driver', 'rusted_cannon'];
export const garageSubGunOrder: SubGunId[] = ['hood_mg', 'twin_mg', 'intent_jammer', 'suppression_mg', 'road_sweeper', 'crowd_mg', 'counter_pod', 'mercy_pod'];
export const garageSEOrder: SpecialEquipmentId[] = ['signal_harpoon', 'scan_beacon', 'micro_missile', 'emp_flare', 'binding_flare', 'jammer_pulse', 'decoy_beacon', 'saint_anchor'];
export const garageSupportOrder: ContractSupportId[] = ['none', 'radio_voice', 'silent_shape', 'abandoned_ai_navi'];

export const contractSupportCatalog: Record<ContractSupportId, ContractSupport> = {
  none: { id: 'none', name: 'None', description: '追加サポートなし。M.O.E.は標準機能として常時稼働。' },
  radio_voice: { id: 'radio_voice', name: 'Radio Voice', description: 'Talk成功率 +5% / Signal Lane強化 / AM 666.0ノイズ' },
  silent_shape: { id: 'silent_shape', name: 'Silent Shape', description: '各Encounter最初のArmorダメージ-1 / 20%で開始時Fuel-1' },
  abandoned_ai_navi: { id: 'abandoned_ai_navi', name: 'Abandoned AI Navi', description: 'NAVI Forecast +1 turn / 20%で誤予測' },
};

export const commandOptions: { id: CommandId; label: string; tone: 'danger' | 'contract' | 'route' | 'system'; group: 'WEAPON' | 'TERMINAL' | 'DRIVE' }[] = [
  { id: 'main_gun', label: 'Main Cannon', tone: 'danger', group: 'WEAPON' },
  { id: 'sub_gun', label: 'Sub Cannon', tone: 'danger', group: 'WEAPON' },
  { id: 'se_harpoon', label: 'S-E', tone: 'contract', group: 'WEAPON' },
  { id: 'analyze', label: 'Analyze', tone: 'system', group: 'TERMINAL' },
  { id: 'talk', label: 'Talk', tone: 'route', group: 'TERMINAL' },
  { id: 'contract', label: 'Contract', tone: 'contract', group: 'TERMINAL' },
  { id: 'ram', label: 'Ram', tone: 'danger', group: 'DRIVE' },
  { id: 'guard', label: 'Guard', tone: 'system', group: 'DRIVE' },
  { id: 'escape', label: 'Escape', tone: 'route', group: 'DRIVE' },
];

export const commandDescriptions: Record<CommandId, { description: string }> = {
  main_gun: { description: '選択中のMain Gunで高火力単体攻撃。' },
  sub_gun: { description: '選択中のSub Gunで牽制射撃。' },
  se_harpoon: { description: '選択中S-Eを発動。S-E Ammoを消費。' },
  analyze: { description: 'Signal-1で敵情報を開示。' },
  talk: { description: '気質に応じて trust / interest / pressure を変化。' },
  contract: { description: '契約窓が開いた対象へ契約を試行。' },
  ram: { description: '体当たり3ダメージ。Armor-1。' },
  guard: { description: '次の被弾を軽減。' },
  escape: { description: 'Fuel-1で70%離脱。' },
};

export const affinityOrder: AffinityType[] = ['ballistic', 'suppressive', 'impact', 'signal', 'talk'];
export const affinityLabel: Record<AffinityType, string> = {
  ballistic: 'Ballistic',
  suppressive: 'Suppressive',
  impact: 'Impact',
  signal: 'Signal',
  talk: 'Talk',
};
export const commandAffinityMap: Partial<Record<CommandId, AffinityType>> = {
  main_gun: 'ballistic',
  sub_gun: 'suppressive',
  ram: 'impact',
  se_harpoon: 'signal',
  talk: 'talk',
};

export const demonArchiveFlavor: Partial<Record<EncounterId, string>> = {
  pixie_shibuya_glow: 'Tiny city-light fairy that plays with lane signals.',
  roadside_phone: 'Ringing public line with an impossible child voice.',
  silent_shape: 'A black mass that swallows engine noise.',
  abandoned_ai_navi: 'Cracked guidance unit with haunted pathing.',
  tunnel_rider: 'A phantom bike weaving through lanes that should not exist.',
  closure_ogre: 'Ramp-closure brute forged from barricades and warning lights.',
  tow_collector: 'Haunted tow rig collecting unpaid midnight tolls.',
  ghost_chaser: 'Siren-lit pursuit spirit that keeps impossible lock-on.',
  vending_spirit: 'Neon can-machine entity bargaining with route favors.',
  phantom_patrol: 'Ghost patrol unit scanning forbidden exits.',
  midnight_taxi: 'An empty cab offering one-way fares at 00:00.',
  cone_swarm: 'Warning cones moving in synchronized lane blockade patterns.',
  mirror_curve: 'A blind bend reflecting the route you refused to take.',
  fuel_tanker_saint: 'A fuel-hauling saint leaking blessings and pressure.',
  hearse_meridian: 'A black hearse cruising the centerline between exits.',
  jackknife_trailer: 'A folded trailer blocking three futures at once.',
  kuchisake_onna: 'A slit-smile passenger testing the talk channel.',
  siren_ambulance: 'An emergency vehicle answering accidents before they happen.',
  siren_ambulance_v2: 'A corrupted rescue protocol wrapped in red siren light.',
};

export const rewardCatalog: RewardOption[] = [
  { id: 'fuel_cell', label: 'Fuel Cell XL', detail: 'Fuel +4', fuel: 4 },
  { id: 'armor_patch', label: 'Armor Patch Mk2', detail: 'Armor +4', armor: 4 },
  { id: 'signal_core', label: 'Signal Core', detail: 'Signal +2', signal: 2 },
  { id: 'cannon_shell', label: 'Cannon Crate', detail: 'Main Ammo +3', mainAmmo: 3 },
  { id: 'se_cell', label: 'S-E Capacitor', detail: 'S-E Ammo +2', seAmmo: 2 },
  { id: 'mixed_pack', label: 'Field Cache', detail: 'Fuel +2 / Armor +2', fuel: 2, armor: 2 },
];

export const emergencyRewardCatalog: RewardOption[] = [
  { id: 'fuel_kit', label: 'Emergency Fuel', detail: 'Fuel +3', fuel: 3 },
  { id: 'armor_kit', label: 'Emergency Armor', detail: 'Armor +3', armor: 3 },
  { id: 'ammo_kit', label: 'Emergency Shell', detail: 'Main Ammo +2', mainAmmo: 2 },
  { id: 'se_kit', label: 'Emergency S-E Cell', detail: 'S-E Ammo +2', seAmmo: 2 },
  { id: 'signal_kit', label: 'Emergency Signal Core', detail: 'Signal +2', signal: 2 },
];

export const storyLogCatalog: StoryLogEntry[] = [
  { id: 'LOG_00', title: 'Previous Driver', text: 'M.O.E., if you hear this, do not trust the toll gate.' },
  { id: 'LOG_01', title: 'Toll', text: 'The toll is not fuel, not a name. It is the will to return.' },
  { id: 'LOG_02', title: 'AM 666.0', text: 'AM 666.0 does not broadcast the future. It broadcasts the roads we did not choose.' },
  { id: 'LOG_03', title: 'Pixie', text: 'Small light always knew a path first. It was not always the right one.' },
  { id: 'LOG_04', title: 'M.O.E.', text: 'I am registered as a navigation AI. Then who recorded this voice?' },
];

export const storyLogById: Record<StoryLogId, StoryLogEntry> = Object.fromEntries(
  storyLogCatalog.map((entry) => [entry.id, entry]),
) as Record<StoryLogId, StoryLogEntry>;

export const defaultSkillLevels: SkillLevels = {
  ram_control: 0,
  gunnery: 0,
  scan_boost: 0,
  translation_assist: 0,
  signal_tuning: 0,
};

export const defaultVehicleUpgrades: VehicleUpgradeLevels = {
  fuel_tank: 0,
  armor_plating: 0,
  ammo_rack: 0,
  se_rack: 0,
  signal_antenna: 0,
  noise_filter: 0,
  daemon_bus: 0,
};

export const skillLabels: Record<UpgradeId, string> = {
  ram_control: 'Driver: Ram Control',
  gunnery: 'Driver: Gunnery',
  scan_boost: 'M.O.E.: Scan Boost',
  translation_assist: 'M.O.E.: Translation Assist',
  signal_tuning: 'M.O.E.: Signal Tuning',
};

export const vehicleUpgradeLabels: Record<VehicleUpgradeId, string> = {
  fuel_tank: 'Fuel Tank',
  armor_plating: 'Armor Plating',
  ammo_rack: 'Main Ammo Rack',
  se_rack: 'S-E Rack',
  signal_antenna: 'Signal Antenna',
  noise_filter: 'Noise Filter',
  daemon_bus: 'Daemon Bus',
};

export const routeIntelCatalog: Record<'salvage' | 'signal' | 'push_forward' | 'return_gate', {
  label: string;
  subtitle: string;
  likelyEnemyTags: string;
  likelyWeaknesses: string;
  riskTags: string;
  rewardTags: string;
}> = {
  salvage: {
    label: 'SCRAP YARD PA',
    subtitle: 'Repair / salvage zone',
    likelyEnemyTags: 'machine spirit',
    likelyWeaknesses: 'Signal / Impact',
    riskTags: 'armor wear',
    rewardTags: 'fuel / armor / ammo cache',
  },
  signal: {
    label: 'SIGNAL TUNNEL',
    subtitle: 'AM 666.0 bleed channel',
    likelyEnemyTags: 'urban legend / radio ghost',
    likelyWeaknesses: 'Talk / Signal',
    riskTags: 'signal drain',
    rewardTags: 'signal core / memory trace',
  },
  push_forward: {
    label: 'DEEP TOLL ROUTE',
    subtitle: 'High speed commit lane',
    likelyEnemyTags: 'road entity',
    likelyWeaknesses: 'Ballistic / Signal',
    riskTags: 'high armor damage',
    rewardTags: 'enhanced salvage pick',
  },
  return_gate: {
    label: 'RETURN GATE',
    subtitle: 'Safe extraction path',
    likelyEnemyTags: 'low contact',
    likelyWeaknesses: 'N/A',
    riskTags: 'low reward',
    rewardTags: 'secure run completion',
  },
};

export const routeLogCatalog: Record<'salvage' | 'signal' | 'push_forward' | 'return_gate' | 'boss', { name: string; note: string }> = {
  salvage: {
    name: 'Scrap Yard PA',
    note: 'Useful for repairs and salvage, but tends to cost armor.',
  },
  signal: {
    name: 'Signal Tunnel',
    note: 'Good for Analyze and M.O.E. memory traces.',
  },
  push_forward: {
    name: 'Deep Toll Route',
    note: 'Moves closer to the boss signal.',
  },
  return_gate: {
    name: 'Return Gate',
    note: 'Ends the run safely before the Night Loop closes.',
  },
  boss: {
    name: 'Deep Signal',
    note: 'Boss-class signal. Requires fuel, armor, and resolve.',
  },
};

export const bossIntel = {
  likelyEnemyTags: 'road entity / boss',
  likelyWeaknesses: 'Ballistic / Signal',
  riskTags: 'high armor + fuel pressure',
  rewardTags: 'major salvage / contract trace',
};

export const routeScenarioIdMap: Partial<Record<'salvage' | 'signal' | 'push_forward' | 'return_gate', string>> = {
  signal: 'signal_tunnel_01',
};
