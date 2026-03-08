import { describe, it, expect } from "@jest/globals";
import { buildExecSnippet } from "../plex-cli-run.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const simpleCmd = {
  id: "stormbringer:search",
  label: "Buscar torrent",
  group: "⚡  Stormbringer",
  cwd: "/home/developer/workspace/plex_server/agents/Stormbringer",
  cmd: "node",
  args: ["src/cli.js", "search"],
};

const sudoCmd = {
  id: "series:curate",
  label: "Curate series",
  group: "📺  Séries",
  cwd: "/home/developer/workspace/plex_server/agents/SeriesCurator",
  cmd: "node",
  args: ["index.js", "--dry-run"],
  sudo: true,
};

// ─── buildExecSnippet ─────────────────────────────────────────────────────────
describe("buildExecSnippet", () => {
  it("starts with a cd into the command cwd", () => {
    const snippet = buildExecSnippet(simpleCmd, simpleCmd.args);
    expect(snippet).toMatch(/^cd /);
    expect(snippet).toContain("Stormbringer");
  });

  it("uses exec so the shell is replaced by the process (no extra fork)", () => {
    const snippet = buildExecSnippet(simpleCmd, simpleCmd.args);
    expect(snippet).toContain("exec ");
  });

  it("includes the finalCmd in the snippet", () => {
    const snippet = buildExecSnippet(simpleCmd, simpleCmd.args);
    expect(snippet).toContain("node");
  });

  it("includes all args in the snippet", () => {
    const snippet = buildExecSnippet(simpleCmd, ["src/cli.js", "search"]);
    expect(snippet).toContain("src/cli.js");
    expect(snippet).toContain("search");
  });

  it("falls back to command.args when resolvedArgs is undefined", () => {
    const snippet = buildExecSnippet(simpleCmd, undefined);
    expect(snippet).toContain("src/cli.js");
    expect(snippet).toContain("search");
  });

  it("falls back to command.args when resolvedArgs is null", () => {
    const snippet = buildExecSnippet(simpleCmd, null);
    expect(snippet).toContain("src/cli.js");
  });

  it("wraps sudo command with sudo", () => {
    const snippet = buildExecSnippet(sudoCmd, sudoCmd.args);
    expect(snippet).toContain("sudo");
  });

  it("does NOT include sudo for non-sudo command", () => {
    const snippet = buildExecSnippet(simpleCmd, simpleCmd.args);
    expect(snippet).not.toContain("sudo");
  });

  it("single-quotes the cwd so paths with spaces are safe", () => {
    const cmdWithSpaces = { ...simpleCmd, cwd: "/path/with spaces/here" };
    const snippet = buildExecSnippet(cmdWithSpaces, []);
    // The cwd must be quoted to handle spaces
    expect(snippet).toMatch(/cd '\/path\/with spaces\/here'/);
  });

  it("escapes single quotes inside cwd using the standard '\\''  technique", () => {
    const cmdWithQuote = { ...simpleCmd, cwd: "/path/it's/here" };
    const snippet = buildExecSnippet(cmdWithQuote, []);
    // Single quotes in the path must be escaped
    expect(snippet).not.toMatch(/cd '\/path\/it's\/here'/);
    expect(snippet).toContain("path");
    expect(snippet).toContain("here");
  });

  it("single-quotes each argument", () => {
    const snippet = buildExecSnippet(simpleCmd, ["src/cli.js", "search"]);
    expect(snippet).toMatch(/'src\/cli\.js'/);
    expect(snippet).toMatch(/'search'/);
  });

  it("escapes single quotes inside arguments", () => {
    const snippet = buildExecSnippet(simpleCmd, ["it's an arg"]);
    expect(snippet).not.toMatch(/'it's an arg'/); // unescaped would break shell
    expect(snippet).toContain("it");
    expect(snippet).toContain("an arg");
  });

  it("returns a non-empty string", () => {
    const snippet = buildExecSnippet(simpleCmd, []);
    expect(typeof snippet).toBe("string");
    expect(snippet.length).toBeGreaterThan(0);
  });
});
