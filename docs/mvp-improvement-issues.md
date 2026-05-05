# DEMON TERMINAL DRIVE MVP 改善Issue案

> 注記（2026-05更新）  
> このファイルは「将来改善のバックログ草案」です。  
> 一部項目は旧仕様（ノード中心ループ）ベースで書かれており、現行のRun-first実装とは差分があります。  
> 現在仕様は `README.md` と `docs/game-design.md` を正としてください。

## Issue Title
ゲームループ: ノード解決のテンポ改善（自動解決オプション追加）

## Background
現状は `MOVE` 後に必ず `Resolve Node` を押す2段階操作で進行するため、定型ノード（road/signal/wreck/combat/unknown）で入力回数が増え、周回テンポが落ちる。`src/App.tsx` では `phase: 'node'` を経由して明示解決している。  

## Goal
定型ノードでは「移動時に即時解決」できるトグルを追加し、周回あたりのクリック数を削減する。

## Scope
- Stateに `autoResolveNode: boolean` を追加（初期値ON）
- HeaderまたはCenter panelにトグルUI追加
- `MOVE` 時に `entity` / `return_gate` 以外は自動で `RESOLVE_NODE` 相当を実行
- ログ文言を「自動解決」でもわかるように調整

## Acceptance Criteria
- ON時、road/signal/wreck/combat/unknownへ移動すると追加クリックなしで結果が反映される
- OFF時、従来どおり `Resolve Node` が必要
- entity と return_gate の挙動は既存仕様のまま

## Out of Scope
- 難易度調整
- 新ノードタイプ追加

---

## Issue Title
交渉システム: 選択肢ごとの成功率を全ボタンに明示する

## Background
現状UIでは `Success(Offer)` のみ表示され、`sync/threaten/listen` の成功率はユーザーが推測する必要がある。内部では `getNegotiationChance` でアプローチ別補正を計算済み。

## Goal
交渉4選択肢それぞれの成功率を可視化し、意思決定可能性を高める。

## Scope
- 4アプローチ分の成功率を計算して表示
- 各ボタンラベルに `%` を併記（例: `Sync Logic (78%)`）
- 成功率表示を1箇所に集約し、表記揺れをなくす

## Acceptance Criteria
- negotiation画面で4選択肢すべての成功率が同時に確認できる
- `signal` / 契約 / 失敗回数 / tone 変化で表示値が即時更新される

## Out of Scope
- 成功率ロジックそのものの再設計
- 新しい交渉アプローチの追加

---

## Issue Title
契約モジュール: 保有上限UIと重複取得時フィードバックを追加する

## Background
契約候補は未所持プールから選ばれるが、全契約取得後は先頭契約にフォールバックするため、プレイヤー視点で「なぜ同じ契約候補が出るか」が不透明。

## Goal
契約保有状態を明示し、重複候補時の挙動を説明して納得感を上げる。

## Scope
- 契約パネルに `x / 3` の保有数を表示
- 全契約取得済み時は交渉報酬文言を「契約ではなく取引優先」に切替
- ログに「全契約取得済み」のシステムメッセージ追加

## Acceptance Criteria
- 画面上で現在の契約保有数が常時確認できる
- 全契約取得後のentity解決時、重複契約が実質報酬にならないことが明示される

## Out of Scope
- 契約種類の追加
- 契約効果のバランス調整

---

## Issue Title
車両ビルド: 契約効果の適用箇所をUIでハイライトする

## Background
契約効果は内部で反映されるが、例えば `silent_shape` の被ダメ軽減や `abandoned_ai_navi` の燃費改善が、どの結果に影響したか一目で分かりづらい。

## Goal
契約による差分をログ/ステータスで可視化し、ビルド選択の手応えを強化する。

## Scope
- ノード解決ログに「契約補正」を追記（例: `Combat: Armor-2 (Silent Shape)`）
- Fuel消費時に基礎値と補正後値を表示
- 該当契約名を短タグで表示

