import { createFileRoute } from "@tanstack/react-router";
import { Bell, ShieldCheck, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Badge variant="secondary" className="rounded-full px-3 py-1">
          Settings
        </Badge>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Preferences for Orbit</h1>
          <p className="text-muted-foreground max-w-3xl">
            Placeholder account controls for a named assistant profile. The display name here is
            intentionally set to Orbit.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Basic identity and communication defaults.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <SettingRow
              icon={Sparkles}
              label="Display name"
              value="Orbit"
              hint="Shown across the sample workspace and assistant surfaces."
            />
            <SettingRow
              icon={Bell}
              label="Notifications"
              value="Daily digest"
              hint="Placeholder delivery cadence for workspace updates."
            />
          </div>
          <Separator />
          <SettingRow
            icon={ShieldCheck}
            label="Security policy"
            value="Standard review"
            hint="Keep manual approval enabled for actions that affect external systems."
          />
        </CardContent>
      </Card>
    </div>
  );
}

type SettingRowProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
};

function SettingRow({ icon: Icon, label, value, hint }: SettingRowProps) {
  return (
    <div className="flex items-start gap-4 rounded-xl border p-4">
      <div className="bg-secondary text-secondary-foreground rounded-lg p-2">
        <Icon className="size-4" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
        <p className="text-muted-foreground text-sm">{hint}</p>
      </div>
    </div>
  );
}
