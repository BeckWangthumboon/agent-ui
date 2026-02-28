import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type SearchDebugInfo = {
  reason: "lexical" | "semantic" | "both";
  rrfScore: number;
  lexicalRank?: number;
  semanticRank?: number;
  lexicalRrfTerm?: number;
  semanticRrfTerm?: number;
  k: number;
  lexicalWeight: number;
  semanticWeight: number;
};

type SearchResult = {
  id: string;
  name: string;
  debug?: SearchDebugInfo;
};

type SearchPayload = {
  query: string;
  mode: "strict" | "relaxed";
  strictResultCount: number;
  relaxed: boolean;
  resultCount: number;
  results: SearchResult[];
};

type EvalArgs = {
  queries: string[];
  limit: number;
  relax: boolean;
  debug: boolean;
  useProjectConfig: boolean;
  out?: string;
};

type EvalRecord = {
  runTimestampUtc: string;
  query: string;
  mode: "strict" | "relaxed";
  relax: boolean;
  debug: boolean;
  limit: number;
  success: boolean;
  exitCode: number;
  error?: string;
  resultCount?: number;
  strictResultCount?: number;
  top?: Array<{
    rank: number;
    id: string;
    name: string;
    debug?: SearchDebugInfo;
  }>;
};

const DEFAULT_LIMIT = 5;
const DEFAULT_QUERIES = [
  "button",
  "dialog",
  "table",
  "calendar",
  "command menu",
  "tooltip",
  "checkout cart",
  "shopping cart drawer",
  "dropdown for account actions",
  "select with search",
  "multi select tags",
  "date range picker",
  "file upload drag and drop",
  "otp input",
  "pricing cards",
  "testimonials carousel",
  "faq accordion",
  "kanban board",
  "infinite scrolling list",
  "chat composer input",
];
const EVAL_UNFILTERED_CONFIG = {
  schemaVersion: 1,
  search: {},
  add: {},
} as const;

export function parseArgs(argv: string[]): EvalArgs {
  const queries: string[] = [];
  let limit = DEFAULT_LIMIT;
  let relax = false;
  let debug = false;
  let useProjectConfig = false;
  let out: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === undefined) {
      continue;
    }

    if (value === "--relax") {
      relax = true;
      continue;
    }

    if (value === "--debug") {
      debug = true;
      continue;
    }

    if (value === "--use-project-config") {
      useProjectConfig = true;
      continue;
    }

    if (value === "--limit") {
      const raw = argv[index + 1];
      if (!raw) {
        throw new Error("Missing value for --limit");
      }
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --limit value: ${raw}`);
      }
      limit = parsed;
      index += 1;
      continue;
    }

    if (value === "--out") {
      const raw = argv[index + 1];
      if (!raw) {
        throw new Error("Missing value for --out");
      }
      out = raw;
      index += 1;
      continue;
    }

    queries.push(value);
  }

  return {
    queries: queries.length > 0 ? queries : DEFAULT_QUERIES,
    limit,
    relax,
    debug,
    useProjectConfig,
    out,
  };
}

function parsePayload(stdout: string): SearchPayload {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    throw new Error("Search command returned empty stdout.");
  }
  return JSON.parse(trimmed) as SearchPayload;
}

function parseDotEnvValue(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

async function readEnvVarFromFile(filePath: string, key: string): Promise<string | undefined> {
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }

  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    const candidateKey = trimmed.slice(0, separator).trim();
    if (candidateKey !== key) {
      continue;
    }
    const candidateValue = parseDotEnvValue(trimmed.slice(separator + 1));
    if (candidateValue.length > 0) {
      return candidateValue;
    }
  }

  return undefined;
}

async function resolveConvexUrl(): Promise<string | undefined> {
  const direct = process.env.CONVEX_URL?.trim();
  if (direct) {
    return direct;
  }

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const candidatePaths = [
    resolve(process.cwd(), "apps/backend/.env.local"),
    resolve(process.cwd(), "../backend/.env.local"),
    resolve(scriptDir, "../../backend/.env.local"),
  ];

  for (const candidatePath of candidatePaths) {
    const fromFile = await readEnvVarFromFile(candidatePath, "CONVEX_URL");
    if (fromFile) {
      process.env.CONVEX_URL = fromFile;
      return fromFile;
    }
  }

  return undefined;
}

function toFilenameTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/gu, "")
    .replace(/\.\d{3}Z$/u, "Z");
}

function defaultOutputPath(now = new Date()): string {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(scriptDir, "../../..");
  return resolve(repoRoot, "data/evals/search", `search-eval-${toFilenameTimestamp(now)}.jsonl`);
}

function resolveOutputPath(out: string | undefined): string {
  if (!out || out.trim().length === 0) {
    return defaultOutputPath();
  }
  return resolve(process.cwd(), out);
}

async function writeEvalConfigFile(outputPath: string): Promise<string> {
  const configPath = resolve(dirname(outputPath), "search-eval-config.json");
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(EVAL_UNFILTERED_CONFIG, null, 2)}\n`, "utf8");
  return configPath;
}

