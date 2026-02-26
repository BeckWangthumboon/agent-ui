import { ConvexHttpClient } from "convex/browser";
import type { ZodType } from "zod";

import {
  ComponentEmbeddingDocumentSchema,
  ComponentFileDocumentSchema,
  ComponentCodeDocumentSchema,
  ComponentMetadataDocumentSchema,
  ComponentSearchDocumentSchema,
  type ComponentEmbeddingDocument,
  type ComponentFileDocument,
  type ComponentCodeDocument,
  type ComponentMetadataDocument,
  type ComponentSearchDocument,
} from "../../../shared/component-schema";
import {
  describeConvexSource,
  fetchAllTableDocuments,
  readStringField,
  stripConvexSystemFields,
  type AdminExportTable,
} from "./shared";

type SnapshotTable = AdminExportTable;

type CliOptions = {
  json: boolean;
};

type ValidationLevel = "warning" | "error";

type ValidationIssue = {
  level: ValidationLevel;
  table: SnapshotTable;
  componentId?: string;
  message: string;
};

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const convexUrl = process.env.CONVEX_URL;

  if (!convexUrl) {
    throw new Error("CONVEX_URL is required. Run `bun run --cwd apps/backend dev` first.");
  }

  const client = new ConvexHttpClient(convexUrl);

  const rawMetadata = await fetchAllTableDocuments(client, "components");
  const rawCode = await fetchAllTableDocuments(client, "componentCode");
  const rawFiles = await fetchAllTableDocuments(client, "componentFiles");
  const rawSearch = await fetchAllTableDocuments(client, "componentSearch");
  const rawEmbeddings = await fetchAllTableDocuments(client, "componentEmbeddings");

  const issues: ValidationIssue[] = [];

  const metadata = validateRows(
    rawMetadata,
    "components",
    ComponentMetadataDocumentSchema,
    "id",
    issues,
  );
  const code = validateRows(
    rawCode,
    "componentCode",
    ComponentCodeDocumentSchema,
    "componentId",
    issues,
  );
  const fileRows = validateFileRows(
    rawFiles,
    "componentFiles",
    ComponentFileDocumentSchema,
    "componentId",
    issues,
  );
  const search = validateRows(
    rawSearch,
    "componentSearch",
    ComponentSearchDocumentSchema,
    "componentId",
    issues,
  );
  const embeddings = validateRows(
    rawEmbeddings,
    "componentEmbeddings",
    ComponentEmbeddingDocumentSchema,
    "componentId",
    issues,
  );

  validateCrossTableIntegrity(metadata, code, fileRows, search, embeddings, issues);
  validateContentCompleteness(metadata, fileRows, search, issues);

  const warningCount = issues.filter((issue) => issue.level === "warning").length;
  const errorCount = issues.filter((issue) => issue.level === "error").length;

  const summary = {
    source: {
      kind: describeConvexSource(convexUrl),
    },
    counts: {
      components: rawMetadata.length,
      componentCode: rawCode.length,
      componentFiles: rawFiles.length,
      componentSearch: rawSearch.length,
      componentEmbeddings: rawEmbeddings.length,
    },
    validRows: {
      components: metadata.length,
      componentCode: code.length,
      componentFiles: fileRows.length,
      componentSearch: search.length,
      componentEmbeddings: embeddings.length,
    },
    warningCount,
    errorCount,
    issues,
  };

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`Validated Convex source: ${summary.source.kind}`);
    console.log(
      `Rows: components=${summary.counts.components}, componentCode=${summary.counts.componentCode}, componentFiles=${summary.counts.componentFiles}, componentSearch=${summary.counts.componentSearch}, componentEmbeddings=${summary.counts.componentEmbeddings}`,
    );
    console.log(
      `Valid rows: components=${summary.validRows.components}, componentCode=${summary.validRows.componentCode}, componentFiles=${summary.validRows.componentFiles}, componentSearch=${summary.validRows.componentSearch}, componentEmbeddings=${summary.validRows.componentEmbeddings}`,
    );
    console.log(`Warnings: ${warningCount}`);
    console.log(`Errors: ${errorCount}`);

    if (issues.length > 0) {
      printIssues(issues);
    }
  }

  if (errorCount > 0) {
    process.exitCode = 1;
  }
}

