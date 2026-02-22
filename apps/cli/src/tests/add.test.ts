import { describe, expect, it } from "bun:test";

import type { ComponentInstall } from "../../../../shared/component-schema";
import { runAddCommand } from "../add";
import { captureCommandOutput, createMockClient, createSampleComponentMetadata } from "./helpers";

function createComponentWithInstall(install: ComponentInstall) {
  return {
    ...createSampleComponentMetadata(),
    install,
  };
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
      "Try: component-search view <id> --code and apply changes manually.",
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
});
