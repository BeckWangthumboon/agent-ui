import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname } from "node:path";

function messageFromError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function withCause(message: string, error: unknown): Error {
  if (error instanceof Error) {
    return new Error(message, { cause: error });
  }

  return new Error(message);
}

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(path: string): Promise<void> {
  try {
    await mkdir(path, { recursive: true });
  } catch (error) {
    throw withCause(`Failed to create directory '${path}': ${messageFromError(error)}`, error);
  }
}

export async function readText(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    throw withCause(`Failed to read file '${path}': ${messageFromError(error)}`, error);
  }
}

export async function readJson<T>(path: string): Promise<T> {
  const text = await readText(path);

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw withCause(`Invalid JSON in '${path}': ${messageFromError(error)}`, error);
  }
}

export async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  const parentDir = dirname(path);
  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  const serialized = `${JSON.stringify(value, null, 2)}\n`;

  await ensureDir(parentDir);

  try {
    await writeFile(tempPath, serialized, "utf8");
    await rename(tempPath, path);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => {
      // Ignore temp cleanup failures.
    });
    throw withCause(`Failed to write JSON file '${path}': ${messageFromError(error)}`, error);
  }
}
