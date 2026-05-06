# Scenario System (JSON Externalization)

## Purpose

ゲームロジックとテキストを分離するための最小基盤です。  
会話・導入文・ルートイベント文面を `public/scenarios` へ外出しし、コード変更なしで文面を更新できるようにします。

## File Locations

- Scenario types:
  - `src/scenario/scenarioTypes.ts`
- Loader + runtime helpers:
  - `src/scenario/scenarioLoader.ts`
- Built-in fallback pack:
  - `src/scenario/builtins.ts`
- External scenario (main):
  - `public/scenarios/night-loop-demo.scenario.json`
- Optional encounter fragments:
  - `public/scenarios/encounters/pixie_shibuya_glow.json`
  - `public/scenarios/encounters/roadside_phone.json`

## JSON Schema Overview

`ScenarioPack` の最小構造:

- `version` (現在は `1`)
- `id`
- `title`
- `moeLines?: Record<string, string[]>`
- `encounters?: EncounterScenario[]`
- `routeEvents?: RouteEventScenario[]`
- `storyScenes?: StoryScene[]`（今は土台のみ）

`EncounterScenario` の代表フィールド:

- `id`（例: `pixie_shibuya_glow`）
- `name`
- `intro?: string[]`
- `contract.success?: string[]`

## Fallback Behavior

- ファイルが存在しない / fetch失敗:
  - `builtInScenarioPack` を使用
- JSONが壊れている / スキーマ不正:
  - warningを出し、`builtInScenarioPack` を使用
- 空文字行:
  - 正規化時に除外

このため、scenarioファイルの不整合でゲームが落ちることはありません。

## Runtime Helpers

`src/scenario/scenarioLoader.ts`:

- `loadScenarioPack(path?)`
- `getScenarioLine(...)`
- `getEncounterScenario(id)`
- `getMoeLine(key, fallback?)`
- `getRouteEventScenario(id)`

## Current Integration Scope (Small/Safe)

今回の反映は限定的です:

1. Pixie / Roadside Phone の encounter intro を外部scenario優先
2. Pixie / Roadside Phone 契約成功ログを外部scenario優先
3. M.O.E. の一部フェーズ文面（prologue / boss preview / garage）を外部scenario優先
4. Route Choice で `signal_lane` の追加本文を外部scenarioから表示

## How to Add a New Encounter Scenario

1. `public/scenarios/night-loop-demo.scenario.json` の `encounters` に追加
2. `id` は既存 enemy profile id と一致させる
3. 必要なら `intro` / `contract.success` を追加
4. 起動後、該当遭遇でログ反映を確認

## What Should Stay In Code vs Scenario Data

Scenario向き:

- セリフ
- 導入文
- ルート説明文
- 雰囲気ログ

コード向き:

- ダメージ計算
- 成功率判定
- リソース増減
- phase遷移
- save/telemetry更新

この境界を守ると、物語拡張とバランス調整を並行しやすくなります。
