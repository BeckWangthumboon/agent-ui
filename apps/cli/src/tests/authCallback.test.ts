import { describe, expect, it } from "bun:test";

import { parseAuthCallbackInput, validateCallbackState } from "../auth/callback";

describe("auth callback parsing", () => {
  it("parses a full callback URL", () => {
    const parsed = parseAuthCallbackInput("https://example.com/callback?code=abc123&state=state-1");

    expect(parsed).toEqual({
      code: "abc123",
      state: "state-1",
      source: "url",
    });
  });

  it("parses a raw authorization code", () => {
    const parsed = parseAuthCallbackInput("auth-code-only");

    expect(parsed).toEqual({
      code: "auth-code-only",
      source: "code",
    });
  });

  it("parses raw callback params", () => {
    const parsed = parseAuthCallbackInput("code=abc123&state=state-1");

    expect(parsed).toEqual({
      code: "abc123",
      state: "state-1",
      source: "params",
    });
  });

  it("fails when a callback URL has no code", () => {
    expect(() => parseAuthCallbackInput("https://example.com/callback?state=only")).toThrow(
      "Callback URL did not include a 'code' parameter.",
    );
  });

  it("fails on an OAuth error callback", () => {
    expect(() =>
      parseAuthCallbackInput(
        "https://example.com/callback?error=access_denied&error_description=user+canceled",
      ),
    ).toThrow("Authentication failed: access_denied. user canceled");
  });
});

describe("auth callback state validation", () => {
  it("accepts a matching state", () => {
    expect(() => validateCallbackState("state-1", "state-1")).not.toThrow();
  });

  it("accepts missing pasted state", () => {
    expect(() => validateCallbackState("state-1", undefined)).not.toThrow();
  });

  it("rejects a mismatched state", () => {
    expect(() => validateCallbackState("expected-state", "wrong-state")).toThrow(
      "The pasted callback state did not match the active login attempt.",
    );
  });
});
