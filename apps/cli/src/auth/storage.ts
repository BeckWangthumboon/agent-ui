import { homedir } from "node:os";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import { z } from "zod";

import { CLI_NAME } from "../constants.js";
import { exists, readJson, writeJsonAtomic } from "../fsUtils.js";
import {
  AUTH_SESSION_VERSION,
  type AuthStorageBackend,
  type StoredAuthSession,
  type StoredAuthState,
  type StoredPendingPkce,
} from "./types.js";

const AUTH_FILE_MODE = 0o600;
const AUTH_STORAGE_FILENAME = "auth.json";
const AUTH_KEYTAR_SERVICE = CLI_NAME;
const AUTH_KEYTAR_SESSION_ACCOUNT = "auth-session-v1";
const AUTH_KEYTAR_PENDING_ACCOUNT = "auth-pending-pkce-v1";

const UserSummarySchema = z
  .strictObject({
    id: z.string().min(1),
    email: z.string().min(1),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
  })
  .optional();

const StoredAuthSessionSchema = z.strictObject({
  version: z.literal(AUTH_SESSION_VERSION),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).nullable(),
  expiresAt: z.string().min(1),
  tokenType: z.string().min(1),
  scope: z.string().min(1).optional(),
  obtainedAt: z.string().min(1),
  clientId: z.string().min(1),
  redirectUri: z.string().min(1),
  user: UserSummarySchema,
});

const StoredPendingPkceSchema = z.strictObject({
  version: z.literal(AUTH_SESSION_VERSION),
  state: z.string().min(1),
  codeVerifier: z.string().min(1),
  clientId: z.string().min(1),
  redirectUri: z.string().min(1),
  createdAt: z.string().min(1),
});

const StoredAuthStateSchema = z.strictObject({
  version: z.literal(AUTH_SESSION_VERSION),
  session: StoredAuthSessionSchema.nullable().optional(),
  pendingPkce: StoredPendingPkceSchema.nullable().optional(),
});

type KeytarModule = {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, password: string): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
};

export type AuthStorage = {
  backend: AuthStorageBackend;
  description: string;
  loadSession(): Promise<StoredAuthSession | null>;
  saveSession(session: StoredAuthSession): Promise<void>;
  clearSession(): Promise<void>;
  loadPendingPkce(): Promise<StoredPendingPkce | null>;
  savePendingPkce(pendingPkce: StoredPendingPkce): Promise<void>;
  clearPendingPkce(): Promise<void>;
  clearAll(): Promise<void>;
};

function getAuthFilePath(): string {
  return join(homedir(), ".config", CLI_NAME, AUTH_STORAGE_FILENAME);
}

function createEmptyState(): StoredAuthState {
  return {
    version: AUTH_SESSION_VERSION,
    session: null,
    pendingPkce: null,
  };
}

function parseStoredValue<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Stored ${label} data is invalid. Run \`${CLI_NAME} logout\` to reset it.`);
  }

  return parsed.data;
}

function parseSerializedJson(serialized: string, label: string): unknown {
  try {
    return JSON.parse(serialized);
  } catch {
    throw new Error(`Stored ${label} data is invalid. Run \`${CLI_NAME} logout\` to reset it.`);
  }
}

async function loadOptionalModule<T>(specifier: string): Promise<T | null> {
  try {
    const imported = await import(specifier);
    const candidate =
      typeof imported === "object" && imported !== null && "default" in imported
        ? imported.default
        : imported;

    return candidate as T;
  } catch {
    return null;
  }
}

function createKeytarStorage(keytar: KeytarModule): AuthStorage {
  return {
    backend: "keytar",
    description: "OS credential storage via keytar",
    async loadSession() {
      const serialized = await keytar.getPassword(AUTH_KEYTAR_SERVICE, AUTH_KEYTAR_SESSION_ACCOUNT);
      if (!serialized) {
        return null;
      }

      return parseStoredValue(
        StoredAuthSessionSchema,
        parseSerializedJson(serialized, "session"),
        "session",
      );
    },
    async saveSession(session) {
      await keytar.setPassword(
        AUTH_KEYTAR_SERVICE,
        AUTH_KEYTAR_SESSION_ACCOUNT,
        JSON.stringify(session),
      );
    },
    async clearSession() {
      await keytar.deletePassword(AUTH_KEYTAR_SERVICE, AUTH_KEYTAR_SESSION_ACCOUNT);
    },
    async loadPendingPkce() {
      const serialized = await keytar.getPassword(AUTH_KEYTAR_SERVICE, AUTH_KEYTAR_PENDING_ACCOUNT);
      if (!serialized) {
        return null;
      }

      return parseStoredValue(
        StoredPendingPkceSchema,
        parseSerializedJson(serialized, "pending PKCE"),
        "pending PKCE",
      );
    },
    async savePendingPkce(pendingPkce) {
      await keytar.setPassword(
        AUTH_KEYTAR_SERVICE,
        AUTH_KEYTAR_PENDING_ACCOUNT,
        JSON.stringify(pendingPkce),
      );
    },
    async clearPendingPkce() {
      await keytar.deletePassword(AUTH_KEYTAR_SERVICE, AUTH_KEYTAR_PENDING_ACCOUNT);
    },
    async clearAll() {
      await Promise.all([this.clearSession(), this.clearPendingPkce()]);
    },
  };
}

function createFileStorage(): AuthStorage {
  const authFilePath = getAuthFilePath();

  async function readState(): Promise<StoredAuthState> {
    const fileExists = await exists(authFilePath);
    if (!fileExists) {
      return createEmptyState();
    }

    return normalizeState(await readJson(authFilePath));
  }

  async function writeState(state: StoredAuthState): Promise<void> {
    if (!state.session && !state.pendingPkce) {
      await rm(authFilePath, { force: true }).catch(() => {
        // Ignore cleanup failures for missing files.
      });
      return;
    }

    await writeJsonAtomic(authFilePath, state, { mode: AUTH_FILE_MODE });
  }

  function normalizeState(value: unknown): StoredAuthState {
    const parsed = parseStoredValue(StoredAuthStateSchema, value, "auth");
    return {
      version: parsed.version,
      session: parsed.session ?? null,
      pendingPkce: parsed.pendingPkce ?? null,
    };
  }

  return {
    backend: "file",
    description: authFilePath,
    async loadSession() {
      const state = await readState();
      return state.session;
    },
    async saveSession(session) {
      const state = await readState();
      await writeState({
        ...state,
        session,
      });
    },
    async clearSession() {
      const state = await readState();
      await writeState({
        ...state,
        session: null,
      });
    },
    async loadPendingPkce() {
      const state = await readState();
      return state.pendingPkce;
    },
    async savePendingPkce(pendingPkce) {
      const state = await readState();
      await writeState({
        ...state,
        pendingPkce,
      });
    },
    async clearPendingPkce() {
      const state = await readState();
      await writeState({
        ...state,
        pendingPkce: null,
      });
    },
    async clearAll() {
      await writeState(createEmptyState());
    },
  };
}

export async function createAuthStorage(): Promise<AuthStorage> {
  const keytar = await loadOptionalModule<KeytarModule>("keytar");
  if (keytar) {
    return createKeytarStorage(keytar);
  }

  return createFileStorage();
}
