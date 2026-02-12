import type { IFuseOptions } from "fuse.js";

import type { ComponentDocument } from "../types";

export const DEFAULT_SEARCH_LIMIT = 10;

export const FUSE_OPTIONS: IFuseOptions<ComponentDocument> = {
  includeScore: true,
  includeMatches: true,
  threshold: 0.32,
  ignoreLocation: true,
  minMatchCharLength: 2,
  keys: [
    { name: "name", weight: 0.35 },
    { name: "tags", weight: 0.2 },
    { name: "description", weight: 0.15 },
    { name: "useCases", weight: 0.15 },
    { name: "dependencies.name", weight: 0.1 },
    { name: "code.content", weight: 0.05 },
  ],
};
