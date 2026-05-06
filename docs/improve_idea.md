# Improve Ideas (Current Gap Review)

最終更新: 2026-05-06  
対象: 現在の `Run-first` 実装（React + TS + Vite）

---

## 0. 結論サマリ

現状は「遊べるMVP」として十分強いです。  
一方で、次段階へ進むうえでの不足は以下に集約されます。

1. **データ外部化が途中**（DevilはYAML化できたが、他はまだ `App.tsx` 直書きが多い）
2. **`App.tsx` が肥大**（4,000行超、ロジック変更時の退行リスクが高い）
3. **イベント連動がログ文字列依存**（Telemetry/Save更新の一部が brittle）
4. **テスト不足**（バランス調整/Autoplayを回すほど自動検証が必要）
5. **YAMLパーサ重複**（manifest/balance/devils で同系コードを複製）

---

## 1. 優先度 High（すぐ効く）

### H1. 外部設定の段階2（YAML化の拡張）
- 現状:
  - `public/devils.yaml` は導入済み
  - ただし以下は `App.tsx` に残存
    - `routeIntelCatalog`
    - `routeLogCatalog`
    - `rewardCatalog` / `emergencyRewardCatalog`
    - `storyLogCatalog`（一部）
- 改善:
  - `public/routes.yaml` / `public/rewards.yaml` / `public/story.yaml` へ分割
  - 編集者がコードを触らずに調整可能にする

### H2. Devil YAMLの配列対応
- 現状:
  - `lineups` が `enc1: "a,b"` 形式（CSV文字列）
  - 理由: 現在の軽量YAMLパーサが配列を直接扱っていない
- 改善:
  - `enc1: ["pixie_shibuya_glow", "whisper_broker"]` を受けられるようにする
  - CSV形式は後方互換として残す

### H3. Support Daemon連動の未実装フック
- 現状:
  - 実効果あり: `Roadside Phone`, `Silent Shape`, `Abandoned AI Navi`
  - 演出のみ: `Pixie`, `Foxfire Navi`
- 改善:
  - `Pixie`: reward/route提示に軽いバイアス
  - `Foxfire`: route riskヒントの精度上昇

### H4. Save/Telemetry更新の非ログ依存化
- 現状:
  - 一部の保存/計測更新がログ文言のパースで発火
- リスク:
  - 文言変更で計測・蓄積が壊れやすい
- 改善:
  - reducer内で `domain event` を発行
  - telemetry/saveはそのイベントを購読して更新

---

## 2. 優先度 Medium（安定性・開発効率）

### M1. `App.tsx` 分割の第2段階
- 現状: `src/App.tsx` が 4,000行超
- 改善案:
  - `src/game/reducer.ts`
  - `src/game/encounter.ts`
  - `src/game/approach.ts`
  - `src/game/rewards.ts`
  - `src/game/story.ts`
  - `src/game/logging.ts`

### M2. YAMLローダの共通化
- 現状:
  - `assetManifest.ts` / `balanceConfig.ts` / `devilConfig.ts` に同種パーサ重複
- 改善:
  - `src/config/yamlLite.ts` を作成して共通化
  - パース仕様差分（配列/bool/number）を1箇所で管理

### M3. 型安全なID管理
- 現状:
  - 一部でID文字列を手打ち (`route ids`, `memory ids`, `log labels`)
- 改善:
  - `src/game/ids.ts` に定数集合を集約
  - UI/Reducer/Saveの参照ズレを防ぐ

### M4. UI状態管理の軽量整理
- 現状:
  - UIトグルやデバッグ機能が `App` に集中
- 改善:
  - `usePlaytestPanel`, `useSaveTools`, `useAutoSave` など custom hook 化

---

## 3. 優先度 Medium（ゲーム体験）

### M5. 3ステージ進行の差別化強化
- 現状:
  - stageはあるが、ステージ固有の敵編成/報酬/物語差分はまだ限定的
- 改善:
  - stage別lineupテーブル
  - stage別boss trait追加
  - stage別M.O.E.台詞セット

### M6. Reward設計の選択圧改善
- 現状:
  - 3択だが、状況次第で実質最適が固定化しやすい
- 改善:
  - 条件付き候補（低Fuel時はFuel候補確率上昇など）
  - “短期救済” と “中期投資” の混在

### M7. Garageの中長期モチベーション
- 現状:
  - 成長はあるが、記録ベースの達成感表示はまだ薄い
- 改善:
  - stage/boss別実績
  - daemonリンク履歴
  - “次Run目標”の自動提案

---

## 4. 優先度 Low（仕上げ）

### L1. 画像/音アセット検証UI
- 現状:
  - フォールバックは動くが、manifestの検証は起動時に見えづらい
- 改善:
  - `ASSET CHECK` パネル（missing/warn/ok）
  - パスミス時の具体的表示

### L2. 文言データの多言語/差し替え対応
- 現状:
  - 日本語/英語混在で `App.tsx` 直書きが多い
- 改善:
  - `public/text/*.yaml` 化
  - フレーバー文言の差し替えコスト低減

---

## 5. 技術負債メモ（現時点）

- `src/App.tsx`: 4175 lines
- `src/styles.css`: 2444 lines
- YAML-lite parser 実装の重複: 3箇所

この規模感自体はMVPとして問題ないですが、  
**次の5〜10機能追加で事故率が上がる手前** に来ています。

---

## 6. おすすめ実装順（短期ロードマップ）

1. **H2** Devil lineup配列対応（小さく効果大）
2. **H1** routes/rewards/story のYAML化
3. **M2** YAMLローダ共通化
4. **H4** Save/Telemetryのイベント依存化
5. **M1** `App.tsx` 分割第2段階

---

## 7. 完了条件（このドキュメントの使い方）

このファイルは backlog seed として運用し、  
実装着手時に各項目を Issue 化して以下を紐づける:

- 対象ファイル
- 受け入れ条件
- 影響範囲（Save/Telemetry/Balance）
- `npm run build` と最低限の手動確認項目

