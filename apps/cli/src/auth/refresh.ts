import type { StoredAuthSession } from "./types.js";
import type { AuthStorage } from "./storage.js";
import { getSessionRefreshDecision } from "./session.js";
import { refreshStoredSession } from "./workos.js";

export type EnsureSessionResult = {
  session: StoredAuthSession | null;
  refreshed: boolean;
  reason: string;
};

export async function ensureStoredSessionIsValid(
  storage: AuthStorage,
  session: StoredAuthSession,
  nowMs = Date.now(),
): Promise<EnsureSessionResult> {
  const decision = getSessionRefreshDecision(session, nowMs);
  if (!decision.needsRefresh) {
    return {
      session,
      refreshed: false,
      reason: decision.reason,
    };
  }

  if (!decision.canRefresh) {
    return {
      session: null,
      refreshed: false,
      reason: decision.reason,
    };
  }

  const refreshedSession = await refreshStoredSession(session);
  await storage.saveSession(refreshedSession);

  return {
    session: refreshedSession,
    refreshed: true,
    reason: decision.reason,
  };
}

export async function loadValidStoredSession(
  storage: AuthStorage,
  nowMs = Date.now(),
): Promise<EnsureSessionResult | null> {
  const session = await storage.loadSession();
  if (!session) {
    return null;
  }

  return ensureStoredSessionIsValid(storage, session, nowMs);
}
