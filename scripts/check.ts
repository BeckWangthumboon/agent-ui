type Scope = "all" | "web" | "cli";

type CheckTask = {
  name: string;
  cmd: string[];
  quiet?: boolean;
};

type CheckResult = {
  name: string;
  exitCode: number;
};

const requestedScope = Bun.argv[2]?.trim().toLowerCase();
const scope: Scope = toScope(requestedScope);

const TASKS: Record<Scope, CheckTask[]> = {
  all: [
    { name: "typecheck", cmd: ["bun", "run", "typecheck"] },
    { name: "lint", cmd: ["bun", "run", "lint"] },
    { name: "format", cmd: ["bun", "run", "format:check:quiet"], quiet: true },
  ],
  web: [
    { name: "typecheck:web", cmd: ["bun", "run", "typecheck:web"] },
    { name: "lint:web", cmd: ["bun", "run", "lint:web"] },
    { name: "format:web", cmd: ["bun", "run", "format:check:web:quiet"], quiet: true },
  ],
  cli: [
    { name: "typecheck:cli", cmd: ["bun", "run", "typecheck:cli"] },
    { name: "lint:cli", cmd: ["bun", "run", "lint:cli"] },
    { name: "format:cli", cmd: ["bun", "run", "format:check:cli:quiet"], quiet: true },
  ],
};

console.log(`Running checks for '${scope}' in parallel...`);

const results = await Promise.all(TASKS[scope].map(runTask));
const failed = results.filter((result) => result.exitCode !== 0);

if (failed.length === 0) {
  console.log(`All ${TASKS[scope].length} checks passed for '${scope}'.`);
  process.exit(0);
}

console.error(`Checks failed for '${scope}':`);
for (const failure of failed) {
  console.error(`- ${failure.name} (exit ${failure.exitCode})`);
}
process.exit(1);

async function runTask(task: CheckTask): Promise<CheckResult> {
  const processHandle = Bun.spawn({
    cmd: task.cmd,
    stdout: task.quiet ? "pipe" : "inherit",
    stderr: task.quiet ? "pipe" : "inherit",
  });

  const exitCode = await processHandle.exited;

  if (task.quiet && exitCode !== 0) {
    const [stdout, stderr] = await Promise.all([
      readProcessStream(processHandle.stdout),
      readProcessStream(processHandle.stderr),
    ]);

    if (stdout.length > 0) {
      console.error(stdout.trimEnd());
    }

    if (stderr.length > 0) {
      console.error(stderr.trimEnd());
    }
  }

  return { name: task.name, exitCode };
}

function toScope(value: string | undefined): Scope {
  if (!value || value === "all") {
    return "all";
  }

  if (value === "web" || value === "cli") {
    return value;
  }

  console.error(`Unknown scope '${value}'. Use one of: all, web, cli.`);
  process.exit(1);
}

async function readProcessStream(stream: ReadableStream<Uint8Array> | null | undefined): Promise<string> {
  if (!stream) {
    return "";
  }

  return await new Response(stream).text();
}

export {};
