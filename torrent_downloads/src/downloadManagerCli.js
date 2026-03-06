#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import DownloadManager from "./downloadManager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar configuração
const configPath = path.join(__dirname, "../config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

// Estado persistente dos downloads
const STATE_FILE = path.join(__dirname, "../.download-state.json");

/**
 * Salva estado dos downloads
 */
function saveState(manager) {
  const state = {
    torrents: Array.from(manager.activeTorrents.values()).map((t) => ({
      infoHash: t.infoHash,
      name: t.name,
      type: t.type,
      status: t.status,
      progress: t.progress,
      downloaded: t.downloaded,
      total: t.total,
      startTime: t.startTime,
    })),
    lastUpdate: Date.now(),
  };

  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Carrega estado dos downloads
 */
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    }
  } catch (err) {
    console.error("Erro ao carregar estado:", err.message);
  }
  return { torrents: [], lastUpdate: null };
}

/**
 * Formata bytes
 */
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Formata velocidade
 */
function formatSpeed(bytesPerSec) {
  return formatBytes(bytesPerSec) + "/s";
}

/**
 * Formata tempo
 */
function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Lista downloads ativos
 */
async function listDownloads() {
  const state = loadState();

  console.log(chalk.bold.cyan("\n📥 Downloads Ativos\n"));
  console.log("=".repeat(80));

  if (state.torrents.length === 0) {
    console.log(chalk.yellow("\n⚠️  Nenhum download ativo no momento\n"));
    console.log(chalk.gray("Use 'npm run download' para iniciar um novo download\n"));
    return;
  }

  state.torrents.forEach((torrent, index) => {
    console.log(chalk.bold(`\n${index + 1}. ${torrent.name || "Carregando..."}`));
    console.log(chalk.gray(`   Hash: ${torrent.infoHash}`));
    console.log(`   Tipo: ${getTypeEmoji(torrent.type)} ${torrent.type}`);
    console.log(`   Status: ${getStatusBadge(torrent.status)}`);
    console.log(`   Progresso: ${getProgressBar(torrent.progress)} ${torrent.progress.toFixed(2)}%`);
    console.log(`   Tamanho: ${formatBytes(torrent.downloaded)} / ${formatBytes(torrent.total)}`);

    if (torrent.startTime) {
      const elapsed = Date.now() - torrent.startTime;
      console.log(`   Tempo decorrido: ${formatTime(elapsed)}`);
    }
  });

  console.log("\n" + "=".repeat(80));

  if (state.lastUpdate) {
    const age = Date.now() - state.lastUpdate;
    console.log(chalk.gray(`\nÚltima atualização: ${formatTime(age)} atrás`));
  }

  console.log();
}

/**
 * Mostra status resumido
 */
async function showStatus() {
  const state = loadState();

  console.log(chalk.bold.cyan("\n📊 Status do Download Manager\n"));

  const stats = {
    total: state.torrents.length,
    downloading: state.torrents.filter((t) => t.status === "downloading").length,
    completed: state.torrents.filter((t) => t.status === "completed").length,
    paused: state.torrents.filter((t) => t.status === "paused").length,
  };

  console.log(`Total de downloads: ${chalk.bold(stats.total)}`);
  console.log(`  📥 Baixando: ${chalk.yellow(stats.downloading)}`);
  console.log(`  ✅ Completos: ${chalk.green(stats.completed)}`);
  console.log(`  ⏸️  Pausados: ${chalk.gray(stats.paused)}`);

  // Calcular totais
  const totalSize = state.torrents.reduce((sum, t) => sum + (t.total || 0), 0);
  const totalDownloaded = state.torrents.reduce((sum, t) => sum + (t.downloaded || 0), 0);
  const avgProgress = stats.total > 0 ? state.torrents.reduce((sum, t) => sum + t.progress, 0) / stats.total : 0;

  console.log(`\nTamanho total: ${formatBytes(totalSize)}`);
  console.log(`Baixado: ${formatBytes(totalDownloaded)}`);
  console.log(`Progresso médio: ${avgProgress.toFixed(2)}%`);

  console.log();
}

/**
 * Limpa downloads completos da lista
 */
