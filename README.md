# Devil Drive: Midnight with terminal

> 午前0時にだけ開く巨大道路迷宮「夜環」へ潜り、異形と端末越しに交渉して契約モジュールを回収する、ダッシュボードUI型ロードローグライト。

## 1画面MVP（今回実装）

以下の縦切り体験をReact + TypeScript + Viteで実装済みです。

- Route Mapから次ノード選択
- Fuel / Armor / Signal の管理
- Entityノードで交渉
- 交渉成功で契約モジュール獲得（Radio Voice / Silent Shape / Abandoned AI Navi）
- 契約モジュールが以後イベントへ影響
- Return Gate到達で勝利
- FuelまたはArmorが0以下で敗北
- Retryで再挑戦

## 起動方法

```bash
npm install
npm run dev
```

ブラウザで表示されたローカルURL（通常 `http://localhost:5173`）を開いてプレイしてください。

## ビルド

```bash
npm run build
```

## ビルドしてローカル起動

```bash
npm run start
```

`build` 後に `vite preview` でローカルホストを起動します（通常 `http://localhost:4173`）。
もし `4173` が使用中なら `start` はエラーで停止するため、先に既存プロセスを終了してください。

## ドキュメント

- 詳細仕様: `docs/game-design.md`
