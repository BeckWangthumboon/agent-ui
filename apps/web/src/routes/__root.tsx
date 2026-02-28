import { Link, Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { LayoutGrid, LogOut, Settings2 } from "lucide-react";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const navLinks = [
  { to: "/", label: "Dashboard", icon: LayoutGrid },
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
            {/* Left: Logo */}
            <Link to="/" className="text-lg font-semibold tracking-tight">
              Agent UI
            </Link>

            {/* Right: Sign-out button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.alert("Sign out - not implemented yet")}
            >
              <LogOut className="size-4" />
              <span className="sr-only">Sign out</span>
            </Button>
          </div>
        </header>

        {/* Tab navigation below navbar */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex w-full max-w-7xl px-6">
            <Tabs defaultValue="/" value={pathname} className="w-auto">
              <TabsList variant="line">
                {navLinks.map(({ to, label, icon: Icon }) => (
                  <Link key={to} to={to} className="focus-visible:focus-ring-transparent">
                    <TabsTrigger value={to}>
                      <Icon className="size-4" />
                      <span>{label}</span>
                    </TabsTrigger>
                  </Link>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>

        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-8">
          <Outlet />
        </main>
      </div>
      <TanStackRouterDevtools />
    </>
  );
}
