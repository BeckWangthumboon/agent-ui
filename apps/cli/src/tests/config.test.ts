import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
    await mkdir(join(testDir, ".git"), { recursive: true });
    const loaded = await loadAgentUiConfig({ commandName: "search" });

    expect(loaded.createdDefault).toBe(true);
    expect(loaded.config).toEqual(DEFAULT_AGENT_UI_CONFIG);

    const createdPath = join(testDir, DEFAULT_CONFIG_RELATIVE_PATH);
    const contents = await readFile(createdPath, "utf8");
    expect(JSON.parse(contents)).toEqual(DEFAULT_AGENT_UI_CONFIG);
  });

  it("returns null for non-search commands when default config is missing", async () => {
    await mkdir(join(testDir, ".git"), { recursive: true });
    const loaded = await loadAgentUiConfig({ commandName: "view" });

    expect(loaded.createdDefault).toBe(false);
    expect(loaded.config).toBeNull();
  });

  it("fails when no git project is found for default path on search", async () => {
    await expect(loadAgentUiConfig({ commandName: "search" })).rejects.toThrow(
      "No git project found from",
    );
  });

  it("fails when no git project is found for default path on non-search", async () => {
    await expect(loadAgentUiConfig({ commandName: "view" })).rejects.toThrow(
      "No git project found from",
    );
  });

  it("creates default config at project root when running from a nested cwd", async () => {
    const repoRoot = join(testDir, "repo");
    const nestedCwd = join(repoRoot, "packages", "cli");
    await mkdir(join(repoRoot, ".git"), { recursive: true });
    await mkdir(nestedCwd, { recursive: true });

    const loaded = await loadAgentUiConfig({ commandName: "search", cwd: nestedCwd });

    const expectedPath = join(repoRoot, DEFAULT_CONFIG_RELATIVE_PATH);
    expect(loaded.createdDefault).toBe(true);
    expect(loaded.configPath).toBe(expectedPath);
    const contents = await readFile(expectedPath, "utf8");
    expect(JSON.parse(contents)).toEqual(DEFAULT_AGENT_UI_CONFIG);
  });

  it("loads nearest existing .agents config within project boundary", async () => {
    const repoRoot = join(testDir, "repo");
    const packageRoot = join(repoRoot, "packages", "cli");
    const nestedCwd = join(packageRoot, "src");
    await mkdir(join(repoRoot, ".git"), { recursive: true });
    await mkdir(join(packageRoot, ".agents"), { recursive: true });
    await mkdir(nestedCwd, { recursive: true });

    const packageConfigPath = join(packageRoot, DEFAULT_CONFIG_RELATIVE_PATH);
    await writeFile(
      packageConfigPath,
      JSON.stringify({
        schemaVersion: 1,
        search: {
          limit: 5,
          framework: "react",
          styling: "tailwind",
          motion: ["none"],
          primitiveLibrary: ["radix"],
          json: false,
        },
      }),
      "utf8",
    );

    const loaded = await loadAgentUiConfig({ commandName: "view", cwd: nestedCwd });

    expect(loaded.configPath).toBe(packageConfigPath);
    expect(loaded.createdDefault).toBe(false);
    expect(loaded.config?.search?.limit).toBe(5);
    expect(loaded.config?.search?.json).toBe(false);
  });

  it("fails when explicit --config path does not exist", async () => {
    await expect(
      loadAgentUiConfig({
        commandName: "search",
        explicitPath: "custom-config.json",
      }),
    ).rejects.toThrow("Config file not found:");
  });

  it("loads explicit --config outside a git project", async () => {
    const configPath = join(testDir, "config.json");
    await writeFile(configPath, JSON.stringify(DEFAULT_AGENT_UI_CONFIG), "utf8");

    const loaded = await loadAgentUiConfig({
      commandName: "search",
      explicitPath: configPath,
    });

    expect(loaded.createdDefault).toBe(false);
    expect(loaded.configPath).toBe(configPath);
    expect(loaded.config).toEqual(DEFAULT_AGENT_UI_CONFIG);
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
