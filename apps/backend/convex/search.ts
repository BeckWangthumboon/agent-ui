import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";

import {
  ComponentFrameworkValidator,
  ComponentMotionValidator,
  ComponentStylingValidator,
} from "./validators";

type ComponentRecord = Doc<"components">;

type SearchCandidate = Pick<
  ComponentRecord,
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

type ComponentFilters = {
  framework?: SearchCandidate["framework"];
  styling?: SearchCandidate["styling"];
  motion?: SearchCandidate["motionLevel"];
};

function toSearchCandidate(component: ComponentRecord): SearchCandidate {
  return {
    id: component.id,
    name: component.name,
    source: component.source,
    framework: component.framework,
    styling: component.styling,
    dependencies: component.dependencies,
    intent: component.intent,
    capabilities: component.capabilities,
    synonyms: component.synonyms,
    topics: component.topics,
    motionLevel: component.motionLevel,
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

  return true;
}

export const componentsQuery = query({
  args: {
    query: v.string(),
    filters: v.optional(
      v.object({
        framework: v.optional(ComponentFrameworkValidator),
        styling: v.optional(ComponentStylingValidator),
        motion: v.optional(ComponentMotionValidator),
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
    let componentsFromIndex: ComponentRecord[];

    if (frameworkFilter !== undefined) {
      componentsFromIndex = await ctx.db
        .query("components")
        .withIndex("by_framework", (indexQuery) => indexQuery.eq("framework", frameworkFilter))
        .collect();
    } else if (stylingFilter !== undefined) {
      componentsFromIndex = await ctx.db
        .query("components")
        .withIndex("by_styling", (indexQuery) => indexQuery.eq("styling", stylingFilter))
        .collect();
    } else if (motionFilter !== undefined) {
      componentsFromIndex = await ctx.db
        .query("components")
        .withIndex("by_motion_level", (indexQuery) => indexQuery.eq("motionLevel", motionFilter))
        .collect();
    } else {
      componentsFromIndex = await ctx.db.query("components").collect();
    }

    return componentsFromIndex
      .filter((component) =>
        matchesFilters(component, {
          framework: frameworkFilter,
          styling: stylingFilter,
          motion: motionFilter,
        }),
      )
      .map(toSearchCandidate);
  },
});
