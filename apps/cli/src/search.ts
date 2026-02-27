import Fuse from "fuse.js";
import type { IFuseOptions } from "fuse.js";
import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../backend/convex/_generated/api";
import { CLI_NAME } from "./constants.js";

import {
  ComponentFrameworkSchema,
  ComponentMotionSchema,
  ComponentPrimitiveLibrarySchema,
  ComponentStylingSchema,
  type ComponentDocument,
  type ComponentFramework,
  type ComponentMotion,
  type ComponentPrimitiveLibrary,
  type ComponentStyling,
} from "../../../shared/component-schema";

export type SearchCliOptions = {
  limit?: number;
  framework?: ComponentFramework;
  styling?: ComponentStyling;
  motion?: ComponentMotion[];
  primitiveLibrary?: ComponentPrimitiveLibrary[];
  relax?: boolean;
  json?: boolean;
};

type SearchCandidate = Pick<
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

type SemanticCandidate = {
  componentId: string;
  semanticRank: number;
};

type HybridReason = "lexical" | "semantic" | "both";

type HybridMergedResult = {
  id: string;
  reason: HybridReason;
  score: number;
  lexicalRank?: number;
  semanticRank?: number;
};

const DEFAULT_LIMIT = 5;
const INTERNAL_LEXICAL_POOL_LIMIT = 15;
const INTERNAL_SEMANTIC_POOL_LIMIT = 15;
const RRF_K = 20;
const RRF_WEIGHT_LEXICAL = 1.2;
const RRF_WEIGHT_SEMANTIC = 1;

const FUSE_KEYS: IFuseOptions<SearchCandidate>["keys"] = [
  { name: "name", weight: 0.36 },
  { name: "intent", weight: 0.27 },
  { name: "capabilities", weight: 0.14 },
  { name: "synonyms", weight: 0.12 },
  { name: "topics", weight: 0.07 },
];

const STRICT_FUSE_OPTIONS: IFuseOptions<SearchCandidate> = {
  includeScore: true,
  threshold: 0.32,
  ignoreLocation: true,
  minMatchCharLength: 2,
  keys: FUSE_KEYS,
};

const RELAXED_FUSE_OPTIONS: IFuseOptions<SearchCandidate> = {
  includeScore: true,
  threshold: 1,
  ignoreLocation: true,
  minMatchCharLength: 1,
  keys: [...FUSE_KEYS, { name: "id", weight: 0.02 }],
};

export async function runSearchCommand(
  query: string,
  options: SearchCliOptions,
  client: ConvexHttpClient,
) {
  const normalizedQuery = query.trim();

  if (normalizedQuery.length === 0) {
    console.error("Search query must be non-empty.");
    process.exitCode = 1;
    return;
  }

  const motionFilters = normalizeFilterValues(options.motion);
  const primitiveLibraryFilters = normalizeFilterValues(options.primitiveLibrary);

  const filters = buildBackendFilters(options, motionFilters, primitiveLibraryFilters);

  const candidates = await client.query(api.search.componentsQuery, {
    query: normalizedQuery,
    filters,
  });
  const limit = normalizeLimit(options.limit);
  const strictDisplayResults = rankResults(candidates, normalizedQuery, limit, STRICT_FUSE_OPTIONS);
  const strictResultCount = strictDisplayResults.length;
  const relaxed = options.relax === true;
  const lexicalPool = rankResults(
    candidates,
    normalizedQuery,
    INTERNAL_LEXICAL_POOL_LIMIT,
    relaxed ? RELAXED_FUSE_OPTIONS : STRICT_FUSE_OPTIONS,
  );
  const semanticCandidates = await client.action(api.search.semanticSearch, {
    query: normalizedQuery,
    filters,
    limit: INTERNAL_SEMANTIC_POOL_LIMIT,
  });
  const hybridResults = mergeHybridResults(lexicalPool, semanticCandidates).slice(0, limit);
  const rankedResults = toSearchCandidates(hybridResults, candidates);
  const hydratedResults = await hydrateResults(rankedResults, client);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          query: normalizedQuery,
          mode: relaxed ? "relaxed" : "strict",
          strictResultCount,
          relaxed,
          filters: {
            framework: options.framework,
            styling: options.styling,
            motion: motionFilters,
            primitiveLibrary: primitiveLibraryFilters,
          },
          candidateCount: candidates.length,
          resultCount: hydratedResults.length,
          results: hydratedResults,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (!relaxed && hydratedResults.length === 0) {
    printNoMatchGuidance(normalizedQuery, true);
    return;
  }

  if (relaxed && strictResultCount === 0 && hydratedResults.length > 0) {
    console.log("No strict matches; showing relaxed best-effort results.");
  }

  if (hydratedResults.length === 0) {
    printNoMatchGuidance(normalizedQuery, false);
    return;
  }

  printSearchResults(hydratedResults);
  if (relaxed) {
    console.log("Tip: refine with --framework/--styling/--motion for higher precision.");
  }
}

