import { describe, expect, it } from "bun:test";

import { parsePositiveInteger, runSearchCommand } from "../search";
import { CLI_NAME } from "../constants";
import {
  captureCommandOutput,
  createMockClient,
  createSampleComponentMetadata,
  createSampleSearchCandidate,
} from "./helpers";

describe("runSearchCommand", () => {
  it("prints ranked text results", async () => {
    const candidate = createSampleSearchCandidate();
    const metadata = createSampleComponentMetadata();
    let callIndex = 0;
    const { client, calls } = createMockClient(async () => {
      callIndex += 1;
      if (callIndex === 1) {
        return [candidate];
      }

      return [metadata];
    });

    const output = await captureCommandOutput(async () => {
      await runSearchCommand("button", { limit: 10 }, client);
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]?.args).toEqual({
      query: "button",
      filters: undefined,
    });
    expect(calls[1]?.args).toEqual({
      ids: [candidate.id],
    });

    expect(output.logs.join("\n")).toContain("1. Button (core-button)");
    expect(output.logs.join("\n")).toContain(
      "framework: react | styling: tailwind | motion: minimal",
    );
    expect(output.logs.join("\n")).toContain("dependencies: class-variance-authority (runtime)");
    expect(output.logs.join("\n")).toContain(
      "source: https://ui.shadcn.com/docs/components/button",
    );
    expect(output.errors).toHaveLength(0);
  });

  it("prints json payload in --json mode", async () => {
    const candidate = createSampleSearchCandidate();
    const metadata = createSampleComponentMetadata();
    let callIndex = 0;
    const { client } = createMockClient(async () => {
      callIndex += 1;
      return callIndex === 1 ? [candidate] : [metadata];
    });

    const output = await captureCommandOutput(async () => {
      await runSearchCommand("button", { limit: 5, json: true }, client);
    });

    expect(output.logs).toHaveLength(1);

    const payload = JSON.parse(output.logs[0] ?? "{}");
    expect(payload.query).toBe("button");
    expect(payload.mode).toBe("strict");
    expect(payload.relaxed).toBe(false);
    expect(payload.strictResultCount).toBe(1);
    expect(payload.candidateCount).toBe(1);
    expect(payload.resultCount).toBe(1);
    expect(payload.filters.motion).toBeUndefined();
    expect(payload.filters.primitiveLibrary).toBeUndefined();
    expect(payload.results[0].id).toBe("core-button");
  });

  it("prints strict miss guidance with catalog coverage hint", async () => {
    const candidate = createSampleSearchCandidate();
    const { client, calls } = createMockClient(async () => {
      return [candidate];
    });

    const output = await captureCommandOutput(async () => {
      await runSearchCommand("b", { limit: 10 }, client);
    });

    expect(calls).toHaveLength(1);
    expect(output.logs.join("\n")).toContain('No matches in current catalog for "b".');
    expect(output.logs.join("\n")).toContain(`Try: ${CLI_NAME} search "b" --relax`);
    expect(output.logs.join("\n")).toContain(`Try: ${CLI_NAME} search "<broader term>" --limit 20`);
    expect(output.logs.join("\n")).toContain(
      "This component may not exist in the current catalog.",
    );
  });

  it("shows relaxed best-effort results when --relax is enabled", async () => {
    const candidate = createSampleSearchCandidate();
    const metadata = createSampleComponentMetadata();
    let callIndex = 0;
    const { client, calls } = createMockClient(async () => {
      callIndex += 1;
      return callIndex === 1 ? [candidate] : [metadata];
    });

    const output = await captureCommandOutput(async () => {
      await runSearchCommand("b", { limit: 10, relax: true }, client);
    });

    expect(calls).toHaveLength(2);
    expect(output.logs.join("\n")).toContain(
      "No strict matches; showing relaxed best-effort results.",
    );
    expect(output.logs.join("\n")).toContain("1. Button (core-button)");
    expect(output.logs.join("\n")).toContain(
      "Tip: refine with --framework/--styling/--motion for higher precision.",
    );
  });

  it("includes relaxed metadata in --json mode", async () => {
    const candidate = createSampleSearchCandidate();
    const metadata = createSampleComponentMetadata();
    let callIndex = 0;
    const { client } = createMockClient(async () => {
      callIndex += 1;
      return callIndex === 1 ? [candidate] : [metadata];
    });

    const output = await captureCommandOutput(async () => {
      await runSearchCommand("b", { limit: 5, json: true, relax: true }, client);
    });

    const payload = JSON.parse(output.logs[0] ?? "{}");
    expect(payload.mode).toBe("relaxed");
    expect(payload.relaxed).toBe(true);
    expect(payload.strictResultCount).toBe(0);
    expect(payload.resultCount).toBe(1);
    expect(payload.results[0].id).toBe("core-button");
  });

  it("uses default limit of 5 when limit is not provided", async () => {
    const candidates = Array.from({ length: 6 }, (_, index) => ({
      ...createSampleSearchCandidate(),
      id: `core-button-${index + 1}`,
      name: `Button ${index + 1}`,
      intent: `Button intent ${index + 1}`,
    }));
    const metadata = candidates.map((candidate) => ({
      ...createSampleComponentMetadata(),
      id: candidate.id,
      name: candidate.name,
    }));
    let callIndex = 0;
    const { client, calls } = createMockClient(async () => {
      callIndex += 1;
      return callIndex === 1 ? candidates : metadata;
    });

    await captureCommandOutput(async () => {
      await runSearchCommand("button", {}, client);
    });

    expect(calls).toHaveLength(2);
    expect((calls[1]?.args as { ids?: string[] })?.ids).toHaveLength(5);
  });

  it("supports list filters for motion and primitive library", async () => {
    const first = {
      ...createSampleSearchCandidate(),
      primitiveLibrary: "radix" as const,
    };
    const second = {
      ...createSampleSearchCandidate(),
      id: "core-dialog",
      name: "Dialog",
      motionLevel: "heavy" as const,
      primitiveLibrary: "other" as const,
    };
    const metadata = [
      {
        ...createSampleComponentMetadata(),
        primitiveLibrary: "radix",
      },
      {
        ...createSampleComponentMetadata(),
        id: "core-dialog",
        name: "Dialog",
        motionLevel: "heavy" as const,
        primitiveLibrary: "other",
        source: { url: "https://example.com/dialog" },
      },
    ];
    let callIndex = 0;
    const { client, calls } = createMockClient(async () => {
      callIndex += 1;
      return callIndex === 1 ? [first, second] : metadata;
    });

    const output = await captureCommandOutput(async () => {
      await runSearchCommand(
        "button",
        {
          limit: 10,
          motion: ["none", "minimal"],
          primitiveLibrary: ["radix", "base-ui"],
          json: true,
        },
        client,
      );
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]?.args).toEqual({
      query: "button",
      filters: {
        motion: ["none", "minimal"],
        primitiveLibrary: ["radix", "base-ui"],
      },
    });

    const payload = JSON.parse(output.logs[0] ?? "{}");
    expect(payload.candidateCount).toBe(2);
    expect(payload.strictResultCount).toBe(2);
    expect(payload.resultCount).toBe(2);
    expect(payload.results[0].id).toBe("core-button");
    expect(payload.filters.motion).toEqual(["none", "minimal"]);
    expect(payload.filters.primitiveLibrary).toEqual(["radix", "base-ui"]);
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
