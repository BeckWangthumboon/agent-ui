import { describe, expect, it } from "bun:test";

import { parseArgs } from "../evalSearch";

describe("parseArgs", () => {
  it("uses defaults when no args are provided", () => {
    const parsed = parseArgs([]);

    expect(parsed.limit).toBe(5);
    expect(parsed.relax).toBe(false);
    expect(parsed.debug).toBe(false);
    expect(parsed.useProjectConfig).toBe(false);
    expect(parsed.out).toBeUndefined();
    expect(parsed.queries.length).toBeGreaterThan(0);
  });

  it("parses debug and output flags", () => {
    const parsed = parseArgs([
      "--debug",
      "--use-project-config",
      "--out",
      "data/evals/search/custom.jsonl",
      "button",
    ]);

    expect(parsed.debug).toBe(true);
    expect(parsed.useProjectConfig).toBe(true);
    expect(parsed.out).toBe("data/evals/search/custom.jsonl");
    expect(parsed.queries).toEqual(["button"]);
  });
});
