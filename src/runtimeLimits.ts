export const MAX_STATE_LOGS = 200;
export const MAX_TELEMETRY_EVENTS = 2000;
export const MAX_DEBUG_SAVE_ENTRIES = 20;

export const limitTail = <T>(items: T[], max: number): T[] => {
  if (max <= 0) return [];
  if (items.length <= max) return items;
  return items.slice(items.length - max);
};

export const limitStateLogs = (logs: string[]): string[] => limitTail(logs, MAX_STATE_LOGS);
