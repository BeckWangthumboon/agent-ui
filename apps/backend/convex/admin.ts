import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";

import { buildSplitComponentRecords } from "../../../shared/component-schema";
import { ComponentCodeFileValidator, ComponentDocumentValidator, ComponentInstallValidator } from "./validators";

type ComponentSearchRecord = Doc<"componentSearch">;
type ComponentFileRecord = Doc<"componentFiles">;
type ExportableTable = "components" | "componentCode" | "componentFiles" | "componentSearch";

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

async function findFilesByComponentId(
  ctx: MutationCtx,
  componentId: string,
): Promise<ComponentFileRecord[]> {
  return ctx.db
    .query("componentFiles")
    .withIndex("by_component_id", (indexQuery) => indexQuery.eq("componentId", componentId))
    .collect();
}

async function findMetadataByComponentId(ctx: MutationCtx, componentId: string) {
  return ctx.db
    .query("components")
    .withIndex("by_component_id", (indexQuery) => indexQuery.eq("id", componentId))
    .unique();
}

async function findExampleFilesByComponentId(ctx: MutationCtx, componentId: string) {
  return ctx.db
    .query("componentFiles")
    .withIndex("by_component_kind", (indexQuery) =>
      indexQuery.eq("componentId", componentId).eq("kind", "example"),
    )
    .collect();
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
      v.literal("componentFiles"),
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

export const patchInstallExample = mutation({
  args: {
    componentId: v.string(),
    install: v.optional(ComponentInstallValidator),
    clearInstall: v.optional(v.boolean()),
    example: v.optional(ComponentCodeFileValidator),
    clearExample: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const metadata = await findMetadataByComponentId(ctx, args.componentId);
    if (!metadata) {
      throw new Error(`Component not found: ${args.componentId}`);
    }

    const shouldSetInstall = args.install !== undefined;
    const shouldClearInstall = args.clearInstall === true;

    if (shouldSetInstall && shouldClearInstall) {
      throw new Error("Pass either install or clearInstall, not both");
    }

    if (shouldSetInstall || shouldClearInstall) {
      const { _id: _metadataId, _creationTime: _metadataCreationTime, ...metadataFields } = metadata;
      void _metadataId;
      void _metadataCreationTime;

      const nextMetadata = {
        ...metadataFields,
        ...(shouldSetInstall ? { install: args.install } : {}),
      };

      if (shouldClearInstall) {
        delete nextMetadata.install;
      }

      await ctx.db.replace(metadata._id, nextMetadata);
    }

    const shouldSetExample = args.example !== undefined;
    const shouldClearExample = args.clearExample === true;

    if (shouldSetExample && shouldClearExample) {
      throw new Error("Pass either example or clearExample, not both");
    }

    if (shouldSetExample || shouldClearExample) {
      const existingExamples = await findExampleFilesByComponentId(ctx, args.componentId);

      if (shouldSetExample && args.example) {
        const nextExample = {
          schemaVersion: 5 as const,
          componentId: args.componentId,
          kind: "example" as const,
          path: args.example.path,
          content: args.example.content,
        };

        if (existingExamples.length > 0) {
          await ctx.db.replace(existingExamples[0]!._id, nextExample);
          for (const duplicate of existingExamples.slice(1)) {
            await ctx.db.delete(duplicate._id);
          }
        } else {
          await ctx.db.insert("componentFiles", nextExample);
        }
      }

      if (shouldClearExample) {
        for (const row of existingExamples) {
          await ctx.db.delete(row._id);
        }
      }
    }

    return {
      status: "patched",
      componentId: args.componentId,
      installUpdated: shouldSetInstall || shouldClearInstall,
      exampleUpdated: shouldSetExample || shouldClearExample,
    };
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

    const existingFiles = await findFilesByComponentId(ctx, records.code.componentId);
    const existingFileByPath = new Map(existingFiles.map((row) => [row.path, row]));
    const nextFileByPath = new Map(records.files.map((row) => [row.path, row]));
    const visitedPaths = new Set<string>();

    for (const existingFile of existingFiles) {
      if (visitedPaths.has(existingFile.path)) {
        await ctx.db.delete(existingFile._id);
        continue;
      }
      visitedPaths.add(existingFile.path);

      const nextFile = nextFileByPath.get(existingFile.path);
      if (!nextFile) {
        await ctx.db.delete(existingFile._id);
        continue;
      }

      await ctx.db.replace(existingFile._id, nextFile);
    }

    for (const nextFile of records.files) {
      if (existingFileByPath.has(nextFile.path)) {
        continue;
      }

      await ctx.db.insert("componentFiles", nextFile);
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
