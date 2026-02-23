import { resolve } from "node:path";

import { z } from "zod";

import {
  collectLocalComponents,
  getDefaultChangesetPath,
  nowTimestampId,
  parseAndValidateChangeset,
  toDisplayPath,
  writeJsonFile,
  type ChangesetDocument,
  type ChangesetSource,
} from "./common";

type CliOptions = {
  id: string;
  source: ChangesetSource;
  componentsDir: string;
  out: string;
};

const SourceSchema = z.enum(["manual", "ingest", "agent"]);

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const components = await collectLocalComponents(options.componentsDir);

  const changeset: ChangesetDocument = {
    schemaVersion: 1,
    id: options.id,
    createdAt: new Date().toISOString(),
    source: options.source,
    operations: components.map((component) => ({
      type: "upsert",
      component,
    })),
  };

  await writeJsonFile(options.out, changeset);
  const validation = await parseAndValidateChangeset(options.out);
  const errors = validation.issues.filter((issue) => issue.level === "error");
  if (errors.length > 0) {
    throw new Error(`Created invalid changeset: ${errors[0]?.message ?? "unknown error"}`);
  }

  console.log(`Wrote changeset ${changeset.id} with ${changeset.operations.length} upsert operations.`);
  console.log(`Path: ${toDisplayPath(options.out)}`);
}

function parseArgs(argv: string[]): CliOptions {
  const nowId = nowTimestampId();
  let outExplicit = false;
  const options: CliOptions = {
    id: nowId,
    source: "manual",
    componentsDir: resolve("data/components"),
    out: getDefaultChangesetPath(nowId),
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
  console.log("  --components-dir <path>   Local component dir (default: data/components)");
  console.log("  --out <path>              Output path (default: data/changesets/<id>.json)");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
