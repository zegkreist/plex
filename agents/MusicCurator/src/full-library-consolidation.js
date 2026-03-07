import dotenv from "dotenv";
import { AllFather } from "@plex-agents/allfather";
import { AlbumConsolidator } from "./album-consolidator.js";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const execAsync = promisify(exec);

/**
 * CONSOLIDAÇÃO COMPLETA DE TODA A BIBLIOTECA MUSICAL
 *
 * Este script processa TODOS os artistas da biblioteca fazendo:
 * - Consolidação de álbuns duplicados
 * - Correção de numeração de faixas
 * - Verificação e correção de nomes de álbuns via AllFather
 * - Aplicação de tags [CURATED]
 */
class FullLibraryConsolidator {
  constructor(musicPathArg = null) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const PLEX_SERVER_ROOT = path.resolve(__dirname, "../../..");
    // Se argumento fornecido, resolve relativo ao projeto
    if (musicPathArg) {
      this.musicPath = path.resolve(PLEX_SERVER_ROOT, musicPathArg);
    } else {
      this.musicPath = process.env.MUSIC_PATH || path.join(PLEX_SERVER_ROOT, "music");
    }
    this.allfather = null;
    this.consolidator = null;

    // Configurações por defaut
    this.defaultOptions = {
      dryRun: false, // ← CONSOLIDAÇÃO FÍSICA REAL!
      skipCurated: true, // Pula álbuns já curados
      similarityThreshold: 0.85, // Threshold padrão para similaridade
      normalizeToTitleCase: true, // Title Case + [CURATED]
      normalizeAllTracks: true, // Verificação completa de nomes + tracks
    };

    // Configurações específicas por gênero/tipo
    this.genreSpecificOptions = {
      metal: { similarityThreshold: 0.8 }, // Metal pode ter variações de cover
      rock: { similarityThreshold: 0.85 }, // Rock padrão
      pop: { similarityThreshold: 0.9 }, // Pop geralmente mais uniforme
      classical: { similarityThreshold: 0.95 }, // Clássica muito específica
      electronic: { similarityThreshold: 0.75 }, // Eletrônica pode ter remixes
    };

    // Artistas para pular (opcional)
    this.skipArtists = [
      // Adicione aqui artistas que devem ser pulados
      // "Exemplo Artista",
    ];

