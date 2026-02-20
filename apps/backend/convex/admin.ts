import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";

import { buildSplitComponentRecords } from "../../../shared/component-schema";
import { ComponentDocumentValidator } from "./validators";

type ComponentSearchRecord = Doc<"componentSearch">;
type ExportableTable = "components" | "componentCode" | "componentSearch";

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

async function findSearchByComponentId(
  ctx: MutationCtx,
  componentId: string,
): Promise<ComponentSearchRecord | null> {
  return ctx.db
    .query("componentSearch")
    .withIndex("by_component_id", (indexQuery) => indexQuery.eq("componentId", componentId))
    .unique();
}

function normalizePageSize(rawPageSize: number | undefined): number {
  if (rawPageSize === undefined || !Number.isFinite(rawPageSize)) {
    return DEFAULT_PAGE_SIZE;
  }

  const rounded = Math.floor(rawPageSize);
  if (rounded <= 0) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(rounded, MAX_PAGE_SIZE);
}

export const exportTablePage = query({
  args: {
    table: v.union(
      v.literal("components"),
      v.literal("componentCode"),
      v.literal("componentSearch"),
    ),
    cursor: v.optional(v.string()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const table: ExportableTable = args.table;
    const pageSize = normalizePageSize(args.pageSize);

    return ctx.db.query(table).paginate({
      numItems: pageSize,
      cursor: args.cursor ?? null,
    });
  },
});

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
