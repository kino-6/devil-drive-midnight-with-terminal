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
