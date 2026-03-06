#!/usr/bin/env node
/**
 * Tidal Downloader - Menu Interativo (versão Node.js)
 * Equivalente ao tidal.sh com menu interativo
 */

import { createInterface } from "readline";
import { spawnSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..", "..");

// ============================================
// CORES ANSI
// ============================================
const RED = "\x1b[0;31m";
const GREEN = "\x1b[0;32m";
const YELLOW = "\x1b[1;33m";
const BLUE = "\x1b[0;34m";
const CYAN = "\x1b[0;36m";
const NC = "\x1b[0m";

// ============================================
// UTILITÁRIOS
// ============================================

function print(msg = "") {
  process.stdout.write(msg + "\n");
}

function colorize(color, text) {
  return `${color}${text}${NC}`;
}

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function clearScreen() {
  process.stdout.write("\x1b[2J\x1b[H");
}

// ============================================
// EXECUTOR DOCKER-COMPOSE
// ============================================

function ripCmd(...args) {
  print("");
  print(colorize(CYAN, `▶ docker-compose run --rm streamrip ${args.join(" ")}`));
  print("");

  const result = spawnSync("docker-compose", ["run", "--rm", "streamrip", ...args], {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      USER_ID: String(process.getuid?.() ?? 1000),
      GROUP_ID: String(process.getgid?.() ?? 1000),
    },
  });

  if (result.error) {
    print(colorize(RED, `❌ Erro ao executar docker-compose: ${result.error.message}`));
    return false;
  }

  return result.status === 0;
}

// ============================================
// FUNÇÕES DE DOWNLOAD
// ============================================

async function tidalAlbum() {
  const url = await ask(colorize(CYAN, "URL do álbum: "));
  const quality = (await ask(colorize(CYAN, "Qualidade (0-3, default 3): "))) || "3";

  if (!url) {
    print(colorize(RED, "❌ URL é obrigatória"));
    return;
  }
  print(colorize(BLUE, "🎵 Baixando álbum do Tidal..."));
  print(`${colorize(CYAN, "URL:")} ${url}`);
  print(`${colorize(CYAN, "Qualidade:")} ${quality}`);
  ripCmd("-q", quality, "url", url);
}

async function tidalPlaylist() {
  const url = await ask(colorize(CYAN, "URL da playlist: "));
  const quality = (await ask(colorize(CYAN, "Qualidade (0-3, default 3): "))) || "3";

  if (!url) {
    print(colorize(RED, "❌ URL é obrigatória"));
    return;
  }
  print(colorize(BLUE, "📋 Baixando playlist do Tidal..."));
  print(`${colorize(CYAN, "URL:")} ${url}`);
  print(`${colorize(CYAN, "Qualidade:")} ${quality}`);
  ripCmd("-q", quality, "url", url);
}

async function tidalTrack() {
  const url = await ask(colorize(CYAN, "URL da track: "));
  const quality = (await ask(colorize(CYAN, "Qualidade (0-3, default 3): "))) || "3";

  if (!url) {
    print(colorize(RED, "❌ URL é obrigatória"));
    return;
  }
  print(colorize(BLUE, "🎵 Baixando track do Tidal..."));
  print(`${colorize(CYAN, "URL:")} ${url}`);
  print(`${colorize(CYAN, "Qualidade:")} ${quality}`);
  ripCmd("-q", quality, "url", url);
}

async function tidalArtist() {
  const url = await ask(colorize(CYAN, "URL do artista: "));
  const quality = (await ask(colorize(CYAN, "Qualidade (0-3, default 3): "))) || "3";

  if (!url) {
    print(colorize(RED, "❌ URL é obrigatória"));
    return;
  }
  print(colorize(BLUE, "👤 Baixando discografia do artista..."));
  print(`${colorize(CYAN, "URL:")} ${url}`);
  print(`${colorize(CYAN, "Qualidade:")} ${quality}`);
  ripCmd("-q", quality, "url", url);
}

