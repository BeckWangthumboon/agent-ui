import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const ALL_FILTER = "all";
const SEARCH_DEBOUNCE_MS = 250;

function HomePage() {
  const components = useQuery(api.components.listDirectory);
  const [searchQuery, setSearchQuery] = useState("");
  const [primitiveFilter, setPrimitiveFilter] = useState(ALL_FILTER);
  const [motionFilter, setMotionFilter] = useState(ALL_FILTER);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);

  const primitiveOptions = useMemo(() => {
    if (!components) {
      return [];
    }

    return Array.from(new Set(components.map((component) => component.primitiveLibrary))).sort(
      (left, right) => left.localeCompare(right, "en"),
    );
  }, [components]);

  const motionOptions = useMemo(() => {
    if (!components) {
      return [];
    }

    return Array.from(new Set(components.map((component) => component.motionLevel))).sort(
      (left, right) => left.localeCompare(right, "en"),
    );
  }, [components]);

  const filteredComponents = useMemo(() => {
    if (!components) {
      return [];
    }

    const normalizedQuery = debouncedSearchQuery.trim().toLowerCase();

    return components.filter((component) => {
      const matchesPrimitive =
        primitiveFilter === ALL_FILTER || component.primitiveLibrary === primitiveFilter;
      const matchesMotion = motionFilter === ALL_FILTER || component.motionLevel === motionFilter;

      if (!matchesPrimitive || !matchesMotion) {
        return false;
      }

      if (normalizedQuery.length === 0) {
        return true;
      }

      const searchableText =
        `${component.name} ${component.intent} ${component.id} ${component.source.library ?? ""} ${component.source.author ?? ""} ${component.primitiveLibrary}`.toLowerCase();
      return searchableText.includes(normalizedQuery);
    });
  }, [components, debouncedSearchQuery, primitiveFilter, motionFilter]);

  if (components === undefined) {
    return (
      <section className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Component Directory</h1>
          <p className="mt-1 text-sm text-muted-foreground">Loading component directory...</p>
        </div>
        <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  if (components.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Component Directory</CardTitle>
          <CardDescription>No components were found.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Component Directory</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse components by metadata. Open a component page to see full metadata details.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_200px_200px_auto]">
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search name, description, id, source..."
        />
        <Select value={primitiveFilter} onValueChange={setPrimitiveFilter}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All primitives" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All primitives</SelectItem>
            {primitiveOptions.map((primitive) => (
              <SelectItem key={primitive} value={primitive}>
                {primitive}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={motionFilter} onValueChange={setMotionFilter}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All motion levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All motion levels</SelectItem>
            {motionOptions.map((motion) => (
              <SelectItem key={motion} value={motion}>
                {motion}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSearchQuery("");
            setPrimitiveFilter(ALL_FILTER);
            setMotionFilter(ALL_FILTER);
          }}
        >
          Clear
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {filteredComponents.length} of {components.length} components
      </p>

      {filteredComponents.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredComponents.map((component) => (
            <li key={component.id} className="h-full">
              <Link
                to="/components/$componentId"
                params={{ componentId: component.id }}
                className="block h-full"
              >
                <Card className="h-56 transition-colors hover:bg-accent/40">
                  <CardHeader className="pb-2">
                    <CardTitle>{component.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <CardDescription>{toBrief(component.intent)}</CardDescription>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      {toSourceLabel(component.source)}
                    </p>
                  </CardFooter>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No matching components</CardTitle>
            <CardDescription>Try a different query or clear filters.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </section>
  );
}

function toBrief(text: string, maxLength = 120): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}...`;
}

function toSourceLabel(source: { library?: string; author?: string }): string {
  if (source.library && source.author) {
    return `${source.library} by ${source.author}`;
  }

  return source.library ?? source.author ?? "Unknown source";
}
