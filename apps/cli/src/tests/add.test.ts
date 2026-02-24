import { describe, expect, it, mock } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { ComponentInstall } from "../../../../shared/component-schema";
import { runAddCommand, type ExecutionResult } from "../add";
import { captureCommandOutput, createMockClient, createSampleComponentMetadata } from "./helpers";
import { CLI_NAME } from "../constants";

function createComponentWithInstall(install: ComponentInstall) {
  return {
    ...createSampleComponentMetadata(),
    install,
  };
}

function createMockExecutor(result: ExecutionResult) {
  return mock(async () => result);
}

describe("runAddCommand", () => {
  it("prints an install command for command mode using npx by default", async () => {
    const component = createComponentWithInstall({
      mode: "command",
      source: "manual",
      template: "shadcn@latest add button",
    });
    const { client } = createMockClient(async () => component);

    const output = await captureCommandOutput(async () => {
      await runAddCommand("core-button", {}, client);
    });

    const text = output.logs.join("\n");
    expect(text).toContain("Button (core-button)");
    expect(text).toContain("install.mode: command");
    expect(text).toContain("command: npx shadcn@latest add button");
  });

  it("renders package-manager-specific command prefixes", async () => {
    const component = createComponentWithInstall({
      mode: "command",
      source: "shadcn",
      template: "shadcn@latest add dialog",
    });
    const { client } = createMockClient(async () => component);

    const output = await captureCommandOutput(async () => {
      await runAddCommand("core-button", { packageManager: "pnpm" }, client);
    });

    const text = output.logs.join("\n");
    expect(text).toContain("command: pnpm dlx shadcn@latest add dialog");
  });

  it("prints manual steps for manual mode", async () => {
    const component = createComponentWithInstall({
      mode: "manual",
      source: "manual",
      steps: ["Copy styles into global.css", "Import utility from lib/utils.ts"],
    });
    const { client } = createMockClient(async () => component);

    const output = await captureCommandOutput(async () => {
      await runAddCommand("core-button", {}, client);
    });

    const text = output.logs.join("\n");
    expect(text).toContain("install.mode: manual");
    expect(text).not.toContain("command:");
    expect(text).toContain("manual.steps:");
    expect(text).toContain("1. Copy styles into global.css");
    expect(text).toContain("2. Import utility from lib/utils.ts");
  });

  it("prints command and manual steps for command+manual mode", async () => {
    const component = createComponentWithInstall({
      mode: "command+manual",
      source: "manual",
      template: "shadcn@latest add chart",
      steps: ["Add chart color tokens to global.css"],
    });
    const { client } = createMockClient(async () => component);

    const output = await captureCommandOutput(async () => {
      await runAddCommand("core-button", { packageManager: "yarn" }, client);
    });

    const text = output.logs.join("\n");
    expect(text).toContain("command: yarn dlx shadcn@latest add chart");
    expect(text).toContain("1. Add chart color tokens to global.css");
  });

  it("prints structured JSON output", async () => {
    const component = createComponentWithInstall({
      mode: "command+manual",
      source: "manual",
      template: "shadcn@latest add calendar",
      steps: ["Add date-fns locale helpers"],
    });
    const { client } = createMockClient(async () => component);

    const output = await captureCommandOutput(async () => {
      await runAddCommand("core-button", { json: true, packageManager: "bunx" }, client);
    });

    expect(output.logs).toHaveLength(1);
    const payload = JSON.parse(output.logs[0] ?? "{}");
    expect(payload.id).toBe("core-button");
    expect(payload.packageManager).toBe("bunx");
    expect(payload.mode).toBe("command+manual");
    expect(payload.renderedCommand).toBe("bunx shadcn@latest add calendar");
    expect(payload.steps).toEqual(["Add date-fns locale helpers"]);
    expect(payload.willExecute).toBe(false);
  });

  it("returns an actionable error when install metadata is missing", async () => {
    const component = {
      ...createSampleComponentMetadata(),
      install: undefined,
    };
    const { client } = createMockClient(async () => component);

    const output = await captureCommandOutput(async () => {
      await runAddCommand("core-button", {}, client);
    });

    expect(output.errors).toContain("Install instructions are unavailable for core-button.");
    expect(output.errors).toContain(
      `Try: ${CLI_NAME} view <id> --code and apply changes manually.`,
    );
    expect(output.exitCode).toBe(1);
  });

  it("returns not found for unknown ids", async () => {
    const { client } = createMockClient(async () => null);

    const output = await captureCommandOutput(async () => {
      await runAddCommand("missing", {}, client);
    });

    expect(output.errors).toContain("Component not found: missing");
    expect(output.exitCode).toBe(1);
  });

  it("rejects empty ids", async () => {
    const { client } = createMockClient(async () => null);

    const output = await captureCommandOutput(async () => {
      await runAddCommand("   ", {}, client);
    });

    expect(output.errors).toContain("Component id must be non-empty.");
    expect(output.exitCode).toBe(1);
  });

  describe("--yes flag", () => {
    it("fails fast when components.json is missing", async () => {
      const component = createComponentWithInstall({
        mode: "command",
        source: "shadcn",
        template: "shadcn@latest add button",
      });
      const { client } = createMockClient(async () => component);
      const executor = createMockExecutor({ success: true, exitCode: 0 });

      const cwd = process.cwd();
      const tempDir = await mkdtemp(join(tmpdir(), "agent-ui-add-no-init-"));

      try {
        process.chdir(tempDir);
        const output = await captureCommandOutput(async () => {
          await runAddCommand("core-button", { yes: true, executor }, client);
        });

        expect(output.errors.some((line) => line.includes("components.json not found"))).toBe(true);
        expect(output.exitCode).toBe(1);
        expect(executor).toHaveBeenCalledTimes(0);
      } finally {
        process.chdir(cwd);
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("auto-inits when --init-if-missing is set", async () => {
      const component = createComponentWithInstall({
        mode: "command",
        source: "shadcn",
        template: "shadcn@latest add button",
      });
      const { client } = createMockClient(async () => component);

      const cwd = process.cwd();
      const tempDir = await mkdtemp(join(tmpdir(), "agent-ui-add-auto-init-"));

      const executor = mock(async (command: string) => {
        if (command.includes("shadcn@latest init")) {
          await writeFile(join(tempDir, "components.json"), "{}\n", "utf8");
        }
        return { success: true, exitCode: 0 } as ExecutionResult;
      });

      try {
        process.chdir(tempDir);
        const output = await captureCommandOutput(async () => {
          await runAddCommand("core-button", { yes: true, initIfMissing: true, executor }, client);
        });

        const text = output.logs.join("\n");
        expect(text).toContain("components.json not found. Running init:");
        expect(text).toContain("Running: npx shadcn@latest add button");
        expect(executor).toHaveBeenCalledTimes(2);
      } finally {
        process.chdir(cwd);
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("executes command and prints Done for command mode", async () => {
      const component = createComponentWithInstall({
        mode: "command",
        source: "shadcn",
        template: "shadcn@latest add button",
      });
      const { client } = createMockClient(async () => component);
      const executor = createMockExecutor({ success: true, exitCode: 0 });

      const cwd = process.cwd();
      const tempDir = await mkdtemp(join(tmpdir(), "agent-ui-add-exec-"));

      try {
        await writeFile(join(tempDir, "components.json"), "{}\n", "utf8");
        process.chdir(tempDir);

        const output = await captureCommandOutput(async () => {
          await runAddCommand("core-button", { yes: true, executor }, client);
        });

        const text = output.logs.join("\n");
        expect(text).toContain("Button (core-button)");
        expect(text).toContain("Running: npx shadcn@latest add button");
        expect(text).toContain("Done.");
        expect(executor).toHaveBeenCalledTimes(1);
      } finally {
        process.chdir(cwd);
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("executes command and shows remaining manual steps for hybrid mode", async () => {
      const component = createComponentWithInstall({
        mode: "command+manual",
        source: "shadcn",
        template: "shadcn@latest add chart",
        steps: ["Add chart color tokens to global.css:\n```css\n--chart-1: ...;\n```"],
      });
      const { client } = createMockClient(async () => component);
      const executor = createMockExecutor({ success: true, exitCode: 0 });

      const cwd = process.cwd();
      const tempDir = await mkdtemp(join(tmpdir(), "agent-ui-add-hybrid-"));

      try {
        await writeFile(join(tempDir, "components.json"), "{}\n", "utf8");
        process.chdir(tempDir);

        const output = await captureCommandOutput(async () => {
          await runAddCommand("chart-component", { yes: true, executor }, client);
        });

        const text = output.logs.join("\n");
        expect(text).toContain("Running:");
        expect(text).toContain("Done.");
        expect(text).toContain("Remaining manual steps:");
        expect(text).toContain("1. Add chart color tokens to global.css:");
      } finally {
        process.chdir(cwd);
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("sets exit code on command failure", async () => {
      const component = createComponentWithInstall({
        mode: "command",
        source: "shadcn",
        template: "shadcn@latest add button",
      });
      const { client } = createMockClient(async () => component);
      const executor = createMockExecutor({ success: false, exitCode: 1, error: "Network error" });

      const cwd = process.cwd();
      const tempDir = await mkdtemp(join(tmpdir(), "agent-ui-add-fail-"));

      try {
        await writeFile(join(tempDir, "components.json"), "{}\n", "utf8");
        process.chdir(tempDir);

        const output = await captureCommandOutput(async () => {
          await runAddCommand("core-button", { yes: true, executor }, client);
        });

        expect(output.errors).toContain("Command failed with exit code 1");
        expect(output.errors).toContain("Network error");
        expect(output.exitCode).toBe(1);
      } finally {
        process.chdir(cwd);
        await rm(tempDir, { recursive: true, force: true });
      }
    });

    it("does not execute for manual-only mode", async () => {
      const component = createComponentWithInstall({
        mode: "manual",
        source: "manual",
        steps: ["Copy component file", "Add styles"],
      });
      const { client } = createMockClient(async () => component);
      const executor = createMockExecutor({ success: true, exitCode: 0 });

      const output = await captureCommandOutput(async () => {
        await runAddCommand("custom-component", { yes: true, executor }, client);
      });

      const text = output.logs.join("\n");
      expect(text).toContain("install.mode: manual");
      expect(text).toContain("manual.steps:");
      expect(executor).toHaveBeenCalledTimes(0);
    });

    it("reports willExecute=true in JSON output", async () => {
      const component = createComponentWithInstall({
        mode: "command",
        source: "shadcn",
        template: "shadcn@latest add button",
      });
      const { client } = createMockClient(async () => component);

      const output = await captureCommandOutput(async () => {
        await runAddCommand("core-button", { json: true, yes: true }, client);
      });

      const payload = JSON.parse(output.logs[0] ?? "{}");
      expect(payload.willExecute).toBe(true);
    });
  });

  describe("--dry-run flag", () => {
    it("prints command without executing even with --yes", async () => {
      const component = createComponentWithInstall({
        mode: "command",
        source: "shadcn",
        template: "shadcn@latest add button",
      });
      const { client } = createMockClient(async () => component);
      const executor = createMockExecutor({ success: true, exitCode: 0 });

      const output = await captureCommandOutput(async () => {
        await runAddCommand("core-button", { yes: true, dryRun: true, executor }, client);
      });

      const text = output.logs.join("\n");
      expect(text).toContain("command: npx shadcn@latest add button");
      expect(text).not.toContain("Running:");
      expect(executor).toHaveBeenCalledTimes(0);
    });

    it("reports willExecute=false in JSON output when dry-run is set", async () => {
      const component = createComponentWithInstall({
        mode: "command",
        source: "shadcn",
        template: "shadcn@latest add button",
      });
      const { client } = createMockClient(async () => component);

      const output = await captureCommandOutput(async () => {
        await runAddCommand("core-button", { json: true, yes: true, dryRun: true }, client);
      });

      const payload = JSON.parse(output.logs[0] ?? "{}");
      expect(payload.willExecute).toBe(false);
    });
  });
});
