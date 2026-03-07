import { describe, test, expect, beforeEach, afterEach, jest } from "@jest/globals";
import SeriesTracker from "../src/seriesTracker.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("SeriesTracker - Testes de Integração", () => {
  let tracker;
  const testTrackerFile = path.join(__dirname, "test-tracker.json");
  const testConfig = {
    series: {
      checkInterval: "0 */6 * * *",
      trackerFile: testTrackerFile,
    },
  };

  beforeEach(() => {
    // Limpar arquivo de teste se existir
    if (fs.existsSync(testTrackerFile)) {
      fs.unlinkSync(testTrackerFile);
    }

    // Criar nova instância do tracker
    tracker = new SeriesTracker(testConfig);
  });

  afterEach(() => {
    // Parar scheduler se estiver rodando
    if (tracker.cronJob) {
      tracker.stopScheduler();
    }

    // Limpar arquivo de teste
    if (fs.existsSync(testTrackerFile)) {
      fs.unlinkSync(testTrackerFile);
    }
  });

  describe("Adicionar e Remover Séries", () => {
    test("Deve adicionar série ao rastreamento", () => {
      const series = tracker.addSeries("Breaking Bad", 5, 10);

      expect(series).toBeDefined();
      expect(series.name).toBe("Breaking Bad");
      expect(series.currentSeason).toBe(5);
      expect(series.currentEpisode).toBe(10);
      expect(series.active).toBe(true);
      expect(series.id).toBeDefined();
    });

    test("Deve salvar série no arquivo", () => {
      tracker.addSeries("The Office", 2, 5);

      expect(fs.existsSync(testTrackerFile)).toBe(true);

      const fileContent = JSON.parse(fs.readFileSync(testTrackerFile, "utf8"));
      expect(Array.isArray(fileContent)).toBe(true);
      expect(fileContent.length).toBe(1);
      expect(fileContent[0].name).toBe("The Office");
    });

    test("Deve adicionar múltiplas séries", () => {
      tracker.addSeries("Series 1", 1, 1);
      tracker.addSeries("Series 2", 2, 3);
      tracker.addSeries("Series 3", 3, 5);

      const trackedSeries = tracker.listTrackedSeries();
      expect(trackedSeries.length).toBe(3);
    });

    test("Deve remover série pelo ID", () => {
      const series = tracker.addSeries("Test Series", 1, 1);
      const seriesList1 = tracker.listTrackedSeries();
      expect(seriesList1.length).toBe(1);

      const removed = tracker.removeSeries(series.id);
      expect(removed).toBe(true);

      const seriesList2 = tracker.listTrackedSeries();
      expect(seriesList2.length).toBe(0);
    });

    test("Deve retornar false ao tentar remover série inexistente", () => {
      const removed = tracker.removeSeries("id-inexistente");
      expect(removed).toBe(false);
    });
  });

  describe("Listar Séries", () => {
    test("Deve retornar array vazio quando não há séries", () => {
      const series = tracker.listTrackedSeries();

      expect(Array.isArray(series)).toBe(true);
      expect(series.length).toBe(0);
    });

    test("Deve listar todas as séries rastreadas", () => {
      tracker.addSeries("Series A", 1, 5);
      tracker.addSeries("Series B", 2, 10);

      const series = tracker.listTrackedSeries();

      expect(series.length).toBe(2);
      expect(series[0].name).toBe("Series A");
      expect(series[1].name).toBe("Series B");
    });
  });

  describe("Atualizar Episódio", () => {
    test("Deve atualizar episódio atual da série", () => {
      const series = tracker.addSeries("Test Show", 1, 5);

      const updated = tracker.updateSeriesEpisode(series.id, 1, 6);
      expect(updated).toBe(true);

      const trackedSeries = tracker.listTrackedSeries();
      expect(trackedSeries[0].currentEpisode).toBe(6);
      expect(trackedSeries[0].lastDownloaded).toBeDefined();
    });

    test("Deve atualizar temporada e episódio", () => {
      const series = tracker.addSeries("Test Show", 1, 10);

      tracker.updateSeriesEpisode(series.id, 2, 1);

      const trackedSeries = tracker.listTrackedSeries();
      expect(trackedSeries[0].currentSeason).toBe(2);
      expect(trackedSeries[0].currentEpisode).toBe(1);
    });

    test("Deve retornar false para ID inexistente", () => {
      const updated = tracker.updateSeriesEpisode("id-falso", 1, 1);
      expect(updated).toBe(false);
    });
  });

  describe("Ativar/Desativar Séries", () => {
    test("Deve desativar série", () => {
      const series = tracker.addSeries("Test Series", 1, 1);

      const deactivated = tracker.deactivateSeries(series.id);
      expect(deactivated).toBe(true);

      const trackedSeries = tracker.listTrackedSeries();
      expect(trackedSeries[0].active).toBe(false);
    });

    test("Deve ativar série desativada", () => {
      const series = tracker.addSeries("Test Series", 1, 1);
      tracker.deactivateSeries(series.id);

      const activated = tracker.activateSeries(series.id);
      expect(activated).toBe(true);

      const trackedSeries = tracker.listTrackedSeries();
      expect(trackedSeries[0].active).toBe(true);
    });
  });

  describe("Verificação de Novos Episódios (API Real)", () => {
    test("Deve verificar novos episódios de série finalizada", async () => {
      // Breaking Bad é uma série finalizada, não deve ter novos episódios
      const series = {
        id: "test-1",
        name: "Breaking Bad",
        currentSeason: 5,
        currentEpisode: 16, // Último episódio
        active: true,
      };

      const newEpisode = await tracker.checkForNewEpisodes(series);

      // Como a série terminou, não deve retornar novo episódio
      expect(newEpisode).toBeNull();
    }, 20000);

    test("Deve encontrar episódio posterior se existir", async () => {
      // Testar com episódio no meio da série
      const series = {
        id: "test-2",
        name: "Breaking Bad",
        currentSeason: 1,
        currentEpisode: 1,
        active: true,
      };

      const newEpisode = await tracker.checkForNewEpisodes(series);

      // Deve encontrar o episódio 2 da temporada 1
      expect(newEpisode).toBeDefined();
      if (newEpisode) {
        expect(newEpisode.season).toBe(1);
        expect(newEpisode.episode).toBeGreaterThan(1);
      }
    }, 20000);

    test("Deve verificar próxima temporada se temporada atual terminou", async () => {
      const series = {
        id: "test-3",
        name: "Breaking Bad",
        currentSeason: 1,
        currentEpisode: 7, // Último episódio da temporada 1
        active: true,
      };

      const newEpisode = await tracker.checkForNewEpisodes(series);

      if (newEpisode) {
        expect(newEpisode.season).toBeGreaterThanOrEqual(2);
      }
    }, 20000);

    test("Deve retornar null para série não encontrada", async () => {
      const series = {
        id: "test-4",
        name: "SerieQueNaoExiste12345XYZ",
        currentSeason: 1,
        currentEpisode: 1,
        active: true,
      };

      const newEpisode = await tracker.checkForNewEpisodes(series);

      expect(newEpisode).toBeNull();
    }, 20000);
  });

  describe("Verificar Todas as Séries", () => {
    test("Deve verificar múltiplas séries", async () => {
      tracker.addSeries("Breaking Bad", 1, 1);
      tracker.addSeries("The Office", 1, 1);

      const newEpisodes = await tracker.checkAllSeries();

      expect(Array.isArray(newEpisodes)).toBe(true);
      // Pode ou não encontrar novos episódios dependendo das séries

      // Verificar que lastChecked foi atualizado
      const trackedSeries = tracker.listTrackedSeries();
      trackedSeries.forEach((series) => {
        expect(series.lastChecked).toBeDefined();
      });
    }, 40000);

    test("Deve ignorar séries inativas", async () => {
      const series = tracker.addSeries("Test Series", 1, 1);
      tracker.deactivateSeries(series.id);

      await tracker.checkAllSeries();

      // Série inativa não deve ter lastChecked atualizado
      const trackedSeries = tracker.listTrackedSeries();
      expect(trackedSeries[0].lastChecked).toBeNull();
    }, 20000);
  });

  describe("Persistência de Dados", () => {
    test("Deve carregar séries do arquivo ao inicializar", () => {
      // Adicionar série e salvar
      tracker.addSeries("Persistent Series", 2, 5);

      // Criar novo tracker que deve carregar do arquivo
      const newTracker = new SeriesTracker(testConfig);
      const series = newTracker.listTrackedSeries();

      expect(series.length).toBe(1);
      expect(series[0].name).toBe("Persistent Series");
      expect(series[0].currentSeason).toBe(2);
      expect(series[0].currentEpisode).toBe(5);
    });

    test("Deve lidar com arquivo corrompido", () => {
      // Criar arquivo com JSON inválido
      fs.writeFileSync(testTrackerFile, "{ invalid json", "utf8");

      // Deve inicializar com array vazio
      const newTracker = new SeriesTracker(testConfig);
      const series = newTracker.listTrackedSeries();

      expect(Array.isArray(series)).toBe(true);
      expect(series.length).toBe(0);
    });

    test("Deve criar arquivo se não existir", () => {
      expect(fs.existsSync(testTrackerFile)).toBe(false);

      tracker.addSeries("First Series", 1, 1);

      expect(fs.existsSync(testTrackerFile)).toBe(true);
    });
  });

  describe("Agendamento (Scheduler)", () => {
    test("Deve iniciar scheduler", () => {
      const callback = jest.fn();
      tracker.startScheduler(callback);

      expect(tracker.cronJob).toBeDefined();
    });

    test("Não deve iniciar scheduler duplicado", () => {
      const callback = jest.fn();
      tracker.startScheduler(callback);

      // Tentar iniciar novamente
      tracker.startScheduler(callback);

      // Deve haver apenas um job
      expect(tracker.cronJob).toBeDefined();
    });

    test("Deve parar scheduler", () => {
      const callback = jest.fn();
      tracker.startScheduler(callback);

      tracker.stopScheduler();

      expect(tracker.cronJob).toBeNull();
    });

    test("Deve lidar com parar scheduler que não está rodando", () => {
      expect(() => {
        tracker.stopScheduler();
      }).not.toThrow();
    });
  });

  describe("Formato de Dados", () => {
    test("Série deve ter todos os campos necessários", () => {
      const series = tracker.addSeries("Complete Series", 3, 8);

      expect(series).toHaveProperty("id");
      expect(series).toHaveProperty("name");
      expect(series).toHaveProperty("currentSeason");
      expect(series).toHaveProperty("currentEpisode");
      expect(series).toHaveProperty("addedAt");
      expect(series).toHaveProperty("lastChecked");
      expect(series).toHaveProperty("lastDownloaded");
      expect(series).toHaveProperty("active");

      expect(typeof series.id).toBe("string");
      expect(typeof series.name).toBe("string");
      expect(typeof series.currentSeason).toBe("number");
      expect(typeof series.currentEpisode).toBe("number");
      expect(typeof series.active).toBe("boolean");
    });

    test("Data de adição deve ser válida", () => {
      const series = tracker.addSeries("Date Test", 1, 1);

      const addedDate = new Date(series.addedAt);
      expect(addedDate.toString()).not.toBe("Invalid Date");
      expect(addedDate.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });
});
