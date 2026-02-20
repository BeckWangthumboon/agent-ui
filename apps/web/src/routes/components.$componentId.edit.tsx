import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@backend/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/components/$componentId/edit")({
  component: EditComponentPage,
});

const STYLING_OPTIONS = ["tailwind"] as const;
const MOTION_OPTIONS = ["none", "minimal", "standard", "heavy"] as const;
const PRIMITIVE_OPTIONS = ["none", "radix", "base-ui", "other"] as const;
const ANIMATION_OPTIONS = ["none", "motion", "framer-motion", "other"] as const;
const TOPIC_OPTIONS = [
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
const DEPENDENCY_KINDS = ["runtime", "dev", "peer"] as const;

type EditorPayload = {
  componentId: string;
  name: string;
  framework: string;
  styling: string;
  motionLevel: string;
  primitiveLibrary: string;
  animationLibrary: string;
  source: {
    url: string;
    library: string;
    repo: string;
    author: string;
    license: string;
  };
  dependencies: Array<{ name: string; kind: string }>;
  intent: string;
  capabilities: string[];
  synonyms: string[];
  topics: string[];
};

type FormState = {
  componentId: string;
  name: string;
  framework: string;
  styling: string;
  motionLevel: string;
  primitiveLibrary: string;
  animationLibrary: string;
  sourceUrl: string;
  sourceLibrary: string;
  sourceRepo: string;
  sourceAuthor: string;
  sourceLicense: string;
  intent: string;
  capabilitiesText: string;
  synonymsText: string;
  topicsText: string;
  dependenciesText: string;
};

function EditComponentPage() {
  const { componentId } = Route.useParams();
  const navigate = useNavigate();
  const data = useQuery(api.componentEditor.getForEdit, { componentId });
  const update = useMutation(api.componentEditor.updateExisting);
  const remove = useMutation(api.componentEditor.deleteExisting);

  const [status, setStatus] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const initialState = useMemo(() => (data ? toFormState(data as EditorPayload) : null), [data]);
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    if (initialState) {
      setForm(initialState);
    }
  }, [initialState]);

  const validation = useMemo(() => {
    if (!form) {
      return { valid: false, errors: {} as Record<string, string> };
    }

    const errors: Record<string, string> = {};

    if (!form.name.trim()) errors.name = "Name is required.";
    if (!form.intent.trim()) errors.intent = "Intent is required.";
    if (!form.sourceUrl.trim()) {
      errors.sourceUrl = "Source URL is required.";
    } else {
      try {
        const parsed = new URL(form.sourceUrl.trim());
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          errors.sourceUrl = "URL must use http or https.";
        }
      } catch {
        errors.sourceUrl = "Source URL must be valid.";
      }
    }

    if (!STYLING_OPTIONS.includes(form.styling as (typeof STYLING_OPTIONS)[number])) {
      errors.styling = "Invalid styling value.";
    }
    if (!MOTION_OPTIONS.includes(form.motionLevel as (typeof MOTION_OPTIONS)[number])) {
      errors.motionLevel = "Invalid motion level.";
    }
    if (!PRIMITIVE_OPTIONS.includes(form.primitiveLibrary as (typeof PRIMITIVE_OPTIONS)[number])) {
      errors.primitiveLibrary = "Invalid primitive library.";
    }
    if (!ANIMATION_OPTIONS.includes(form.animationLibrary as (typeof ANIMATION_OPTIONS)[number])) {
      errors.animationLibrary = "Invalid animation library.";
    }

    const topics = parseCsv(form.topicsText);
    const invalidTopics = topics.filter(
      (topic) => !TOPIC_OPTIONS.includes(topic as (typeof TOPIC_OPTIONS)[number]),
    );
    if (invalidTopics.length > 0) {
      errors.topicsText = `Invalid topics: ${invalidTopics.join(", ")}`;
    }

    const dependenciesError = validateDependencies(form.dependenciesText);
    if (dependenciesError) {
      errors.dependenciesText = dependenciesError;
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }, [form]);

  const isDirty = !!form && !!initialState && JSON.stringify(form) !== JSON.stringify(initialState);

  if (data === undefined || form === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Edit Component</CardTitle>
          <CardDescription>Loading editor…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (data === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Component not found</CardTitle>
          <CardDescription>No component exists for {componentId}.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit {data.name}</CardTitle>
        <CardDescription>
          Edit metadata + search fields only. Framework is read-only and component code is
          untouched.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <LabeledInput label="Component ID" value={form.componentId} disabled />
        <LabeledInput label="Framework (read-only)" value={form.framework} disabled />
        <LabeledInput
          label="Name"
          value={form.name}
          onChange={(value) => setForm((prev) => (prev ? { ...prev, name: value } : prev))}
          error={validation.errors.name}
        />
        <LabeledInput
          label="Intent"
          value={form.intent}
          onChange={(value) => setForm((prev) => (prev ? { ...prev, intent: value } : prev))}
          error={validation.errors.intent}
        />

        <SelectField
          label="Styling"
          value={form.styling}
          options={STYLING_OPTIONS}
          onValueChange={(value) => setForm((prev) => (prev ? { ...prev, styling: value } : prev))}
          error={validation.errors.styling}
        />
        <SelectField
          label="Motion level"
          value={form.motionLevel}
          options={MOTION_OPTIONS}
          onValueChange={(value) =>
            setForm((prev) => (prev ? { ...prev, motionLevel: value } : prev))
          }
          error={validation.errors.motionLevel}
        />
        <SelectField
          label="Primitive library"
          value={form.primitiveLibrary}
          options={PRIMITIVE_OPTIONS}
          onValueChange={(value) =>
            setForm((prev) => (prev ? { ...prev, primitiveLibrary: value } : prev))
          }
          error={validation.errors.primitiveLibrary}
        />
        <SelectField
          label="Animation library"
          value={form.animationLibrary}
          options={ANIMATION_OPTIONS}
          onValueChange={(value) =>
            setForm((prev) => (prev ? { ...prev, animationLibrary: value } : prev))
          }
          error={validation.errors.animationLibrary}
        />

        <LabeledInput
          label="Source URL"
          value={form.sourceUrl}
          onChange={(value) => setForm((prev) => (prev ? { ...prev, sourceUrl: value } : prev))}
          error={validation.errors.sourceUrl}
        />
        <LabeledInput
          label="Source library"
          value={form.sourceLibrary}
          onChange={(value) => setForm((prev) => (prev ? { ...prev, sourceLibrary: value } : prev))}
        />
        <LabeledInput
          label="Source repo"
          value={form.sourceRepo}
          onChange={(value) => setForm((prev) => (prev ? { ...prev, sourceRepo: value } : prev))}
        />
        <LabeledInput
          label="Source author"
          value={form.sourceAuthor}
          onChange={(value) => setForm((prev) => (prev ? { ...prev, sourceAuthor: value } : prev))}
        />
        <LabeledInput
          label="Source license"
          value={form.sourceLicense}
          onChange={(value) => setForm((prev) => (prev ? { ...prev, sourceLicense: value } : prev))}
        />

        <LabeledTextarea
          label="Capabilities (comma-separated)"
          value={form.capabilitiesText}
          onChange={(value) =>
            setForm((prev) => (prev ? { ...prev, capabilitiesText: value } : prev))
          }
        />
        <LabeledTextarea
          label="Synonyms (comma-separated)"
          value={form.synonymsText}
          onChange={(value) => setForm((prev) => (prev ? { ...prev, synonymsText: value } : prev))}
        />
        <LabeledTextarea
          label="Topics (comma-separated)"
          value={form.topicsText}
          onChange={(value) => setForm((prev) => (prev ? { ...prev, topicsText: value } : prev))}
          error={validation.errors.topicsText}
        />
        <LabeledTextarea
          label="Dependencies (one per line, name:kind)"
          value={form.dependenciesText}
          onChange={(value) =>
            setForm((prev) => (prev ? { ...prev, dependenciesText: value } : prev))
          }
          error={validation.errors.dependenciesText}
        />

        {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
        {status ? <p className="text-sm text-green-600">{status}</p> : null}
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={isDeleting || isSaving}>
              {isDeleting ? "Deleting…" : "Delete component"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this component?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes data from components + componentSearch only. componentCode is not
                touched.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  try {
                    setSubmitError(null);
                    setIsDeleting(true);
                    await remove({ componentId: form.componentId });
                    await navigate({ to: "/" });
                  } catch (error) {
                    setSubmitError(error instanceof Error ? error.message : "Delete failed");
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

        <Button
          disabled={!isDirty || !validation.valid || isSaving || isDeleting}
          onClick={async () => {
            try {
              setSubmitError(null);
              setStatus(null);
              setIsSaving(true);
              await update({
                componentId: form.componentId,
                name: form.name.trim(),
                styling: form.styling as (typeof STYLING_OPTIONS)[number],
                motionLevel: form.motionLevel as (typeof MOTION_OPTIONS)[number],
                primitiveLibrary: form.primitiveLibrary as (typeof PRIMITIVE_OPTIONS)[number],
                animationLibrary: form.animationLibrary as (typeof ANIMATION_OPTIONS)[number],
                source: {
                  url: form.sourceUrl.trim(),
                  library: toOptionalString(form.sourceLibrary),
                  repo: toOptionalString(form.sourceRepo),
                  author: toOptionalString(form.sourceAuthor),
                  license: toOptionalString(form.sourceLicense),
                },
                dependencies: parseDependencies(form.dependenciesText),
                intent: form.intent.trim(),
                capabilities: parseCsv(form.capabilitiesText),
                synonyms: parseCsv(form.synonymsText),
                topics: parseCsv(form.topicsText) as (typeof TOPIC_OPTIONS)[number][],
              });
              setStatus("Saved successfully.");
            } catch (error) {
              setSubmitError(error instanceof Error ? error.message : "Save failed");
            } finally {
              setIsSaving(false);
            }
          }}
        >
          {isSaving ? "Saving…" : "Save changes"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function toOptionalString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parseCsv(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function validateDependencies(value: string): string | null {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const [name, kind, ...rest] = line.split(":").map((part) => part.trim());
    if (!name || !kind || rest.length > 0) {
      return `Invalid dependency line: ${line}`;
    }
    if (!DEPENDENCY_KINDS.includes(kind as (typeof DEPENDENCY_KINDS)[number])) {
      return `Invalid dependency kind in line: ${line}`;
    }
  }

  return null;
}

function parseDependencies(
  value: string,
): Array<{ name: string; kind: (typeof DEPENDENCY_KINDS)[number] }> {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, kind] = line.split(":").map((part) => part.trim());
      return { name, kind: kind as (typeof DEPENDENCY_KINDS)[number] };
    });
}

function toFormState(data: EditorPayload): FormState {
  return {
    componentId: data.componentId,
    name: data.name,
    framework: data.framework,
    styling: data.styling,
    motionLevel: data.motionLevel,
    primitiveLibrary: data.primitiveLibrary,
    animationLibrary: data.animationLibrary,
    sourceUrl: data.source.url,
    sourceLibrary: data.source.library,
    sourceRepo: data.source.repo,
    sourceAuthor: data.source.author,
    sourceLicense: data.source.license,
    intent: data.intent,
    capabilitiesText: data.capabilities.join(", "),
    synonymsText: data.synonyms.join(", "),
    topicsText: data.topics.join(", "),
    dependenciesText: data.dependencies
      .map((dependency) => `${dependency.name}:${dependency.kind}`)
      .join("\n"),
  };
}

function LabeledInput(props: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{props.label}</span>
      <Input
        value={props.value}
        onChange={(event) => props.onChange?.(event.target.value)}
        disabled={props.disabled}
      />
      {props.error ? <span className="text-xs text-destructive">{props.error}</span> : null}
    </label>
  );
}

function LabeledTextarea(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{props.label}</span>
      <Textarea value={props.value} onChange={(event) => props.onChange(event.target.value)} />
      {props.error ? <span className="text-xs text-destructive">{props.error}</span> : null}
    </label>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  options: readonly string[];
  onValueChange: (value: string) => void;
  error?: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{props.label}</span>
      <Select value={props.value} onValueChange={props.onValueChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {props.options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {props.error ? <span className="text-xs text-destructive">{props.error}</span> : null}
    </label>
  );
}
