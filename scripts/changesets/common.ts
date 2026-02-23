import { mkdir, readFile, readdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { z } from "zod";

import {
  buildPublicComponentId,
  buildSplitComponentRecords,
  ComponentCodeDocumentSchema,
  ComponentDocumentSchema,
  ComponentFileDocumentSchema,
  ComponentMetadataDocumentSchema,
  ComponentSearchDocumentSchema,
  type ComponentCodeDocument,
  type ComponentDocument,
  type ComponentFileDocument,
  type ComponentMetadataDocument,
  type ComponentSearchDocument,
} from "../../shared/component-schema";

export type ChangesetSource = "manual" | "ingest" | "agent";

export type ChangesetOperation =
  | {
      type: "upsert";
      component: ComponentDocument;
    }
  | {
      type: "delete";
      componentId: string;
    };

export type ChangesetDocument = {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  source: ChangesetSource;
  operations: ChangesetOperation[];
};

export type ValidationIssue = {
  level: "warning" | "error";
  message: string;
  operationIndex?: number;
  componentId?: string;
};

export type ResolvedOperation =
  | {
      type: "upsert";
      component: ComponentDocument;
      componentId: string;
      operationIndex: number;
    }
  | {
      type: "delete";
      componentId: string;
      operationIndex: number;
    };

export type ParsedChangeset = {
  changeset: ChangesetDocument;
  resolvedOperations: ResolvedOperation[];
  issues: ValidationIssue[];
};

export type SnapshotTable = "components" | "componentCode" | "componentFiles" | "componentSearch";

type PaginationResult<TDocument> = {
  page: TDocument[];
  isDone: boolean;
  continueCursor: string;
};

type LiveSnapshot = {
  metadataById: Map<string, ComponentMetadataDocument>;
  codeById: Map<string, ComponentCodeDocument>;
  filesById: Map<string, ComponentFileDocument[]>;
  searchById: Map<string, ComponentSearchDocument>;
};

const DEFAULT_PAGE_SIZE = 200;

const ChangesetSourceSchema = z.enum(["manual", "ingest", "agent"]);

const ChangesetOperationSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("upsert"),
    component: ComponentDocumentSchema,
  }),
  z.strictObject({
    type: z.literal("delete"),
    componentId: z.string().trim().min(1),
  }),
]);

export const ChangesetDocumentSchema: z.ZodType<ChangesetDocument> = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.string().trim().min(1),
  createdAt: z.iso.datetime(),
  source: ChangesetSourceSchema,
  operations: z.array(ChangesetOperationSchema),
});

const exportTablePage = makeFunctionReference<"query">("admin:exportTablePage");

export const upsertComponent = makeFunctionReference<"mutation">("admin:upsert");
export const deleteComponentById = makeFunctionReference<"mutation">("admin:deleteComponentById");

export function nowTimestampId(date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function getDefaultChangesetPath(changesetId: string): string {
  return resolve("data/changesets", `${changesetId}.json`);
}

export async function ensureParentDirectory(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

export async function writeJsonFile(path: string, data: unknown): Promise<void> {
  await ensureParentDirectory(path);
  await Bun.write(path, `${JSON.stringify(data, null, 2)}\n`);
}

export async function readJsonFile(path: string): Promise<unknown> {
  const text = await readFile(path, "utf8");
  return JSON.parse(text) as unknown;
}

export async function resolveChangesetPath(
  explicitPath: string | undefined,
  cwd = process.cwd(),
): Promise<string> {
  if (explicitPath) {
    return resolve(explicitPath);
  }

  const defaultDir = resolve(cwd, "data/changesets");
  const entries = await readdir(defaultDir, { withFileTypes: true }).catch(() => []);
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left, "en"));

  const latest = files[0];
  if (!latest) {
    throw new Error(
      "No changeset path provided and no JSON files found in data/changesets. Use --changeset <path>.",
    );
  }

  return resolve(defaultDir, latest);
}

