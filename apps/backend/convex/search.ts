import { action, internalQuery, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";

import {
  ComponentAnimationLibraryValidator,
  ComponentFrameworkValidator,
  ComponentMotionValidator,
  ComponentPrimitiveLibraryValidator,
  ComponentStylingValidator,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
} from "./validators";
import { createEmbedding, createEmbeddingClientFromEnv } from "./lib/embeddings";

type SearchRecord = Doc<"componentSearch">;
type ComponentRecord = Doc<"components">;
type ComponentCodeRecord = Doc<"componentCode">;
type ComponentFileRecord = Doc<"componentFiles">;

type ViewCodeFile = Pick<ComponentFileRecord, "path" | "content">;

type SearchCandidate = {
  id: ComponentRecord["id"];
  name: ComponentRecord["name"];
  framework: ComponentRecord["framework"];
  styling: ComponentRecord["styling"];
  intent: string;
  capabilities: SearchRecord["capabilities"];
  synonyms: SearchRecord["synonyms"];
  topics: SearchRecord["topics"];
  motionLevel: ComponentRecord["motionLevel"];
  primitiveLibrary: ComponentRecord["primitiveLibrary"];
  animationLibrary: ComponentRecord["animationLibrary"];
};

type ViewComponent = {
  schemaVersion: ComponentRecord["schemaVersion"];
  id: ComponentRecord["id"];
  name: ComponentRecord["name"];
  source: ComponentRecord["source"];
  framework: ComponentRecord["framework"];
  styling: ComponentRecord["styling"];
  dependencies: ComponentRecord["dependencies"];
  motionLevel: ComponentRecord["motionLevel"];
  primitiveLibrary: ComponentRecord["primitiveLibrary"];
  animationLibrary: ComponentRecord["animationLibrary"];
  constraints: ComponentRecord["constraints"];
  codeSummary: {
    entryFile: string;
    fileCount: number;
  };
  code?: {
    entryFile: ComponentCodeRecord["entryFile"];
    files: ViewCodeFile[];
  };
  example?: ViewCodeFile;
};

type ComponentFilters = {
  framework?: ComponentRecord["framework"];
  styling?: ComponentRecord["styling"];
  motion?: ComponentRecord["motionLevel"][];
  primitiveLibrary?: ComponentRecord["primitiveLibrary"][];
  animationLibrary?: ComponentRecord["animationLibrary"];
};

type SemanticCandidate = {
  componentId: string;
  semanticRank: number;
};

const ComponentFiltersValidator = v.object({
  framework: v.optional(ComponentFrameworkValidator),
  styling: v.optional(ComponentStylingValidator),
  motion: v.optional(v.array(ComponentMotionValidator)),
  primitiveLibrary: v.optional(v.array(ComponentPrimitiveLibraryValidator)),
  animationLibrary: v.optional(ComponentAnimationLibraryValidator),
});

const DEFAULT_SEMANTIC_LIMIT = 15;
const MAX_SEMANTIC_LIMIT = 50;
const MIN_VECTOR_SEARCH_WINDOW = 30;
const MAX_VECTOR_SEARCH_WINDOW = 200;
const VECTOR_SEARCH_MULTIPLIER = 3;

const componentIdsByFiltersInternalRef = makeFunctionReference<
  "query",
  { filters?: ComponentFilters },
  string[]
>("search:componentIdsByFiltersInternal");

const resolveEmbeddingComponentIdsInternalRef = makeFunctionReference<
  "query",
  { embeddingIds: Array<Id<"componentEmbeddings">> },
  Array<string | null>
>("search:resolveEmbeddingComponentIdsInternal");

type SeedQuery =
  | {
      kind: "primitiveLibraryAndMotion";
      primitiveLibrary: ComponentRecord["primitiveLibrary"];
      motionLevel: ComponentRecord["motionLevel"];
    }
  | {
      kind: "animationLibraryAndMotion";
      animationLibrary: ComponentRecord["animationLibrary"];
      motionLevel: ComponentRecord["motionLevel"];
    }
  | { kind: "framework"; value: ComponentRecord["framework"] }
  | { kind: "styling"; value: ComponentRecord["styling"] }
  | { kind: "motion"; value: ComponentRecord["motionLevel"] }
  | { kind: "primitiveLibrary"; value: ComponentRecord["primitiveLibrary"] }
  | { kind: "animationLibrary"; value: ComponentRecord["animationLibrary"] }
  | { kind: "all" };

function toFallbackIntent(componentName: string): string {
  const trimmedName = componentName.trim();
  return trimmedName.length > 0 ? trimmedName : "Unnamed component";
}

function toSearchCandidate(
  component: ComponentRecord,
  search: SearchRecord | null | undefined,
): SearchCandidate {
  return {
    id: component.id,
    name: component.name,
    framework: component.framework,
    styling: component.styling,
    intent: search?.intent ?? toFallbackIntent(component.name),
    capabilities: search?.capabilities ?? [],
    synonyms: search?.synonyms ?? [],
    topics: search?.topics ?? [],
    motionLevel: component.motionLevel,
    primitiveLibrary: component.primitiveLibrary,
    animationLibrary: component.animationLibrary,
  };
}

async function findComponentById(ctx: QueryCtx, id: string) {
  const exact = await ctx.db
    .query("components")
    .withIndex("by_component_id", (indexQuery) => indexQuery.eq("id", id))
    .unique();

  if (exact) {
    return exact;
  }

  const normalizedLower = id.toLowerCase();
  const components = await ctx.db.query("components").collect();
  const insensitiveMatch = components.find(
    (component) => component.id.toLowerCase() === normalizedLower,
  );
  return insensitiveMatch ?? null;
}

function getSingleValueFilter<TValue>(values: TValue[] | undefined): TValue | undefined {
  if (!values || values.length !== 1) {
    return undefined;
  }

  return values[0];
}

function selectSeedQuery(filters: ComponentFilters): SeedQuery {
  const motion = getSingleValueFilter(filters.motion);
  const primitiveLibrary = getSingleValueFilter(filters.primitiveLibrary);
  if (primitiveLibrary !== undefined && motion !== undefined) {
    return {
      kind: "primitiveLibraryAndMotion",
      primitiveLibrary,
      motionLevel: motion,
    };
  }

  if (filters.animationLibrary !== undefined && motion !== undefined) {
    return {
      kind: "animationLibraryAndMotion",
      animationLibrary: filters.animationLibrary,
      motionLevel: motion,
    };
  }

  if (primitiveLibrary !== undefined) {
    return { kind: "primitiveLibrary", value: primitiveLibrary };
  }

  if (filters.animationLibrary !== undefined) {
    return { kind: "animationLibrary", value: filters.animationLibrary };
  }

  if (motion !== undefined) {
    return { kind: "motion", value: motion };
  }

  if (filters.framework !== undefined) {
    return { kind: "framework", value: filters.framework };
  }

  if (filters.styling !== undefined) {
    return { kind: "styling", value: filters.styling };
  }

  return { kind: "all" };
}

async function executeSeedQuery(ctx: QueryCtx, seedQuery: SeedQuery) {
  switch (seedQuery.kind) {
    case "primitiveLibraryAndMotion":
      return ctx.db
        .query("components")
        .withIndex("by_primitive_motion", (indexQuery) =>
          indexQuery
            .eq("primitiveLibrary", seedQuery.primitiveLibrary)
            .eq("motionLevel", seedQuery.motionLevel),
        )
        .collect();
    case "animationLibraryAndMotion":
      return ctx.db
        .query("components")
        .withIndex("by_animation_motion", (indexQuery) =>
          indexQuery
            .eq("animationLibrary", seedQuery.animationLibrary)
            .eq("motionLevel", seedQuery.motionLevel),
        )
        .collect();
    case "framework":
      return ctx.db
        .query("components")
        .withIndex("by_framework", (indexQuery) => indexQuery.eq("framework", seedQuery.value))
        .collect();
    case "styling":
      return ctx.db
        .query("components")
        .withIndex("by_styling", (indexQuery) => indexQuery.eq("styling", seedQuery.value))
        .collect();
    case "motion":
      return ctx.db
        .query("components")
        .withIndex("by_motion_level", (indexQuery) => indexQuery.eq("motionLevel", seedQuery.value))
        .collect();
    case "primitiveLibrary":
      return ctx.db
        .query("components")
        .withIndex("by_primitive_library", (indexQuery) =>
          indexQuery.eq("primitiveLibrary", seedQuery.value),
        )
        .collect();
    case "animationLibrary":
      return ctx.db
        .query("components")
        .withIndex("by_animation_library", (indexQuery) =>
          indexQuery.eq("animationLibrary", seedQuery.value),
        )
        .collect();
    case "all":
      return ctx.db.query("components").collect();
  }
}

function matchesListFilter<TValue>(value: TValue, filterValues: TValue[] | undefined): boolean {
  if (!filterValues || filterValues.length === 0) {
    return true;
  }

  return filterValues.includes(value);
}

function matchesAllFilters(component: ComponentRecord, filters: ComponentFilters): boolean {
  if (filters.framework && component.framework !== filters.framework) {
    return false;
  }

  if (filters.styling && component.styling !== filters.styling) {
    return false;
  }

  if (!matchesListFilter(component.motionLevel, filters.motion)) {
    return false;
  }

  if (!matchesListFilter(component.primitiveLibrary, filters.primitiveLibrary)) {
    return false;
  }

  if (filters.animationLibrary && component.animationLibrary !== filters.animationLibrary) {
    return false;
  }

  return true;
}

async function queryComponentsByFilters(ctx: QueryCtx, filters: ComponentFilters) {
  const seedQuery = selectSeedQuery(filters);
  const candidates = await executeSeedQuery(ctx, seedQuery);

  return candidates.filter((component) => matchesAllFilters(component, filters));
}

function hasAnyFilters(filters: ComponentFilters | undefined): boolean {
  if (!filters) {
    return false;
  }

  return (
    filters.framework !== undefined ||
    filters.styling !== undefined ||
    (filters.motion?.length ?? 0) > 0 ||
    (filters.primitiveLibrary?.length ?? 0) > 0 ||
    filters.animationLibrary !== undefined
  );
}

function normalizeSemanticLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_SEMANTIC_LIMIT;
  }

  if (!Number.isFinite(limit)) {
    throw new Error("Semantic limit must be a finite number.");
  }

  const normalizedLimit = Math.floor(limit);
  if (normalizedLimit <= 0) {
    throw new Error("Semantic limit must be a positive integer.");
  }

  return Math.min(normalizedLimit, MAX_SEMANTIC_LIMIT);
}

