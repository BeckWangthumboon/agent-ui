import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

type SnapshotTable = "components" | "componentCode" | "componentSearch";

type PaginationResult<TDocument> = {
  page: TDocument[];
  isDone: boolean;
  continueCursor: string;
};

type SnapshotPayload = {
  snapshotVersion: 1;
  exportedAt: string;
  source: {
    convexUrl: string;
    convexDeployment: string | null;
  };
  counts: {
    components: number;
    componentCode: number;
    componentSearch: number;
  };
  tables: {
    components: unknown[];
    componentCode: unknown[];
    componentSearch: unknown[];
  };
};

type CliOptions = {
  outPath: string;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 100;

const exportTablePage = makeFunctionReference<"query">("admin:exportTablePage");

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const convexUrl = process.env.CONVEX_URL;

  if (!convexUrl) {
    throw new Error("CONVEX_URL is required. Run `bun run --cwd apps/backend dev` first.");
  }

  const outputPath = resolve(options.outPath);
  const client = new ConvexHttpClient(convexUrl);

  const components = await fetchAllDocuments(client, "components", options.pageSize);
  const componentCode = await fetchAllDocuments(client, "componentCode", options.pageSize);
  const componentSearch = await fetchAllDocuments(client, "componentSearch", options.pageSize);

  sortDocuments(components, "id");
  sortDocuments(componentCode, "componentId");
  sortDocuments(componentSearch, "componentId");

  const payload: SnapshotPayload = {
    snapshotVersion: 1,
    exportedAt: new Date().toISOString(),
    source: {
      convexUrl,
      convexDeployment: process.env.CONVEX_DEPLOYMENT ?? null,
    },
    counts: {
      components: components.length,
      componentCode: componentCode.length,
      componentSearch: componentSearch.length,
    },
    tables: {
      components,
      componentCode,
      componentSearch,
    },
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Snapshot exported to ${toDisplayPath(outputPath)}`);
  console.log(
    `Counts: components=${payload.counts.components}, componentCode=${payload.counts.componentCode}, componentSearch=${payload.counts.componentSearch}`,
  );
}

async function fetchAllDocuments(
  client: ConvexHttpClient,
  table: SnapshotTable,
  pageSize: number,
): Promise<unknown[]> {
  const documents: unknown[] = [];
  let cursor: string | undefined;
  let pageNumber = 0;

  while (true) {
    pageNumber += 1;

    const result = (await client.query(exportTablePage, {
      table,
      cursor,
      pageSize,
    })) as PaginationResult<unknown>;

    documents.push(...result.page);

    console.log(
      `Fetched ${table} page ${pageNumber}: +${result.page.length} (total ${documents.length})`,
    );

    if (result.isDone) {
      break;
    }

    cursor = result.continueCursor;
  }

  return documents;
}

function sortDocuments(documents: unknown[], key: "id" | "componentId"): void {
  documents.sort((left, right) => {
    const leftValue = readSortKey(left, key);
    const rightValue = readSortKey(right, key);

    if (leftValue !== rightValue) {
      return leftValue.localeCompare(rightValue, "en");
    }

    return readSortKey(left, "_id").localeCompare(readSortKey(right, "_id"), "en");
  });
}

function readSortKey(value: unknown, key: "id" | "componentId" | "_id"): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "";
  }

  const record = value as Record<string, unknown>;
  const raw = record[key];
  return typeof raw === "string" ? raw : "";
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    outPath: `../../data/snapshots/convex-truth-${timestampForFilename()}.json`,
    pageSize: DEFAULT_PAGE_SIZE,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--out") {
      options.outPath = argv[index + 1] ?? options.outPath;
      index += 1;
      continue;
    }

    if (arg === "--page-size") {
      options.pageSize = parsePositiveInteger(argv[index + 1], DEFAULT_PAGE_SIZE);
      index += 1;
      continue;
    }
  }

  return options;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function timestampForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function toDisplayPath(path: string): string {
  const relativePath = relative(process.cwd(), path);
  return relativePath.startsWith("..") ? path : relativePath;
}

await main();
