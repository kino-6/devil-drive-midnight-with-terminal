export type DialogueConfig = {
  version: string;
  lines: Record<string, string>;
};

type DialogueVars = Record<string, string | number | boolean | null | undefined>;

export const defaultDialogueConfig: DialogueConfig = {
  version: 'builtin',
  lines: {
    'moe.prologue.open': '午前0時。夜環、開いたよ。',
    'moe.prologue.narrative': '午前0時。夜環、開いたよ。浅層サルベージ任務……ってことになってる。本命は、前任者のログ反応。まだ消えてない。',
    'moe.story.after_log00': '前任者の声……記録には残ってない。でも、知ってる気がする。',
    'moe.story.boss_preview_log01': '料金所の反応、前よりは読める。通行料を払う相手を間違えないで。',
    'moe.run.scan_success': '先に見つけた。どう入る？',
    'moe.run.scan_fail': 'ごめん、遅れた。来るよ。',
    'moe.run.scan_success_boss': '強い反応。見えてるけど、近づき方は選べる。',
    'moe.run.contact_to_command': '接触。コマンド選択へ。',
    'moe.run.ambush_contact': '見落とした。ごめん、初撃来る。',
    'moe.run.approach.no_main_ammo': '主砲弾がない。別の入り方にして。',
    'moe.run.approach.no_signal': 'Signalが足りない。',
    'moe.run.approach.preemptive': '先に撃つ。交渉は少し荒れるよ。',
    'moe.run.approach.hit_and_run': 'ひき逃げルート。成功すれば早いけど、車体は削れるよ。',
    'moe.run.approach.silent_coast': '静かに寄る。話すならこれが一番マシ。',
    'moe.run.approach.open_channel': '先に声をかけるね。返事が人間向けとは限らないけど。',
    'moe.run.route_choice': '次の車線を選んで。補給・信号強化・強行突破・帰還、どれも正解になり得る。',
    'moe.run.route_signal': '信号帯がクリアになった。次の予測が少し長く見える。',
    'moe.run.route_push': '回復なしで進むのね。報酬は少し盛れるかも。',
    'moe.run.route_return': '帰るのも仕事だよ。持ち帰れなきゃ、全部ゼロ。',
    'moe.run.salvage_ready': '補給反応あり。ひとつだけ拾える。',
    'moe.run.salvage_to_boss': '主砲弾か装甲を足してから行ける。選んで。',
    'moe.run.salvage_done': '補給完了。次の区画へ。',
    'moe.run.boss_preview': '料金所型の強い反応。無理なら引き返そ。',
    'moe.run.boss_start': '深層料金所、突入。主砲を温存しすぎないで。',
    'moe.run.boss_return': '引き返す判断、正解。持ち帰ることが最優先。',
    'moe.run.return_gate_seen': '帰還ゲート、見えた。まだ車は動くね。',
    'moe.run.result': '帰れたね。積んだもの、確認しよっか。',
    'moe.run.game_over': '応答して。……だめ、車両信号が落ちてる。',
    'moe.run.encounter_clear': '遭遇クリア。次の判断に備えよう。',
    'moe.garage.enter': '戻れたね。次は出る前に少し積み替えよっか。',
    'moe.garage.set_main_gun': '主砲を重くするとBossは楽。でも弾切れは早いよ。',
    'moe.garage.set_sub_gun': '副砲は戦い方が出る。牽制か、手数か。',
    'moe.garage.set_se': 'S-Eは切り札。契約狙いか、殲滅寄りか選んで。',
    'moe.garage.set_support': '契約サポートは一つだけ。何を車に残す？',
    'moe.garage.skill_sync': '同期率を使って調整した。次Runで効く。',
    'moe.garage.skill_driver': '操縦技能を更新。次Runの反応が変わるはず。',
    'moe.garage.vehicle_tune': '改装完了。車体側の余裕が増える。',
    'moe.garage.memory': '断片が増えるほど、わたしの地図も変わる。',
    'moe.garage.boss_tip': '料金所型の強い反応。主砲弾かS-E弾、どっちかは残しておきたいね。',
    'ui.common.no_previous_run': 'No previous run data',
    'hint.command.main_gun': '主砲を叩き込む。怒らせるけど、確実に削れる。',
    'hint.command.sub_gun': '副砲で牽制。複数の敵に触って流れを作る。',
    'hint.command.se_harpoon': 'S-Eは切り札。契約狙いか妨害か、撃ちどころが命。',
    'hint.command.analyze': 'まず読む。相性を見れば無駄打ちを減らせる。',
    'hint.command.talk': '会話は最短ルートになり得る。圧を上げすぎないで。',
    'hint.command.contract': '契約窓が開いたら一気に。迷うと閉じる。',
    'hint.command.ram': '体当たりは強いけど車体を削る。短期決戦向き。',
    'hint.command.guard': '防御姿勢。次の被害を抑えて立て直す手。',
    'hint.command.escape': '帰還も勝ち筋。持ち帰って次へ繋げよう。',
    'hint.hover.proceed': '回収結果をまとめて次フェーズへ移る。',
    'hint.hover.approach.preemptive': '先制主砲。接敵前に削るけど交渉は荒れる。',
    'hint.hover.approach.hit_and_run': '轢き逃げ突破。成功すれば接敵を飛ばせる。',
    'hint.hover.approach.silent_coast': '静穏接近。交渉初手を通しやすくする。',
    'hint.hover.approach.open_channel': '先行交信。契約窓を開けたい時の前振り。',
    'hint.hover.approach.brace': '不意打ち受領。被害を抑える準備を。',
    'hint.hover.route.salvage': '補給寄りレーン。立て直し向け。',
    'hint.hover.route.signal': 'Signal寄りレーン。解析と交渉を伸ばせる。',
    'hint.hover.route.push_forward': '強行前進。次報酬は良いが被害リスク高。',
    'hint.hover.route.return_gate': 'ここで帰還。戦果を確実に持ち帰る。',
    'hint.hover.boss.challenge': '深層反応に挑む。高リスク高リターン。',
    'hint.hover.boss.emergency_salvage': '応急補給してから突入。安定重視。',
    'hint.hover.boss.return_gate': 'ここで撤退。戦果の確保を優先。',
    'hint.hover.return_to_surface': '帰還処理を実行。地上へ戻る。',
    'hint.contract.window_open': '契約窓が開いてる。今なら接続できる。',
    'hint.contract.window_closed': '契約窓がまだ開いていない。TalkかS-Eを先に。',
    'moe.dynamic.battle.idle': '次の手を選んで。',
    'moe.dynamic.battle.signal_low': 'Signalが足りない。',
    'moe.dynamic.battle.hit_and_run_success': 'ひき逃げ成功。突破した。',
    'moe.dynamic.battle.hit_and_run_bypass': 'ひき逃げ成功。接敵を回避した。',
    'moe.dynamic.battle.main_gun.weak': '{target}へ主砲射撃。刺さった。押し切れる。',
    'moe.dynamic.battle.main_gun.resist': '{target}へ主砲射撃。効きが薄い。別の手に切り替えよう。',
    'moe.dynamic.battle.main_gun.normal': '{target}へ主砲射撃。命中。警戒は上がってる。',
    'moe.dynamic.battle.sub_gun.resist': '副砲制圧。効きが浅い。相性が悪い。',
    'moe.dynamic.battle.sub_gun.weak': '副砲制圧。刺さってる。崩せるよ。',
    'moe.dynamic.battle.sub_gun.suppress': '副砲制圧。攻勢が鈍るかも。',
    'moe.dynamic.battle.sub_gun.normal': '副砲制圧。足止めにはなる。',
    'moe.dynamic.battle.se.all_damage': 'S-E発射。制圧寄りにまとめて焼いた。',
    'moe.dynamic.battle.se.interest.weak': '{target}へS-E発射。署名が浮いた。契約窓が開きやすい。',
    'moe.dynamic.battle.se.interest.resist': '{target}へS-E発射。信号が弾かれた。窓が閉じる。',
    'moe.dynamic.battle.se.interest.normal': '{target}へS-E発射。署名を掴んだ。会話が通じやすい。',
    'moe.dynamic.battle.se.emp': '{target}へEMPフレア。機械霊の挙動が鈍る。',
    'moe.dynamic.battle.analyze.success': '{target}の解析完了。気質と相性を掴んだ。交渉の順番を合わせよう。',
    'moe.dynamic.battle.talk.boss_clear': '{target}との交渉成立。通行許可が出た。ボス反応が引いた。',
    'moe.dynamic.battle.talk.success.weak': '{target}への交信成功。返事が柔らかい。契約窓を狙える。',
    'moe.dynamic.battle.talk.success.resist': '{target}への交信成功。通ったけど警戒が強い。押しすぎ注意。',
    'moe.dynamic.battle.talk.success.window_open': '{target}への交信成功。会話に乗った。今なら積める。',
    'moe.dynamic.battle.talk.success.normal': '{target}への交信成功。反応は良い。もう一押し。',
    'moe.dynamic.battle.talk.failure': '{target}への交信失敗。怒りが上がった。次手を変えよう。',
    'moe.dynamic.battle.contract.no_window': '{target}へ契約試行。契約窓が未開放。TalkかS-Eを先に。',
    'moe.dynamic.battle.contract.condition_fail': '{target}へ契約失敗。条件不足。反動が来る。',
    'moe.dynamic.battle.contract.reject': '{target}へ契約失敗。拒否された。まだ早い。',
    'moe.dynamic.battle.ram.weak': '{target}へラムアタック。効いてる。押し切れる。',
    'moe.dynamic.battle.ram.resist': '{target}へラムアタック。固い。正面突破は不利。',
    'moe.dynamic.battle.ram.normal': '{target}へラムアタック。衝突確認。こちらの装甲も削れてる。',
    'moe.dynamic.battle.guard': '防御姿勢、固定。次の被弾を抑える。',
    'moe.dynamic.battle.escape.success': '離脱。ルート確保。接触を切った。',
    'moe.dynamic.battle.escape.fail': '離脱失敗。受ける準備して。',
  },
};

