import { createFileRoute } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const assistants = [
  { name: "Orbit", specialty: "Routing demos", status: "Available" },
  { name: "Beacon", specialty: "Review queues", status: "Queued" },
  { name: "Harbor", specialty: "Onboarding flows", status: "Draft" },
] as const;

export const Route = createFileRoute("/assistants")({
  component: AssistantsPage,
});

function AssistantsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          Assistants
        </Badge>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Assistant directory</h1>
          <p className="text-muted-foreground max-w-3xl">
            Placeholder records provide another simple destination for the dashboard card grid.
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {assistants.map((assistant) => (
          <Card key={assistant.name}>
            <CardHeader>
              <CardTitle>{assistant.name}</CardTitle>
              <CardDescription>{assistant.specialty}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant="outline">{assistant.status}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