function toVectorSearchWindow(limit: number): number {
  return Math.min(
    Math.max(limit * VECTOR_SEARCH_MULTIPLIER, MIN_VECTOR_SEARCH_WINDOW),
    MAX_VECTOR_SEARCH_WINDOW,
  );
}

function validateEmbeddingVector(embedding: number[]): void {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, received ${embedding.length}`,
    );
  }

  for (const [index, value] of embedding.entries()) {
    if (!Number.isFinite(value)) {
      throw new Error(`Embedding value at index ${index} is not finite`);
    }
  }
}

async function fetchQueryEmbedding(query: string) {
  const client = createEmbeddingClientFromEnv("semantic retrieval");
  const normalizedEmbedding = await createEmbedding(client, {
    model: EMBEDDING_MODEL,
    input: query,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  validateEmbeddingVector(normalizedEmbedding);
  return normalizedEmbedding;
}

function toViewCodeFiles(
  fileRecords: ComponentFileRecord[],
  kind: ComponentFileRecord["kind"],
): ViewCodeFile[] {
  return fileRecords
    .filter((row) => row.kind === kind)
    .map((row) => ({ path: row.path, content: row.content }))
    .sort((left, right) => left.path.localeCompare(right.path, "en"));
}

async function toViewComponent(
  ctx: QueryCtx,
  component: ComponentRecord,
  includeCode: boolean,
  includeExample: boolean,
) {
  const [code, fileRecords] = await Promise.all([
    ctx.db
      .query("componentCode")
      .withIndex("by_component_id", (indexQuery) => indexQuery.eq("componentId", component.id))
      .unique(),
    ctx.db
      .query("componentFiles")
      .withIndex("by_component_id", (indexQuery) => indexQuery.eq("componentId", component.id))
      .collect(),
  ]);

  const codeFiles = toViewCodeFiles(fileRecords, "code");
  const exampleFiles = toViewCodeFiles(fileRecords, "example");
  const defaultExample = exampleFiles[0];

  const base: ViewComponent = {
    schemaVersion: component.schemaVersion,
    id: component.id,
    name: component.name,
    source: component.source,
    framework: component.framework,
    styling: component.styling,
    dependencies: component.dependencies,
    motionLevel: component.motionLevel,
    primitiveLibrary: component.primitiveLibrary,
    animationLibrary: component.animationLibrary,
    constraints: component.constraints,
    codeSummary: {
      entryFile: code?.entryFile ?? "",
      fileCount: codeFiles.length,
    },
  };

  if (!includeCode && !includeExample) {
    return base;
  }

  if (includeExample && defaultExample) {
    base.example = defaultExample;
  }

  if (!includeCode || !code) {
    return base;
  }

  return {
    ...base,
    code: {
      entryFile: code.entryFile,
      files: codeFiles,
    },
  };
}

export const componentsQuery = query({
  args: {
    query: v.string(),
    filters: v.optional(ComponentFiltersValidator),
  },
  handler: async (ctx, args) => {
    const normalizedQuery = args.query.trim();

    if (normalizedQuery.length === 0) {
      throw new Error("Search query must be non-empty.");
    }

    const filters = args.filters ?? {};
    const componentsFromIndex = await queryComponentsByFilters(ctx, filters);
    const searchRecords = await ctx.db.query("componentSearch").collect();
    const searchByComponentId = new Map(
      searchRecords.map((searchRecord) => [searchRecord.componentId, searchRecord]),
    );

    return componentsFromIndex.map((component) =>
      toSearchCandidate(component, searchByComponentId.get(component.id)),
    );
  },
});

export const componentIdsByFiltersInternal = internalQuery({
  args: {
    filters: v.optional(ComponentFiltersValidator),
  },
  handler: async (ctx, args) => {
    const filters = args.filters ?? {};
    const components = await queryComponentsByFilters(ctx, filters);
    return components.map((component) => component.id);
  },
});

export const resolveEmbeddingComponentIdsInternal = internalQuery({
  args: {
    embeddingIds: v.array(v.id("componentEmbeddings")),
  },
  handler: async (ctx, args) => {
    if (args.embeddingIds.length === 0) {
      return [];
    }

    const rows = await Promise.all(args.embeddingIds.map((embeddingId) => ctx.db.get(embeddingId)));
    return rows.map((row) => row?.componentId ?? null);
  },
});

export const semanticSearch = action({
  args: {
    query: v.string(),
    filters: v.optional(ComponentFiltersValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const normalizedQuery = args.query.trim();
    if (normalizedQuery.length === 0) {
      throw new Error("Search query must be non-empty.");
    }

    const semanticLimit = normalizeSemanticLimit(args.limit);
    const queryEmbedding = await fetchQueryEmbedding(normalizedQuery);
    const vectorSearchWindow = toVectorSearchWindow(semanticLimit);
    const vectorHits = await ctx.vectorSearch("componentEmbeddings", "by_embedding", {
      vector: queryEmbedding,
      limit: vectorSearchWindow,
    });

    const embeddingIds = vectorHits.map((hit) => hit._id);
    const componentIdsByHit = await ctx.runQuery(resolveEmbeddingComponentIdsInternalRef, {
      embeddingIds,
    });

    const allowedComponentIds = hasAnyFilters(args.filters)
      ? new Set(
          await ctx.runQuery(componentIdsByFiltersInternalRef, {
            filters: args.filters,
          }),
        )
      : null;

    const seenComponentIds = new Set<string>();
    const candidates: SemanticCandidate[] = [];

    for (const componentId of componentIdsByHit) {
      if (!componentId) {
        continue;
      }
      if (allowedComponentIds && !allowedComponentIds.has(componentId)) {
        continue;
      }
      if (seenComponentIds.has(componentId)) {
        continue;
      }

      seenComponentIds.add(componentId);
      candidates.push({
        componentId,
        semanticRank: candidates.length + 1,
      });

      if (candidates.length >= semanticLimit) {
        break;
      }
    }

    return candidates;
  },
});

export const getById = query({
  args: {
    id: v.string(),
    includeCode: v.optional(v.boolean()),
    includeExample: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const normalizedId = args.id.trim();

    if (normalizedId.length === 0) {
      throw new Error("Component id must be non-empty.");
    }

    const component = await findComponentById(ctx, normalizedId);

    if (!component) {
      return null;
    }

    return toViewComponent(ctx, component, args.includeCode ?? false, args.includeExample ?? false);
  },
});
