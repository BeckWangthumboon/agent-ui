import type { ConvexHttpClient } from "convex/browser";
import type { ComponentDocument } from "../../../../shared/component-schema";

export type QueryCall = {
  functionRef: unknown;
  args: unknown;
};

export function createMockClient<TResult>(
  resolver: (call: QueryCall) => TResult | Promise<TResult>,
): { client: ConvexHttpClient; calls: QueryCall[] } {
  const calls: QueryCall[] = [];

  const client = {
    query: async (functionRef: unknown, args: unknown) => {
      const call = { functionRef, args };
      calls.push(call);
      return resolver(call);
    },
  } as unknown as ConvexHttpClient;

  return {
    client,
    calls,
  };
}

export type CapturedOutput = {
  logs: string[];
  errors: string[];
  exitCode: number | undefined;
};

export async function captureCommandOutput(run: () => Promise<void>): Promise<CapturedOutput> {
  const logs: string[] = [];
  const errors: string[] = [];

  const originalLog = console.log;
  const originalError = console.error;
  const originalExitCode = process.exitCode;

  process.exitCode = 0;
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
  };

  try {
    await run();
    return {
      logs,
      errors,
      exitCode: process.exitCode,
    };
  } finally {
    console.log = originalLog;
    console.error = originalError;
    process.exitCode = originalExitCode === undefined ? 0 : originalExitCode;
  }
}

export function createSampleComponent(): ComponentDocument {
  return {
    schemaVersion: 2,
    id: "core-button",
    name: "Button",
    source: {
      library: "shadcn/ui",
      repo: "https://github.com/shadcn-ui/ui",
      author: "shadcn",
      license: "MIT",
      url: "https://ui.shadcn.com/docs/components/button",
    },
    framework: "react",
    styling: "tailwind",
    dependencies: [
      {
        name: "class-variance-authority",
        kind: "runtime",
      },
    ],
    intent: "Trigger user actions.",
    capabilities: ["click", "submit"],
    synonyms: ["cta button"],
    topics: ["action"],
    motionLevel: "minimal",
    constraints: {},
    code: {
      entryFile: "button.tsx",
      files: [
        {
          path: "utils.ts",
          content: "export const helper = 1;",
        },
        {
          path: "button.tsx",
          content: "export function Button() { return null; }",
        },
      ],
    },
  };
}

export type ViewComponent = Omit<ComponentDocument, "capabilities" | "synonyms" | "topics">;

export function createSampleViewComponent(): ViewComponent {
  const { capabilities: _capabilities, synonyms: _synonyms, topics: _topics, ...component } =
    createSampleComponent();
  return component;
}
