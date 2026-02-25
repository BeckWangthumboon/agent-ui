import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ConvexHttpClient } from "convex/browser";

import { api } from "../../backend/convex/_generated/api";
import type { ComponentInstall } from "../../../shared/component-schema";
import type { PackageManager } from "./config.js";
import { CLI_NAME } from "./constants.js";

const DEFAULT_PACKAGE_MANAGER: PackageManager = "npx";

export type AddCliOptions = {
  packageManager?: PackageManager;
  json?: boolean;
  yes?: boolean;
  dryRun?: boolean;
};

type InstallRenderResult = {
  command: string | null;
  steps: string[];
};

export type ExecutionResult = {
  success: boolean;
  exitCode: number;
  error?: string;
};

function assertExecutionResult(value: unknown): asserts value is ExecutionResult {
  if (typeof value !== "object" || value === null) {
    throw new Error("Invalid ExecutionResult: expected object");
  }
  const result = value as Record<string, unknown>;
  if (typeof result.success !== "boolean") {
    throw new Error("Invalid ExecutionResult: success must be boolean");
  }
  if (typeof result.exitCode !== "number") {
    throw new Error("Invalid ExecutionResult: exitCode must be number");
  }
  if (result.error !== undefined && typeof result.error !== "string") {
    throw new Error("Invalid ExecutionResult: error must be string or undefined");
  }
}

export type CommandExecutor = (command: string) => Promise<ExecutionResult>;

type RunAddCommandOptions = AddCliOptions & {
  executor?: CommandExecutor;
};

export async function runAddCommand(
  id: string,
  options: RunAddCommandOptions,
  client: ConvexHttpClient,
) {
  const normalizedId = id.trim();

  if (normalizedId.length === 0) {
    console.error("Component id must be non-empty.");
    process.exitCode = 1;
    return;
  }

  const component = await client.query(api.components.getMetadataById, {
    id: normalizedId,
  });

  if (!component) {
    console.error(`Component not found: ${normalizedId}`);
    process.exitCode = 1;
    return;
  }

  if (!component.install) {
    console.error(`Install instructions are unavailable for ${component.id}.`);
    console.error(`Try: ${CLI_NAME} view <id> --code and apply changes manually.`);
    process.exitCode = 1;
    return;
  }

  const packageManager = options.packageManager ?? DEFAULT_PACKAGE_MANAGER;
  const rendered = renderInstall(component.install, packageManager);
  const shouldExecute = options.yes && !options.dryRun && rendered.command;
  const executor = options.executor ?? spawnCommand;

  if (options.json) {
    outputJson(
      component.id,
      component.name,
      packageManager,
      component.install,
      rendered,
      !!shouldExecute,
    );
    return;
  }

  console.log(`${component.name} (${component.id})`);

  if (shouldExecute && rendered.command) {
    const initState = ensureShadcnProjectInitialized(component.install);
    if (!initState.ok) {
      process.exitCode = 1;
      return;
    }

    console.log(`Running: ${rendered.command}`);
    const result = await executor(rendered.command);
    assertExecutionResult(result);

    if (!result.success) {
      console.error(`Command failed with exit code ${result.exitCode}`);
      if (result.error) {
        console.error(result.error);
      }
      process.exitCode = 1;
      return;
    }

    console.log("Done.");

    if (rendered.steps.length > 0) {
      console.log("Remaining manual steps:");
      for (const [index, step] of rendered.steps.entries()) {
        console.log(`${index + 1}. ${step}`);
      }
    }
    return;
  }

  console.log(`install.mode: ${component.install.mode}`);
  console.log(`install.source: ${component.install.source}`);

  if (rendered.command) {
    console.log(`command: ${rendered.command}`);
  }

  if (rendered.steps.length > 0) {
    console.log("manual.steps:");
    for (const [index, step] of rendered.steps.entries()) {
      console.log(`${index + 1}. ${step}`);
    }
  }
}

function ensureShadcnProjectInitialized(install: ComponentInstall) {
  if (install.source !== "shadcn") {
    return { ok: true };
  }

  const componentsJsonPath = join(process.cwd(), "components.json");
  if (existsSync(componentsJsonPath)) {
    return { ok: true };
  }

  console.error(
    "No shadcn-initialized React project detected in current directory (components.json not found).",
  );
  console.error(
    "Run `npx shadcn@latest init -d -y` (or the equivalent bunx/pnpm/yarn dlx command), then rerun this command.",
  );
  return { ok: false };
}

function outputJson(
  id: string,
  name: string,
  packageManager: PackageManager,
  install: ComponentInstall,
  rendered: InstallRenderResult,
  willExecute: boolean,
) {
  console.log(
    JSON.stringify(
      {
        id,
        name,
        packageManager,
        mode: install.mode,
        source: install.source,
        renderedCommand: rendered.command,
        steps: rendered.steps,
        willExecute,
        install,
      },
      null,
      2,
    ),
  );
}

async function spawnCommand(command: string): Promise<ExecutionResult> {
  if (!command.trim()) {
    return { success: false, exitCode: 1, error: "Empty command" };
  }

  try {
    const subprocess = Bun.spawn(["sh", "-c", command], {
      stdout: "inherit",
      stderr: "inherit",
    });
    const exitCode = await subprocess.exited;

    if (exitCode === 0) {
      return { success: true, exitCode };
    }

    return {
      success: false,
      exitCode,
      error: `Command exited with code ${exitCode}: ${command}`,
    };
  } catch (error) {
    return {
      success: false,
      exitCode: 1,
      error: `Failed to start command: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function renderInstall(install: ComponentInstall, packageManager: PackageManager) {
  if (install.mode === "command") {
    return {
      command: toRunnerCommand(install.template, packageManager),
      steps: [],
    };
  }

  if (install.mode === "manual") {
    return {
      command: null,
      steps: install.steps,
    };
  }

  return {
    command: toRunnerCommand(install.template, packageManager),
    steps: install.steps,
  };
}

function toRunnerCommand(template: string, packageManager: PackageManager) {
  const normalizedTemplate = template.trim();

  if (packageManager === "npx") {
    return `npx ${normalizedTemplate}`;
  }

  if (packageManager === "bunx") {
    return `bunx ${normalizedTemplate}`;
  }

  if (packageManager === "pnpm") {
    return `pnpm dlx ${normalizedTemplate}`;
  }

  return `yarn dlx ${normalizedTemplate}`;
}
