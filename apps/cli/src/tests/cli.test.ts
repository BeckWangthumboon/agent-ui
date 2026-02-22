import { describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { noGitProjectFoundMessage } from "../project";

const decoder = new TextDecoder();
const bunExecutable = process.execPath;
const cliEntry = fileURLToPath(new URL("../cli.ts", import.meta.url));

function envWithoutConvexUrl() {
  const env = Object.fromEntries(
    Object.entries(process.env).flatMap(([key, value]) =>
      typeof value === "string" ? [[key, value]] : [],
    ),
  );
  delete env.CONVEX_URL;
  return env;
}

describe("cli command wiring", () => {
  it("shows view|v in help output", () => {
    const result = Bun.spawnSync({
      cmd: [bunExecutable, "run", cliEntry, "--help"],
      env: process.env,
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).toBe(0);

    const stdout = decoder.decode(result.stdout);
    expect(stdout).toContain("view|v [options] <id>");
    expect(stdout).toContain("add [options] <id>");
  });

  it("fails fast when CONVEX_URL is missing", () => {
    const env = envWithoutConvexUrl();

    const result = Bun.spawnSync({
      cmd: [bunExecutable, "run", cliEntry, "view", "core-button"],
      env,
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).toBe(1);

    const stderr = decoder.decode(result.stderr);
    expect(stderr).toContain("CONVEX_URL is required.");
  });

  it("fails fast for add when CONVEX_URL is missing", () => {
    const env = envWithoutConvexUrl();

    const result = Bun.spawnSync({
      cmd: [bunExecutable, "run", cliEntry, "add", "core-button"],
      env,
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).toBe(1);

    const stderr = decoder.decode(result.stderr);
    expect(stderr).toContain("CONVEX_URL is required.");
  });

  it("creates default config on search when .agents/agent-ui.json is missing", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "agent-ui-cli-"));
    await mkdir(join(cwd, ".git"), { recursive: true });
    const env = envWithoutConvexUrl();

    try {
      const result = Bun.spawnSync({
        cmd: [bunExecutable, "run", cliEntry, "search", "button"],
        env,
        cwd,
        stdout: "pipe",
        stderr: "pipe",
      });

      expect(result.exitCode).toBe(1);
      const createdConfig = await readFile(join(cwd, ".agents/agent-ui.json"), "utf8");
      const payload = JSON.parse(createdConfig);
      expect(payload.schemaVersion).toBe(1);
      expect(payload.search.framework).toBe("react");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("errors on search when no git project is found and no explicit --config is provided", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "agent-ui-cli-no-git-"));
    const env = envWithoutConvexUrl();

    try {
      const result = Bun.spawnSync({
        cmd: [bunExecutable, "run", cliEntry, "search", "button"],
        env,
        cwd,
        stdout: "pipe",
        stderr: "pipe",
      });

      expect(result.exitCode).toBe(1);
      const stderr = decoder.decode(result.stderr);
      expect(stderr).toContain(noGitProjectFoundMessage(cwd));
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("creates default config at git project root from nested cwd", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-ui-cli-git-"));
    const nestedCwd = join(root, "packages", "cli");
    await mkdir(join(root, ".git"), { recursive: true });
    await mkdir(nestedCwd, { recursive: true });

    const env = envWithoutConvexUrl();

    try {
      const result = Bun.spawnSync({
        cmd: [bunExecutable, "run", cliEntry, "search", "button"],
        env,
        cwd: nestedCwd,
        stdout: "pipe",
        stderr: "pipe",
      });

      expect(result.exitCode).toBe(1);
      const createdConfig = await readFile(join(root, ".agents/agent-ui.json"), "utf8");
      const payload = JSON.parse(createdConfig);
      expect(payload.schemaVersion).toBe(1);
      expect(payload.search.framework).toBe("react");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
