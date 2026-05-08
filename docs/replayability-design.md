# Replayability Design

## Previous Run Summary

### Why this improves second-run motivation

`PREVIOUS RUN` is designed to answer, at a glance:

- what happened in the last run
- why the run ended (clear / early return / disable)
- what to try next

This short feedback loop reduces cognitive reset between runs and makes `Result -> Garage -> Next Run` feel intentional instead of random repetition.

### Data source

The summary is built from local save data (`src/saveSystem.ts`) and stored in browser `localStorage` only:

- key: `devil-drive-midnight.save.v1`

At run end, a `RunRecord` is persisted and later rendered in Garage.

### M.O.E. next-run suggestion

`buildMoeRunComment(record)` generates short guidance from the previous run record:

- armor depletion -> guard timing / armor rewards / support hint
- fuel depletion -> safer route / earlier return gate hint
- signal depletion -> analyze/reward economy hint
- no analyze -> affinity reveal recommendation
- no negotiation trace -> talk/contract recommendation
- boss avoided -> deep route prep recommendation
- boss cleared -> optimization / memory-log recommendation

### Current approximation notes

To avoid large refactors, some fields are approximate but stable:

- `contractsAcquired` is finalized using current contract modules at run end.
- `analyzedEnemies` and `defeatedEnemies` are collected incrementally during the run from encounter context/log-driven updates.
- `routeChoices` are collected from selected route events.
- `returnGateUsed` is inferred from end result type (`Early Return`, `Boss Avoided`, `Boss Cleared`).

These approximations are sufficient for replayability feedback and can be made stricter later without schema break.

## Demon Archive

### Persistent knowledge loop

Demon knowledge now persists across runs via local save data.  
This means `Analyze` has value beyond a single battle:

- first contact records the demon in archive
- analyze reveals profile-level knowledge
- affinity reveal persists for planning
- defeat / contract counts create lightweight collection goals

### Storage behavior

Archive data is written to local-only save (`devil-drive-midnight.save.v1`) using `touchDemonArchive`.

Updates happen when:

- encounter starts (seen count / timestamps)
- analyze succeeds (analyzed + affinityRevealed)
- enemy defeated (defeatedCount)
- contract registered (contractedCount)

### UI behavior

`ARCHIVE` toggle opens a compact terminal-style panel:

- name
- seen / defeated / contracted counts
- analyze status
- affinity reveal status
- optional affinity list (if revealed)

Unknown handling:

- never seen: not listed
- seen but not analyzed: limited info + "Profile locked. Use Analyze to reveal more."

## Route Log

### Why Route Log helps replayability

Route choice becomes meaningful when players can look back at where they actually went.
`ROUTE LOG` is a lightweight trail of lane decisions that helps answer:

- where runs tend to fail or stabilize
- which lane is usually picked under pressure
- how often players commit to deep routes vs early return

### Persistence behavior

Route entries are persisted in `save.routeLog` and updated when route actions happen:

- `salvage` -> `Scrap Yard PA`
- `signal` -> `Signal Tunnel`
- `push_forward` -> `Deep Toll Route`
- `return_gate` -> `Return Gate`
- `boss` -> `Deep Signal`

Each entry stores:

- first seen timestamp
- seen/chosen count
- last chosen timestamp
- short design note for strategic reminder

### UI behavior

Garage shows a compact `ROUTE LOG` panel with:

- route name
- chosen count
- last chosen time
- short note

This keeps route strategy readable without adding a full map meta screen.

## M.O.E. Memory

### Why memory fragments matter

M.O.E. memory fragments add narrative continuity between runs without slowing gameplay.
The player sees that repeated runs uncover context, not just resources.

### Unlock sources

Memory entries are persisted in `save.moeMemory` and unlock from lightweight milestones:

- story log recovery
- boss preview reached
- boss clear
- key contract milestone (`Abandoned AI Navi`)
- AM 666.0-related run traces

### UI behavior

Garage shows a compact `M.O.E. MEMORY` panel:

- unlocked count
- title + memory text
- unlock timestamp
- source tag (`story` / `run` / `contract` / `boss`)

Only unlocked entries are shown to keep the panel atmospheric and compact.

## Active Support Daemons

### Design intent

Contracted demons are not party members in front-line combat.
Instead, one contracted entity can become a temporary **support daemon** linked to the vehicle terminal for the current run.

- Link source: successful `Contract`
- Lifetime: `RUN END`
- Capacity: one active daemon (new link replaces old one)

