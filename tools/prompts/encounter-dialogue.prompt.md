# Prompt: Encounter Dialogue Fragment

Generate an `EncounterScenario` JSON fragment.

## Output format

- Output JSON only.
- Return either:
  - a single object, or
  - an array of objects.

## Hard constraints

- Follow this shape:

```json
{
  "id": "string",
  "name": "string",
  "intro": ["string"],
  "analyze": { "success": ["string"], "fail": ["string"] },
  "talk": {
    "success": ["string"],
    "fail": ["string"]
  },
  "contract": {
    "offer": ["string"],
    "success": ["string"],
    "failure": ["string"]
  },
  "supportDaemon": {
    "linked": ["string"],
    "disconnected": ["string"]
  }
}
```

- Keep lines short (1-2 sentences).
- Do not add gameplay numbers.
- Do not include HP/damage/rate changes.

## Tone

- midnight Tokyo expressway + occult terminal
- eerie but readable
- not too cyberpunk
- retro JRPG atmosphere

## Generate for this target

Create entries for:
- `pixie_shibuya_glow`
- `roadside_phone`
- `silent_shape`
- `abandoned_ai_navi`
- `toll_gate_saint`

Return JSON only.
