import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  DEFAULT_AGENT_UI_CONFIG,
  DEFAULT_CONFIG_RELATIVE_PATH,
  loadAgentUiConfig,
  mergeSearchOptions,
} from "../config";

describe("loadAgentUiConfig", () => {
  let originalCwd = "";
  let testDir = "";

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = await mkdtemp(join(tmpdir(), "agent-ui-cli-config-"));
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("creates the default config for search when missing", async () => {
    const loaded = await loadAgentUiConfig({ commandName: "search" });

    expect(loaded.createdDefault).toBe(true);
    expect(loaded.config).toEqual(DEFAULT_AGENT_UI_CONFIG);

    const createdPath = join(testDir, DEFAULT_CONFIG_RELATIVE_PATH);
    const contents = await readFile(createdPath, "utf8");
    expect(JSON.parse(contents)).toEqual(DEFAULT_AGENT_UI_CONFIG);
  });

  it("returns null for non-search commands when default config is missing", async () => {
    const loaded = await loadAgentUiConfig({ commandName: "view" });

    expect(loaded.createdDefault).toBe(false);
    expect(loaded.config).toBeNull();
  });

  it("fails when explicit --config path does not exist", async () => {
    await expect(
      loadAgentUiConfig({
        commandName: "search",
        explicitPath: "custom-config.json",
      }),
    ).rejects.toThrow("Config file not found:");
  });

  it("fails on schema validation errors", async () => {
    const configPath = join(testDir, "bad.json");
    await writeFile(
      configPath,
      JSON.stringify({
        schemaVersion: 1,
        search: {
          framework: "vue",
        },
      }),
      "utf8",
    );

    await expect(
      loadAgentUiConfig({
        commandName: "search",
        explicitPath: configPath,
      }),
    ).rejects.toThrow("Invalid config file");
  });
});

describe("mergeSearchOptions", () => {
  it("prefers CLI flags over config defaults", () => {
    const merged = mergeSearchOptions(
      {
        limit: 3,
        motion: ["heavy"],
      },
      {
        schemaVersion: 1,
        search: {
          limit: 10,
          framework: "react",
          styling: "tailwind",
          motion: ["none", "minimal"],
          primitiveLibrary: ["radix"],
          json: true,
        },
      },
    );

    expect(merged.limit).toBe(3);
    expect(merged.framework).toBe("react");
    expect(merged.motion).toEqual(["heavy"]);
    expect(merged.primitiveLibrary).toEqual(["radix"]);
    expect(merged.json).toBe(true);
  });
});
