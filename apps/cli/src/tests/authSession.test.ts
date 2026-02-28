import { describe, expect, it } from "bun:test";

import { REFRESH_WINDOW_MS, getSessionRefreshDecision } from "../auth/session";

const NOW_MS = Date.parse("2026-02-28T12:00:00.000Z");

describe("auth session refresh decisions", () => {
  it("keeps a session valid when expiry is comfortably in the future", () => {
    expect(
      getSessionRefreshDecision(
        {
          expiresAt: "2026-02-28T13:00:00.000Z",
          refreshToken: "refresh-token",
        },
        NOW_MS,
      ),
    ).toEqual({
      needsRefresh: false,
      canRefresh: true,
      reason: "valid",
    });
  });

  it("marks a session for refresh when it is inside the refresh window", () => {
    expect(
      getSessionRefreshDecision(
        {
          expiresAt: new Date(NOW_MS + REFRESH_WINDOW_MS - 1).toISOString(),
          refreshToken: "refresh-token",
        },
        NOW_MS,
      ),
    ).toEqual({
      needsRefresh: true,
      canRefresh: true,
      reason: "expiring_soon",
    });
  });

  it("marks an expired session as refreshable when a refresh token exists", () => {
    expect(
      getSessionRefreshDecision(
        {
          expiresAt: "2026-02-28T11:59:59.000Z",
          refreshToken: "refresh-token",
        },
        NOW_MS,
      ),
    ).toEqual({
      needsRefresh: true,
      canRefresh: true,
      reason: "expired",
    });
  });

  it("reports missing refresh token when the session is expired", () => {
    expect(
      getSessionRefreshDecision(
        {
          expiresAt: "2026-02-28T11:59:59.000Z",
          refreshToken: null,
        },
        NOW_MS,
      ),
    ).toEqual({
      needsRefresh: true,
      canRefresh: false,
      reason: "missing_refresh_token",
    });
  });

  it("reports missing expiry information when the timestamp is invalid", () => {
    expect(
      getSessionRefreshDecision(
        {
          expiresAt: "not-a-date",
          refreshToken: "refresh-token",
        },
        NOW_MS,
      ),
    ).toEqual({
      needsRefresh: true,
      canRefresh: true,
      reason: "missing_expiry",
    });
  });
});
