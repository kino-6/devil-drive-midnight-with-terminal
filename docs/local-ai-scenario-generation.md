# Local AI Scenario Generation

## Purpose

このドキュメントは、ローカルAI（Ollama / LM Studio / OpenAI互換ローカルサーバー）で  
`public/scenarios` 向けのシナリオ断片を安全に生成するためのガイドです。

- ゲーム本体はAPIを呼びません
- 外部サービス依存は追加しません
- 生成はオフラインの“執筆支援”用途です

---

## Target Files

- Main pack:
  - `public/scenarios/night-loop-demo.scenario.json`
- Optional encounter fragments:
  - `public/scenarios/encounters/*.json`

Schemaの基礎は `docs/scenario-system.md` と `src/scenario/scenarioTypes.ts` を参照してください。

---

## Canonical Style Guide

### Tone

- midnight Tokyo expressway
- demon terminal
- occult electronic
- retro JRPG
- too cyberpunk にしない
- eerieだが pure horror にはしない
- demonは cute / strange / unsettling の幅を持たせる

### Character Voice Rules

- **M.O.E.**:
  - 冷静な車載ナビAI
  - 役に立つが、少し不穏
  - 過剰に感情的にしない
- **Demons**:
  - 声色を分ける
  - 短文で個性を出す
- **Radio / AM 666.0**:
  - 断片的・不確実・ノイズ混じりの雰囲気
- 現代スラングは極力避ける（必要ならキャラ限定）
- lore長文は避ける（1〜2文）

### UI Length Rules

- 1行は短め（ダッシュボードUIで読める長さ）
- 基本1〜2文
- 長文説明は避ける

---

## Generation Constraints (Must)

ローカルAIへのプロンプトには必ず以下を含めてください。

1. **JSON only**
2. 既存 `ScenarioPack` schema準拠
3. バランス値（damage, ammo, rate等）は変更しない
4. 行長を短く保つ
5. 著作権参照（既存IP名・固有台詞コピー）禁止

---

## Recommended Workflow

1. `tools/prompts/*.prompt.md` からテンプレをコピー
2. ローカルAIでJSON断片を生成
3. 人間がレビュー（下のチェックリスト）
4. `public/scenarios/...` に反映
5. `npm run build` と実プレイで確認

---

## Optional Local AI CLI

開発者が明示的に実行する場合のみ利用する補助CLIです。  
ゲームランタイム（ブラウザ）からは呼び出しません。

### Scripts

- `npm run scenario:generate -- --type encounter --id pixie_shibuya_glow`
- `npm run scenario:generate -- --type moe --id garage`
- `npm run scenario:generate -- --type route --id signal_tunnel_01`
- `npm run scenario:validate`

### Direct command (if needed)

- `node --experimental-strip-types tools/generate-scenario.ts --type encounter --id pixie_shibuya_glow`
- `node --experimental-strip-types tools/validate-scenarios.ts`

### Environment Variables

- `LOCAL_AI_BASE_URL`  
  default: `http://localhost:1234/v1`
- `LOCAL_AI_MODEL`  
  default: `local-model`
- `LOCAL_AI_API_KEY`  
  default: `not-needed`

### Endpoint Examples

- LM Studio (OpenAI-compatible):
  - `http://localhost:1234/v1`
- Ollama OpenAI-compatible:
  - `http://localhost:11434/v1`
- LocalAI:
  - `http://localhost:8080/v1`

### Output Paths

- Generated draft JSON:
  - `drafts/scenarios/generated/<id>.json`
- If model output is invalid JSON/schema:
  - `drafts/scenarios/generated/<id>.raw.txt`

### Safety

- ローカルAIサーバーが落ちていても `npm run build` は影響なし
- 自動送信はしない（CLI実行時のみ通信）
- 既存の有効draftは上書きしない

---

## Human Review Checklist

- [ ] JSONとして妥当
- [ ] `ScenarioPack` schemaに合う
- [ ] バランス値が含まれていない / 変更されていない
- [ ] 長すぎる行がない
- [ ] 著作権上問題のある参照がない
- [ ] トーンがゲームに合う
- [ ] どのフェーズで使う文か明確

---

## Example JSON Fragments

### Encounter: Pixie // Shibuya Glow

```json
{
  "id": "pixie_shibuya_glow",
  "name": "Pixie // Shibuya Glow",
  "intro": [
    "A tiny city-light pixie skips across the lane markers."
  ],
  "talk": {
    "success": [
      "The pixie tilts its head, then mirrors your turn signal."
    ]
  },
  "contract": {
    "success": [
      "PIXIE LINK: lane lights flicker in a playful rhythm."
    ],
    "failure": [
      "The pixie laughs and dissolves into brake-light noise."
    ]
  }
}
```

### Encounter: Roadside Phone

```json
{
  "id": "roadside_phone",
  "name": "Roadside Phone",
  "intro": [
    "A payphone rings where there should be no shoulder."
  ],
  "contract": {
    "success": [
      "AM 666.0 LINK: a child voice counts your remaining exits."
    ]
  }
}
```

### M.O.E. lines

```json
{
  "prologue.open": [
    "午前0時。夜環、開いたよ。浅層だけ潜って帰ろう。"
  ],
  "approach.success": [
    "先に見つけた。どう入る？"
  ],
  "result.safe_return": [
    "持ち帰れたね。次はもう一段、深く行ける。"
  ]
}
```

---

## Optional Future CLI Plan (No runtime integration yet)

将来の拡張候補:

- `tools/generate-scenario.ts` に対話モードを追加
- `--merge` オプションで既存packへ安全マージ
- fragment自動分類（encounter / route / moe）
