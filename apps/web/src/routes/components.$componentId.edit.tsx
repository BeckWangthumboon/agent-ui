import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { api } from "@backend/convex/_generated/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FRAMEWORKS = ["react"] as const;
const STYLINGS = ["tailwind"] as const;
const MOTION_LEVELS = ["none", "minimal", "standard", "heavy"] as const;
const PRIMITIVE_LIBRARIES = ["none", "radix", "base-ui", "other"] as const;
const ANIMATION_LIBRARIES = ["none", "motion", "framer-motion", "other"] as const;
const DEPENDENCY_KINDS = ["runtime", "dev", "peer"] as const;
const TOPICS = [
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
] as const;

type Framework = (typeof FRAMEWORKS)[number];
type Styling = (typeof STYLINGS)[number];
type MotionLevel = (typeof MOTION_LEVELS)[number];
type PrimitiveLibrary = (typeof PRIMITIVE_LIBRARIES)[number];
type AnimationLibrary = (typeof ANIMATION_LIBRARIES)[number];
type DependencyKind = (typeof DEPENDENCY_KINDS)[number];
type Topic = (typeof TOPICS)[number];

type ComponentDependency = {
  name: string;
  kind: DependencyKind;
};

type ComponentSource = {
  url: string;
  library?: string;
  repo?: string;
  author?: string;
  license?: string;
};

type ComponentEditorPayload = {
  componentId: string;
  metadata: {
    id: string;
    name: string;
    source: ComponentSource;
    framework: Framework;
    styling: Styling;
    dependencies: ComponentDependency[];
    motionLevel: MotionLevel;
    primitiveLibrary: PrimitiveLibrary;
    animationLibrary: AnimationLibrary;
  };
  search: {
    intent: string;
    capabilities: string[];
    synonyms: string[];
    topics: Topic[];
  };
};

type FormState = {
  id: string;
  name: string;
  framework: Framework;
  styling: Styling;
  motionLevel: MotionLevel;
  primitiveLibrary: PrimitiveLibrary;
  animationLibrary: AnimationLibrary;
  sourceUrl: string;
  sourceLibrary: string;
  sourceRepo: string;
  sourceAuthor: string;
  sourceLicense: string;
  intent: string;
  capabilitiesText: string;
  synonymsText: string;
  topicsText: string;
  dependencies: ComponentDependency[];
};

type UpdateArgs = {
  componentId: string;
  metadata: {
    name: string;
    source: ComponentSource;
    framework: Framework;
    styling: Styling;
    dependencies: ComponentDependency[];
    motionLevel: MotionLevel;
    primitiveLibrary: PrimitiveLibrary;
    animationLibrary: AnimationLibrary;
  };
  search: {
    intent: string;
    capabilities: string[];
    synonyms: string[];
    topics: Topic[];
  };
};

type ValidationResult = {
  errors: string[];
  value: UpdateArgs | null;
  serialized: string | null;
};

export const Route = createFileRoute("/components/$componentId/edit")({
  component: ComponentEditorPage,
});

