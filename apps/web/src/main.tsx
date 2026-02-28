import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { ConvexProviderWithAuthKit } from "@convex-dev/workos";
import { AuthKitProvider, useAuth } from "@workos-inc/authkit-react";

import { Toaster } from "@/components/ui/sonner";
import { env } from "@/env";
import { convex } from "@/lib/convex";

import "./index.css";
import { router } from "./router";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthKitProvider
      clientId={env.VITE_WORKOS_CLIENT_ID}
      redirectUri={env.VITE_WORKOS_REDIRECT_URI}
    >
      <ConvexProviderWithAuthKit client={convex} useAuth={useAuth}>
        <RouterProvider router={router} />
        <Toaster />
      </ConvexProviderWithAuthKit>
    </AuthKitProvider>
  </StrictMode>,
);
