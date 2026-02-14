import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { parseComponentDocument } from "../../src/types";

type CliOptions = {
  componentsDir: string;
};

type UnknownRecord = Record<string, unknown>;

const ALLOWED_DEPENDENCY_KINDS = new Set(["runtime", "dev", "peer"]);
const ALLOWED_MOTION_LEVELS = new Set(["none", "minimal", "standard", "heavy"]);

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const componentsDir = resolve(options.componentsDir);

  const entries = await readdir(componentsDir, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  let migratedFromV1Count = 0;
  let refreshedV2Count = 0;
  let skippedCount = 0;

  for (const directoryName of directories) {
    const componentDirPath = join(componentsDir, directoryName);
    const metaPath = join(componentDirPath, "meta.json");
    const file = Bun.file(metaPath);

    if (!(await file.exists())) {
      continue;
    }

    let raw: unknown;
    try {
      raw = await file.json();
    } catch (error) {
      console.warn(`WARN: Skipping ${toDisplayPath(metaPath)} (invalid JSON: ${toErrorMessage(error)})`);
      skippedCount += 1;
      continue;
    }

    if (!isRecord(raw)) {
      console.warn(`WARN: Skipping ${toDisplayPath(metaPath)} (meta.json is not an object)`);
      skippedCount += 1;
      continue;
    }

    const wasV2 = raw.schemaVersion === 2;

    let migrated: unknown;
    try {
      migrated = await migrateDocument(raw, componentDirPath);
      parseComponentDocument(migrated);
    } catch (error) {
      console.warn(`WARN: Skipping ${toDisplayPath(metaPath)} (migration failed: ${toErrorMessage(error)})`);
      skippedCount += 1;
      continue;
    }

    await writeFile(metaPath, `${JSON.stringify(migrated, null, 2)}\n`, "utf8");

    if (wasV2) {
      refreshedV2Count += 1;
    } else {
      migratedFromV1Count += 1;
    }
  }

  console.log(`Migration complete for ${toDisplayPath(componentsDir)}`);
  console.log(`Migrated from v1: ${migratedFromV1Count}`);
  console.log(`Refreshed v2: ${refreshedV2Count}`);
  console.log(`Skipped: ${skippedCount}`);
}

async function migrateDocument(raw: UnknownRecord, componentDirPath: string): Promise<unknown> {
  const source = asRecord(raw.source);
  const constraints = asRecord(raw.constraints);
  const code = asRecord(raw.code);

  const sourceUrl = readRequiredNormalizedText(source.url, "source.url");
  const framework = readRequiredNormalizedText(raw.framework, "framework");
  const styling = readRequiredNormalizedText(raw.styling, "styling");

  const files = await readCodeFiles(code, componentDirPath);
  const entryFile =
    readOptionalPath(code.entryFile) ??
    readOptionalPath(code.fileName) ??
    files[0]?.path;

  if (!entryFile) {
    throw new Error("Missing code.entryFile/code.fileName and no code files found");
  }

  const motionLevelCandidate =
    readOptionalNormalizedText(raw.motionLevel) ??
    readOptionalNormalizedText(constraints.motion) ??
    readOptionalNormalizedText(raw.motion) ??
    "standard";

  const motionLevel = motionLevelCandidate.toLowerCase();
  if (!ALLOWED_MOTION_LEVELS.has(motionLevel)) {
    throw new Error(`Invalid motion level '${motionLevelCandidate}'`);
  }

  return {
    schemaVersion: 2,
    id: readRequiredNormalizedText(raw.id, "id"),
    name: readRequiredNormalizedText(raw.name, "name"),
    source: {
      url: sourceUrl,
      ...(readOptionalNormalizedText(source.library) ? { library: readOptionalNormalizedText(source.library) } : {}),
      ...(readOptionalNormalizedText(source.repo) ? { repo: readOptionalNormalizedText(source.repo) } : {}),
      ...(readOptionalNormalizedText(source.author) ? { author: readOptionalNormalizedText(source.author) } : {}),
      ...(readOptionalNormalizedText(source.license) ? { license: readOptionalNormalizedText(source.license) } : {}),
    },
    framework,
    styling,
    dependencies: readDependencies(raw.dependencies),
    intent: readRequiredNormalizedText(raw.intent ?? raw.description, "intent"),
    capabilities: readStringArray(raw.capabilities ?? raw.useCases),
    synonyms: readStringArray(raw.synonyms),
    topics: readStringArray(raw.topics ?? raw.tags),
    motionLevel,
    code: {
      entryFile,
      files,
    },
  };
}

