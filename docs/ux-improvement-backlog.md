# UX Improvement Backlog

このメモは、ゲームとしての分かりやすさ、納得感、選択の気持ちよさを上げるためのUX改善候補です。実装理想論ではなく、現在の画面・状態・データ構造から自然に接続できる項目を優先します。

## 方針

- 画面上の文字量を増やさず、まずは「判断に必要な情報」だけを残す。
- 重要情報は hover だけに置かず、プレイヤーが行動前に見える場所へ出す。
- NAVI / M.O.E. の説明は補助に留め、判断材料はUIで読めるようにする。
- 戦闘、ルート、補給、帰還の各選択で「予測 -> 実行 -> 結果」がつながる見え方にする。
- React側に長文や条件を増やさず、文言は dialogue / events / config へ寄せる。

## P0: 直近で効く改善

### 戦闘: ダメージの納得感

現状:
- 攻撃結果がログやHP変化で分かるが、画面上では「いつ、どれだけ入ったか」が弱い。
- Damage Rangeは出始めたが、相性未解析時の不確実性とAnalyze後の確度差をもっと見せたい。

改善:
- [x] 敵カード上のダメージポップを維持しつつ、弱点/耐性時は色または短いタグで差を出す。
- [x] Command上の固定 `DMG` 表示を抑え、与ダメ目安は hover / 詳細側へ逃がしてはみ出しを防ぐ。
- [ ] Analyze完了時に `ACTION READABLE`, `WEAKNESS DECODED`, `FULL ANALYZE` を敵UI上で短時間だけ表示する。

読むファイル:
- `src/app/hooks/useCommandDerived.ts`
- `src/app/hooks/useUiEffects.ts`
- `src/components/EncounterVisuals.tsx`
- `src/app/state/combatReducer.ts`

### 戦闘: 敵ごとの戦術差

現状:
- 名前と画像の違いに比べて、最適行動の違いがまだ薄い。
- 「押し切る」以外の判断が見えにくい敵がいる。

改善:
- [x] 敵ごとに `Action`, `Next`, `Weak`, `Tactic` のうち最低1つは明確な判断差を持たせる。
- [x] Analyze後の `Action` / `Next` に `ARMOR -2` など結果予測チップを出す。
- [ ] 抵抗が多い Main Cannon 寄りの敵は一部調整し、Sub / S-E / Ram / Talk が刺さる場面を増やす。

読むファイル:
- `public/devils/templates.yaml`
- `src/devilConfig.ts`
- `public/balance.yaml`
- `src/game/devilTactics.ts`

### Route: Mapで選ぶ楽しさ

現状:
- Route選択は改善されたが、文字情報がまだ多くなりやすい。
- 3手先の見通しは面白いが、アイコン主体にしないと読み疲れする。

改善:
- [x] `SUP / SIG / CNT / GATE / BOSS` の文字列はコマンド一覧側に寄せ、WindshieldのMapはアイコン中心にする。
- [x] Signal不足時は `UNKNOWN` ではなく、どの情報が伏せられているかをアイコン/マスクで示す。
- [x] 左右/直進の候補Windowはクリック可能領域を明確にし、はみ出しを避ける。
- [x] `routeState` とStage graphから現在位置起点のMapを生成し、選択可能ノードをクリックして進路決定できるようにする。

読むファイル:
- `src/app/components/RoutePreviewMap.tsx`
- `src/app/components/routePreviewHelpers.ts`
- `src/app/state/routeGraph.ts`
- `src/styles.css`

## P1: 次に効く改善

### Signalの意味を行動前に見せる

現状:
- SignalはAnalyze、Talk支払い、Scan成功率、進路予測などに効くが、状況ごとの不足理由がまだ伝わりにくい。

改善:
- Signal 0/low時、Route候補・Analyze・Talkに「何が失われるか」を短く表示する。
- Vehicle DashboardのSignal hoverには用途だけでなく、現在の状態による警告を追加する。
- M.O.E. Skillの `signal_tuning` 強化で何が改善されたかをGarage上で明記する。

