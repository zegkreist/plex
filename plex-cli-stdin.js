/**
 * plex-cli-stdin.js — Utilities for handing stdin over to interactive child processes.
 *
 * When plex-cli.js spawns an interactive child (e.g. Stormbringer using inquirer),
 * Node.js can continue consuming bytes on fd 0 through two mechanisms even after
 * the readline interface is closed:
 *
 *  1. `readline.emitKeypressEvents(stdin)` — called internally by
 *     `readline.createInterface` — attaches a persistent `'data'` listener to
 *     stdin that is NOT removed by `rl.close()`. This listener keeps the stream
 *     in flowing mode and steals keystrokes that were meant for the child.
 *
 *  2. The terminal may be left in raw mode by the child (on abnormal exit),
 *     which would break the parent's subsequent line-editing prompts.
 *
 * `prepareStdinForChild` neutralises both hazards before `spawn()`.
 * `restoreStdinAfterChild` undoes any TTY-mode changes the child may have left.
 */

/**
 * @typedef {object} StdinLike
 * @property {() => void}                      pause              - Pause the readable stream.
 * @property {(event: string) => void}         removeAllListeners - Remove all listeners for an event.
 * @property {boolean}                         [isTTY]            - True when connected to a terminal.
 * @property {(mode: boolean) => void}         [setRawMode]       - Enable/disable raw TTY mode (TTY only).
 */

/**
 * Prepares stdin for exclusive use by a child process.
 *
 * Performs three operations in order:
 *  1. Pauses the stream (tell Node's stream layer to stop buffering reads).
 *  2. Removes all `'data'` and `'keypress'` listeners—including the persistent
 *     one added by `readline.emitKeypressEvents`—so no parent-side handler can
 *     consume bytes delivered to the child.
 *  3. Resets the terminal to cooked mode (if stdin is a TTY) so the child
 *     receives clean line-buffered input when it starts.
 *
 * @param {StdinLike} stdin - The readable stream to prepare (typically `process.stdin`).
 * @returns {void}
 */
export function prepareStdinForChild(stdin) {
  stdin.pause();
  stdin.removeAllListeners("data");
  stdin.removeAllListeners("keypress");
  if (stdin.isTTY && typeof stdin.setRawMode === "function") {
    stdin.setRawMode(false);
  }
}

/**
 * Restores stdin to a usable state after an interactive child process exits.
 *
 * A child process may exit abnormally and leave the terminal in raw mode. This
 * function resets TTY mode so the parent's subsequent `readline.createInterface`
 * prompts receive properly line-buffered input.
 *
 * Intentionally does **not** call `stdin.resume()`: the next call to
 * `readline.createInterface({ input: stdin, … })` will resume the stream
 * automatically, avoiding a spurious flowing-mode period between commands.
 *
 * @param {StdinLike} stdin - The readable stream to restore (typically `process.stdin`).
 * @returns {void}
 */
export function restoreStdinAfterChild(stdin) {
  if (stdin.isTTY && typeof stdin.setRawMode === "function") {
    stdin.setRawMode(false);
  }
}