let runtimeDialogueConfig: DialogueConfig = defaultDialogueConfig;

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

const pickStringMap = (value: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(asRecord(value))) {
    if (typeof raw === 'string' && raw.trim().length > 0) out[key] = raw;
  }
  return out;
};

const fromRecord = (raw: Record<string, unknown>): DialogueConfig => {
  const lines = pickStringMap(raw.lines);
  return {
    version: typeof raw.version === 'string' ? raw.version : defaultDialogueConfig.version,
    lines: { ...defaultDialogueConfig.lines, ...lines },
  };
};

export const getDialogueConfig = (): DialogueConfig => runtimeDialogueConfig;

export const getDialogueLine = (key: string, fallback: string): string =>
  runtimeDialogueConfig.lines[key] ?? fallback;

export const formatDialogueTemplate = (template: string, vars?: DialogueVars): string => {
  if (!vars) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_all, token: string) => {
    const value = vars[token];
    if (value === undefined || value === null) return '';
    return String(value);
  });
};

export const getDialogueLineWithVars = (
  key: string,
  fallback: string,
  vars?: DialogueVars,
): string => {
  const template = getDialogueLine(key, fallback);
  return formatDialogueTemplate(template, vars);
};

export const loadDialogueConfig = async (): Promise<DialogueConfig> => {
  const paths = ['/dialogue.yaml', '/dialogue.yml', '/dialogue.json'];
  for (const path of paths) {
    try {
      const res = await fetch(path, { cache: 'no-cache' });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.trim()) continue;
      const raw = path.endsWith('.json') ? JSON.parse(text) as Record<string, unknown> : parseYamlLikeObject(text);
      runtimeDialogueConfig = fromRecord(raw);
      return runtimeDialogueConfig;
    } catch (error) {
      console.warn('[dialogueConfig] failed to parse', path, error);
    }
  }
  runtimeDialogueConfig = defaultDialogueConfig;
  return runtimeDialogueConfig;
};
