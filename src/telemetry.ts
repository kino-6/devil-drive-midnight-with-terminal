export type TelemetryEventName =
  | 'app_loaded'
  | 'prologue_started'
  | 'run_started'
  | 'approach_started'
  | 'encounter_started'
  | 'command_used'
  | 'analyze_used'
  | 'analyze_success'
  | 'talk_used'
  | 'contract_window_opened'
  | 'contract_attempted'
  | 'contract_success'
  | 'enemy_defeated'
  | 'reward_shown'
  | 'reward_selected'
  | 'route_choice_shown'
  | 'route_choice_selected'
  | 'route_node_selected'
  | 'return_checkpoint_reached'
  | 'backtrack_started'
  | 'safe_extract_used'
  | 'wipeout_carryback'
  | 'boss_preview_seen'
  | 'boss_challenged'
  | 'boss_cleared'
  | 'return_gate_used'
  | 'result_shown'
  | 'garage_entered'
  | 'loadout_changed'
  | 'next_run_started'
  | 'game_over';

export type TelemetryEvent = {
  id: string;
  name: TelemetryEventName;
  timestamp: string;
  payload: Record<string, unknown>;
};

export type PlaytestReport = {
  runsStarted: number;
  runsFinished: number;
  completionRate: number;
  garageEntries: number;
  nextRunStarts: number;
  secondRunStartRate: number;
  bossPreviewSeen: number;
  bossChallenged: number;
  bossCleared: number;
  returnGateUsed: number;
  gameOverCount: number;
  analyzeUsed: number;
  talkUsed: number;
  contractWindowsOpened: number;
  contractAttempts: number;
  contractSuccesses: number;
  contractSuccessRate: number;
  commandUsage: Record<string, number>;
  mostUsedCommands: Array<{ id: string; count: number }>;
  directAttackRatio: number;
  judgment: 'Promising MVP loop' | 'Needs tuning' | 'Needs redesign before platform migration';
  notes: string[];
  persistedRuns: number;
  archiveDiscoveryCount: number;
  routeLogCount: number;
  memoryUnlockCount: number;
  previousRunSummaryText: string;
  latestMoeSuggestion: string;
  markdown: string;
};

export type PersistentProgressionSnapshot = {
  persistedRuns: number;
  archiveDiscoveryCount: number;
  routeLogCount: number;
  memoryUnlockCount: number;
  previousRunSummaryText: string;
  latestMoeSuggestion: string;
};

const STORAGE_KEY = 'devil-drive-midnight.telemetry.v1';

const readSafe = (): TelemetryEvent[] => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const sanitized = parsed.filter((item): item is TelemetryEvent => {
      if (!item || typeof item !== 'object') return false;
      const v = item as Record<string, unknown>;
      return typeof v.id === 'string' && typeof v.name === 'string' && typeof v.timestamp === 'string' && typeof v.payload === 'object';
    });
    return limitTail(sanitized, MAX_TELEMETRY_EVENTS);
  } catch {
    return [];
  }
};

const writeSafe = (events: TelemetryEvent[]) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // ignore storage errors (private mode / quota)
  }
};

export const trackEvent = (name: TelemetryEventName, payload: Record<string, unknown> = {}) => {
  const events = readSafe();
  const entry: TelemetryEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    timestamp: new Date().toISOString(),
    payload,
  };
  events.push(entry);
  writeSafe(limitTail(events, MAX_TELEMETRY_EVENTS));
  return entry;
};

export const getTelemetryEvents = () => readSafe();

export const clearTelemetryEvents = () => {
  writeSafe([]);
};

export const exportTelemetryJson = () => JSON.stringify(readSafe(), null, 2);

const pct = (a: number, b: number) => (b <= 0 ? 0 : (a / b) * 100);

const countByName = (events: TelemetryEvent[], name: TelemetryEventName) =>
  events.reduce((acc, event) => acc + (event.name === name ? 1 : 0), 0);

const commandCounts = (events: TelemetryEvent[]) => {
  const counts: Record<string, number> = {};
  for (const event of events) {
    if (event.name !== 'command_used') continue;
    const commandId = String(event.payload.commandId ?? 'unknown');
    counts[commandId] = (counts[commandId] ?? 0) + 1;
  }
  return counts;
};