function validateRows<
  TDocument extends { [key in TKey]: string },
  TKey extends "id" | "componentId",
>(
  rows: unknown[],
  table: SnapshotTable,
  schema: ZodType<TDocument>,
  idField: TKey,
  issues: ValidationIssue[],
): TDocument[] {
  const validRows: TDocument[] = [];
  const seenIds = new Set<string>();

  for (const row of rows) {
    const normalized = stripConvexSystemFields(row);
    const parsed = schema.safeParse(normalized);
    const candidateId = readStringField(normalized, idField);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({
          level: "error",
          table,
          componentId: candidateId,
          message: formatZodIssue(issue.path, issue.message),
        });
      }
      continue;
    }

    const id = parsed.data[idField];
    if (seenIds.has(id)) {
      issues.push({
        level: "error",
        table,
        componentId: id,
        message: `Duplicate '${idField}' value in table: ${id}`,
      });
      continue;
    }

    seenIds.add(id);
    validRows.push(parsed.data);
  }

  return validRows;
}

function validateFileRows(
  rows: unknown[],
  table: SnapshotTable,
  schema: ZodType<ComponentFileDocument>,
  idField: "componentId",
  issues: ValidationIssue[],
): ComponentFileDocument[] {
  const validRows: ComponentFileDocument[] = [];

  for (const row of rows) {
    const normalized = stripConvexSystemFields(row);
    const parsed = schema.safeParse(normalized);
    const candidateId = readStringField(normalized, idField);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({
          level: "error",
          table,
          componentId: candidateId,
          message: formatZodIssue(issue.path, issue.message),
        });
      }
      continue;
    }

    validRows.push(parsed.data);
  }

  return validRows;
}

function validateCrossTableIntegrity(
  metadataRows: ComponentMetadataDocument[],
  codeRows: ComponentCodeDocument[],
  fileRows: ComponentFileDocument[],
  searchRows: ComponentSearchDocument[],
  embeddingRows: ComponentEmbeddingDocument[],
  issues: ValidationIssue[],
): void {
  const metadataIds = new Set(metadataRows.map((row) => row.id));
  const codeByComponentId = new Map(codeRows.map((row) => [row.componentId, row]));
  const searchByComponentId = new Map(searchRows.map((row) => [row.componentId, row]));
  const embeddingByComponentId = new Map(embeddingRows.map((row) => [row.componentId, row]));
  const filesByComponentId = new Map<string, ComponentFileDocument[]>();

  for (const fileRow of fileRows) {
    const files = filesByComponentId.get(fileRow.componentId);
    if (files) {
      files.push(fileRow);
    } else {
      filesByComponentId.set(fileRow.componentId, [fileRow]);
    }
  }

  for (const metadataId of metadataIds) {
    if (!codeByComponentId.has(metadataId)) {
      issues.push({
        level: "error",
        table: "components",
        componentId: metadataId,
        message: "Missing related row in componentCode table",
      });
    }

    if (!searchByComponentId.has(metadataId)) {
      issues.push({
        level: "error",
        table: "components",
        componentId: metadataId,
        message: "Missing related row in componentSearch table",
      });
    }

    if (!embeddingByComponentId.has(metadataId)) {
      issues.push({
        level: "error",
        table: "components",
        componentId: metadataId,
        message: "Missing related row in componentEmbeddings table",
      });
    }
  }

  for (const codeRow of codeRows) {
    if (!metadataIds.has(codeRow.componentId)) {
      issues.push({
        level: "error",
        table: "componentCode",
        componentId: codeRow.componentId,
        message: "Orphan row: no matching components.id",
      });
      continue;
    }

    const fileRowsForComponent = filesByComponentId.get(codeRow.componentId) ?? [];
    const codeFileRows = fileRowsForComponent.filter((row) => row.kind === "code");
    const availableFilePaths = new Set(codeFileRows.map((row) => row.path));

    if (!availableFilePaths.has(codeRow.entryFile)) {
      issues.push({
        level: "error",
        table: "componentCode",
        componentId: codeRow.componentId,
        message: "entryFile must reference one code file path",
      });
    }
  }

  for (const [componentId, files] of filesByComponentId.entries()) {
    const seenPaths = new Set<string>();
    let exampleCount = 0;

    for (const file of files) {
      if (seenPaths.has(file.path)) {
        issues.push({
          level: "error",
          table: "componentFiles",
          componentId,
          message: `Duplicate componentFiles.path value: ${file.path}`,
        });
      }
      seenPaths.add(file.path);

      if (file.kind === "example") {
        exampleCount += 1;
      }
    }

    if (exampleCount > 1) {
      issues.push({
        level: "warning",
        table: "componentFiles",
        componentId,
        message:
          "Multiple example files found; canonical selection uses lexicographically first path and sync writes example.tsx",
      });
    }
  }

  for (const fileRow of fileRows) {
    if (!metadataIds.has(fileRow.componentId)) {
      issues.push({
        level: "error",
        table: "componentFiles",
        componentId: fileRow.componentId,
        message: "Orphan row: no matching components.id",
      });
    }
  }

  for (const searchRow of searchRows) {
    if (!metadataIds.has(searchRow.componentId)) {
      issues.push({
        level: "error",
        table: "componentSearch",
        componentId: searchRow.componentId,
        message: "Orphan row: no matching components.id",
      });
    }
  }

  for (const embeddingRow of embeddingRows) {
    if (!metadataIds.has(embeddingRow.componentId)) {
      issues.push({
        level: "error",
        table: "componentEmbeddings",
        componentId: embeddingRow.componentId,
        message: "Orphan row: no matching components.id",
      });
    }
  }
}

