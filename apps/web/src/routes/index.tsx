import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Settings2, Square } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const dashboardCards = [
  {
    title: "Settings",
    description: "Adjust profile details and preferences.",
    to: "/settings",
    icon: Settings2,
  },
  {
    title: "Third Page",
    description: "An empty placeholder page for now.",
    to: "/third",
    icon: Square,
  },
] as const;

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border bg-background p-8 shadow-sm">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          Dashboard
        </Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Sample dashboard</h1>
        <p className="text-muted-foreground mt-2">Use the cards below to navigate.</p>
        <div className="mt-4 flex gap-3">
          <Button asChild>
            <Link to="/settings">Open settings</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/third">Open third page</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {dashboardCards.map(({ title, description, to, icon: Icon }) => (
          <Card key={to}>
            <CardHeader>
              <div className="bg-secondary text-secondary-foreground mb-3 w-fit rounded-md p-2">
                <Icon className="size-4" />
              </div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
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
      </section>
    </div>
  );
}
