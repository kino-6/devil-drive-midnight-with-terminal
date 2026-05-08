# LLM Code Map (Agent Guide)

このファイルは、Codex/Agent が **「今どこを読めばよいか」** を最短で判断するための導線です。  
実装前に必ず確認してください。

---

## 1) 現在の主要構成（2026-05, 現状準拠）

### エントリ
- `src/App.tsx`
  - `export { App } from './app/AppRoot';` のみ

### 画面結線（オーケストレーション）
- `src/app/AppRoot.tsx`
  - `useReducer` の起点
  - 各コンポーネントへの props 結線
  - save/telemetry/debug handler 群
  - まだ派生計算と一部副作用が残る

### UI コンポーネント（`src/app/components/`）
- `PrologueOverlay.tsx`
- `CockpitHeader.tsx`
- `BattleView.tsx`
- `TerminalPanel.tsx`
- `CommandPanel.tsx`
- `VehiclePanel.tsx`
- `GaragePanel.tsx`
- `UtilityPanels.tsx`
- `EventPanels.tsx`

### hooks（`src/app/hooks/`）
- `useAudioEffects.ts`
- `useRuntimeConfigEffects.ts`
  - runtime config のロード起点（assets / balance / devils / dialogue / scenario / conversation / progression / stage / event）

### 戦闘・進行ロジック（`src/app/state/`）
- `stateReducer.ts`
  - reducer本体、phase遷移の入口、主要 helper の再export
- `combatReducer.ts`
  - `EXECUTE_COMMAND` / `TALK_CHOOSE` を含む戦闘行動解決
- `routeReducer.ts`
  - `REWARD_CONTINUE` 以降の route/salvage/signal/boss preview/return gate 遷移
- `routeGraph.ts`
  - `routeState` と Stage route graph の接続、NAVI候補/briefingの生成
- `stateRestore.ts`
  - save復元時の sanitize
- `stateAutoplay.ts`
  - autoplay バッチ

### 型
- `src/game/types.ts`
  - 状態/Action/データ型の単一ソース

### 永続化・分析
- `src/saveSystem.ts`
- `src/telemetry.ts`
- `src/reproLog.ts`
  - ローカル再現調査用（seed + action + random tape）
  - **ゲーム本編仕様には影響させない**

---

## 2) 目的別: まず読むファイル

### UI変更（見た目・レイアウト）
1. `src/app/components/*` の該当パネル
2. `src/styles.css`
3. 必要なら `src/app/AppRoot.tsx`（props結線のみ）

### 戦闘ロジック変更（Analyze/Talk/Contract/ダメージ/Intent）
1. `src/app/state/combatReducer.ts`
2. `src/app/state/stateReducer.ts`
3. `src/game/types.ts`
4. 必要に応じて `src/balanceConfig.ts` / `public/balance.yaml`

### save変更
1. `src/saveSystem.ts`
2. `src/app/state/stateRestore.ts`
3. `src/game/types.ts`（保存対象型の更新が必要な場合）

### telemetry変更
1. `src/telemetry.ts`
2. `src/app/hooks/useTelemetryEffects.ts`（emit 呼び出し点）

### 再現調査ログ変更
1. `src/reproLog.ts`
2. `src/app/AppRoot.tsx`（dispatch 経路）

### runtime config / loader変更
1. `src/app/hooks/useRuntimeConfigEffects.ts`
2. `src/*Config.ts`（`balanceConfig.ts`, `devilConfig.ts`, `dialogueConfig.ts`, `conversationConfig.ts`, `progressionConfig.ts`, `stageConfig.ts`, `eventConfig.ts`）

---

## 3) データ変更時に読むべき YAML/JSON（直書き禁止）

### Devil定義
- エントリ: `public/devils/index.yaml`
- include先:
  - `public/devils/profiles.yaml`
  - `public/devils/templates.yaml`
  - `public/devils/lineups.yaml`
  - `public/devils/support.yaml`
- loader: `src/devilConfig.ts`

### バランス値
- `public/balance.yaml`
- loader: `src/balanceConfig.ts`
- 装備の数値（damage/ammo/hits/softenChance）と Autoplay/Garage Lab の判断閾値もここへ置く

### Stage route / Event pool
- Stage構成:
  - エントリ: `public/stages/index.yaml`
  - include先: `public/stages/stage_1.yaml`
  - loader: `src/stageConfig.ts`
- Event pool:
  - エントリ: `public/events/index.yaml`
  - include先: `public/events/route_events.yaml`, `public/events/salvage_events.yaml`, `public/events/anomaly_events.yaml`, `public/events/boss_events.yaml`
  - loader: `src/eventConfig.ts`
- runtime接続:
  - load起点: `src/app/hooks/useRuntimeConfigEffects.ts`
  - State: `src/game/types.ts` の `routeState`
  - graph helper: `src/app/state/routeGraph.ts`
  - route遷移: `src/app/state/routeReducer.ts`
  - Autoplay対応: `src/app/state/stateAutoplay.ts`
  - restore対応: `src/app/state/stateRestore.ts`
  - telemetry: `src/app/hooks/useTelemetryEffects.ts` / `src/telemetry.ts`
