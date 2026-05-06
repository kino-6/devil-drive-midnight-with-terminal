# LLM Code Map (Agent Guide)

このファイルは、LLM/Agent がこのリポジトリを編集するときに迷わないための導線です。
まずここを読んでから編集してください。

## 1) どこに何があるか

- `src/App.tsx`
  - ゲーム本体の reducer / phase 遷移 / 画面合成
  - まず壊しやすい領域。**UI見た目変更だけ**なら reducer に触らない。
- `src/game/types.ts`
  - ゲーム内で使う主要型の集約
  - 新規フェーズ/コマンド/状態を追加するときはここを先に更新
- `src/components/DashboardWidgets.tsx`
  - ダッシュボード系の小UI（メーター・ランプ）
  - 表示コンポーネントの切り出し先
- `src/saveSystem.ts`
  - localStorage セーブ、Route Log / Memory / Archive 永続化
  - 永続データ仕様変更時は `version` と normalizer に注意
- `src/telemetry.ts`
  - ローカルプレイテスト計測とレポート生成
- `src/balanceConfig.ts` + `public/balance.yaml`
  - バランス値の既定値と外部YAML上書き
- `src/devilConfig.ts` + `public/devils/index.yaml` + `public/devils/*.yaml`
  - Devilプロファイル/相性/出現ラインナップ/Support演出ログの外部YAML上書き
- `src/assetManifest.ts` + `public/assets/manifest.yaml`
  - 差し替えアセット定義とフォールバック解決
- `src/dialogueConfig.ts` + `public/dialogue.yaml`
  - M.O.E.台詞・hoverヒントなど作中文言の外部YAML管理
  - `dialogue.yaml` は「利用場面コメント」を併記して運用

## 2) 変更タスク別の推奨編集先

- 戦闘ロジック調整:
  - `src/App.tsx` reducer と関連 helper
  - 数値は可能なら `balance.yaml` に寄せる
- 新UIコンポーネント:
  - 先に `src/components/*` を作る
  - `App.tsx` には composition だけ残す
- 永続化（収集/履歴/進行）:
  - `src/saveSystem.ts` に API を追加
  - `App.tsx` は呼び出しのみ
- 分析/プレイテスト:
  - `src/telemetry.ts` に集約

## 3) App.tsx を安全に触るルール

1. reducer の `Action` と `State` を同時に確認する。  
2. `gamePhase` 遷移を変更したら、以下を必ず確認する。  
   - telemetry emit (`useEffect` phase watcher)
   - save record finalize
   - Garage / Result の導線
3. ログ文字列依存の処理があるので、既存ログ文言の変更は慎重に行う。  

## 4) 段階的リファクタ方針

- Phase 1 (完了): 型と小UI部品の分離
- Phase 2 (次): `App.tsx` 内 helper を `src/game/*` へ移動
  - 候補: encounter生成、affinity計算、approach判定、autoplay判定
- Phase 3: reducer を `src/game/reducer.ts` に分離し、UI層から独立

## 5) 作業チェックリスト

- `npm run build` が通る
- 主要ループが崩れていない
  - Prologue -> Approach -> Encounter -> Reward/Route -> Boss/Return -> Result -> Garage
- セーブ読込失敗時にクラッシュしない
- telemetry/save の localStorage キーを壊していない
