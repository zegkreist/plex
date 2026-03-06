import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { ensureDir, moveFile, removeIfEmpty } from "../src/filesystem.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "transporter-fs-")); });
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

function touch(filePath, content = "") {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

// ─── ensureDir ────────────────────────────────────────────────────────────────

describe("ensureDir", () => {
  test("cria diretório que não existe", () => {
    const dir = path.join(tmp, "novo");
    expect(fs.existsSync(dir)).toBe(false);
    ensureDir(dir);
    expect(fs.existsSync(dir)).toBe(true);
  });

  test("cria árvore de diretórios recursivamente", () => {
    const dir = path.join(tmp, "a", "b", "c");
    ensureDir(dir);
    expect(fs.existsSync(dir)).toBe(true);
  });

  test("não lança erro se diretório já existe", () => {
    expect(() => ensureDir(tmp)).not.toThrow();
  });
});

// ─── moveFile ─────────────────────────────────────────────────────────────────

describe("moveFile", () => {
  test("move arquivo para destino existente", () => {
    const src = path.join(tmp, "origem.txt");
    const dest = path.join(tmp, "destino.txt");
    touch(src, "conteúdo");

    moveFile(src, dest);

    expect(fs.existsSync(src)).toBe(false);
    expect(fs.readFileSync(dest, "utf8")).toBe("conteúdo");
  });

  test("cria diretório destino se não existe", () => {
    const src = path.join(tmp, "origem.flac");
    const dest = path.join(tmp, "pasta", "destino.flac");
    touch(src, "audio");

    moveFile(src, dest);

    expect(fs.existsSync(dest)).toBe(true);
    expect(fs.existsSync(src)).toBe(false);
  });

  test("preserva conteúdo exato do arquivo", () => {
    const content = "dados binários simulados";
    const src = path.join(tmp, "a.flac");
    const dest = path.join(tmp, "b.flac");
    touch(src, content);

    moveFile(src, dest);

    expect(fs.readFileSync(dest, "utf8")).toBe(content);
  });

  test("lança erro se source não existe", () => {
    expect(() => moveFile(path.join(tmp, "inexistente.flac"), path.join(tmp, "dest.flac"))).toThrow();
  });
});

// ─── removeIfEmpty ────────────────────────────────────────────────────────────

describe("removeIfEmpty", () => {
  test("remove diretório vazio", () => {
    const dir = path.join(tmp, "vazio");
    fs.mkdirSync(dir);
    removeIfEmpty(dir);
    expect(fs.existsSync(dir)).toBe(false);
  });

  test("não remove diretório com arquivos", () => {
    touch(path.join(tmp, "arquivo.txt"));
    removeIfEmpty(tmp);
    expect(fs.existsSync(tmp)).toBe(true);
  });

  test("remove recursivamente se todas as subpastas ficam vazias", () => {
    const sub = path.join(tmp, "sub");
    fs.mkdirSync(sub);
    // sub está vazia, tmp tem apenas sub
    removeIfEmpty(tmp);
    expect(fs.existsSync(tmp)).toBe(false);
  });

  test("não lança erro se diretório não existe", () => {
    expect(() => removeIfEmpty(path.join(tmp, "inexistente"))).not.toThrow();
  });

  test("não remove diretório raiz com subpasta não-vazia", () => {
    touch(path.join(tmp, "sub", "arquivo.flac"));
    removeIfEmpty(tmp);
    expect(fs.existsSync(tmp)).toBe(true);
  });
});