async function clearCompleted() {
  const state = loadState();
  const before = state.torrents.length;
  state.torrents = state.torrents.filter((t) => t.status !== "completed");
  const removed = before - state.torrents.length;

  state.lastUpdate = Date.now();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  console.log(chalk.green(`\n✅ ${removed} download(s) completo(s) removido(s) da lista\n`));
}

/**
 * Mostra informações detalhadas de um download
 */
async function showInfo(index) {
  const state = loadState();
  const torrent = state.torrents[index];

  if (!torrent) {
    console.log(chalk.red(`\n❌ Download #${index + 1} não encontrado\n`));
    return;
  }

  console.log(chalk.bold.cyan(`\n📦 Detalhes do Download #${index + 1}\n`));
  console.log("=".repeat(80));
  console.log(chalk.bold(`Nome: ${torrent.name || "Carregando..."}`));
  console.log(`Hash: ${torrent.infoHash}`);
  console.log(`Tipo: ${getTypeEmoji(torrent.type)} ${torrent.type}`);
  console.log(`Status: ${getStatusBadge(torrent.status)}`);
  console.log(`\nProgresso: ${getProgressBar(torrent.progress, 50)} ${torrent.progress.toFixed(2)}%`);
  console.log(`Baixado: ${formatBytes(torrent.downloaded)} / ${formatBytes(torrent.total)}`);

  if (torrent.startTime) {
    const elapsed = Date.now() - torrent.startTime;
    console.log(`Iniciado: ${new Date(torrent.startTime).toLocaleString()}`);
    console.log(`Tempo decorrido: ${formatTime(elapsed)}`);

    if (torrent.progress > 0 && torrent.progress < 100) {
      const avgSpeed = torrent.downloaded / (elapsed / 1000);
      const remaining = (torrent.total - torrent.downloaded) / avgSpeed;
      console.log(`Tempo estimado: ${formatTime(remaining * 1000)}`);
      console.log(`Velocidade média: ${formatSpeed(avgSpeed)}`);
    }
  }

  console.log("=".repeat(80) + "\n");
}

/**
 * Helpers de formatação
 */
function getTypeEmoji(type) {
  const emojis = {
    movie: "🎬",
    series: "📺",
    music: "🎵",
  };
  return emojis[type] || "📦";
}

function getStatusBadge(status) {
  const badges = {
    downloading: chalk.yellow("⬇️  Baixando"),
    completed: chalk.green("✅ Completo"),
    paused: chalk.gray("⏸️  Pausado"),
    seeding: chalk.blue("🌱 Enviando"),
  };
  return badges[status] || status;
}

function getProgressBar(progress, width = 30) {
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);

  if (progress === 100) return chalk.green(bar);
  if (progress > 50) return chalk.yellow(bar);
  return chalk.cyan(bar);
}

/**
 * Mostra ajuda
 */
function showHelp() {
  console.log(chalk.bold.cyan("\n📥 Download Manager - Comandos\n"));
  console.log("Uso: npm run downloads:<comando>\n");
  console.log(chalk.bold("Comandos disponíveis:\n"));
  console.log(`  ${chalk.green("list")}      - Lista todos os downloads ativos`);
  console.log(`  ${chalk.green("status")}    - Mostra estatísticas gerais`);
  console.log(`  ${chalk.green("clear")}     - Remove downloads completos da lista`);
  console.log(`  ${chalk.green("info")} <n>  - Mostra detalhes do download #n`);
  console.log(`  ${chalk.green("help")}      - Mostra esta ajuda`);
  console.log("\nExemplos:");
  console.log(chalk.gray("  npm run downloads:list"));
  console.log(chalk.gray("  npm run downloads:status"));
  console.log(chalk.gray("  npm run downloads:info 1"));
  console.log();
}

// CLI
const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case "list":
    await listDownloads();
    break;
  case "status":
    await showStatus();
    break;
  case "clear":
    await clearCompleted();
    break;
  case "info":
    const index = parseInt(args[0]) - 1;
    if (isNaN(index)) {
      console.log(chalk.red("\n❌ Use: npm run downloads:info <número>\n"));
    } else {
      await showInfo(index);
    }
    break;
  case "help":
  default:
    showHelp();
    break;
}
