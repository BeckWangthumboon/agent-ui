import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";

type ComponentRecord = Doc<"components">;
type ComponentSearchRecord = Doc<"componentSearch">;

type ComponentAnnotations = Pick<
  ComponentSearchRecord,
  "intent" | "capabilities" | "synonyms" | "topics"
>;

type ComponentMetadata = Pick<
  ComponentRecord,
  | "id"
  | "name"
  | "source"
  | "framework"
  | "styling"
  | "dependencies"
  | "install"
  | "motionLevel"
  | "primitiveLibrary"
  | "animationLibrary"
  | "constraints"
> &
  ComponentAnnotations;

type ComponentDirectorySource = Pick<ComponentRecord["source"], "library" | "author">;

type ComponentDirectoryItem = Pick<
  ComponentRecord,
  "id" | "name" | "motionLevel" | "primitiveLibrary" | "animationLibrary"
> & {
  intent: string;
  source: ComponentDirectorySource;
};

function toFallbackIntent(componentName: string): string {
  const trimmedName = componentName.trim();
  return trimmedName.length > 0 ? trimmedName : "Unnamed component";
}

function toAnnotations(
  search: ComponentSearchRecord | null | undefined,
  componentName: string,
): ComponentAnnotations {
  return {
    intent: search?.intent ?? toFallbackIntent(componentName),
    capabilities: search?.capabilities ?? [],
    synonyms: search?.synonyms ?? [],
    topics: search?.topics ?? [],
  };
}

function toComponentMetadata(
  component: ComponentRecord,
  search: ComponentSearchRecord | null | undefined,
): ComponentMetadata {
  return {
    id: component.id,
    name: component.name,
    source: component.source,
    framework: component.framework,
    styling: component.styling,
    dependencies: component.dependencies,
    install: component.install,
    motionLevel: component.motionLevel,
    primitiveLibrary: component.primitiveLibrary,
    animationLibrary: component.animationLibrary,
    constraints: component.constraints,
    ...toAnnotations(search, component.name),
  };
}

function toDirectoryItem(
  component: ComponentRecord,
  search: ComponentSearchRecord | null | undefined,
): ComponentDirectoryItem {
  return {
    id: component.id,
    name: component.name,
    intent: toAnnotations(search, component.name).intent,
    motionLevel: component.motionLevel,
    primitiveLibrary: component.primitiveLibrary,
    animationLibrary: component.animationLibrary,
    source: {
      library: component.source.library,
      author: component.source.author,
    },
  };
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

async function findSearchByComponentId(
  ctx: QueryCtx,
  componentId: string,
): Promise<ComponentSearchRecord | null> {
  return ctx.db
    .query("componentSearch")
    .withIndex("by_component_id", (indexQuery) => indexQuery.eq("componentId", componentId))
    .unique();
}

export const listDirectory = query({
  args: {},
  handler: async (ctx) => {
    const [components, searchRecords] = await Promise.all([
      ctx.db.query("components").collect(),
      ctx.db.query("componentSearch").collect(),
    ]);
    const searchByComponentId = new Map(
      searchRecords.map((searchRecord) => [searchRecord.componentId, searchRecord]),
    );

    return components
      .map((component) => toDirectoryItem(component, searchByComponentId.get(component.id)))
      .sort((left, right) => left.name.localeCompare(right.name, "en"));
  },
});

export const getMetadataById = query({
  args: {
    id: v.string(),
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

    const search = await findSearchByComponentId(ctx, component.id);
    return toComponentMetadata(component, search);
  },
});

export const getMetadataByIds = query({
  args: {
    ids: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedIds = Array.from(
      new Set(args.ids.map((id) => id.trim()).filter((id) => id.length > 0)),
    );

    if (normalizedIds.length === 0) {
      return [];
    }

    const results: ComponentMetadata[] = [];

    for (const id of normalizedIds) {
      const component = await ctx.db
        .query("components")
        .withIndex("by_component_id", (indexQuery) => indexQuery.eq("id", id))
        .unique();

      if (!component) {
        continue;
      }

      const search = await findSearchByComponentId(ctx, component.id);
      results.push(toComponentMetadata(component, search));
    }

    return results;
  },
});
