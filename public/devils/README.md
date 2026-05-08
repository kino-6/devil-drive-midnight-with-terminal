# Devil Config Split Notes

Runtime load order:

1. `/devils/index.yaml` (new split entrypoint)
2. legacy single-file fallback (`/devils.yaml` if present)
3. built-in defaults (`src/devilConfig.ts`)

`index.yaml` supports `includes` as a comma-separated string:

```yaml
includes: "/devils/profiles.yaml, /devils/templates.yaml, /devils/lineups.yaml, /devils/support.yaml"
```

Each include can define any subset of this schema:

- `version`
- `profiles`
- `templates`
- `lineups`
- `support`

All includes are merged in order. Later files override earlier values.

## Devil image references

Devil image files live under `/assets/images/devil/`, backed by files in `public/assets/images/devil/`.

Use the current filename convention:

- `<devil_id>_idle.png`
- `<devil_id>_move_01.png`
- future variants can use names like `<devil_id>_move_02.png` or `<devil_id>_hit_01.png`

Do not hard-code devil image paths in React components. Add image paths through `/assets/manifest.yaml`; use `profiles.yaml` `assetImage` as the profile fallback, normally pointing at the idle image.

`manifest.yaml` supports both the legacy single string and the animation object:

```yaml
images:
  enemies:
    pixie_shibuya_glow:
      idle: "images/devil/pixie_idle.png"
      moveFrames:
        - "images/devil/pixie_idle.png"
        - "images/devil/pixie_move_01.png"
```

Enemies with two or more `moveFrames` animate after they are revealed/analyzed. Enemies with only one image continue to render as a static fallback.