## Acceptance Criteria
- 契約が影響したイベントで、補正前後または補正理由がログで判別できる
- 契約未装備時は従来ログの可読性を損なわない

## Out of Scope
- 新しいビルドスロット機能
- 効果値の変更

---

## Issue Title
UI/UX: Route Map ノードの状態凡例を追加する

## Background
`current/selectable/reached/revealed/unreached` の視覚差はあるが、初見では意味が読み取りづらい。

## Goal
Route Mapの状態意味を短時間で理解できるようにする。

## Scope
- Route Map下部に凡例追加（5状態）
- 色だけでなくラベル/アイコン併記
- キーボードフォーカス時の視認性を改善

## Acceptance Criteria
- 初見プレイヤーが凡例を見るだけで選択可能ノードを判別できる
- 凡例はレイアウト崩れなくモバイル幅でも表示される

## Out of Scope
- マップ構造そのものの変更
- 新アニメーション追加

---

## Issue Title
世界観演出: M.O.E.ログにイベント別テンプレートを追加する

## Background
現在のM.O.E.メッセージは有用だが種類が少なく、周回時に演出の反復感が出やすい。

## Goal
イベント別に短文テンプレートを追加し、世界観維持とリプレイ時の新鮮さを向上する。

## Scope
- road/combat/entity失敗/return_gate で各2〜3種の文言を追加
- 同一文連続を避ける簡易ローテーション実装
- 文言を定数配列へ分離

## Acceptance Criteria
- 同種イベントが連続しても同一M.O.E.文言が固定で出続けない
- 既存ログ分類（warning/contract/damage/system）を壊さない

## Out of Scope
- ボイス・SE追加
- 大規模シナリオ分岐

---

## Issue Title
テスト: 交渉成功率計算のユニットテストを追加する

## Background
`getNegotiationChance` は複数要因の合算ロジックで、将来改修時の退行リスクが高い。

## Goal
主要分岐（signal補正、契約補正、失敗ペナルティ、tone補正、上下限clamp）をテストで固定化する。

## Scope
- 計算関数をテスト可能な形で分離 export
- Vitest導入（最小構成）
- 5〜8ケースのユニットテスト追加

## Acceptance Criteria
- `npm test` で成功率計算の主要ケースが自動検証される
- clamp下限5/上限95の挙動がテストで保証される

## Out of Scope
- E2Eテスト
- UIスナップショットテスト

---

## Issue Title
データ拡張性: ノード定義を外部データ化（定数ファイル分離）

## Background
現状 `baseNodes` が `App.tsx` に直書きされており、ルート追加や章構成拡張時にUIロジックと競合しやすい。

## Goal
ノードデータを専用ファイルへ分離し、将来の章追加やバリエーション管理を容易にする。

## Scope
- `src/data/nodes.ts` を新設し `baseNodes` を移動
- 型定義を共通化（必要なら `src/types/game.ts`）
- `App.tsx` はimport参照へ変更

## Acceptance Criteria
- 挙動変更なしで既存ルートが動作する
- ノード編集がUIコンポーネント変更なしで可能になる

## Out of Scope
- JSONローダー実装
- 動的生成マップ

---

## Issue Title
コード構造: reducerロジックをゲームドメイン関数へ分割する

## Background
`App.tsx` に状態遷移・計算・表示が集中し、可読性と保守性が低下している。

## Goal
`reducer` と純粋関数を分離し、1ファイルの責務を軽量化する。

## Scope
- `src/game/reducer.ts` へ reducer と action/state型を移動
- `src/game/rules.ts` に交渉率計算・ログ分類等の純関数を分離
- `App.tsx` はUI組み立て中心に整理

## Acceptance Criteria
- 既存動作を維持したまま `App.tsx` 行数を有意に削減できる
- 型エラーなく `npm run build` が通る

## Out of Scope
- 状態管理ライブラリ導入
- 大規模アーキテクチャ刷新
