import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";

import { ComponentDocumentValidator } from "./validators";

type ComponentRecord = Doc<"components">;

type ComponentMetadata = Pick<
  ComponentRecord,
  "id" | "name" | "source" | "framework" | "styling" | "dependencies" | "intent" | "motionLevel"
>;

type ComponentDirectorySource = Pick<ComponentRecord["source"], "library" | "author">;

type ComponentDirectoryItem = Pick<ComponentRecord, "id" | "name" | "intent" | "motionLevel"> & {
  source: ComponentDirectorySource;
};

function toComponentMetadata(component: ComponentRecord): ComponentMetadata {
  return {
    id: component.id,
    name: component.name,
    source: component.source,
    framework: component.framework,
    styling: component.styling,
    dependencies: component.dependencies,
    intent: component.intent,
    motionLevel: component.motionLevel,
  };
}

function toDirectoryItem(component: ComponentRecord): ComponentDirectoryItem {
  return {
    id: component.id,
    name: component.name,
    intent: component.intent,
    motionLevel: component.motionLevel,
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
    const component = await ctx.db
      .query("components")
      .withIndex("by_component_id", (query) => query.eq("id", args.id))
      .unique();

    if (!component) {
      return null;
    }

    return toComponentMetadata(component);
  },
});

export const upsert = mutation({
  args: {
    component: ComponentDocumentValidator,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("components")
      .withIndex("by_component_id", (query) => query.eq("id", args.component.id))
      .unique();

    if (existing) {
      await ctx.db.replace(existing._id, args.component);
      return {
        status: "updated",
        componentId: args.component.id,
      };
    }

    await ctx.db.insert("components", args.component);
    return {
      status: "inserted",
      componentId: args.component.id,
    };
  },
});
