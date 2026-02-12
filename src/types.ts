import { z } from "zod";

const NonEmptyTextSchema = z.string().trim().min(1);

export const ComponentFrameworkSchema = z.literal("react");
export type ComponentFramework = z.infer<typeof ComponentFrameworkSchema>;

export const ComponentStylingSchema = z.literal("tailwind");
export type ComponentStyling = z.infer<typeof ComponentStylingSchema>;

export const ComponentKindSchema = z.enum(["primitive", "composite", "hook", "utility"]);
export type ComponentKind = z.infer<typeof ComponentKindSchema>;

export const ComponentMotionSchema = z.enum(["none", "minimal", "animated"]);
export type ComponentMotion = z.infer<typeof ComponentMotionSchema>;

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
    usesPortal: z.boolean().optional(),
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
    kind: ComponentKindSchema.optional(),
    source: ComponentSourceSchema,
    framework: ComponentFrameworkSchema,
    styling: ComponentStylingSchema,
    dependencies: z.array(NonEmptyTextSchema).default([]),
    intent: NonEmptyTextSchema,
    capabilities: z.array(NonEmptyTextSchema).default([]),
    synonyms: z.array(NonEmptyTextSchema).default([]),
    topics: z.array(NonEmptyTextSchema).default([]),
    constraints: ComponentConstraintsSchema.optional(),
    code: ComponentCodeSchema,
  })
  .strict();
export type ComponentDocument = z.infer<typeof ComponentDocumentSchema>;

export function parseComponentDocument(input: unknown): ComponentDocument {
  return ComponentDocumentSchema.parse(input);
}
