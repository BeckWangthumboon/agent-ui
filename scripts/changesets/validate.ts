import { resolve } from "node:path";

import {
  formatValidationIssues,
  hasValidationErrors,
  parseAndValidateChangeset,
  resolveChangesetPath,
  toDisplayPath,
} from "./common";

type CliOptions = {
  changesetPath?: string;
  json: boolean;
};

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const changesetPath = await resolveChangesetPath(options.changesetPath);
  const parsed = await parseAndValidateChangeset(changesetPath);
  const output = {
    changesetPath,
    changesetId: parsed.changeset.id,
    operationCount: parsed.changeset.operations.length,
    issues: parsed.issues,
    errorCount: parsed.issues.filter((issue) => issue.level === "error").length,
    warningCount: parsed.issues.filter((issue) => issue.level === "warning").length,
    valid: !hasValidationErrors(parsed.issues),
  };

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`Changeset: ${parsed.changeset.id}`);
    console.log(`Path: ${toDisplayPath(changesetPath)}`);
    console.log(`Operations: ${output.operationCount}`);
    console.log(`Warnings: ${output.warningCount}`);
    console.log(`Errors: ${output.errorCount}`);

    const lines = formatValidationIssues(parsed.issues);
    for (const line of lines) {
      console.log(line);
    }
  }

  if (!output.valid) {
    process.exit(1);
  }
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
  console.log("Usage: bun run scripts/changesets/validate.ts [options]");
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