const numberFmt = (value: number) => `${Math.round(value * 10) / 10}%`;

const buildNotes = (report: Omit<PlaytestReport, 'markdown'>): string[] => {
  const notes: string[] = [];
  if (report.secondRunStartRate < 30) notes.push('Result→Garage→Next Run導線が弱い可能性。Result画面で次Run動機を強く提示する。');
  if (report.completionRate < 50) notes.push('Run完走率が低め。初期リソースや被ダメ、報酬量を見直して序盤離脱を減らす。');
  if (report.directAttackRatio > 70) notes.push('攻撃コマンド偏重。Analyze/Talk/Contractに明確な短期メリットを追加する。');
  if (report.contractAttempts === 0) notes.push('契約導線が機能していない。Contract Windowの開きやすさとUI説明を強化する。');
  if (report.analyzeUsed < report.runsStarted) notes.push('Analyze利用が不足。弱点表示や報酬連動で使う理由を増やす。');
  if ((report.talkUsed + report.contractAttempts) / Math.max(1, report.runsStarted) < 1) {
    notes.push('交渉導線が薄い。Talk成功時の即効性（被害軽減/報酬増）を上げる。');
  }
  if (notes.length === 0) notes.push('主要指標は良好。次はステージ差分とボス学習曲線を強化して検証を継続。');
  return notes;
};

const decideJudgment = (report: {
  completionRate: number;
  secondRunStartRate: number;
  analyzeUsed: number;
  talkUsed: number;
  contractAttempts: number;
  runsStarted: number;
  directAttackRatio: number;
}) => {
  const analyzeMostRuns = report.analyzeUsed >= Math.max(1, Math.round(report.runsStarted * 0.7));
  const negotiationPerRun = (report.talkUsed + report.contractAttempts) / Math.max(1, report.runsStarted);
  const strong =
    report.completionRate >= 70 &&
    report.secondRunStartRate >= 50 &&
    analyzeMostRuns &&
    negotiationPerRun >= 1;
  const warning =
    report.completionRate < 50 ||
    report.secondRunStartRate < 30 ||
    report.directAttackRatio > 70 ||
    report.contractAttempts === 0;
  if (strong) return 'Promising MVP loop';
  if (warning) return 'Needs redesign before platform migration';
  return 'Needs tuning';
};

const buildMarkdown = (report: Omit<PlaytestReport, 'markdown'>) => {
  const commandLines = Object.entries(report.commandUsage)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => `- ${id}: ${count}`)
    .join('\n') || '- (no command events)';
  const notes = report.notes.map((note) => `- ${note}`).join('\n');
  return `# Devil Drive Midnight - Playtest Report

## Summary
- Runs started: ${report.runsStarted}
- Runs finished: ${report.runsFinished}
- Completion rate: ${numberFmt(report.completionRate)}
- Second-run start rate: ${numberFmt(report.secondRunStartRate)}

## Core Loop Evaluation
- Garage entries: ${report.garageEntries}
- Next run starts: ${report.nextRunStarts}
- Result -> Garage -> Next Run loop signal: ${report.nextRunStarts > 0 ? 'Observed' : 'Not observed yet'}
- Judgment: **${report.judgment}**

## Command Usage
${commandLines}

- Direct attack ratio (Main Gun / Sub Gun / Ram): ${numberFmt(report.directAttackRatio)}
- Most used commands: ${report.mostUsedCommands.map((item) => `${item.id} (${item.count})`).join(', ') || 'N/A'}

## Contract System
- Talk usage: ${report.talkUsed}
- Contract windows opened: ${report.contractWindowsOpened}
- Contract attempts: ${report.contractAttempts}
- Contract successes: ${report.contractSuccesses}
- Contract success rate: ${numberFmt(report.contractSuccessRate)}
- Negotiation engagement per run: ${((report.talkUsed + report.contractAttempts) / Math.max(1, report.runsStarted)).toFixed(2)}

## Boss / Return Behavior
- Boss previews seen: ${report.bossPreviewSeen}
- Boss challenged: ${report.bossChallenged}
- Boss cleared: ${report.bossCleared}
- Return gate used: ${report.returnGateUsed}
- Game over count: ${report.gameOverCount}

## Persistent Progression
- Total saved runs: ${report.persistedRuns}
- Demons discovered: ${report.archiveDiscoveryCount}
- Routes discovered: ${report.routeLogCount}
- M.O.E. memories unlocked: ${report.memoryUnlockCount}
- Previous run summary: ${report.previousRunSummaryText}
- Latest M.O.E. suggestion: ${report.latestMoeSuggestion}

## MVP Judgment
- Strong signal condition met: ${report.judgment === 'Promising MVP loop' ? 'Yes' : 'No'}
- Warning signal present: ${report.judgment === 'Needs redesign before platform migration' ? 'Yes' : 'No'}
- Final: **${report.judgment}**

## Notes for Next Iteration
${notes}
`;
};