function rankResults(
  candidates: SearchCandidate[],
  query: string,
  limit: number,
  fuseOptions: IFuseOptions<SearchCandidate>,
): SearchCandidate[] {
  if (candidates.length === 0) {
    return [];
  }

  const fuse = new Fuse(candidates, fuseOptions);
  return fuse.search(query, { limit }).map((result) => result.item);
}

function mergeHybridResults(
  lexicalCandidates: SearchCandidate[],
  semanticCandidates: SemanticCandidate[],
) {
  const lexicalRankById = new Map<string, number>();
  for (const [index, candidate] of lexicalCandidates.entries()) {
    lexicalRankById.set(candidate.id, index + 1);
  }

  const semanticRankById = new Map<string, number>();
  for (const candidate of semanticCandidates) {
    if (semanticRankById.has(candidate.componentId)) {
      continue;
    }
    semanticRankById.set(candidate.componentId, candidate.semanticRank);
  }

  const mergedIds = new Set<string>([...lexicalRankById.keys(), ...semanticRankById.keys()]);
  const merged: HybridMergedResult[] = [];

  for (const id of mergedIds) {
    const lexicalRank = lexicalRankById.get(id);
    const semanticRank = semanticRankById.get(id);

    let score = 0;
    if (lexicalRank !== undefined) {
      score += RRF_WEIGHT_LEXICAL / (RRF_K + lexicalRank);
    }
    if (semanticRank !== undefined) {
      score += RRF_WEIGHT_SEMANTIC / (RRF_K + semanticRank);
    }

    let reason: HybridReason;
    if (lexicalRank !== undefined && semanticRank !== undefined) {
      reason = "both";
    } else if (lexicalRank !== undefined) {
      reason = "lexical";
    } else {
      reason = "semantic";
    }

    merged.push({
      id,
      reason,
      score,
      lexicalRank,
      semanticRank,
    });
  }

  return merged.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    const leftBest = Math.min(
      left.lexicalRank ?? Number.POSITIVE_INFINITY,
      left.semanticRank ?? Number.POSITIVE_INFINITY,
    );
    const rightBest = Math.min(
      right.lexicalRank ?? Number.POSITIVE_INFINITY,
      right.semanticRank ?? Number.POSITIVE_INFINITY,
    );
    if (leftBest !== rightBest) {
      return leftBest - rightBest;
    }

    const leftLexical = left.lexicalRank ?? Number.POSITIVE_INFINITY;
    const rightLexical = right.lexicalRank ?? Number.POSITIVE_INFINITY;
    if (leftLexical !== rightLexical) {
      return leftLexical - rightLexical;
    }

    const leftSemantic = left.semanticRank ?? Number.POSITIVE_INFINITY;
    const rightSemantic = right.semanticRank ?? Number.POSITIVE_INFINITY;
    if (leftSemantic !== rightSemantic) {
      return leftSemantic - rightSemantic;
    }

    return left.id.localeCompare(right.id, "en");
  });
}

