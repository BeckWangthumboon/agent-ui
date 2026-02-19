import { v } from "convex/values";

import { query } from "./_generated/server";

const SnapshotTableValidator = v.union(
  v.literal("components"),
  v.literal("componentCode"),
  v.literal("componentSearch"),
);

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 250;

export const exportTablePage = query({
  args: {
    table: SnapshotTableValidator,
    cursor: v.optional(v.string()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const pageSize = normalizePageSize(args.pageSize);
    const cursor = args.cursor ?? null;

    switch (args.table) {
      case "components":
        return ctx.db.query("components").paginate({
          cursor,
          numItems: pageSize,
        });
      case "componentCode":
        return ctx.db.query("componentCode").paginate({
          cursor,
          numItems: pageSize,
        });
      case "componentSearch":
        return ctx.db.query("componentSearch").paginate({
          cursor,
          numItems: pageSize,
        });
      default:
        throw new Error(`Unsupported snapshot table: ${String(args.table)}`);
    }
  },
});

function normalizePageSize(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined) {
    return DEFAULT_PAGE_SIZE;
  }

  const floored = Math.floor(value);

  if (floored <= 0) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(floored, MAX_PAGE_SIZE);
}
