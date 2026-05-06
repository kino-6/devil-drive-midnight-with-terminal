# Scenario Authoring Workflow

このドキュメントは、**人間 + ローカルAI** で安全にシナリオを育てるための運用ガイドです。

## Directory Policy

```txt
drafts/
  scenarios/
    generated/   # AIの生出力・作業中
    reviewed/    # 人手レビュー済み
public/
  scenarios/
    encounters/
    route-events/
    index.json
```

### Tracking policy

- `drafts/scenarios/generated/`
  - 基本ローカル作業用（`.gitignore` で除外）
  - 失敗出力や試行結果を気軽に保持
- `drafts/scenarios/reviewed/`
  - レビュー済みの候補（Git管理推奨）
- `public/scenarios/`
  - 実際にゲームが読む本番データ

---

## End-to-End Flow

1. **Generate draft with local AI**
   - `npm run scenario:generate -- --type encounter --id pixie_shibuya_glow`
2. **Validate JSON**
   - `npm run scenario:validate`
3. **Human edits text**
   - tone/長さ/文脈を整える
4. **Move to reviewed**
   - `drafts/scenarios/reviewed/`
5. **Promote to public**
   - `public/scenarios/...` へ反映
6. **Validate again**
   - `npm run scenario:validate`
7. **Playtest in game**
   - 実UIで可読性・雰囲気・導線を確認

---

## Scenario Review Checklist

- [ ] JSON is valid
- [ ] Lines are short enough for UI
- [ ] Tone matches Night Loop
- [ ] M.O.E. voice is consistent
- [ ] Demon voice is distinct
- [ ] No balance numbers changed
- [ ] No copyrighted references
- [ ] No real-person sensitive references
- [ ] Works in-game

---

## Suggested Promotion Rule

`generated -> reviewed -> public` の3段階を守ると、  
「AI生出力がそのまま本番に混入する」事故を防げます。

- generated: “素材”
- reviewed: “編集済み候補”
- public: “出荷対象”

---

## Index File (`public/scenarios/index.json`)

- ローダーは `index.json` があればそこからデフォルトpackを解決
- 無効/欠損時は `night-loop-demo.scenario.json` にフォールバック
- 将来は pack切替・A/Bテストにも流用可能

---

## Notes

- このワークフローはCMSやDBを必要としません
- すべてローカルファイルベース
- 小規模チーム/個人開発での反復速度を優先
