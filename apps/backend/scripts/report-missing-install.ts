import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

import { ComponentMetadataDocumentSchema } from "../../../shared/component-schema";

type PaginationResult<TDocument> = {
  page: TDocument[];
  isDone: boolean;
  continueCursor: string;
};

type CliOptions = {
  json: boolean;
};

type MissingInstallRow = {
  id: string;
  name: string;
  sourceUrl: string;
  sourceLibrary?: string;
};

const DEFAULT_PAGE_SIZE = 200;
const exportTablePage = makeFunctionReference<"query">("admin:exportTablePage");

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const convexUrl = process.env.CONVEX_URL;

  if (!convexUrl) {
    throw new Error("CONVEX_URL is required. Run `bun run --cwd apps/backend dev` first.");
  }

  const client = new ConvexHttpClient(convexUrl);
  const rows = await fetchAllComponents(client);

  const parseErrors: string[] = [];
  const missing: MissingInstallRow[] = [];

  for (const row of rows) {
    const normalized = stripConvexSystemFields(row);
    const parsed = ComponentMetadataDocumentSchema.safeParse(normalized);

    if (!parsed.success) {
      const id = readStringField(normalized, "id") ?? "<unknown>";
      parseErrors.push(`${id}: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
      continue;
    }

    if (parsed.data.install) {
      continue;
    }

    missing.push({
      id: parsed.data.id,
      name: parsed.data.name,
      sourceUrl: parsed.data.source.url,
      sourceLibrary: parsed.data.source.library,
    });
  }

  missing.sort((left, right) => left.id.localeCompare(right.id, "en"));

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          convexUrl,
          totalComponents: rows.length,
          missingInstallCount: missing.length,
          parseErrorCount: parseErrors.length,
          missing,
          parseErrors,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`Convex source: ${convexUrl}`);
    console.log(`Total components: ${rows.length}`);
    console.log(`Missing install metadata: ${missing.length}`);

    if (missing.length > 0) {
      console.log("Components missing install metadata:");
      for (const row of missing) {
        const sourceLibrary = row.sourceLibrary ? ` [${row.sourceLibrary}]` : "";
        console.log(`- ${row.id}${sourceLibrary} -> ${row.sourceUrl}`);
      }
    }
    if (parseErrors.length > 0) {
      console.warn(`WARN: ${parseErrors.length} parse errors encountered while scanning rows.`);
      for (const error of parseErrors) {
        console.warn(`WARN: ${error}`);
      }
    }
  }

  if (parseErrors.length > 0) {
    process.exitCode = 1;
  }
}

async function fetchAllComponents(client: ConvexHttpClient): Promise<unknown[]> {
  const rows: unknown[] = [];
  let cursor: string | undefined;

  while (true) {
    const result: PaginationResult<unknown> = await client.query(exportTablePage, {
      table: "components",
      cursor,
      pageSize: DEFAULT_PAGE_SIZE,
    });

    rows.push(...result.page);

    if (result.isDone) {
      break;
    }

    cursor = result.continueCursor;
  }

  return rows;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
  };

  for (const arg of argv) {
    if (arg === "--json") {
      options.json = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function stripConvexSystemFields(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const result: Record<string, unknown> = {};

  for (const [key, entryValue] of Object.entries(value)) {
    if (key.startsWith("_")) {
      continue;
    }

    result[key] = entryValue;
  }

  return result;
}

function readStringField(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const raw = value[key];
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

await main();
