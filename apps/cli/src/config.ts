import { resolve as resolvePath } from "node:path";
import { z } from "zod";

import {
  ComponentFrameworkSchema,
  ComponentMotionSchema,
  ComponentPrimitiveLibrarySchema,
  ComponentStylingSchema,
} from "../../../shared/component-schema";
import { exists, readJson, writeJsonAtomic } from "./fsUtils.js";
import type { SearchCliOptions } from "./search.js";

export const DEFAULT_CONFIG_RELATIVE_PATH = ".agents/agent-ui.json";

const SearchConfigSchema = z
  .strictObject({
    limit: z.number().int().positive().optional(),
    framework: ComponentFrameworkSchema.optional(),
    styling: ComponentStylingSchema.optional(),
    motion: z.array(ComponentMotionSchema).min(1).optional(),
    primitiveLibrary: z.array(ComponentPrimitiveLibrarySchema).min(1).optional(),
    json: z.boolean().optional(),
  })
  .optional();

const AgentUiConfigSchema = z.strictObject({
  schemaVersion: z.literal(1),
  search: SearchConfigSchema,
});

export type AgentUiConfig = z.infer<typeof AgentUiConfigSchema>;

export const DEFAULT_AGENT_UI_CONFIG: AgentUiConfig = {
  schemaVersion: 1,
  search: {
    limit: 10,
    framework: "react",
    styling: "tailwind",
    motion: ["none", "minimal"],
    primitiveLibrary: ["radix", "base-ui"],
    json: true,
  },
};

export type LoadAgentUiConfigInput = {
  commandName: string;
  explicitPath?: string;
  cwd?: string;
};

export type LoadedAgentUiConfig = {
  configPath: string;
  config: AgentUiConfig | null;
  createdDefault: boolean;
};

export function resolveConfigPath(explicitPath?: string, cwd = process.cwd()): string {
  return resolvePath(cwd, explicitPath ?? DEFAULT_CONFIG_RELATIVE_PATH);
}

export async function loadAgentUiConfig(
  input: LoadAgentUiConfigInput,
): Promise<LoadedAgentUiConfig> {
  const configPath = resolveConfigPath(input.explicitPath, input.cwd);
  const isDefaultPath = input.explicitPath === undefined;
  const configExists = await exists(configPath);

  if (!configExists) {
    if (isDefaultPath && input.commandName === "search") {
      await writeJsonAtomic(configPath, DEFAULT_AGENT_UI_CONFIG);
      return {
        configPath,
        config: DEFAULT_AGENT_UI_CONFIG,
        createdDefault: true,
      };
    }

    if (isDefaultPath) {
      return {
        configPath,
        config: null,
        createdDefault: false,
      };
    }

    throw new Error(`Config file not found: ${configPath}`);
  }

  const raw = await readJson<unknown>(configPath);
  const parsed = AgentUiConfigSchema.safeParse(raw);

  if (!parsed.success) {
    throw new Error(`Invalid config file '${configPath}': ${parsed.error.message}`);
  }

  return {
    configPath,
    config: parsed.data,
    createdDefault: false,
  };
}

export function mergeSearchOptions(
  cliOptions: SearchCliOptions,
  config: AgentUiConfig | null,
): SearchCliOptions {
  const searchDefaults = config?.search;

  return {
    limit: cliOptions.limit ?? searchDefaults?.limit,
    framework: cliOptions.framework ?? searchDefaults?.framework,
    styling: cliOptions.styling ?? searchDefaults?.styling,
    motion: cliOptions.motion ?? searchDefaults?.motion,
    primitiveLibrary: cliOptions.primitiveLibrary ?? searchDefaults?.primitiveLibrary,
    json: cliOptions.json ?? searchDefaults?.json,
  };
}
