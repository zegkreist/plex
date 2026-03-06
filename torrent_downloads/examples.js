/**
 * Exemplo de uso programático do Torrent Download Manager
 *
 * Use este arquivo como referência para integrar o sistema
 * em seus próprios projetos Node.js
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import torrentSearch from "./src/torrentSearch.js";
import DownloadManager from "./src/downloadManager.js";
import SeriesTracker from "./src/seriesTracker.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar configuração
const config = JSON.parse(readFileSync(join(__dirname, "config.json"), "utf8"));

// ============================================
// EXEMPLO 1: Buscar e baixar um filme
// ============================================
async function exemploFilme() {
  console.log("\n=== EXEMPLO: Buscar e baixar um filme ===\n");

  // 1. Buscar torrents
  const resultados = await torrentSearch.searchMovies("Inception", 2010);
  console.log(`Encontrados ${resultados.length} torrents`);

  // 2. Pegar o melhor resultado (maior score)
  const melhorTorrent = resultados[0];
  console.log(`Melhor: ${melhorTorrent.title} (Score: ${Math.round(melhorTorrent.score)})`);

  // 3. Obter magnet link
  const magnetLink = await torrentSearch.getMagnetLink(melhorTorrent);

  // 4. Iniciar download
  const downloadManager = new DownloadManager(config);

  downloadManager.on("progress", (info) => {
    console.log(`Progresso: ${info.progress.toFixed(2)}% - ${downloadManager.formatSpeed(info.downloadSpeed)}`);
  });

  downloadManager.on("completed", (info) => {
    console.log("Download completo!");
  });

  await downloadManager.addTorrent(magnetLink, "movie");
}

// ============================================
// EXEMPLO 2: Buscar série específica
// ============================================
async function exemploSerie() {
  console.log("\n=== EXEMPLO: Buscar episódio de série ===\n");

  // Buscar Breaking Bad S01E01
  const resultados = await torrentSearch.searchSeries("Breaking Bad", 1, 1);

  console.log(`Encontrados ${resultados.length} torrents`);
  resultados.slice(0, 5).forEach((r, i) => {
    console.log(`${i + 1}. ${r.title}`);
    console.log(`   Seeders: ${r.seeds} | Tamanho: ${r.size} | Score: ${Math.round(r.score)}`);
  });
}

// ============================================
// EXEMPLO 3: Buscar música
// ============================================
async function exemploMusica() {
  console.log("\n=== EXEMPLO: Buscar música ===\n");

  const resultados = await torrentSearch.searchMusic("Pink Floyd", "The Dark Side of the Moon");

  console.log(`Encontrados ${resultados.length} torrents`);
  resultados.slice(0, 5).forEach((r, i) => {
    console.log(`${i + 1}. ${r.title}`);
    console.log(`   Seeders: ${r.seeds} | Tamanho: ${r.size}`);
  });
}

// ============================================
// EXEMPLO 4: Rastrear séries automaticamente
// ============================================
async function exemploRastreamento() {
  console.log("\n=== EXEMPLO: Rastreamento de séries ===\n");

  const tracker = new SeriesTracker(config);

  // 1. Adicionar série
  tracker.addSeries("The Mandalorian", 3, 5);

  // 2. Listar séries rastreadas
  const series = tracker.listTrackedSeries();
  console.log("Séries rastreadas:");
  series.forEach((s) => {
    console.log(`- ${s.name} (S${String(s.currentSeason).padStart(2, "0")}E${String(s.currentEpisode).padStart(2, "0")})`);
  });

  // 3. Verificar novos episódios
  const novosEpisodios = await tracker.checkAllSeries();

  if (novosEpisodios.length > 0) {
    console.log("\nNovos episódios:");
    novosEpisodios.forEach(({ series, episode }) => {
      console.log(`- ${series.name} S${String(episode.season).padStart(2, "0")}E${String(episode.episode).padStart(2, "0")}`);
    });
  } else {
    console.log("\nNenhum novo episódio disponível");
  }
}

// ============================================
// EXEMPLO 5: Monitoramento automático
// ============================================
async function exemploMonitoramento() {
  console.log("\n=== EXEMPLO: Monitoramento automático ===\n");

  const tracker = new SeriesTracker(config);
  const downloadManager = new DownloadManager(config);

  // Callback quando novo episódio é encontrado
  const onNovoEpisodio = async (series, episode) => {
    console.log(`\n🆕 Novo: ${series.name} S${String(episode.season).padStart(2, "0")}E${String(episode.episode).padStart(2, "0")}`);

    // Buscar torrent
    const resultados = await torrentSearch.searchSeries(series.name, episode.season, episode.episode);

    if (resultados.length > 0) {
      const melhor = resultados[0];
      const magnetLink = await torrentSearch.getMagnetLink(melhor);

      // Baixar automaticamente
      await downloadManager.addTorrent(magnetLink, "series", {
        seriesName: series.name,
        season: episode.season,
        episode: episode.episode,
      });

      // Atualizar tracker
      tracker.updateSeriesEpisode(series.id, episode.season, episode.episode);
    }
  };

  // Iniciar monitoramento (verifica no intervalo definido em config.json)
  tracker.startScheduler(onNovoEpisodio);
  console.log("Monitoramento iniciado!");

  // Para parar: tracker.stopScheduler();
}

// ============================================
// EXEMPLO 6: Monitorar downloads ativos
// ============================================
async function exemploMonitorarDownloads() {
  console.log("\n=== EXEMPLO: Monitorar downloads ===\n");

  const downloadManager = new DownloadManager(config);

  // Adicionar alguns torrents (exemplo)
  const magnet = "magnet:?xt=urn:btih:...";

  await downloadManager.addTorrent(magnet, "movie");

  // Verificar downloads ativos
  setInterval(() => {
    const ativos = downloadManager.getActiveTorrents();

    console.clear();
    console.log("DOWNLOADS ATIVOS:\n");

    ativos.forEach((info) => {
      console.log(`📦 ${info.name || "Carregando..."}`);
      console.log(`   Status: ${info.status}`);
      console.log(`   Progresso: ${info.progress.toFixed(2)}%`);
      console.log(`   Download: ${downloadManager.formatSpeed(info.downloadSpeed)}`);
      console.log(`   Upload: ${downloadManager.formatSpeed(info.uploadSpeed)}`);
      console.log(`   Peers: ${info.peers}`);
      console.log("");
    });
  }, 1000);
}

// ============================================
// Executar exemplos
// ============================================

// Descomente para executar:

// exemploFilme();
// exemploSerie();
// exemploMusica();
// exemploRastreamento();
// exemploMonitoramento();
// exemploMonitorarDownloads();

console.log("\n💡 Descomente um dos exemplos acima para testá-lo!\n");
