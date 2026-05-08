import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const readText = (relativePath: string) => readFile(path.resolve(rootDir, relativePath), 'utf-8');

const unique = (values: string[]) => [...new Set(values)];

const sectionIds = (text: string, sectionName: string): string[] => {
  const sectionStart = text.indexOf(`${sectionName}:\n`);
  if (sectionStart < 0) return [];
  const afterStart = text.slice(sectionStart + sectionName.length + 2);
  const nextTopLevel = afterStart.search(/\n[a-zA-Z0-9_]+:\n/);
  const section = nextTopLevel >= 0 ? afterStart.slice(0, nextTopLevel) : afterStart;
  return [...section.matchAll(/^  ([a-z0-9_]+):$/gm)].map((match) => match[1]);
};

const nestedSectionIds = (text: string, parent: string, child: string): string[] => {
  const parentStart = text.indexOf(`${parent}:\n`);
  if (parentStart < 0) return [];
  const afterParent = text.slice(parentStart + parent.length + 2);
  const nextTopLevel = afterParent.search(/\n[a-zA-Z0-9_]+:\n/);
  const parentSection = nextTopLevel >= 0 ? afterParent.slice(0, nextTopLevel) : afterParent;
  const childStart = parentSection.indexOf(`  ${child}:\n`);
  if (childStart < 0) return [];
  const afterChild = parentSection.slice(childStart + child.length + 4);
  const nextSibling = afterChild.search(/\n  [a-zA-Z0-9_]+:\n/);
  const childSection = nextSibling >= 0 ? afterChild.slice(0, nextSibling) : afterChild;
  return [...childSection.matchAll(/^    ([a-z0-9_]+):/gm)].map((match) => match[1]);
};

const quotedCsvIds = (text: string): string[] =>
  [...text.matchAll(/: "([^"]+)"/g)]
    .flatMap((match) => match[1].split(','))
    .map((item) => item.trim())
    .filter(Boolean);

const runtimeEncounterIds = (text: string): string[] => {
  const start = text.indexOf('export const ENCOUNTER_IDS = [');
  if (start < 0) return [];
  const rest = text.slice(start);
  const end = rest.indexOf('];');
  const block = end >= 0 ? rest.slice(0, end) : rest;
  return [...block.matchAll(/'([a-z0-9_]+)'/g)].map((match) => match[1]);
};

const manifestEnemyBlock = (manifest: string, id: string, allIds: string[]): string => {
  const start = manifest.indexOf(`    ${id}:`);
  if (start < 0) return '';
  const nextCandidates = allIds
    .filter((otherId) => otherId !== id)
    .map((otherId) => manifest.indexOf(`    ${otherId}:`, start + 1))
    .filter((index) => index > start);
  const nextUnknown = manifest.indexOf('    unknown_sign:', start + 1);
  const nextUi = manifest.indexOf('  ui:', start + 1);
  const end = Math.min(
    ...nextCandidates,
    nextUnknown > start ? nextUnknown : Infinity,
    nextUi > start ? nextUi : Infinity,
    manifest.length,
  );
  return manifest.slice(start, end);
};

const manifestFrameFiles = (manifest: string, id: string, allIds: string[]): string[] =>
  [...manifestEnemyBlock(manifest, id, allIds).matchAll(/images\/devil\/([^"]+)/g)].map((match) => match[1]);

const addMissing = (errors: string[], label: string, expected: string[], actual: string[]) => {
  const actualSet = new Set(actual);
  for (const id of expected) {
    if (!actualSet.has(id)) errors.push(`${label} missing: ${id}`);
  }
};

const addUnknown = (errors: string[], label: string, actual: string[], expected: string[]) => {
  const expectedSet = new Set(expected);
  for (const id of actual) {
    if (!expectedSet.has(id)) errors.push(`${label} unknown id: ${id}`);
  }
};

const fileExists = async (relativePath: string) => {
  try {
    await access(path.resolve(rootDir, relativePath));
    return true;
  } catch {
    return false;
  }
};

const main = async () => {
  const [
    profilesYaml,
    templatesYaml,
    supportYaml,
    lineupsYaml,
    manifestYaml,
    typesTs,
    devilConfigTs,
  ] = await Promise.all([
    readText('public/devils/profiles.yaml'),
    readText('public/devils/templates.yaml'),
    readText('public/devils/support.yaml'),
    readText('public/devils/lineups.yaml'),
    readText('public/assets/manifest.yaml'),
    readText('src/game/types.ts'),
    readText('src/game/encounterIds.ts'),
  ]);

  const profileIds = sectionIds(profilesYaml, 'profiles');
  const templateIds = sectionIds(templatesYaml, 'templates');
  const supportEffectIds = nestedSectionIds(supportYaml, 'support', 'effects');
  const supportLinkIds = nestedSectionIds(supportYaml, 'support', 'linkLogs');
  const lineupIds = quotedCsvIds(lineupsYaml);
  const configEncounterIds = runtimeEncounterIds(devilConfigTs);
  const assetFiles = new Set(await readdir(path.resolve(rootDir, 'public/assets/images/devil')));
  const errors: string[] = [];

  if (profileIds.length === 0) errors.push('No devil profiles found.');

  addMissing(errors, 'templates.yaml', profileIds, templateIds);
  addUnknown(errors, 'templates.yaml', templateIds, profileIds);
  addMissing(errors, 'support.effects', profileIds, supportEffectIds);
  addMissing(errors, 'support.linkLogs', profileIds, supportLinkIds);
  addMissing(errors, 'lineups.yaml', profileIds, lineupIds);
  addUnknown(errors, 'lineups.yaml', lineupIds, profileIds);
  if (!typesTs.includes('export type EncounterId = EncounterIdValue;')) {
    errors.push('EncounterId type is not derived from ENCOUNTER_IDS.');
  }
  addMissing(errors, 'ENCOUNTER_IDS', profileIds, configEncounterIds);
  addUnknown(errors, 'ENCOUNTER_IDS', configEncounterIds, profileIds);

  for (const id of profileIds) {
    const block = manifestEnemyBlock(manifestYaml, id, profileIds);
    const files = manifestFrameFiles(manifestYaml, id, profileIds);
    if (!block) {
      errors.push(`manifest enemies missing: ${id}`);
      continue;
    }
    if (!block.includes('moveFrames:')) {
      errors.push(`manifest moveFrames missing: ${id}`);
      continue;
    }
    if (files.length < 3) {
      errors.push(`manifest needs idle + at least 2 frame refs: ${id}`);
      continue;
    }
    for (const fileName of unique(files)) {
      if (!assetFiles.has(fileName)) errors.push(`asset file missing for ${id}: public/assets/images/devil/${fileName}`);
    }
  }

  if (!manifestYaml.includes('unknown_sign:')) errors.push('manifest unknown_sign missing.');
  if (!(await fileExists('public/assets/images/devil/unknown_idle.png'))) {
    errors.push('unknown_sign asset missing: public/assets/images/devil/unknown_idle.png');
  }

  if (errors.length > 0) {
    console.error('[config:validate] failed');
    for (const error of errors) console.error(`FAIL ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`[config:validate] OK profiles=${profileIds.length} animated=${profileIds.length} lineups=${unique(lineupIds).length}`);
};

void main();
