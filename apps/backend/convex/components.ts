import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

import { ComponentDocumentValidator } from "./validators";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("components").collect();
  },
});

export const getById = query({
  args: {
    id: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("components")
      .withIndex("by_component_id", (query) => query.eq("id", args.id))
      .unique();
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
