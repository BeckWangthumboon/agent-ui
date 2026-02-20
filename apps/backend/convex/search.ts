import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";

import {
  ComponentAnimationLibraryValidator,
  ComponentFrameworkValidator,
  ComponentMotionValidator,
  ComponentPrimitiveLibraryValidator,
  ComponentStylingValidator,
} from "./validators";

type SearchRecord = Doc<"componentSearch">;
type ComponentRecord = Doc<"components">;
type ComponentCodeRecord = Doc<"componentCode">;

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
  intent: string;
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
    files: ComponentCodeRecord["files"];
  };
};

type ComponentFilters = {
  framework?: ComponentRecord["framework"];
  styling?: ComponentRecord["styling"];
  motion?: ComponentRecord["motionLevel"];
  primitiveLibrary?: ComponentRecord["primitiveLibrary"];
  animationLibrary?: ComponentRecord["animationLibrary"];
};

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

function matchesFilters(component: ComponentRecord, filters: ComponentFilters): boolean {
  if (filters.framework && component.framework !== filters.framework) {
    return false;
  }

  if (filters.styling && component.styling !== filters.styling) {
    return false;
  }

  if (filters.motion && component.motionLevel !== filters.motion) {
    return false;
  }

  if (filters.primitiveLibrary && component.primitiveLibrary !== filters.primitiveLibrary) {
    return false;
  }

  if (filters.animationLibrary && component.animationLibrary !== filters.animationLibrary) {
    return false;
  }

  return true;
}

async function findComponentById(ctx: QueryCtx, id: string): Promise<ComponentRecord | null> {
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

async function queryComponentsByFilters(
  ctx: QueryCtx,
  filters: ComponentFilters,
): Promise<ComponentRecord[]> {
  const frameworkFilter = filters.framework;
  if (frameworkFilter !== undefined) {
    return ctx.db
      .query("components")
      .withIndex("by_framework", (indexQuery) => indexQuery.eq("framework", frameworkFilter))
      .collect();
  }

  const stylingFilter = filters.styling;
  if (stylingFilter !== undefined) {
    return ctx.db
      .query("components")
      .withIndex("by_styling", (indexQuery) => indexQuery.eq("styling", stylingFilter))
      .collect();
  }

  const motionFilter = filters.motion;
  if (motionFilter !== undefined) {
    return ctx.db
      .query("components")
      .withIndex("by_motion_level", (indexQuery) => indexQuery.eq("motionLevel", motionFilter))
      .collect();
  }

  const primitiveLibraryFilter = filters.primitiveLibrary;
  if (primitiveLibraryFilter !== undefined) {
    return ctx.db
      .query("components")
      .withIndex("by_primitive_library", (indexQuery) =>
        indexQuery.eq("primitiveLibrary", primitiveLibraryFilter),
      )
      .collect();
  }

  const animationLibraryFilter = filters.animationLibrary;
  if (animationLibraryFilter !== undefined) {
    return ctx.db
      .query("components")
      .withIndex("by_animation_library", (indexQuery) =>
        indexQuery.eq("animationLibrary", animationLibraryFilter),
      )
      .collect();
  }

  return ctx.db.query("components").collect();
}

async function toViewComponent(
  ctx: QueryCtx,
  component: ComponentRecord,
  includeCode: boolean,
): Promise<ViewComponent> {
  const [search, code] = await Promise.all([
    ctx.db
      .query("componentSearch")
      .withIndex("by_component_id", (indexQuery) => indexQuery.eq("componentId", component.id))
      .unique(),
    ctx.db
      .query("componentCode")
      .withIndex("by_component_id", (indexQuery) => indexQuery.eq("componentId", component.id))
      .unique(),
  ]);

  const base: ViewComponent = {
    schemaVersion: component.schemaVersion,
    id: component.id,
    name: component.name,
    source: component.source,
    framework: component.framework,
    styling: component.styling,
    dependencies: component.dependencies,
    intent: search?.intent ?? toFallbackIntent(component.name),
    motionLevel: component.motionLevel,
    primitiveLibrary: component.primitiveLibrary,
    animationLibrary: component.animationLibrary,
    constraints: component.constraints,
    codeSummary: {
      entryFile: code?.entryFile ?? "",
      fileCount: code?.files.length ?? 0,
    },
  };

  if (!includeCode || !code) {
    return base;
  }

  return {
    ...base,
    code: {
      entryFile: code.entryFile,
      files: code.files,
    },
  };
}

export const componentsQuery = query({
  args: {
    query: v.string(),
    filters: v.optional(
      v.object({
        framework: v.optional(ComponentFrameworkValidator),
        styling: v.optional(ComponentStylingValidator),
        motion: v.optional(ComponentMotionValidator),
        primitiveLibrary: v.optional(ComponentPrimitiveLibraryValidator),
        animationLibrary: v.optional(ComponentAnimationLibraryValidator),
      }),
    ),
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

    return componentsFromIndex
      .filter((component) => matchesFilters(component, filters))
      .map((component) => toSearchCandidate(component, searchByComponentId.get(component.id)));
  },
});

export const getById = query({
  args: {
    id: v.string(),
    includeCode: v.optional(v.boolean()),
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

    return toViewComponent(ctx, component, args.includeCode ?? false);
  },
});
