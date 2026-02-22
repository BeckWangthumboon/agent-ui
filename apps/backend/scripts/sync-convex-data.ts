import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

import {
  ComponentFileDocumentSchema,
  ComponentCodeDocumentSchema,
  ComponentMetadataDocumentSchema,
  ComponentSearchDocumentSchema,
  type ComponentFileDocument,
  type ComponentDocument,
  type ComponentCodeDocument,
  type ComponentMetadataDocument,
  type ComponentSearchDocument,
} from "../../../shared/component-schema";

type SnapshotTable = "components" | "componentCode" | "componentFiles" | "componentSearch";

type PaginationResult<TDocument> = {
  page: TDocument[];
  isDone: boolean;
  continueCursor: string;
};

type CliOptions = {
  componentsDir: string;
};

const DEFAULT_PAGE_SIZE = 200;
const CANONICAL_EXAMPLE_FILE_PATH = "example.tsx";

const exportTablePage = makeFunctionReference<"query">("admin:exportTablePage");

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const convexUrl = process.env.CONVEX_URL;

  if (!convexUrl) {
    throw new Error("CONVEX_URL is required. Run `bun run --cwd apps/backend dev` first.");
  }

  const componentsDir = resolve(options.componentsDir);
  const client = new ConvexHttpClient(convexUrl);

  const rawMetadata = await fetchAllDocuments(client, "components");
  const rawCode = await fetchAllDocuments(client, "componentCode");
  const rawFiles = await fetchAllDocuments(client, "componentFiles");
  const rawSearch = await fetchAllDocuments(client, "componentSearch");

  const { validRows: metadataRows, errors: metadataErrors } = parseMetadataRows(rawMetadata);
  const { validRows: codeRows, errors: codeErrors } = parseCodeRows(rawCode);
  const { validRows: fileRows, errors: fileErrors } = parseFileRows(rawFiles);
  const { validRows: searchRows, errors: searchErrors } = parseSearchRows(rawSearch);

  const parseErrors = [...metadataErrors, ...codeErrors, ...fileErrors, ...searchErrors];

  const codeByComponentId = new Map(codeRows.map((row) => [row.componentId, row]));
  const filesByComponentId = new Map<string, ComponentFileDocument[]>();
  for (const fileRow of fileRows) {
    const files = filesByComponentId.get(fileRow.componentId);
    if (files) {
      files.push(fileRow);
    } else {
      filesByComponentId.set(fileRow.componentId, [fileRow]);
    }
  }
  const searchByComponentId = new Map(searchRows.map((row) => [row.componentId, row]));

  await rm(componentsDir, { recursive: true, force: true });
  await mkdir(componentsDir, { recursive: true });

  let written = 0;
  const warnings: string[] = [];

  const orderedMetadataRows = [...metadataRows].sort((left, right) =>
    left.id.localeCompare(right.id, "en"),
  );

  for (const metadata of orderedMetadataRows) {
    const code = codeByComponentId.get(metadata.id);

    if (!code) {
      warnings.push(`Skipping ${metadata.id}: missing componentCode row.`);
      continue;
    }

    const search = searchByComponentId.get(metadata.id);
    const componentFiles = filesByComponentId.get(metadata.id) ?? [];
    const componentDocument = toComponentDocument(metadata, code, componentFiles, search);
    const componentDir = join(componentsDir, componentDocument.id);

    await mkdir(componentDir, { recursive: true });
    await writeFile(
      join(componentDir, "meta.json"),
      `${JSON.stringify(componentDocument, null, 2)}\n`,
      "utf8",
    );

    const filesToWrite = [
      ...componentDocument.code.files,
      ...(componentDocument.example ? [componentDocument.example] : []),
    ];
    for (const file of filesToWrite) {
      const filePath = join(componentDir, file.path);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, file.content, "utf8");
    }

    written += 1;
  }

  console.log(`Convex source: ${convexUrl}`);
  console.log(
    `Rows fetched: components=${rawMetadata.length}, componentCode=${rawCode.length}, componentFiles=${rawFiles.length}, componentSearch=${rawSearch.length}`,
  );
  console.log(
    `Rows parsed: components=${metadataRows.length}, componentCode=${codeRows.length}, componentFiles=${fileRows.length}, componentSearch=${searchRows.length}`,
  );
  console.log(`Wrote ${written} component directories to ${toDisplayPath(componentsDir)}`);

  if (parseErrors.length > 0) {
    for (const error of parseErrors) {
      console.warn(`WARN: ${error}`);
    }
  }

  if (warnings.length > 0) {
    for (const warning of warnings) {
      console.warn(`WARN: ${warning}`);
    }
  }

  if (parseErrors.length > 0) {
    process.exitCode = 1;
  }
}

async function fetchAllDocuments(
  client: ConvexHttpClient,
  table: SnapshotTable,
): Promise<unknown[]> {
  const documents: unknown[] = [];
  let cursor: string | undefined;

  while (true) {
    const result: PaginationResult<unknown> = await client.query(exportTablePage, {
      table,
      cursor,
      pageSize: DEFAULT_PAGE_SIZE,
    });

    documents.push(...result.page);

    if (result.isDone) {
      break;
    }

    cursor = result.continueCursor;
  }

  return documents;
}

