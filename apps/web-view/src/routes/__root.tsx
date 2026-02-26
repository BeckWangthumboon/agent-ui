import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
      <div className="min-h-screen bg-background text-foreground antialiased">
        <header className="border-b border-border/80 bg-card/40">
          <div className="mx-auto flex w-full max-w-5xl items-center px-6 py-4">
            <Link to="/" className="text-sm font-semibold tracking-tight">
              Component Directory
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-6 py-8">
          <Outlet />
        </main>
      </div>
      <TanStackRouterDevtools />
    </>
  );
}
