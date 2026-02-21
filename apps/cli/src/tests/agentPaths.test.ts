import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  AgentProjectNotFoundError,
  findProjectRoot,
  noGitProjectFoundMessage,
  resolveAgentsDirectory,
} from "../project";
import { exists } from "../fsUtils";

describe("agent path discovery", () => {
  let testDir = "";

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "agent-ui-cli-paths-"));
  });

  afterEach(async () => {
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("finds project root by walking up to the nearest .git marker", async () => {
    const repoRoot = join(testDir, "repo");
    const nestedDir = join(repoRoot, "packages", "cli", "src");
    await mkdir(join(repoRoot, ".git"), { recursive: true });
    await mkdir(nestedDir, { recursive: true });

    const projectRoot = await findProjectRoot(nestedDir);

    expect(projectRoot).toBe(repoRoot);
  });

  it("prefers nearest existing .agents directory inside project root", async () => {
    const repoRoot = join(testDir, "repo");
    const packageRoot = join(repoRoot, "packages", "cli");
    const nestedDir = join(packageRoot, "src");
    await mkdir(join(repoRoot, ".git"), { recursive: true });
    await mkdir(join(repoRoot, ".agents"), { recursive: true });
    await mkdir(join(packageRoot, ".agents"), { recursive: true });
    await mkdir(nestedDir, { recursive: true });

    const resolved = await resolveAgentsDirectory({ cwd: nestedDir });

    expect(resolved.agentsDir).toBe(join(packageRoot, ".agents"));
    expect(resolved.projectRoot).toBe(repoRoot);
    expect(resolved.foundExisting).toBe(true);
  });

  it("falls back to <projectRoot>/.agents and can create it", async () => {
    const repoRoot = join(testDir, "repo");
    const nestedDir = join(repoRoot, "packages", "cli", "src");
    await mkdir(join(repoRoot, ".git"), { recursive: true });
    await mkdir(nestedDir, { recursive: true });

    const resolved = await resolveAgentsDirectory({ cwd: nestedDir, createIfMissing: true });

    expect(resolved.agentsDir).toBe(join(repoRoot, ".agents"));
    expect(resolved.projectRoot).toBe(repoRoot);
    expect(resolved.foundExisting).toBe(false);
    expect(await exists(join(repoRoot, ".agents"))).toBe(true);
  });

  it("throws when no git root is found", async () => {
    const nestedDir = join(testDir, "sandbox", "nested");
    await mkdir(nestedDir, { recursive: true });

    await expect(resolveAgentsDirectory({ cwd: nestedDir, createIfMissing: true })).rejects.toThrow(
      noGitProjectFoundMessage(nestedDir),
    );
  });

  it("supports .git as a file marker", async () => {
    const repoRoot = join(testDir, "repo");
    const nestedDir = join(repoRoot, "packages", "cli");
    await mkdir(repoRoot, { recursive: true });
    await mkdir(nestedDir, { recursive: true });
    await Bun.write(join(repoRoot, ".git"), "gitdir: /tmp/fake-worktree");

    const resolved = await resolveAgentsDirectory({ cwd: nestedDir });
    expect(resolved.projectRoot).toBe(repoRoot);
  });

  it("ignores .agents directories above project root", async () => {
    const outerRoot = join(testDir, "outer");
    const repoRoot = join(outerRoot, "repo");
    const nestedDir = join(repoRoot, "packages", "cli");
    await mkdir(join(outerRoot, ".agents"), { recursive: true });
    await mkdir(join(repoRoot, ".git"), { recursive: true });
    await mkdir(nestedDir, { recursive: true });

    const resolved = await resolveAgentsDirectory({ cwd: nestedDir });
    expect(resolved.agentsDir).toBe(join(repoRoot, ".agents"));
    expect(await exists(join(repoRoot, ".agents"))).toBe(false);
  });

  it("throws AgentProjectNotFoundError when no git root exists", async () => {
    const nestedDir = join(testDir, "standalone");
    await mkdir(nestedDir, { recursive: true });

    await expect(resolveAgentsDirectory({ cwd: nestedDir })).rejects.toBeInstanceOf(
      AgentProjectNotFoundError,
    );
  });
});
