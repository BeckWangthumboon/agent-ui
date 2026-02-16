import { type Infer, v } from "convex/values";
import { z } from "zod";

import {
  COMPONENT_FRAMEWORKS,
  COMPONENT_MOTION_LEVELS,
  COMPONENT_STYLINGS,
  COMPONENT_TOPICS,
  DEPENDENCY_KINDS,
} from "./constants";

function literalTupleFromUnion<TValue extends string>(validator: {
  members: Array<{ value: TValue }>;
}): [TValue, ...TValue[]] {
  const values = validator.members.map((member) => member.value);
  const first = values[0];

  if (!first) {
    throw new Error("Expected at least one literal value");
  }

  return [first, ...values.slice(1)];
}

const ComponentFrameworkValues = literalTupleFromUnion(COMPONENT_FRAMEWORKS);
const ComponentStylingValues = literalTupleFromUnion(COMPONENT_STYLINGS);
const ComponentMotionValues = literalTupleFromUnion(COMPONENT_MOTION_LEVELS);
const DependencyKindValues = literalTupleFromUnion(DEPENDENCY_KINDS);
const ComponentTopicValues = literalTupleFromUnion(COMPONENT_TOPICS);

export const ComponentFrameworkValidator = COMPONENT_FRAMEWORKS;
export type ComponentFramework = Infer<typeof ComponentFrameworkValidator>;

export const ComponentStylingValidator = COMPONENT_STYLINGS;
export type ComponentStyling = Infer<typeof ComponentStylingValidator>;

export const ComponentMotionValidator = COMPONENT_MOTION_LEVELS;
export type ComponentMotion = Infer<typeof ComponentMotionValidator>;

export const DependencyKindValidator = DEPENDENCY_KINDS;
export type DependencyKind = Infer<typeof DependencyKindValidator>;

export const ComponentTopicValidator = COMPONENT_TOPICS;
export type ComponentTopic = Infer<typeof ComponentTopicValidator>;

export const DependencyValidator = v.object({
  name: v.string(),
  kind: DependencyKindValidator,
});
export type Dependency = Infer<typeof DependencyValidator>;

export const ComponentSourceValidator = v.object({
  library: v.optional(v.string()),
  repo: v.optional(v.string()),
  author: v.optional(v.string()),
  license: v.optional(v.string()),
  url: v.string(),
});
export type ComponentSource = Infer<typeof ComponentSourceValidator>;

export const ComponentConstraintsValidator = v.object({});
export type ComponentConstraints = Infer<typeof ComponentConstraintsValidator>;

export const ComponentCodeFileValidator = v.object({
  path: v.string(),
  content: v.string(),
});
export type ComponentCodeFile = Infer<typeof ComponentCodeFileValidator>;

export const ComponentCodeValidator = v.object({
  entryFile: v.string(),
  files: v.array(ComponentCodeFileValidator),
});
export type ComponentCode = Infer<typeof ComponentCodeValidator>;

export const componentDocumentFields = {
  schemaVersion: v.literal(2),
  id: v.string(),
  name: v.string(),
  source: ComponentSourceValidator,
  framework: ComponentFrameworkValidator,
  styling: ComponentStylingValidator,
  dependencies: v.array(DependencyValidator),
  intent: v.string(),
  capabilities: v.array(v.string()),
  synonyms: v.array(v.string()),
  topics: v.array(ComponentTopicValidator),
  motionLevel: ComponentMotionValidator,
  constraints: v.optional(ComponentConstraintsValidator),
  code: ComponentCodeValidator,
} as const;

export const ComponentDocumentValidator = v.object(componentDocumentFields);
export type ComponentDocument = Infer<typeof ComponentDocumentValidator>;

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

export const ComponentFrameworkSchema = z.enum(ComponentFrameworkValues);

export const ComponentStylingSchema = z.enum(ComponentStylingValues);

export const ComponentMotionSchema = z.enum(ComponentMotionValues);

export const DependencyKindSchema = z.enum(DependencyKindValues);

export const DependencySchema: z.ZodType<Dependency> = z.strictObject({
  name: NonEmptyTextSchema,
  kind: DependencyKindSchema.default("runtime"),
});

export const ComponentTopicSchema = z.enum(ComponentTopicValues);

export const ComponentSourceSchema: z.ZodType<ComponentSource> = z.strictObject({
  library: NonEmptyTextSchema.optional(),
  repo: NonEmptyTextSchema.optional(),
  author: NonEmptyTextSchema.optional(),
  license: NonEmptyTextSchema.optional(),
  url: z.url(),
});

export const ComponentConstraintsSchema: z.ZodType<ComponentConstraints> = z.strictObject({});

export const ComponentCodeFileSchema: z.ZodType<ComponentCodeFile> = z.strictObject({
  path: RelativeFilePathSchema,
  content: z.string().min(1),
});

export const ComponentCodeSchema: z.ZodType<ComponentCode> = z
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

export const ComponentDocumentSchema: z.ZodType<ComponentDocument> = z.strictObject({
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

export function parseComponentDocument(input: unknown): ComponentDocument {
  return ComponentDocumentSchema.parse(input);
}
