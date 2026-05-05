# Asset Bible (Current Pipeline)

## 1. 差し替えポイント

YAMLで管理する入口は2つです。

1. `public/assets/manifest.yaml`
   - BGM / SFX / 敵画像 / プレイヤー画像 / M.O.E.画像 / ロゴ / UI背景
2. `public/balance.yaml`
   - ダメージ、確率、初期リソース、Autoplayパラメータ

## 2. 画像/音アセットの配置

推奨配置:

- `public/assets/bgm/*.ogg`
- `public/assets/sfx/*.wav`
- `public/assets/enemies/*.png`
- `public/assets/ui/*.png`

`manifest.yaml` 内の相対パスは `/assets/` 基準で解決されます。  
例: `bgm: "bgm/night_loop_main.ogg"` -> `/assets/bgm/night_loop_main.ogg`

## 3. フォールバック仕様

- 敵画像が見つからない: 既存SVGシルエットを表示
- player/moe/logo画像が見つからない: テキストUIのまま動作
- BGM/SFXが見つからない: 無音で継続
- UI背景画像が見つからない: 既存CSS背景を維持
- `balance.yaml` がない: ビルトイン既定値を使用

## 4. 運用メモ

- まずは `manifest.yaml` と `balance.yaml` だけ編集して、見た目と手触りを調整
- その後 `AUTOPLAY LAB` で勝率・残リソースを確認して再調整
- 1回の変更は小さく（例: Talk成功率 +0.03）にして比較する
