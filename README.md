# Devil Drive: Midnight with terminal

> 午前0時にだけ開く巨大道路迷宮「夜環 / Night Loop」に潜る、車載ダッシュボード型コマンドRPG。

React + TypeScript + Viteで作られた、**Run-first** の短編MVPです。  
戦闘、交渉、契約、帰還判断、Garage積み替え、Autoplay検証までを1画面トーンで遊べます。

## 現在の実装範囲（2026-05時点）

- Run-first進行（Prologueから即Run）
- フェーズ進行:
  - `prologue -> approach -> encounter -> reward -> route_choice -> encounter -> boss_preview -> boss_encounter -> return_gate -> result`
  - 途中帰還 / game over / garage 遷移あり
- Windshield Encounter View（複数Devil表示）
- RPG Command:
  - `Main Gun / Sub Gun / S-E`
  - `Analyze / Talk / Contract`
  - `Ram / Guard / Escape`
- Affinity（`weak / normal / resist`）とAnalyze連動
- Approach Phase（NAVI Scan成功/失敗、先制選択）
- Demon Terminalログ（擬似タイムコード + 種別色）
- M.O.E.ラジオ台詞（フェーズ・状況連動）
- Vehicle Dashboard:
  - Fuel / Armor / Signal / Main Ammo / S-E Ammo
- Garage (`GARAGE // MIDNIGHT BAY`)
  - Loadout積み替え（Main/Sub/S-E/Support）
  - Growth購入（Skill / Vehicle Tuning）
  - Story Log Archive
  - AUTOPLAY LAB
- Story断片ログ回収（Result反映 + Garage閲覧）
- YAMLベースの外部設定:
  - `public/balance.yaml`（ゲームバランス）
  - `public/devils/index.yaml` + `public/devils/*.yaml`（敵プロファイル/相性/ラインナップ/支援ログ）
  - `public/assets/manifest.yaml`（BGM/SFX/画像/UI差し替え）

## セットアップ

```bash
npm install
```

## 起動（開発）

```bash
npm run dev
```

通常は `http://localhost:5173` で確認できます。

## Debug Mode（検証用）

開発起動中はURLクエリで初期状態を指定できます。Fun Test ModeやGarageの確認に使います。

- `http://localhost:5173/?debugState=garage`
- `http://localhost:5173/?debugState=fun_pixie`
- `http://localhost:5173/?debugState=fun_reaper`
- `http://localhost:5173/?debugState=fun_toll`

`funTest` でも同じテストEncounterへ直行できます。

- `http://localhost:5173/?funTest=pixie_talk`
- `http://localhost:5173/?funTest=road_reaper_combat`
- `http://localhost:5173/?funTest=toll_gate_boss`

`debugState` または `funTest` が付いている場合は、Debug/Utility panelsも初期表示されます。

## 本番ビルド

```bash
npm run build
```

## ビルド + ローカルプレビュー起動

```bash
npm run start
```

`npm run start` は以下を実行します。

1. `npm run build`
2. `vite preview --host localhost --port 4173 --strictPort`

`4173` が使用中の場合はエラー停止するため、先にポート利用プロセスを終了してください。

## 操作（Encounter中）

- `↑ / ↓`: コマンド選択
- `← / →`: ターゲット切替
- `Enter`: 選択中コマンド実行
- マウス/タップ: 各コマンドを直接実行（即決定）

## AutoPlay（バランス検証）

1. Garageへ移動
2. `AUTOPLAY LAB` で Runs / Strategy を設定
3. `RUN AUTOPLAY`

主な出力:

- Result内訳（Boss Cleared / Boss Avoided / Early Return / Vehicle Disabled）
- 勝率
- 平均 Encounter / Contract / Salvage
- 平均 Fuel / Armor / Signal / Main Ammo / S-E Ammo

## YAML設定

### 1) バランス設定

- ファイル: `public/balance.yaml`
- 読み込みタイミング: 起動時
- 主な調整項目:
  - 初期リソース（Fuel/Armor/Signal）
  - Scan/Talk/Contract/Escape確率
  - Affinity倍率（weak/resist）
  - 武装ごとの `damage / ammo / cost`
  - AutoplayのRuns範囲と探索傾向

Garageの `AUTOPLAY LAB` は、この設定値を使ってシミュレーションされます。

### 2) アセット設定

- ファイル: `public/assets/manifest.yaml`
- 対象:
  - `media.bgm` / `media.sfx.*`
  - `images.enemies.*`
  - `images.player` / `images.moe` / `images.logo`
  - `images.ui.windshield` / `images.ui.roadOverlay`
  - `ui.cssVars`（テーマ色）

すべてフォールバック実装済みで、指定アセットが見つからない場合は既存描画（SVG/既定UI）を使用します。

### 3) Devilデータ設定

- ファイル: `public/devils/index.yaml`（分割本体は `public/devils/*.yaml`）
- 読み込みタイミング: 起動時
- 主な調整項目:
  - `lineups`（enc1 / enc2 / boss）
  - `profiles`（表示名、脅威、Signal文言、契約可否）
  - `templates`（HP、temperament、affinity、契約モジュール）
  - `support`（Active Support Daemonの効果文、リンクログ、stability）

`public/devils/index.yaml` や include 先が欠落・不整合の場合は、ビルトイン定義へ自動フォールバックします。

## ドキュメント

- 仕様概要: [docs/game-design.md](docs/game-design.md)
- 改善バックログ（草案）: [docs/mvp-improvement-issues.md](docs/mvp-improvement-issues.md)
- LLM/Agent編集導線: [docs/llm-code-map.md](docs/llm-code-map.md)
- Save仕様: [docs/save-system.md](docs/save-system.md)
