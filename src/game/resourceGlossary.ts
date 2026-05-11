export const resourceDescriptions = {
  fuel: '進路移動、Escape、撤退リスクで消費。0になると走行不能。',
  armor: '車体耐久。敵Attack、Ram、交渉失敗で減る。0になると走行不能。',
  signal: 'Analyze、Talk支払い、Scan成功率、進路予測、Curse耐性に影響。M.O.E. Signal Tuningで最大値とSignal Lane回復量が伸びる。',
  mainAmmo: 'Main Cannonと先制主砲で消費。単体撃破の主力弾。',
  seAmmo: 'S-E兵装で消費。解析補助、妨害、契約窓、Boss対策に使う。',
} as const;

export type ResourceDescriptionKey = keyof typeof resourceDescriptions;

export const getResourceDescription = (
  key: ResourceDescriptionKey,
  value: number,
  max: number,
) => {
  const base = resourceDescriptions[key];
  const safeMax = Math.max(1, max);
  const ratio = value / safeMax;
  if (key === 'signal') {
    if (value <= 0) return `${base} 現在: SIGNAL LOST。進路報酬、Analyze/Talk、Scanが不安定。`;
    if (ratio <= 0.35) return `${base} 現在: SIGNAL LOW。Route予測が薄くなり、交渉支払いも重い。`;
    return `${base} 現在: FORECAST STABLE。進路と解析の精度を維持。`;
  }
  if (key === 'fuel' && ratio <= 0.35) return `${base} 現在: FUEL LOW。帰還や分岐継続の余裕が少ない。`;
  if (key === 'armor' && ratio <= 0.35) return `${base} 現在: ARMOR LOW。BacktrackかGuardを検討。`;
  if (key === 'mainAmmo' && ratio <= 0.35) return `${base} 現在: AMMO LOW。Sub/S-E/Talkも選択肢。`;
  if (key === 'seAmmo' && ratio <= 0.35) return `${base} 現在: S-E LOW。Boss前に補給したい。`;
  return base;
};