export async function parseAndValidateChangeset(changesetPath: string): Promise<ParsedChangeset> {
  const raw = await readJsonFile(changesetPath);
  const parsed = ChangesetDocumentSchema.safeParse(raw);

  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => ({
      level: "error" as const,
      message: formatZodIssue(issue.path, issue.message),
    }));
    return {
      // Type-safe sentinel document to keep caller logic straightforward.
      changeset: {
        schemaVersion: 1,
        id: "invalid",
        createdAt: new Date(0).toISOString(),
        source: "manual",
        operations: [],
      },
      resolvedOperations: [],
      issues: errors,
    };
  }

  const changeset = parsed.data;
  const issues: ValidationIssue[] = [];
  const resolvedOperations: ResolvedOperation[] = [];
  const seenUpsertIds = new Set<string>();
  const seenDeleteIds = new Set<string>();

  if (changeset.operations.length === 0) {
    issues.push({
      level: "warning",
      message: "Changeset has no operations.",
    });
  }

  for (const [index, operation] of changeset.operations.entries()) {
    if (operation.type === "upsert") {
      const componentId = await buildPublicComponentId(operation.component);
      if (seenUpsertIds.has(componentId)) {
        issues.push({
          level: "error",
          operationIndex: index,
          componentId,
          message: `Duplicate upsert target component id '${componentId}'.`,
        });
      } else {
        seenUpsertIds.add(componentId);
      }

      resolvedOperations.push({
        type: "upsert",
        component: operation.component,
        componentId,
        operationIndex: index,
      });
      continue;
    }

    if (seenDeleteIds.has(operation.componentId)) {
      issues.push({
        level: "error",
        operationIndex: index,
        componentId: operation.componentId,
        message: `Duplicate delete target component id '${operation.componentId}'.`,
      });
    } else {
      seenDeleteIds.add(operation.componentId);
    }

    resolvedOperations.push({
      type: "delete",
      componentId: operation.componentId,
      operationIndex: index,
    });
  }

  for (const componentId of seenUpsertIds) {
    if (!seenDeleteIds.has(componentId)) {
      continue;
    }
    issues.push({
      level: "error",
      componentId,
      message: `Conflicting operations for '${componentId}': contains both upsert and delete.`,
    });
  }

  return { changeset, resolvedOperations, issues };
}

export async function collectLocalComponents(componentsDir: string): Promise<ComponentDocument[]> {
  const absoluteComponentsDir = resolve(componentsDir);
  const entries = await readdir(absoluteComponentsDir, { withFileTypes: true });
  const componentDirectories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "en"));

  const components: ComponentDocument[] = [];

  for (const directoryName of componentDirectories) {
    const metaPath = resolve(absoluteComponentsDir, directoryName, "meta.json");
    const file = Bun.file(metaPath);
    if (!(await file.exists())) {
      continue;
    }

    const raw = await file.json();
    const parsed = ComponentDocumentSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const issueMessage = issue
        ? formatZodIssue(issue.path, issue.message)
        : "Unknown schema error";
      throw new Error(`Invalid component meta at ${toDisplayPath(metaPath)}: ${issueMessage}`);
    }

    components.push(parsed.data);
  }

  return components;
}

