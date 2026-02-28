import type { StoredAuthSession } from "./types.js";

export const REFRESH_WINDOW_MS = 5 * 60 * 1000;

type JwtPayload = {
  exp?: number;
  scope?: string;
  scp?: string[] | string;
};

export type SessionRefreshReason =
  | "valid"
  | "expiring_soon"
  | "expired"
  | "missing_expiry"
  | "missing_refresh_token";

export type SessionRefreshDecision = {
  needsRefresh: boolean;
  canRefresh: boolean;
  reason: SessionRefreshReason;
};

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function parseJwtPayload(token: string): JwtPayload | null {
  const [, payload] = token.split(".");
  if (!payload) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as JwtPayload;
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

export function deriveTokenMetadata(
  accessToken: string,
  obtainedAt = new Date(),
): {
  expiresAt: string;
  scope?: string;
} {
  const payload = parseJwtPayload(accessToken);
  const obtainedAtIso = obtainedAt.toISOString();

  if (!payload?.exp || !Number.isFinite(payload.exp)) {
    return {
      expiresAt: obtainedAtIso,
    };
  }

  let scope: string | undefined;
  if (typeof payload.scope === "string" && payload.scope.trim().length > 0) {
    scope = payload.scope.trim();
  } else if (Array.isArray(payload.scp) && payload.scp.length > 0) {
    scope = payload.scp.join(" ");
  } else if (typeof payload.scp === "string" && payload.scp.trim().length > 0) {
    scope = payload.scp.trim();
  }

  return {
    expiresAt: new Date(payload.exp * 1000).toISOString(),
    scope,
  };
}

export function getSessionRefreshDecision(
  session: Pick<StoredAuthSession, "expiresAt" | "refreshToken">,
  nowMs = Date.now(),
  refreshWindowMs = REFRESH_WINDOW_MS,
): SessionRefreshDecision {
  const expiresAtMs = Date.parse(session.expiresAt);
  const hasRefreshToken =
    typeof session.refreshToken === "string" && session.refreshToken.length > 0;

  if (Number.isNaN(expiresAtMs)) {
    return {
      needsRefresh: true,
      canRefresh: hasRefreshToken,
      reason: hasRefreshToken ? "missing_expiry" : "missing_refresh_token",
    };
  }

  if (expiresAtMs <= nowMs) {
    return {
      needsRefresh: true,
      canRefresh: hasRefreshToken,
      reason: hasRefreshToken ? "expired" : "missing_refresh_token",
    };
  }

  if (expiresAtMs - nowMs <= refreshWindowMs) {
    return {
      needsRefresh: true,
      canRefresh: hasRefreshToken,
      reason: hasRefreshToken ? "expiring_soon" : "missing_refresh_token",
    };
  }

  return {
    needsRefresh: false,
    canRefresh: hasRefreshToken,
    reason: "valid",
  };
}

export function formatExpiry(expiresAt: string, nowMs = Date.now()): string {
  const expiresAtMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresAtMs)) {
    return "unknown expiry";
  }

  const diffMs = expiresAtMs - nowMs;
  const suffix = diffMs >= 0 ? "from now" : "ago";
  const diffMinutes = Math.round(Math.abs(diffMs) / 60_000);
  const relative =
    diffMinutes < 60
      ? `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ${suffix}`
      : `${Math.round(diffMinutes / 60)} hour${Math.round(diffMinutes / 60) === 1 ? "" : "s"} ${suffix}`;

  return `${expiresAt} (${relative})`;
}

export function formatUserDisplayName(user: StoredAuthSession["user"]): string {
  if (!user) {
    return "unknown user";
  }

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (name.length > 0) {
    return `${name} <${user.email}>`;
  }

  return user.email;
}
