import { readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { isRecord, normalizeDocument, normalizeOptionalText, normalizeStringArray, normalizeText } from "./normalize";
import type { ComponentDependency, ComponentDocument } from "./types";

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

    const document = parseComponentDocument(raw, metaPath, issues);
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

function parseComponentDocument(
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

  const id = readRequiredString(raw, "id", path, issues);
  const name = readRequiredString(raw, "name", path, issues);
  const description = readOptionalString(raw, "description", path, issues);
  const framework = readFramework(raw, path, issues);
  const styling = readStyling(raw, path, issues);
  const source = readSource(raw, path, issues);
  const tags = readStringArray(raw, "tags", path, issues);
  const useCases = readStringArray(raw, "useCases", path, issues);
  const dependencies = readDependencies(raw, "dependencies", path, issues);
  const code = readCode(raw, path, issues);

  if (!id || !name || !framework || !styling || !source || !code) {
    return null;
  }

  return normalizeDocument({
    id,
    name,
    description,
    framework,
    styling,
    source,
    tags,
    useCases,
    dependencies,
    code,
  });
}

function readFramework(record: UnknownRecord, path: string, issues: ValidationIssue[]): "react" | null {
  const framework = readRequiredString(record, "framework", path, issues);
  if (!framework) {
    return null;
  }

  if (framework !== "react") {
    issues.push({
      level: "error",
      path,
      message: `Unsupported framework: ${framework}`,
    });
    return null;
  }

  return framework;
}

function readStyling(record: UnknownRecord, path: string, issues: ValidationIssue[]): "tailwind" | null {
  const styling = readRequiredString(record, "styling", path, issues);
  if (!styling) {
    return null;
  }

  if (styling !== "tailwind") {
    issues.push({
      level: "error",
      path,
      message: `Unsupported styling: ${styling}`,
    });
    return null;
  }

  return styling;
}

function readSource(
  record: UnknownRecord,
  path: string,
  issues: ValidationIssue[],
): ComponentDocument["source"] | null {
  const source = readRequiredObject(record, "source", path, issues);
  if (!source) {
    return null;
  }

  const url = readRequiredString(source, "url", path, issues, "source.url");
  if (!url) {
    return null;
  }

  if (!isValidUrl(url)) {
    issues.push({
      level: "warning",
      path,
      message: `source.url is not a valid URL: ${url}`,
    });
  }

  return {
    repo: readOptionalString(source, "repo", path, issues, "source.repo"),
    author: readOptionalString(source, "author", path, issues, "source.author"),
    license: readOptionalString(source, "license", path, issues, "source.license"),
    url,
  };
}

function readCode(record: UnknownRecord, path: string, issues: ValidationIssue[]): ComponentDocument["code"] | null {
  const code = readRequiredObject(record, "code", path, issues);
  if (!code) {
    return null;
  }

  const fileName = readRequiredString(code, "fileName", path, issues, "code.fileName");
  const content = readRequiredString(code, "content", path, issues, "code.content", { normalize: false });
  if (!fileName || !content) {
    return null;
  }

  return { fileName, content };
}

function readDependencies(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: ValidationIssue[],
): ComponentDependency[] {
  const value = record[key];

  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    issues.push({
      level: "warning",
      path,
      message: `Expected ${key} to be an array; defaulting to []`,
    });
    return [];
  }

  const dependencies: ComponentDependency[] = [];

  for (const item of value) {
    if (typeof item === "string") {
      const name = normalizeText(item);
      if (name.length > 0) {
        dependencies.push({ name });
      }
      continue;
    }

    if (!isRecord(item)) {
      issues.push({
        level: "warning",
        path,
        message: `Invalid dependency entry in ${key}; skipping non-object item`,
      });
      continue;
    }

    const name = readRequiredString(item, "name", path, issues, `${key}.name`);
    if (!name) {
      continue;
    }

    const version = readOptionalString(item, "version", path, issues, `${key}.version`);
    dependencies.push(version ? { name, version } : { name });
  }

  return dependencies;
}

function readStringArray(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: ValidationIssue[],
): string[] {
  const value = record[key];

  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    issues.push({
      level: "warning",
      path,
      message: `Expected ${key} to be an array; defaulting to []`,
    });
    return [];
  }

  const strings: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      issues.push({
        level: "warning",
        path,
        message: `Invalid ${key} entry; skipping non-string item`,
      });
      continue;
    }

    strings.push(item);
  }

  return normalizeStringArray(strings);
}

function readRequiredObject(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: ValidationIssue[],
): UnknownRecord | null {
  const value = record[key];

  if (!isRecord(value)) {
    issues.push({
      level: "error",
      path,
      message: `Missing or invalid required object: ${key}`,
    });
    return null;
  }

  return value;
}

function readRequiredString(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: ValidationIssue[],
  label?: string,
  options?: { normalize?: boolean },
): string | null {
  const value = record[key];
  const field = label ?? key;

  if (typeof value !== "string") {
    issues.push({
      level: "error",
      path,
      message: `Missing or invalid required string: ${field}`,
    });
    return null;
  }

  const shouldNormalize = options?.normalize ?? true;
  const normalized = shouldNormalize ? normalizeText(value) : value;
  if (normalized.trim().length === 0) {
    issues.push({
      level: "error",
      path,
      message: `Required string is empty: ${field}`,
    });
    return null;
  }

  return normalized;
}

function readOptionalString(
  record: UnknownRecord,
  key: string,
  path: string,
  issues: ValidationIssue[],
  label?: string,
): string | undefined {
  const value = record[key];
  if (value === undefined || value === null) {
    return undefined;
  }

  const field = label ?? key;

  if (typeof value !== "string") {
    issues.push({
      level: "warning",
      path,
      message: `Invalid optional string field: ${field}`,
    });
    return undefined;
  }

  return normalizeOptionalText(value);
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function toDisplayPath(path: string): string {
  const relativePath = relative(process.cwd(), path);
  return relativePath.startsWith("..") ? path : relativePath;
}
