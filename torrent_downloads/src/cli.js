#!/usr/bin/env node

import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import torrentSearch from "./torrentSearch.js";
import DownloadManager from "./downloadManager.js";
import SeriesTracker from "./seriesTracker.js";
import MusicFeedTracker from "./musicFeedTracker.js";
import MetadataEnricher from "./metadataEnricher.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar configuração
const configPath = path.join(__dirname, "..", "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

// Inicializar metadata enricher
const metadataEnricher = new MetadataEnricher(config);

const program = new Command();

program.name("torrent-manager").description("Sistema de gerenciamento de downloads via torrent").version("1.0.0");

// Comando: Buscar torrents
program
  .command("search")
  .description("Buscar torrents")
  .action(async () => {
    const { type } = await inquirer.prompt([
      {
        type: "list",
        name: "type",
        message: "O que você quer buscar?",
        choices: ["Filme", "Série", "Música"],
      },
    ]);

    if (type === "Filme") {
      await searchMovie();
    } else if (type === "Série") {
      await searchSeries();
    } else if (type === "Música") {
      await searchMusic();
    }
  });

// Comando: Download direto
program
  .command("download")
  .description("Buscar e baixar torrent")
  .action(async () => {
    const { type } = await inquirer.prompt([
      {
        type: "list",
        name: "type",
        message: "O que você quer baixar?",
        choices: ["Filme", "Série", "Música"],
      },
    ]);

    let searchData = null;
    let searchType = "";

    if (type === "Filme") {
      searchData = await searchMovie();
      searchType = "movie";
    } else if (type === "Série") {
      searchData = await searchSeries();
      searchType = "series";
    } else if (type === "Música") {
      searchData = await searchMusic();
      searchType = "music";
    }

    if (searchData && searchData.results && searchData.results.length > 0) {
      await downloadTorrent(searchData.results, searchType, searchData.metadata || {});
    }
  });

// Comando: Rastrear série
program
  .command("track-series")
  .description("Adicionar série para rastreamento automático")
  .action(async () => {
    const tracker = new SeriesTracker(config);

    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "Nome da série:",
      },
      {
        type: "number",
        name: "season",
        message: "Temporada atual:",
        default: 1,
      },
      {
        type: "number",
        name: "episode",
        message: "Último episódio baixado:",
        default: 0,
      },
    ]);

    tracker.addSeries(answers.name, answers.season, answers.episode);
  });

// Comando: Listar séries rastreadas
program
  .command("list-tracked")
  .description("Listar séries rastreadas")
  .action(() => {
    const tracker = new SeriesTracker(config);
    const series = tracker.listTrackedSeries();

    if (series.length === 0) {
      console.log(chalk.yellow("\n⚠️ Nenhuma série rastreada"));
      return;
    }

    console.log(chalk.bold("\n📺 Séries Rastreadas:\n"));
    series.forEach((s, index) => {
      const status = s.active ? chalk.green("✓ Ativa") : chalk.red("✗ Inativa");
      console.log(`${index + 1}. ${chalk.bold(s.name)} - S${String(s.currentSeason).padStart(2, "0")}E${String(s.currentEpisode).padStart(2, "0")}`);
      console.log(`   Status: ${status}`);
      console.log(`   Última verificação: ${s.lastChecked || "Nunca"}\n`);
    });
  });

// Comando: Verificar novos episódios
program
  .command("check-series")
  .description("Verificar novos episódios das séries rastreadas")
  .action(async () => {
    const tracker = new SeriesTracker(config);
    const newEpisodes = await tracker.checkAllSeries();

    if (newEpisodes.length === 0) {
      console.log(chalk.green("\n✅ Nenhum novo episódio disponível"));
      return;
    }

    console.log(chalk.bold("\n🆕 Novos episódios encontrados:\n"));

    for (const { series, episode } of newEpisodes) {
      console.log(chalk.bold(`${series.name} - S${String(episode.season).padStart(2, "0")}E${String(episode.episode).padStart(2, "0")}`));
      console.log(`Episódio: ${episode.name}`);
      console.log(`Data de lançamento: ${episode.airdate}\n`);

      const { download } = await inquirer.prompt([
        {
          type: "confirm",
          name: "download",
          message: "Deseja baixar este episódio agora?",
          default: true,
        },
      ]);

      if (download) {
        const spinner = ora("Buscando torrents...").start();
        const results = await torrentSearch.searchSeries(series.name, episode.season, episode.episode);
        spinner.succeed("Busca concluída!");

        if (results.length > 0) {
          await downloadTorrent(results, "series");
          tracker.updateSeriesEpisode(series.id, episode.season, episode.episode);
        } else {
          console.log(chalk.yellow("⚠️ Nenhum torrent encontrado"));
        }
      }
    }
  });

