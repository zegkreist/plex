/**
 * plex-cli-run.js — Command execution helpers for plex-cli.js.
 *
 * Two execution strategies
 * ──────────────────────────────────────────────────────────────────────────────
 * 1. runCommand(command, resolvedArgs)   [used for direct CLI mode]
 *    Uses spawnSync so the parent event loop is suspended while the child runs.
 *    Works for non-interactive or mildly-interactive commands.
 *
 * 2. buildExecSnippet(command, resolvedArgs)  [used by the interactive menu]
 *    Returns a POSIX shell snippet (cd + exec …) that the `plex` wrapper script
 *    evaluates directly.  Because the shell — not Node.js — owns the TTY when
 *    the snippet runs, interactive children (inquirer, fzf, bash menus…) have
 *    completely uncontested access to fd 0.
 *
 * Why the two-strategy approach?
 * ──────────────────────────────────────────────────────────────────────────────
 * readline.createInterface (used by prompt()) calls readline.emitKeypressEvents
 * which starts an async read on process.stdin.  Even after rl.close() +
 * removeAllListeners() + pause(), libuv may have an in-flight read that already
 * moved bytes from the kernel TTY buffer into Node.js's internal buffer before
 * spawnSync started.  The child process reading from the same fd 0 no longer
 * sees those bytes — they were consumed by the parent.  This causes interactive
 * children to receive partial/empty input and exit immediately.
 *
 * The shell wrapper (./plex) solves this definitively: Node.js exits cleanly
 * after the user picks a command.  The shell then runs the command with full,
 * exclusive TTY ownership.
 */

import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.dirname(__filename);

// ─── Cores ANSI (kept local to avoid circular import with plex-cli.js) ────────
const DIM   = "\x1b[2m";
const RED   = "\x1b[31m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";
const d = (s) => `${DIM}${s}${RESET}`;
const r = (s) => `${RED}${s}${RESET}`;
const g = (s) => `${GREEN}${s}${RESET}`;

/**
 * @typedef {object} Command
 * @property {string}    cmd    - Executable name (e.g. "node", "npm", "bash").
 * @property {string[]}  args   - Default argument list.
 * @property {string}    cwd    - Working directory for the process.
 * @property {boolean}   [sudo] - When true the command is wrapped with sudo.
 */

/**
 * @typedef {object} SpawnArgs
 * @property {string}   finalCmd  - The executable that will be passed to spawnSync.
 * @property {string[]} finalArgs - The argument list that will be passed to spawnSync.
 * @property {string}   cwd       - The working directory for the process.
 */

/**
 * Computes the final executable name and argument list for a command, applying
 * sudo wrapping when `command.sudo` is true.
 *
 * Pure function — no side effects, fully testable.
 *
 * @param {Command}         command      - The command descriptor.
 * @param {string[] | null | undefined} resolvedArgs - Pre-resolved arguments
 *   (e.g. after dynamic input substitution). Falls back to `command.args` when
 *   falsy.
 * @returns {SpawnArgs}
 */
export function buildSpawnArgs(command, resolvedArgs) {
  const { cmd, cwd, sudo } = command;
  const args = resolvedArgs ?? command.args;

  const finalCmd  = sudo ? "sudo" : cmd;
  const finalArgs = sudo ? [cmd, ...args] : args;

  return { finalCmd, finalArgs, cwd };
}

/**
 * Executes a CLI command synchronously with the terminal fully inherited by the
 * child process.
 *
 * Uses spawnSync so the parent Node.js event loop is completely suspended while
 * the child runs. This gives interactive child programs (inquirer, fzf, bash
 * menus, etc.) exclusive, uncontested access to stdin/stdout/stderr — which is
 * required for their prompts to work correctly.
 *
 * @param {Command}         command      - The command descriptor.
 * @param {string[] | null | undefined} resolvedArgs - Pre-resolved arguments.
 * @returns {number} The child's exit code (0 = success, non-zero = failure).
 */
export function runCommand(command, resolvedArgs) {
  const { finalCmd, finalArgs, cwd } = buildSpawnArgs(command, resolvedArgs);

  console.log();
  console.log(d(`▶  ${finalCmd} ${finalArgs.join(" ")}  (em ${path.relative(ROOT, cwd) || "."})`));
  console.log(d("─".repeat(70)));

  const result = spawnSync(finalCmd, finalArgs, {
    cwd,
    stdio: "inherit",
    env: { ...process.env },
  });

  console.log();
  if (result.error) {
    console.error(r(`❌  Erro ao iniciar: ${result.error.message}`));
    return 1;
  }

  const code = result.status ?? 1;
  if (code === 0) {
    console.log(g("✅  Concluído com sucesso"));
  } else {
    console.log(r(`❌  Processo encerrado com código ${code}`));
  }
  return code;
}

// ─── Shell snippet helper ─────────────────────────────────────────────────────

/**
 * Wraps a string in POSIX single-quotes, escaping any embedded single-quote
 * characters using the `'<sq>'\''<sq>'` technique.
 *
 * @param {string} str
 * @returns {string}
 */
function shellQuote(str) {
  return "'" + str.replace(/'/g, "'\\''") + "'";
}

/**
 * Builds a POSIX shell snippet that changes to the command's working directory
 * and exec's the final command.  The snippet is intended to be written to a
 * temporary file and evaluated by the `plex` wrapper shell script.
 *
 * Using `exec` replaces the shell process with the target command, which means
 * the command inherits the shell's TTY ownership with zero extra processes in
 * between.  Quoting every token with `shellQuote` makes the snippet safe for
 * paths and arguments that contain spaces, dollar signs, or other special
 * characters.
 *
 * @param {Command}                     command      - The command descriptor.
 * @param {string[] | null | undefined} resolvedArgs - Pre-resolved arguments.
 * @returns {string} A POSIX shell snippet, e.g. `cd '...' && exec node 'src/cli.js' 'search'`.
 */
export function buildExecSnippet(command, resolvedArgs) {
  const { finalCmd, finalArgs, cwd } = buildSpawnArgs(command, resolvedArgs);

  const quotedCwd  = shellQuote(cwd);
  const quotedExec = [finalCmd, ...finalArgs].map(shellQuote).join(" ");

  return `cd ${quotedCwd} && exec ${quotedExec}`;
}
