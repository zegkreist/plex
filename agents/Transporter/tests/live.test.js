import { describe, expect, test } from "@jest/globals";
import { isLiveRecording } from "../src/live.js";

describe("isLiveRecording", () => {
  test("detecta 'live' como palavra completa", () => {
    expect(isLiveRecording("Live at Wembley")).toBe(true);
  });

  test("detecta '(live)'", () => {
    expect(isLiveRecording("OK Computer (live)")).toBe(true);
  });

  test("detecta 'ao vivo' com espaço", () => {
    expect(isLiveRecording("Ao Vivo no Maracanã")).toBe(true);
  });

  test("detecta 'ao-vivo' com hífen", () => {
    expect(isLiveRecording("Show ao-vivo 2001")).toBe(true);
  });

  test("não detecta álbum de estúdio", () => {
    expect(isLiveRecording("OK Computer")).toBe(false);
  });

  test("não detecta 'Alive' (live não é palavra completa)", () => {
    expect(isLiveRecording("Alive")).toBe(false);
  });

  test("retorna false para string vazia", () => {
    expect(isLiveRecording("")).toBe(false);
  });

  test("retorna false para null", () => {
    expect(isLiveRecording(null)).toBe(false);
  });

  test("detecta mesmo com acentos (ao vivo)", () => {
    expect(isLiveRecording("Show Ao Vivo em São Paulo")).toBe(true);
  });
});
