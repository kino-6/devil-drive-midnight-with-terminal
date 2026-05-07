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
  - runtime config のロード起点（assets / balance / devils / dialogue / scenario / conversation）

### 戦闘・進行ロジック（`src/app/state/`）
- `stateReducer.ts`
  - reducer本体、phase遷移、初期化、主要 helper
- `combatReducer.ts`
  - `EXECUTE_COMMAND` / `TALK_CHOOSE` を含む戦闘行動解決
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
2. `src/app/AppRoot.tsx`（emit 呼び出し点）

### 再現調査ログ変更
1. `src/reproLog.ts`
2. `src/app/AppRoot.tsx`（dispatch 経路）

### runtime config / loader変更
1. `src/app/hooks/useRuntimeConfigEffects.ts`
2. `src/*Config.ts`（`balanceConfig.ts`, `devilConfig.ts`, `dialogueConfig.ts`, `conversationConfig.ts`）

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

### 文言
- 汎用: `public/dialogue.yaml`（loader: `src/dialogueConfig.ts`）
- 会話強化: `public/conversations/index.yaml` + `public/conversations/*.yaml`（loader: `src/conversationConfig.ts`）
- シナリオ断片: `public/scenarios/**/*.json`（loader: `src/scenario/scenarioLoader.ts`）

### アセット
- `public/assets/manifest.yaml`
- resolver: `src/assetManifest.ts`

### ローカル調査データ（Git管理外）
- `.local/repro-logs/`
  - seed / action / random tape を保存するローカルワーク領域
  - `.gitignore` 対象
  - **通常の Codex 作業では読まない（ユーザーが明示したときのみ）**

---

## 4) 重要方針（必須）

- **AppRoot.tsx に新しいゲームデータ・長文文言・数値・敵定義を足さない。**
- 追加データは必ず YAML/JSON + loader 経由へ寄せる。
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

## 6) 今後の分割候補（次ステップ）

> すでに `CommandPanel / VehiclePanel / GaragePanel / UtilityPanels / EventPanels` は抽出済み。  
> 今後は「内部責務の再分割」を候補にする。

1. `CommandPanel` 内の phase別表示（encounter/garage/result）を更に小分割
2. `VehiclePanel` の resource/contract/support セクション分割
3. `GaragePanel` の stage/loadout/growth/archive の小分割
4. `UtilityPanels` の playtest/save/archive の小分割
5. `EventPanels` の phaseカード群の小分割
6. `AppRoot.tsx` の副作用/派生値を hooks/view-model へ継続移管

---

## 7) Codex作業時の最小チェック

1. 変更対象が UI / ロジック / データ のどれかを先に切り分ける
2. 変更先が `AppRoot.tsx` で本当に妥当か確認する（多くは別ファイル）
3. `npm run build` を実行
4. 主要ループ確認  
   `Prologue -> Approach -> Encounter -> Reward/Route -> Boss/Return -> Result -> Garage`
5. save/telemetry の localStorage キー互換を壊していないか確認
