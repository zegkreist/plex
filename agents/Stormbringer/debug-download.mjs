#!/usr/bin/env node
/**
 * Script de debug para testar o fluxo de download passo a passo.
 * Mude ARTIST e ALBUM abaixo para o que você quer baixar.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));

const ARTIST = "Tristania";
const ALBUM = "";

// ─── helpers ──────────────────────────────────────────────────────────────────
const sep = (label) => console.log(`\n${"─".repeat(60)}\n▶  ${label}\n${"─".repeat(60)}`);
const json = (obj) => console.log(JSON.stringify(obj, null, 2));

// ─── 1. RSS feeds ─────────────────────────────────────────────────────────────
sep("1. Buscando nos feeds RSS");
const { default: MusicFeedTracker } = await import("./src/musicFeedTracker.js");
const feedTracker = new MusicFeedTracker(config);

let rssResults = [];
try {
  rssResults = await feedTracker.searchInFeeds(ARTIST, ALBUM);
  console.log(`✓ RSS retornou ${rssResults.length} resultados`);
  if (rssResults.length > 0) {
    console.log("Primeiro resultado RSS:");
    json({ title: rssResults[0].title, magnetLink: rssResults[0].magnetLink?.slice(0, 80) + "...", _fromRSS: rssResults[0]._fromRSS });
  }
} catch (err) {
  console.error("✗ Erro RSS:", err.message);
}

// ─── 2. torrent-search-api ────────────────────────────────────────────────────
sep("2. Buscando via torrent-search-api");
const { default: torrentSearch } = await import("./src/torrentSearch.js");

let apiResults = [];
try {
  apiResults = await torrentSearch.searchMusic(ARTIST, ALBUM);
  console.log(`✓ API retornou ${apiResults.length} resultados`);
  if (apiResults.length > 0) {
    console.log("Primeiros 3 resultados API:");
    apiResults.slice(0, 3).forEach((r, i) => console.log(`  ${i + 1}. [${r.provider}] ${r.title} | seeds:${r.seeds} | size:${r.size}`));
  }
} catch (err) {
  console.error("✗ Erro API:", err.message);
}

// ─── 3. Magnet / .torrent ─────────────────────────────────────────────────────
const candidates = [...rssResults, ...apiResults];
if (candidates.length === 0) {
  console.log("\n❌ Nenhum resultado encontrado para testar download.");
  process.exit(0);
}

const target = candidates[0];
sep(`3. Obtendo fonte para: "${target.title}"`);
console.log(`  provider: ${target.provider || "(RSS)"}`);
console.log(`  _fromRSS: ${target._fromRSS}`);
console.log(`  magnetLink: ${target.magnetLink ? target.magnetLink.slice(0, 80) + "..." : "null"}`);
console.log(`  link/desc: ${target.link || target.desc || "n/a"}`);

let torrentSource = null;

if (target._fromRSS && target.magnetLink) {
  torrentSource = target.magnetLink;
  console.log("✓ Usando magnet do RSS");
} else {
  console.log("  Tentando getMagnetLink...");
  try {
    const magnet = await torrentSearch.getMagnetLink(target);
    if (magnet) {
      torrentSource = magnet;
      console.log("✓ Magnet obtido:", magnet.slice(0, 80) + "...");
    } else {
      console.log("  getMagnetLink retornou null — tentando .torrent buffer...");
      const buf = await torrentSearch.getTorrentBuffer(target);
      if (buf) {
        torrentSource = buf;
        console.log(`✓ Buffer .torrent obtido (${buf.length} bytes)`);
      } else {
        console.log("✗ Sem magnet e sem buffer .torrent");
      }
    }
  } catch (err) {
    console.error("✗ Erro ao obter fonte:", err.message);
  }
}

if (!torrentSource) {
  console.log("\n❌ Não foi possível obter fonte para download.");
  process.exit(1);
}

// ─── 4. WebTorrent ────────────────────────────────────────────────────────────
sep("4. Adicionando ao WebTorrent");
const { default: DownloadManager } = await import("./src/downloadManager.js");
const dm = new DownloadManager(config);

dm.on("error", ({ error }) => {
  console.error("✗ Erro no download:", error.message);
  process.exit(1);
});

console.log("  addTorrent() chamado — aguardando metadados (max 60s)...");

try {
  const info = await dm.addTorrent(torrentSource, "music", { artist: ARTIST, album: ALBUM });
  console.log(`\n✓ Metadados recebidos!`);
  console.log(`  Nome: ${info.name}`);
  console.log(`  Tamanho: ${info.total} bytes`);
  console.log("\n✅ Tudo OK — download está rodando. Ctrl+C para parar.");

  // Monitorar progresso continuamente
  dm.on("progress", (info) => {
    process.stdout.write(`\r  ⬇ ${info.progress.toFixed(2)}% | peers: ${info.peers} | ` + `↓ ${(info.downloadSpeed / 1024).toFixed(1)} KB/s`);
  });

  dm.on("completed", () => {
    console.log("\n\n✅ Download completo!");
    process.exit(0);
  });
} catch (err) {
  console.error("\n✗ Falha:", err.message);
  process.exit(1);
}
