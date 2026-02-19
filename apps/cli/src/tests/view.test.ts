import { describe, expect, it } from "bun:test";

import { runViewCommand } from "../view";
import { captureCommandOutput, createMockClient, createSampleViewComponent } from "./helpers";

describe("runViewCommand", () => {
  it("prints concise output by default", async () => {
    const component = createSampleViewComponent();
    const { client } = createMockClient(async () => component);

    const output = await captureCommandOutput(async () => {
      await runViewCommand("core-button", {}, client);
    });

    const text = output.logs.join("\n");
    expect(text).toContain("Button (core-button)");
    expect(text).toContain("intent: Trigger user actions.");
    expect(text).toContain("stack: framework=react | styling=tailwind | motion=minimal");
    expect(text).toContain("source: https://ui.shadcn.com/docs/components/button");
    expect(text).not.toContain("source.library:");
    expect(text).not.toContain("--- code:");
  });

  it("prints expanded metadata in --verbose mode", async () => {
    const component = createSampleViewComponent();
    const { client } = createMockClient(async () => component);

    const output = await captureCommandOutput(async () => {
      await runViewCommand("core-button", { verbose: true }, client);
    });

    const text = output.logs.join("\n");
    expect(text).toContain("source.library: shadcn/ui");
    expect(text).toContain("source.repo: https://github.com/shadcn-ui/ui");
    expect(text).toContain("source.author: shadcn");
    expect(text).toContain("source.license: MIT");
    expect(text).toContain("dependencies: class-variance-authority (runtime)");
    expect(text).not.toContain("topics:");
    expect(text).not.toContain("capabilities:");
    expect(text).not.toContain("synonyms:");
    expect(text).toContain("code.entryFile: button.tsx");
    expect(text).toContain("code.fileCount: 2");
  });

  it("prints entry file first when --code is enabled", async () => {
    const component = createSampleViewComponent();
    const { client } = createMockClient(async () => component);

    const output = await captureCommandOutput(async () => {
      await runViewCommand("core-button", { code: true }, client);
    });

    const codeHeaders = output.logs.filter((line) => line.startsWith("--- code:"));
    expect(codeHeaders).toEqual(["--- code: button.tsx ---", "--- code: utils.ts ---"]);
  });

  it("prints full json in --json mode", async () => {
    const component = createSampleViewComponent();
    const { client } = createMockClient(async () => component);

    const output = await captureCommandOutput(async () => {
      await runViewCommand("core-button", { json: true }, client);
    });

    expect(output.logs).toHaveLength(1);
    const payload = JSON.parse(output.logs[0] ?? "{}");
    expect(payload.id).toBe("core-button");
    expect(payload.code.entryFile).toBe("button.tsx");
    expect(payload.capabilities).toBeUndefined();
    expect(payload.synonyms).toBeUndefined();
    expect(payload.topics).toBeUndefined();
  });

  it("returns not found for missing ids", async () => {
    const { client } = createMockClient(async () => null);

    const output = await captureCommandOutput(async () => {
      await runViewCommand("missing", {}, client);
    });

    expect(output.errors).toContain("Component not found: missing");
    expect(output.exitCode).toBe(1);
  });

  it("rejects empty ids", async () => {
    const { client } = createMockClient(async () => null);

    const output = await captureCommandOutput(async () => {
      await runViewCommand("   ", {}, client);
    });

    expect(output.errors).toContain("Component id must be non-empty.");
    expect(output.exitCode).toBe(1);
  });
});
