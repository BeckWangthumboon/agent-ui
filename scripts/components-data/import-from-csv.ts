import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";

type CsvRow = Record<string, string>;

type CliOptions = {
  inputPath: string;
  componentsDir: string;
};

const REQUIRED_HEADERS = [
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
  "source_repo",
  "source_author",
  "source_license",
  "code_file",
];

const ALLOWED_MOTION = new Set(["none", "minimal", "standard", "heavy"]);

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const csvPath = resolve(options.inputPath);
  const componentsDir = resolve(options.componentsDir);

  const csvText = await readFile(csvPath, "utf8");
  const { headers, rows } = parseCsv(csvText);
  ensureHeaders(headers);

  const warnings: string[] = [];
  let written = 0;

  for (const row of rows) {
    const codeFileName = readRequired(row, "code_file");
    const componentId = readRequired(row, "id");
    const componentDirName = toComponentDirName(componentId, codeFileName);
    const componentDirPath = join(componentsDir, componentDirName);
    const codePath = join(componentDirPath, codeFileName);

    const codeFile = Bun.file(codePath);
    if (!(await codeFile.exists())) {
      warnings.push(`Skipped ${componentId}: missing code file ${toDisplayPath(codePath)}`);
      continue;
    }

    const codeContent = await codeFile.text();
    if (codeContent.trim().length === 0) {
      warnings.push(`Skipped ${componentId}: code file is empty ${toDisplayPath(codePath)}`);
      continue;
    }

    const motion = readRequired(row, "motion");
    if (!ALLOWED_MOTION.has(motion)) {
      warnings.push(`Skipped ${componentId}: invalid motion '${motion}'`);
      continue;
    }

    const source = {
      url: readRequired(row, "source_url"),
      ...(readOptional(row, "source_library") ? { library: readOptional(row, "source_library") } : {}),
      ...(readOptional(row, "source_repo") ? { repo: readOptional(row, "source_repo") } : {}),
      ...(readOptional(row, "source_author") ? { author: readOptional(row, "source_author") } : {}),
      ...(readOptional(row, "source_license") ? { license: readOptional(row, "source_license") } : {}),
    };

    const document = {
      schemaVersion: 2,
      id: componentId,
      name: readRequired(row, "name"),
      source,
      framework: readRequired(row, "framework"),
      styling: readRequired(row, "styling"),
      dependencies: splitPipe(readOptional(row, "dependencies")).map((name) => ({
        name,
        kind: "runtime" as const,
      })),
      intent: readRequired(row, "intent"),
      capabilities: splitPipe(readOptional(row, "capabilities")),
      synonyms: splitPipe(readOptional(row, "synonyms")),
      topics: splitPipe(readOptional(row, "topics")),
      motionLevel: motion,
      code: {
        entryFile: codeFileName,
        files: [
          {
            path: codeFileName,
            content: codeContent,
          },
        ],
      },
    };

    await mkdir(componentDirPath, { recursive: true });
    const metaPath = join(componentDirPath, "meta.json");
    await writeFile(metaPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
    written += 1;
  }

  console.log(`Imported ${written} component metadata files from ${toDisplayPath(csvPath)}.`);
  if (warnings.length > 0) {
    for (const warning of warnings) {
      console.warn(`WARN: ${warning}`);
    }
  }
}

function toComponentDirName(componentId: string, codeFileName: string): string {
  const codeBase = basename(codeFileName, extname(codeFileName)).trim();
  if (codeBase.length > 0) {
    return codeBase;
  }

  return componentId.replace(/^shadcn-/, "").trim();
}

function splitPipe(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const part of value.split("|")) {
    const normalized = part.trim();
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

function readRequired(row: CsvRow, key: string): string {
  const value = row[key]?.trim();
  if (!value) {
    throw new Error(`Missing required CSV value: ${key}`);
  }
  return value;
}

function readOptional(row: CsvRow, key: string): string | undefined {
  const value = row[key]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function ensureHeaders(headers: string[]): void {
  const present = new Set(headers);

  for (const header of REQUIRED_HEADERS) {
    if (!present.has(header)) {
      throw new Error(`CSV is missing required header: ${header}`);
    }
  }
}

function parseCsv(content: string): { headers: string[]; rows: CsvRow[] } {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = splitCsvLines(normalized).filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    throw new Error("CSV file is empty");
  }

  const headerLine = lines[0];
  if (!headerLine) {
    throw new Error("CSV file is missing a header row");
  }

  const headers = parseCsvLine(headerLine).map((header) => header.trim());
  const rows: CsvRow[] = [];

  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line);
    const row: CsvRow = {};

    for (let index = 0; index < headers.length; index += 1) {
      const header = headers[index];
      if (!header) {
        continue;
      }

      row[header] = values[index] ?? "";
    }

    rows.push(row);
  }

  return { headers, rows };
}

function splitCsvLines(content: string): string[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (char === '"') {
      const isEscapedQuote = inQuotes && content[index + 1] === '"';
      if (isEscapedQuote) {
        current += '""';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      current += char;
      continue;
    }

    if (char === "\n" && !inQuotes) {
      lines.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    inputPath: "data/components.csv",
    componentsDir: "data/components",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--input") {
      options.inputPath = argv[index + 1] ?? options.inputPath;
      index += 1;
      continue;
    }

    if (arg === "--components-dir") {
      options.componentsDir = argv[index + 1] ?? options.componentsDir;
      index += 1;
      continue;
    }
  }

  return options;
}

function toDisplayPath(path: string): string {
  const relativePath = relative(process.cwd(), path);
  return relativePath.startsWith("..") ? path : relativePath;
}

await main();
