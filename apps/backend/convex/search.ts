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
  id: SearchRecord["componentId"];
} & Pick<
  SearchRecord,
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

type ViewComponent = {
  schemaVersion: ComponentRecord["schemaVersion"];
  id: ComponentRecord["id"];
  legacyId: string;
  name: ComponentRecord["name"];
  source: ComponentRecord["source"];
  framework: ComponentRecord["framework"];
  styling: ComponentRecord["styling"];
  dependencies: ComponentRecord["dependencies"];
  intent: ComponentRecord["intent"];
  motionLevel: ComponentRecord["motionLevel"];
  primitiveLibrary: string;
  animationLibrary: string;
  constraints: ComponentRecord["constraints"];
  codeSummary: {
    entryFile: string;
    fileCount: number;
  };
  code?: {
    entryFile: string;
    files: ComponentCodeRecord["files"];
  };
};

type ComponentFilters = {
  framework?: SearchRecord["framework"];
  styling?: SearchRecord["styling"];
  motion?: SearchRecord["motionLevel"];
  primitiveLibrary?: SearchRecord["primitiveLibrary"];
  animationLibrary?: SearchRecord["animationLibrary"];
};

function toSearchCandidate(component: SearchRecord): SearchCandidate {
  return {
    id: component.componentId,
    name: component.name,
    framework: component.framework,
    styling: component.styling,
    intent: component.intent,
    capabilities: component.capabilities,
    synonyms: component.synonyms,
    topics: component.topics,
    motionLevel: component.motionLevel,
    primitiveLibrary: component.primitiveLibrary,
    animationLibrary: component.animationLibrary,
  };
}

function matchesFilters(component: SearchRecord, filters: ComponentFilters): boolean {
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

  const legacy = await ctx.db
    .query("components")
    .withIndex("by_legacy_component_id", (indexQuery) => indexQuery.eq("legacyId", id))
    .unique();

  if (legacy) {
    return legacy;
  }

  const normalizedLower = id.toLowerCase();
  const components = await ctx.db.query("components").collect();

  const insensitiveMatch = components.find(
    (component) =>
      component.id.toLowerCase() === normalizedLower ||
      component.legacyId.toLowerCase() === normalizedLower,
  );

  return insensitiveMatch ?? null;
}

async function toViewComponent(
  ctx: QueryCtx,
  component: ComponentRecord,
  includeCode: boolean,
): Promise<ViewComponent> {
  const base: ViewComponent = {
    schemaVersion: component.schemaVersion,
    id: component.id,
    legacyId: component.legacyId,
    name: component.name,
    source: component.source,
    framework: component.framework,
    styling: component.styling,
    dependencies: component.dependencies,
    intent: component.intent,
    motionLevel: component.motionLevel,
    primitiveLibrary: component.primitiveLibrary,
    animationLibrary: component.animationLibrary,
    constraints: component.constraints,
    codeSummary: {
      entryFile: component.codeEntryFile,
      fileCount: component.codeFileCount,
    },
  };

  if (!includeCode) {
    return base;
  }

  const code = await ctx.db
    .query("componentCode")
    .withIndex("by_component_id", (indexQuery) => indexQuery.eq("componentId", component.id))
    .unique();

  if (!code) {
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
    const frameworkFilter = filters.framework;
    const stylingFilter = filters.styling;
    const motionFilter = filters.motion;
    const primitiveLibraryFilter = filters.primitiveLibrary;
    const animationLibraryFilter = filters.animationLibrary;

    let componentsFromIndex: SearchRecord[];

    if (frameworkFilter !== undefined) {
      componentsFromIndex = await ctx.db
        .query("componentSearch")
        .withIndex("by_framework", (indexQuery) => indexQuery.eq("framework", frameworkFilter))
        .collect();
    } else if (stylingFilter !== undefined) {
      componentsFromIndex = await ctx.db
        .query("componentSearch")
        .withIndex("by_styling", (indexQuery) => indexQuery.eq("styling", stylingFilter))
        .collect();
    } else if (motionFilter !== undefined) {
      componentsFromIndex = await ctx.db
        .query("componentSearch")
        .withIndex("by_motion_level", (indexQuery) => indexQuery.eq("motionLevel", motionFilter))
        .collect();
    } else if (primitiveLibraryFilter !== undefined) {
      componentsFromIndex = await ctx.db
        .query("componentSearch")
        .withIndex("by_primitive_library", (indexQuery) =>
          indexQuery.eq("primitiveLibrary", primitiveLibraryFilter),
        )
        .collect();
    } else if (animationLibraryFilter !== undefined) {
      componentsFromIndex = await ctx.db
        .query("componentSearch")
        .withIndex("by_animation_library", (indexQuery) =>
          indexQuery.eq("animationLibrary", animationLibraryFilter),
        )
        .collect();
    } else {
      componentsFromIndex = await ctx.db.query("componentSearch").collect();
    }

    return componentsFromIndex
      .filter((component) =>
        matchesFilters(component, {
          framework: frameworkFilter,
          styling: stylingFilter,
          motion: motionFilter,
          primitiveLibrary: primitiveLibraryFilter,
          animationLibrary: animationLibraryFilter,
        }),
      )
      .map(toSearchCandidate);
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
