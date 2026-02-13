import { z } from "zod";

const NonEmptyTextSchema = z.string().trim().min(1);

export const ComponentFrameworkSchema = z.literal("react");
export type ComponentFramework = z.infer<typeof ComponentFrameworkSchema>;

export const ComponentStylingSchema = z.literal("tailwind");
export type ComponentStyling = z.infer<typeof ComponentStylingSchema>;

export const ComponentMotionSchema = z.enum(["none", "minimal", "standard", "heavy"]);
export type ComponentMotion = z.infer<typeof ComponentMotionSchema>;

export const ComponentTopicSchema = z.enum([
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
]);
export type ComponentTopic = z.infer<typeof ComponentTopicSchema>;

export const ComponentSourceSchema = z
  .object({
    repo: NonEmptyTextSchema.optional(),
    author: NonEmptyTextSchema.optional(),
    license: NonEmptyTextSchema.optional(),
    url: z.url(),
  })
  .strict();
export type ComponentSource = z.infer<typeof ComponentSourceSchema>;

export const ComponentConstraintsSchema = z
  .object({
    motion: ComponentMotionSchema.optional(),
  })
  .strict();
export type ComponentConstraints = z.infer<typeof ComponentConstraintsSchema>;

export const ComponentCodeSchema = z
  .object({
    fileName: NonEmptyTextSchema,
    content: z.string().min(1),
  })
  .strict();
export type ComponentCode = z.infer<typeof ComponentCodeSchema>;

export const ComponentDocumentSchema = z
  .object({
    id: NonEmptyTextSchema,
    name: NonEmptyTextSchema,
    source: ComponentSourceSchema,
    framework: ComponentFrameworkSchema,
    styling: ComponentStylingSchema,
    dependencies: z.array(NonEmptyTextSchema).default([]),
    intent: NonEmptyTextSchema,
    capabilities: z.array(NonEmptyTextSchema).default([]),
    synonyms: z.array(NonEmptyTextSchema).default([]),
    topics: z.array(ComponentTopicSchema).default([]),
    constraints: ComponentConstraintsSchema.optional(),
    code: ComponentCodeSchema,
  })
  .strict();
export type ComponentDocument = z.infer<typeof ComponentDocumentSchema>;

export function parseComponentDocument(input: unknown): ComponentDocument {
  return ComponentDocumentSchema.parse(input);
}
