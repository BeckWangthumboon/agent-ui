import { describe, expect, it } from "bun:test";

import { runViewCommand } from "../view";
import { captureCommandOutput, createMockClient, createSampleViewComponent } from "./helpers";

describe("runViewCommand", () => {
  it("prints concise output by default", async () => {
    const component = createSampleViewComponent();
    const { client, calls } = createMockClient(async () => component);

    const output = await captureCommandOutput(async () => {
      await runViewCommand("core-button", {}, client);
    });

    const text = output.logs.join("\n");
    expect(text).toContain("Button (core-button)");
    expect(text).toContain("stack: framework=react | styling=tailwind | motion=minimal");
    expect(text).toContain("source: https://ui.shadcn.com/docs/components/button");
    expect(text).not.toContain("libraries:");
    expect(text).not.toContain("source.library:");
    expect(text).not.toContain("--- code:");
    expect(text).not.toContain("--- example:");
    expect(calls[0]?.args).toMatchObject({
      includeCode: false,
      includeExample: false,
    });
  });

  it("prints libraries in non-verbose mode when library metadata is set", async () => {
    const component = createSampleViewComponent();
    component.primitiveLibrary = "radix";
    component.animationLibrary = "framer-motion";
    const { client } = createMockClient(async () => component);

    const output = await captureCommandOutput(async () => {
      await runViewCommand("core-button", {}, client);
    });

    const text = output.logs.join("\n");
    expect(text).toContain("libraries: primitive=radix | animation=framer-motion");
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

  it("prints metadata-only json in --json mode", async () => {
    const component = createSampleViewComponent();
    const { client, calls } = createMockClient(async () => component);

    const output = await captureCommandOutput(async () => {
      await runViewCommand("core-button", { json: true }, client);
    });

    expect(output.logs).toHaveLength(1);
    const payload = JSON.parse(output.logs[0] ?? "{}");
    expect(payload.included).toEqual({
      code: false,
      verbose: false,
      example: false,
    });
    expect(payload.metadata.id).toBe("core-button");
    expect(payload.metadata.source.url).toBe("https://ui.shadcn.com/docs/components/button");
    expect(payload.metadata.intent).toBeUndefined();
    expect(payload.metadata.primitiveLibrary).toBeUndefined();
    expect(payload.metadata.animationLibrary).toBeUndefined();
    expect(payload.verbose).toBeUndefined();
    expect(payload.code).toBeUndefined();
    expect(payload.example).toBeUndefined();
    expect(calls[0]?.args).toMatchObject({
      includeCode: false,
      includeExample: false,
    });
  });

  it("prints metadata + code json in --json --code mode", async () => {
    const component = createSampleViewComponent();
    const { client, calls } = createMockClient(async () => component);

    const output = await captureCommandOutput(async () => {
      await runViewCommand("core-button", { json: true, code: true }, client);
    });

    expect(output.logs).toHaveLength(1);
    const payload = JSON.parse(output.logs[0] ?? "{}");
    expect(payload.included).toEqual({
      code: true,
      verbose: false,
      example: false,
    });
    expect(payload.metadata.id).toBe("core-button");
    expect(payload.code.entryFile).toBe("button.tsx");
    expect(payload.verbose).toBeUndefined();
    expect(payload.example).toBeUndefined();
    expect(calls[0]?.args).toMatchObject({
      includeCode: true,
      includeExample: false,
    });
  });

  it("prints metadata + verbose json in --json --verbose mode", async () => {
    const component = createSampleViewComponent();
    const { client, calls } = createMockClient(async () => component);

    const output = await captureCommandOutput(async () => {
      await runViewCommand("core-button", { json: true, verbose: true }, client);
    });

    expect(output.logs).toHaveLength(1);
    const payload = JSON.parse(output.logs[0] ?? "{}");
    expect(payload.included).toEqual({
      code: false,
      verbose: true,
      example: false,
    });
    expect(payload.metadata.id).toBe("core-button");
    expect(payload.verbose.source.library).toBe("shadcn/ui");
    expect(payload.verbose.codeSummary.entryFile).toBe("button.tsx");
    expect(payload.code).toBeUndefined();
    expect(payload.example).toBeUndefined();
    expect(calls[0]?.args).toMatchObject({
      includeCode: false,
      includeExample: false,
    });
  });

  it("prints full payload in --json --verbose --code mode", async () => {
    const component = createSampleViewComponent();
    const { client, calls } = createMockClient(async () => component);

    const output = await captureCommandOutput(async () => {
      await runViewCommand("core-button", { json: true, verbose: true, code: true }, client);
    });

    expect(output.logs).toHaveLength(1);
    const payload = JSON.parse(output.logs[0] ?? "{}");
    expect(payload.included).toEqual({
      code: true,
      verbose: true,
      example: false,
    });
    expect(payload.metadata.id).toBe("core-button");
    expect(payload.verbose.dependencies[0].name).toBe("class-variance-authority");
    expect(payload.code.files).toHaveLength(2);
    expect(payload.example).toBeUndefined();
    expect(calls[0]?.args).toMatchObject({
      includeCode: true,
      includeExample: false,
    });
  });

  it("prints canonical usage example in --example mode", async () => {
    const component = createSampleViewComponent();
    const { client, calls } = createMockClient(async () => component);

    const output = await captureCommandOutput(async () => {
      await runViewCommand("core-button", { example: true }, client);
    });

    const text = output.logs.join("\n");
    expect(text).toContain("--- example: examples/button-demo.tsx ---");
    expect(text).toContain("export function ButtonDemo()");
    expect(calls[0]?.args).toMatchObject({
      includeCode: false,
      includeExample: true,
    });
  });

  it("includes canonical usage example in --json --example mode", async () => {
    const component = createSampleViewComponent();
    const { client, calls } = createMockClient(async () => component);

    const output = await captureCommandOutput(async () => {
      await runViewCommand("core-button", { json: true, example: true }, client);
    });

    expect(output.logs).toHaveLength(1);
    const payload = JSON.parse(output.logs[0] ?? "{}");
    expect(payload.included).toEqual({
      code: false,
      verbose: false,
      example: true,
    });
    expect(payload.example.path).toBe("examples/button-demo.tsx");
    expect(payload.code).toBeUndefined();
    expect(calls[0]?.args).toMatchObject({
      includeCode: false,
      includeExample: true,
    });
  });

  it("includes libraries in metadata for non-verbose json when library metadata is set", async () => {
    const component = createSampleViewComponent();
    component.primitiveLibrary = "radix";
    component.animationLibrary = "framer-motion";
    const { client } = createMockClient(async () => component);

    const output = await captureCommandOutput(async () => {
      await runViewCommand("core-button", { json: true }, client);
    });

    expect(output.logs).toHaveLength(1);
    const payload = JSON.parse(output.logs[0] ?? "{}");
    expect(payload.metadata.primitiveLibrary).toBe("radix");
    expect(payload.metadata.animationLibrary).toBe("framer-motion");
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
