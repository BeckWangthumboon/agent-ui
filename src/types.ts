import { z } from "zod";

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

export const ComponentFrameworkSchema = z.literal("react");
export type ComponentFramework = z.infer<typeof ComponentFrameworkSchema>;

export const ComponentStylingSchema = z.literal("tailwind");
export type ComponentStyling = z.infer<typeof ComponentStylingSchema>;

export const ComponentMotionSchema = z.enum(["none", "minimal", "standard", "heavy"]);
export type ComponentMotion = z.infer<typeof ComponentMotionSchema>;

export const DependencyKindSchema = z.enum(["runtime", "dev", "peer"]);
export type DependencyKind = z.infer<typeof DependencyKindSchema>;

export const DependencySchema = z
  .object({
    name: NonEmptyTextSchema,
    kind: DependencyKindSchema.default("runtime"),
  })
  .strict();
export type Dependency = z.infer<typeof DependencySchema>;

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
    library: NonEmptyTextSchema.optional(),
    repo: NonEmptyTextSchema.optional(),
    author: NonEmptyTextSchema.optional(),
    license: NonEmptyTextSchema.optional(),
    url: z.url(),
  })
  .strict();
export type ComponentSource = z.infer<typeof ComponentSourceSchema>;

export const ComponentConstraintsSchema = z
  .object({})
  .strict();
export type ComponentConstraints = z.infer<typeof ComponentConstraintsSchema>;

export const ComponentCodeFileSchema = z
  .object({
    path: RelativeFilePathSchema,
    content: z.string().min(1),
  })
  .strict();
export type ComponentCodeFile = z.infer<typeof ComponentCodeFileSchema>;

export const ComponentCodeSchema = z
  .object({
    entryFile: RelativeFilePathSchema,
    files: z.array(ComponentCodeFileSchema).min(1),
  })
  .strict()
  .superRefine((value, ctx) => {
    const seenPaths = new Set<string>();

    for (const [index, file] of value.files.entries()) {
      const key = file.path;
      if (seenPaths.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["files", index, "path"],
          message: `Duplicate file path '${file.path}'`,
        });
      }
      seenPaths.add(key);
    }

    if (!seenPaths.has(value.entryFile)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entryFile"],
        message: "entryFile must reference one of code.files[].path",
      });
    }
  });
export type ComponentCode = z.infer<typeof ComponentCodeSchema>;

export const ComponentDocumentSchema = z
  .object({
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
  })
  .strict();
export type ComponentDocument = z.infer<typeof ComponentDocumentSchema>;

export function parseComponentDocument(input: unknown): ComponentDocument {
  return ComponentDocumentSchema.parse(input);
}
