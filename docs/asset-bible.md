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
- `public/assets/images/devil/*.png`
- `public/assets/images/moe/*.png`
- `public/assets/ui/*.png`

`manifest.yaml` 内の相対パスは `/assets/` 基準で解決されます。  
例: `bgm: "bgm/night_loop_main.ogg"` -> `/assets/bgm/night_loop_main.ogg`

## 3. 悪魔画像の命名と2フレーム運用

悪魔画像は `public/assets/images/devil/` に置きます。画像ファイル自体を React 側から直参照せず、`public/assets/manifest.yaml` と必要に応じて `public/devils/profiles.yaml` 経由で参照します。

命名規則:

- `<devil_id>_idle.png`
- `<devil_id>_move_01.png`
- 今後増やす場合は `<devil_id>_move_02.png`, `<devil_id>_hit_01.png` のように用途と連番を付ける

例:

- `pixie_idle.png`
- `pixie_move_01.png`
- `toll_gate_saint_idle.png`
- `toll_gate_saint_move_01.png`

`manifest.yaml` の `images.enemies` は後方互換のため従来の string 指定も動きます。2フレームアニメを使う敵は、現在の実装に合わせて `idle` と `moveFrames` を指定します。

```yaml
images:
  enemies:
    pixie_shibuya_glow:
      idle: "images/devil/pixie_idle.png"
      moveFrames:
        - "images/devil/pixie_idle.png"
        - "images/devil/pixie_move_01.png"
    unknown_sign: "images/devil/unknown_idle.png"
```

- `idle` は単一画像解決時に使われます。
- `moveFrames` が2枚以上ある revealed/analyzed 済みの敵は、CSSで軽く2フレームループします。
- `moveFrames` がない、または1枚しかない敵は従来どおり単一画像で表示されます。
- `UNKNOWN SIGN` は単一画像のままで問題ありません。
- `public/devils/profiles.yaml` の `assetImage` は profile 側の fallback です。通常は idle 画像を指定します。

## 4. フォールバック仕様

- 敵画像が見つからない: 既存SVGシルエットを表示
- enemy manifest が string 指定: 単一画像として表示
- enemy manifest が object 指定で `idle` のみ: 単一画像として表示
- enemy manifest が object 指定で `moveFrames` 2枚以上: revealed/analyzed 済み敵のみ2フレーム表示
- player/moe/logo画像が見つからない: テキストUIのまま動作
- BGM/SFXが見つからない: 無音で継続
- UI背景画像が見つからない: 既存CSS背景を維持
- `balance.yaml` がない: ビルトイン既定値を使用

## 5. 運用メモ

- まずは `manifest.yaml` と `balance.yaml` だけ編集して、見た目と手触りを調整
- 新しい悪魔画像を追加するときは、画像ファイル追加 -> `manifest.yaml` 更新 -> 必要なら `profiles.yaml` の `assetImage` 更新、の順で行う
- React コンポーネントに `images/devil/...` を直書きしない
- その後 `AUTOPLAY LAB` で勝率・残リソースを確認して再調整
- 1回の変更は小さく（例: Talk成功率 +0.03）にして比較する
