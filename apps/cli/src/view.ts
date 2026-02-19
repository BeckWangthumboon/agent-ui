import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../backend/convex/_generated/api";
import type { ComponentDocument } from "../../../shared/component-schema";

export type ViewCliOptions = {
  verbose?: boolean;
  code?: boolean;
  json?: boolean;
};

export async function runViewCommand(
  id: string,
  options: ViewCliOptions,
  client: ConvexHttpClient,
): Promise<void> {
  const normalizedId = id.trim();

  if (normalizedId.length === 0) {
    console.error("Component id must be non-empty.");
    process.exitCode = 1;
    return;
  }

  const component = await client.query(api.search.getById, {
    id: normalizedId,
  });

  if (!component) {
    console.error(`Component not found: ${normalizedId}`);
    process.exitCode = 1;
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(component, null, 2));
    return;
  }

  printComponent(component, {
    verbose: Boolean(options.verbose),
    includeCode: Boolean(options.code),
  });
}

type PrintOptions = {
  verbose: boolean;
  includeCode: boolean;
};

type ViewComponent = Omit<ComponentDocument, "capabilities" | "synonyms" | "topics">;

function printComponent(component: ViewComponent, options: PrintOptions): void {
  console.log(`${component.name} (${component.id})`);
  console.log(`intent: ${component.intent}`);
  console.log(
    `stack: framework=${component.framework} | styling=${component.styling} | motion=${component.motionLevel}`,
  );
  console.log(`source: ${component.source.url}`);

  if (options.verbose) {
    if (component.source.library) {
      console.log(`source.library: ${component.source.library}`);
    }

    if (component.source.repo) {
      console.log(`source.repo: ${component.source.repo}`);
    }

    if (component.source.author) {
      console.log(`source.author: ${component.source.author}`);
    }

    if (component.source.license) {
      console.log(`source.license: ${component.source.license}`);
    }

    if (component.dependencies.length > 0) {
      const dependencies = component.dependencies
        .map((dependency) => `${dependency.name} (${dependency.kind})`)
        .join(", ");
      console.log(`dependencies: ${dependencies}`);
    } else {
      console.log("dependencies: none");
    }

    console.log(`code.entryFile: ${component.code.entryFile}`);
    console.log(`code.fileCount: ${component.code.files.length}`);
  }

  if (!options.includeCode) {
    return;
  }

  const orderedFiles = [...component.code.files].sort((left, right) => {
    if (left.path === component.code.entryFile) {
      return -1;
    }

    if (right.path === component.code.entryFile) {
      return 1;
    }

    return left.path.localeCompare(right.path, "en");
  });

  for (const file of orderedFiles) {
    console.log(`--- code: ${file.path} ---`);
    console.log(file.content);
  }
}
