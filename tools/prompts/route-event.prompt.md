# Prompt: Route Event Scenario Fragment

Generate `RouteEventScenario` JSON entries for Night Loop route choices.

## Output rules

- Output JSON only.
- Return an array of objects.
- Use this schema:

```json
[
  {
    "id": "string",
    "title": "string",
    "body": "string",
    "choices": [
      { "id": "string", "label": "string", "text": "string" }
    ]
  }
]
```

## Required event IDs

- `salvage_lane`
- `signal_lane`
- `push_forward_lane`
- `return_gate_lane`
- `deep_signal_lane`

## Tone rules

- midnight Tokyo expressway
- occult infrastructure and road folklore
- concise and playable
- eerie but not full horror

## Safety rules

- Do not add game balance numbers.
- Do not add copyrighted references.
- Keep each `body` short (1-2 sentences).
- `choices[].label` should match in-game command tone (clear and compact).

Return JSON only.
