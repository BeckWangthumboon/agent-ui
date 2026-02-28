import type { WorkosPublicClientConfig } from "./types.js";

function readEnv(name: string): string | null {
  const value = process.env[name];
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requireEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getConvexUrl(): string | null {
  return readEnv("CONVEX_URL");
}

export function requireConvexUrl(): string {
  const value = getConvexUrl();
  if (!value) {
    throw new Error("CONVEX_URL is required.");
  }

  return value;
}

export function requireWorkosPublicClientConfig(): WorkosPublicClientConfig {
  const clientId = requireEnv("WORKOS_CLIENT_ID");
  const redirectUri = requireEnv("WORKOS_REDIRECT_URI");

  try {
    new URL(redirectUri);
  } catch {
    throw new Error("WORKOS_REDIRECT_URI must be a valid absolute URL.");
  }

  return {
    clientId,
    redirectUri,
  };
}
