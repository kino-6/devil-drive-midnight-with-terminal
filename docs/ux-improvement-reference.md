# UX Improvement Reference

`docs/ux-improvement-backlog.md` のTodoを実装するときの参考情報。Backlog本体には順番付きTodoだけを残す。UIの文字量は `docs/steering.md` の方針を優先する。

## 方針

- 画面上の文字量を増やさず、まずは「判断に必要な情報」だけを残す。
- 常時表示する文字情報はSFC〜PS1時代のゲームUI程度に抑え、説明文でUIを成立させない。
- 重要情報は hover だけに置かず、プレイヤーが行動前に見える場所へ出す。
- NAVI / M.O.E. の説明は補助に留め、判断材料はUIで読めるようにする。
- 戦闘、ルート、補給、帰還の各選択で「予測 -> 実行 -> 結果」がつながる見え方にする。
- React側に長文や条件を増やしすぎず、文言は dialogue / events / config へ寄せる。

## Action中心の敵カード

現状:
- 敵カードには `Action` / `Next` / 詳細チップが出せるが、常時読む情報が増えるほどWindshield内の視線が散る。
- スクリーン上では敵画像、HP、Analyze、Actionがすでに強い判断材料になっている。
- 未解析ターゲット側にも `LOCKED` 表示が出るが、既知ターゲットとの比較で「何が分からないか」が少し重複して見える。

参考:
- 常時表示は `HP / Analyze / Action` を基本にする。
- `Next` は hover / details / Analyze深度が高い時だけに畳む。
- `Action` 行はアイコン + 行動名 + 影響チップ1つにする。
- M.O.E.の助言は `Action` を読む一文に寄せる。例: `GUARD中。RamよりS-Eが通しやすい。`

読むファイル:
- `src/components/EncounterVisuals.tsx`
- `src/app/components/CommandPanel.tsx`
- `src/app/hooks/useCommandDerived.ts`
- `src/game/devilTactics.ts`
- `public/dialogue.yaml`

## Signal

現状:
- SignalはAnalyze、Talk支払い、Scan成功率、進路予測などに効くが、状況ごとの不足理由がまだ伝わりにくい。
- Vehicle DashboardのSignal hoverには用途と現在状態による警告がある。

読むファイル:
- `src/game/resourceGlossary.ts`
- `src/app/components/VehiclePanel.tsx`
- `src/app/components/garage/GarageGrowthSection.tsx`
- `src/game/signalSystem.ts`

## Salvage

現状:
- 補給候補は機能的だが、「なぜここに1つだけ拾えるのか」「どんな場所なのか」が弱い。

参考:
- Salvageイベントは「場所/制約/危険/拾える理由」の短い状況文にする。
- 文章を増やしすぎず、候補カードは `効果 + 状況タグ` までに抑える。

読むファイル:
- `public/events/salvage_events.yaml`
- `src/game/salvageChoices.ts`
- `src/app/components/command/RouteCommands.tsx`

## Garage

現状:
- 初回Garageと帰還後Garageで同じようなM.O.E.文言が出ることがあり、状況とズレる可能性がある。
- 装備が揃って見えるとアンロックの意味が薄れる。

読むファイル:
- `public/dialogue.yaml`
- `src/game/moeDialogue.ts`
- `src/app/components/garage/*`
- `src/progressionConfig.ts`

## Terminal / Dashboard

現状:
- Terminal, M.O.E., Vehicle Dashboard, Windshieldがそれぞれ情報を持つため、同じ場面で文字が多くなりやすい。
- Encounter画面では、Windshield内の敵情報、Command、Terminalタグ、Vehicle Dashboardが同じ強さで並び、今押すべき判断の中心がやや薄くなる。

役割:
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
- HP / Analyze / Action
- 現在選べる行動のDMG Rangeまたはコスト
- Fuel / Armor / Signal / Ammo
- Route候補の3手先アイコンとBossまでの距離

hover / detailsへ畳む:
- Next予測
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

## 完了済みの背景メモ

### 戦闘: ダメージの納得感

完了:
- 敵カード上のダメージポップを維持しつつ、弱点/耐性時は色または短いタグで差を出す。
- Command上の固定 `DMG` 表示を抑え、与ダメ目安は hover / 詳細側へ逃がしてはみ出しを防ぐ。
- Analyze完了時に `ACTION READABLE`, `WEAKNESS DECODED`, `FULL ANALYZE` を敵UI上で短時間だけ表示する。

読むファイル:
- `src/app/hooks/useCommandDerived.ts`
- `src/app/hooks/useUiEffects.ts`
- `src/components/EncounterVisuals.tsx`
- `src/app/state/combatReducer.ts`

### 戦闘: 敵ごとの戦術差

完了:
- 敵ごとに `Action`, `Next`, `Weak`, `Tactic` のうち最低1つは明確な判断差を持たせる。
- Analyze後の `Action` / `Next` に `ARMOR -2` など結果予測チップを出す。
- 抵抗が多い Main Cannon 寄りの敵は一部調整し、Sub / S-E / Ram / Talk が刺さる場面を増やす。

読むファイル:
- `public/devils/templates.yaml`
- `src/devilConfig.ts`
- `public/balance.yaml`
- `src/game/devilTactics.ts`

### Route: Mapで選ぶ楽しさ

完了:
- `SUP / SIG / CNT / GATE / BOSS` の文字列はコマンド一覧側に寄せ、WindshieldのMapはアイコン中心にする。
- Signal不足時は `UNKNOWN` ではなく、どの情報が伏せられているかをアイコン/マスクで示す。
- 左右/直進の候補Windowはクリック可能領域を明確にし、はみ出しを避ける。
- `routeState` とStage graphから現在位置起点のMapを生成し、選択可能ノードをクリックして進路決定できるようにする。

読むファイル:
- `src/app/components/RoutePreviewMap.tsx`
- `src/app/components/routePreviewHelpers.ts`
- `src/app/state/routeGraph.ts`
- `src/styles.css`

### 帰還判断

完了:
- Route/Encounter中に `Return Point: reached / not reached` を小さく常時表示する。
- Backtrack時のリスクを「Fuel/Armor/Encounterのどれか」として明示する。
- Resultでは `Safe Extract`, `Backtrack`, `Wipeout Carryback` の違いを短く表示する。

読むファイル:
- `src/game/returnDecision.ts`
- `src/game/carryback.ts`
- `src/app/state/routeReducer.ts`
- `src/app/components/ResultPanel.tsx`