// Comando: Iniciar monitoramento automático
program
  .command("start-monitor")
  .description("Iniciar monitoramento automático de séries")
  .action(async () => {
    console.log(chalk.bold.green("\n🚀 Iniciando monitoramento automático de séries...\n"));

    const tracker = new SeriesTracker(config);
    const downloadManager = new DownloadManager(config);

    tracker.startScheduler(async (series, episode) => {
      console.log(chalk.bold(`\n🆕 Novo episódio detectado: ${series.name} S${String(episode.season).padStart(2, "0")}E${String(episode.episode).padStart(2, "0")}\n`));

      const results = await torrentSearch.searchSeries(series.name, episode.season, episode.episode);

      if (results.length > 0) {
        const topResult = results[0];
        console.log(chalk.green(`📥 Baixando automaticamente: ${topResult.title}`));

        const magnetLink = await torrentSearch.getMagnetLink(topResult);
        if (magnetLink) {
          await downloadManager.addTorrent(magnetLink, "series", {
            seriesName: series.name,
            season: episode.season,
            episode: episode.episode,
          });

          tracker.updateSeriesEpisode(series.id, episode.season, episode.episode);
        }
      }
    });

    console.log(chalk.green("✅ Monitoramento ativo. Pressione Ctrl+C para parar.\n"));

    // Manter o processo rodando
    process.on("SIGINT", () => {
      console.log(chalk.yellow("\n\n⏹️ Parando monitoramento..."));
      tracker.stopScheduler();
      downloadManager.destroy().then(() => {
        console.log(chalk.green("✅ Encerrado com sucesso"));
        process.exit(0);
      });
    });
  });

// Funções auxiliares

async function searchMovie() {
  const { name, year } = await inquirer.prompt([
    {
      type: "input",
      name: "name",
      message: "Nome do filme:",
    },
    {
      type: "input",
      name: "year",
      message: "Ano (opcional):",
    },
  ]);

  const spinner = ora("Buscando torrents...").start();

  try {
    const results = await torrentSearch.searchMovies(name, year || null);
    spinner.succeed("Busca concluída!");

    if (results.length === 0) {
      console.log(chalk.yellow("\n⚠️ Nenhum resultado encontrado"));
      return { results: [], metadata: {} };
    }

    displayResults(results);
    return {
      results,
      metadata: {
        movieName: name,
        year: year || null,
      },
    };
  } catch (err) {
    spinner.fail("Erro na busca");
    console.error(chalk.red(err.message));
    return { results: [], metadata: {} };
  }
}

async function searchSeries() {
  const { name, downloadType } = await inquirer.prompt([
    {
      type: "input",
      name: "name",
      message: "Nome da série:",
    },
    {
      type: "list",
      name: "downloadType",
      message: "O que deseja baixar?",
      choices: ["Episódio específico", "Temporada inteira"],
    },
  ]);

  if (downloadType === "Temporada inteira") {
    const { season } = await inquirer.prompt([
      {
        type: "input",
        name: "season",
        message: "Qual temporada?",
        validate: (input) => {
          const num = parseInt(input);
          return num > 0 ? true : "Digite um número válido";
        },
      },
    ]);

    return await searchFullSeason(name, parseInt(season));
  } else {
    const { season, episode } = await inquirer.prompt([
      {
        type: "input",
        name: "season",
        message: "Temporada (opcional):",
      },
      {
        type: "input",
        name: "episode",
        message: "Episódio (opcional):",
      },
    ]);

    const spinner = ora("Buscando torrents...").start();

    try {
      const results = await torrentSearch.searchSeries(name, season ? parseInt(season) : null, episode ? parseInt(episode) : null);
      spinner.succeed("Busca concluída!");

      if (results.length === 0) {
        console.log(chalk.yellow("\n⚠️ Nenhum resultado encontrado"));
        return { results: [], metadata: {} };
      }

      displayResults(results);
      return {
        results,
        metadata: {
          seriesName: name,
          season: season ? parseInt(season) : null,
          episode: episode ? parseInt(episode) : null,
        },
      };
    } catch (err) {
      spinner.fail("Erro na busca");
      console.error(chalk.red(err.message));
      return { results: [], metadata: {} };
    }
  }
}

