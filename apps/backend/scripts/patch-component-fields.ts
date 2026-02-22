import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

import { ComponentCodeFileSchema, ComponentInstallSchema } from "../../../shared/component-schema";

type PatchArgs = {
  componentId: string;
  install?: unknown;
  clearInstall?: boolean;
  example?: { path: string; content: string };
  clearExample?: boolean;
};

const patchInstallExample = makeFunctionReference<"mutation">("admin:patchInstallExample");

function parseArgs(rawArgs: string[]) {
  const args = new Map<string, string>();
  for (let i = 0; i < rawArgs.length; i += 1) {
    const token = rawArgs[i];
    if (!token?.startsWith("--")) {
      continue;
    }

    const next = rawArgs[i + 1];
    if (!next || next.startsWith("--")) {
      args.set(token, "true");
      continue;
    }

    args.set(token, next);
    i += 1;
  }
  return args;
}

async function maybeReadJson(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed);
  }

  const filePath = resolve(process.cwd(), trimmed);
  const contents = await readFile(filePath, "utf8");
  return JSON.parse(contents);
}

async function run() {
  const argMap = parseArgs(process.argv.slice(2));

  const componentId = argMap.get("--id");
  if (!componentId) {
    throw new Error("Missing required --id <componentId>");
  }

  const clearInstall = argMap.get("--clear-install") === "true";
  const clearExample = argMap.get("--clear-example") === "true";

  const installRaw = await maybeReadJson(argMap.get("--install-json") ?? argMap.get("--install-file"));
  const install = installRaw ? ComponentInstallSchema.parse(installRaw) : undefined;

  const exampleFile = argMap.get("--example-file");
  const examplePath = argMap.get("--example-path") ?? "example.tsx";

  let example: PatchArgs["example"] | undefined;
  if (exampleFile) {
    const content = await readFile(resolve(process.cwd(), exampleFile), "utf8");
    example = ComponentCodeFileSchema.parse({ path: examplePath, content });
  }

  if (install && clearInstall) {
    throw new Error("Use either --install-json/--install-file OR --clear-install, not both");
  }

  if (example && clearExample) {
    throw new Error("Use either --example-file OR --clear-example, not both");
  }

  if (!install && !clearInstall && !example && !clearExample) {
    throw new Error("Nothing to patch. Pass install and/or example flags.");
  }

  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    throw new Error("CONVEX_URL is required");
  }

  const client = new ConvexHttpClient(convexUrl);

  const payload: PatchArgs = {
    componentId,
    ...(install ? { install } : {}),
    ...(clearInstall ? { clearInstall: true } : {}),
    ...(example ? { example } : {}),
    ...(clearExample ? { clearExample: true } : {}),
  };

  const result = await client.mutation(patchInstallExample, payload);
  console.log(JSON.stringify(result, null, 2));
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
