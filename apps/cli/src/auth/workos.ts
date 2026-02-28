import { createWorkOS, type AuthenticationResponse, type PublicWorkOS } from "@workos-inc/node";
import { deriveTokenMetadata } from "./session.js";
import type { StoredAuthSession, StoredPendingPkce, StoredUserSummary } from "./types.js";

function summarizeUser(response: AuthenticationResponse): StoredUserSummary {
  return {
    id: response.user.id,
    email: response.user.email,
    firstName: response.user.firstName ?? undefined,
    lastName: response.user.lastName ?? undefined,
  };
}

function createStoredSession(
  response: AuthenticationResponse,
  clientId: string,
  redirectUri: string,
  obtainedAt = new Date(),
): StoredAuthSession {
  const tokenMetadata = deriveTokenMetadata(response.accessToken, obtainedAt);

  return {
    version: 1,
    accessToken: response.accessToken,
    refreshToken: response.refreshToken ?? null,
    expiresAt: tokenMetadata.expiresAt,
    tokenType: "Bearer",
    scope: tokenMetadata.scope,
    obtainedAt: obtainedAt.toISOString(),
    clientId,
    redirectUri,
    user: summarizeUser(response),
  };
}

export function createPublicWorkosClient(clientId: string): PublicWorkOS {
  return createWorkOS({ clientId });
}

export async function startPkceLogin(
  clientId: string,
  redirectUri: string,
): Promise<{
  url: string;
  pending: StoredPendingPkce;
}> {
  const workos = createPublicWorkosClient(clientId);
  const pkce = await workos.userManagement.getAuthorizationUrlWithPKCE({
    provider: "authkit",
    clientId,
    redirectUri,
  });

  return {
    url: pkce.url,
    pending: {
      version: 1,
      state: pkce.state,
      codeVerifier: pkce.codeVerifier,
      clientId,
      redirectUri,
      createdAt: new Date().toISOString(),
    },
  };
}

export async function exchangeAuthorizationCode(
  pending: StoredPendingPkce,
  code: string,
): Promise<StoredAuthSession> {
  const workos = createPublicWorkosClient(pending.clientId);
  const response = await workos.userManagement.authenticateWithCode({
    clientId: pending.clientId,
    code,
    codeVerifier: pending.codeVerifier,
  });

  return createStoredSession(response, pending.clientId, pending.redirectUri);
}

export async function refreshStoredSession(session: StoredAuthSession): Promise<StoredAuthSession> {
  if (!session.refreshToken) {
    throw new Error("No refresh token is available for the stored session.");
  }

  const workos = createPublicWorkosClient(session.clientId);
  const response = await workos.userManagement.authenticateWithRefreshToken({
    clientId: session.clientId,
    refreshToken: session.refreshToken,
  });

  return createStoredSession(response, session.clientId, session.redirectUri);
}