export const buildPlaytestReport = (
  events: TelemetryEvent[],
  persistent?: PersistentProgressionSnapshot,
): PlaytestReport => {
  const runsStarted = countByName(events, 'run_started');
  const runsFinished = countByName(events, 'result_shown');
  const completionRate = pct(runsFinished, runsStarted);
  const garageEntries = countByName(events, 'garage_entered');
  const nextRunStarts = countByName(events, 'next_run_started');
  const secondRunStartRate = pct(nextRunStarts, runsFinished);
  const bossPreviewSeen = countByName(events, 'boss_preview_seen');
  const bossChallenged = countByName(events, 'boss_challenged');
  const bossCleared = countByName(events, 'boss_cleared');
  const returnGateUsed = countByName(events, 'return_gate_used');
  const gameOverCount = countByName(events, 'game_over');
  const analyzeUsed = countByName(events, 'analyze_used');
  const talkUsed = countByName(events, 'talk_used');
  const contractWindowsOpened = countByName(events, 'contract_window_opened');
  const contractAttempts = countByName(events, 'contract_attempted');
  const contractSuccesses = countByName(events, 'contract_success');
  const contractSuccessRate = pct(contractSuccesses, contractAttempts);
  const usage = commandCounts(events);
  const totalCommands = Object.values(usage).reduce((acc, value) => acc + value, 0);
  const directAttackRatio = pct((usage.main_gun ?? 0) + (usage.sub_gun ?? 0) + (usage.ram ?? 0), Math.max(1, totalCommands));
  const mostUsedCommands = Object.entries(usage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => ({ id, count }));
  const judgment = decideJudgment({
    completionRate,
    secondRunStartRate,
    analyzeUsed,
    talkUsed,
    contractAttempts,
    runsStarted,
    directAttackRatio,
  });
  const base: Omit<PlaytestReport, 'markdown'> = {
    runsStarted,
    runsFinished,
    completionRate,
    garageEntries,
    nextRunStarts,
    secondRunStartRate,
    bossPreviewSeen,
    bossChallenged,
    bossCleared,
    returnGateUsed,
    gameOverCount,
    analyzeUsed,
    talkUsed,
    contractWindowsOpened,
    contractAttempts,
    contractSuccesses,
    contractSuccessRate,
    commandUsage: usage,
    mostUsedCommands,
    directAttackRatio,
    judgment,
    notes: [],
    persistedRuns: persistent?.persistedRuns ?? 0,
    archiveDiscoveryCount: persistent?.archiveDiscoveryCount ?? 0,
    routeLogCount: persistent?.routeLogCount ?? 0,
    memoryUnlockCount: persistent?.memoryUnlockCount ?? 0,
    previousRunSummaryText: persistent?.previousRunSummaryText ?? 'N/A',
    latestMoeSuggestion: persistent?.latestMoeSuggestion ?? 'N/A',
  };
  const notes = buildNotes(base);
  const report = { ...base, notes };
  return { ...report, markdown: buildMarkdown(report) };
};
import { MAX_TELEMETRY_EVENTS, limitTail } from './runtimeLimits';
