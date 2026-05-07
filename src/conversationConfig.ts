export type ConversationConfig = {
  version: string;
  lines: Record<string, string>;
};

const defaultConversationConfig: ConversationConfig = {
  version: 'builtin',
  lines: {
    'analyze.boon.damage_reduction.applied': '解析ロック成立。次の攻勢を1段鈍化できる。',
    'analyze.boon.damage_reduction.attack': 'ANALYZE LOCK: IMPACT -1',
    'analyze.boon.damage_reduction.curse': 'ANALYZE LOCK: CURSE -1',
    'talk.success.hungry': '交渉成立。飢えた反応が落ち着き、攻勢が鈍る。',
    'talk.success.lonely': '交渉成立。孤独反応が減衰、次行動が弱まる。',
    'talk.success.machine': '交渉成立。機械霊プロセスが低脅威モードへ遷移。',
    'talk.success.proud': '交渉成立。威圧は残るが、次の一手は緩む。',
    'talk.success.curious': '交渉成立。興味が勝って攻勢が鈍る。',
    'talk.success.hostile': '交渉成立。敵意は残るが、初動を崩せた。',
    'talk.success.default': '会話が通った。次の行動が一段弱くなる。',
    'talk.effect.intent_softened': 'TALK DISRUPTION: INTENT SOFTENED',
    'contract.boon.signal': 'CONTRACT BOON: SIGNAL +1',
    'contract.boon.armor': 'CONTRACT BOON: ARMOR +1',
    'contract.boon.fuel': 'CONTRACT BOON: FUEL +1',
    'contract.boon.forecast': 'CONTRACT BOON: FORECAST +1',
    'contract.boon.guard': 'CONTRACT BOON: NEXT IMPACT -1',
    'contract.success.default': '契約成立。短期恩恵を受領した。',
    'hint.analyze.short_term': 'Analyze成功で対象の次攻撃/呪詛被害が-1。',
    'hint.talk.short_term': 'Talk成功で対象の次Intentを低脅威化。',
    'hint.contract.short_term': 'Contract成立で即時boon獲得。',
    'moe.dynamic.battle.main_gun.weak': '{target}へ主砲射撃。刺さった。押し切れる。',
    'moe.dynamic.battle.main_gun.resist': '{target}へ主砲射撃。効きが薄い。別の手に切り替えよう。',
    'moe.dynamic.battle.main_gun.normal': '{target}へ主砲射撃。命中。警戒は上がってる。',
    'moe.dynamic.battle.se.interest.weak': '{target}へS-E発射。署名が浮いた。契約窓が開きやすい。',
    'moe.dynamic.battle.se.interest.resist': '{target}へS-E発射。信号が弾かれた。窓が閉じる。',
    'moe.dynamic.battle.se.interest.normal': '{target}へS-E発射。署名を掴んだ。会話が通じやすい。',
    'moe.dynamic.battle.se.emp': '{target}へEMPフレア。機械霊の挙動が鈍る。',
    'moe.dynamic.battle.analyze.success': '{target}の解析実行。断片が揃ってきた。もう一段で全体像が出る。',
    'moe.dynamic.battle.contract.no_window': '{target}へ契約試行。契約窓が未開放。TalkかS-Eを先に。',
    'moe.dynamic.battle.contract.condition_fail': '{target}へ契約失敗。条件不足。反動が来る。',
    'moe.dynamic.battle.contract.reject': '{target}へ契約失敗。拒否された。まだ早い。',
    'moe.dynamic.battle.ram.weak': '{target}へラムアタック。効いてる。押し切れる。',
    'moe.dynamic.battle.ram.resist': '{target}へラムアタック。固い。正面突破は不利。',
    'moe.dynamic.battle.ram.normal': '{target}へラムアタック。衝突確認。こちらの装甲も削れてる。',
  },
};

let runtimeConversationConfig: ConversationConfig = defaultConversationConfig;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const parseScalar = (raw: string): unknown => {
  const value = raw.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return null;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1);
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
};

const parseYamlLikeObject = (text: string): Record<string, unknown> => {
  const root: Record<string, unknown> = {};
  const stack: Array<{ indent: number; node: Record<string, unknown> }> = [{ indent: -1, node: root }];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  for (const sourceLine of lines) {
    if (!sourceLine.trim() || sourceLine.trimStart().startsWith('#')) continue;
    const indent = sourceLine.match(/^\s*/)?.[0].length ?? 0;
    const trimmed = sourceLine.trim();
    const idx = trimmed.indexOf(':');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const rest = trimmed.slice(idx + 1).trim();
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].node;
    if (!rest.length) {
      const next: Record<string, unknown> = {};
      parent[key] = next;
      stack.push({ indent, node: next });
    } else {
      parent[key] = parseScalar(rest);
    }
  }
  return root;
};

const parseCsvPaths = (value: unknown): string[] => {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const pickStringMap = (value: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(asRecord(value))) {
    if (typeof raw === 'string' && raw.trim().length > 0) out[key] = raw;
  }
  return out;
};

const parseYamlFromPath = async (path: string): Promise<Record<string, unknown> | undefined> => {
  try {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) return undefined;
    const text = await res.text();
    if (!text.trim()) return undefined;
    return parseYamlLikeObject(text);
  } catch (error) {
    console.warn('[conversationConfig] failed to load', path, error);
    return undefined;
  }
};

export const getConversationConfig = (): ConversationConfig => runtimeConversationConfig;

export const getConversationLine = (key: string, fallback: string): string =>
  runtimeConversationConfig.lines[key] ?? fallback;

export const getConversationLineWithVars = (
  key: string,
  vars: Record<string, string | number>,
  fallback?: string,
): string => {
  const base = runtimeConversationConfig.lines[key] ?? fallback ?? key;
  return base.replace(/\{([^}]+)\}/g, (match, token) => {
    const value = vars[token.trim()];
    return value === undefined ? match : String(value);
  });
};

export const loadConversationConfig = async (): Promise<ConversationConfig> => {
  const indexPaths = ['/conversations/index.yaml', '/conversations/index.yml'];
  for (const indexPath of indexPaths) {
    const indexRaw = await parseYamlFromPath(indexPath);
    if (!indexRaw) continue;

    const mergedLines: Record<string, string> = {};
    const includePaths = parseCsvPaths(indexRaw.includes);
    for (const includePath of includePaths) {
      const includeRaw = await parseYamlFromPath(includePath);
      if (!includeRaw) continue;
      Object.assign(mergedLines, pickStringMap(includeRaw.lines));
    }
    Object.assign(mergedLines, pickStringMap(indexRaw.lines));

    runtimeConversationConfig = {
      version: typeof indexRaw.version === 'string' ? indexRaw.version : defaultConversationConfig.version,
      lines: { ...defaultConversationConfig.lines, ...mergedLines },
    };
    return runtimeConversationConfig;
  }

  runtimeConversationConfig = defaultConversationConfig;
  return runtimeConversationConfig;
};
