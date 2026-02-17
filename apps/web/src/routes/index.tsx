import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="w-full rounded-xl border bg-card p-8 text-card-foreground shadow-xs">
      <div className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Internal Webview
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">TanStack Router + shadcn/ui</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Your Vite SPA is ready with file-based routing, Tailwind, and shadcn.
        </p>
        <Button>shadcn Button</Button>
      </div>
    </div>
  );
}
