import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../backend/convex/_generated/api";
import type {
  ComponentCodeFile,
  ComponentFramework,
  ComponentMotion,
  ComponentSource,
  ComponentStyling,
  Dependency,
} from "../../../shared/component-schema";

export type ViewCliOptions = {
  verbose?: boolean;
  code?: boolean;
  example?: boolean;
  json?: boolean;
};

type ViewComponent = {
  schemaVersion: number;
  id: string;
  name: string;
  source: ComponentSource;
  framework: ComponentFramework;
  styling: ComponentStyling;
  dependencies: Dependency[];
  motionLevel: ComponentMotion;
  primitiveLibrary: string;
  animationLibrary: string;
  constraints?: Record<string, never>;
  codeSummary: {
    entryFile: string;
    fileCount: number;
  };
  code?: {
    entryFile: string;
    files: ComponentCodeFile[];
  };
  example?: ComponentCodeFile;
};

type ViewJsonMetadata = {
  schemaVersion: number;
  id: string;
  name: string;
  framework: ComponentFramework;
  styling: ComponentStyling;
  motionLevel: ComponentMotion;
  primitiveLibrary?: string;
  animationLibrary?: string;
  source: {
    url: string;
  };
};

type ViewJsonVerbose = {
  source: ComponentSource;
  dependencies: Dependency[];
  primitiveLibrary: string;
  animationLibrary: string;
  constraints?: Record<string, never>;
  codeSummary: {
    entryFile: string;
    fileCount: number;
  };
};

type ViewJsonPayload = {
  included: {
    code: boolean;
    verbose: boolean;
    example: boolean;
  };
  metadata: ViewJsonMetadata;
  verbose?: ViewJsonVerbose;
  code?: {
    entryFile: string;
    files: ComponentCodeFile[];
  } | null;
  example?: ComponentCodeFile | null;
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

  const includeCode = Boolean(options.code);
  const includeExample = Boolean(options.example);

  const component = (await client.query(api.search.getById, {
    id: normalizedId,
    includeCode,
    includeExample,
  })) as ViewComponent | null;

  if (!component) {
    console.error(`Component not found: ${normalizedId}`);
    process.exitCode = 1;
    return;
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        toViewJsonPayload(component, {
          includeCode,
          verbose: Boolean(options.verbose),
          includeExample,
        }),
        null,
        2,
      ),
    );
    return;
  }

  printComponent(component, {
    verbose: Boolean(options.verbose),
    includeCode,
    includeExample,
  });
}

type PrintOptions = {
  verbose: boolean;
  includeCode: boolean;
  includeExample: boolean;
};

function toViewJsonPayload(
  component: ViewComponent,
  options: { includeCode: boolean; verbose: boolean; includeExample: boolean },
): ViewJsonPayload {
  const payload: ViewJsonPayload = {
    included: {
      code: options.includeCode,
      verbose: options.verbose,
      example: options.includeExample,
    },
    metadata: {
      schemaVersion: component.schemaVersion,
      id: component.id,
      name: component.name,
      framework: component.framework,
      styling: component.styling,
      motionLevel: component.motionLevel,
      source: {
        url: component.source.url,
      },
    },
  };

  if (isDisplayLibrary(component.primitiveLibrary)) {
    payload.metadata.primitiveLibrary = component.primitiveLibrary;
  }

  if (isDisplayLibrary(component.animationLibrary)) {
    payload.metadata.animationLibrary = component.animationLibrary;
  }

  if (options.verbose) {
    payload.verbose = {
      source: component.source,
      dependencies: component.dependencies,
      primitiveLibrary: component.primitiveLibrary,
      animationLibrary: component.animationLibrary,
      constraints: component.constraints,
      codeSummary: component.codeSummary,
    };
  }

  if (options.includeCode) {
    payload.code = component.code ?? null;
  }

  if (options.includeExample) {
    payload.example = component.example ?? null;
  }

  return payload;
}

function printComponent(component: ViewComponent, options: PrintOptions): void {
  console.log(`${component.name} (${component.id})`);
  console.log(
    `stack: framework=${component.framework} | styling=${component.styling} | motion=${component.motionLevel}`,
  );
  console.log(`source: ${component.source.url}`);

  const libraryParts: string[] = [];
  if (isDisplayLibrary(component.primitiveLibrary)) {
    libraryParts.push(`primitive=${component.primitiveLibrary}`);
  }
  if (isDisplayLibrary(component.animationLibrary)) {
    libraryParts.push(`animation=${component.animationLibrary}`);
  }

  if (libraryParts.length > 0) {
    console.log(`libraries: ${libraryParts.join(" | ")}`);
  }

  if (options.verbose) {
    console.log(`primitive.library: ${component.primitiveLibrary}`);
    console.log(`animation.library: ${component.animationLibrary}`);

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

    console.log(`code.entryFile: ${component.codeSummary.entryFile}`);
    console.log(`code.fileCount: ${component.codeSummary.fileCount}`);
  }

  if (options.includeCode) {
    if (!component.code) {
      console.log("code: unavailable");
    } else {
      const orderedFiles = [...component.code.files].sort((left, right) => {
        if (left.path === component.code?.entryFile) {
          return -1;
        }

        if (right.path === component.code?.entryFile) {
          return 1;
        }

        return left.path.localeCompare(right.path, "en");
      });

      for (const file of orderedFiles) {
        console.log(`--- code: ${file.path} ---`);
        console.log(file.content);
      }
    }
  }

  if (!options.includeExample) {
    return;
  }

  if (!component.example) {
    console.log("example: unavailable");
    return;
  }

  console.log(`--- example: ${component.example.path} ---`);
  console.log(component.example.content);
}

function isDisplayLibrary(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && normalized !== "none";
}
