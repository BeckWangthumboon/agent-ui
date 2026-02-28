import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, Clock3, ListTodo } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const workspaceItems = [
  {
    title: "Ready for handoff",
    description: "Three flows are staged for review with placeholder copy and routing.",
    icon: BadgeCheck,
  },
  {
    title: "Upcoming milestones",
    description: "Two timeline checkpoints are visible here for layout coverage.",
    icon: Clock3,
  },
  {
    title: "Backlog focus",
    description: "Capture next tasks, decisions, and owner notes in a single card grid.",
    icon: ListTodo,
  },
] as const;

export const Route = createFileRoute("/workspace")({
  component: WorkspacePage,
});

function WorkspacePage() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          Workspace
        </Badge>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Current operating view</h1>
          <p className="text-muted-foreground max-w-3xl">
            This route provides simple placeholder content so the dashboard has a concrete linked
            destination beyond settings.
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {workspaceItems.map(({ title, description, icon: Icon }) => (
          <Card key={title}>
            <CardHeader className="space-y-4">
              <div className="bg-secondary text-secondary-foreground w-fit rounded-lg p-2">
                <Icon className="size-4" />
              </div>
              <div className="space-y-2">
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Placeholder panel content for future charts, lists, or review queues.
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
