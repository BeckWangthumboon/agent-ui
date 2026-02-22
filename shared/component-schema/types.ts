import { type Infer, v } from "convex/values";
import { z } from "zod";

import {
  COMPONENT_ANIMATION_LIBRARIES,
  COMPONENT_FRAMEWORKS,
  COMPONENT_MOTION_LEVELS,
  COMPONENT_PRIMITIVE_LIBRARIES,
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
const ComponentPrimitiveLibraryValues = literalTupleFromUnion(COMPONENT_PRIMITIVE_LIBRARIES);
const ComponentAnimationLibraryValues = literalTupleFromUnion(COMPONENT_ANIMATION_LIBRARIES);
const ComponentFileKindValues = ["code", "example"] as const;
const InstallModeValues = ["command", "manual", "command+manual"] as const;
const InstallSourceValues = ["manual", "shadcn"] as const;

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

export const ComponentPrimitiveLibraryValidator = COMPONENT_PRIMITIVE_LIBRARIES;
export type ComponentPrimitiveLibrary = Infer<typeof ComponentPrimitiveLibraryValidator>;

export const ComponentAnimationLibraryValidator = COMPONENT_ANIMATION_LIBRARIES;
export type ComponentAnimationLibrary = Infer<typeof ComponentAnimationLibraryValidator>;

export const InstallModeValidator = v.union(
  v.literal("command"),
  v.literal("manual"),
  v.literal("command+manual"),
);
export type InstallMode = Infer<typeof InstallModeValidator>;

export const InstallSourceValidator = v.union(v.literal("manual"), v.literal("shadcn"));
export type InstallSource = Infer<typeof InstallSourceValidator>;

export const DependencyValidator = v.object({
  name: v.string(),
  kind: DependencyKindValidator,
});
export type Dependency = Infer<typeof DependencyValidator>;

export const ComponentInstallValidator = v.union(
  v.object({
    mode: v.literal("command"),
    source: InstallSourceValidator,
    template: v.string(),
  }),
  v.object({
    mode: v.literal("manual"),
    source: v.literal("manual"),
    steps: v.array(v.string()),
  }),
  v.object({
    mode: v.literal("command+manual"),
    source: InstallSourceValidator,
    template: v.string(),
    steps: v.array(v.string()),
  }),
);
export type ComponentInstall = Infer<typeof ComponentInstallValidator>;

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

export const ComponentFileKindValidator = v.union(v.literal("code"), v.literal("example"));
export type ComponentFileKind = Infer<typeof ComponentFileKindValidator>;

export const ComponentCodeValidator = v.object({
  entryFile: v.string(),
  files: v.array(ComponentCodeFileValidator),
});
export type ComponentCode = Infer<typeof ComponentCodeValidator>;

// Legacy source document schema used by data/components/*/meta.json.
export const componentDocumentFields = {
  schemaVersion: v.literal(2),
  id: v.string(),
  name: v.string(),
  source: ComponentSourceValidator,
  framework: ComponentFrameworkValidator,
  styling: ComponentStylingValidator,
  dependencies: v.array(DependencyValidator),
  install: v.optional(ComponentInstallValidator),
  intent: v.string(),
  capabilities: v.array(v.string()),
  synonyms: v.array(v.string()),
  topics: v.array(ComponentTopicValidator),
  motionLevel: ComponentMotionValidator,
  primitiveLibrary: v.optional(ComponentPrimitiveLibraryValidator),
  animationLibrary: v.optional(ComponentAnimationLibraryValidator),
  constraints: v.optional(ComponentConstraintsValidator),
  code: ComponentCodeValidator,
  example: v.optional(ComponentCodeFileValidator),
} as const;

export const ComponentDocumentValidator = v.object(componentDocumentFields);
export type ComponentDocument = Infer<typeof ComponentDocumentValidator>;

export const componentMetadataFields = {
  schemaVersion: v.literal(4),
  id: v.string(),
  name: v.string(),
  source: ComponentSourceValidator,
  framework: ComponentFrameworkValidator,
  styling: ComponentStylingValidator,
  dependencies: v.array(DependencyValidator),
  install: v.optional(ComponentInstallValidator),
  motionLevel: ComponentMotionValidator,
  primitiveLibrary: ComponentPrimitiveLibraryValidator,
  animationLibrary: ComponentAnimationLibraryValidator,
  constraints: v.optional(ComponentConstraintsValidator),
} as const;

export const ComponentMetadataDocumentValidator = v.object(componentMetadataFields);
export type ComponentMetadataDocument = Infer<typeof ComponentMetadataDocumentValidator>;

export const componentCodeFields = {
  schemaVersion: v.literal(5),
  componentId: v.string(),
  entryFile: v.string(),
} as const;

export const ComponentCodeDocumentValidator = v.object({
  schemaVersion: v.literal(5),
  componentId: v.string(),
  entryFile: v.string(),
});
export type ComponentCodeDocument = Infer<typeof ComponentCodeDocumentValidator>;

export const componentFileFields = {
  schemaVersion: v.literal(5),
  componentId: v.string(),
  kind: ComponentFileKindValidator,
  path: v.string(),
  content: v.string(),
} as const;

export const ComponentFileDocumentValidator = v.object(componentFileFields);
export type ComponentFileDocument = Infer<typeof ComponentFileDocumentValidator>;

export const componentSearchFields = {
  schemaVersion: v.literal(4),
  componentId: v.string(),
  intent: v.string(),
  capabilities: v.array(v.string()),
  synonyms: v.array(v.string()),
  topics: v.array(ComponentTopicValidator),
} as const;

export const ComponentSearchDocumentValidator = v.object(componentSearchFields);
export type ComponentSearchDocument = Infer<typeof ComponentSearchDocumentValidator>;

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

export const ComponentTopicSchema = z.enum(ComponentTopicValues);

export const ComponentPrimitiveLibrarySchema = z.enum(ComponentPrimitiveLibraryValues);

export const ComponentAnimationLibrarySchema = z.enum(ComponentAnimationLibraryValues);

export const ComponentFileKindSchema = z.enum(ComponentFileKindValues);

export const InstallModeSchema = z.enum(InstallModeValues);

export const InstallSourceSchema = z.enum(InstallSourceValues);

export const DependencySchema: z.ZodType<Dependency> = z.strictObject({
  name: NonEmptyTextSchema,
  kind: DependencyKindSchema.default("runtime"),
});

const InstallStepsSchema = z.array(NonEmptyTextSchema).min(1);

export const ComponentInstallSchema: z.ZodType<ComponentInstall> = z.discriminatedUnion("mode", [
  z.strictObject({
    mode: z.literal("command"),
    source: InstallSourceSchema,
    template: NonEmptyTextSchema,
  }),
  z.strictObject({
    mode: z.literal("manual"),
    source: z.literal("manual"),
    steps: InstallStepsSchema,
  }),
  z.strictObject({
    mode: z.literal("command+manual"),
    source: InstallSourceSchema,
    template: NonEmptyTextSchema,
    steps: InstallStepsSchema,
  }),
]);

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

export const ComponentExampleSchema: z.ZodType<ComponentCodeFile> = ComponentCodeFileSchema;

export const ComponentDocumentSchema: z.ZodType<ComponentDocument> = z.strictObject({
  schemaVersion: z.literal(2),
  id: NonEmptyTextSchema,
  name: NonEmptyTextSchema,
  source: ComponentSourceSchema,
  framework: ComponentFrameworkSchema,
  styling: ComponentStylingSchema,
  dependencies: z.array(DependencySchema).default([]),
  install: ComponentInstallSchema.optional(),
  intent: NonEmptyTextSchema,
  capabilities: z.array(NonEmptyTextSchema).default([]),
  synonyms: z.array(NonEmptyTextSchema).default([]),
  topics: z.array(ComponentTopicSchema).default([]),
  motionLevel: ComponentMotionSchema,
  primitiveLibrary: ComponentPrimitiveLibrarySchema.optional(),
  animationLibrary: ComponentAnimationLibrarySchema.optional(),
  constraints: ComponentConstraintsSchema.optional(),
  code: ComponentCodeSchema,
  example: ComponentExampleSchema.optional(),
});

export const ComponentMetadataDocumentSchema: z.ZodType<ComponentMetadataDocument> = z.strictObject(
  {
    schemaVersion: z.literal(4),
    id: NonEmptyTextSchema,
    name: NonEmptyTextSchema,
    source: ComponentSourceSchema,
    framework: ComponentFrameworkSchema,
    styling: ComponentStylingSchema,
    dependencies: z.array(DependencySchema).default([]),
    install: ComponentInstallSchema.optional(),
    motionLevel: ComponentMotionSchema,
    primitiveLibrary: ComponentPrimitiveLibrarySchema,
    animationLibrary: ComponentAnimationLibrarySchema,
    constraints: ComponentConstraintsSchema.optional(),
  },
);

export const ComponentCodeDocumentSchema: z.ZodType<ComponentCodeDocument> = z.strictObject({
  schemaVersion: z.literal(5),
  componentId: NonEmptyTextSchema,
  entryFile: RelativeFilePathSchema,
});

export const ComponentFileDocumentSchema: z.ZodType<ComponentFileDocument> = z.strictObject({
  schemaVersion: z.literal(5),
  componentId: NonEmptyTextSchema,
  kind: ComponentFileKindSchema,
  path: RelativeFilePathSchema,
  content: z.string().min(1),
});

export const ComponentSearchDocumentSchema: z.ZodType<ComponentSearchDocument> = z.strictObject({
  schemaVersion: z.literal(4),
  componentId: NonEmptyTextSchema,
  intent: NonEmptyTextSchema,
  capabilities: z.array(NonEmptyTextSchema).default([]),
  synonyms: z.array(NonEmptyTextSchema).default([]),
  topics: z.array(ComponentTopicSchema).default([]),
});

export function parseComponentDocument(input: unknown): ComponentDocument {
  return ComponentDocumentSchema.parse(input);
}
