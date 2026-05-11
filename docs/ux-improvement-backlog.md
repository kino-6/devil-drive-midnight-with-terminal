# UX Improvement Backlog

このファイルは実装順のTodoだけを置く。背景、判断基準、過去の完了項目は `docs/ux-improvement-reference.md` を参照する。UIの文字量は `docs/steering.md` の方針を優先する。

## Todo

1. [x] 戦闘: `Action` 中心の敵カードに整理する
   - [x] 敵カードの常時表示を `HP / Analyze / Action` に絞る。
   - [x] `Next` 予測は hover / details / Analyze深度が高い時だけに畳む。
   - [x] `Action` 行はアイコン + 行動名 + 影響チップ1つにする。
   - [x] `Action` の危険度を色で分ける。防御/待機は中立、リソース消費は警告、Armor/HP被害は危険。
   - [x] 未解析カードは `ACTION LOCKED` と不足理由を1行だけ出す。
   - [x] M.O.E.の助言は `Action` を読む一文に寄せる。

2. [x] 戦闘: Command hoverを `Action` への相性表示にする
   - [x] 選択中コマンドが敵の `Action` にどう噛み合うかだけを短く出す。
   - [x] 表示例は `Breaks Guard`, `Risk: Bargain cost`, `Safe into Guard` 程度に抑える。
   - [x] 与ダメ詳細や計算内訳は hover details / Terminal Log へ送る。

3. [x] Signal不足の損失プレビューを行動前に出す
   - [x] Route候補で伏せられる情報を短く表示する。
   - [x] Analyzeで読めない情報を短く表示する。
   - [x] Talkで増える支払い、または失う選択肢を短く表示する。

4. [x] M.O.E. Skill強化のBefore/AfterをGarageに出す
   - [x] `signal_tuning` などで改善される効果を明記する。
   - [x] 表示は `Route read +1`, `Scan stability +`, `Analyze variance down` 程度の短いチップにする。
   - [x] 文言はReactへ直書きせず、config / dialogue 側へ寄せる。

5. [x] Salvageを状況付き選択にする
   - [x] Salvageイベントに場所、制約、危険、拾える理由を短く持たせる。
   - [x] 候補カードは `効果 + 状況タグ` までに抑える。
   - [x] 今困っている資源を優先して強調する。

6. [x] Command予測の形式を統一する
   - [x] 攻撃、Talk、Route、Backtrackの行動前表示を `GAIN / COST / RISK` 系に揃える。
   - [x] 常時表示は必要最小限にし、詳細は hover / Terminal Log へ畳む。
   - [x] Commandボタンは選択中だけ短いサブラインを表示する。

7. [x] Resultに今回の判断ログを短く出す
   - [x] ResultPanelで3行程度の振り返りを表示する。
   - [x] 例: `Signal shortage hid 2 routes`, `Backtrack cost: Fuel`, `Safe Extract reached`。
   - [x] 詳細ログとは分け、次Runへの学びだけを残す。

8. [x] Garage初期体験をLaunch Readiness化する
   - [x] 初回Garageは `Fuel / Armor / Signal / Ammo / Return` の準備状態をアイコン中心で見せる。
   - [x] 初回、帰還後、出撃確認、装備変更でM.O.E.文言プールを分ける。
   - [x] Locked装備はカード面積を抑え、購入可能/未達成の違いだけ見せる。
   - [x] Debug Save表示は起動debug時だけ見えるようにする。

9. [x] Terminal / Dashboard の役割を整理する
   - [x] Windshieldは敵/Map/状況の視覚情報に寄せる。
   - [x] Commandは行動選択と必要最小限の結果予測に寄せる。
   - [x] M.O.E.は重要な助言1文に寄せる。
   - [x] Terminal Logは履歴と詳細に寄せる。
   - [x] Vehicle Dashboardは残量と危険状態に寄せ、警告状態以外は主張を少し下げる。

## Done

- [x] 戦闘: ダメージポップ、Damage Range、Analyze完了表示を追加する。
- [x] 戦闘: 敵ごとの戦術差とAnalyze後の予測チップを追加する。
- [x] Route: アイコン中心のMap、Signal不足時のマスク、クリック可能ノード選択を追加する。
- [x] 帰還: Return Point、Backtrackリスク、Resultでの帰還種別表示を追加する。
