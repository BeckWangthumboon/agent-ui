import { resolve } from "node:path";

import { ConvexHttpClient } from "convex/browser";

import {
  diffChangesetAgainstSnapshot,
  formatSnapshotIssues,
  fetchLiveSnapshot,
  hasValidationErrors,
  parseAndValidateChangeset,
  printDiffSummary,
  resolveChangesetPath,
  toDisplayPath,
} from "./common";

type CliOptions = {
  changesetPath?: string;
  json: boolean;
};

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    throw new Error("CONVEX_URL is required to diff against live Convex data.");
  }

  const changesetPath = await resolveChangesetPath(options.changesetPath);
  const parsed = await parseAndValidateChangeset(changesetPath);
  if (hasValidationErrors(parsed.issues)) {
    throw new Error("Changeset validation failed. Run data:validate for details.");
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

  const summary = await diffChangesetAgainstSnapshot(parsed.resolvedOperations, snapshot);

  const output = {
    changesetPath,
    changesetId: parsed.changeset.id,
    convexUrl,
    summary,
  };

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(`Changeset: ${parsed.changeset.id}`);
  console.log(`Path: ${toDisplayPath(changesetPath)}`);
  console.log(`Convex: ${convexUrl}`);
  printDiffSummary(summary);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { json: false };

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
  console.log("Usage: bun run scripts/changesets/diff.ts [options]");
  console.log("");
  console.log("Options:");
  console.log("  --changeset <path>   Changeset file path (default: latest in data/changesets)");
  console.log("  --json               Output machine-readable JSON");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
