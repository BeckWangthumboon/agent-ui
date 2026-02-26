import { resolve } from "node:path";

import { ConvexHttpClient } from "convex/browser";

import {
  applyChangeset as applyChangesetMutation,
  formatValidationIssues,
  hasValidationErrors,
  parseAndValidateChangeset,
  resolveChangesetPath,
  toDisplayPath,
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
  convexSource: "local" | "cloud";
  validationIssues: ValidationIssue[];
  operationCount: number;
  upsertCount: number;
  deleteCount: number;
  appliedResult: unknown | null;
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

  const upsertCount = parsed.resolvedOperations.filter((operation) => operation.type === "upsert").length;
  const deleteCount = parsed.resolvedOperations.length - upsertCount;

  const client = new ConvexHttpClient(convexUrl);
  let appliedResult: unknown | null = null;

  if (!options.dryRun) {
    appliedResult = await client.mutation(applyChangesetMutation, {
      changesetId: parsed.changeset.id,
      operations: parsed.changeset.operations,
    });
  }

  const output: PublishResult = {
    changesetPath,
    changesetId: parsed.changeset.id,
    dryRun: options.dryRun,
    convexSource: describeConvexSource(convexUrl),
    validationIssues: parsed.issues,
    operationCount: parsed.resolvedOperations.length,
    upsertCount,
    deleteCount,
    appliedResult,
  };

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(`${options.dryRun ? "Dry run" : "Published"} changeset: ${parsed.changeset.id}`);
  console.log(`Path: ${toDisplayPath(changesetPath)}`);
  console.log(`Convex source: ${output.convexSource}`);
  if (parsed.issues.length > 0) {
    for (const line of formatValidationIssues(parsed.issues)) {
      console.log(line);
    }
  }
  console.log(`Operations: ${output.operationCount}`);
  console.log(`Upserts: ${output.upsertCount}`);
  console.log(`Deletes: ${output.deleteCount}`);

  if (options.dryRun) {
    console.log("No mutations applied (--dry-run).");
  } else {
    const appliedCount =
      typeof output.appliedResult === "object" &&
      output.appliedResult !== null &&
      "operationCount" in output.appliedResult
        ? Number((output.appliedResult as { operationCount?: number }).operationCount ?? output.operationCount)
        : output.operationCount;
    console.log(`Applied operations: ${appliedCount}`);
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
  console.log("  --dry-run            Validate only; do not apply mutations");
  console.log("  --json               Output machine-readable JSON");
}

function describeConvexSource(convexUrl: string): "local" | "cloud" {
  try {
    const hostname = new URL(convexUrl).hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return "local";
    }
    return "cloud";
  } catch {
    if (convexUrl.includes("localhost") || convexUrl.includes("127.0.0.1")) {
      return "local";
    }
    return "cloud";
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
