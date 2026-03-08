import { describe, it, expect } from "@jest/globals";
import { buildGroups, parseGroupChoice, parseCommandChoice } from "../plex-cli-menu.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────
const mockCommands = [
  { id: "music:test",    label: "Test music",     group: "🎵  Música",        cwd: "/music",  cmd: "npm",    args: ["test"] },
  { id: "music:fix",     label: "Fix music tags", group: "🎵  Música",        cwd: "/music",  cmd: "node",   args: ["fix.js"] },
  { id: "series:curate", label: "Curate series",  group: "📺  Séries",        cwd: "/series", cmd: "node",   args: ["index.js"] },
  { id: "plex:status",   label: "Plex status",    group: "🐳  Docker / Plex", cwd: "/",       cmd: "docker", args: ["ps"] },
  { id: "plex:restart",  label: "Restart Plex",   group: "🐳  Docker / Plex", cwd: "/",       cmd: "docker", args: ["compose", "restart", "plex"] },
];

// ─── buildGroups ─────────────────────────────────────────────────────────────
describe("buildGroups", () => {
  it("returns one entry per unique group name", () => {
    const groups = buildGroups(mockCommands);
    expect(groups).toHaveLength(3);
  });

  it("preserves the order of first appearance", () => {
    const groups = buildGroups(mockCommands);
    expect(groups[0].name).toBe("🎵  Música");
    expect(groups[1].name).toBe("📺  Séries");
    expect(groups[2].name).toBe("🐳  Docker / Plex");
  });

  it("puts the correct commands under each group", () => {
    const groups = buildGroups(mockCommands);
    expect(groups[0].items).toHaveLength(2);
    expect(groups[0].items[0].id).toBe("music:test");
    expect(groups[0].items[1].id).toBe("music:fix");
  });

  it("group with a single command has items array of length 1", () => {
    const groups = buildGroups(mockCommands);
    expect(groups[1].items).toHaveLength(1);
    expect(groups[1].items[0].id).toBe("series:curate");
  });

  it("group with multiple commands collects all of them", () => {
    const groups = buildGroups(mockCommands);
    expect(groups[2].items).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    expect(buildGroups([])).toEqual([]);
  });

  it("each entry has a name and an items array", () => {
    const groups = buildGroups(mockCommands);
    for (const g of groups) {
      expect(typeof g.name).toBe("string");
      expect(Array.isArray(g.items)).toBe(true);
    }
  });
});

// ─── parseGroupChoice ────────────────────────────────────────────────────────
describe("parseGroupChoice", () => {
  const groups = [
    { name: "Música",      items: [] },
    { name: "Séries",      items: [] },
    { name: "Docker/Plex", items: [] },
  ];

  it('returns { type: "exit" } for "0"', () => {
    expect(parseGroupChoice("0", groups)).toEqual({ type: "exit" });
  });

  it('returns { type: "exit" } for "q"', () => {
    expect(parseGroupChoice("q", groups)).toEqual({ type: "exit" });
  });

  it('returns { type: "exit" } for "exit"', () => {
    expect(parseGroupChoice("exit", groups)).toEqual({ type: "exit" });
  });

  it('returns { type: "select", group } for "1"', () => {
    const result = parseGroupChoice("1", groups);
    expect(result.type).toBe("select");
    expect(result.group).toBe(groups[0]);
  });

  it('returns { type: "select", group } for last item', () => {
    const result = parseGroupChoice("3", groups);
    expect(result.type).toBe("select");
    expect(result.group).toBe(groups[2]);
  });

  it('returns { type: "invalid" } for number out of range (too high)', () => {
    expect(parseGroupChoice("4", groups).type).toBe("invalid");
  });

  it('returns { type: "invalid" } for NaN input', () => {
    expect(parseGroupChoice("abc", groups).type).toBe("invalid");
  });

  it('returns { type: "invalid" } for empty string', () => {
    expect(parseGroupChoice("", groups).type).toBe("invalid");
  });

  it("trims surrounding whitespace before parsing", () => {
    const result = parseGroupChoice("  2  ", groups);
    expect(result.type).toBe("select");
    expect(result.group).toBe(groups[1]);
  });
});

// ─── parseCommandChoice ──────────────────────────────────────────────────────
describe("parseCommandChoice", () => {
  const items = [
    { id: "cmd:one",   label: "Command One" },
    { id: "cmd:two",   label: "Command Two" },
    { id: "cmd:three", label: "Command Three" },
  ];

  it('returns { type: "back" } for "0"', () => {
    expect(parseCommandChoice("0", items)).toEqual({ type: "back" });
  });

  it('returns { type: "back" } for "b"', () => {
    expect(parseCommandChoice("b", items)).toEqual({ type: "back" });
  });

  it('returns { type: "select", command } for "1"', () => {
    const result = parseCommandChoice("1", items);
    expect(result.type).toBe("select");
    expect(result.command).toBe(items[0]);
  });

  it('returns { type: "select", command } for last item', () => {
    const result = parseCommandChoice("3", items);
    expect(result.type).toBe("select");
    expect(result.command).toBe(items[2]);
  });

  it('returns { type: "invalid" } for out-of-range number', () => {
    expect(parseCommandChoice("4", items).type).toBe("invalid");
  });

  it('returns { type: "invalid" } for NaN', () => {
    expect(parseCommandChoice("xyz", items).type).toBe("invalid");
  });

  it('returns { type: "invalid" } for empty string', () => {
    expect(parseCommandChoice("", items).type).toBe("invalid");
  });

  it("trims surrounding whitespace", () => {
    const result = parseCommandChoice("  2  ", items);
    expect(result.type).toBe("select");
    expect(result.command).toBe(items[1]);
  });
});
