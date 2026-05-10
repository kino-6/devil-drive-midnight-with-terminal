export type DialogueConfig = {
  version: string;
  lines: Record<string, string>;
};

export type DialogueVars = Record<string, string | number | boolean | null | undefined>;

export const defaultDialogueConfig: DialogueConfig = {
  version: 'builtin',
  lines: {
    'moe.prologue.open': '午前0時。夜環、開いたよ。',
    'moe.prologue.narrative': '午前0時。夜環、開いたよ。浅層サルベージ任務……ってことになってる。本命は、前任者のログ反応。まだ消えてない。',
    'moe.story.after_log00': '前任者の声……記録には残ってない。でも、知ってる気がする。',
    'moe.story.boss_preview_log01': '料金所の反応、前よりは読める。通行料を払う相手を間違えないで。',
    'moe.run.scan_success': '先に見つけた。どう入る？',
    'moe.run.scan_success.1': '先に見つけた。えへん、今のは褒めていいやつ。',
    'moe.run.scan_success.2': 'NAVI捕捉成功。入り方は選べる、焦らなくていいよ。',
    'moe.run.scan_fail': 'ごめん、遅れた。来るよ。',
    'moe.run.scan_fail.1': 'ごめん、反応が割れた。初撃に備えて。',
    'moe.run.scan_fail.2': '読み遅れた。でもまだ立て直せる。受け方を選ぼう。',
    'moe.run.scan_success_boss': '強い反応。見えてるけど、近づき方は選べる。',
    'moe.run.scan_success_boss.1': '深層反応、捕まえた。怖いけど、見えてるなら手はある。',
    'moe.run.contact_to_command': '接触。コマンド選択へ。',
    'moe.run.contact_to_command.1': '接触。敵意と会話余地、両方見ていこう。',
    'moe.run.ambush_contact': '見落とした。ごめん、初撃来る。',
    'moe.run.ambush_contact.1': 'アンブッシュ。謝るのは後、今は受けるよ。',
    'moe.run.approach.no_main_ammo': '主砲弾がない。別の入り方にして。',
    'moe.run.approach.no_signal': 'Signalが足りない。',
    'moe.run.approach.preemptive': '先に撃つ。交渉は少し荒れるよ。',
    'moe.run.approach.hit_and_run': 'ひき逃げルート。成功すれば早いけど、車体は削れるよ。',
    'moe.run.approach.silent_coast': '静かに寄る。話すならこれが一番マシ。',
    'moe.run.approach.open_channel': '先に声をかけるね。返事が人間向けとは限らないけど。',
    'moe.run.route_choice': '次の車線を選んで。補給・信号強化・強行突破・帰還、どれも正解になり得る。',
    'moe.run.route_choice.1': '分岐来た。補給、Signal、強行、帰還。どれも逃げじゃないよ。',
    'moe.run.route_choice.2': '車線候補を出すね。わたしのおすすめは状況次第、つまり今ちゃんと悩むところ。',
    'moe.run.route_signal': '信号帯がクリアになった。次の予測が少し長く見える。',
    'moe.run.route_signal.1': 'Signal帯、開いた。解析寄りで行くならここ、わたしは好き。',
    'moe.run.route_push': '回復なしで進むのね。報酬は少し盛れるかも。',
    'moe.run.route_push.1': '強行する？ いいよ、記録は取る。無茶と勇気の境目も一応。',
    'moe.run.route_return': '帰るのも仕事だよ。持ち帰れなきゃ、全部ゼロ。',
    'moe.run.route_return.1': '帰るのも仕事。ちゃんと戻れたら、次はもっと深く行けるよ。',
    'moe.run.return_checkpoint': '帰還チェックポイントに戻った。ここからなら安全に抜けられる。',
    'moe.run.return_checkpoint.1': '帰還点、再捕捉。ここまで戻れたのは判断勝ち。',
    'moe.run.salvage_ready': '補給反応あり。ひとつだけ拾える。',
    'moe.run.salvage_to_boss': '主砲弾か装甲を足してから行ける。選んで。',
    'moe.run.salvage_done': '補給完了。次の区画へ。',
    'moe.run.salvage_to_boss_done': '応急補給完了。Toll Gate Saintへ向かう。',
    'moe.run.signal.analyze_trace': '断片ログを掴んだ。次接敵の読みは少し深い。',
    'moe.run.signal.open_radio': 'AM帯を開いた。最初の会話は通しやすい。',
    'moe.run.signal.hold_lane': '速度維持で抜ける。接敵優先で行くよ。',
    'rare.salvage.blueprint_signal_antenna.label': 'Signal Antenna Blueprint',
    'rare.salvage.blueprint_signal_antenna.detail': 'Garage unlock material / Signal Antenna',
    'rare.salvage.blueprint_signal_antenna.log': 'BLUEPRINT ACQUIRED: SIGNAL ANTENNA',
    'rare.salvage.blueprint_signal_antenna.moe': '設計図だ。持ち帰れたらSignal Antennaを組める。',
    'rare.salvage.strange_part_daemon_bus.label': 'Strange Bus Part',
    'rare.salvage.strange_part_daemon_bus.detail': 'Garage unlock material / Daemon Bus',
    'rare.salvage.strange_part_daemon_bus.log': 'STRANGE PART ACQUIRED: DAEMON BUS',
    'rare.salvage.strange_part_daemon_bus.moe': '変なバス部品。契約daemonの揺れを抑えられるかも。',
    'run.milestone.contract_machine': 'DEMON MILESTONE: MACHINE CONTRACT',
    'run.milestone.contract_lonely': 'DEMON MILESTONE: LONELY CONTRACT',
    'moe.run.boss_preview': '料金所型の強い反応。無理なら引き返そ。',
    'moe.run.boss_preview.1': '深層料金所、反応強い。強がるのは好きだけど、車は正直だよ。',
    'moe.run.boss_start': '深層料金所、突入。主砲を温存しすぎないで。',
    'moe.run.boss_start.1': '突入する。火力もSignalも、出し惜しみなしで。',
    'moe.run.boss_return': '引き返す判断、正解。持ち帰ることが最優先。',
    'moe.run.boss_return.1': '撤退判断、了解。悔しいのはあと。今は戻る。',
    'moe.run.return_gate_seen': '帰還ゲート、見えた。まだ車は動くね。',
    'moe.run.return_gate_seen.1': '帰還ゲート捕捉。よし、まだ帰れる。えらい。',
    'moe.run.result': '帰れたね。積んだもの、確認しよっか。',
    'moe.run.result.1': '帰投完了。積んだもの、失くしたもの、次に使えるものを見よう。',
    'moe.run.game_over': '応答して。……だめ、車両信号が落ちてる。',
    'moe.run.game_over.1': '車両信号、落ちた。少しだけ回収できる。次の判断材料にする。',
    'moe.run.encounter_clear': '遭遇クリア。次の判断に備えよう。',
    'moe.run.encounter_clear.1': '遭遇クリア。呼吸して。次の分岐、ちゃんと読む。',
    'moe.run.stage_clear': 'ステージ{stage}突破。次は深くなる、装備を組み直そう。',
    'moe.run.abyss_unlocked': '深層封鎖鍵が外れた。次から最深層、Abyss Loopに入れる。',
    'run.beat.entry': 'NIGHT LOOP ENTRY',
    'run.beat.stage': 'STAGE {stage}',
    'run.beat.loop': 'LOOP {loop}',
    'run.beat.approach_window': 'APPROACH WINDOW OPEN',
    'run.beat.brace_contact': 'BRACE FOR CONTACT',
    'run.beat.contact_detected': 'CONTACT DETECTED',
    'run.beat.lane_transit': 'LANE TRANSIT',
    'run.beat.route_forecast': 'NAVI FORECAST',
    'run.beat.route_options': 'ROUTE OPTIONS AVAILABLE',
    'run.beat.salvage_lane': 'SALVAGE LANE',
    'run.beat.salvage_response': 'SALVAGE RESPONSE',
    'run.beat.choose_pickup': 'CHOOSE ONE PICKUP',
    'run.beat.signal_lane': 'SIGNAL LANE',
    'run.beat.signal_window': 'SIGNAL WINDOW',
    'run.beat.choose_signal_action': 'CHOOSE SIGNAL ACTION',
    'run.beat.first_strike': 'FIRST STRIKE',
    'run.beat.first_strike_damage': 'DAMAGE {damage}',
    'run.beat.silent_coast': 'SILENT APPROACH',
    'run.beat.open_channel': 'CHANNEL OPEN',
    'run.beat.ambush': 'AMBUSH WARNING',
    'run.beat.encounter_start': 'ENCOUNTER START',
    'run.beat.boss_signal': 'BOSS SIGNAL',
    'run.beat.boss_unreadable': 'SILHOUETTE LOCK / INTEL REQUIRED',
    'run.beat.deep_signal': 'DEEP SIGNAL DETECTED',
    'moe.beat.entry': '進路同期完了。侵入開始。',
    'moe.beat.lane_transit': '車線変更、入った。次の反応まで少しだけ走るよ。',
    'moe.beat.route_forecast': '分岐候補、拾えた。少し先まで見て選ぼう。',
    'moe.beat.salvage_lane': '補給反応に寄せる。速度を落とすね。',
    'moe.beat.signal_lane': '信号帯に入る。ノイズ、少しだけ我慢して。',
    'moe.beat.contact_detected': '接触反応。手順を選んで。',
    'moe.beat.ambush': '遅れた。初撃が来る。',
    'moe.beat.boss_signal': '深層反応。輪郭だけ見える。',
    'moe.garage.first_enter': 'Midnight Bay Garage、初回起動。装備とStageを確認しよう。',
    'moe.garage.first_enter.1': 'Garage接続完了。まずは車両と武装の初期状態を見よう。',
    'moe.garage.first_enter.2': '出撃前チェックを始めるね。Fuel、Armor、Signal、ここで整える。',
    'moe.garage.enter': '戻れたね。次は出る前に少し積み替えよっか。',
    'moe.garage.enter.1': 'Garage着。無事に戻るの、地味だけど一番強い。',
    'moe.garage.enter.2': 'おかえり。整備ログ開くね。……ちょっとだけ安心した。',
    'moe.garage.set_main_gun': '主砲を重くするとBossは楽。でも弾切れは早いよ。',
    'moe.garage.set_sub_gun': '副砲は戦い方が出る。牽制か、手数か。',
    'moe.garage.set_se': 'S-Eは切り札。契約狙いか、殲滅寄りか選んで。',
    'moe.garage.set_support': '契約サポートは一つだけ。何を車に残す？',
    'moe.garage.skill_sync': '同期率を使って調整した。次Runで効く。',
    'moe.garage.skill_driver': '操縦技能を更新。次Runの反応が変わるはず。',
    'moe.garage.vehicle_tune': '改装完了。車体側の余裕が増える。',
    'moe.garage.memory': '断片が増えるほど、わたしの地図も変わる。',
    'moe.garage.boss_tip': '料金所型の強い反応。主砲弾かS-E弾、どっちかは残しておきたいね。',
    'moe.garage.unlock_purchase': 'アンロック完了。選択肢が増えたよ。',
    'moe.garage.ready_check': '積み替え、終わった？ このまま夜環へ入る。',
    'moe.garage.sortie_confirm': '準備完了なら、出る。まだならここで調整して。',
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
    'moe.dynamic.battle.idle.1': '次の手、見てる。急がなくていい、でも迷いすぎは危ない。',
    'moe.dynamic.battle.signal_low': 'Signalが足りない。',
    'moe.dynamic.battle.signal_low.1': 'Signal薄い。無理はできるけど、わたしはおすすめしない。',
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
    'moe.dynamic.battle.analyze.success.1': '{target}の解析、通った。えへん、情報は武器だよ。',
    'moe.dynamic.battle.analyze.success.2': '{target}の輪郭を掴んだ。撃つにも話すにも、これで少し優しくない。',
    'moe.dynamic.battle.talk.boss_clear': '{target}との交渉成立。通行許可が出た。ボス反応が引いた。',
    'moe.dynamic.battle.talk.success.weak': '{target}への交信成功。返事が柔らかい。契約窓を狙える。',
    'moe.dynamic.battle.talk.success.resist': '{target}への交信成功。通ったけど警戒が強い。押しすぎ注意。',
    'moe.dynamic.battle.talk.success.window_open': '{target}への交信成功。会話に乗った。今なら積める。',
    'moe.dynamic.battle.talk.success.normal': '{target}への交信成功。反応は良い。もう一押し。',
    'moe.dynamic.battle.talk.locked_unknown': '相手の輪郭がまだ取れてない。先にAnalyzeで署名を掴もう。',
    'moe.dynamic.battle.talk.failure': '{target}への交信失敗。怒りが上がった。次手を変えよう。',
    'moe.dynamic.battle.talk.failure.1': '{target}への交信、弾かれた。大丈夫、次は圧を下げて組み直そう。',
    'moe.dynamic.battle.contract.no_window': '{target}へ契約試行。契約窓が未開放。TalkかS-Eを先に。',
    'moe.dynamic.battle.contract.no_window.1': '{target}の契約窓、まだ閉じてる。焦ると鍵穴まで消えるよ。',
    'moe.dynamic.battle.contract.condition_fail': '{target}へ契約失敗。条件不足。反動が来る。',
    'moe.dynamic.battle.contract.condition_fail.1': '{target}との条件が噛んでない。反動来る、姿勢保って。',
    'moe.dynamic.battle.contract.reject': '{target}へ契約失敗。拒否された。まだ早い。',
    'moe.dynamic.battle.contract.reject.1': '{target}に拒否された。傷ついてない。たぶん。次、変えよう。',
    'moe.dynamic.battle.contract.support_linked': 'Support daemon accepted. I will monitor corruption drift.',
    'moe.dynamic.battle.contract.support_linked.1': '契約署名、接続完了。新しい同乗者、変な返事をしても真似しないで。',
    'moe.dynamic.battle.contract.support_linked.2': 'Support daemon安定化。……たぶん。わたしが見張るから。',
    'moe.dynamic.battle.ram.weak': '{target}へラムアタック。効いてる。押し切れる。',
    'moe.dynamic.battle.ram.resist': '{target}へラムアタック。固い。正面突破は不利。',
    'moe.dynamic.battle.ram.normal': '{target}へラムアタック。衝突確認。こちらの装甲も削れてる。',
    'moe.dynamic.battle.guard': '防御姿勢、固定。次の被弾を抑える。',
    'moe.dynamic.battle.guard.1': '防御姿勢。派手じゃないけど、こういう判断は好き。',
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
