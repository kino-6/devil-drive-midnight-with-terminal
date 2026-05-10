import type { CombatFxCue } from './types';

export const collectCombatFxCues = (logs: string[]): CombatFxCue[] => {
  const text = logs.join('\n');
  const cues: CombatFxCue[] = [];

  if (/COMMAND: MAIN_GUN|MAIN GUN:|IMPACT CONFIRMED|CHASSIS IMPACT CONFIRMED/.test(text)) cues.push('player_shot');
  if (/COMMAND: SUB_GUN|SUB GUN:|MULTI TARGET HIT/.test(text)) cues.push('subgun_spray');
  if (/COMMAND: SE_HARPOON|S-E:|SCAN BEACON|MICRO MISSILE|EMP |EMP LOCK|BINDING FLARE|ENTITY SIGNATURE PINNED/.test(text)) cues.push('signal_burst');
  if (/COMMAND: ANALYZE|ANALYZE PROGRESS|SIGNATURE SCAN COMPLETE/.test(text)) cues.push('analyze_scan');
  if (/COMMAND: TALK|TALK CHANNEL OPEN/.test(text)) cues.push('talk_ping');
  if (/COMMAND: GUARD|DEFENSIVE POSTURE LOCKED|GUARD ABSORBED IMPACT|CURSE MITIGATED/.test(text)) cues.push('guard');
  if (/ENEMY INTENT: .* -> ATTACK/.test(text)) cues.push('enemy_attack');
  if (/ENEMY INTENT: .* -> CURSE/.test(text)) cues.push('enemy_curse');

  return cues.slice(0, 5);
};
