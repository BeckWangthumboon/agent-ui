import { Command } from "commander";

import { runSearchCommand } from "./commands/search";
import { runShowCommand } from "./commands/show";
import { runValidateCommand } from "./commands/validate";
import {
  ComponentMotionSchema,
  ComponentTopicSchema,
  type ComponentFramework,
  type ComponentMotion,
  type ComponentStyling,
  type ComponentTopic,
} from "./types";

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
  .option("-t, --topic <topic>", "Filter by topic (repeatable)", collectTopicOption, [] as ComponentTopic[])
  .option("--framework <framework>", "Filter by framework", parseFramework)
  .option("--styling <styling>", "Filter by styling", parseStyling)
  .option("--motion <motion>", "Filter by motion level", parseMotion)
  .option("--json", "Output JSON", false)
  .action(async (query: string, options: SearchCliOptions) => {
    await runSearchCommand(query, {
      dataDir: options.dataDir,
      limit: options.limit,
      json: Boolean(options.json),
      topics: options.topic,
      framework: options.framework,
      styling: options.styling,
      motion: options.motion,
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
  topic: ComponentTopic[];
  framework?: ComponentFramework;
  styling?: ComponentStyling;
  motion?: ComponentMotion;
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

function collectTopicOption(value: string, previous: ComponentTopic[]): ComponentTopic[] {
  return [...previous, parseTopic(value)];
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

function parseTopic(value: string): ComponentTopic {
  return ComponentTopicSchema.parse(value.trim().toLowerCase());
}

function parseMotion(value: string): ComponentMotion {
  return ComponentMotionSchema.parse(value.trim().toLowerCase());
}
