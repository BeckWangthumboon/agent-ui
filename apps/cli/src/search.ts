import Fuse from "fuse.js";
import type { IFuseOptions } from "fuse.js";
import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../backend/convex/_generated/api";

import {
  ComponentFrameworkSchema,
  ComponentMotionSchema,
  ComponentStylingSchema,
  type ComponentDocument,
  type ComponentFramework,
  type ComponentMotion,
  type ComponentStyling,
} from "../../../shared/component-schema";

export type SearchCliOptions = {
  limit: number;
  framework?: ComponentFramework;
  styling?: ComponentStyling;
  motion?: ComponentMotion;
  json?: boolean;
};

type SearchCandidate = Pick<
  ComponentDocument,
  | "id"
  | "name"
  | "source"
  | "framework"
  | "styling"
  | "dependencies"
  | "intent"
  | "capabilities"
  | "synonyms"
  | "topics"
  | "motionLevel"
>;

const DEFAULT_LIMIT = 10;

const FUSE_OPTIONS: IFuseOptions<SearchCandidate> = {
  includeScore: true,
  threshold: 0.32,
  ignoreLocation: true,
  minMatchCharLength: 2,
  keys: [
    { name: "name", weight: 0.36 },
    { name: "intent", weight: 0.27 },
    { name: "capabilities", weight: 0.14 },
    { name: "synonyms", weight: 0.12 },
    { name: "topics", weight: 0.07 },
    { name: "dependencies.name", weight: 0.04 },
  ],
};

export async function runSearchCommand(
  query: string,
  options: SearchCliOptions,
  client: ConvexHttpClient,
): Promise<void> {
  const normalizedQuery = query.trim();

  if (normalizedQuery.length === 0) {
    console.error("Search query must be non-empty.");
    process.exitCode = 1;
    return;
  }

  const hasFilters = options.framework || options.styling || options.motion;
  const filters = hasFilters
    ? {
        framework: options.framework,
        styling: options.styling,
        motion: options.motion,
      }
    : undefined;

  const candidates = await client.query(api.search.componentsQuery, {
    query: normalizedQuery,
    filters,
  });
  const limit = normalizeLimit(options.limit);
  const results = rankResults(candidates, normalizedQuery, limit);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          query: normalizedQuery,
          filters: {
            framework: options.framework,
            styling: options.styling,
            motion: options.motion,
          },
          candidateCount: candidates.length,
          resultCount: results.length,
          results,
        },
        null,
        2,
      ),
    );
    return;
  }

  printSearchResults(results);
}

function rankResults(
  candidates: SearchCandidate[],
  query: string,
  limit: number,
): SearchCandidate[] {
  if (candidates.length === 0) {
    return [];
  }

  const fuse = new Fuse(candidates, FUSE_OPTIONS);
  return fuse.search(query, { limit }).map((result) => result.item);
}

function printSearchResults(results: SearchCandidate[]): void {
  if (results.length === 0) {
    console.log("No matching components found.");
    return;
  }

  for (const [index, result] of results.entries()) {
    console.log(`${index + 1}. ${result.name} (${result.id})`);
    console.log(
      `   framework: ${result.framework} | styling: ${result.styling} | motion: ${result.motionLevel}`,
    );

    if (result.dependencies.length > 0) {
      const dependencies = result.dependencies
        .map((dependency) => `${dependency.name} (${dependency.kind})`)
        .join(", ");
      console.log(`   dependencies: ${dependencies}`);
    } else {
      console.log("   dependencies: none");
    }

    console.log(`   source: ${result.source.url}`);
    console.log(`   intent: ${result.intent}`);
  }
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.floor(limit);
}

export function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received: ${value}`);
  }
  return parsed;
}

export function parseFramework(value: string): ComponentFramework {
  return ComponentFrameworkSchema.parse(value.trim().toLowerCase());
}

export function parseStyling(value: string): ComponentStyling {
  return ComponentStylingSchema.parse(value.trim().toLowerCase());
}

export function parseMotion(value: string): ComponentMotion {
  return ComponentMotionSchema.parse(value.trim().toLowerCase());
}
