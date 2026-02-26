import { ConvexReactClient } from "convex/react";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    "Missing VITE_CONVEX_URL. Set it in apps/web-view/.env.local (for example: VITE_CONVEX_URL=https://<deployment>.convex.cloud).",
  );
}

export const convex = new ConvexReactClient(convexUrl);