export async function fetchLiveSnapshot(client: ConvexHttpClient): Promise<LiveSnapshot> {
  const rawMetadata = await fetchAllDocuments(client, "components");
  const rawCode = await fetchAllDocuments(client, "componentCode");
  const rawFiles = await fetchAllDocuments(client, "componentFiles");
  const rawSearch = await fetchAllDocuments(client, "componentSearch");

  const metadataById = new Map<string, ComponentMetadataDocument>();
  for (const row of rawMetadata) {
    const normalized = stripConvexSystemFields(row);
    const parsed = ComponentMetadataDocumentSchema.safeParse(normalized);
    if (parsed.success) {
      metadataById.set(parsed.data.id, parsed.data);
    }
  }

  const codeById = new Map<string, ComponentCodeDocument>();
  for (const row of rawCode) {
    const normalized = stripConvexSystemFields(row);
    const parsed = ComponentCodeDocumentSchema.safeParse(normalized);
    if (parsed.success) {
      codeById.set(parsed.data.componentId, parsed.data);
    }
  }

  const filesById = new Map<string, ComponentFileDocument[]>();
  for (const row of rawFiles) {
    const normalized = stripConvexSystemFields(row);
    const parsed = ComponentFileDocumentSchema.safeParse(normalized);
    if (!parsed.success) {
      continue;
    }

    const files = filesById.get(parsed.data.componentId);
    if (files) {
      files.push(parsed.data);
    } else {
      filesById.set(parsed.data.componentId, [parsed.data]);
    }
  }

  const searchById = new Map<string, ComponentSearchDocument>();
  for (const row of rawSearch) {
    const normalized = stripConvexSystemFields(row);
    const parsed = ComponentSearchDocumentSchema.safeParse(normalized);
    if (parsed.success) {
      searchById.set(parsed.data.componentId, parsed.data);
    }
  }

  return {
    metadataById,
    codeById,
    filesById,
    searchById,
  };
}

export type ComponentDiffStatus = "added" | "updated" | "unchanged" | "deleted" | "missing";

export type ComponentDiffEntry = {
  type: "upsert" | "delete";
  componentId: string;
  status: ComponentDiffStatus;
  changes: string[];
};

export type ChangesetDiffSummary = {
  added: number;
  updated: number;
  deleted: number;
  unchanged: number;
  missingDeletes: number;
  componentDiffs: ComponentDiffEntry[];
};

export async function diffChangesetAgainstSnapshot(
  resolvedOperations: ResolvedOperation[],
  snapshot: LiveSnapshot,
): Promise<ChangesetDiffSummary> {
  const summary: ChangesetDiffSummary = {
    added: 0,
    updated: 0,
    deleted: 0,
    unchanged: 0,
    missingDeletes: 0,
    componentDiffs: [],
  };

  for (const operation of resolvedOperations) {
    if (operation.type === "delete") {
      const exists =
        snapshot.metadataById.has(operation.componentId) ||
        snapshot.codeById.has(operation.componentId) ||
        snapshot.searchById.has(operation.componentId) ||
        (snapshot.filesById.get(operation.componentId)?.length ?? 0) > 0;

      if (exists) {
        summary.deleted += 1;
        summary.componentDiffs.push({
          type: "delete",
          componentId: operation.componentId,
          status: "deleted",
          changes: ["remove component rows from all split tables"],
        });
      } else {
        summary.missingDeletes += 1;
        summary.componentDiffs.push({
          type: "delete",
          componentId: operation.componentId,
          status: "missing",
          changes: ["component id not found in live Convex data"],
        });
      }
      continue;
    }

    const nextRecords = await buildSplitComponentRecords(operation.component);
    const componentId = nextRecords.metadata.id;
    const changes: string[] = [];
    const currentMetadata = snapshot.metadataById.get(componentId);
    const currentCode = snapshot.codeById.get(componentId);
    const currentSearch = snapshot.searchById.get(componentId);
    const currentFiles = (snapshot.filesById.get(componentId) ?? []).slice();

    if (!currentMetadata) {
      changes.push("components row will be inserted");
    } else {
      changes.push(...diffObjectFields("components", currentMetadata, nextRecords.metadata));
    }

    if (!currentCode) {
      changes.push("componentCode row will be inserted");
    } else {
      changes.push(...diffObjectFields("componentCode", currentCode, nextRecords.code));
    }

    if (!currentSearch) {
      changes.push("componentSearch row will be inserted");
    } else {
      changes.push(...diffObjectFields("componentSearch", currentSearch, nextRecords.search));
    }

    changes.push(...diffComponentFiles(currentFiles, nextRecords.files));

    if (!currentMetadata && !currentCode && !currentSearch && currentFiles.length === 0) {
      summary.added += 1;
      summary.componentDiffs.push({
        type: "upsert",
        componentId,
        status: "added",
        changes,
      });
      continue;
    }

    if (changes.length > 0) {
      summary.updated += 1;
      summary.componentDiffs.push({
        type: "upsert",
        componentId,
        status: "updated",
        changes,
      });
      continue;
    }

    summary.unchanged += 1;
    summary.componentDiffs.push({
      type: "upsert",
      componentId,
      status: "unchanged",
      changes: ["no changes"],
    });
  }

  return summary;
}

