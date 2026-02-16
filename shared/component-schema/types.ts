import { z } from "zod";

import {
  COMPONENT_FRAMEWORKS,
  COMPONENT_MOTION_LEVELS,
  COMPONENT_STYLINGS,
  COMPONENT_TOPICS,
  DEPENDENCY_KINDS,
} from "./constants";

const NonEmptyTextSchema = z.string().trim().min(1);

const RelativeFilePathSchema = NonEmptyTextSchema.refine(
  (value) => {
    if (value.startsWith("/") || value.startsWith("\\")) {
      return false;
    }

    if (/^[A-Za-z]:[\\/]/.test(value)) {
      return false;
    }

    const segments = value.split(/[\\/]+/);
    return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
  },
  {
    message: "Must be a safe relative file path",
  },
);

export const ComponentFrameworkSchema = z.enum(COMPONENT_FRAMEWORKS);
export type ComponentFramework = z.infer<typeof ComponentFrameworkSchema>;

export const ComponentStylingSchema = z.enum(COMPONENT_STYLINGS);
export type ComponentStyling = z.infer<typeof ComponentStylingSchema>;

export const ComponentMotionSchema = z.enum(COMPONENT_MOTION_LEVELS);
export type ComponentMotion = z.infer<typeof ComponentMotionSchema>;

export const DependencyKindSchema = z.enum(DEPENDENCY_KINDS);
export type DependencyKind = z.infer<typeof DependencyKindSchema>;

export const DependencySchema = z
  .strictObject({
    name: NonEmptyTextSchema,
    kind: DependencyKindSchema.default("runtime"),
  });
export type Dependency = z.infer<typeof DependencySchema>;

export const ComponentTopicSchema = z.enum(COMPONENT_TOPICS);
export type ComponentTopic = z.infer<typeof ComponentTopicSchema>;

export const ComponentSourceSchema = z
  .strictObject({
    library: NonEmptyTextSchema.optional(),
    repo: NonEmptyTextSchema.optional(),
    author: NonEmptyTextSchema.optional(),
    license: NonEmptyTextSchema.optional(),
    url: z.url(),
  });
export type ComponentSource = z.infer<typeof ComponentSourceSchema>;

export const ComponentConstraintsSchema = z.strictObject({});
export type ComponentConstraints = z.infer<typeof ComponentConstraintsSchema>;

export const ComponentCodeFileSchema = z
  .strictObject({
    path: RelativeFilePathSchema,
    content: z.string().min(1),
  });
export type ComponentCodeFile = z.infer<typeof ComponentCodeFileSchema>;

export const ComponentCodeSchema = z
  .strictObject({
    entryFile: RelativeFilePathSchema,
    files: z.array(ComponentCodeFileSchema).min(1),
  })
  .superRefine((value, ctx) => {
    const seenPaths = new Set<string>();

    for (const [index, file] of value.files.entries()) {
      const key = file.path;
      if (seenPaths.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["files", index, "path"],
          message: `Duplicate file path '${file.path}'`,
        });
      }
      seenPaths.add(key);
    }

    if (!seenPaths.has(value.entryFile)) {
      ctx.addIssue({
        code: "custom",
        path: ["entryFile"],
        message: "entryFile must reference one of code.files[].path",
      });
    }
  });
export type ComponentCode = z.infer<typeof ComponentCodeSchema>;

export const ComponentDocumentSchema = z
  .strictObject({
    schemaVersion: z.literal(2),
    id: NonEmptyTextSchema,
    name: NonEmptyTextSchema,
    source: ComponentSourceSchema,
    framework: ComponentFrameworkSchema,
    styling: ComponentStylingSchema,
    dependencies: z.array(DependencySchema).default([]),
    intent: NonEmptyTextSchema,
    capabilities: z.array(NonEmptyTextSchema).default([]),
    synonyms: z.array(NonEmptyTextSchema).default([]),
    topics: z.array(ComponentTopicSchema).default([]),
    motionLevel: ComponentMotionSchema,
    constraints: ComponentConstraintsSchema.optional(),
    code: ComponentCodeSchema,
  });
export type ComponentDocument = z.infer<typeof ComponentDocumentSchema>;

export function parseComponentDocument(input: unknown): ComponentDocument {
  return ComponentDocumentSchema.parse(input);
}
