import { config } from 'dotenv';
import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { db } from '../db.js';
import {
  GeneratedContentSeedAgent,
  type QuestionDumpPayload,
  type TopicSeedBundle,
  type VideoDumpPayload,
} from './generated-content-seed-agent.js';

config();

const DEFAULT_CLASS_FOLDERS = ['LKG', 'UKG', 'CLASS_1', 'CLASS_2', 'CLASS_3', 'CLASS_4'];
const CURRENT_FILE = fileURLToPath(import.meta.url);
const CURRENT_DIR = path.dirname(CURRENT_FILE);
const REPO_ROOT = path.resolve(CURRENT_DIR, '../../../../');
const DEFAULT_OUTPUT_ROOT = path.join(REPO_ROOT, 'content_generator/output');

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = value;
      i += 1;
    }
  }
  return args;
}

function normalize(value: unknown): string {
  return String(value ?? '').trim();
}

function sanitizeSnake(value: string): string {
  return normalize(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function classFolderToLevel(folder: string): string {
  const upper = normalize(folder).toUpperCase();
  if (upper === 'LKG' || upper === 'UKG') return upper;
  const match = upper.match(/^CLASS_(\d{1,2})$/);
  if (match) return String(Number(match[1]));
  return upper;
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

async function discoverBundles(outputRoot: string, classFolders: string[]): Promise<TopicSeedBundle[]> {
  const bundles: TopicSeedBundle[] = [];

  for (const classFolder of classFolders) {
    const classDir = path.join(outputRoot, classFolder);
    let subjectDirs: string[] = [];
    try {
      subjectDirs = await readdir(classDir);
    } catch {
      continue;
    }

    for (const subjectDirName of subjectDirs) {
      const subjectDir = path.join(classDir, subjectDirName);
      let files: string[] = [];
      try {
        files = await readdir(subjectDir);
      } catch {
        continue;
      }

      const questionFiles = files.filter((name) => name.startsWith('QQQ_') && name.endsWith('.json'));
      for (const questionFileName of questionFiles) {
        const questionPath = path.join(subjectDir, questionFileName);
        const questionDump = await readJson<QuestionDumpPayload>(questionPath);
        const topicFromPayload = sanitizeSnake(normalize(questionDump.topic));
        const topicFromFile = sanitizeSnake(questionFileName.replace(/^QQQ_/, '').replace(/\.json$/i, ''));
        const topicSnake = topicFromPayload || topicFromFile;
        if (!topicSnake) continue;

        const videoPath = path.join(subjectDir, `${topicSnake}.json`);
        let videoDump: VideoDumpPayload;
        try {
          videoDump = await readJson<VideoDumpPayload>(videoPath);
        } catch {
          continue;
        }

        const classLevel = classFolderToLevel(classFolder);
        const subject = sanitizeSnake(normalize(questionDump.subject) || subjectDirName);
        const topic = sanitizeSnake(normalize(questionDump.topic) || topicSnake);
        if (!subject || !topic) continue;

        bundles.push({
          classLevel,
          subject,
          topic,
          videoDump,
          questionDump,
        });
      }
    }
  }

  return bundles;
}

async function resolveOrganizationId(orgIdArg: string | undefined, subdomain: string): Promise<string> {
  if (orgIdArg) return orgIdArg;
  const org = await db.query<{ id: string }>(
    `SELECT id FROM organizations WHERE subdomain = $1 LIMIT 1`,
    [subdomain],
  );
  if ((org.rowCount ?? 0) === 0) {
    throw new Error(`Organization not found for subdomain: ${subdomain}`);
  }
  return org.rows[0].id;
}

async function resolveSeederUserId(orgId: string): Promise<string | null> {
  const result = await db.query<{ id: string }>(
    `SELECT u.id
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.organization_id = $1::uuid
       AND r.role_name IN ('superadmin', 'admin')
     ORDER BY CASE r.role_name WHEN 'superadmin' THEN 0 ELSE 1 END, u.created_at ASC
     LIMIT 1`,
    [orgId],
  );
  if ((result.rowCount ?? 0) === 0) return null;
  return result.rows[0].id;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputRoot = normalize(args['output-root']) || DEFAULT_OUTPUT_ROOT;
  const parsedClassFolders = normalize(args.classes)
    .split(',')
    .map((part) => normalize(part))
    .filter(Boolean);
  const classFolders = parsedClassFolders.length > 0 ? parsedClassFolders : DEFAULT_CLASS_FOLDERS;
  const orgSubdomain = normalize(args['org-subdomain']) || 'els-academy';
  const orgIdArg = normalize(args['org-id']) || undefined;
  const dryRun = Boolean(args['dry-run']);

  const bundles = await discoverBundles(outputRoot, classFolders);
  if (bundles.length === 0) {
    throw new Error(`No matching class/subject/topic bundles found under ${outputRoot}`);
  }

  const organizationId = await resolveOrganizationId(orgIdArg, orgSubdomain);
  const createdBy = await resolveSeederUserId(organizationId);

  const client = await db.connect();
  try {
    const agent = new GeneratedContentSeedAgent(client, {
      organizationId,
      createdBy,
      dryRun,
    });
    const summary = await agent.seedBundles(bundles);
    process.stdout.write(
      JSON.stringify(
        {
          dryRun,
          organizationId,
          outputRoot,
          classFolders,
          bundles: bundles.length,
          summary,
        },
        null,
        2,
      ) + '\n',
    );
  } finally {
    client.release();
    await db.end();
  }
}

main().catch(async (error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  await db.end().catch(() => undefined);
  process.exit(1);
});
