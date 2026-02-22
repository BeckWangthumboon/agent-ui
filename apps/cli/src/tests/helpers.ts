import type { ConvexHttpClient } from "convex/browser";
import type { ComponentDocument, ComponentInstall } from "../../../../shared/component-schema";

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
    primitiveLibrary: "none",
    animationLibrary: "none",
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
    example: {
      path: "examples/button-demo.tsx",
      content: "export function ButtonDemo() { return <Button />; }",
    },
  };
}

export type SearchCandidate = Pick<
  ComponentDocument,
  | "id"
  | "name"
  | "framework"
  | "styling"
  | "intent"
  | "capabilities"
  | "synonyms"
  | "topics"
  | "motionLevel"
  | "primitiveLibrary"
  | "animationLibrary"
>;

export function createSampleSearchCandidate(): SearchCandidate {
  const component = createSampleComponent();
  return {
    id: component.id,
    name: component.name,
    framework: component.framework,
    styling: component.styling,
    intent: component.intent,
    capabilities: component.capabilities,
    synonyms: component.synonyms,
    topics: component.topics,
    motionLevel: component.motionLevel,
    primitiveLibrary: component.primitiveLibrary ?? "none",
    animationLibrary: component.animationLibrary ?? "none",
  };
}

export type ComponentMetadata = {
  id: string;
  name: string;
  source: ComponentDocument["source"];
  framework: ComponentDocument["framework"];
  styling: ComponentDocument["styling"];
  dependencies: ComponentDocument["dependencies"];
  install?: ComponentInstall;
  intent: string;
  motionLevel: ComponentDocument["motionLevel"];
  primitiveLibrary: string;
  animationLibrary: string;
};

export function createSampleComponentMetadata(): ComponentMetadata {
  const component = createSampleComponent();
  return {
    id: component.id,
    name: component.name,
    source: component.source,
    framework: component.framework,
    styling: component.styling,
    dependencies: component.dependencies,
    install: {
      mode: "command",
      source: "manual",
      template: "shadcn@latest add button",
    },
    intent: component.intent,
    motionLevel: component.motionLevel,
    primitiveLibrary: component.primitiveLibrary ?? "none",
    animationLibrary: component.animationLibrary ?? "none",
  };
}

export type ViewComponent = {
  schemaVersion: number;
  id: string;
  name: string;
  source: ComponentDocument["source"];
  framework: ComponentDocument["framework"];
  styling: ComponentDocument["styling"];
  dependencies: ComponentDocument["dependencies"];
  intent: string;
  motionLevel: ComponentDocument["motionLevel"];
  primitiveLibrary: string;
  animationLibrary: string;
  constraints?: Record<string, never>;
  codeSummary: {
    entryFile: string;
    fileCount: number;
  };
  code?: ComponentDocument["code"];
  example?: ComponentDocument["example"];
};

export function createSampleViewComponent(): ViewComponent {
  const component = createSampleComponent();

  return {
    schemaVersion: 4,
    id: component.id,
    name: component.name,
    source: component.source,
    framework: component.framework,
    styling: component.styling,
    dependencies: component.dependencies,
    intent: component.intent,
    motionLevel: component.motionLevel,
    primitiveLibrary: component.primitiveLibrary ?? "none",
    animationLibrary: component.animationLibrary ?? "none",
    constraints: component.constraints,
    codeSummary: {
      entryFile: component.code.entryFile,
      fileCount: component.code.files.length,
    },
    code: component.code,
    example: component.example,
  };
}
