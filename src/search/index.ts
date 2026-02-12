import Fuse from "fuse.js";

import type { ComponentDocument, ComponentFramework, ComponentStyling } from "../types";
import { DEFAULT_SEARCH_LIMIT, FUSE_OPTIONS } from "./config";

export type SearchFilters = {
  tags?: string[];
  framework?: ComponentFramework;
  styling?: ComponentStyling;
};

export type SearchOptions = SearchFilters & {
  limit?: number;
};

export type ComponentSearchResult = {
  document: ComponentDocument;
  score: number;
};

export class ComponentSearchEngine {
  private readonly documents: ComponentDocument[];
  private readonly fuse: Fuse<ComponentDocument>;

  constructor(documents: ComponentDocument[]) {
    this.documents = documents;
    this.fuse = new Fuse(documents, FUSE_OPTIONS);
  }

  search(query: string, options: SearchOptions = {}): ComponentSearchResult[] {
    const limit = normalizeLimit(options.limit);
    const filteredDocuments = this.filterDocuments(options);

    if (filteredDocuments.length === 0) {
      return [];
    }

    const normalizedQuery = query.trim();
    if (normalizedQuery.length === 0) {
      return filteredDocuments.slice(0, limit).map((document) => ({
        document,
        score: 0,
      }));
    }

    const fuse = filteredDocuments === this.documents ? this.fuse : new Fuse(filteredDocuments, FUSE_OPTIONS);

    return fuse.search(normalizedQuery, { limit }).map((result) => ({
      document: result.item,
      score: result.score ?? 0,
    }));
  }

  findById(id: string): ComponentDocument | undefined {
    return this.documents.find((document) => document.id === id);
  }

  findByIdInsensitive(id: string): ComponentDocument | undefined {
    const target = id.trim().toLowerCase();
    return this.documents.find((document) => document.id.toLowerCase() === target);
  }

  getAll(): ComponentDocument[] {
    return this.documents;
  }

  private filterDocuments(filters: SearchFilters): ComponentDocument[] {
    const requestedTags = (filters.tags ?? []).map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0);

    const hasFrameworkFilter = Boolean(filters.framework);
    const hasStylingFilter = Boolean(filters.styling);
    const hasTagFilter = requestedTags.length > 0;

    if (!hasFrameworkFilter && !hasStylingFilter && !hasTagFilter) {
      return this.documents;
    }

    return this.documents.filter((document) => {
      if (filters.framework && document.framework !== filters.framework) {
        return false;
      }

      if (filters.styling && document.styling !== filters.styling) {
        return false;
      }

      if (!hasTagFilter) {
        return true;
      }

      const documentTags = new Set(document.tags.map((tag) => tag.toLowerCase()));
      return requestedTags.every((tag) => documentTags.has(tag));
    });
  }
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_SEARCH_LIMIT;
  }

  return Math.floor(limit);
}
