import { readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { ZodError } from "zod";

import { parseComponentDocument as parseComponentDocumentWithSchema } from "./types";
import type { ComponentDocument } from "./types";

export type ValidationLevel = "warning" | "error";

export type ValidationIssue = {
  level: ValidationLevel;
  path: string;
  message: string;
};

export type LoadedComponentDocument = {
  document: ComponentDocument;
  directory: string;
  metaPath: string;
};

export type LoadComponentDocumentsResult = {
  entries: LoadedComponentDocument[];
  issues: ValidationIssue[];
};

export type LoadComponentDocumentsOptions = {
  componentsDir?: string;
};

type UnknownRecord = Record<string, unknown>;

export async function loadComponentDocuments(
  options: LoadComponentDocumentsOptions = {},
): Promise<LoadComponentDocumentsResult> {
  const componentsDir = resolve(options.componentsDir ?? "data/components");
  const issues: ValidationIssue[] = [];
  const entries: LoadedComponentDocument[] = [];

  let directories: string[] = [];

  try {
    const directoryEntries = await readdir(componentsDir, { withFileTypes: true });
    directories = directoryEntries
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(componentsDir, entry.name))
      .sort((left, right) => left.localeCompare(right));
  } catch (error) {
    issues.push({
      level: "error",
      path: componentsDir,
      message: `Failed to read components directory: ${toErrorMessage(error)}`,
    });

    return { entries, issues };
  }

  for (const directory of directories) {
    const metaPath = join(directory, "meta.json");

    const exists = await Bun.file(metaPath).exists();
    if (!exists) {
      issues.push({
        level: "error",
        path: metaPath,
        message: "Missing meta.json file",
      });
      continue;
    }

    let raw: unknown;
    try {
      raw = await Bun.file(metaPath).json();
    } catch (error) {
      issues.push({
        level: "error",
        path: metaPath,
        message: `Invalid JSON: ${toErrorMessage(error)}`,
      });
      continue;
    }

    const document = parseLoadedComponentDocument(raw, metaPath, issues);
    if (!document) {
      continue;
    }

    entries.push({ document, directory, metaPath });
  }

  return { entries, issues };
}

export async function validateCodeConsistency(entries: LoadedComponentDocument[]): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  for (const entry of entries) {
    const codeFilePath = join(entry.directory, entry.document.code.fileName);
    const codeFile = Bun.file(codeFilePath);
    const exists = await codeFile.exists();

    if (!exists) {
      issues.push({
        level: "error",
        path: codeFilePath,
        message: "Code file referenced by meta.json does not exist",
      });
      continue;
    }

    const fileContent = await codeFile.text();
    if (fileContent !== entry.document.code.content) {
      issues.push({
        level: "error",
        path: codeFilePath,
        message: "Code file content does not match meta.json code.content",
      });
    }
  }

  return issues;
}

function parseLoadedComponentDocument(
  raw: unknown,
  path: string,
  issues: ValidationIssue[],
): ComponentDocument | null {
  if (!isRecord(raw)) {
    issues.push({
      level: "error",
      path,
      message: "Component document must be a JSON object",
    });
    return null;
  }

  try {
    return parseComponentDocumentWithSchema(raw);
  } catch (error) {
    if (error instanceof ZodError) {
      for (const issue of error.issues) {
        issues.push({
          level: "error",
          path,
          message: formatZodIssue(issue.path, issue.message),
        });
      }
      return null;
    }

    issues.push({
      level: "error",
      path,
      message: `Failed to parse component document: ${toErrorMessage(error)}`,
    });
    return null;
  }
}

function formatZodIssue(path: PropertyKey[], message: string): string {
  if (path.length === 0) {
    return message;
  }

  const fieldPath = path.map((segment) => String(segment)).join(".");
  return `${fieldPath}: ${message}`;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toDisplayPath(path: string): string {
  const relativePath = relative(process.cwd(), path);
  return relativePath.startsWith("..") ? path : relativePath;
}