async function searchMusic() {
  const { artist, album } = await inquirer.prompt([
    {
      type: "input",
      name: "artist",
      message: "Nome do artista:",
    },
    {
      type: "input",
      name: "album",
      message: "Nome do álbum (opcional):",
    },
  ]);

  const spinner = ora("Buscando torrents...").start();

  try {
    // Buscar em paralelo: feeds RSS + torrent-search-api
    const feedTracker = new MusicFeedTracker(config);
    const [apiResults, rssResults] = await Promise.all([torrentSearch.searchMusic(artist, album || null).catch(() => []), feedTracker.searchInFeeds(artist, album || null).catch(() => [])]);

    // RSS na frente (mais fresco), depois API; remover duplicados pelo título
    const seen = new Set();
    const results = [...rssResults, ...apiResults].filter((r) => {
      const key = r.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    spinner.succeed(`Busca concluída! (${rssResults.length} dos feeds RSS + ${apiResults.length} da API)`);

    if (results.length === 0) {
      console.log(chalk.yellow("\n⚠️ Nenhum resultado encontrado"));
      return { results: [], metadata: {} };
    }

    displayResults(results);
    return {
      results,
      metadata: {
        artist,
        album: album || null,
      },
    };
  } catch (err) {
    spinner.fail("Erro na busca");
    console.error(chalk.red(err.message));
    return { results: [], metadata: {} };
  }
}

function displayResults(results) {
  console.log(chalk.bold("\n📋 Resultados:\n"));

  results.slice(0, 10).forEach((result, index) => {
    const source = result._fromRSS ? chalk.cyan(`[RSS: ${result.provider}]`) : "";
    console.log(`${chalk.bold(`${index + 1}.`)} ${result.title} ${source}`);
    if (!result._fromRSS) {
      console.log(`   ${chalk.gray("Seeders:")} ${chalk.green(result.seeds)} | ${chalk.gray("Size:")} ${result.size}`);
    }
    console.log(`   ${chalk.gray("Score:")} ${Math.round(result.score)}/100 | ${chalk.gray("Magnet:")} ${result.magnetLink || result._fromRSS ? chalk.green("✔") : chalk.red("✘")}`);
    console.log();
  });
}

async function downloadTorrent(results, type, extraMetadata = {}) {
  const choices = results.slice(0, 10).map((result, index) => ({
    name: `${result.title} (${result.seeds} seeders, ${result.size})`,
    value: index,
  }));

  const { selectedIndex } = await inquirer.prompt([
    {
      type: "list",
      name: "selectedIndex",
      message: "Qual torrent deseja baixar?",
      choices: choices,
    },
  ]);

  const selectedTorrent = results[selectedIndex];
  const spinner = ora("Obtendo magnet link...").start();

  try {
    // Resultados de RSS já trazem o magnet link embutido
    let torrentSource; // magnet URI (string) ou Buffer (.torrent)
    if (selectedTorrent._fromRSS && selectedTorrent.magnetLink) {
      torrentSource = selectedTorrent.magnetLink;
      spinner.succeed("Magnet link obtido do feed RSS!");
    } else {
      const magnetLink = await torrentSearch.getMagnetLink(selectedTorrent);
      if (magnetLink) {
        torrentSource = magnetLink;
        spinner.succeed("Magnet link obtido!");
      } else {
        spinner.text = "Magnet não encontrado, baixando arquivo .torrent...";
        const buffer = await torrentSearch.getTorrentBuffer(selectedTorrent);
        if (buffer) {
          torrentSource = buffer;
          spinner.succeed("Arquivo .torrent baixado!");
        } else {
          spinner.fail("Não foi possível obter o torrent (sem magnet e sem arquivo .torrent)");
          if (selectedTorrent.desc) console.log(chalk.gray(`Página: ${selectedTorrent.desc}`));
          return;
        }
      }
    }

    // Metadata adicional
    let metadata = { ...extraMetadata };

    // Buscar metadados para filmes
    if (type === "movie") {
      const { movieName, year } = extraMetadata;
      if (movieName && config.metadata?.enabled) {
        spinner.text = "Buscando metadados do filme...";
        spinner.start();
        const movieMetadata = await metadataEnricher.getMovieMetadata(movieName, year);
        spinner.succeed("Metadados obtidos!");
        metadata.movieMetadata = movieMetadata;

        console.log(chalk.bold(`\n🎬 ${movieMetadata.title} (${movieMetadata.year})`));
        if (movieMetadata.overview) {
          console.log(chalk.gray(movieMetadata.overview.substring(0, 200) + "..."));
        }
        console.log(chalk.yellow(`⭐ ${movieMetadata.rating}/10`));
      }
    }

    // Buscar metadados para séries
    if (type === "series") {
      const { seriesName, season, episode } = extraMetadata;
      if (seriesName && config.metadata?.enabled) {
        spinner.text = "Buscando metadados da série...";
        spinner.start();
        const seriesMetadata = await metadataEnricher.getSeriesMetadata(seriesName);
        spinner.succeed("Metadados obtidos!");
        metadata.seriesMetadata = seriesMetadata;
        metadata.season = season;
        metadata.episode = episode;

        console.log(chalk.bold(`\n📺 ${seriesMetadata.name}`));
        if (seriesMetadata.overview) {
          console.log(chalk.gray(seriesMetadata.overview.substring(0, 200) + "..."));
        }
        console.log(chalk.yellow(`⭐ ${seriesMetadata.rating}/10`));
      }
    }

    // Música
    if (type === "music") {
      const { artist, album } = extraMetadata;
      metadata = { artist, album: album || "Unknown Album" };
    }

    console.log(chalk.green("\n📥 Iniciando download...\n"));

    const downloadManager = new DownloadManager(config);

    if (Buffer.isBuffer(torrentSource)) {
      console.log(chalk.gray("   (usando arquivo .torrent)"));
    }

    // Event listeners
    downloadManager.on("progress", (info) => {
      process.stdout.write(
        `\r${chalk.cyan("⬇️")} ${info.progress.toFixed(2)}% | ` +
          `${chalk.green("↓")} ${downloadManager.formatSpeed(info.downloadSpeed)} | ` +
          `${chalk.yellow("↑")} ${downloadManager.formatSpeed(info.uploadSpeed)} | ` +
          `${chalk.blue("👥")} ${info.peers} peers`,
      );
    });

    downloadManager.on("completed", (info) => {
      console.log(chalk.green("\n\n✅ Download concluído!"));
      console.log(`📁 Salvo em: ${downloadManager.getDownloadPath(type)}`);
      process.exit(0);
    });

    downloadManager.on("error", ({ error }) => {
      console.error(chalk.red(`\n❌ Erro: ${error.message}`));
      process.exit(1);
    });

    await downloadManager.addTorrent(torrentSource, type, metadata);
  } catch (err) {
    spinner.fail("Erro ao obter magnet link");
    console.error(chalk.red(err.message));
  }
}

async function searchFullSeason(seriesName, seasonNumber) {
  console.log(chalk.bold(`\n🔍 Buscando temporada inteira: ${seriesName} - Temporada ${seasonNumber}\n`));

  // Buscar metadados da série para saber quantos episódios tem
  let numberOfEpisodes = null;
  if (config.metadata?.enabled) {
    const spinner = ora("Buscando informações da série...").start();
    try {
      const seriesMetadata = await metadataEnricher.getSeriesMetadata(seriesName);
      const seasonData = await metadataEnricher.getSeasonMetadata(seriesMetadata.id, seasonNumber);

      if (seasonData && seasonData.episodes) {
        numberOfEpisodes = seasonData.episodes.length;
        spinner.succeed(`Informações obtidas: ${numberOfEpisodes} episódios`);

        console.log(chalk.bold(`\n📺 ${seriesMetadata.name} - Temporada ${seasonNumber}`));
        console.log(chalk.gray(`Total de episódios: ${numberOfEpisodes}\n`));
      } else {
        spinner.warn("Não foi possível obter informações da temporada");
      }
    } catch (err) {
      spinner.fail("Erro ao buscar informações");
    }
  }

  // Perguntar quantos episódios se não conseguiu buscar
  if (!numberOfEpisodes) {
    const answer = await inquirer.prompt([
      {
        type: "number",
        name: "episodes",
        message: "Quantos episódios tem esta temporada?",
        default: 10,
      },
    ]);
    numberOfEpisodes = answer.episodes;
  }

  // Procurar por pack da temporada inteira primeiro
  const spinner = ora("Buscando pack da temporada...").start();
  const packQuery = `${seriesName} S${String(seasonNumber).padStart(2, "0")} complete`;
  const packResults = await torrentSearch.search(packQuery, "All", 10);

  if (packResults.length > 0) {
    spinner.succeed("Pack encontrado!");
    displayResults(packResults);

    const { usePack } = await inquirer.prompt([
      {
        type: "confirm",
        name: "usePack",
        message: "Deseja baixar o pack completo da temporada?",
        default: true,
      },
    ]);

    if (usePack) {
      await downloadTorrent(packResults, "series", {
        seriesName,
        season: seasonNumber,
        episode: 1, // Para processamento de metadados
      });
      return packResults;
    }
  } else {
    spinner.fail("Nenhum pack encontrado");
  }

  // Se não usar pack, baixar episódio por episódio
  console.log(chalk.yellow("\n⚠️ Baixando episódios individualmente...\n"));

  for (let ep = 1; ep <= numberOfEpisodes; ep++) {
    console.log(chalk.bold(`\n📥 Episódio ${ep}/${numberOfEpisodes}`));

    const epSpinner = ora(`Buscando S${String(seasonNumber).padStart(2, "0")}E${String(ep).padStart(2, "0")}...`).start();
    const results = await torrentSearch.searchSeries(seriesName, seasonNumber, ep);

    if (results.length === 0) {
      epSpinner.fail(`Episódio ${ep} não encontrado`);
      continue;
    }

    epSpinner.succeed("Encontrado!");

    // Baixar automaticamente o melhor resultado
    const best = results[0];
    console.log(chalk.green(`Baixando: ${best.title}`));

    const magnetLink = await torrentSearch.getMagnetLink(best);
    if (magnetLink) {
      const downloadManager = new DownloadManager(config);

      // Buscar metadados
      let metadata = { seriesName, season: seasonNumber, episode: ep };
      if (config.metadata?.enabled) {
        const seriesMetadata = await metadataEnricher.getSeriesMetadata(seriesName);
        metadata.seriesMetadata = seriesMetadata;
      }

      await new Promise((resolve, reject) => {
        downloadManager.on("completed", () => {
          console.log(chalk.green(`✅ Episódio ${ep} completo!`));
          resolve();
        });

        downloadManager.on("error", ({ error }) => {
          console.error(chalk.red(`❌ Erro no ep ${ep}: ${error.message}`));
          resolve(); // Continuar mesmo com erro
        });

        downloadManager.addTorrent(magnetLink, "series", metadata);
      });
    }

    // Delay entre downloads
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log(chalk.green("\n\n🎉 Temporada completa baixada!"));
  process.exit(0);
}

// ──────────────────────────────────────────────────────────────
//  Comandos de Feeds de Música
// ──────────────────────────────────────────────────────────────

// Listar feeds configurados
program
  .command("music-feeds")
  .description("Listar feeds RSS de música configurados")
  .action(() => {
    const tracker = new MusicFeedTracker(config);
    const feeds = tracker.listFeeds();

    if (feeds.length === 0) {
      console.log(chalk.yellow("Nenhum feed configurado em config.json → music.feeds"));
      return;
    }

    console.log(chalk.bold("\n📡 Feeds de música configurados:\n"));
    feeds.forEach((f, i) => {
      const status = f.enabled ? chalk.green("✅ ativo") : chalk.gray("⏸  inativo");
      console.log(`  ${i + 1}. ${chalk.bold(f.name)}`);
      console.log(`     ${chalk.gray(f.url)}`);
      console.log(`     ${status}\n`);
    });
  });

// Navegar nos feeds (sem filtro de artista)
program
  .command("music-browse")
  .description("Ver últimos lançamentos nos feeds de música")
  .action(async () => {
    const tracker = new MusicFeedTracker(config);
    const spinner = ora("Buscando feeds de música...").start();

    try {
      const items = await tracker.browseFeeds(30);
      spinner.succeed(`${items.length} itens encontrados`);

      if (items.length === 0) {
        console.log(chalk.yellow("Nenhum item nos feeds."));
        return;
      }

      console.log(chalk.bold("\n🎵 Últimos lançamentos:\n"));
      items.forEach((item, i) => {
        console.log(`  ${chalk.bold(String(i + 1).padStart(2, "0"))}. ${item.title}`);
        console.log(`      Feed : ${chalk.gray(item.feedName)}`);
        if (item.pubDate) console.log(`      Data : ${chalk.gray(item.pubDate)}`);
        if (item.magnetLink) console.log(`      Magnet: ${chalk.cyan("✔ disponível")}`);
        console.log();
      });

      // Perguntar se quer baixar algum
      const { choice } = await inquirer.prompt([
        {
          type: "input",
          name: "choice",
          message: "Número do lançamento para baixar (ou Enter para sair):",
        },
      ]);

      const idx = parseInt(choice) - 1;
      if (!isNaN(idx) && items[idx]) {
        const selected = items[idx];
        if (selected.magnetLink) {
          const downloadManager = new DownloadManager(config);
          const spinner2 = ora(`Iniciando download: ${selected.title}`).start();
          try {
            await downloadManager.addTorrent(selected.magnetLink, "music", { title: selected.title });
            spinner2.succeed("Download iniciado!");
          } catch (err) {
            spinner2.fail(`Erro: ${err.message}`);
          }
        } else {
          console.log(chalk.yellow("Este item não possui magnet link disponível."));
          if (selected.link) console.log(chalk.gray(`Link: ${selected.link}`));
        }
      }
    } catch (err) {
      spinner.fail(`Erro: ${err.message}`);
    }

    process.exit(0);
  });

// Monitorar artista
program
  .command("track-music")
  .description("Adicionar artista para monitoramento automático nos feeds")
  .action(async () => {
    const tracker = new MusicFeedTracker(config);

    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "Nome do artista:",
      },
      {
        type: "input",
        name: "genre",
        message: "Gênero (opcional):",
      },
    ]);

    tracker.addArtist(answers.name, answers.genre || null);
    process.exit(0);
  });