async function readCodeFiles(
  code: UnknownRecord,
  componentDirPath: string,
): Promise<Array<{ path: string; content: string }>> {
  const candidatePaths: string[] = [];

  if (Array.isArray(code.files)) {
    for (const file of code.files) {
      if (!isRecord(file)) {
        continue;
      }

      const path = readOptionalPath(file.path);
      if (path) {
        candidatePaths.push(path);
      }
    }
  }

  const legacyFileName = readOptionalPath(code.fileName);
  if (legacyFileName) {
    candidatePaths.push(legacyFileName);
  }

  const uniquePaths: string[] = [];
  const seen = new Set<string>();
  for (const path of candidatePaths) {
    const key = path.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniquePaths.push(path);
  }

  const filesFromDisk: Array<{ path: string; content: string }> = [];
  for (const path of uniquePaths) {
    const fullPath = join(componentDirPath, path);
    const file = Bun.file(fullPath);

    if (!(await file.exists())) {
      continue;
    }

    const content = await readFile(fullPath, "utf8");
    filesFromDisk.push({ path, content });
  }

  if (filesFromDisk.length > 0) {
    return filesFromDisk;
  }

  const fallbackPath = legacyFileName;
  const fallbackContent = readOptionalContent(code.content);
  if (fallbackPath && fallbackContent !== undefined) {
    return [{ path: fallbackPath, content: fallbackContent }];
  }

  if (Array.isArray(code.files)) {
    const fallbackFiles: Array<{ path: string; content: string }> = [];
    for (const file of code.files) {
      if (!isRecord(file)) {
        continue;
      }

      const path = readOptionalPath(file.path);
      const content = readOptionalContent(file.content);
      if (path && content !== undefined) {
        fallbackFiles.push({ path, content });
      }
    }

    if (fallbackFiles.length > 0) {
      return fallbackFiles;
    }
  }

  throw new Error("Missing code files");
}

function readDependencies(value: unknown): Array<{ name: string; kind: "runtime" | "dev" | "peer" }> {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const dependencies: Array<{ name: string; kind: "runtime" | "dev" | "peer" }> = [];

  for (const entry of value) {
    if (typeof entry === "string") {
      const name = normalizeText(entry);
      if (name.length === 0) {
        continue;
      }

      const key = name.toLowerCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      dependencies.push({ name, kind: "runtime" });
      continue;
    }

    if (!isRecord(entry)) {
      continue;
    }

    const name = normalizeText(String(entry.name ?? ""));
    if (name.length === 0) {
      continue;
    }

    const key = name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    const kindValue = normalizeText(String(entry.kind ?? "runtime")).toLowerCase();
    const kind = ALLOWED_DEPENDENCY_KINDS.has(kindValue)
      ? (kindValue as "runtime" | "dev" | "peer")
      : "runtime";

    seen.add(key);
    dependencies.push({ name, kind });
  }

  return dependencies;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }

    const normalized = normalizeText(entry);
    if (normalized.length === 0) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function readRequiredNormalizedText(value: unknown, label: string): string {
  const normalized = readOptionalNormalizedText(value);
  if (!normalized) {
    throw new Error(`Missing required field '${label}'`);
  }

  return normalized;
}

function readOptionalNormalizedText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : undefined;
}

function readOptionalPath(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function readOptionalContent(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return value.length > 0 ? value : undefined;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    componentsDir: "data/components",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--components-dir") {
      options.componentsDir = argv[index + 1] ?? options.componentsDir;
      index += 1;
      continue;
    }
  }

  return options;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function toDisplayPath(path: string): string {
  const relativePath = relative(process.cwd(), path);
  return relativePath.startsWith("..") ? path : relativePath;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

await main();