- NAVI分岐UI:
  - 表示カード: `src/app/components/EventPanels.tsx`
  - コマンドボタン: `src/app/components/command/RouteCommands.tsx`
  - `AppRoot.tsx` は props/action 結線の最小変更に留める

`routeState` は「現在のStage route graph上の位置」を持つ軽量なRun中状態。`stageRouteId`, `currentNodeId`, `visitedNodeIds`, `currentEventId` を保存し、React側でstage/event本文や分岐条件を直書きせず、loader + helper 経由で表示する。

Event ID命名規則:
- `snake_case`
- route event: 進路や状況が分かる短い名詞句（例: `signal_tunnel`, `quiet_shoulder`, `return_gate`）
- salvage event: 回収対象や危険が分かる名詞句（例: `blueprint_cache`, `ammo_cache`, `split_guardrail`）
- anomaly event: 信号/解析/交渉寄りの現象名（例: `am_echo`, `ghost_lane`, `archive_ping`）
- boss event: boss prep / boss route 文脈が分かる名詞句（例: `toll_shadow`, `last_service_area`）
- `pool` は `<kind>.<stage_id>` を基本にし、boss準備だけ `salvage.boss_prep` のように用途名を使う

Fallback方針:
- `public/stages` / `public/events` が欠損、またはロード失敗した場合は `stageConfig.ts` / `eventConfig.ts` の builtin fallback を使う
- Stage graphが有効でない場合、`RouteCommands.tsx` / `EventPanels.tsx` は既存の `Salvage Lane / Signal Lane / Push Forward / Return Gate` 表示へfallbackする
- restore時に存在しない `stageRouteId` / `currentNodeId` は `stateRestore.ts` で安全なfallbackへ戻す
- Stage 1以外は、明示的にStage graphを接続するまで既存固定進行にfallbackする
- event本文や効果説明は `public/events` 側へ置き、Reactへ長文を足さない

### 装備 / 改造 / Unlock進行
- 装備・改造IDと基本説明:
  - `src/game/catalogs.ts`
  - `src/game/types.ts`
- Skill / M.O.E. Skill:
  - ID/label/default level: `src/game/catalogs.ts`
  - Garage購入UI: `src/app/components/garage/GarageGrowthSection.tsx`
  - scan/forecast入口: `src/game/encounterFactory.ts`
  - approach効果: `src/app/state/approachReducer.ts`
  - Talk/Contract効果: `src/app/state/combatReducer.ts`
- Unlock条件:
  - `public/progression.yaml`
  - loader: `src/progressionConfig.ts`
  - helper: `src/game/progression.ts`
- Rare salvage:
  - event helper: `src/game/rareEvents.ts`
  - 文言: `public/dialogue.yaml`
- Vehicle upgrade効果:
  - `src/game/vehicleUpgrades.ts`
  - 数値: `public/balance.yaml`
- Garage表示:
  - `src/app/components/garage/GarageLoadoutSection.tsx`
  - `src/app/components/garage/loadoutOptions.ts`
  - `src/app/components/garage/GarageGrowthSection.tsx`
- Run中の効果:
  - weapon/Analyze/Talk/Contract: `src/app/state/combatReducer.ts`
  - route/salvage/boss return: `src/app/state/routeReducer.ts`
  - run reward集約: `src/app/state/storyProgression.ts`

ID命名規則:
- 装備/改造/skill/unlock ID は `snake_case`
- Main Gun: `*_cannon`, `*_driver` など既存トーンに合わせる
- Sub Gun: `*_mg`, `*_pod`, `*_jammer`
- S-E: `*_flare`, `*_beacon`, `*_pulse`, `*_anchor`
- Vehicle Upgrade: `fuel_tank`, `signal_antenna`, `noise_filter` のように機能名を直接表す
- unlock milestone は `clear_stage_1`, `story_logs_2`, `blueprint_signal_antenna`, `contract_temperament_machine`

Unlock条件の使い分け:
- `initialUnlocks`: 新規saveの初期装備。増やしすぎない
- `purchase`: Credits / Driver XP / M.O.E. Sync を使う明示的なGarage解放
- `milestone`: Stage clear、Story Log数、blueprint持ち帰りなどRun結果で解放
- `boss_clear`: Boss clearに紐づく明確な報酬
- `contract`: 特定support daemon契約で解放
- `story_log`: 特定Story Log回収で解放
- `rare_route`: Signal Tunnelなど、ルート選択ログから解放

注意:
- unlock条件を React や `AppRoot.tsx` に直書きしない
- 既存save互換のため、`SaveData.unlocks` 欠損時は安全側のfallbackがある
- 新装備を追加したら catalog/type/order/balance/progression/Garage表示の全経路を確認する
- Skillを追加または強化したら、Garage購入表示だけでなくRun中の参照箇所まで確認する

### 文言
- 汎用: `public/dialogue.yaml`（loader: `src/dialogueConfig.ts`）
- 会話強化: `public/conversations/index.yaml` + `public/conversations/*.yaml`（loader: `src/conversationConfig.ts`）
- シナリオ断片: `public/scenarios/**/*.json`（loader: `src/scenario/scenarioLoader.ts`）