function toEvalRecord(args: {
  query: string;
  mode: "strict" | "relaxed";
  relax: boolean;
  debug: boolean;
  limit: number;
  exitCode: number;
  stderr?: string;
  payload?: SearchPayload;
}): EvalRecord {
  const timestamp = new Date().toISOString();
  if (!args.payload) {
    return {
      runTimestampUtc: timestamp,
      query: args.query,
      mode: args.mode,
      relax: args.relax,
      debug: args.debug,
      limit: args.limit,
      success: false,
      exitCode: args.exitCode,
      error: args.stderr && args.stderr.length > 0 ? args.stderr : "unknown error",
    };
  }

  return {
    runTimestampUtc: timestamp,
    query: args.query,
    mode: args.payload.mode,
    relax: args.relax,
    debug: args.debug,
    limit: args.limit,
    success: true,
    exitCode: args.exitCode,
    resultCount: args.payload.resultCount,
    strictResultCount: args.payload.strictResultCount,
    top: args.payload.results.slice(0, args.limit).map((row, index) => ({
      rank: index + 1,
      id: row.id,
      name: row.name,
      debug: row.debug,
    })),
  };
}

export async function main(argv = process.argv.slice(2)) {
  const convexUrl = await resolveConvexUrl();
  if (!convexUrl) {
    throw new Error(
      "CONVEX_URL is required. Set env var or add CONVEX_URL to apps/backend/.env.local.",
    );
  }

  const { queries, limit, relax, debug, useProjectConfig, out } = parseArgs(argv);
  const outputPath = resolveOutputPath(out);
  const evalConfigPath = useProjectConfig ? undefined : await writeEvalConfigFile(outputPath);
  const mode = relax ? "relaxed" : "strict";
  const bunExecutable = process.execPath;
  const cliEntry = fileURLToPath(new URL("./cli.ts", import.meta.url));
  const decoder = new TextDecoder();

  console.log(
    `Search eval: queries=${queries.length}, limit=${limit}, mode=${mode}, debug=${debug ? "on" : "off"}, config=${useProjectConfig ? "project" : "unfiltered"}`,
  );

  let failed = 0;
  const records: EvalRecord[] = [];
  for (const query of queries) {
    const cmd = [bunExecutable, "run", cliEntry, "search", query, "--json", "--limit", `${limit}`];
    if (evalConfigPath) {
      cmd.push("--config", evalConfigPath);
    }
    if (relax) {
      cmd.push("--relax");
    }
    if (debug) {
      cmd.push("--debug");
    }

    const result = Bun.spawnSync({
      cmd,
      env: process.env,
      stdout: "pipe",
      stderr: "pipe",
    });

    if (result.exitCode !== 0) {
      failed += 1;
      const stderr = decoder.decode(result.stderr).trim();
      records.push(
        toEvalRecord({
          query,
          mode,
          relax,
          debug,
          limit,
          exitCode: result.exitCode,
          stderr,
        }),
      );
      console.log(`\nQuery: "${query}"`);
      console.log(`  ERROR (exit ${result.exitCode}): ${stderr || "unknown error"}`);
      continue;
    }

    const payload = parsePayload(decoder.decode(result.stdout));
    records.push(
      toEvalRecord({
        query,
        mode,
        relax,
        debug,
        limit,
        exitCode: result.exitCode,
        payload,
      }),
    );
    const top = payload.results
      .slice(0, limit)
      .map((row, index) => {
        const reason = row.debug?.reason ? ` [${row.debug.reason}]` : "";
        return `${index + 1}. ${row.id} (${row.name})${reason}`;
      })
      .join(" | ");

    console.log(`\nQuery: "${query}"`);
    console.log(
      `  count=${payload.resultCount}, strictCount=${payload.strictResultCount}, mode=${payload.mode}`,
    );
    console.log(`  top: ${top || "(none)"}`);
  }

  await mkdir(dirname(outputPath), { recursive: true });
  const outputBody = records.map((record) => JSON.stringify(record)).join("\n");
  await writeFile(outputPath, outputBody.length > 0 ? `${outputBody}\n` : "", "utf8");

  console.log(`\nWrote ${records.length} eval rows to ${outputPath}`);

  if (failed > 0) {
    process.exitCode = 1;
    console.log(`Completed with ${failed} query error(s).`);
    return;
  }

  console.log("Completed without errors.");
}

if (import.meta.main) {
  await main();
}