This gives contracts immediate run impact and improves companion feel without adding a full party system.

### Current implementation status

Implemented gameplay hooks:

- `Roadside Phone`: successful `Talk` gets an extra `trust +1` or `interest +1`
- `Silent Shape`: one extra damage absorption during guard flow (`+1` mitigation once per encounter)
- `Abandoned AI Navi`: forecast reliability improves and forecast horizon extends

UI/log-first hooks (future expansion-ready):

- `Pixie / Shibuya Glow`: route/reward bias intent is surfaced in label/log, deterministic weighting hook is deferred
- `Foxfire Navi`: route danger readability intent is surfaced in label/log, full lane-risk model hook is deferred

### Why this helps replayability

- Contracts matter immediately in the same run
- Different demons create different tactical rhythms
- Players have more reason to contract for utility, not only for collection

## Companion Feel

### Goal

Contracted demons should feel like temporary companions riding with the vehicle terminal, not just passive inventory entries.

### Current expression layers

- **Terminal link logs**: each daemon writes a profile-flavored link message on contract.
- **M.O.E. reaction line**: contract link triggers a short M.O.E. caution/acknowledgement line.
- **Support daemon panel**: dashboard shows
  - name
  - temperament
  - effect
  - link stability (`STABLE` / `NOISY` / `HUNGRY` / `UNKNOWN`)
- **Run-end disconnect logs**:
  - `SUPPORT DAEMON DISCONNECTED: signal lost at Return Gate.`
  - `SUPPORT DAEMON DISCONNECTED: contract archived in M.O.E. memory.`

### Why this improves replayability

- The player gets immediate emotional feedback after contract success.
- Contracts now create a visible “passenger in the system” state during the run.
- End-of-run disconnect logs reinforce that each run is a short-lived bond, encouraging another run.

## Progression Unlock Loop

### Design intent

Unlockは「装備をたくさん並べる」ためではなく、Run中に見つけたものをGarageへ持ち帰るための短い報酬ループです。

現行の解放対象:

- Main Gun / Sub Gun / S-E
- Contract Support
- Vehicle Upgrade

### Reward sources

初期解放:

- 新規saveがすぐ出撃できる最低限の装備だけを開く
- 現在は `light_cannon`, `hood_mg`, `signal_harpoon`, `support: none`
- 基本改造の `fuel_tank`, `armor_plating`, `ammo_rack`, `se_rack` は最初から購入可能

購入解放:

- Garageで資源を払って選択肢を広げる
- Creditsは装備寄り、Driver XPはDriver寄り、M.O.E. SyncはM.O.E./信号寄りに使う
- 例: `heavy_cannon`, `twin_mg`, `radio_voice`, `decoy_beacon`

マイルストーン解放:

- Stage clear / Boss clear / Story Log数 / temperament契約など、Run結果で開く
- 例: `clear_stage_1`, `clear_stage_2`, `story_logs_2`, `contract_temperament_machine`

レアイベント解放:

- 通常報酬ではなく、blueprintやstrange partを持ち帰る
- 例: `blueprint_signal_antenna`
- Rare Salvage文言は `public/dialogue.yaml`

### Implementation notes

- 条件は `public/progression.yaml`
- 判定は `src/game/progression.ts`
- Rare Salvage候補は `src/game/rareEvents.ts`
- Garageのlocked表示は `GarageLoadoutSection` / `GarageGrowthSection`
- Run中の長文は reducer に直書きせず `dialogue.yaml` / scenario config へ置く

### Naming

- Runtime IDは `snake_case`
- 進行milestoneも `clear_stage_1`, `story_logs_2`, `blueprint_signal_antenna` のように機械可読な名前にする
- 表示名は catalog / dialogue 側で管理し、IDをUI文言として使い回さない

## Save Management + Report Integration

### Why this matters for solo playtesting

リプレイ性評価では「今の感触」だけでなく、継続セッションでの蓄積が重要です。  
そのため、Playtest Reportにも persistent progression を統合しています。

### Save summary shown in LOCAL SAVE TOOLS

- total runs
- latest result
- best result
- demons discovered
- contracts acquired total
- routes discovered
- M.O.E. memories unlocked

### Playtest Report (Persistent Progression section)

Markdownレポートに次を追加:

- Total saved runs
- Demons discovered
- Routes discovered
- M.O.E. memories unlocked
- Previous run summary
- Latest M.O.E. suggestion

これにより、単発Runの評価ではなく、`Result -> Garage -> Next Run` が積み上がっているかを判断しやすくなります。
