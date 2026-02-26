import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type { ZodType } from "zod";

import {
  ComponentEmbeddingDocumentSchema,
  ComponentMetadataDocumentSchema,
  ComponentSearchDocumentSchema,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  buildComponentEmbeddingText,
} from "../../../shared/component-schema";

type SnapshotTable = "components" | "componentSearch" | "componentEmbeddings";

type PaginationResult<TDocument> = {
  page: TDocument[];
  isDone: boolean;
  continueCursor: string;
};

type ReindexOptions = {
  dryRun: boolean;
  usePlaceholderEmbeddings: boolean;
  prune: boolean;
  limit?: number;
  pageSize: number;
  batchSize: number;
};

type EmbeddingPayload = {
  componentId: string;
  model: typeof EMBEDDING_MODEL;
  embedding: number[];
};

const DEFAULT_PAGE_SIZE = 200;
const DEFAULT_BATCH_SIZE = 8;

const exportTablePage = makeFunctionReference<"query">("admin:exportTablePage");
const upsertManyEmbeddings = makeFunctionReference<"mutation">("embeddings:upsertMany");
const deleteManyEmbeddings = makeFunctionReference<"mutation">("embeddings:deleteMany");

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const convexUrl = process.env.CONVEX_URL;

  if (!convexUrl) {
    throw new Error("CONVEX_URL is required. Run `bun run --cwd apps/backend dev` first.");
  }

  const client = new ConvexHttpClient(convexUrl);

  const rawMetadataRows = await fetchAllDocuments(client, "components", options.pageSize);
  const rawSearchRows = await fetchAllDocuments(client, "componentSearch", options.pageSize);

  const metadataRows = parseRows(
    rawMetadataRows,
    "components",
    ComponentMetadataDocumentSchema,
    "id",
  );
  const searchRows = parseRows(
    rawSearchRows,
    "componentSearch",
    ComponentSearchDocumentSchema,
    "componentId",
  );

  const searchByComponentId = new Map(searchRows.map((row) => [row.componentId, row]));
  const sortedMetadataRows = [...metadataRows].sort((left, right) =>
    left.id.localeCompare(right.id, "en"),
  );
  const limitedMetadataRows =
    options.limit !== undefined ? sortedMetadataRows.slice(0, options.limit) : sortedMetadataRows;

  const prepared = limitedMetadataRows.map((component) => {
    const search = searchByComponentId.get(component.id);
    const intent = search?.intent ?? toFallbackIntent(component.name);
    const capabilities = search?.capabilities ?? [];
    const synonyms = search?.synonyms ?? [];
    const topics = search?.topics ?? [];
    return {
      componentId: component.id,
      text: buildComponentEmbeddingText({
        name: component.name,
        intent,
        capabilities,
        synonyms,
        topics,
      }),
    };
  });

  const duplicateSourceIds = findDuplicateIds(prepared.map((row) => row.componentId));
  if (duplicateSourceIds.length > 0) {
    throw new Error(
      `Duplicate component ids in source rows: ${duplicateSourceIds.slice(0, 5).join(", ")}`,
    );
  }

  console.log(`Source deployment: ${convexUrl}`);
  console.log(`Embedding model: ${EMBEDDING_MODEL} (${EMBEDDING_DIMENSIONS} dims)`);
  console.log(
    `Prepared ${prepared.length} components from ${metadataRows.length} metadata rows and ${searchRows.length} search rows`,
  );

  if (options.limit !== undefined) {
    console.log(`Limit applied: first ${options.limit} components`);
  }

  if (options.dryRun) {
    printDryRunPreview(prepared);
    if (options.prune && options.limit === undefined) {
      const rawEmbeddingRows = await fetchAllDocuments(
        client,
        "componentEmbeddings",
        options.pageSize,
      );
      const embeddingRows = parseRows(
        rawEmbeddingRows,
        "componentEmbeddings",
        ComponentEmbeddingDocumentSchema,
        "componentId",
      );
      const sourceIds = new Set(prepared.map((row) => row.componentId));
      const staleCount = embeddingRows.filter((row) => !sourceIds.has(row.componentId)).length;
      console.log(`Dry run: would prune ${staleCount} stale embedding rows`);
    }
    return;
  }

  const embeddingProvider = await createEmbeddingProvider(options);

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let duplicateRowsDeleted = 0;
  let processed = 0;
  let pendingBatch: EmbeddingPayload[] = [];

  for (const row of prepared) {
    const embedding = await embeddingProvider(row.text);
    validateEmbeddingVector(row.componentId, embedding);

    pendingBatch.push({
      componentId: row.componentId,
      model: EMBEDDING_MODEL,
      embedding,
    });
    processed += 1;

    if (pendingBatch.length >= options.batchSize) {
      const result = await client.mutation(upsertManyEmbeddings, { entries: pendingBatch });
      inserted += result.inserted;
      updated += result.updated;
      unchanged += result.unchanged;
      duplicateRowsDeleted += result.duplicateRowsDeleted;
      pendingBatch = [];
    }

    if (processed % 10 === 0 || processed === prepared.length) {
      console.log(`Processed ${processed}/${prepared.length}`);
    }
  }

  if (pendingBatch.length > 0) {
    const result = await client.mutation(upsertManyEmbeddings, { entries: pendingBatch });
    inserted += result.inserted;
    updated += result.updated;
    unchanged += result.unchanged;
    duplicateRowsDeleted += result.duplicateRowsDeleted;
  }

  let pruned = 0;
  if (options.prune && options.limit === undefined) {
    const rawEmbeddingRows = await fetchAllDocuments(
      client,
      "componentEmbeddings",
      options.pageSize,
    );
    const embeddingRows = parseRows(
      rawEmbeddingRows,
      "componentEmbeddings",
      ComponentEmbeddingDocumentSchema,
      "componentId",
    );
    const sourceIds = new Set(prepared.map((row) => row.componentId));
    const staleComponentIds = embeddingRows
      .map((row) => row.componentId)
      .filter((componentId) => !sourceIds.has(componentId));

    for (const chunk of chunked(Array.from(new Set(staleComponentIds)), 100)) {
      if (chunk.length === 0) {
        continue;
      }
      const result = await client.mutation(deleteManyEmbeddings, { componentIds: chunk });
      pruned += result.deleted;
    }
  } else if (options.prune && options.limit !== undefined) {
    console.log("Skipping prune because --limit is active.");
  }

  console.log("Reindex complete.");
  console.log(
    `upserted: inserted=${inserted}, updated=${updated}, unchanged=${unchanged}, duplicateRowsDeleted=${duplicateRowsDeleted}`,
  );
  if (options.prune) {
    console.log(`pruned: ${pruned}`);
  }
}