    // Estatísticas
    this.stats = {
      totalArtists: 0,
      processedArtists: 0,
      skippedArtists: 0,
      totalConsolidations: 0,
      totalNormalizations: 0,
      totalErrors: 0,
      startTime: null,
      endTime: null,
    };
  }

  /**
   * Inicializa AllFather e Consolidator
   */
  async initialize() {
    console.log("🎵 CONSOLIDAÇÃO COMPLETA DA BIBLIOTECA MUSICAL");
    console.log("=".repeat(90));
    console.log("🚀 Este script vai processar TODOS os artistas da biblioteca!");
    console.log("⚠️  ATENÇÃO: CONSOLIDAÇÃO FÍSICA ATIVADA!");
    console.log("");
    console.log("📋 O que será feito:");
    console.log("   🔍 Escanear todos os artistas");
    console.log("   🧠 Verificar nomes corretos de álbuns via AllFather");
    console.log("   📂 Consolidar álbuns duplicados");
    console.log("   🔢 Normalizar numeração de faixas");
    console.log("   🏷️  Aplicar tags [CURATED]");
    console.log("   📊 Gerar relatório completo");
    console.log("=".repeat(90));

    // Verifica se a pasta de música existe
    try {
      await fs.access(this.musicPath);
      console.log(`📂 Pasta de música encontrada: ${this.musicPath}`);
    } catch (error) {
      console.error(`❌ Pasta de música não encontrada: ${this.musicPath}`);
      process.exit(1);
    }

    // Inicializa AllFather
    console.log("\n🧠 Inicializando AllFather...");
    this.allfather = new AllFather({
      ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
      model: process.env.OLLAMA_DEFAULT_MODEL || "deepseek-r1:7b",
      temperature: 0.1,
    });

    if (!(await this.allfather.checkConnection())) {
      console.error("❌ Ollama não está conectado. Execute: ollama serve");
      process.exit(1);
    }

    console.log("✅ AllFather conectado!");

    // Verifica modelo de visão
    const hasVision = await this.allfather.hasModel("llama3.2-vision");
    if (hasVision) {
      console.log("✅ Modelo de visão disponível para análise de covers");
    } else {
      console.log("⚠️  Modelo de visão não encontrado, usando apenas hashing");
    }

    // Inicializa consolidador
    this.consolidator = new AlbumConsolidator(this.allfather);
    console.log("✅ Consolidador inicializado!");
  }

  /**
   * Encontra todos os artistas na biblioteca
   */
  async findAllArtists() {
    console.log("\n🔍 Escaneando artistas na biblioteca...");

    const artists = [];

    try {
      const entries = await fs.readdir(this.musicPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const artistPath = path.join(this.musicPath, entry.name);

          // Verifica se tem álbuns
          try {
            const albumEntries = await fs.readdir(artistPath, { withFileTypes: true });
            const hasAlbums = albumEntries.some((e) => e.isDirectory());

            if (hasAlbums) {
              artists.push({
                name: entry.name,
                path: artistPath,
              });
            }
          } catch (error) {
            console.log(`⚠️  Erro escaneando ${entry.name}: ${error.message}`);
          }
        }
      }

      this.stats.totalArtists = artists.length;
      console.log(`📊 Encontrados ${artists.length} artistas para processar`);

      if (this.skipArtists.length > 0) {
        console.log(`⏭️  ${this.skipArtists.length} artistas configurados para pular`);
      }

      return artists.sort((a, b) => a.name.localeCompare(b.name)); // Ordem alfabética
    } catch (error) {
      console.error(`❌ Erro escaneando biblioteca: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Determina configurações específicas para um artista
   */
  getArtistOptions(artistName) {
    const options = { ...this.defaultOptions };

    // Tenta detectar gênero pelo nome do artista (heurística simples)
    const name = artistName.toLowerCase();

    if (name.includes("sepultura") || name.includes("metallica") || name.includes("iron maiden")) {
      return { ...options, ...this.genreSpecificOptions.metal };
    }

    if (name.includes("beethoven") || name.includes("mozart") || name.includes("bach")) {
      return { ...options, ...this.genreSpecificOptions.classical };
    }

    if (name.includes("daft punk") || name.includes("deadmau5")) {
      return { ...options, ...this.genreSpecificOptions.electronic };
    }

    // Configuração padrão para a maioria dos artistas
    return options;
  }

  /**
   * Processa um artista individual
   */
  async processArtist(artist) {
    const startTime = Date.now();

    console.log(`\n${"=".repeat(60)}`);
    console.log(`🎤 PROCESSANDO: ${artist.name}`);
    console.log(`${"=".repeat(60)}`);

    // Verifica se deve pular
    if (this.skipArtists.includes(artist.name)) {
      console.log(`⏭️  Pulando artista (configurado para pular): ${artist.name}`);
      this.stats.skippedArtists++;
      return { skipped: true, reason: "Configurado para pular" };
    }

    try {
      // Corrige permissões se necessário
      try {
        const { stdout } = await execAsync(`stat -c '%U' "${artist.path}"`);
        const owner = stdout.trim();

        if (owner !== "zegkreist") {
          console.log("🔧 Corrigindo permissões...");
          await execAsync(`sudo chown -R zegkreist:zegkreist "${artist.path}"`);
          console.log("✅ Permissões corrigidas");
        }
      } catch (error) {
        console.log("⚠️  Não foi possível verificar permissões, tentando continuar...");
      }

      // Determina configurações para este artista
      const options = this.getArtistOptions(artist.name);

      console.log(`⚙️  Configurações para ${artist.name}:`);
      console.log(`   - Threshold similaridade: ${options.similarityThreshold * 100}%`);
      console.log(`   - Verificação via AllFather: ${options.normalizeAllTracks ? "SIM" : "NÃO"}`);

      // Executa consolidação completa
      const result = await this.consolidator.consolidateArtistAlbums(artist.path, artist.name, options);

      // Processa resultados
      let consolidations = 0;
      let normalizations = 0;
      let errors = 0;

      if (result.consolidationResults) {
        consolidations = result.consolidationResults.filter((cr) => cr.result.success).length;
        errors += result.consolidationResults.filter((cr) => !cr.result.success).length;
      }

      if (result.normalizationResults) {
        normalizations = result.normalizationResults.filter((nr) => nr.result.success).length;
        errors += result.normalizationResults.filter((nr) => !nr.result.success).length;
      }

      // Atualiza estatísticas
      this.stats.totalConsolidations += consolidations;
      this.stats.totalNormalizations += normalizations;
      this.stats.totalErrors += errors;
      this.stats.processedArtists++;

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`\n📊 RESUMO ${artist.name}:`);
      console.log(`   ✅ Consolidações: ${consolidations}`);
      console.log(`   🔧 Normalizações: ${normalizations}`);
      console.log(`   ❌ Erros: ${errors}`);
      console.log(`   ⏱️  Tempo: ${duration}s`);

      return {
        success: true,
        consolidations,
        normalizations,
        errors,
        duration: parseFloat(duration),
      };
    } catch (error) {
      console.error(`💥 ERRO CRÍTICO processando ${artist.name}: ${error.message}`);
      this.stats.totalErrors++;
      this.stats.processedArtists++;

      return {
        success: false,
        error: error.message,
        duration: (Date.now() - startTime) / 1000,
      };
    }
  }

  /**
   * Executa consolidação completa da biblioteca
   */
  async run() {
    this.stats.startTime = new Date();

    console.log(`\n🚀 INICIANDO CONSOLIDAÇÃO COMPLETA EM: ${this.stats.startTime.toLocaleString()}`);
    console.log(`📂 Diretório: ${this.musicPath}`);

    // Inicializa
    await this.initialize();

    // Encontra artistas
    const artists = await this.findAllArtists();

    if (artists.length === 0) {
      console.log("⚠️  Nenhum artista encontrado para processar");
      process.exit(0);
    }

    // Confirmação final
    console.log("\n" + "⚠️".repeat(30));
    console.log("🚨 ATENÇÃO: CONSOLIDAÇÃO FÍSICA EM TODA A BIBLIOTECA!");
    console.log(`📊 ${artists.length} artistas serão processados`);
    console.log("🔄 Este processo pode demorar MUITO tempo");
    console.log("💾 Mudanças serão aplicadas fisicamente aos arquivos");
    console.log("⚠️".repeat(30));

    console.log("\n❓ Confirma a consolidação completa da biblioteca?");
    console.log("💡 Aguardando 10 segundos para confirmação... (Ctrl+C para cancelar)");

    await new Promise((resolve) => setTimeout(resolve, 10000));

    console.log("\n🎯 INICIANDO PROCESSAMENTO DE TODOS OS ARTISTAS...\n");

    // Processa cada artista
    const results = [];

    for (let i = 0; i < artists.length; i++) {
      const artist = artists[i];

      console.log(`\n📍 Progresso: ${i + 1}/${artists.length} (${(((i + 1) / artists.length) * 100).toFixed(1)}%)`);

      const result = await this.processArtist(artist);
      results.push({ artist: artist.name, result });
    }

    this.stats.endTime = new Date();

    // Gera relatório final
    await this.generateFinalReport(results);
  }

  /**
   * Gera relatório final da consolidação
   */
  async generateFinalReport(results) {
    const duration = (this.stats.endTime - this.stats.startTime) / 1000 / 60; // minutos

    console.log("\n" + "=".repeat(90));
    console.log("📊 RELATÓRIO FINAL - CONSOLIDAÇÃO COMPLETA DA BIBLIOTECA");
    console.log("=".repeat(90));

    console.log(`⏱️  Tempo total: ${duration.toFixed(1)} minutos`);
    console.log(`📊 Artistas totais: ${this.stats.totalArtists}`);
    console.log(`✅ Artistas processados: ${this.stats.processedArtists}`);
    console.log(`⏭️  Artistas pulados: ${this.stats.skippedArtists}`);
    console.log(`🔧 Total de consolidações: ${this.stats.totalConsolidations}`);
    console.log(`📝 Total de normalizações: ${this.stats.totalNormalizations}`);
    console.log(`❌ Total de erros: ${this.stats.totalErrors}`);

    // Top artistas por atividade
    const successfulResults = results.filter((r) => r.result.success && !r.result.skipped).sort((a, b) => b.result.consolidations + b.result.normalizations - (a.result.consolidations + a.result.normalizations));

    if (successfulResults.length > 0) {
      console.log("\n🏆 TOP 10 ARTISTAS MAIS PROCESSADOS:");
      successfulResults.slice(0, 10).forEach((r, i) => {
        const total = r.result.consolidations + r.result.normalizations;
        console.log(`   ${i + 1}. ${r.artist} - ${total} ações (${r.result.duration}s)`);
      });
    }

    // Erros encontrados
    const failedResults = results.filter((r) => !r.result.success);
    if (failedResults.length > 0) {
      console.log("\n💥 ARTISTAS COM ERRO:");
      failedResults.forEach((r) => {
        console.log(`   ❌ ${r.artist} - ${r.result.error}`);
      });
    }

    // Artistas pulados
    const skippedResults = results.filter((r) => r.result.skipped);
    if (skippedResults.length > 0) {
      console.log("\n⏭️  ARTISTAS PULADOS:");
      skippedResults.forEach((r) => {
        console.log(`   ⏭️  ${r.artist} - ${r.result.reason}`);
      });
    }

    console.log("\n🎉 CONSOLIDAÇÃO COMPLETA DA BIBLIOTECA FINALIZADA!");
    console.log(`📅 Concluída em: ${this.stats.endTime.toLocaleString()}`);
    console.log(`🎵 Sua biblioteca musical está agora completamente organizada!`);
    console.log("=".repeat(90));

    // Salva relatório em arquivo
    await this.saveReportToFile(results, duration);
  }

  /**
   * Salva relatório em arquivo
   */
  async saveReportToFile(results, durationMinutes) {
    const reportPath = path.join(process.cwd(), `consolidation-report-${new Date().toISOString().split("T")[0]}.json`);

    const report = {
      timestamp: this.stats.endTime.toISOString(),
      durationMinutes: Math.round(durationMinutes * 100) / 100,
      statistics: this.stats,
      results: results,
      configuration: {
        defaultOptions: this.defaultOptions,
        genreSpecificOptions: this.genreSpecificOptions,
        skipArtists: this.skipArtists,
      },
    };

    try {
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf-8");
      console.log(`💾 Relatório salvo em: ${reportPath}`);
    } catch (error) {
      console.log(`⚠️  Erro salvando relatório: ${error.message}`);
    }
  }
}

export { FullLibraryConsolidator };

// Executa a consolidação apenas quando o arquivo é chamado diretamente
// Exemplo: node src/full-library-consolidation.js
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  // Permite passar caminho relativo como argumento
  const musicPathArg = process.argv[2] || null;
  const consolidator = new FullLibraryConsolidator(musicPathArg);
  consolidator.run().catch((error) => {
    console.error("💥 ERRO FATAL:", error);
    process.exit(1);
  });
}
