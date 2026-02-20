import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  ComponentAnimationLibraryValidator,
  ComponentMotionValidator,
  ComponentPrimitiveLibraryValidator,
  ComponentStylingValidator,
  ComponentTopicValidator,
  DependencyKindValidator,
} from "./validators";

function assertNonEmpty(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${field} must be non-empty.`);
  }
  return trimmed;
}

function assertOptionalTrimmed(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function assertUrl(value: string, field: string): string {
  const normalized = assertNonEmpty(value, field);

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("invalid protocol");
    }
  } catch {
    throw new Error(`${field} must be a valid http/https URL.`);
  }

  return normalized;
}

function normalizeUniqueTextArray(values: string[], field: string): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const item = assertNonEmpty(value, field).toLowerCase();
    if (!seen.has(item)) {
      seen.add(item);
      normalized.push(item);
    }
  }

  return normalized;
}

async function findComponentById(ctx: QueryCtx | MutationCtx, componentId: string) {
  return ctx.db
    .query("components")
    .withIndex("by_component_id", (q) => q.eq("id", componentId))
    .unique();
}

async function findSearchByComponentId(ctx: QueryCtx | MutationCtx, componentId: string) {
  return ctx.db
    .query("componentSearch")
    .withIndex("by_component_id", (q) => q.eq("componentId", componentId))
    .unique();
}

export const getForEdit = query({
  args: {
    componentId: v.string(),
  },
  handler: async (ctx, args) => {
    const componentId = assertNonEmpty(args.componentId, "componentId");
    const component = await findComponentById(ctx, componentId);

    if (!component) {
      return null;
    }

    const search = await findSearchByComponentId(ctx, component.id);

    return {
      componentId: component.id,
      name: component.name,
      framework: component.framework,
      styling: component.styling,
      motionLevel: component.motionLevel,
      primitiveLibrary: component.primitiveLibrary,
      animationLibrary: component.animationLibrary,
      source: {
        url: component.source.url,
        library: component.source.library ?? "",
        repo: component.source.repo ?? "",
        author: component.source.author ?? "",
        license: component.source.license ?? "",
      },
      dependencies: component.dependencies,
      intent: search?.intent ?? "",
      capabilities: search?.capabilities ?? [],
      synonyms: search?.synonyms ?? [],
      topics: search?.topics ?? [],
    };
  },
});

export const updateExisting = mutation({
  args: {
    componentId: v.string(),
    name: v.string(),
    styling: ComponentStylingValidator,
    motionLevel: ComponentMotionValidator,
    primitiveLibrary: ComponentPrimitiveLibraryValidator,
    animationLibrary: ComponentAnimationLibraryValidator,
    source: v.object({
      url: v.string(),
      library: v.optional(v.string()),
      repo: v.optional(v.string()),
      author: v.optional(v.string()),
      license: v.optional(v.string()),
    }),
    dependencies: v.array(
      v.object({
        name: v.string(),
        kind: DependencyKindValidator,
      }),
    ),
    intent: v.string(),
    capabilities: v.array(v.string()),
    synonyms: v.array(v.string()),
    topics: v.array(ComponentTopicValidator),
  },
  handler: async (ctx, args) => {
    const componentId = assertNonEmpty(args.componentId, "componentId");
    const existingComponent = await findComponentById(ctx, componentId);

    if (!existingComponent) {
      throw new Error("Component does not exist.");
    }

    const existingSearch = await findSearchByComponentId(ctx, componentId);
    if (!existingSearch) {
      throw new Error("Component search record does not exist.");
    }

    const normalizedDependencies = args.dependencies.map((dependency) => ({
      name: assertNonEmpty(dependency.name, "dependency.name"),
      kind: dependency.kind,
    }));

    const normalizedName = assertNonEmpty(args.name, "name");
    const normalizedIntent = assertNonEmpty(args.intent, "intent");

    await ctx.db.replace(existingComponent._id, {
      schemaVersion: existingComponent.schemaVersion,
      id: existingComponent.id,
      name: normalizedName,
      framework: existingComponent.framework,
      styling: args.styling,
      motionLevel: args.motionLevel,
      primitiveLibrary: args.primitiveLibrary,
      animationLibrary: args.animationLibrary,
      dependencies: normalizedDependencies,
      constraints: existingComponent.constraints,
      source: {
        url: assertUrl(args.source.url, "source.url"),
        library: assertOptionalTrimmed(args.source.library),
        repo: assertOptionalTrimmed(args.source.repo),
        author: assertOptionalTrimmed(args.source.author),
        license: assertOptionalTrimmed(args.source.license),
      },
    });

    await ctx.db.replace(existingSearch._id, {
      schemaVersion: existingSearch.schemaVersion,
      componentId: existingSearch.componentId,
      intent: normalizedIntent,
      capabilities: normalizeUniqueTextArray(args.capabilities, "capabilities"),
      synonyms: normalizeUniqueTextArray(args.synonyms, "synonyms"),
      topics: Array.from(new Set(args.topics)),
    });

    return {
      componentId,
      status: "updated",
    } as const;
  },
});

export const deleteExisting = mutation({
  args: {
    componentId: v.string(),
  },
  handler: async (ctx, args) => {
    const componentId = assertNonEmpty(args.componentId, "componentId");

    const existingComponent = await findComponentById(ctx, componentId);
    if (!existingComponent) {
      throw new Error("Component does not exist.");
    }

    const existingSearch = await findSearchByComponentId(ctx, componentId);
    if (!existingSearch) {
      throw new Error("Component search record does not exist.");
    }

    await ctx.db.delete(existingComponent._id);
    await ctx.db.delete(existingSearch._id);

    return {
      componentId,
      status: "deleted",
    } as const;
  },
});