function parseArgs(rawArgs: string[]): ReindexOptions {
  const args = new Map<string, string>();

  for (let index = 0; index < rawArgs.length; index += 1) {
    const token = rawArgs[index];
    if (!token?.startsWith("--")) {
      continue;
    }

    const next = rawArgs[index + 1];
    if (!next || next.startsWith("--")) {
      args.set(token, "true");
      continue;
    }

    args.set(token, next);
    index += 1;
  }

  const dryRun = args.get("--dry-run") === "true";
  const usePlaceholderEmbeddings = args.get("--placeholder-embeddings") === "true";
  const prune = args.get("--no-prune") !== "true";
  const limit = maybeParsePositiveInteger(args.get("--limit"), "--limit");
  const pageSize =
    maybeParsePositiveInteger(args.get("--page-size"), "--page-size") ?? DEFAULT_PAGE_SIZE;
  const batchSize =
    maybeParsePositiveInteger(args.get("--batch-size"), "--batch-size") ?? DEFAULT_BATCH_SIZE;

  return {
    dryRun,
    usePlaceholderEmbeddings,
    prune,
    limit,
    pageSize,
    batchSize,
  };
}

async function fetchAllDocuments(
  client: ConvexHttpClient,
  table: SnapshotTable,
  pageSize: number,
): Promise<unknown[]> {
  const documents: unknown[] = [];
  let cursor: string | undefined;

  while (true) {
    const result = (await client.query(exportTablePage, {
      table,
      cursor,
      pageSize,
    })) as PaginationResult<unknown>;

    documents.push(...result.page);

    if (result.isDone) {
      break;
    }

    cursor = result.continueCursor;
  }

  return documents;
}

