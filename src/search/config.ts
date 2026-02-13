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
    { name: "name", weight: 0.3 },
    { name: "intent", weight: 0.25 },
    { name: "capabilities", weight: 0.18 },
    { name: "synonyms", weight: 0.13 },
    { name: "topics", weight: 0.08 },
    { name: "dependencies", weight: 0.04 },
    { name: "code.content", weight: 0.02 },
  ],
};
