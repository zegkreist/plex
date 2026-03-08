/**
 * plex-cli-menu.js — Pure menu-routing functions (fully testable, zero I/O)
 *
 * Exported:
 *   buildGroups(commands)              → Group[]
 *   parseGroupChoice(input, groups)    → { type: 'exit' | 'select' | 'invalid', group? }
 *   parseCommandChoice(input, items)   → { type: 'back' | 'select' | 'invalid', command? }
 */

/**
 * Groups a flat COMMANDS array by the `group` field, preserving first-appearance order.
 * @param {Array<{group: string}>} commands
 * @returns {Array<{name: string, items: Array}>}
 */
export function buildGroups(commands) {
  const map = new Map();
  const groups = [];

  for (const cmd of commands) {
    if (!map.has(cmd.group)) {
      const entry = { name: cmd.group, items: [] };
      map.set(cmd.group, entry);
      groups.push(entry);
    }
    map.get(cmd.group).items.push(cmd);
  }

  return groups;
}

/**
 * Parses a raw string input from the group-selection menu.
 * @param {string} input   — raw user input (may have surrounding whitespace)
 * @param {Array<{name: string, items: Array}>} groups
 * @returns {{ type: 'exit' } | { type: 'select', group: object } | { type: 'invalid' }}
 */
export function parseGroupChoice(input, groups) {
  const trimmed = input.trim();

  if (trimmed === "0" || trimmed === "q" || trimmed === "exit") {
    return { type: "exit" };
  }

  const idx = parseInt(trimmed, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= groups.length) {
    return { type: "invalid" };
  }

  return { type: "select", group: groups[idx] };
}

/**
 * Parses a raw string input from the command-selection sub-menu.
 * @param {string} input   — raw user input
 * @param {Array<object>} items — commands in the current group
 * @returns {{ type: 'back' } | { type: 'select', command: object } | { type: 'invalid' }}
 */
export function parseCommandChoice(input, items) {
  const trimmed = input.trim();

  if (trimmed === "0" || trimmed === "b" || trimmed === "back") {
    return { type: "back" };
  }

  const idx = parseInt(trimmed, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= items.length) {
    return { type: "invalid" };
  }

  return { type: "select", command: items[idx] };
}
