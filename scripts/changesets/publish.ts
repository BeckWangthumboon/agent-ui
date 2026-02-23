import { resolve } from "node:path";

import { ConvexHttpClient } from "convex/browser";

import {
  deleteComponentById,
  diffChangesetAgainstSnapshot,
  fetchLiveSnapshot,
  formatValidationIssues,
  hasValidationErrors,
  parseAndValidateChangeset,
  printDiffSummary,
  resolveChangesetPath,
  toDisplayPath,
  upsertComponent,
  type ValidationIssue,
} from "./common";

type CliOptions = {
  changesetPath?: string;
  dryRun: boolean;
  json: boolean;
};

type PublishResult = {
  changesetPath: string;
  changesetId: string;
  dryRun: boolean;
  convexUrl: string;
  validationIssues: ValidationIssue[];
  diff: Awaited<ReturnType<typeof diffChangesetAgainstSnapshot>>;
  applied: Array<{ type: "upsert" | "delete"; componentId: string; result: unknown }>;
};

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    throw new Error("CONVEX_URL is required to publish to live Convex data.");
  }

  const changesetPath = await resolveChangesetPath(options.changesetPath);
  const parsed = await parseAndValidateChangeset(changesetPath);
  const validationFailed = hasValidationErrors(parsed.issues);

  if (validationFailed) {
    const firstError = parsed.issues.find((issue) => issue.level === "error");
    throw new Error(`Changeset validation failed: ${firstError?.message ?? "unknown error"}`);
  }

  const client = new ConvexHttpClient(convexUrl);
  const snapshot = await fetchLiveSnapshot(client);
  const diff = await diffChangesetAgainstSnapshot(parsed.resolvedOperations, snapshot);
  const applied: PublishResult["applied"] = [];

  if (!options.dryRun) {
    for (const operation of parsed.resolvedOperations) {
      if (operation.type === "upsert") {
        const result = await client.mutation(upsertComponent, { component: operation.component });
        applied.push({ type: "upsert", componentId: operation.componentId, result });
      } else {
        const result = await client.mutation(deleteComponentById, {
          componentId: operation.componentId,
        });
        applied.push({ type: "delete", componentId: operation.componentId, result });
      }
    }
  }

  const output: PublishResult = {
    changesetPath,
    changesetId: parsed.changeset.id,
    dryRun: options.dryRun,
    convexUrl,
    validationIssues: parsed.issues,
    diff,
    applied,
  };

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(`${options.dryRun ? "Dry run" : "Published"} changeset: ${parsed.changeset.id}`);
  console.log(`Path: ${toDisplayPath(changesetPath)}`);
  console.log(`Convex: ${convexUrl}`);
  if (parsed.issues.length > 0) {
    for (const line of formatValidationIssues(parsed.issues)) {
      console.log(line);
    }
  }
  printDiffSummary(diff);

  if (!options.dryRun) {
    console.log(`Applied operations: ${applied.length}`);
  }
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { dryRun: false, json: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) {
      continue;
    }

    switch (arg) {
      case "--changeset": {
        const value = argv[index + 1];
        if (!value) {
          throw new Error("Missing value for --changeset");
        }
        options.changesetPath = resolve(value);
        index += 1;
        break;
      }
      case "--dry-run": {
        options.dryRun = true;
        break;
      }
      case "--json": {
        options.json = true;
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

  return options;
}

function printHelp(): void {
  console.log("Usage: bun run scripts/changesets/publish.ts [options]");
  console.log("");
  console.log("Options:");
  console.log("  --changeset <path>   Changeset file path (default: latest in data/changesets)");
  console.log("  --dry-run            Validate and diff but do not apply mutations");
  console.log("  --json               Output machine-readable JSON");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