async function tidalById() {
  print(colorize(YELLOW, "Tipos: album, track, playlist, artist"));
  const type = await ask(colorize(CYAN, "Tipo: "));
  const id = await ask(colorize(CYAN, "ID: "));
  const quality = (await ask(colorize(CYAN, "Qualidade (0-3, default 3): "))) || "3";

  if (!type || !id) {
    print(colorize(RED, "❌ Tipo e ID são obrigatórios"));
    return;
  }
  print(colorize(BLUE, "🆔 Baixando por ID do Tidal..."));
  print(`${colorize(CYAN, "Tipo:")} ${type}`);
  print(`${colorize(CYAN, "ID:")} ${id}`);
  print(`${colorize(CYAN, "Qualidade:")} ${quality}`);
  ripCmd("-q", quality, "id", "tidal", type, id);
}

// ============================================
// FUNÇÕES DE BUSCA
// ============================================

async function tidalSearchAlbum() {
  const query = await ask(colorize(CYAN, "Buscar álbum: "));
  const auto = await ask(colorize(CYAN, "Baixar primeiro resultado automaticamente? (s/N): "));

  if (!query) {
    print(colorize(RED, "❌ Query é obrigatória"));
    return;
  }
  print(colorize(BLUE, "🔍 Buscando álbum no Tidal..."));
  print(`${colorize(CYAN, "Busca:")} ${query}`);

  const args = ["search", "tidal", "album", query];
  if (auto.toLowerCase() === "s") args.push("-f");
  ripCmd(...args);
}

async function tidalSearchPlaylist() {
  const query = await ask(colorize(CYAN, "Buscar playlist: "));
  const auto = await ask(colorize(CYAN, "Baixar primeiro resultado automaticamente? (s/N): "));

  if (!query) {
    print(colorize(RED, "❌ Query é obrigatória"));
    return;
  }
  print(colorize(BLUE, "🔍 Buscando playlist no Tidal..."));
  print(`${colorize(CYAN, "Busca:")} ${query}`);

  const args = ["search", "tidal", "playlist", query];
  if (auto.toLowerCase() === "s") args.push("-f");
  ripCmd(...args);
}

async function tidalSearchArtist() {
  const query = await ask(colorize(CYAN, "Buscar artista: "));
  const auto = await ask(colorize(CYAN, "Baixar primeiro resultado automaticamente? (s/N): "));

  if (!query) {
    print(colorize(RED, "❌ Query é obrigatória"));
    return;
  }
  print(colorize(BLUE, "🔍 Buscando artista no Tidal..."));
  print(`${colorize(CYAN, "Busca:")} ${query}`);

  const args = ["search", "tidal", "artist", query];
  if (auto.toLowerCase() === "s") args.push("-f");
  ripCmd(...args);
}

async function tidalSearchTrack() {
  const query = await ask(colorize(CYAN, "Buscar track: "));
  const auto = await ask(colorize(CYAN, "Baixar primeiro resultado automaticamente? (s/N): "));

  if (!query) {
    print(colorize(RED, "❌ Query é obrigatória"));
    return;
  }
  print(colorize(BLUE, "🔍 Buscando track no Tidal..."));
  print(`${colorize(CYAN, "Busca:")} ${query}`);

  const args = ["search", "tidal", "track", query];
  if (auto.toLowerCase() === "s") args.push("-f");
  ripCmd(...args);
}

// ============================================
// FUNÇÕES DE UTILIDADE
// ============================================

function tidalHistory() {
  print(colorize(BLUE, "📊 Histórico de downloads"));
  ripCmd("database", "browse", "downloads");
}

function tidalFailed() {
  print(colorize(BLUE, "❌ Downloads que falharam"));
  ripCmd("database", "browse", "failed");
}

