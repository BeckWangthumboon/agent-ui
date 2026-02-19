import { v } from "convex/values";

type NonEmptyStringTuple = readonly [string, ...string[]];

function literalUnion<const TValues extends NonEmptyStringTuple>(values: TValues) {
  const literals = values.map((value) => v.literal(value));
  const first = literals[0];

  if (!first) {
    throw new Error("literalUnion requires at least one value");
  }

  return v.union(first, ...literals.slice(1));
}

export const COMPONENT_FRAMEWORKS = literalUnion(["react"] as const);

export const COMPONENT_STYLINGS = literalUnion(["tailwind"] as const);

export const COMPONENT_MOTION_LEVELS = literalUnion([
  "none",
  "minimal",
  "standard",
  "heavy",
] as const);

export const DEPENDENCY_KINDS = literalUnion(["runtime", "dev", "peer"] as const);

export const COMPONENT_PRIMITIVE_LIBRARIES = literalUnion([
  "none",
  "radix",
  "base-ui",
  "other",
] as const);

export const COMPONENT_ANIMATION_LIBRARIES = literalUnion([
  "none",
  "motion",
  "framer-motion",
  "other",
] as const);

export const COMPONENT_TOPICS = literalUnion([
  "action",
  "selection",
  "toggle",
  "confirmation",
  "destructive",
  "disclosure",
  "input",
  "form",
  "validation",
  "authentication",
  "date-time",
  "navigation",
  "menu",
  "command-palette",
  "breadcrumb",
  "pagination",
  "overlay",
  "modal",
  "popover",
  "drawer",
  "tooltip",
  "feedback",
  "status",
  "notification",
  "loading",
  "progress",
  "empty-state",
  "data-display",
  "data-visualization",
  "layout",
  "scrolling",
  "resizable",
  "keyboard",
] as const);