export function printDiffSummary(summary: ChangesetDiffSummary): void {
  console.log(`Added: ${summary.added}`);
  console.log(`Updated: ${summary.updated}`);
  console.log(`Deleted: ${summary.deleted}`);
  console.log(`Unchanged: ${summary.unchanged}`);
  console.log(`Delete targets missing in live data: ${summary.missingDeletes}`);

  if (summary.componentDiffs.length === 0) {
    return;
  }

  for (const entry of summary.componentDiffs) {
    console.log(`${entry.type}:${entry.status} ${entry.componentId}`);
    for (const change of entry.changes) {
      console.log(`  - ${change}`);
    }
  }
}

export function toDisplayPath(path: string): string {
  return relative(process.cwd(), path) || ".";
}

export function formatValidationIssues(issues: ValidationIssue[]): string[] {
  return issues.map((issue) => {
    const level = issue.level.toUpperCase();
    const op = issue.operationIndex !== undefined ? ` op#${issue.operationIndex}` : "";
    const component = issue.componentId ? ` component=${issue.componentId}` : "";
    return `${level}${op}${component}: ${issue.message}`;
  });
}

export function hasValidationErrors(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.level === "error");
}

async function fetchAllDocuments(client: ConvexHttpClient, table: SnapshotTable): Promise<unknown[]> {
  const rows: unknown[] = [];
  let cursor: string | undefined;

  while (true) {
    const result = (await client.query(exportTablePage, {
      table,
      cursor,
      pageSize: DEFAULT_PAGE_SIZE,
    })) as PaginationResult<unknown>;

    rows.push(...result.page);
    if (result.isDone) {
      break;
    }
    cursor = result.continueCursor;
  }

  return rows;
}

function stripConvexSystemFields(row: unknown): unknown {
  if (!isRecord(row)) {
    return row;
  }

  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith("_")) {
      continue;
    }
    normalized[key] = value;
  }
  return normalized;
}

function diffObjectFields(
  table: SnapshotTable,
  current: Record<string, unknown>,
  next: Record<string, unknown>,
): string[] {
  const allKeys = Array.from(new Set([...Object.keys(current), ...Object.keys(next)])).sort((a, b) =>
    a.localeCompare(b, "en"),
  );
  const changes: string[] = [];
  for (const key of allKeys) {
    if (key === "schemaVersion") {
      continue;
    }

    const currentJson = stableJson(current[key]);
    const nextJson = stableJson(next[key]);

    if (currentJson !== nextJson) {
      changes.push(`${table}.${key} changed`);
    }
  }
  return changes;
}

function diffComponentFiles(currentFiles: ComponentFileDocument[], nextFiles: ComponentFileDocument[]): string[] {
  const changes: string[] = [];
  const currentByKey = new Map(
    currentFiles.map((file) => [`${file.kind}:${file.path}`, file] as const),
  );
  const nextByKey = new Map(nextFiles.map((file) => [`${file.kind}:${file.path}`, file] as const));

  for (const key of currentByKey.keys()) {
    if (!nextByKey.has(key)) {
      changes.push(`componentFiles ${key} removed`);
    }
  }

  for (const [key, nextFile] of nextByKey.entries()) {
    const currentFile = currentByKey.get(key);
    if (!currentFile) {
      changes.push(`componentFiles ${key} added`);
      continue;
    }

    if (currentFile.content !== nextFile.content) {
      changes.push(`componentFiles ${key} content changed`);
    }
  }

  return changes;
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatZodIssue(path: PropertyKey[], message: string): string {
  if (path.length === 0) {
    return message;
  }
  const pathText = path
    .map((part) => (typeof part === "symbol" ? part.description ?? "<symbol>" : String(part)))
    .join(".");
  return `${pathText}: ${message}`;
}
