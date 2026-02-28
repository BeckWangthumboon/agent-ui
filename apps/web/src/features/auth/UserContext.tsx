import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@workos-inc/authkit-react";
import { Authenticated, Unauthenticated, useAction, useConvex, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { createContext, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { api } from "@backend/convex/_generated/api";

export type User = NonNullable<FunctionReturnType<typeof api.users.index.getAccountOrNull>>;

type UserContextValue = { status: "loading" } | { status: "ready"; user: User };

const UserContext = createContext<UserContextValue | null>(null);

function RedirectToSignIn() {
  const navigate = useNavigate();

  useEffect(() => {
    void navigate({ to: "/sign-in" });
  }, [navigate]);

  return null;
}

export function UserProvider(props: { children: ReactNode }) {
  return (
    <>
      <Authenticated>
        <UserProviderInternal>{props.children}</UserProviderInternal>
      </Authenticated>
      <Unauthenticated>
        <RedirectToSignIn />
      </Unauthenticated>
    </>
  );
}

function UserProviderInternal(props: { children: ReactNode }) {
  const { signOut } = useAuth();
  const convex = useConvex();
  const ensureAccount = useAction(api.users.index.ensureAccount);
  const account = useQuery(api.users.index.getAccountOrNull);
  const ensureStartedRef = useRef(false);
  const [ensuredUser, setEnsuredUser] = useState<User | null>(null);
  const [ensureStatus, setEnsureStatus] = useState<"loading" | "ready">("loading");

  const handleAuthFailure = useCallback(
    async (error: unknown) => {
      console.error("Auth bootstrap failed:", error);
      try {
        await signOut({ navigate: false });
      } catch (signOutError) {
        console.error("WorkOS sign out failed:", signOutError);
      }
      convex.clearAuth();
      window.location.href = "/sign-in";
    },
    [convex, signOut],
  );

  useEffect(() => {
    if (ensureStartedRef.current) {
      return;
    }
    ensureStartedRef.current = true;

    void ensureAccount()
      .then((user) => {
        setEnsuredUser(user);
        setEnsureStatus("ready");
      })
      .catch((error) => {
        void handleAuthFailure(error);
      });
  }, [ensureAccount, handleAuthFailure]);

  if (ensureStatus === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Setting up your account...</p>
      </main>
    );
  }

  const resolvedUser = account ?? ensuredUser;
  if (!resolvedUser) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading your account...</p>
      </main>
    );
  }

  return (
    <UserContext.Provider value={{ status: "ready", user: resolvedUser }}>
      {props.children}
    </UserContext.Provider>
  );
}
