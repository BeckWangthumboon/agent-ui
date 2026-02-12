import type { ComponentDependency, ComponentDocument } from "./types";

type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeOptionalText(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeStringArray(values: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const rawValue of values) {
    const value = normalizeText(rawValue);
    if (value.length === 0) {
      continue;
    }

    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(value);
  }

  return normalized;
}

export function normalizeDependencies(dependencies: ComponentDependency[]): ComponentDependency[] {
  const seen = new Set<string>();
  const normalized: ComponentDependency[] = [];

  for (const dependency of dependencies) {
    const name = normalizeText(dependency.name);
    if (name.length === 0) {
      continue;
    }

    const version = normalizeOptionalText(dependency.version);
    const key = `${name.toLowerCase()}@${version?.toLowerCase() ?? ""}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(version ? { name, version } : { name });
  }

  return normalized;
}

export function normalizeDocument(document: ComponentDocument): ComponentDocument {
  return {
    ...document,
    id: normalizeText(document.id),
    name: normalizeText(document.name),
    description: normalizeOptionalText(document.description),
    source: {
      ...document.source,
      repo: normalizeOptionalText(document.source.repo),
      author: normalizeOptionalText(document.source.author),
      license: normalizeOptionalText(document.source.license),
      url: normalizeText(document.source.url),
    },
    tags: normalizeStringArray(document.tags),
    useCases: normalizeStringArray(document.useCases),
    dependencies: normalizeDependencies(document.dependencies),
    code: {
      fileName: normalizeText(document.code.fileName),
      content: document.code.content,
    },
  };
}
