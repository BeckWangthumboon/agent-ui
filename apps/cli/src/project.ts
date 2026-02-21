import { dirname, join, resolve as resolvePath } from "node:path";

import { ensureDir, exists } from "./fsUtils.js";

const AGENTS_DIR_NAME = ".agents";
const GIT_MARKER_NAME = ".git";

export function noGitProjectFoundMessage(cwd: string) {
  return `No git project found from '${cwd}' upward. Use --config <path> or run inside a git repository.`;
}

export class AgentProjectNotFoundError extends Error {
  readonly cwd: string;

  constructor(cwd: string) {
    super(noGitProjectFoundMessage(cwd));
    this.name = "AgentProjectNotFoundError";
    this.cwd = cwd;
  }
}

function parentDirectory(path: string) {
  const parent = dirname(path);
  return parent === path ? null : parent;
}

async function findNearestAncestorContaining(
  markerName: string,
  startDir: string,
  stopDir?: string,
) {
  let current = startDir;

  while (true) {
    if (await exists(join(current, markerName))) {
      return current;
    }

    if (stopDir !== undefined && current === stopDir) {
      return null;
    }

    const parent = parentDirectory(current);
    if (!parent) {
      return null;
    }

    current = parent;
  }
}

export async function findProjectRoot(startDir = process.cwd()) {
  const normalizedStart = resolvePath(startDir);
  return findNearestAncestorContaining(GIT_MARKER_NAME, normalizedStart);
}

export type ResolveAgentsDirectoryInput = {
  cwd?: string;
  createIfMissing?: boolean;
};

export type ResolvedAgentsDirectory = {
  agentsDir: string;
  projectRoot: string;
  foundExisting: boolean;
};

export async function resolveAgentsDirectory(input: ResolveAgentsDirectoryInput = {}) {
  const cwd = resolvePath(input.cwd ?? process.cwd());
  const projectRoot = await findProjectRoot(cwd);

  if (!projectRoot) {
    throw new AgentProjectNotFoundError(cwd);
  }

  const stopDir = projectRoot;
  const nearestAgentsRoot = await findNearestAncestorContaining(AGENTS_DIR_NAME, cwd, stopDir);
  const agentsDir = nearestAgentsRoot
    ? join(nearestAgentsRoot, AGENTS_DIR_NAME)
    : join(stopDir, AGENTS_DIR_NAME);

  if (input.createIfMissing) {
    await ensureDir(agentsDir);
  }

  return {
    agentsDir,
    projectRoot,
    foundExisting: nearestAgentsRoot !== null,
  };
}
