import type { ConvexHttpClient } from "convex/browser";

import { api } from "../../backend/convex/_generated/api";
import type { ComponentInstall } from "../../../shared/component-schema";
import type { PackageManager } from "./config.js";

const DEFAULT_PACKAGE_MANAGER: PackageManager = "npx";

export type AddCliOptions = {
  packageManager?: PackageManager;
  json?: boolean;
};

type InstallRenderResult = {
  command: string | null;
  steps: string[];
};

export async function runAddCommand(
  id: string,
  options: AddCliOptions,
  client: ConvexHttpClient,
): Promise<void> {
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
    console.error("Try: component-search view <id> --code and apply changes manually.");
    process.exitCode = 1;
    return;
  }

  const packageManager = options.packageManager ?? DEFAULT_PACKAGE_MANAGER;
  const rendered = renderInstall(component.install, packageManager);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          id: component.id,
          name: component.name,
          packageManager,
          mode: component.install.mode,
          source: component.install.source,
          renderedCommand: rendered.command,
          steps: rendered.steps,
          install: component.install,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`${component.name} (${component.id})`);
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

function renderInstall(
  install: ComponentInstall,
  packageManager: PackageManager,
): InstallRenderResult {
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

function toRunnerCommand(template: string, packageManager: PackageManager): string {
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
