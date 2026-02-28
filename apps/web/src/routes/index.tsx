import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Bot, CreditCard, FolderKanban, Settings2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const dashboardCards = [
  {
    title: "Workspace",
    description: "Track current activity, recent decisions, and the next set of actions.",
    eyebrow: "Operations",
    to: "/workspace",
    icon: FolderKanban,
  },
  {
    title: "Settings",
    description: "Adjust profile details, notifications, and connected services.",
    eyebrow: "Configuration",
    to: "/settings",
    icon: Settings2,
  },
  {
    title: "Billing",
    description: "Review usage summaries, invoices, and plan status placeholders.",
    eyebrow: "Finance",
    to: "/billing",
    icon: CreditCard,
  },
  {
    title: "Assistants",
    description: "Browse available agents, capabilities, and team-facing ownership notes.",
    eyebrow: "Catalog",
    to: "/assistants",
    icon: Bot,
  },
] as const;

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="space-y-8">
      <section className="grid gap-6 rounded-2xl border bg-background p-8 shadow-sm lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            Dashboard
          </Badge>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight">Control center for the sample UI</h1>
            <p className="text-muted-foreground max-w-2xl text-base">
              This landing page acts as the dashboard home, with lightweight routes for navigation
              flows and placeholder content across the app.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/workspace">Open workspace</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/settings">Review settings</Link>
            </Button>
          </div>
        </div>
        <Card className="border-dashed bg-muted/40 py-0 shadow-none">
          <CardHeader className="py-6">
            <CardTitle>Today&apos;s snapshot</CardTitle>
            <CardDescription>Placeholder metrics for a clean dashboard composition.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pb-6">
            <div className="rounded-lg border bg-background p-4">
              <p className="text-muted-foreground text-sm">Open tasks</p>
              <p className="mt-2 text-3xl font-semibold">12</p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-muted-foreground text-sm">Pending reviews</p>
              <p className="mt-2 text-3xl font-semibold">3</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Explore pages</h2>
          <p className="text-muted-foreground">
            The cards below provide simple entry points into the rest of the sample application.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboardCards.map(({ title, description, eyebrow, to, icon: Icon }) => (
            <Card key={to} className="h-full justify-between">
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="outline">{eyebrow}</Badge>
                  <div className="bg-secondary text-secondary-foreground rounded-md p-2">
                    <Icon className="size-4" />
                  </div>
                </div>
                <div className="space-y-2">
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </div>
              </CardHeader>
              <CardFooter>
                <Button asChild variant="ghost" className="px-0">
                  <Link to={to}>
                    Open page
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
