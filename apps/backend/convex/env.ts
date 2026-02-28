const MISSING_WORKOS_CLIENT_ID = "missing-workos-client-id";
const runtimeEnv = (
  globalThis as {
    process?: {
      env?: Record<string, string | undefined>;
    };
  }
).process?.env;

function readEnv(name: string): string | null {
  const value = runtimeEnv?.[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

function requireEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getWorkosClientId(): string {
  return readEnv("WORKOS_CLIENT_ID") ?? MISSING_WORKOS_CLIENT_ID;
}

export function assertWorkosClientIdConfigured() {
  if (getWorkosClientId() === MISSING_WORKOS_CLIENT_ID) {
    throw new Error("Missing required environment variable: WORKOS_CLIENT_ID");
  }
}

export function getWorkosApiKey(): string {
  return requireEnv("WORKOS_API_KEY");
}

export function getWorkosWebhookSecret(): string {
  return requireEnv("WORKOS_WEBHOOK_SECRET");
}
