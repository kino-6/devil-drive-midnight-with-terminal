import {
  formatDialogueTemplate,
  getDialogueConfig,
  getDialogueLine,
  type DialogueVars,
} from '../dialogueConfig';
import type { State } from './types';

export type MoeTone = 'normal' | 'soft' | 'serious' | 'proud' | 'flustered';
export type MoeVariant = 'default' | 'smile' | 'serious' | 'confused' | 'relaxed';

const lastPickedByPool = new Map<string, string>();

const numberedKeyPattern = (key: string, tone?: MoeTone): RegExp => {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tonePart = tone ? `\\.${tone}` : '';
  return new RegExp(`^${escaped}${tonePart}\\.\\d+$`);
};

const byNumericSuffix = (a: string, b: string): number => {
  const leftParts = a.split('.');
  const rightParts = b.split('.');
  const left = Number(leftParts[leftParts.length - 1] ?? 0);
  const right = Number(rightParts[rightParts.length - 1] ?? 0);
  return left - right;
};

export const getMoeLinePool = (key: string, tone?: MoeTone): string[] => {
  const lines = getDialogueConfig().lines;
  const toneKeys = tone
    ? Object.keys(lines).filter((candidate) => numberedKeyPattern(key, tone).test(candidate)).sort(byNumericSuffix)
    : [];
  const baseKeys = Object.keys(lines).filter((candidate) => numberedKeyPattern(key).test(candidate)).sort(byNumericSuffix);
  const direct = lines[key] ? [lines[key]] : [];
  return [...toneKeys.map((candidate) => lines[candidate]), ...baseKeys.map((candidate) => lines[candidate]), ...direct];
};

const pickFromPool = (poolId: string, pool: string[]): string | undefined => {
  if (pool.length === 0) return undefined;
  if (pool.length === 1) {
    lastPickedByPool.set(poolId, pool[0]);
    return pool[0];
  }
  const previous = lastPickedByPool.get(poolId);
  const candidates = pool.filter((line) => line !== previous);
  const picked = candidates[Math.floor(Math.random() * candidates.length)] ?? pool[0];
  lastPickedByPool.set(poolId, picked);
  return picked;
};

export const getMoeLine = (
  key: string,
  fallback: string,
  vars?: DialogueVars,
  tone?: MoeTone,
): string => {
  const poolId = tone ? `${key}:${tone}` : key;
  const template = pickFromPool(poolId, getMoeLinePool(key, tone)) ?? getDialogueLine(key, fallback);
  return formatDialogueTemplate(template, vars);
};

export const getMoeToneForState = (state: State): MoeTone => {
  if (state.gamePhase === 'game_over') return 'flustered';
  if (state.gamePhase === 'boss_preview' || state.gamePhase === 'boss_encounter') return 'serious';
  if (state.armor <= 3 || state.signal <= 1) return 'serious';
  if (state.gamePhase === 'garage' || state.gamePhase === 'result' || state.gamePhase === 'return_gate') return 'soft';
  if (state.approach?.scanSuccess) return 'proud';
  if (state.approach && !state.approach.scanSuccess) return 'flustered';
  return 'normal';
};

export const getMoeVariantForState = (state: State): MoeVariant => {
  const tone = getMoeToneForState(state);
  if (tone === 'flustered') return 'confused';
  if (tone === 'serious') return 'serious';
  if (tone === 'soft') return state.gamePhase === 'garage' ? 'relaxed' : 'smile';
  if (tone === 'proud') return 'smile';
  return 'default';
};
