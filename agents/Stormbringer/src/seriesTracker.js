import fs from "fs";
import path from "path";
import axios from "axios";
import cron from "node-cron";

class SeriesTracker {
  constructor(config) {
    this.config = config;
    this.trackerFile = config.series.trackerFile;
    this.trackedSeries = this.loadTrackedSeries();
    this.cronJob = null;
  }

  /**
   * Carrega séries rastreadas do arquivo
   */
  loadTrackedSeries() {
    try {
      if (fs.existsSync(this.trackerFile)) {
        const data = fs.readFileSync(this.trackerFile, "utf8");
        return JSON.parse(data);
      }
    } catch (err) {
      console.error("Erro ao carregar séries rastreadas:", err.message);
    }
    return [];
  }

  /**
   * Salva séries rastreadas no arquivo
   */
  saveTrackedSeries() {
    try {
      fs.writeFileSync(this.trackerFile, JSON.stringify(this.trackedSeries, null, 2));
    } catch (err) {
      console.error("Erro ao salvar séries rastreadas:", err.message);
    }
  }

  /**
   * Adiciona uma série para rastreamento
   */
  addSeries(seriesName, currentSeason, currentEpisode, imdbId = null) {
    const series = {
      id: Date.now().toString(),
      name: seriesName,
      currentSeason: parseInt(currentSeason),
      currentEpisode: parseInt(currentEpisode),
      imdbId,
      addedAt: new Date().toISOString(),
      lastChecked: null,
      lastDownloaded: null,
      active: true,
    };

    this.trackedSeries.push(series);
    this.saveTrackedSeries();

    console.log(`✅ Série adicionada ao rastreamento: ${seriesName} S${String(currentSeason).padStart(2, "0")}E${String(currentEpisode).padStart(2, "0")}`);
    return series;
  }

  /**
   * Remove uma série do rastreamento
   */
  removeSeries(seriesId) {
    const index = this.trackedSeries.findIndex((s) => s.id === seriesId);
    if (index !== -1) {
      const series = this.trackedSeries[index];
      this.trackedSeries.splice(index, 1);
      this.saveTrackedSeries();
      console.log(`🗑️ Série removida do rastreamento: ${series.name}`);
      return true;
    }
    return false;
  }

  /**
   * Lista todas as séries rastreadas
   */
  listTrackedSeries() {
    return this.trackedSeries;
  }

  /**
   * Atualiza o episódio atual de uma série
   */
  updateSeriesEpisode(seriesId, season, episode) {
    const series = this.trackedSeries.find((s) => s.id === seriesId);
    if (series) {
      series.currentSeason = parseInt(season);
      series.currentEpisode = parseInt(episode);
      series.lastDownloaded = new Date().toISOString();
      this.saveTrackedSeries();
      return true;
    }
    return false;
  }

  /**
   * Verifica novos episódios usando API do TVMaze
   */
  async checkForNewEpisodes(series) {
    try {
      // Buscar informações da série no TVMaze
      const searchResponse = await axios.get(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(series.name)}`);

      if (searchResponse.data.length === 0) {
        console.log(`⚠️ Série não encontrada: ${series.name}`);
        return null;
      }

      const showId = searchResponse.data[0].show.id;

      // Obter episódios da série
      const episodesResponse = await axios.get(`https://api.tvmaze.com/shows/${showId}/episodes`);
      const episodes = episodesResponse.data;

      // Encontrar próximo episódio
      const nextEpisode = episodes.find((ep) => {
        if (ep.season > series.currentSeason) return true;
        if (ep.season === series.currentSeason && ep.number > series.currentEpisode) return true;
        return false;
      });

      if (nextEpisode) {
        // Verificar se já foi lançado
        const airDate = new Date(nextEpisode.airdate);
        const now = new Date();

        if (airDate <= now) {
          return {
            season: nextEpisode.season,
            episode: nextEpisode.number,
            name: nextEpisode.name,
            airdate: nextEpisode.airdate,
            summary: nextEpisode.summary,
          };
        }
      }

      return null;
    } catch (err) {
      console.error(`Erro ao verificar episódios de ${series.name}:`, err.message);
      return null;
    }
  }

  /**
   * Verifica todas as séries rastreadas
   */
  async checkAllSeries() {
    console.log("\n🔍 Verificando novos episódios...\n");
    const newEpisodes = [];

    for (const series of this.trackedSeries) {
      if (!series.active) continue;

      console.log(`Verificando: ${series.name}...`);
      const newEpisode = await this.checkForNewEpisodes(series);

      if (newEpisode) {
        console.log(`🆕 Novo episódio encontrado: ${series.name} S${String(newEpisode.season).padStart(2, "0")}E${String(newEpisode.episode).padStart(2, "0")} - ${newEpisode.name}`);
        newEpisodes.push({
          series,
          episode: newEpisode,
        });
      }

      series.lastChecked = new Date().toISOString();

      // Delay para não sobrecarregar a API
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    this.saveTrackedSeries();
    return newEpisodes;
  }

  /**
   * Inicia o agendamento automático de verificações
   */
  startScheduler(onNewEpisode) {
    if (this.cronJob) {
      console.log("⚠️ Agendamento já está ativo");
      return;
    }

    const schedule = this.config.series.checkInterval;
    console.log(`⏰ Agendamento iniciado: ${schedule}`);

    this.cronJob = cron.schedule(schedule, async () => {
      console.log("\n⏰ Execução agendada - Verificando séries...");
      const newEpisodes = await this.checkAllSeries();

      if (newEpisodes.length > 0 && onNewEpisode) {
        for (const { series, episode } of newEpisodes) {
          await onNewEpisode(series, episode);
        }
      } else {
        console.log("✅ Nenhum novo episódio encontrado");
      }
    });
  }

  /**
   * Para o agendamento
   */
  stopScheduler() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log("⏹️ Agendamento parado");
    }
  }

  /**
   * Desativa uma série
   */
  deactivateSeries(seriesId) {
    const series = this.trackedSeries.find((s) => s.id === seriesId);
    if (series) {
      series.active = false;
      this.saveTrackedSeries();
      return true;
    }
    return false;
  }

  /**
   * Ativa uma série
   */
  activateSeries(seriesId) {
    const series = this.trackedSeries.find((s) => s.id === seriesId);
    if (series) {
      series.active = true;
      this.saveTrackedSeries();
      return true;
    }
    return false;
  }
}

export default SeriesTracker;
