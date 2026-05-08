# Game Design (Current MVP)

このドキュメントは「現在の実装に合っている仕様」を簡潔にまとめたものです。  
将来構想ではなく、`src/App.tsx` ベースの現行挙動を優先して記述します。

## 1. コンセプト

- 舞台: 東京深夜道路網の異界「夜環 / Night Loop」
- 体験: 車載ダッシュボードUIで、接敵・交渉・契約・帰還判断を短いRunで繰り返す
- 進行: **Run-first**（初回に即プレイ、Result後にGarageで調整）

## 2. 現在のフェーズ遷移

主要フェーズ:

- `prologue`
- `approach`
- `encounter`
- `reward`
- `route_choice`
- `salvage`
- `signal`
- `boss_preview`
- `boss_encounter`
- `return_gate`
- `result`
- `garage`
- `game_over`

基本導線:

1. `prologue`（START ENGINE）
2. `approach`（NAVI Scan + 接敵前選択）
3. `encounter`（コマンド戦闘/交渉）
4. `reward`
5. `route_choice`
6. 2nd `encounter`
7. `boss_preview`
8. `boss_encounter` または早期帰還
9. `return_gate`
10. `result`
11. `garage`（次Run準備）

## 3. リソース

- `Fuel`
- `Armor`
- `Signal`
- `Main Ammo`
- `S-E Ammo`

敗北条件:

- `Fuel <= 0` または `Armor <= 0`

## 4. コマンド体系

WEAPON:

- `Main Gun`（単体高火力、Main Ammo消費）
- `Sub Gun`（全体/ランダム複数ヒット）
- `S-E`（選択S-E挙動、S-E Ammo消費）

TERMINAL:

- `Analyze`（敵情報/相性開示、Signal消費）
- `Talk`（trust/interest/pressure操作）
- `Contract`（契約窓が開いている対象のみ有効）

DRIVE:

- `Ram`（体当たり、Armor消費）
- `Guard`
- `Escape`

UI仕様:

- コマンドはクリックで**即実行**
- キーボード: `↑↓` コマンド / `←→` ターゲット / `Enter` 実行

## 5. Affinity

属性軸:

- `ballistic`
- `suppressive`
- `impact`
- `signal`
- `talk`

評価:

- `weak`
- `normal`
- `resist`

Analyze済み敵は相性が表示され、戦闘判断（ダメージ/交渉効率）に影響します。

## 6. Approach Phase

接敵前に `NAVI Scan` を実行し、成功時は以下を選択:

- `Preemptive Main Gun`
- `Hit-and-Run Ram`
- `Silent Coast`
- `Open Channel`

失敗時は不利状態で接敵（Ambush系ペナルティ）。

## 7. Stage Route / Event Pool

Run中のルート進行は、既存の `gamePhase` を保ったまま `routeState` でStage route graph上の位置を持ちます。

`routeState`:

- `stageRouteId`: 現在のStage route graph ID
- `currentNodeId`: 現在node
- `visitedNodeIds`: 通過済みnode
- `currentEventId`: NAVI表示に使うevent ID

データ配置:

- Stage構成: `public/stages/index.yaml` + `public/stages/stage_1.yaml`
- Event pool: `public/events/index.yaml` + `public/events/*_events.yaml`
- loader: `src/stageConfig.ts`, `src/eventConfig.ts`
- graph/helper: `src/app/state/routeGraph.ts`
- route遷移: `src/app/state/routeReducer.ts`
- NAVI表示: `src/app/components/EventPanels.tsx`, `src/app/components/command/RouteCommands.tsx`

Stage 1は小さなgraphで、`route_choice` nodeから `salvage / signal / push_forward / return_gate` の候補を提示します。NAVIの情報精度はSignal、`scan_boost`、AI NAVI support/contractで変わり、低Signalではrisk/rewardや本文が一部 `UNKNOWN` になります。

Event追加方針:

- IDは `snake_case`
- `pool` は `route.stage_1`, `salvage.stage_1`, `anomaly.stage_1` など `<kind>.<stage_id>` を基本にする
- 本文、tags、effects、routeChoice は `public/events` 側に置く
- React側にイベント本文や分岐条件を直書きしない
- 1 poolにつき少数の短文イベントを足し、低リスク/高リスク/解析/交渉/補給の役割を混ぜる

Fallback:

- Stage/Event configが欠損した場合は builtin fallback を使う
- Stage graphが有効でない場合は既存の固定 route choice 表示に戻る
- restore時に壊れたnode参照があれば安全な `routeState` に戻す
- Stage 1以外は、明示接続するまで従来進行を維持する

## 8. Devil / Encounter

現在の敵プロファイル（EncounterId）:

- `whisper_broker`
- `roadside_phone`
- `pixie_shibuya_glow`
- `foxfire_navi`
- `no_face_taxi_passenger`
- `silent_shape`
- `abandoned_ai_navi`
- `road_reaper`
- `toll_gate_saint`

敵は `HP / temperament / intent / trust / pressure / interest / affinity` を持ちます。

## 9. Garage / Midnight Bay

Result後に遷移可能。主機能:

- Loadout選択（Main Gun / Sub Gun / S-E / Contract Support）
  - locked装備は選択不可
  - unlock理由は短く表示
- Growth購入
  - Skill: `ram_control / gunnery / scan_boost / translation_assist`
  - Vehicle: `fuel_tank / armor_plating / ammo_rack / se_rack / signal_antenna / noise_filter / daemon_bus`
- 次Run開始時の初期リソースプレビュー
- Story Log Archive
- Autoplay Lab

## 9.1 Progression / Unlock

現行の進行は、装備を大量配布するツリーではなく、Runで「見つけて持ち帰る」軽量unlockです。

Unlock対象:

- Main Gun
- Sub Gun
- S-E
- Contract Support
- Vehicle Upgrade

初期解放:

- `light_cannon`
- `hood_mg`
- `signal_harpoon`
- `support: none`
- 基本Vehicle Upgrade: `fuel_tank / armor_plating / ammo_rack / se_rack`

解放ルート:

- purchase: Garageで Credits / Driver XP / M.O.E. Sync を使う
- milestone: `clear_stage_1`, `clear_stage_2`, `story_logs_2` など
- rare salvage: `blueprint_signal_antenna` などをSalvage Laneから持ち帰る
- contract milestone: `contract_temperament_machine`, `contract_temperament_lonely`
- story log: `LOG_04` など特定ログ回収
- boss clear: Boss clear報酬

データ配置:

- 基本データ: `src/game/catalogs.ts`
- 数値: `public/balance.yaml`
- unlock条件: `public/progression.yaml`
- 文言: `public/dialogue.yaml`
- unlock判定: `src/game/progression.ts`

## 10. Story Progression（軽量）

StoryState:

- `chapter`
- `recoveredLogs`
- `moeMemory`
- `previousDriverClues`

Resultで回収ログを表示し、Garageでアーカイブ参照可能。

## 11. Autoplay Lab

Garage内で複数Runを自動実行し、バランス検証用集計を出力:

- 勝率
- Result内訳
- 平均リソース残量
- 平均Encounter/Contract/Salvage

## 12. 非スコープ（現状）

- 長編ADV分岐
- 永続セーブ（localStorage）
- 複雑なショップ/経済
- 属性の反射/吸収/無効
- 悪魔合体や大規模育成ツリー
