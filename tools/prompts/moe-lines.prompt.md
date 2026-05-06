# Prompt: M.O.E. Lines Fragment

Generate M.O.E. line fragments as JSON.

## Output rules

- Output JSON only.
- No markdown, no explanation.
- Return a `Record<string, string[]>` shape:

```json
{
  "prologue.open": ["..."],
  "approach.success": ["..."],
  "approach.fail": ["..."],
  "encounter.contact": ["..."],
  "route_choice.prompt": ["..."],
  "boss_preview.toll_gate": ["..."],
  "result.safe_return": ["..."]
}
```

## Voice constraints

- M.O.E. = composed in-vehicle navigator AI
- helpful, precise, slightly ominous
- no emotional overload
- short lines only

## Style constraints

- midnight Tokyo expressway
- demon terminal / occult electronic
- retro JRPG flavor
- avoid modern slang unless clearly intentional

## Extra request

Include 2-3 optional radio-like unreliable lines under:
- `radio.am_666.fragment`

Return JSON only.
