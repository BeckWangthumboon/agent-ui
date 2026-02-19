import { describe, expect, it } from "bun:test";
import { fileURLToPath } from "node:url";

const decoder = new TextDecoder();
const bunExecutable = process.execPath;
const cliEntry = fileURLToPath(new URL("../cli.ts", import.meta.url));

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
  });

  it("fails fast when CONVEX_URL is missing", () => {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (typeof value === "string") {
        env[key] = value;
      }
    }
    delete env.CONVEX_URL;

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
});
