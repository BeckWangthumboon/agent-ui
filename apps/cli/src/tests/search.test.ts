import { describe, expect, it } from "bun:test";

import { parsePositiveInteger, runSearchCommand } from "../search";
import { captureCommandOutput, createMockClient, createSampleComponent } from "./helpers";

describe("runSearchCommand", () => {
  it("prints ranked text results", async () => {
    const component = createSampleComponent();
    const { client, calls } = createMockClient(async () => [component]);

    const output = await captureCommandOutput(async () => {
      await runSearchCommand("button", { limit: 10 }, client);
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.args).toEqual({
      query: "button",
      filters: undefined,
    });

    expect(output.logs.join("\n")).toContain("1. Button (core-button)");
    expect(output.logs.join("\n")).toContain("framework: react | styling: tailwind | motion: minimal");
    expect(output.logs.join("\n")).toContain("dependencies: class-variance-authority (runtime)");
    expect(output.logs.join("\n")).toContain("source: https://ui.shadcn.com/docs/components/button");
    expect(output.errors).toHaveLength(0);
  });

  it("prints json payload in --json mode", async () => {
    const component = createSampleComponent();
    const { client } = createMockClient(async () => [component]);

    const output = await captureCommandOutput(async () => {
      await runSearchCommand("button", { limit: 5, json: true }, client);
    });

    expect(output.logs).toHaveLength(1);

    const payload = JSON.parse(output.logs[0] ?? "{}");
    expect(payload.query).toBe("button");
    expect(payload.candidateCount).toBe(1);
    expect(payload.resultCount).toBe(1);
    expect(payload.results[0].id).toBe("core-button");
  });

  it("rejects empty queries", async () => {
    const { client, calls } = createMockClient(async () => []);

    const output = await captureCommandOutput(async () => {
      await runSearchCommand("   ", { limit: 10 }, client);
    });

    expect(calls).toHaveLength(0);
    expect(output.errors).toContain("Search query must be non-empty.");
    expect(output.exitCode).toBe(1);
  });
});

describe("parsePositiveInteger", () => {
  it("parses positive integers", () => {
    expect(parsePositiveInteger("12")).toBe(12);
  });

  it("throws on invalid input", () => {
    expect(() => parsePositiveInteger("0")).toThrow("Expected a positive integer");
    expect(() => parsePositiveInteger("abc")).toThrow("Expected a positive integer");
  });
});