### アセット
- `public/assets/manifest.yaml`
- resolver: `src/assetManifest.ts`
- enemy image resolver: `src/game/runtimeHelpers.ts`
- enemy sprite display: `src/components/EncounterVisuals.tsx`
- battle wiring: `src/app/components/BattleView.tsx`

悪魔画像は `public/assets/images/devil/` に置き、React側へ画像パスを直書きしない。命名は `<devil_id>_idle.png`, `<devil_id>_move_01.png` を基本にする。`images.enemies` は後方互換の string 指定と、`{ idle, moveFrames }` の新形式を受け付ける。

```yaml
images:
  enemies:
    pixie_shibuya_glow:
      idle: "images/devil/pixie_idle.png"
      moveFrames:
        - "images/devil/pixie_idle.png"
        - "images/devil/pixie_move_01.png"
```

`moveFrames` が2枚以上ある revealed/analyzed 済みの敵だけ2フレーム表示になる。1枚だけ、または string 指定の敵は単一画像のまま動く。`UNKNOWN SIGN` は単一画像運用でよい。

### ローカル調査データ（Git管理外）
- `.local/repro-logs/`
  - seed / action / random tape を保存するローカルワーク領域
  - `.gitignore` 対象
  - **通常の Codex 作業では読まない（ユーザーが明示したときのみ）**

---

## 4) 重要方針（必須）

- **AppRoot.tsx に新しいゲームデータ・長文文言・数値・敵定義を足さない。**
- 追加データは必ず YAML/JSON + loader 経由へ寄せる。
- 新しい画像パスは `manifest.yaml` / `profiles.yaml` 経由にし、Reactコンポーネントへ直書きしない。
- ロジックは `stateReducer.ts` / `combatReducer.ts`、表示は `components/*` に分離する。
- UIの固定ラベル以外の大量文言は config 側へ置く。

---

## 5) public/devils/index.yaml の split/include 方針

- `public/devils/index.yaml` は **正規エントリ**。
- ここで `includes` を定義し、`devilConfig.ts` が順次マージする。
- 原則:
  - profile文言/見た目情報: `profiles.yaml`
  - 戦闘テンプレート（HP/temperament/affinity等）: `templates.yaml`
  - 出現編成: `lineups.yaml`
  - support daemon情報: `support.yaml`
- 互換都合がない限り、新規定義は split 先へ追加する。

---

## 6) 実装改善メモ（次に効く小さな整理）

- MOE dialogue:
  - 追加先は原則 `public/dialogue.yaml`
  - helperは `src/game/moeDialogue.ts`
  - `moe.run.*`, `moe.garage.*`, `moe.dynamic.battle.*` の番号付きpoolを使い、reducerへ文言を増やさない
- Route graph:
  - node選択/fallback/currentEvent解決/return checkpoint判定は `src/app/state/routeGraph.ts` と `routeReducer.ts` 側で扱う
  - componentにはNAVI候補の表示に必要な短いview dataだけ渡す
- Progression / unlock:
  - 条件は `public/progression.yaml`
  - 判定と購入処理は `src/game/progression.ts`
  - Garage UIはlocked理由/購入可否を表示するだけに寄せる
- YAML参照検証:
  - `npm run config:validate` で devil profile / asset manifest / Encounter ID のズレを検出する
  - `npm run scenario:validate` で scenario JSON を検証する
  - `npm run check` で config validate + scenario validate + build をまとめて実行する
  - stage/event/progression/balance/catalog のID参照ミス検出は今後の拡張候補
  - unknown effect / unknown unlock target は落とさず警告できる設計を優先
- AppRoot:
  - props結線と画面構成に留める
  - 派生値、MOE表情、runtime config、save/telemetry副作用はhook/view-modelへ継続移管する
- GaragePanel:
  - Loadout option組み立ては `src/app/components/garage/loadoutOptions.ts`
  - locked判定、購入可否、装備選択可否が増える場合はselector/helperへ逃がす
  - UI側にprogression条件を直書きしない

---

## 7) 今後の分割候補（次ステップ）

> すでに `CommandPanel / VehiclePanel / GaragePanel / UtilityPanels / EventPanels` は抽出済み。  
> 今後は「内部責務の再分割」を候補にする。

1. `CommandPanel` 内の phase別表示（encounter/garage/result）を更に小分割
2. `VehiclePanel` の resource/contract/support セクション分割
3. `GaragePanel` の stage/loadout/growth/archive の小分割
4. `UtilityPanels` の playtest/save/archive の小分割
5. `EventPanels` の phaseカード群の小分割
6. `AppRoot.tsx` の副作用/派生値を hooks/view-model へ継続移管

---

## 8) Codex作業時の最小チェック

1. 変更対象が UI / ロジック / データ のどれかを先に切り分ける
2. 変更先が `AppRoot.tsx` で本当に妥当か確認する（多くは別ファイル）
3. `npm run check` を実行
4. 主要ループ確認  
   `Prologue -> Approach -> Encounter -> Reward/Route -> Boss/Return -> Result -> Garage`
5. save/telemetry の localStorage キー互換を壊していないか確認
