import { Command } from "commander";

import { runSearchCommand } from "./commands/search";
import { runShowCommand } from "./commands/show";
import { runValidateCommand } from "./commands/validate";
import type { ComponentFramework, ComponentStyling } from "./types";

const program = new Command();

program
  .name("component-search")
  .description("CLI for loading and searching component documents")
  .showHelpAfterError()
  .version("0.1.0");

program
  .command("search")
  .description("Fuzzy-search component documents")
  .argument("<query>", "Search query")
  .option("-d, --data-dir <path>", "Component data directory", "data/components")
  .option("-l, --limit <number>", "Maximum number of results", parsePositiveInteger, 10)
  .option("-t, --tag <tag>", "Filter by tag (repeatable)", collectRepeatedOption, [] as string[])
  .option("--framework <framework>", "Filter by framework", parseFramework)
  .option("--styling <styling>", "Filter by styling", parseStyling)
  .option("--json", "Output JSON", false)
  .action(async (query: string, options: SearchCliOptions) => {
    await runSearchCommand(query, {
      dataDir: options.dataDir,
      limit: options.limit,
      json: Boolean(options.json),
      tags: options.tag,
      framework: options.framework,
      styling: options.styling,
    });
  });

program
  .command("show")
  .description("Show a component by id")
  .argument("<id>", "Component id")
  .option("-d, --data-dir <path>", "Component data directory", "data/components")
  .option("--code", "Print component code", false)
  .option("--json", "Output JSON", false)
  .action(async (id: string, options: ShowCliOptions) => {
    await runShowCommand(id, {
      dataDir: options.dataDir,
      code: Boolean(options.code),
      json: Boolean(options.json),
    });
  });

program
  .command("validate")
  .description("Validate all component documents")
  .option("-d, --data-dir <path>", "Component data directory", "data/components")
  .option("--strict", "Validate code file/content consistency", false)
  .option("--json", "Output JSON", false)
  .action(async (options: ValidateCliOptions) => {
    await runValidateCommand({
      dataDir: options.dataDir,
      strict: Boolean(options.strict),
      json: Boolean(options.json),
    });
  });

await program.parseAsync(process.argv);

type SearchCliOptions = {
  dataDir: string;
  limit: number;
  tag: string[];
  framework?: ComponentFramework;
  styling?: ComponentStyling;
  json?: boolean;
};

type ShowCliOptions = {
  dataDir: string;
  code?: boolean;
  json?: boolean;
};

type ValidateCliOptions = {
  dataDir: string;
  strict?: boolean;
  json?: boolean;
};

function collectRepeatedOption(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received: ${value}`);
  }
  return parsed;
}

function parseFramework(value: string): ComponentFramework {
  if (value !== "react") {
    throw new Error(`Unsupported framework '${value}'. Allowed values: react`);
  }

  return value;
}

function parseStyling(value: string): ComponentStyling {
  if (value !== "tailwind") {
    throw new Error(`Unsupported styling '${value}'. Allowed values: tailwind`);
  }

  return value;
}
