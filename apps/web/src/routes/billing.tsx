import { createFileRoute } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/billing")({
  component: BillingPage,
});

function BillingPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          Billing
        </Badge>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Plan and invoice summary</h1>
          <p className="text-muted-foreground max-w-3xl">
            Sample finance placeholders live here to round out the dashboard navigation.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Usage overview</CardTitle>
          <CardDescription>Placeholder values for costs, plan tier, and next renewal.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Metric label="Current plan" value="Team" />
          <Metric label="Est. monthly spend" value="$248" />
          <Metric label="Renewal date" value="March 18" />
        </CardContent>
      </Card>
    </div>
  );
}

type MetricProps = {
  label: string;
  value: string;
};

function Metric({ label, value }: MetricProps) {
  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
