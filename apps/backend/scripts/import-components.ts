import { readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

import { parseComponentDocument, type ComponentDocument } from "../../../shared/component-schema";

type CliOptions = {
  componentsDir: string;
  dryRun: boolean;
};

type UpsertResult = {
  status: "inserted" | "updated";
  componentId: string;
};

const upsertComponent = makeFunctionReference<"mutation">("components:upsert");

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const componentsDir = resolve(options.componentsDir);
  const documents = await loadComponentDocuments(componentsDir);

  console.log(
    `Loaded ${documents.length} component documents from ${toDisplayPath(componentsDir)}.`,
  );

  if (options.dryRun) {
    console.log("Dry run enabled. No Convex writes performed.");
    return;
  }

  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    throw new Error("CONVEX_URL is required. Run `bun run --cwd apps/backend dev` first.");
  }

  const client = new ConvexHttpClient(convexUrl);
  let inserted = 0;
  let updated = 0;

  for (const document of documents) {
    const result = (await client.mutation(upsertComponent, {
      component: document,
    })) as UpsertResult;

    if (result.status === "updated") {
      updated += 1;
    } else {
      inserted += 1;
    }
  }

  console.log(
    `Upserted ${documents.length} components (${inserted} inserted, ${updated} updated).`,
  );
}

async function loadComponentDocuments(componentsDir: string): Promise<ComponentDocument[]> {
  const entries = await readdir(componentsDir, { withFileTypes: true });
  const componentDirectories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const documents: ComponentDocument[] = [];

  for (const directoryName of componentDirectories) {
    const metaPath = join(componentsDir, directoryName, "meta.json");
    const file = Bun.file(metaPath);

    if (!(await file.exists())) {
      throw new Error(`Missing meta.json for '${directoryName}' (${toDisplayPath(metaPath)}).`);
    }

    let raw: unknown;
    try {
      raw = await file.json();
    } catch (error) {
      throw new Error(`Invalid JSON in ${toDisplayPath(metaPath)}: ${toErrorMessage(error)}`);
    }

    try {
      documents.push(parseComponentDocument(raw));
    } catch (error) {
      throw new Error(
        `Schema validation failed in ${toDisplayPath(metaPath)}: ${toErrorMessage(error)}`,
      );
    }
  }

  return documents;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    componentsDir: "../../data/components",
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--components-dir") {
      options.componentsDir = argv[index + 1] ?? options.componentsDir;
      index += 1;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  return options;
}

function toDisplayPath(path: string): string {
  const relativePath = relative(process.cwd(), path);
  return relativePath.startsWith("..") ? path : relativePath;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

await main();
