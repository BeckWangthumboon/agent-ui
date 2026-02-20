import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";

import { buildSplitComponentRecords } from "../../../shared/component-schema";
import {
  ComponentMetadataDocumentSchema,
  ComponentSearchDocumentSchema,
} from "../../../shared/component-schema";
import {
  ComponentAnimationLibraryValidator,
  ComponentDocumentValidator,
  ComponentFrameworkValidator,
  ComponentMotionValidator,
  ComponentPrimitiveLibraryValidator,
  ComponentSourceValidator,
  ComponentStylingValidator,
  ComponentTopicValidator,
  DependencyValidator,
} from "./validators";

type ComponentRecord = Doc<"components">;
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

async function findSearchByComponentIdForQuery(
  ctx: QueryCtx,
  componentId: string,
): Promise<ComponentSearchRecord | null> {
  return ctx.db
    .query("componentSearch")
    .withIndex("by_component_id", (indexQuery) => indexQuery.eq("componentId", componentId))
    .unique();
}

async function findComponentById(ctx: MutationCtx, componentId: string): Promise<ComponentRecord | null> {
  return ctx.db
    .query("components")
    .withIndex("by_component_id", (indexQuery) => indexQuery.eq("id", componentId))
    .unique();
}

async function findComponentByIdForQuery(
  ctx: QueryCtx,
  componentId: string,
): Promise<ComponentRecord | null> {
  return ctx.db
    .query("components")
    .withIndex("by_component_id", (indexQuery) => indexQuery.eq("id", componentId))
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

function normalizeComponentId(rawComponentId: string): string {
  const normalized = rawComponentId.trim();

  if (normalized.length === 0) {
    throw new Error("Component id must be non-empty.");
  }

  return normalized;
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

export const getComponentEditorPayload = query({
  args: {
    componentId: v.string(),
  },
  handler: async (ctx, args) => {
    const componentId = normalizeComponentId(args.componentId);
    const component = await findComponentByIdForQuery(ctx, componentId);

    if (!component) {
      return null;
    }

    const searchRecord = await findSearchByComponentIdForQuery(ctx, component.id);
    if (!searchRecord) {
      return null;
    }

    return {
      componentId: component.id,
      metadata: {
        id: component.id,
        name: component.name,
        source: component.source,
        framework: component.framework,
        styling: component.styling,
        dependencies: component.dependencies,
        motionLevel: component.motionLevel,
        primitiveLibrary: component.primitiveLibrary,
        animationLibrary: component.animationLibrary,
      },
      search: {
        intent: searchRecord.intent,
        capabilities: searchRecord.capabilities,
        synonyms: searchRecord.synonyms,
        topics: searchRecord.topics,
      },
    };
  },
});

export const updateExistingComponent = mutation({
  args: {
    componentId: v.string(),
    metadata: v.object({
      name: v.string(),
      source: ComponentSourceValidator,
      framework: ComponentFrameworkValidator,
      styling: ComponentStylingValidator,
      dependencies: v.array(DependencyValidator),
      motionLevel: ComponentMotionValidator,
      primitiveLibrary: ComponentPrimitiveLibraryValidator,
      animationLibrary: ComponentAnimationLibraryValidator,
    }),
    search: v.object({
      intent: v.string(),
      capabilities: v.array(v.string()),
      synonyms: v.array(v.string()),
      topics: v.array(ComponentTopicValidator),
    }),
  },
  handler: async (ctx, args) => {
    const componentId = normalizeComponentId(args.componentId);
    const [component, searchRecord] = await Promise.all([
      findComponentById(ctx, componentId),
      findSearchByComponentId(ctx, componentId),
    ]);

    if (!component) {
      throw new Error(`Cannot update missing component '${componentId}'.`);
    }

    if (!searchRecord) {
      throw new Error(`Cannot update missing componentSearch row for '${componentId}'.`);
    }

    if (args.metadata.framework !== component.framework) {
      throw new Error("Framework is immutable and cannot be changed.");
    }

    const nextMetadata = ComponentMetadataDocumentSchema.parse({
      schemaVersion: 4,
      id: component.id,
      name: args.metadata.name,
      source: args.metadata.source,
      framework: component.framework,
      styling: args.metadata.styling,
      dependencies: args.metadata.dependencies,
      motionLevel: args.metadata.motionLevel,
      primitiveLibrary: args.metadata.primitiveLibrary,
      animationLibrary: args.metadata.animationLibrary,
      constraints: component.constraints,
    });

    const nextSearch = ComponentSearchDocumentSchema.parse({
      schemaVersion: 4,
      componentId: component.id,
      intent: args.search.intent,
      capabilities: args.search.capabilities,
      synonyms: args.search.synonyms,
      topics: args.search.topics,
    });

    await Promise.all([
      ctx.db.replace(component._id, nextMetadata),
      ctx.db.replace(searchRecord._id, nextSearch),
    ]);

    return {
      status: "updated",
      componentId: component.id,
    };
  },
});

export const deleteExistingComponent = mutation({
  args: {
    componentId: v.string(),
  },
  handler: async (ctx, args) => {
    const componentId = normalizeComponentId(args.componentId);
    const [component, searchRecord] = await Promise.all([
      findComponentById(ctx, componentId),
      findSearchByComponentId(ctx, componentId),
    ]);

    if (!component) {
      throw new Error(`Cannot delete missing component '${componentId}'.`);
    }

    if (!searchRecord) {
      throw new Error(`Cannot delete missing componentSearch row for '${componentId}'.`);
    }

    await Promise.all([ctx.db.delete(component._id), ctx.db.delete(searchRecord._id)]);

    return {
      status: "deleted",
      componentId: component.id,
    };
  },
});
