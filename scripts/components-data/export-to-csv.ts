import { mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

type UnknownRecord = Record<string, unknown>;

type ExportRow = {
  id: string;
  name: string;
  framework: string;
  styling: string;
  intent: string;
  capabilities: string;
  synonyms: string;
  topics: string;
  dependencies: string;
  motion: string;
  sourceUrl: string;
  sourceLibrary: string;
  sourceRepo: string;
  sourceAuthor: string;
  sourceLicense: string;
  codeFile: string;
};

const LIST_SEPARATOR = "|";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const componentsDir = resolve(args.componentsDir ?? "data/components");
  const outputPath = resolve(args.out ?? "data/components.csv");

  const rows: ExportRow[] = [];
  const warnings: string[] = [];

  let entries;
  try {
    entries = await readdir(componentsDir, { withFileTypes: true, encoding: "utf8" });
  } catch (error) {
    throw new Error(`Failed to read components directory '${componentsDir}': ${toErrorMessage(error)}`);
  }

  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  for (const directoryName of directories) {
    const directoryPath = join(componentsDir, directoryName);
    const metaPath = join(directoryPath, "meta.json");
    const file = Bun.file(metaPath);

    if (!(await file.exists())) {
      warnings.push(`Skipping ${toDisplayPath(metaPath)} (missing meta.json).`);
      continue;
    }

    let raw: unknown;
    try {
      raw = await file.json();
    } catch (error) {
      warnings.push(`Skipping ${toDisplayPath(metaPath)} (invalid JSON: ${toErrorMessage(error)}).`);
      continue;
    }

    if (!isRecord(raw)) {
      warnings.push(`Skipping ${toDisplayPath(metaPath)} (meta.json is not an object).`);
      continue;
    }

    rows.push(buildExportRow(raw));
  }

  rows.sort((left, right) => left.id.localeCompare(right.id) || left.name.localeCompare(right.name));

  const csv = buildCsv(rows);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, csv, "utf8");

  console.log(`Exported ${rows.length} components to ${toDisplayPath(outputPath)}`);
  if (warnings.length > 0) {
    for (const warning of warnings) {
      console.warn(`WARN: ${warning}`);
    }
  }
}

function buildExportRow(raw: UnknownRecord): ExportRow {
  const source = isRecord(raw.source) ? raw.source : {};
  const constraints = isRecord(raw.constraints) ? raw.constraints : {};

  const capabilities = readStringList(raw.capabilities, raw.useCases);
  const synonyms = readStringList(raw.synonyms);
  const topics = readStringList(raw.topics, raw.tags);
  const dependencies = readDependencies(raw.dependencies);

  const code = isRecord(raw.code) ? raw.code : {};

  return {
    id: readString(raw.id),
    name: readString(raw.name),
    framework: readString(raw.framework),
    styling: readString(raw.styling),
    intent: readString(raw.intent) || readString(raw.description),
    capabilities: capabilities.join(LIST_SEPARATOR),
    synonyms: synonyms.join(LIST_SEPARATOR),
    topics: topics.join(LIST_SEPARATOR),
    dependencies: dependencies.join(LIST_SEPARATOR),
    motion: readString(raw.motionLevel) || readString(constraints.motion) || readString(raw.motion),
    sourceUrl: readString(source.url),
    sourceLibrary: readString(source.library),
    sourceRepo: readString(source.repo),
    sourceAuthor: readString(source.author),
    sourceLicense: readString(source.license),
    codeFile: readString(code.entryFile) || readString(code.fileName),
  };
}

function readDependencies(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const names: string[] = [];

  for (const entry of value) {
    if (typeof entry === "string") {
      const normalized = normalize(entry);
      if (normalized.length > 0) {
        names.push(normalized);
      }
      continue;
    }

    if (!isRecord(entry)) {
      continue;
    }

    const name = normalize(String(entry.name ?? ""));
    if (name.length > 0) {
      names.push(name);
    }
  }

  return unique(names);
}

function readStringList(...values: unknown[]): string[] {
  for (const value of values) {
    if (!Array.isArray(value)) {
      continue;
    }

    const items = value
      .filter((item) => typeof item === "string")
      .map((item) => normalize(item))
      .filter((item) => item.length > 0);

    return unique(items);
  }

  return [];
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result;
}

function readString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return normalize(value);
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function buildCsv(rows: ExportRow[]): string {
  const headers = [
    "id",
    "name",
    "framework",
    "styling",
    "intent",
    "capabilities",
    "synonyms",
    "topics",
    "dependencies",
    "motion",
    "source_url",
    "source_library",
    "source_repo",
    "source_author",
    "source_license",
    "code_file",
  ];

  const lines = [headers.map(toCsvCell).join(",")];

  for (const row of rows) {
    const values = [
      row.id,
      row.name,
      row.framework,
      row.styling,
      row.intent,
      row.capabilities,
      row.synonyms,
      row.topics,
      row.dependencies,
      row.motion,
      row.sourceUrl,
      row.sourceLibrary,
      row.sourceRepo,
      row.sourceAuthor,
      row.sourceLicense,
      row.codeFile,
    ];

    lines.push(values.map(toCsvCell).join(","));
  }

  return `${lines.join("\n")}\n`;
}

function toCsvCell(value: string): string {
  if (value.length === 0) {
    return "";
  }

  if (!/[",\n]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
}

function parseArgs(argv: string[]): { componentsDir?: string; out?: string } {
  const result: { componentsDir?: string; out?: string } = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--components-dir") {
      result.componentsDir = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--out") {
      result.out = argv[index + 1];
      index += 1;
      continue;
    }
  }

  return result;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toDisplayPath(path: string): string {
  const relativePath = relative(process.cwd(), path);
  return relativePath.startsWith("..") ? path : relativePath;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

await main();
