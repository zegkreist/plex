import { describe, it, expect, jest } from "@jest/globals";
import { prepareStdinForChild, restoreStdinAfterChild } from "../plex-cli-stdin.js";

// ─── Factories ────────────────────────────────────────────────────────────────

/** Full TTY-like mock (setRawMode available). */
function makeTtyStdin() {
  return {
    isTTY: true,
    pause: jest.fn(),
    resume: jest.fn(),
    removeAllListeners: jest.fn(),
    setRawMode: jest.fn(),
  };
}

/** Pipe-like mock (no setRawMode). */
function makePipeStdin() {
  return {
    isTTY: false,
    pause: jest.fn(),
    resume: jest.fn(),
    removeAllListeners: jest.fn(),
  };
}

// ─── prepareStdinForChild ─────────────────────────────────────────────────────
describe("prepareStdinForChild", () => {
  it("pauses the stream", () => {
    const stdin = makeTtyStdin();
    prepareStdinForChild(stdin);
    expect(stdin.pause).toHaveBeenCalledTimes(1);
  });

  it("removes all 'data' listeners (stops readline's keypress emitter from stealing bytes)", () => {
    const stdin = makePipeStdin();
    prepareStdinForChild(stdin);
    expect(stdin.removeAllListeners).toHaveBeenCalledWith("data");
  });

  it("removes all 'keypress' listeners", () => {
    const stdin = makePipeStdin();
    prepareStdinForChild(stdin);
    expect(stdin.removeAllListeners).toHaveBeenCalledWith("keypress");
  });

  it("calls setRawMode(false) when stdin is a TTY to restore cooked mode", () => {
    const stdin = makeTtyStdin();
    prepareStdinForChild(stdin);
    expect(stdin.setRawMode).toHaveBeenCalledWith(false);
  });

  it("does not call setRawMode when isTTY is false", () => {
    const stdin = makePipeStdin();
    prepareStdinForChild(stdin);
    // setRawMode does not exist on pipe mock — should not throw
    expect(() => prepareStdinForChild(stdin)).not.toThrow();
  });

  it("does not throw when setRawMode is absent but isTTY is true", () => {
    const stdin = { isTTY: true, pause: jest.fn(), removeAllListeners: jest.fn() };
    expect(() => prepareStdinForChild(stdin)).not.toThrow();
  });

  it("does not throw for a plain piped stdin (no isTTY, no setRawMode)", () => {
    const stdin = { pause: jest.fn(), removeAllListeners: jest.fn() };
    expect(() => prepareStdinForChild(stdin)).not.toThrow();
  });

  it("does not call resume", () => {
    const stdin = makeTtyStdin();
    prepareStdinForChild(stdin);
    expect(stdin.resume).not.toHaveBeenCalled();
  });
});

// ─── restoreStdinAfterChild ───────────────────────────────────────────────────
describe("restoreStdinAfterChild", () => {
  it("calls setRawMode(false) to undo any raw mode the child may have left behind", () => {
    const stdin = makeTtyStdin();
    restoreStdinAfterChild(stdin);
    expect(stdin.setRawMode).toHaveBeenCalledWith(false);
  });

  it("does not call setRawMode when isTTY is false", () => {
    const stdin = makePipeStdin();
    restoreStdinAfterChild(stdin);
    // No setRawMode on this mock — must not throw
    expect(() => restoreStdinAfterChild(stdin)).not.toThrow();
  });

  it("does not throw when setRawMode is absent but isTTY is true", () => {
    const stdin = { isTTY: true };
    expect(() => restoreStdinAfterChild(stdin)).not.toThrow();
  });

  it("does not throw for plain pipe stdin (empty object)", () => {
    expect(() => restoreStdinAfterChild({})).not.toThrow();
  });

  it("does NOT call resume — readline's next createInterface handles that", () => {
    const stdin = makeTtyStdin();
    restoreStdinAfterChild(stdin);
    expect(stdin.resume).not.toHaveBeenCalled();
  });
});
