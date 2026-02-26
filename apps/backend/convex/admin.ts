import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";

import {
  buildPublicComponentId,
  buildSplitComponentRecords,
  type ComponentDocument,
} from "../../../shared/component-schema";
import {
  ComponentCodeFileValidator,
  ComponentDocumentValidator,
  ComponentInstallValidator,
} from "./validators";

type SplitComponentRecords = Awaited<ReturnType<typeof buildSplitComponentRecords>>;

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

async function findSearchByComponentId(ctx: MutationCtx, componentId: string) {
  return ctx.db
    .query("componentSearch")
    .withIndex("by_component_id", (indexQuery) => indexQuery.eq("componentId", componentId))
    .unique();
}

async function findEmbeddingsByComponentId(ctx: MutationCtx, componentId: string) {
  return ctx.db
    .query("componentEmbeddings")
    .withIndex("by_component_id", (indexQuery) => indexQuery.eq("componentId", componentId))
    .collect();
}

async function findFilesByComponentId(ctx: MutationCtx, componentId: string) {
  return ctx.db
    .query("componentFiles")
    .withIndex("by_component_id", (indexQuery) => indexQuery.eq("componentId", componentId))
    .collect();
}

async function findCodeByComponentId(ctx: MutationCtx, componentId: string) {
  return ctx.db
    .query("componentCode")
    .withIndex("by_component_id", (indexQuery) => indexQuery.eq("componentId", componentId))
    .unique();
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

async function upsertSplitRecords(ctx: MutationCtx, records: SplitComponentRecords) {
  const [existingMetadata, existingCode, existingFiles, existingSearch] = await Promise.all([
    findMetadataByComponentId(ctx, records.metadata.id),
    findCodeByComponentId(ctx, records.code.componentId),
    findFilesByComponentId(ctx, records.code.componentId),
    findSearchByComponentId(ctx, records.search.componentId),
  ]);

  const hadExistingRows =
    existingMetadata !== null ||
    existingCode !== null ||
    existingSearch !== null ||
    existingFiles.length > 0;

  if (existingMetadata) {
    await ctx.db.replace(existingMetadata._id, records.metadata);
  } else {
    await ctx.db.insert("components", records.metadata);
  }

  if (existingCode) {
    await ctx.db.replace(existingCode._id, records.code);
  } else {
    await ctx.db.insert("componentCode", records.code);
  }

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

  if (existingSearch) {
    await ctx.db.replace(existingSearch._id, records.search);
  } else {
    await ctx.db.insert("componentSearch", records.search);
  }

  return {
    status: hadExistingRows ? "updated" : "inserted",
    componentId: records.metadata.id,
  };
}

async function deleteComponentRowsById(ctx: MutationCtx, componentId: string) {
  const [metadata, code, files, search, embeddings] = await Promise.all([
    findMetadataByComponentId(ctx, componentId),
    findCodeByComponentId(ctx, componentId),
    findFilesByComponentId(ctx, componentId),
    findSearchByComponentId(ctx, componentId),
    findEmbeddingsByComponentId(ctx, componentId),
  ]);

  if (metadata) {
    await ctx.db.delete(metadata._id);
  }
  if (code) {
    await ctx.db.delete(code._id);
  }
  for (const file of files) {
    await ctx.db.delete(file._id);
  }
  if (search) {
    await ctx.db.delete(search._id);
  }
  for (const embedding of embeddings) {
    await ctx.db.delete(embedding._id);
  }

  const deletedCounts = {
    components: metadata ? 1 : 0,
    componentCode: code ? 1 : 0,
    componentFiles: files.length,
    componentSearch: search ? 1 : 0,
    componentEmbeddings: embeddings.length,
  };
  const totalDeleted =
    deletedCounts.components +
    deletedCounts.componentCode +
    deletedCounts.componentFiles +
    deletedCounts.componentSearch +
    deletedCounts.componentEmbeddings;

  return {
    status: totalDeleted > 0 ? "deleted" : "not_found",
    componentId,
    deleted: deletedCounts,
    totalDeleted,
  };
}

function normalizePageSize(rawPageSize: number | undefined) {
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
      v.literal("componentEmbeddings"),
    ),
    cursor: v.optional(v.string()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const table = args.table;
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
      const {
        _id: _metadataId,
        _creationTime: _metadataCreationTime,
        ...metadataFields
      } = metadata;
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
    return upsertSplitRecords(ctx, records);
  },
});

export const deleteComponentById = mutation({
  args: {
    componentId: v.string(),
  },
  handler: async (ctx, args) => {
    const componentId = args.componentId.trim();
    if (componentId.length === 0) {
      throw new Error("componentId must be non-empty");
    }

    return deleteComponentRowsById(ctx, componentId);
  },
});

const ChangesetOperationValidator = v.union(
  v.object({
    type: v.literal("upsert"),
    component: ComponentDocumentValidator,
  }),
  v.object({
    type: v.literal("delete"),
    componentId: v.string(),
  }),
);

type ResolvedChangesetOperation =
  | {
      type: "upsert";
      componentId: string;
      component: ComponentDocument;
    }
  | {
      type: "delete";
      componentId: string;
    };

export const applyChangeset = mutation({
  args: {
    changesetId: v.string(),
    operations: v.array(ChangesetOperationValidator),
  },
  handler: async (ctx, args) => {
    const changesetId = args.changesetId.trim();
    if (changesetId.length === 0) {
      throw new Error("changesetId must be non-empty");
    }

    const seenUpsertIds = new Set<string>();
    const seenDeleteIds = new Set<string>();
    const resolved: ResolvedChangesetOperation[] = [];

    for (const [index, operation] of args.operations.entries()) {
      if (operation.type === "upsert") {
        const componentId = await buildPublicComponentId(operation.component);

        if (seenUpsertIds.has(componentId)) {
          throw new Error(
            `Duplicate upsert target component id '${componentId}' at operation #${index}`,
          );
        }

        seenUpsertIds.add(componentId);
        resolved.push({
          type: "upsert",
          componentId,
          component: operation.component,
        });
        continue;
      }

      const componentId = operation.componentId.trim();
      if (componentId.length === 0) {
        throw new Error(`Delete operation at index ${index} has empty componentId`);
      }

      if (seenDeleteIds.has(componentId)) {
        throw new Error(
          `Duplicate delete target component id '${componentId}' at operation #${index}`,
        );
      }

      seenDeleteIds.add(componentId);
      resolved.push({
        type: "delete",
        componentId,
      });
    }

    for (const componentId of seenUpsertIds) {
      if (seenDeleteIds.has(componentId)) {
        throw new Error(
          `Conflicting operations for '${componentId}': contains both upsert and delete`,
        );
      }
    }

    const applied: Array<{ type: "upsert" | "delete"; componentId: string; result: unknown }> = [];

    for (const operation of resolved) {
      if (operation.type === "upsert") {
        const records = await buildSplitComponentRecords(operation.component);
        const result = await upsertSplitRecords(ctx, records);
        applied.push({
          type: "upsert",
          componentId: operation.componentId,
          result,
        });
      } else {
        const result = await deleteComponentRowsById(ctx, operation.componentId);
        applied.push({
          type: "delete",
          componentId: operation.componentId,
          result,
        });
      }
    }

    return {
      status: "applied" as const,
      changesetId,
      operationCount: resolved.length,
      upsertCount: resolved.filter((operation) => operation.type === "upsert").length,
      deleteCount: resolved.filter((operation) => operation.type === "delete").length,
      applied,
    };
  },
});
