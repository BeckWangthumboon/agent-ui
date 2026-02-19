import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";

import { buildSplitComponentRecords } from "../../../shared/component-schema";
import { ComponentDocumentValidator } from "./validators";

type ComponentRecord = Doc<"components">;

type ComponentMetadata = Pick<
  ComponentRecord,
  "id" | "name" | "source" | "framework" | "styling" | "dependencies" | "intent" | "motionLevel"
> & {
  legacyId: string;
  primitiveLibrary: string;
  animationLibrary: string;
};

type ComponentDirectorySource = Pick<ComponentRecord["source"], "library" | "author">;

type ComponentDirectoryItem = Pick<ComponentRecord, "id" | "name" | "intent" | "motionLevel"> & {
  legacyId: string;
  primitiveLibrary: string;
  animationLibrary: string;
  source: ComponentDirectorySource;
};

function toComponentMetadata(component: ComponentRecord): ComponentMetadata {
  return {
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
  };
}

function toDirectoryItem(component: ComponentRecord): ComponentDirectoryItem {
  return {
    id: component.id,
    legacyId: component.legacyId,
    name: component.name,
    intent: component.intent,
    motionLevel: component.motionLevel,
    primitiveLibrary: component.primitiveLibrary,
    animationLibrary: component.animationLibrary,
    source: {
      library: component.source.library,
      author: component.source.author,
    },
  };
}

export const listDirectory = query({
  args: {},
  handler: async (ctx) => {
    const components = await ctx.db.query("components").collect();

    return components
      .map(toDirectoryItem)
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

    const exact = await ctx.db
      .query("components")
      .withIndex("by_component_id", (indexQuery) => indexQuery.eq("id", normalizedId))
      .unique();

    if (exact) {
      return toComponentMetadata(exact);
    }

    const legacy = await ctx.db
      .query("components")
      .withIndex("by_legacy_component_id", (indexQuery) => indexQuery.eq("legacyId", normalizedId))
      .unique();

    if (legacy) {
      return toComponentMetadata(legacy);
    }

    const normalizedLower = normalizedId.toLowerCase();
    const components = await ctx.db.query("components").collect();
    const insensitiveMatch = components.find(
      (component) =>
        component.id.toLowerCase() === normalizedLower ||
        component.legacyId.toLowerCase() === normalizedLower,
    );

    if (!insensitiveMatch) {
      return null;
    }

    return toComponentMetadata(insensitiveMatch);
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

      if (component) {
        results.push(toComponentMetadata(component));
      }
    }

    return results;
  },
});

export const upsert = mutation({
  args: {
    component: ComponentDocumentValidator,
  },
  handler: async (ctx, args) => {
    const records = await buildSplitComponentRecords(args.component);

    let existingMetadata = await ctx.db
      .query("components")
      .withIndex("by_component_id", (indexQuery) => indexQuery.eq("id", records.metadata.id))
      .unique();

    if (!existingMetadata) {
      existingMetadata = await ctx.db
        .query("components")
        .withIndex("by_legacy_component_id", (indexQuery) =>
          indexQuery.eq("legacyId", records.metadata.legacyId),
        )
        .unique();
    }

    if (existingMetadata) {
      await ctx.db.replace(existingMetadata._id, records.metadata);
    } else {
      await ctx.db.insert("components", records.metadata);
    }

    const existingCode = await ctx.db
      .query("componentCode")
      .withIndex("by_component_id", (indexQuery) =>
        indexQuery.eq("componentId", records.code.componentId),
      )
      .unique();

    if (existingCode) {
      await ctx.db.replace(existingCode._id, records.code);
    } else {
      await ctx.db.insert("componentCode", records.code);
    }

    const existingSearch = await ctx.db
      .query("componentSearch")
      .withIndex("by_component_id", (indexQuery) =>
        indexQuery.eq("componentId", records.search.componentId),
      )
      .unique();

    if (existingSearch) {
      await ctx.db.replace(existingSearch._id, records.search);
      return {
        status: "updated",
        componentId: records.metadata.id,
        legacyId: records.metadata.legacyId,
      };
    }

    await ctx.db.insert("componentSearch", records.search);
    return {
      status: "inserted",
      componentId: records.metadata.id,
      legacyId: records.metadata.legacyId,
    };
  },
});

export const replaceAll = mutation({
  args: {
    components: v.array(ComponentDocumentValidator),
  },
  handler: async (ctx, args) => {
    await deleteAll(ctx);

    const ids: string[] = [];

    for (const component of args.components) {
      const records = await buildSplitComponentRecords(component);
      await ctx.db.insert("components", records.metadata);
      await ctx.db.insert("componentCode", records.code);
      await ctx.db.insert("componentSearch", records.search);
      ids.push(records.metadata.id);
    }

    return {
      inserted: ids.length,
      ids,
    };
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    return deleteAll(ctx);
  },
});

async function deleteAll(ctx: MutationCtx): Promise<{
  componentsDeleted: number;
  componentCodeDeleted: number;
  componentSearchDeleted: number;
}> {
  const metadata = await ctx.db.query("components").collect();
  const code = await ctx.db.query("componentCode").collect();
  const search = await ctx.db.query("componentSearch").collect();

  for (const document of metadata) {
    await ctx.db.delete(document._id);
  }

  for (const document of code) {
    await ctx.db.delete(document._id);
  }

  for (const document of search) {
    await ctx.db.delete(document._id);
  }

  return {
    componentsDeleted: metadata.length,
    componentCodeDeleted: code.length,
    componentSearchDeleted: search.length,
  };
}
