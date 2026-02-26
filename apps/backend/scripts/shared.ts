import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

export type AdminExportTable =
  | "components"
  | "componentCode"
  | "componentFiles"
  | "componentSearch"
  | "componentEmbeddings";

type PaginationResult<TDocument> = {
  page: TDocument[];
  isDone: boolean;
  continueCursor: string;
};

const DEFAULT_PAGE_SIZE = 200;
const exportTablePage = makeFunctionReference<"query">("admin:exportTablePage");

export async function fetchAllTableDocuments(
  client: ConvexHttpClient,
  table: AdminExportTable,
  pageSize = DEFAULT_PAGE_SIZE,
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

export function stripConvexSystemFields(value: unknown): unknown {
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

export function readStringField(
  value: unknown,
  key: string,
  options?: { trim?: boolean },
): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const raw = value[key];
  if (typeof raw !== "string") {
    return undefined;
  }

  if (options?.trim) {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return raw.length > 0 ? raw : undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function describeConvexSource(convexUrl: string): "local" | "cloud" {
  try {
    const hostname = new URL(convexUrl).hostname.toLowerCase();
    if (isLikelyLocalHostname(hostname)) {
      return "local";
    }
    return "cloud";
  } catch {
    const normalized = convexUrl.toLowerCase();
    if (
      normalized.includes("localhost") ||
      normalized.includes("127.0.0.1") ||
      normalized.includes("[::1]") ||
      normalized.includes("::1")
    ) {
      return "local";
    }
    return "cloud";
  }
}

function isLikelyLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}
