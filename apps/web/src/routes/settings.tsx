import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@workos-inc/authkit-react";
import { useMutation, useQuery } from "convex/react";
import { LoaderCircle, Mail, Save, UserRound } from "lucide-react";
import { toast } from "sonner";

import { api } from "@backend/convex/_generated/api";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { isLoading: isAuthLoading, user, signIn } = useAuth();
  const account = useQuery(api.users.index.getAccountOrNull, {});
  const updateCurrentUser = useMutation(api.users.index.updateCurrentUser);
  const [formValues, setFormValues] = useState({ firstName: "", lastName: "" });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!account) {
      return;
    }

    setFormValues({
      firstName: account.firstName ?? "",
      lastName: account.lastName ?? "",
    });
  }, [account?._id, account?.updatedAt]);

  if (isAuthLoading || account === undefined) {
    return <SettingsSkeleton />;
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Account settings"
          description="Sign in to edit the name shown across your account."
        />
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              Your first and last name are stored on your account and can only be edited while you
              are authenticated.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void signIn()}>Sign in with WorkOS</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (account === null) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Account settings"
          description="Your authenticated session is active, but no editable account record was found."
        />
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Account unavailable</CardTitle>
            <CardDescription>
              Profile editing is limited to the current signed-in user record. If this persists,
              check that the backend account bootstrap flow has created your `users` row.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const normalizedFirstName = formValues.firstName.trim();
  const normalizedLastName = formValues.lastName.trim();
  const hasChanges =
    normalizedFirstName !== (account.firstName ?? "") ||
    normalizedLastName !== (account.lastName ?? "");

  const handleSave = async () => {
    setIsSaving(true);

    try {
      await updateCurrentUser({
        firstName: normalizedFirstName || null,
        lastName: normalizedLastName || null,
      });
      toast.success("Profile updated.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const fullName =
    [account.firstName, account.lastName].filter(Boolean).join(" ") || "Unnamed user";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account settings"
        description="Edit how your name appears in the workspace. Email and profile picture stay managed by your auth provider."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Update your first and last name for the current account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4 rounded-xl border p-4">
              <Avatar className="h-14 w-14 border">
                <AvatarImage src={account.profilePictureUrl} alt={fullName} />
                <AvatarFallback className="text-sm font-semibold">
                  {getInitials(account.firstName, account.lastName, account.email)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <p className="text-sm font-medium">{fullName}</p>
                <p className="text-muted-foreground text-sm">{account.email}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                id="firstName"
                label="First name"
                value={formValues.firstName}
                onChange={(value) => setFormValues((current) => ({ ...current, firstName: value }))}
                placeholder="Ada"
              />
              <Field
                id="lastName"
                label="Last name"
                value={formValues.lastName}
                onChange={(value) => setFormValues((current) => ({ ...current, lastName: value }))}
                placeholder="Lovelace"
              />
            </div>

            <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground text-sm">
                Empty fields will clear the saved name. Email and profile picture are read-only
                here.
              </p>
              <Button onClick={() => void handleSave()} disabled={!hasChanges || isSaving}>
                {isSaving ? <LoaderCircle className="animate-spin" /> : <Save />}
                Save changes
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Managed fields</CardTitle>
            <CardDescription>
              These values are shown for context but are not editable from settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ReadonlyField icon={Mail} label="Email" value={account.email} />
            <ReadonlyField
              icon={UserRound}
              label="Profile picture"
              value={account.profilePictureUrl ? "Managed by WorkOS" : "No profile picture on file"}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-3">
      <Badge variant="secondary" className="rounded-full px-3 py-1">
        Settings
      </Badge>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground max-w-3xl">{description}</p>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function ReadonlyField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border p-4">
      <div className="bg-secondary text-secondary-foreground rounded-lg p-2">
        <Icon className="size-4" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-sm">{value}</p>
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-6 w-24 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-5 w-full max-w-2xl" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Skeleton className="h-[360px] rounded-xl" />
        <Skeleton className="h-[240px] rounded-xl" />
      </div>
    </div>
  );
}

function getInitials(firstName?: string, lastName?: string, email?: string) {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (name) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }

  return email?.slice(0, 2).toUpperCase() ?? "AU";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Failed to update profile.";
}