function toSearchCandidates(
  hybridResults: HybridMergedResult[],
  candidates: SearchCandidate[],
): SearchCandidate[] {
  if (hybridResults.length === 0) {
    return [];
  }

  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  return hybridResults
    .map((result) => candidateById.get(result.id))
    .filter((candidate): candidate is SearchCandidate => candidate !== undefined);
}

type SearchResult = SearchCandidate & {
  source: ComponentDocument["source"];
  dependencies: ComponentDocument["dependencies"];
};

type SearchMetadata = {
  id: string;
  source: ComponentDocument["source"];
  dependencies: ComponentDocument["dependencies"];
};

async function hydrateResults(
  results: SearchCandidate[],
  client: ConvexHttpClient,
): Promise<SearchResult[]> {
  if (results.length === 0) {
    return [];
  }

  const metadata = await client.query(api.components.getMetadataByIds, {
    ids: results.map((result) => result.id),
  });
  const typedMetadata = metadata as SearchMetadata[];
  const metadataById = new Map(
    typedMetadata.map((component: SearchMetadata) => [component.id, component]),
  );

  return results.map((result) => {
    const component = metadataById.get(result.id);
    return {
      ...result,
      source: component?.source ?? { url: "unknown" },
      dependencies: component?.dependencies ?? [],
    };
  });
}

function printSearchResults(results: SearchResult[]): void {
  for (const [index, result] of results.entries()) {
    console.log(`${index + 1}. ${result.name} (${result.id})`);
    console.log(
      `   framework: ${result.framework} | styling: ${result.styling} | motion: ${result.motionLevel}`,
    );
    console.log(
      `   primitive: ${result.primitiveLibrary ?? "none"} | animation: ${result.animationLibrary ?? "none"}`,
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

function printNoMatchGuidance(query: string, includeRelaxHint: boolean): void {
  console.log(`No matches in current catalog for "${query}".`);
  if (includeRelaxHint) {
    console.log(`Try: ${CLI_NAME} search "${query}" --relax`);
  }
  console.log(`Try: ${CLI_NAME} search "<broader term>" --limit 20`);
  console.log("This component may not exist in the current catalog.");
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.floor(limit);
}

function normalizeFilterValues<TValue extends string>(
  values: TValue[] | undefined,
): TValue[] | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  return [...new Set(values)];
}

function buildBackendFilters(
  options: SearchCliOptions,
  motionFilters: ComponentMotion[] | undefined,
  primitiveLibraryFilters: ComponentPrimitiveLibrary[] | undefined,
) {
  const candidateFilters: {
    framework?: ComponentFramework;
    styling?: ComponentStyling;
    motion?: ComponentMotion[];
    primitiveLibrary?: ComponentPrimitiveLibrary[];
  } = {
    framework: options.framework,
    styling: options.styling,
    motion: motionFilters,
    primitiveLibrary: primitiveLibraryFilters,
  };

  if (
    candidateFilters.framework === undefined &&
    candidateFilters.styling === undefined &&
    candidateFilters.motion === undefined &&
    candidateFilters.primitiveLibrary === undefined
  ) {
    return undefined;
  }

  return candidateFilters;
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

export function collectMotion(
  value: string,
  previous: ComponentMotion[] | undefined,
): ComponentMotion[] {
  const parsed = parseMotion(value);
  return previous ? [...previous, parsed] : [parsed];
}

export function parsePrimitiveLibrary(value: string): ComponentPrimitiveLibrary {
  return ComponentPrimitiveLibrarySchema.parse(value.trim().toLowerCase());
}

export function collectPrimitiveLibrary(
  value: string,
  previous: ComponentPrimitiveLibrary[] | undefined,
): ComponentPrimitiveLibrary[] {
  const parsed = parsePrimitiveLibrary(value);
  return previous ? [...previous, parsed] : [parsed];
}
