import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

import { buildSplitComponentRecords } from "../../../shared/component-schema";
import { ComponentDocumentValidator } from "./validators";

type ComponentSearchRecord = Doc<"componentSearch">;

async function findSearchByComponentId(
  ctx: MutationCtx,
  componentId: string,
): Promise<ComponentSearchRecord | null> {
  return ctx.db
    .query("componentSearch")
    .withIndex("by_component_id", (indexQuery) => indexQuery.eq("componentId", componentId))
    .unique();
}

export const upsert = mutation({
  args: {
    component: ComponentDocumentValidator,
  },
  handler: async (ctx, args) => {
    const records = await buildSplitComponentRecords(args.component);

    const existingMetadata = await ctx.db
      .query("components")
      .withIndex("by_component_id", (indexQuery) => indexQuery.eq("id", records.metadata.id))
      .unique();

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

    const existingSearch = await findSearchByComponentId(ctx, records.search.componentId);

    if (existingSearch) {
      await ctx.db.replace(existingSearch._id, records.search);
      return {
        status: "updated",
        componentId: records.metadata.id,
      };
    }

    await ctx.db.insert("componentSearch", records.search);
    return {
      status: "inserted",
      componentId: records.metadata.id,
    };
  },
});
