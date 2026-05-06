import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { normalizeScenarioPack } from '../src/scenario/scenarioTypes.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const targetRoots = [
  path.resolve(rootDir, 'public', 'scenarios'),
  path.resolve(rootDir, 'drafts', 'scenarios'),
];

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const collectJsonFiles = async (baseDir: string): Promise<string[]> => {
  const out: string[] = [];
  const walk = async (dir: string) => {
    let entries: Awaited<ReturnType<typeof readdir>>;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absolute = path.resolve(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile() && absolute.endsWith('.json')) {
        out.push(absolute);
      }
    }
  };
  await walk(baseDir);
  return out;
};

const validateEncounterFragment = (raw: unknown): boolean => {
  const encounters = Array.isArray(raw) ? raw : [raw];
  const pack = normalizeScenarioPack({
    version: 1,
    id: 'draft-encounter',
    title: 'draft encounter',
    encounters,
  });
  return !!pack?.encounters?.length;
};

const validateRouteFragment = (raw: unknown): boolean => {
  const routeEvents = Array.isArray(raw) ? raw : [raw];
  const pack = normalizeScenarioPack({
    version: 1,
    id: 'draft-route',
    title: 'draft route',
    routeEvents,
  });
  return !!pack?.routeEvents?.length;
};

const validateMoeLinesFragment = (raw: unknown): boolean => {
  const pack = normalizeScenarioPack({
    version: 1,
    id: 'draft-moe',
    title: 'draft moe',
    moeLines: raw,
  });
  return !!pack?.moeLines && Object.keys(pack.moeLines).length > 0;
};

const looksLikeEncounter = (raw: unknown): boolean => {
  if (Array.isArray(raw)) return raw.length > 0 && looksLikeEncounter(raw[0]);
  const r = asRecord(raw);
  return typeof r.id === 'string' && typeof r.name === 'string';
};

const looksLikeRouteEvent = (raw: unknown): boolean => {
  if (Array.isArray(raw)) return raw.length > 0 && looksLikeRouteEvent(raw[0]);
  const r = asRecord(raw);
  return typeof r.id === 'string' && typeof r.title === 'string' && typeof r.body === 'string';
};

const looksLikeMoeLines = (raw: unknown): boolean => {
  const r = asRecord(raw);
  if (Object.keys(r).length === 0) return false;
  return Object.values(r).some((value) => Array.isArray(value));
};

const validateScenarioIndex = (raw: unknown): boolean => {
  const r = asRecord(raw);
  if (r.version !== 1) return false;
  const hasDefault = typeof r.default === 'string';
  const packs = Array.isArray(r.packs) ? r.packs : [];
  const hasPack = packs.some((entry) => {
    const p = asRecord(entry);
    return typeof p.id === 'string' && typeof p.path === 'string';
  });
  return hasDefault || hasPack;
};

const validateFilePayload = (filePath: string, raw: unknown): { ok: boolean; kind: string } => {
  const pack = normalizeScenarioPack(raw);
  if (pack) return { ok: true, kind: 'ScenarioPack' };
  if (path.basename(filePath) === 'index.json' && validateScenarioIndex(raw)) {
    return { ok: true, kind: 'ScenarioIndex' };
  }

  if (looksLikeEncounter(raw) && validateEncounterFragment(raw)) return { ok: true, kind: 'EncounterFragment' };
  if (looksLikeRouteEvent(raw) && validateRouteFragment(raw)) return { ok: true, kind: 'RouteEventFragment' };
  if (looksLikeMoeLines(raw) && validateMoeLinesFragment(raw)) return { ok: true, kind: 'MoeLinesFragment' };

  const fileName = path.basename(filePath);
  if (fileName.endsWith('.scenario.json')) return { ok: false, kind: 'ScenarioPack' };
  return { ok: false, kind: 'UnknownFragment' };
};

const main = async () => {
  const files = (
    await Promise.all(targetRoots.map((root) => collectJsonFiles(root)))
  ).flat();

  if (files.length === 0) {
    console.log('[scenario:validate] no scenario JSON files found.');
    return;
  }

  let failed = 0;
  for (const filePath of files.sort()) {
    try {
      const rawText = await readFile(filePath, 'utf-8');
      const parsed = JSON.parse(rawText) as unknown;
      const result = validateFilePayload(filePath, parsed);
      if (result.ok) {
        console.log(`OK   ${path.relative(rootDir, filePath)} (${result.kind})`);
      } else {
        failed += 1;
        console.error(`FAIL ${path.relative(rootDir, filePath)} (${result.kind})`);
      }
    } catch (error) {
      failed += 1;
      console.error(`FAIL ${path.relative(rootDir, filePath)} (parse/read error)`, error);
    }
  }

  if (failed > 0) {
    console.error(`[scenario:validate] completed with ${failed} failure(s).`);
    process.exitCode = 1;
    return;
  }
  console.log('[scenario:validate] all scenario files are valid.');
};

void main();