function validateContentCompleteness(
  metadataRows: ComponentMetadataDocument[],
  fileRows: ComponentFileDocument[],
  searchRows: ComponentSearchDocument[],
  issues: ValidationIssue[],
): void {
  const filesByComponentId = new Map<string, ComponentFileDocument[]>();
  const searchByComponentId = new Map(searchRows.map((row) => [row.componentId, row]));

  for (const fileRow of fileRows) {
    const files = filesByComponentId.get(fileRow.componentId);
    if (files) {
      files.push(fileRow);
    } else {
      filesByComponentId.set(fileRow.componentId, [fileRow]);
    }
  }

  for (const metadataRow of metadataRows) {
    const componentId = metadataRow.id;

    if (!metadataRow.install) {
      issues.push({
        level: "warning",
        table: "components",
        componentId,
        message: "Missing install metadata",
      });
    }

    const files = filesByComponentId.get(componentId) ?? [];
    const hasExample = files.some((row) => row.kind === "example");
    if (!hasExample) {
      issues.push({
        level: "warning",
        table: "componentFiles",
        componentId,
        message: "Missing canonical example file row (kind='example')",
      });
    }

    const search = searchByComponentId.get(componentId);
    if (!search) {
      continue;
    }

    const missingSearchFields: string[] = [];
    if (search.capabilities.length === 0) {
      missingSearchFields.push("capabilities");
    }
    if (search.synonyms.length === 0) {
      missingSearchFields.push("synonyms");
    }
    if (search.topics.length === 0) {
      missingSearchFields.push("topics");
    }

    if (missingSearchFields.length > 0) {
      issues.push({
        level: "warning",
        table: "componentSearch",
        componentId,
        message: `Missing embedding metadata fields: ${missingSearchFields.join(", ")}`,
      });
    }
  }
}

function printIssues(issues: ValidationIssue[]): void {
  for (const issue of issues) {
    const prefix = issue.level === "error" ? "ERROR" : "WARN";
    const target = issue.componentId ? `${issue.table}:${issue.componentId}` : issue.table;
    console.error(`[${prefix}] ${target}: ${issue.message}`);
  }
}

function formatZodIssue(path: PropertyKey[], message: string): string {
  if (path.length === 0) {
    return message;
  }

  const fieldPath = path.map((segment) => String(segment)).join(".");
  return `${fieldPath}: ${message}`;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
  };

  for (const arg of argv) {
    if (arg === "--json") {
      options.json = true;
    }
  }

  return options;
}

await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Validation failed: ${message}`);
  process.exitCode = 1;
});