function ComponentEditorPage() {
  const { componentId } = Route.useParams();
  const navigate = useNavigate();
  const payload = useQuery(api.admin.getComponentEditorPayload, { componentId }) as
    | ComponentEditorPayload
    | null
    | undefined;
  const updateComponent = useMutation(api.admin.updateExistingComponent);
  const deleteComponent = useMutation(api.admin.deleteExistingComponent);

  const [formState, setFormState] = useState<FormState | null>(null);
  const [baselineSerialized, setBaselineSerialized] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!payload) {
      return;
    }

    const nextState = toFormState(payload);
    const initialValidation = validateForm(payload.componentId, nextState);
    setFormState(nextState);
    setBaselineSerialized(initialValidation.serialized);
    setSaveError(null);
    setDeleteError(null);
    setSuccessMessage(null);
  }, [payload?.componentId]);

  const validation = useMemo(() => {
    if (!formState) {
      return { errors: [], value: null, serialized: null } satisfies ValidationResult;
    }

    return validateForm(payload?.componentId ?? componentId, formState);
  }, [componentId, formState, payload?.componentId]);

  const isDirty =
    validation.serialized !== null &&
    baselineSerialized !== null &&
    validation.serialized !== baselineSerialized;
  const canSave = validation.value !== null && validation.errors.length === 0 && isDirty;

  if (payload === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Edit Component</CardTitle>
          <CardDescription>Loading component editor...</CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-40 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (payload === null || !formState) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Component not found</CardTitle>
          <CardDescription>
            No editable component exists for <code>{componentId}</code>.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild variant="outline" size="sm">
            <Link to="/">Back to directory</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit {formState.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update metadata and search fields for <code>{payload.componentId}</code>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/components/$componentId" params={{ componentId: payload.componentId }}>
              View
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Directory</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
          <CardDescription>
            Framework is read-only and component id stays fixed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Component ID">
              <Input value={formState.id} disabled readOnly />
            </Field>
            <Field label="Framework (read-only)">
              <Input value={formState.framework} disabled readOnly />
            </Field>
            <Field label="Name">
              <Input
                value={formState.name}
                onChange={(event) =>
                  setFormState((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                }
              />
            </Field>
            <Field label="Styling">
              <EnumSelect
                value={formState.styling}
                values={STYLINGS}
                onValueChange={(value) =>
                  setFormState((prev) => (prev ? { ...prev, styling: value as Styling } : prev))
                }
              />
            </Field>
            <Field label="Motion Level">
              <EnumSelect
                value={formState.motionLevel}
                values={MOTION_LEVELS}
                onValueChange={(value) =>
                  setFormState((prev) => (prev ? { ...prev, motionLevel: value as MotionLevel } : prev))
                }
              />
            </Field>
            <Field label="Primitive Library">
              <EnumSelect
                value={formState.primitiveLibrary}
                values={PRIMITIVE_LIBRARIES}
                onValueChange={(value) =>
                  setFormState((prev) =>
                    prev ? { ...prev, primitiveLibrary: value as PrimitiveLibrary } : prev,
                  )
                }
              />
            </Field>
            <Field label="Animation Library">
              <EnumSelect
                value={formState.animationLibrary}
                values={ANIMATION_LIBRARIES}
                onValueChange={(value) =>
                  setFormState((prev) =>
                    prev ? { ...prev, animationLibrary: value as AnimationLibrary } : prev,
                  )
                }
              />
            </Field>
            <Field label="Source URL">
              <Input
                value={formState.sourceUrl}
                onChange={(event) =>
                  setFormState((prev) => (prev ? { ...prev, sourceUrl: event.target.value } : prev))
                }
              />
            </Field>
            <Field label="Source Library">
              <Input
                value={formState.sourceLibrary}
                onChange={(event) =>
                  setFormState((prev) => (prev ? { ...prev, sourceLibrary: event.target.value } : prev))
                }
              />
            </Field>
            <Field label="Source Repo">
              <Input
                value={formState.sourceRepo}
                onChange={(event) =>
                  setFormState((prev) => (prev ? { ...prev, sourceRepo: event.target.value } : prev))
                }
              />
            </Field>
            <Field label="Source Author">
              <Input
                value={formState.sourceAuthor}
                onChange={(event) =>
                  setFormState((prev) => (prev ? { ...prev, sourceAuthor: event.target.value } : prev))
                }
              />
            </Field>
            <Field label="Source License">
              <Input
                value={formState.sourceLicense}
                onChange={(event) =>
                  setFormState((prev) => (prev ? { ...prev, sourceLicense: event.target.value } : prev))
                }
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Search Fields</CardTitle>
          <CardDescription>Enter comma-separated values for arrays.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Intent">
            <Input
              value={formState.intent}
              onChange={(event) =>
                setFormState((prev) => (prev ? { ...prev, intent: event.target.value } : prev))
              }
            />
          </Field>
          <Field label="Capabilities (comma-separated)">
            <Input
              value={formState.capabilitiesText}
              onChange={(event) =>
                setFormState((prev) =>
                  prev ? { ...prev, capabilitiesText: event.target.value } : prev,
                )
              }
            />
          </Field>
          <Field label="Synonyms (comma-separated)">
            <Input
              value={formState.synonymsText}
              onChange={(event) =>
                setFormState((prev) => (prev ? { ...prev, synonymsText: event.target.value } : prev))
              }
            />
          </Field>
          <Field label="Topics (comma-separated)">
            <Input
              value={formState.topicsText}
              onChange={(event) =>
                setFormState((prev) => (prev ? { ...prev, topicsText: event.target.value } : prev))
              }
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dependencies</CardTitle>
          <CardDescription>Edit dependency names and kinds.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {formState.dependencies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No dependencies configured.</p>
          ) : null}
          {formState.dependencies.map((dependency, index) => (
            <div key={`dep-${index}`} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_180px_auto]">
              <Input
                value={dependency.name}
                onChange={(event) =>
                  setFormState((prev) =>
                    prev
                      ? {
                          ...prev,
                          dependencies: prev.dependencies.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, name: event.target.value } : item,
                          ),
                        }
                      : prev,
                  )
                }
                placeholder="package-name"
              />
              <EnumSelect
                value={dependency.kind}
                values={DEPENDENCY_KINDS}
                onValueChange={(value) =>
                  setFormState((prev) =>
                    prev
                      ? {
                          ...prev,
                          dependencies: prev.dependencies.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, kind: value as DependencyKind }
                              : item,
                          ),
                        }
                      : prev,
                  )
                }
              />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setFormState((prev) =>
                    prev
                      ? {
                          ...prev,
                          dependencies: prev.dependencies.filter((_, itemIndex) => itemIndex !== index),
                        }
                      : prev,
                  )
                }
              >
                <X className="size-4" />
                Remove
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setFormState((prev) =>
                prev
                  ? {
                      ...prev,
                      dependencies: [...prev.dependencies, { name: "", kind: "runtime" }],
                    }
                  : prev,
              )
            }
          >
            <Plus className="size-4" />
            Add dependency
          </Button>
        </CardContent>
      </Card>

      {validation.errors.length > 0 ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Validation errors</CardTitle>
            <CardDescription>Fix these before saving.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
              {validation.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {saveError ? (
        <p className="text-sm text-destructive">{saveError}</p>
      ) : successMessage ? (
        <p className="text-sm text-emerald-600">{successMessage}</p>
      ) : null}

      {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive" disabled={isSaving || isDeleting}>
              {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete component
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {payload.componentId}?</AlertDialogTitle>
              <AlertDialogDescription>
                This deletes only the `components` and `componentSearch` records. `componentCode` is left untouched.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isDeleting}
                onClick={async () => {
                  setDeleteError(null);
                  setSaveError(null);
                  setSuccessMessage(null);
                  setIsDeleting(true);

                  try {
                    await deleteComponent({ componentId: payload.componentId });
                    await navigate({ to: "/" });
                  } catch (error) {
                    setDeleteError(toErrorMessage(error, "Failed to delete component."));
                  } finally {
                    setIsDeleting(false);
                  }
                }}
              >
                Confirm delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!payload) {
                return;
              }

              const resetState = toFormState(payload);
              const resetValidation = validateForm(payload.componentId, resetState);
              setFormState(resetState);
              setBaselineSerialized(resetValidation.serialized);
              setSaveError(null);
              setSuccessMessage(null);
            }}
            disabled={isSaving || isDeleting}
          >
            Reset
          </Button>
          <Button
            type="button"
            onClick={async () => {
              if (!validation.value) {
                return;
              }

              setSaveError(null);
              setDeleteError(null);
              setSuccessMessage(null);
              setIsSaving(true);

              try {
                await updateComponent(validation.value);
                setBaselineSerialized(validation.serialized);
                setSuccessMessage("Saved successfully.");
              } catch (error) {
                setSaveError(toErrorMessage(error, "Failed to save component."));
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={!canSave || isSaving || isDeleting}
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      </div>
    </section>
  );
}

function Field(props: { label: string; children: ReactNode }) {
  const { label, children } = props;

  return (
    <label className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </label>
  );
}

function EnumSelect(props: {
  value: string;
  values: readonly string[];
  onValueChange: (nextValue: string) => void;
}) {
  const { value, values, onValueChange } = props;

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {values.map((item) => (
          <SelectItem key={item} value={item}>
            {item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function toFormState(payload: ComponentEditorPayload): FormState {
  return {
    id: payload.metadata.id,
    name: payload.metadata.name,
    framework: payload.metadata.framework,
    styling: payload.metadata.styling,
    motionLevel: payload.metadata.motionLevel,
    primitiveLibrary: payload.metadata.primitiveLibrary,
    animationLibrary: payload.metadata.animationLibrary,
    sourceUrl: payload.metadata.source.url,
    sourceLibrary: payload.metadata.source.library ?? "",
    sourceRepo: payload.metadata.source.repo ?? "",
    sourceAuthor: payload.metadata.source.author ?? "",
    sourceLicense: payload.metadata.source.license ?? "",
    intent: payload.search.intent,
    capabilitiesText: payload.search.capabilities.join(", "),
    synonymsText: payload.search.synonyms.join(", "),
    topicsText: payload.search.topics.join(", "),
    dependencies: payload.metadata.dependencies.map((dependency) => ({ ...dependency })),
  };
}

function validateForm(componentId: string, formState: FormState): ValidationResult {
  const errors: string[] = [];
  const name = formState.name.trim();
  const intent = formState.intent.trim();
  const sourceUrl = formState.sourceUrl.trim();

  if (name.length === 0) {
    errors.push("Name is required.");
  }

  if (intent.length === 0) {
    errors.push("Intent is required.");
  }

  if (sourceUrl.length === 0) {
    errors.push("Source URL is required.");
  } else if (!isValidUrl(sourceUrl)) {
    errors.push("Source URL must be a valid URL.");
  }

  if (!isEnumValue(formState.framework, FRAMEWORKS)) {
    errors.push("Framework is invalid.");
  }

  if (!isEnumValue(formState.styling, STYLINGS)) {
    errors.push("Styling is invalid.");
  }

  if (!isEnumValue(formState.motionLevel, MOTION_LEVELS)) {
    errors.push("Motion level is invalid.");
  }

  if (!isEnumValue(formState.primitiveLibrary, PRIMITIVE_LIBRARIES)) {
    errors.push("Primitive library is invalid.");
  }

  if (!isEnumValue(formState.animationLibrary, ANIMATION_LIBRARIES)) {
    errors.push("Animation library is invalid.");
  }

  const dependencies: ComponentDependency[] = [];
  for (const [index, dependency] of formState.dependencies.entries()) {
    const nameValue = dependency.name.trim();

    if (nameValue.length === 0) {
      errors.push(`Dependency ${index + 1} name is required.`);
      continue;
    }

    if (!isEnumValue(dependency.kind, DEPENDENCY_KINDS)) {
      errors.push(`Dependency ${index + 1} kind is invalid.`);
      continue;
    }

    dependencies.push({ name: nameValue, kind: dependency.kind });
  }

  const capabilities = parseCsvValues(formState.capabilitiesText);
  const synonyms = parseCsvValues(formState.synonymsText);
  const topicsResult = parseTopicValues(formState.topicsText);

  if (topicsResult.invalid.length > 0) {
    errors.push(`Unknown topics: ${topicsResult.invalid.join(", ")}.`);
  }

  const source: ComponentSource = { url: sourceUrl };
  const sourceLibrary = toOptionalText(formState.sourceLibrary);
  const sourceRepo = toOptionalText(formState.sourceRepo);
  const sourceAuthor = toOptionalText(formState.sourceAuthor);
  const sourceLicense = toOptionalText(formState.sourceLicense);

  if (sourceLibrary) {
    source.library = sourceLibrary;
  }
  if (sourceRepo) {
    source.repo = sourceRepo;
  }
  if (sourceAuthor) {
    source.author = sourceAuthor;
  }
  if (sourceLicense) {
    source.license = sourceLicense;
  }

  if (errors.length > 0) {
    return { errors, value: null, serialized: null };
  }

  const value: UpdateArgs = {
    componentId,
    metadata: {
      name,
      source,
      framework: formState.framework,
      styling: formState.styling,
      dependencies,
      motionLevel: formState.motionLevel,
      primitiveLibrary: formState.primitiveLibrary,
      animationLibrary: formState.animationLibrary,
    },
    search: {
      intent,
      capabilities,
      synonyms,
      topics: topicsResult.valid,
    },
  };

  return {
    errors,
    value,
    serialized: JSON.stringify(value),
  };
}

function parseCsvValues(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function parseTopicValues(value: string): { valid: Topic[]; invalid: string[] } {
  const valid: Topic[] = [];
  const invalid: string[] = [];

  for (const rawTopic of parseCsvValues(value)) {
    if (isEnumValue(rawTopic, TOPICS)) {
      valid.push(rawTopic);
    } else {
      invalid.push(rawTopic);
    }
  }

  return { valid, invalid };
}

function toOptionalText(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function isEnumValue<TValue extends string>(
  value: string,
  allowedValues: readonly TValue[],
): value is TValue {
  return allowedValues.includes(value as TValue);
}

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol.length > 0 && parsed.host.length > 0;
  } catch {
    return false;
  }
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}