function parseMetadataRows(rows: unknown[]): {
  validRows: ComponentMetadataDocument[];
  errors: string[];
} {
  const validRows: ComponentMetadataDocument[] = [];
  const errors: string[] = [];

  for (const row of rows) {
    const normalized = stripConvexSystemFields(row);
    const parsed = ComponentMetadataDocumentSchema.safeParse(normalized);

    if (!parsed.success) {
      const candidateId = readStringField(normalized, "id");
      for (const issue of parsed.error.issues) {
        errors.push(formatParseIssue("components", candidateId, issue.path, issue.message));
      }
      continue;
    }

    validRows.push(parsed.data);
  }

  return { validRows, errors };
}

function parseCodeRows(rows: unknown[]): { validRows: ComponentCodeDocument[]; errors: string[] } {
  const validRows: ComponentCodeDocument[] = [];
  const errors: string[] = [];

  for (const row of rows) {
    const normalized = stripConvexSystemFields(row);
    const parsed = ComponentCodeDocumentSchema.safeParse(normalized);
    if (parsed.success) {
      validRows.push(parsed.data);
      continue;
    }

    const candidateId = readStringField(normalized, "componentId");
    for (const issue of parsed.error.issues) {
      errors.push(formatParseIssue("componentCode", candidateId, issue.path, issue.message));
    }
  }

  return { validRows, errors };
}

function parseFileRows(rows: unknown[]): { validRows: ComponentFileDocument[]; errors: string[] } {
  const validRows: ComponentFileDocument[] = [];
  const errors: string[] = [];

  for (const row of rows) {
    const normalized = stripConvexSystemFields(row);
    const parsed = ComponentFileDocumentSchema.safeParse(normalized);

    if (!parsed.success) {
      const candidateId = readStringField(normalized, "componentId");
      for (const issue of parsed.error.issues) {
        errors.push(formatParseIssue("componentFiles", candidateId, issue.path, issue.message));
      }
      continue;
    }

    validRows.push(parsed.data);
  }

  return { validRows, errors };
}

function parseSearchRows(rows: unknown[]): {
  validRows: ComponentSearchDocument[];
  errors: string[];
} {
  const validRows: ComponentSearchDocument[] = [];
  const errors: string[] = [];

  for (const row of rows) {
    const normalized = stripConvexSystemFields(row);
    const parsed = ComponentSearchDocumentSchema.safeParse(normalized);

    if (!parsed.success) {
      const candidateId = readStringField(normalized, "componentId");
      for (const issue of parsed.error.issues) {
        errors.push(formatParseIssue("componentSearch", candidateId, issue.path, issue.message));
      }
      continue;
    }

    validRows.push(parsed.data);
  }

  return { validRows, errors };
}

function toComponentDocument(
  metadata: ComponentMetadataDocument,
  code: ComponentCodeDocument,
  componentFiles: ComponentFileDocument[],
  search: ComponentSearchDocument | undefined,
): ComponentDocument {
  const codeFilesFromTable = componentFiles
    .filter((file) => file.kind === "code")
    .map((file) => ({ path: file.path, content: file.content }))
    .sort((left, right) => left.path.localeCompare(right.path, "en"));
  const defaultExample = componentFiles
    .filter((file) => file.kind === "example")
    .sort((left, right) => left.path.localeCompare(right.path, "en"))[0];

  return {
    schemaVersion: 2,
    id: metadata.id,
    name: metadata.name,
    source: metadata.source,
    framework: metadata.framework,
    styling: metadata.styling,
    dependencies: metadata.dependencies,
    install: metadata.install,
    intent: search?.intent ?? metadata.name,
    capabilities: search?.capabilities ?? [],
    synonyms: search?.synonyms ?? [],
    topics: search?.topics ?? [],
    motionLevel: metadata.motionLevel,
    primitiveLibrary: metadata.primitiveLibrary,
    animationLibrary: metadata.animationLibrary,
    constraints: metadata.constraints,
    code: {
      entryFile: code.entryFile,
      files: codeFilesFromTable,
    },
    ...(defaultExample
      ? {
          example: {
            path: CANONICAL_EXAMPLE_FILE_PATH,
            content: defaultExample.content,
          },
        }
      : {}),
  };
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

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    componentsDir: "../../data/components",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--components-dir") {
      options.componentsDir = argv[index + 1] ?? options.componentsDir;
      index += 1;
    }
  }

  return options;
}

function formatParseIssue(
  table: SnapshotTable,
  id: string | undefined,
  path: PropertyKey[],
  message: string,
): string {
  const target = id ? `${table}:${id}` : table;
  const fieldPath = path.length > 0 ? ` (${path.map((segment) => String(segment)).join(".")})` : "";
  return `${target}${fieldPath}: ${message}`;
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

function toDisplayPath(path: string): string {
  const relativePath = relative(process.cwd(), path);
  return relativePath.startsWith("..") ? path : relativePath;
}

await main();
