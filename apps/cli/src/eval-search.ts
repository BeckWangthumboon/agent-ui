import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type SearchResult = {
  id: string;
  name: string;
};

type SearchPayload = {
  query: string;
  mode: "strict" | "relaxed";
  strictResultCount: number;
  relaxed: boolean;
  resultCount: number;
  results: SearchResult[];
};

const DEFAULT_LIMIT = 5;
const DEFAULT_QUERIES = [
  "button",
  "dialog",
  "table",
  "calendar",
  "command menu",
  "tooltip",
];

function parseArgs(argv: string[]) {
  const queries: string[] = [];
  let limit = DEFAULT_LIMIT;
  let relax = false;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === undefined) {
      continue;
    }

    if (value === "--relax") {
      relax = true;
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

    queries.push(value);
  }

  return {
    queries: queries.length > 0 ? queries : DEFAULT_QUERIES,
    limit,
    relax,
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

async function main() {
  const convexUrl = await resolveConvexUrl();
  if (!convexUrl) {
    throw new Error(
      "CONVEX_URL is required. Set env var or add CONVEX_URL to apps/backend/.env.local.",
    );
  }

  const { queries, limit, relax } = parseArgs(process.argv.slice(2));
  const bunExecutable = process.execPath;
  const cliEntry = fileURLToPath(new URL("./cli.ts", import.meta.url));
  const decoder = new TextDecoder();

  console.log(
    `Search eval: queries=${queries.length}, limit=${limit}, mode=${relax ? "relaxed" : "strict"}`,
  );

  let failed = 0;
  for (const query of queries) {
    const cmd = [bunExecutable, "run", cliEntry, "search", query, "--json", "--limit", `${limit}`];
    if (relax) {
      cmd.push("--relax");
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
      console.log(`\nQuery: "${query}"`);
      console.log(`  ERROR (exit ${result.exitCode}): ${stderr || "unknown error"}`);
      continue;
    }

    const payload = parsePayload(decoder.decode(result.stdout));
    const top = payload.results
      .slice(0, limit)
      .map((row, index) => `${index + 1}. ${row.id} (${row.name})`)
      .join(" | ");

    console.log(`\nQuery: "${query}"`);
    console.log(
      `  count=${payload.resultCount}, strictCount=${payload.strictResultCount}, mode=${payload.mode}`,
    );
    console.log(`  top: ${top || "(none)"}`);
  }

  if (failed > 0) {
    process.exitCode = 1;
    console.log(`\nCompleted with ${failed} query error(s).`);
    return;
  }

  console.log("\nCompleted without errors.");
}

await main();
