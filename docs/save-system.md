# Save System (Local-only)

## Scope

このMVPのセーブは **ブラウザ localStorage のみ** を使います。  
外部送信、バックエンド、SDK連携はありません。

## Storage Keys

- Main Save: `devil-drive-midnight.save.v1`
- AutoSave: `devil-drive-midnight.autosave.v1`
- Debug Saves: `devil-drive-midnight.debugsave.v1`
- Corrupt Backup: `devil-drive-midnight.save.corrupt.backup`

## Main Save Schema

`SaveData` は以下を保持します。

- version / createdAt / updatedAt
- totalRuns / bestResult
- runHistory
- demonArchive
- routeLog
- moeMemory
- settings

型定義と正規化は `src/saveSystem.ts` に集約されています。

## Save Management UI

`LOCAL SAVE TOOLS` パネルで以下を実行できます。

- Save summary表示（runs/result/archive/route/memory/contracts）
- `Export Save JSON`
- `Import Save JSON`（versionとshapeを検証）
- `Reset Save`（確認ダイアログあり）
- AutoSave / Debug save の保存・復元・エクスポート

## Import Validation

`Import Save JSON` は以下をチェックします。

1. JSONとしてパース可能
2. ルートがobject
3. `version` がある場合は `1` のみ許可

その後 `sanitizeSaveData` で正規化して保存します。  
不正データは上書きせず、UIに失敗メッセージを表示します。

## Reset Behavior

`Reset Save` は main save を初期化し、UI整合のためページ再読込を行います。  
Telemetryは別管理のため、Reset Saveでは消去しません。

