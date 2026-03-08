import { describe, it, expect } from "@jest/globals";
import { buildSpawnArgs } from "../plex-cli-run.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseCmd = {
  id: "music:test",
  label: "Test music",
  group: "🎵  Música",
  cwd: "/agents/MusicCurator",
  cmd: "npm",
  args: ["test"],
};

const sudoCmd = {
  id: "series:curate",
  label: "Curate series",
  group: "📺  Séries",
  cwd: "/agents/SeriesCurator",
  cmd: "node",
  args: ["index.js", "--dry-run"],
  sudo: true,
};

const noArgsCmd = {
  id: "plex:status",
  label: "Plex status",
  group: "🐳  Docker / Plex",
  cwd: "/",
  cmd: "docker",
  args: ["compose", "ps"],
};

// ─── finalCmd / finalArgs ──────────────────────────────────────────────────────
describe("buildSpawnArgs — non-sudo", () => {
  it("finalCmd is the command's cmd field", () => {
    const { finalCmd } = buildSpawnArgs(baseCmd, baseCmd.args);
    expect(finalCmd).toBe("npm");
  });

  it("finalArgs are the resolved args directly", () => {
    const { finalArgs } = buildSpawnArgs(baseCmd, ["test", "--watch"]);
    expect(finalArgs).toEqual(["test", "--watch"]);
  });

  it("uses command.args when resolvedArgs is undefined", () => {
    const { finalArgs } = buildSpawnArgs(baseCmd, undefined);
    expect(finalArgs).toEqual(["test"]);
  });

  it("uses command.args when resolvedArgs is null", () => {
    const { finalArgs } = buildSpawnArgs(baseCmd, null);
    expect(finalArgs).toEqual(["test"]);
  });

  it("preserves cwd from command", () => {
    const { cwd } = buildSpawnArgs(baseCmd, baseCmd.args);
    expect(cwd).toBe("/agents/MusicCurator");
  });

  it("multiple args are all preserved", () => {
    const { finalArgs } = buildSpawnArgs(noArgsCmd, ["compose", "ps"]);
    expect(finalArgs).toEqual(["compose", "ps"]);
  });
});

describe("buildSpawnArgs — sudo", () => {
  it("finalCmd becomes 'sudo'", () => {
    const { finalCmd } = buildSpawnArgs(sudoCmd, sudoCmd.args);
    expect(finalCmd).toBe("sudo");
  });

  it("prepends original cmd as the first element of finalArgs", () => {
    const { finalArgs } = buildSpawnArgs(sudoCmd, sudoCmd.args);
    expect(finalArgs[0]).toBe("node");
  });

  it("appends resolved args after the original cmd", () => {
    const { finalArgs } = buildSpawnArgs(sudoCmd, ["index.js", "--dry-run"]);
    expect(finalArgs).toEqual(["node", "index.js", "--dry-run"]);
  });

  it("falls back to command.args when resolvedArgs is undefined", () => {
    const { finalArgs } = buildSpawnArgs(sudoCmd, undefined);
    expect(finalArgs).toEqual(["node", "index.js", "--dry-run"]);
  });

  it("preserves cwd for sudo command", () => {
    const { cwd } = buildSpawnArgs(sudoCmd, sudoCmd.args);
    expect(cwd).toBe("/agents/SeriesCurator");
  });
});

describe("buildSpawnArgs — return shape", () => {
  it("returns exactly { finalCmd, finalArgs, cwd }", () => {
    const result = buildSpawnArgs(baseCmd, baseCmd.args);
    expect(Object.keys(result).sort()).toEqual(["cwd", "finalArgs", "finalCmd"]);
  });

  it("finalArgs is always an array", () => {
    const { finalArgs } = buildSpawnArgs(baseCmd, undefined);
    expect(Array.isArray(finalArgs)).toBe(true);
  });
});