// Verificar feeds agora
program
  .command("check-music")
  .description("Verificar feeds de música agora e listar novos lançamentos dos artistas monitorados")
  .action(async () => {
    const tracker = new MusicFeedTracker(config);
    const activeArtists = tracker.listArtists().filter((a) => a.active);

    if (activeArtists.length === 0) {
      console.log(chalk.yellow('\n⚠️  Nenhum artista monitorado. Use "npm run music:track" para adicionar.\n'));
      process.exit(0);
    }

    console.log(chalk.bold(`\n🎵 Monitorando ${activeArtists.length} artista(s): `) + activeArtists.map((a) => a.name).join(", "));

    const releases = await tracker.checkForNewReleases();

    if (releases.length > 0) {
      console.log(chalk.bold("\n📥 Deseja baixar os lançamentos encontrados?\n"));

      for (const { artist, item } of releases) {
        console.log(`  → ${chalk.bold(item.title)} (${chalk.gray(item.feedName)})`);

        const { download } = await inquirer.prompt([
          {
            type: "confirm",
            name: "download",
            message: `  Baixar "${item.title}"?`,
            default: true,
          },
        ]);

        if (download) {
          if (item.magnetLink) {
            const downloadManager = new DownloadManager(config);
            const spinner = ora("Iniciando download...").start();
            try {
              await downloadManager.addTorrent(item.magnetLink, "music", {
                artist: artist.name,
                title: item.title,
              });
              spinner.succeed("Download iniciado!");
            } catch (err) {
              spinner.fail(`Erro: ${err.message}`);
            }
          } else {
            console.log(chalk.yellow("  ⚠️  Magnet link não disponível neste item."));
            if (item.link) console.log(chalk.gray(`  Link: ${item.link}`));
          }
        }
      }
    }

    process.exit(0);
  });

program.parse();
