import type { GamePhase, SfxCue, TerminalLogKind } from './types';

export const classifyLog = (log: string): TerminalLogKind => {
  if (log.includes('CONTRACT') || log.includes('MODULE')) return 'contract';
  if (log.includes('ARMOR -') || log.includes('FUEL -') || log.includes('IMPACT') || log.includes('DAMAGE') || log.includes('DISABLED')) return 'damage';
  if (log.includes('WARNING') || log.includes('CURSE') || log.includes('ANOMALY')) return 'warning';
  if (log.includes('RUN START') || log.includes('ENCOUNTER') || log.includes('REWARD') || log.includes('RETURN GATE') || log.includes('FORECAST')) return 'route';
  return 'system';
};

export const getLogBadge = (kind: TerminalLogKind) => {
  if (kind === 'warning') return 'WARN';
  if (kind === 'contract') return 'CNTR';
  if (kind === 'damage') return 'DMG';
  if (kind === 'route') return 'ROUTE';
  return 'SYS';
};

export const getPseudoTimecode = (index: number, total: number, wave: number, turn: number) => {
  const recentStart = Math.max(0, total - 14);
  const localOrder = Math.max(0, index - recentStart);
  const elapsedSec = wave * 22 + Math.max(0, turn - 1) * 3 + localOrder * 0.6;
  return `+${elapsedSec.toFixed(1)}s`;
};

export const pickSfxCueFromLog = (log: string, phase: GamePhase): SfxCue | undefined => {
  if (phase === 'garage') return 'garage_enter';
  if (phase === 'game_over') return 'game_over';
  if (log.includes('RUN START')) return 'run_start';
  if (log.includes('APPROACH WINDOW OPEN') || log.includes('CONTACT DETECTED')) return 'scan_ok';
  if (log.includes('NAVI SCAN FAILED') || log.includes('AMBUSH')) return 'scan_fail';
  if (log.includes('CONTRACT REGISTERED') || log.includes('MODULE SLOT UPDATED')) return 'contract';
  if (log.includes('IMPACT CONFIRMED') || log.includes('MULTI TARGET HIT')) return 'hit';
  if (log.includes('WARNING')) return 'warning';
  if (log.includes('SALVAGE RESULT READY') || log.includes('REWARD APPLIED') || log.includes('SALVAGE APPLIED')) return 'reward';
  if (log.includes('RUN COMPLETE') || log.includes('RETURN GATE ROUTE OPEN')) return 'result';
  if (log.includes('COMMAND:') || log.includes('MAIN GUN:') || log.includes('SUB GUN:') || log.includes('S-E:') || log.includes('DRIVE COMMAND')) return 'command';
  return undefined;
};