function tidalQualityInfo() {
  print(colorize(CYAN, "═══════════════════════════════════════════"));
  print(colorize(YELLOW, "    Níveis de Qualidade - Tidal"));
  print(colorize(CYAN, "═══════════════════════════════════════════"));
  print("");
  print(`${colorize(GREEN, "0")} - 256 kbps AAC (Normal)`);
  print(`${colorize(GREEN, "1")} - 320 kbps AAC (High)`);
  print(`${colorize(GREEN, "2")} - 16 bit, 44.1 kHz FLAC (HiFi - qualidade CD)`);
  print(`${colorize(GREEN, "3")} - 24 bit, 44.1 kHz FLAC (MQA - Master Quality)`);
  print("");
  print(`${colorize(YELLOW, "Nota:")} Você precisa de assinatura Tidal HiFi para qualidades 2 e 3`);
  print("");
}

function tidalConfig() {
  print(colorize(BLUE, "⚙️  Abrindo configuração do streamrip..."));
  ripCmd("config", "open");
}

// ============================================
// MENU
// ============================================

function showMenu() {
  clearScreen();
  print(colorize(CYAN, "═══════════════════════════════════════════"));
  print(colorize(YELLOW, "    Tidal Downloader - Menu Interativo"));
  print(colorize(CYAN, "═══════════════════════════════════════════"));
  print("");
  print(colorize(GREEN, "Downloads por URL:"));
  print("  1) Baixar álbum");
  print("  2) Baixar playlist");
  print("  3) Baixar track");
  print("  4) Baixar discografia de artista");
  print("  5) Baixar por ID");
  print("");
  print(colorize(GREEN, "Busca e Download:"));
  print("  6) Buscar álbum");
  print("  7) Buscar playlist");
  print("  8) Buscar artista");
  print("  9) Buscar track");
  print("");
  print(colorize(GREEN, "Utilitários:"));
  print(" 10) Ver histórico de downloads");
  print(" 11) Ver downloads que falharam");
  print(" 12) Informações de qualidade");
  print(" 13) Abrir configuração");
  print("");
  print("  0) Sair");
  print("");
  print(colorize(CYAN, "═══════════════════════════════════════════"));
}

function showHelp() {
  print(colorize(CYAN, "═══════════════════════════════════════════"));
  print(colorize(YELLOW, "    Tidal Helper - Ajuda"));
  print(colorize(CYAN, "═══════════════════════════════════════════"));
  print("");
  print(colorize(GREEN, "Uso:"));
  print("  node tidal.mjs          # Menu interativo");
  print("  node tidal.mjs menu     # Menu interativo");
  print("  node tidal.mjs help     # Esta ajuda");
  print("  npm run tidal           # Via npm");
  print("");
  print(colorize(YELLOW, "Qualidades:") + " 0 (256kbps AAC) | 1 (320kbps AAC) | 2 (HiFi FLAC) | 3 (MQA FLAC)");
  print("");
}

async function interactiveMenu() {
  while (true) {
    showMenu();
    const choice = await ask(colorize(YELLOW, "Escolha uma opção: "));
    print("");

    switch (choice) {
      case "1":
        await tidalAlbum();
        break;
      case "2":
        await tidalPlaylist();
        break;
      case "3":
        await tidalTrack();
        break;
      case "4":
        await tidalArtist();
        break;
      case "5":
        await tidalById();
        break;
      case "6":
        await tidalSearchAlbum();
        break;
      case "7":
        await tidalSearchPlaylist();
        break;
      case "8":
        await tidalSearchArtist();
        break;
      case "9":
        await tidalSearchTrack();
        break;
      case "10":
        tidalHistory();
        break;
      case "11":
        tidalFailed();
        break;
      case "12":
        tidalQualityInfo();
        break;
      case "13":
        tidalConfig();
        break;
      case "0":
        print(colorize(GREEN, "👋 Até logo!"));
        rl.close();
        process.exit(0);
      default:
        print(colorize(RED, "❌ Opção inválida!"));
    }

    if (choice !== "0") {
      await ask(colorize(YELLOW, "\nPressione Enter para continuar..."));
    }
  }
}

// ============================================
// MAIN
// ============================================

const arg = process.argv[2] ?? "menu";

if (arg === "help" || arg === "--help" || arg === "-h") {
  showHelp();
  process.exit(0);
} else {
  interactiveMenu();
}
