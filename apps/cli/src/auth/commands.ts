import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { CLI_NAME } from "../constants.js";
import { parseAuthCallbackInput, validateCallbackState } from "./callback.js";
import { requireWorkosPublicClientConfig } from "./config.js";
import { formatExpiry, formatUserDisplayName, getSessionRefreshDecision } from "./session.js";
import { createAuthStorage } from "./storage.js";
import { exchangeAuthorizationCode, startPkceLogin } from "./workos.js";

function isProbablyHeadlessEnvironment(): boolean {
  if (process.env.CI === "true") {
    return true;
  }

  if (process.platform === "linux") {
    return !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY;
  }

  return Boolean(process.env.SSH_CONNECTION || process.env.SSH_TTY);
}

async function maybeOpenBrowser(url: string): Promise<boolean> {
  if (isProbablyHeadlessEnvironment()) {
    return false;
  }

  const specifier = "open";
  try {
    const imported = await import(specifier);
    const openUrl =
      typeof imported === "object" && imported !== null && "default" in imported
        ? imported.default
        : imported;

    if (typeof openUrl !== "function") {
      return false;
    }

    await openUrl(url);
    return true;
  } catch {
    return false;
  }
}

async function promptForCallback(): Promise<string> {
  const rl = createInterface({ input, output });

  try {
    return await rl.question("Paste the full callback URL or the authorization code: ");
  } finally {
    rl.close();
  }
}

export async function runLoginCommand(): Promise<void> {
  const { clientId, redirectUri } = requireWorkosPublicClientConfig();
  const storage = await createAuthStorage();
  const { url, pending } = await startPkceLogin(clientId, redirectUri);

  await storage.savePendingPkce(pending);

  console.log("Open this URL to sign in with WorkOS:");
  console.log(url);
  console.log("");

  const openedBrowser = await maybeOpenBrowser(url);
  if (openedBrowser) {
    console.log("A browser open was attempted on this machine.");
  }

  console.log("Headless flow:");
  console.log("1. Open the URL in any browser that can reach WorkOS.");
  console.log("2. Complete login and wait for the redirect to your configured callback URL.");
  console.log("3. Copy the full callback URL from the browser, or copy just the `code` value.");
  console.log("4. Paste it below.");

  const pastedValue = await promptForCallback();
  const parsed = parseAuthCallbackInput(pastedValue);
  validateCallbackState(pending.state, parsed.state);

  const session = await exchangeAuthorizationCode(pending, parsed.code);
  await storage.saveSession(session);
  await storage.clearPendingPkce();

  console.log(`Logged in as ${formatUserDisplayName(session.user)}.`);
  if (parsed.source === "code") {
    console.log("State was not verifiable because only an authorization code was pasted.");
  }
  console.log(`Access token expires ${formatExpiry(session.expiresAt)}.`);
  console.log(`Stored credentials in ${storage.description}.`);
}

export async function runStatusCommand(): Promise<void> {
  const storage = await createAuthStorage();
  const session = await storage.loadSession();

  if (!session) {
    console.log("No stored WorkOS session.");
    return;
  }

  const decision = getSessionRefreshDecision(session);

  console.log(`Logged in as ${formatUserDisplayName(session.user)}.`);
  console.log(`Access token expiry: ${formatExpiry(session.expiresAt)}.`);
  console.log(`Refresh token: ${session.refreshToken ? "present" : "missing"}.`);
  console.log(`Storage: ${storage.description}.`);

  if (decision.reason !== "valid") {
    console.log(
      `Stored access token requires attention (${decision.reason}). API commands will try to refresh it automatically when possible. Run \`${CLI_NAME} login\` again if refresh fails.`,
    );
  }
}

export async function runLogoutCommand(): Promise<void> {
  const storage = await createAuthStorage();
  await storage.clearAll();
  console.log("Cleared stored WorkOS session and pending PKCE state.");
}