function parseRows<
  TDocument extends { [key in TIdKey]: string },
  TIdKey extends "id" | "componentId",
>(rows: unknown[], table: SnapshotTable, schema: ZodType<TDocument>, idField: TIdKey): TDocument[] {
  const parsedRows: TDocument[] = [];
  const errors: string[] = [];

  for (const row of rows) {
    const normalized = stripConvexSystemFields(row);
    const parsed = schema.safeParse(normalized);

    if (parsed.success) {
      parsedRows.push(parsed.data);
      continue;
    }

    const candidateId = readStringField(normalized, idField);
    for (const issue of parsed.error.issues) {
      errors.push(formatParseIssue(table, candidateId, issue.path, issue.message));
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Failed to parse ${errors.length} row(s):\n${errors
        .slice(0, 20)
        .map((error) => `- ${error}`)
        .join("\n")}`,
    );
  }

  return parsedRows;
}

function stripConvexSystemFields(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([key]) => key !== "_id" && key !== "_creationTime",
  );
  return Object.fromEntries(entries);
}

function readStringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const candidate = (value as Record<string, unknown>)[key];
  if (typeof candidate !== "string") {
    return undefined;
  }

  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function formatParseIssue(
  table: SnapshotTable,
  componentId: string | undefined,
  path: PropertyKey[],
  message: string,
): string {
  const pathLabel = path.length > 0 ? path.join(".") : "(root)";
  const idLabel = componentId ?? "<unknown>";
  return `${table}:${idLabel}:${pathLabel} - ${message}`;
}

function toFallbackIntent(componentName: string): string {
  const trimmed = componentName.trim();
  return trimmed.length > 0 ? trimmed : "Unnamed component";
}

async function createEmbeddingProvider(
  options: ReindexOptions,
): Promise<(input: string) => Promise<number[]>> {
  if (options.usePlaceholderEmbeddings) {
    console.log("Using deterministic placeholder embeddings.");
    return async (input: string) => buildPlaceholderEmbedding(input);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is required unless you pass --placeholder-embeddings or --dry-run.",
    );
  }

  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  return async (input: string) => fetchOpenAiEmbedding(apiKey, baseUrl, input);
}

async function fetchOpenAiEmbedding(
  apiKey: string,
  baseUrl: string,
  input: string,
): Promise<number[]> {
  const response = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input,
      dimensions: EMBEDDING_DIMENSIONS,
      encoding_format: "float",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI embeddings request failed (${response.status}): ${body.slice(0, 400)}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: unknown }>;
  };
  const embedding = payload.data?.[0]?.embedding;

  if (!Array.isArray(embedding)) {
    throw new Error("OpenAI embeddings response did not include a valid vector.");
  }

  return embedding.map((value) => Number(value));
}

function validateEmbeddingVector(componentId: string, embedding: number[]): void {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding dimension mismatch for '${componentId}': expected ${EMBEDDING_DIMENSIONS}, received ${embedding.length}`,
    );
  }

  for (const [index, value] of embedding.entries()) {
    if (!Number.isFinite(value)) {
      throw new Error(`Embedding value at index ${index} for '${componentId}' is not finite`);
    }
  }
}

function buildPlaceholderEmbedding(input: string): number[] {
  const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
    const target = index % EMBEDDING_DIMENSIONS;
    vector[target] = (vector[target] ?? 0) + ((hash >>> 0) / 0xffffffff - 0.5) * 2;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
}

function printDryRunPreview(prepared: Array<{ componentId: string; text: string }>): void {
  console.log("Dry run enabled. No embeddings will be generated or written.");

  const preview = prepared.slice(0, 3);
  if (preview.length === 0) {
    console.log("No components available to preview.");
    return;
  }

  for (const row of preview) {
    console.log(`- ${row.componentId}: ${row.text.length} chars`);
  }
}

function maybeParsePositiveInteger(value: string | undefined, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return parsed;
}

function findDuplicateIds(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.push(value);
      continue;
    }
    seen.add(value);
  }

  return duplicates;
}

function chunked<TValue>(values: TValue[], size: number): TValue[][] {
  const chunks: TValue[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
