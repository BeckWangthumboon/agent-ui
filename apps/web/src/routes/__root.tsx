import { Link, Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, ReceiptText, Settings2 } from "lucide-react";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { cn } from "@/lib/utils";

const navLinks = [
  { to: "/", label: "Dashboard", icon: LayoutGrid },
  { to: "/workspace", label: "Workspace", icon: ReceiptText },
  { to: "/settings", label: "Settings", icon: Settings2 },
] as const;

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <>
      <div className="min-h-screen bg-muted/30">
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-6 py-4">
            <div className="space-y-1">
              <Link to="/" className="text-lg font-semibold tracking-tight">
                Agent UI
              </Link>
              <p className="text-muted-foreground text-sm">
                Sample multi-page workspace built with TanStack Router.
              </p>
            </div>
            <nav className="flex items-center gap-2">
              {navLinks.map(({ to, label, icon: Icon }) => {
                const isActive = pathname === to;

                return (
                  <Link
                    key={to}
                    to={to}
                    className={cn(
                      "text-muted-foreground hover:text-foreground inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive && "bg-secondary text-secondary-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-8">
          <Outlet />
        </main>
      </div>
      <TanStackRouterDevtools />
    </>
  );
}
