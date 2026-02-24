import { resolve } from "node:path";

import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { buildPublicComponentId } from "../../shared/component-schema";
import {
  collectLocalComponents,
  diffChangesetAgainstSnapshot,
  fetchLiveSnapshot,
  formatSnapshotIssues,
  getDefaultChangesetPath,
  nowTimestampId,
  parseAndValidateChangeset,
  toDisplayPath,
  writeJsonFile,
  type ChangesetDocument,
  type ChangesetOperation,
  type ChangesetSource,
  type ResolvedOperation,
} from "./common";

type CliOptions = {
  id: string;
  source: ChangesetSource;
  componentsDir: string;
  out: string;
  mode: "delta" | "full";
  prune: boolean;
  convexUrl?: string;
};

const SourceSchema = z.enum(["manual", "ingest", "agent"]);
const CreateModeSchema = z.enum(["delta", "full"]);

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const components = await collectLocalComponents(options.componentsDir);
  const operations = await createOperations(components, options);

  const changeset: ChangesetDocument = {
    schemaVersion: 1,
    id: options.id,
    createdAt: new Date().toISOString(),
    source: options.source,
    operations,
  };

  await writeJsonFile(options.out, changeset);
  const validation = await parseAndValidateChangeset(options.out);
  const errors = validation.issues.filter((issue) => issue.level === "error");
  if (errors.length > 0) {
    throw new Error(`Created invalid changeset: ${errors[0]?.message ?? "unknown error"}`);
  }

  const upserts = changeset.operations.filter((operation) => operation.type === "upsert").length;
  const deletes = changeset.operations.filter((operation) => operation.type === "delete").length;

  console.log(
    `Wrote changeset ${changeset.id} with ${changeset.operations.length} operations (upserts=${upserts}, deletes=${deletes}).`,
  );
  console.log(`Mode: ${options.mode}${options.mode === "delta" ? ` (prune=${options.prune})` : ""}`);
  console.log(`Path: ${toDisplayPath(options.out)}`);
}

async function createOperations(
  components: Awaited<ReturnType<typeof collectLocalComponents>>,
  options: CliOptions,
): Promise<ChangesetOperation[]> {
  if (options.mode === "full") {
    return components.map((component) => ({
      type: "upsert",
      component,
    }));
  }

  const convexUrl = options.convexUrl ?? process.env.CONVEX_URL;
  if (!convexUrl) {
    throw new Error("CONVEX_URL is required for --mode delta. Set env var or pass --convex-url.");
  }

  const resolvedUpserts: ResolvedOperation[] = [];
  const componentById = new Map<string, (typeof components)[number]>();

  for (const [index, component] of components.entries()) {
    const componentId = await buildPublicComponentId(component);
    if (componentById.has(componentId)) {
      throw new Error(`Duplicate component id in local docs: '${componentId}'`);
    }

    componentById.set(componentId, component);
    resolvedUpserts.push({
      type: "upsert",
      component,
      componentId,
      operationIndex: index,
    });
  }

  const client = new ConvexHttpClient(convexUrl);
  const snapshot = await fetchLiveSnapshot(client);
  if (snapshot.parseIssues.length > 0) {
    const lines = formatSnapshotIssues(snapshot.parseIssues)
      .slice(0, 20)
      .map((line) => `- ${line}`)
      .join("\n");
    throw new Error(
      `Live Convex snapshot contains ${snapshot.parseIssues.length} invalid rows.\n${lines}\nRun bun run --cwd apps/backend validate:data for a full report.`,
    );
  }

  const diffSummary = await diffChangesetAgainstSnapshot(resolvedUpserts, snapshot);
  const upsertOperations: ChangesetOperation[] = [];

  for (const entry of diffSummary.componentDiffs) {
    if (entry.type !== "upsert") {
      continue;
    }
    if (entry.status === "unchanged") {
      continue;
    }

    const component = componentById.get(entry.componentId);
    if (!component) {
      throw new Error(`Internal error: missing local component for '${entry.componentId}'.`);
    }

    upsertOperations.push({
      type: "upsert",
      component,
    });
  }

  if (!options.prune) {
    return upsertOperations;
  }

  const localIds = new Set(componentById.keys());
  const liveIds = new Set<string>([
    ...snapshot.metadataById.keys(),
    ...snapshot.codeById.keys(),
    ...snapshot.searchById.keys(),
    ...snapshot.filesById.keys(),
  ]);
  const deletes = [...liveIds]
    .filter((componentId) => !localIds.has(componentId))
    .sort((left, right) => left.localeCompare(right, "en"))
    .map((componentId) => ({ type: "delete", componentId }) satisfies ChangesetOperation);

  return [...upsertOperations, ...deletes];
}

function parseArgs(argv: string[]): CliOptions {
  const nowId = nowTimestampId();
  let outExplicit = false;
  const options: CliOptions = {
    id: nowId,
    source: "manual",
    componentsDir: resolve("data/components"),
    out: getDefaultChangesetPath(nowId),
    mode: "delta",
    prune: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) {
      continue;
    }

    switch (arg) {
      case "--id": {
        const value = argv[index + 1];
        if (!value) {
          throw new Error("Missing value for --id");
        }
        options.id = value;
        if (!outExplicit) {
          options.out = getDefaultChangesetPath(options.id);
        }
        index += 1;
        break;
      }
      case "--source": {
        const value = argv[index + 1];
        if (!value) {
          throw new Error("Missing value for --source");
        }
        options.source = SourceSchema.parse(value);
        index += 1;
        break;
      }
      case "--components-dir": {
        const value = argv[index + 1];
        if (!value) {
          throw new Error("Missing value for --components-dir");
        }
        options.componentsDir = resolve(value);
        index += 1;
        break;
      }
      case "--out": {
        const value = argv[index + 1];
        if (!value) {
          throw new Error("Missing value for --out");
        }
        options.out = resolve(value);
        outExplicit = true;
        index += 1;
        break;
      }
      case "--mode": {
        const value = argv[index + 1];
        if (!value) {
          throw new Error("Missing value for --mode");
        }
        options.mode = CreateModeSchema.parse(value);
        index += 1;
        break;
      }
      case "--prune": {
        options.prune = true;
        break;
      }
      case "--convex-url": {
        const value = argv[index + 1];
        if (!value) {
          throw new Error("Missing value for --convex-url");
        }
        options.convexUrl = value;
        index += 1;
        break;
      }
      case "--help":
      case "-h": {
        printHelp();
        process.exit(0);
        break;
      }
      default: {
        throw new Error(`Unknown argument: ${arg}`);
      }
    }
  }

  if (options.id.trim().length === 0) {
    throw new Error("--id must be non-empty");
  }

  return options;
}

function printHelp(): void {
  console.log("Usage: bun run scripts/changesets/create-from-local.ts [options]");
  console.log("");
  console.log("Options:");
  console.log("  --id <id>                 Changeset id (default: timestamp)");
  console.log("  --source <source>         manual | ingest | agent (default: manual)");
  console.log("  --mode <mode>             delta | full (default: delta)");
  console.log("  --prune                   In delta mode, include deletes for live ids not in local");
  console.log("  --components-dir <path>   Local component dir (default: data/components)");
  console.log("  --convex-url <url>        Override CONVEX_URL for delta mode");
  console.log("  --out <path>              Output path (default: data/changesets/<id>.json)");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
