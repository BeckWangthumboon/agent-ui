export const AUTH_SESSION_VERSION = 1;

export type AuthStorageBackend = "keytar" | "file";

export type StoredUserSummary = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
};

export type StoredAuthSession = {
  version: typeof AUTH_SESSION_VERSION;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  tokenType: string;
  scope?: string;
  obtainedAt: string;
  clientId: string;
  redirectUri: string;
  user?: StoredUserSummary;
};

export type StoredPendingPkce = {
  version: typeof AUTH_SESSION_VERSION;
  state: string;
  codeVerifier: string;
  clientId: string;
  redirectUri: string;
  createdAt: string;
};

export type StoredAuthState = {
  version: typeof AUTH_SESSION_VERSION;
  session: StoredAuthSession | null;
  pendingPkce: StoredPendingPkce | null;
};

export type WorkosPublicClientConfig = {
  clientId: string;
  redirectUri: string;
};