読むファイル:
- `src/game/resourceGlossary.ts`
- `src/app/components/VehiclePanel.tsx`
- `src/app/components/garage/GarageGrowthSection.tsx`
- `src/game/signalSystem.ts`

### 補給イベントを状況付き選択にする

現状:
- 補給候補は機能的だが、「なぜここに1つだけ拾えるのか」「どんな場所なのか」が弱い。

改善:
- Salvageイベントを「場所/制約/危険/拾える理由」の短い状況文にする。
- 選択肢は `今困っている資源` を優先して強調する。
- 文章を増やしすぎず、候補カードは `効果 + 状況タグ` までに抑える。

読むファイル:
- `public/events/salvage_events.yaml`
- `src/game/salvageChoices.ts`
- `src/app/components/command/RouteCommands.tsx`

### 帰還判断を常時読めるようにする

現状:
- Safe Extract / Backtrack / Wipeout carryback は入っているが、Run中の判断材料としてまだ弱い。

改善:
- [x] Route/Encounter中に `Return Point: reached / not reached` を小さく常時表示する。
- [x] Backtrack時のリスクを「Fuel/Armor/Encounterのどれか」として明示する。
- [x] Resultでは `Safe Extract`, `Backtrack`, `Wipeout Carryback` の違いを短く表示する。

読むファイル:
- `src/game/returnDecision.ts`
- `src/game/carryback.ts`
- `src/app/state/routeReducer.ts`
- `src/app/components/ResultPanel.tsx`

## P2: 中期改善

### Garage初期体験

現状:
- 初回Garageと帰還後Garageで同じようなM.O.E.文言が出ることがあり、状況とズレる可能性がある。
- 装備が揃って見えるとアンロックの意味が薄れる。

改善:
- 初回、帰還後、出撃確認、装備変更でM.O.E.文言プールを分ける。
- Locked装備はカード面積を抑え、購入可能/未達成の違いだけ見せる。
- Debug Save表示は起動debug時だけ見えるようにし、通常導線から外す。

読むファイル:
- `public/dialogue.yaml`
- `src/game/moeDialogue.ts`
- `src/app/components/garage/*`
- `src/progressionConfig.ts`

### Terminal / Dashboard の役割整理

現状:
- Terminal, M.O.E., Vehicle Dashboard, Windshieldがそれぞれ情報を持つため、同じ場面で文字が多くなりやすい。

改善:
- Windshield: 敵/Map/状況の視覚情報
- Command: 行動選択と必要最小限の結果予測
- M.O.E.: 重要な助言を1文
- Terminal Log: 履歴と詳細
- Vehicle Dashboard: リソース残量と危険状態

読むファイル:
- `src/app/AppRoot.tsx`
- `src/app/components/BattleView.tsx`
- `src/app/components/CommandPanel.tsx`
- `src/app/components/TerminalPanel.tsx`
- `src/app/components/VehiclePanel.tsx`

## 表示情報を絞る基準

常時表示する:
- HP / Analyze / Action / Next
- 現在選べる行動のDMG Rangeまたはコスト
- Fuel / Armor / Signal / Ammo
- Route候補の3手先アイコンとBossまでの距離

hover / detailsへ畳む:
- 長い説明文
- Tactic詳細
- Contract mood/personaの補足
- 過去ログ
- 解放済みアーカイブ詳細

ログへ送る:
- 計算結果の詳細
- 複数hitの内訳
- Unlock履歴
- Rare eventの長めの状況文

## 実装時の注意

- UI改善で `AppRoot.tsx` に条件分岐を増やしすぎない。
- 表示用の整形は小さな helper に寄せる。
- `public/events` / `public/dialogue.yaml` に置ける文言はReactへ直書きしない。
- 大きな画面変更より、1画面ごとに「読む量を減らす」小さいcommitを優先する。
