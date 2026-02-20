import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

type ComponentDependency = {
  name: string;
  kind: string;
};

type ComponentSource = {
  url: string;
  library?: string;
  repo?: string;
  author?: string;
  license?: string;
};

type ComponentMetadata = {
  id: string;
  name: string;
  source: ComponentSource;
  framework: string;
  styling: string;
  dependencies: ComponentDependency[];
  intent: string;
  motionLevel: string;
  primitiveLibrary: string;
  animationLibrary: string;
};

export const Route = createFileRoute("/components/$componentId")({
  component: ComponentMetadataPage,
});

function ComponentMetadataPage() {
  const { componentId } = Route.useParams();
  const component = useQuery(api.components.getMetadataById, { id: componentId });

  if (component === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Component Metadata</CardTitle>
          <CardDescription>Loading component metadata...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-96" />
          <Skeleton className="h-4 w-80" />
        </CardContent>
      </Card>
    );
  }

  if (component === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Component not found</CardTitle>
          <CardDescription>
            No metadata exists for <code>{componentId}</code>.
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

  return <SelectedLayout component={component} />;
}

function SelectedLayout(props: { component: ComponentMetadata }) {
  const { component } = props;

  return (
    <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-4 rounded-xl border bg-card p-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{component.name}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{component.intent}</p>
        </div>
        <PreviewPlaceholder label="Preview area" className="min-h-56" />
      </div>

      <div className="space-y-4 rounded-xl border bg-card p-5">
        <div className="space-y-3 text-sm">
          <MetadataRow label="ID" value={component.id} />
          <MetadataRow label="Framework" value={component.framework} />
          <MetadataRow label="Styling" value={component.styling} />
          <MetadataRow label="Motion" value={component.motionLevel} />
          <MetadataRow label="Primitive" value={component.primitiveLibrary} />
          <MetadataRow label="Animation" value={component.animationLibrary} />
        </div>
        <Separator />
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Dependencies</p>
          <DependencyList dependencies={component.dependencies} />
        </div>
        <Separator />
        <div className="space-y-3 text-sm">
          <MetadataRow label="Library" value={component.source.library ?? "N/A"} />
          <MetadataRow label="Repo" value={component.source.repo ?? "N/A"} />
          <MetadataRow label="Author" value={component.source.author ?? "N/A"} />
          <MetadataRow label="License" value={component.source.license ?? "N/A"} />
          <Button asChild variant="outline" size="sm">
            <a href={component.source.url} target="_blank" rel="noreferrer">
              Open source page
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}

function PreviewPlaceholder(props: { label: string; className?: string }) {
  const { label, className } = props;

  return (
    <div
      className={`flex min-h-48 items-center justify-center rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-sm text-muted-foreground ${className ?? ""}`}
    >
      {label}
    </div>
  );
}

function MetadataRow(props: { label: string; value: string }) {
  const { label, value } = props;
  return (
    <p className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </p>
  );
}

function DependencyList(props: { dependencies: ComponentDependency[] }) {
  const { dependencies } = props;

  if (dependencies.length === 0) {
    return <p className="text-sm text-muted-foreground">No dependencies listed.</p>;
  }

  return (
    <ul className="space-y-2 text-sm">
      {dependencies.map((dependency, index) => (
        <li key={`${dependency.name}:${dependency.kind}:${index}`}>
          <code className="text-xs">{dependency.name}</code>
        </li>
      ))}
    </ul>
  );
}
