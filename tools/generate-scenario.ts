import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { normalizeScenarioPack } from '../src/scenario/scenarioTypes.ts';

type GenerateType = 'encounter' | 'moe' | 'route';

const TEMPLATE_BY_TYPE: Record<GenerateType, string> = {
  encounter: 'encounter-dialogue.prompt.md',
  moe: 'moe-lines.prompt.md',
  route: 'route-event.prompt.md',
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const promptsDir = path.resolve(rootDir, 'tools', 'prompts');
const outputDir = path.resolve(rootDir, 'drafts', 'scenarios', 'generated');

const localAiBaseUrl = process.env.LOCAL_AI_BASE_URL ?? 'http://localhost:1234/v1';
const localAiModel = process.env.LOCAL_AI_MODEL ?? 'local-model';
const localAiApiKey = process.env.LOCAL_AI_API_KEY ?? 'not-needed';

const usage = `Usage:
  npm run scenario:generate -- --type encounter --id pixie_shibuya_glow
  npm run scenario:generate -- --type moe --id garage
  npm run scenario:generate -- --type route --id signal_tunnel_01

Env:
  LOCAL_AI_BASE_URL (default: http://localhost:1234/v1)
  LOCAL_AI_MODEL    (default: local-model)
  LOCAL_AI_API_KEY  (default: not-needed)
`;

type ParsedArgs = {
  type?: GenerateType;
  id?: string;
};

const parseArgs = (argv: string[]): ParsedArgs => {
  const result: ParsedArgs = {};
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === '--type') {
      const next = argv[i + 1] as GenerateType | undefined;
      if (next === 'encounter' || next === 'moe' || next === 'route') result.type = next;
      i += 1;
      continue;
    }
    if (current === '--id') {
      const next = argv[i + 1];
      if (next) result.id = next;
      i += 1;
    }
  }
  return result;
};

const sanitizeFileName = (value: string): string =>
  value.replace(/[^a-zA-Z0-9._-]/g, '_');

const extractJsonCandidate = (raw: string): string => {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();

  const firstObj = raw.indexOf('{');
  const firstArr = raw.indexOf('[');
  const start =
    firstObj === -1 ? firstArr
      : firstArr === -1 ? firstObj
        : Math.min(firstObj, firstArr);
  if (start === -1) return raw.trim();

  const lastObj = raw.lastIndexOf('}');
  const lastArr = raw.lastIndexOf(']');
  const end = Math.max(lastObj, lastArr);
  if (end === -1 || end <= start) return raw.slice(start).trim();
  return raw.slice(start, end + 1).trim();
};

const ensureDir = async (targetDir: string) => {
  await mkdir(targetDir, { recursive: true });
};

const exists = async (targetPath: string): Promise<boolean> => {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
};

const canOverwriteDraft = async (targetPath: string): Promise<boolean> => {
  if (!(await exists(targetPath))) return true;
  try {
    const current = JSON.parse(await readFile(targetPath, 'utf-8')) as unknown;
    return normalizeScenarioPack(current) === undefined;
  } catch {
    return true;
  }
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

const validateMoeFragment = (raw: unknown): boolean => {
  const pack = normalizeScenarioPack({
    version: 1,
    id: 'draft-moe',
    title: 'draft moe',
    moeLines: raw,
  });
  return !!pack?.moeLines && Object.keys(pack.moeLines).length > 0;
};

const validateByType = (type: GenerateType, raw: unknown): boolean => {
  if (type === 'encounter') return validateEncounterFragment(raw);
  if (type === 'route') return validateRouteFragment(raw);
  return validateMoeFragment(raw);
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.type || !args.id) {
    console.error(usage);
    process.exitCode = 1;
    return;
  }

  const templateFile = TEMPLATE_BY_TYPE[args.type];
  const templatePath = path.resolve(promptsDir, templateFile);
  const template = await readFile(templatePath, 'utf-8');

  const composedPrompt = `${template}

## Generation Request

type: ${args.type}
id: ${args.id}

Return valid JSON only.`;

  const body = {
    model: localAiModel,
    messages: [
      {
        role: 'system',
        content: 'You are a scenario authoring assistant. Output JSON only. Never include markdown.',
      },
      {
        role: 'user',
        content: composedPrompt,
      },
    ],
    temperature: 0.4,
    response_format: { type: 'json_object' },
  };

  let responseContent = '';
  try {
    const response = await fetch(`${localAiBaseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localAiApiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI endpoint error (${response.status}): ${errorText}`);
    }
    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content === 'string') responseContent = content;
    else if (Array.isArray(content)) responseContent = content.map((part) => part.text ?? '').join('\n');
  } catch (error) {
    console.error('[scenario:generate] request failed:', error);
    console.error('Hint: check LOCAL_AI_BASE_URL and that your local AI server is running.');
    process.exitCode = 1;
    return;
  }

  await ensureDir(outputDir);
  const safeId = sanitizeFileName(args.id);
  const jsonOutPath = path.resolve(outputDir, `${safeId}.json`);
  const rawOutPath = path.resolve(outputDir, `${safeId}.raw.txt`);

  const jsonCandidate = extractJsonCandidate(responseContent);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch (error) {
    await writeFile(rawOutPath, responseContent, 'utf-8');
    console.error(`[scenario:generate] JSON parse failed for "${args.id}". Raw output saved: ${rawOutPath}`);
    console.error(error);
    process.exitCode = 1;
    return;
  }

  if (!validateByType(args.type, parsed)) {
    await writeFile(rawOutPath, responseContent, 'utf-8');
    console.error(`[scenario:generate] schema validation failed for "${args.id}". Raw output saved: ${rawOutPath}`);
    process.exitCode = 1;
    return;
  }

  const allowWrite = await canOverwriteDraft(jsonOutPath);
  if (!allowWrite) {
    console.error(`[scenario:generate] valid draft already exists, not overwriting: ${jsonOutPath}`);
    console.error('Remove or rename existing draft if you want a new generation.');
    process.exitCode = 1;
    return;
  }

  await writeFile(jsonOutPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf-8');
  console.log(`[scenario:generate] draft written: ${jsonOutPath}`);
};

void main();
