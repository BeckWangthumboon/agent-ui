import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { ConvexProviderWithAuthKit } from "@convex-dev/workos";
import { AuthKitProvider, useAuth } from "@workos-inc/authkit-react";
import "./index.css";
import { router } from "./router";
import { convex } from "./lib/convex";
import { env } from "./env";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthKitProvider
      clientId={env.VITE_WORKOS_CLIENT_ID}
      redirectUri={env.VITE_WORKOS_REDIRECT_URI}
    >
      <ConvexProviderWithAuthKit client={convex} useAuth={useAuth}>
        <RouterProvider router={router} />
      </ConvexProviderWithAuthKit>
    </AuthKitProvider>
  </StrictMode>,
);
