import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";

import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "./validators";

const EmbeddingUpsertValidator = v.object({
  componentId: v.string(),
  model: v.literal(EMBEDDING_MODEL),
  embedding: v.array(v.float64()),
});

type EmbeddingUpsert = {
  componentId: string;
  model: typeof EMBEDDING_MODEL;
  embedding: number[];
};

function normalizeComponentId(componentId: string): string {
  return componentId.trim();
}

function embeddingsEqual(left: number[], right: number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function validateEmbeddingVector(componentId: string, embedding: number[]): void {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding dimension mismatch for '${componentId}': expected ${EMBEDDING_DIMENSIONS}, received ${embedding.length}`,
    );
  }

  for (const [index, value] of embedding.entries()) {
    if (!Number.isFinite(value)) {
      throw new Error(`Embedding value at index ${index} for '${componentId}' is not finite`);
    }
  }
}

async function listEmbeddingsByComponentId(ctx: MutationCtx, componentId: string) {
  return ctx.db
    .query("componentEmbeddings")
    .withIndex("by_component_id", (indexQuery) => indexQuery.eq("componentId", componentId))
    .collect();
}

async function upsertOne(
  ctx: MutationCtx,
  entry: EmbeddingUpsert,
): Promise<{
  inserted: number;
  updated: number;
  unchanged: number;
  duplicateRowsDeleted: number;
}> {
  validateEmbeddingVector(entry.componentId, entry.embedding);
  const existingRows = await listEmbeddingsByComponentId(ctx, entry.componentId);

  if (existingRows.length === 0) {
    await ctx.db.insert("componentEmbeddings", {
      schemaVersion: 1,
      componentId: entry.componentId,
      model: entry.model,
      embedding: entry.embedding,
    });
    return {
      inserted: 1,
      updated: 0,
      unchanged: 0,
      duplicateRowsDeleted: 0,
    };
  }

  const [primaryRow, ...duplicates] = existingRows;
  for (const duplicate of duplicates) {
    await ctx.db.delete(duplicate._id);
  }

  if (
    primaryRow &&
    primaryRow.model === entry.model &&
    embeddingsEqual(primaryRow.embedding, entry.embedding)
  ) {
    return {
      inserted: 0,
      updated: 0,
      unchanged: 1,
      duplicateRowsDeleted: duplicates.length,
    };
  }

  if (!primaryRow) {
    throw new Error(`Unexpected missing primary embedding row for '${entry.componentId}'`);
  }

  await ctx.db.replace(primaryRow._id, {
    schemaVersion: 1,
    componentId: entry.componentId,
    model: entry.model,
    embedding: entry.embedding,
  });

  return {
    inserted: 0,
    updated: 1,
    unchanged: 0,
    duplicateRowsDeleted: duplicates.length,
  };
}

export const upsertMany = mutation({
  args: {
    entries: v.array(EmbeddingUpsertValidator),
  },
  handler: async (ctx, args) => {
    if (args.entries.length === 0) {
      return {
        inserted: 0,
        updated: 0,
        unchanged: 0,
        duplicateRowsDeleted: 0,
      };
    }

    const seenComponentIds = new Set<string>();
    const normalizedEntries: EmbeddingUpsert[] = [];

    for (const entry of args.entries) {
      const componentId = normalizeComponentId(entry.componentId);

      if (componentId.length === 0) {
        throw new Error("componentId must be non-empty");
      }

      if (seenComponentIds.has(componentId)) {
        throw new Error(`Duplicate componentId in upsertMany payload: '${componentId}'`);
      }
      seenComponentIds.add(componentId);

      normalizedEntries.push({
        componentId,
        model: entry.model,
        embedding: entry.embedding,
      });
    }

    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    let duplicateRowsDeleted = 0;

    for (const entry of normalizedEntries) {
      const result = await upsertOne(ctx, entry);
      inserted += result.inserted;
      updated += result.updated;
      unchanged += result.unchanged;
      duplicateRowsDeleted += result.duplicateRowsDeleted;
    }

    return {
      inserted,
      updated,
      unchanged,
      duplicateRowsDeleted,
    };
  },
});

export const deleteMany = mutation({
  args: {
    componentIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedComponentIds = Array.from(
      new Set(args.componentIds.map((componentId) => normalizeComponentId(componentId))),
    ).filter((componentId) => componentId.length > 0);

    if (normalizedComponentIds.length === 0) {
      return { deleted: 0 };
    }

    let deleted = 0;
    for (const componentId of normalizedComponentIds) {
      const rows = await listEmbeddingsByComponentId(ctx, componentId);
      for (const row of rows) {
        await ctx.db.delete(row._id);
        deleted += 1;
      }
    }

    return { deleted };
  },
});
