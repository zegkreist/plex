import dotenv from "dotenv";
import { AllFather } from "@plex-agents/allfather";
import { AlbumConsolidator } from "../src/album-consolidator.js";
import { exec } from "child_process";
import { promisify } from "util";

dotenv.config();

const execAsync = promisify(exec);

/**
 * CONSOLIDAÇÃO REAL do FLESHGOD APOCALYPSE com todas as correções aplicadas
 */
async function realFleshgodApocalypseConsolidation() {
  try {
    const artistPath = "/home/zegkreist/Documents/Pessoal/plex_server/music/Fleshgod Apocalypse";

    console.log("🎵 MusicCurador - CONSOLIDAÇÃO REAL FLESHGOD APOCALYPSE");
    console.log("=".repeat(80));
    console.log("⚠️  ATENÇÃO: CONSOLIDAÇÃO FÍSICA ATIVADA!");
    console.log("⚠️  Este script vai:");
    console.log("   - Corrigir permissões automaticamente");
    console.log("   - MOVER arquivos de música (sem duplicar)");
    console.log("   - Limpar numeração duplicada");
    console.log("   - Aplicar tag [CURATED] aos nomes");
    console.log("   - Remover pastas originais automaticamente");
    console.log("=".repeat(80));

    // Verifica se o diretório existe
    try {
      await execAsync(`ls "${artistPath}"`);
    } catch (error) {
      console.error(`❌ Diretório Fleshgod Apocalypse não encontrado: ${artistPath}`);
      process.exit(1);
    }

    // Verifica e corrige permissões
    console.log("\n🔧 Verificando permissões...");
    try {
      const { stdout } = await execAsync(`stat -c '%U' "${artistPath}"`);
      const owner = stdout.trim();
      console.log(`   Proprietário atual: ${owner}`);

      if (owner !== "zegkreist") {
        console.log("🔧 Corrigindo permissões...");
        await execAsync(`sudo chown -R zegkreist:zegkreist "${artistPath}"`);
        console.log("✅ Permissões corrigidas");
      } else {
        console.log("✅ Permissões já estão corretas");
      }
    } catch (error) {
      console.log("⚠️  Erro verificando permissões, tentando continuar...");
    }

    // Mostra estado inicial
    console.log("\n📂 Estado atual do diretório Fleshgod Apocalypse:");
    try {
      const { stdout } = await execAsync(`ls -la "${artistPath}"`);
      console.log(stdout.split("\n").slice(0, 15).join("\n")); // Primeiras 15 linhas
      if (stdout.split("\n").length > 15) {
        console.log("... (mais álbuns)");
      }
    } catch (error) {
      console.log("⚠️  Erro listando diretório");
    }

    // Inicializa AllFather
    console.log("\n🧠 Inicializando AllFather...");
    const allfather = new AllFather({
      ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
      model: process.env.OLLAMA_DEFAULT_MODEL || "deepseek-r1:7b",
      temperature: 0.1,
    });

    // Verifica conexão
    if (!(await allfather.checkConnection())) {
      console.error("❌ Ollama não está conectado. Execute: ollama serve");
      process.exit(1);
    }

    console.log("✅ AllFather conectado!");

    // Verifica modelo de visão
    const hasVision = await allfather.hasModel("llama3.2-vision");
    if (hasVision) {
      console.log("✅ Modelo de visão disponível");
    } else {
      console.log("⚠️  Modelo de visão não encontrado, usando apenas hashing");
    }

    console.log("🔧 Inicializando consolidador...");
    const consolidator = new AlbumConsolidator(allfather);

    // Configurações REAIS para Fleshgod Apocalypse
    const options = {
      dryRun: false, // ← CONSOLIDAÇÃO FÍSICA REAL!
      skipCurated: true, // Pula já curados
      similarityThreshold: 0.9, // Threshold alto para death metal sinfônico (covers muito distintas)
      normalizeToTitleCase: true, // Title Case + [CURATED]
    };

    console.log("\n⚙️  Configurações REAIS FLESHGOD APOCALYPSE:");
    console.log(`   - Consolidação física: ${!options.dryRun ? "✅ ATIVADA" : "❌ Desativada"}`);
    console.log(`   - Threshold similaridade: ${options.similarityThreshold * 100}%`);
    console.log(`   - Pular já curados: ${options.skipCurated ? "SIM" : "NÃO"}`);
    console.log(`   - Normalização Title Case: ${options.normalizeToTitleCase ? "SIM" : "NÃO"}`);

    console.log("\n🔥 MUDANÇAS QUE SERÃO APLICADAS:");
    console.log("   📦 Arquivos serão MOVIDOS (não copiados)");
    console.log("   🔢 Numeração limpa: '01 - Nome Limpo.flac'");
    console.log("   🏷️  Tag [CURATED] aplicada aos álbuns");
    console.log("   🗑️  Pastas originais removidas automaticamente");
    console.log("   🎺 Death metal sinfônico consolidado com precisão!");

    // Confirmação final
    console.log("\n❓ Confirma a consolidação física REAL do FLESHGOD APOCALYPSE?");
    console.log("💡 Aguardando 5 segundos... (Ctrl+C para cancelar)");

    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log("\n🚀 INICIANDO CONSOLIDAÇÃO FÍSICA REAL DO FLESHGOD APOCALYPSE...\n");

    // Executa consolidação REAL
    const result = await consolidator.consolidateArtistAlbums(artistPath, "Fleshgod Apocalypse", options);

    // Relatório detalhado
    console.log("\n" + "=".repeat(80));
    console.log("📊 RELATÓRIO FINAL - CONSOLIDAÇÃO REAL FLESHGOD APOCALYPSE");
    console.log("=".repeat(80));

    const groups = result.groups?.length || 0;
    const consolidations = result.consolidationResults?.length || 0;

    console.log(`📀 Grupos de álbuns similares encontrados: ${groups}`);
    console.log(`🔧 Consolidações executadas: ${consolidations}`);

    if (result.consolidationResults) {
      const successful = result.consolidationResults.filter((cr) => cr.result.success);
      const failed = result.consolidationResults.filter((cr) => !cr.result.success);
      const totalTracks = successful.reduce((sum, cr) => sum + (cr.result.movedTracks?.length || 0), 0);
      const removedFolders = successful.reduce((sum, cr) => sum + (cr.result.removedOriginalFolders?.length || 0), 0);

      console.log(`✅ Consolidações bem-sucedidas: ${successful.length}`);
      console.log(`❌ Consolidações com erro: ${failed.length}`);
      console.log(`🎵 Total de faixas reorganizadas: ${totalTracks}`);
      console.log(`🗑️  Pastas originais removidas: ${removedFolders}`);

      if (successful.length > 0) {
        console.log("\n🎺 ÁLBUNS DE DEATH METAL SINFÔNICO CONSOLIDADOS:");
        successful.forEach((cr, index) => {
          console.log(`   ${index + 1}. ✅ "${cr.correctName}"`);
          console.log(`      └── ${cr.result.movedTracks?.length || 0} faixas reorganizadas`);
          if (cr.result.removedOriginalFolders?.length > 0) {
            console.log(`      └── ${cr.result.removedOriginalFolders.length} pastas originais removidas`);
          }
        });
      }

      if (failed.length > 0) {
        console.log("\n💥 CONSOLIDAÇÕES COM ERRO:");
        failed.forEach((cr, index) => {
          console.log(`   ${index + 1}. ❌ "${cr.correctName}"`);
          console.log(`      └── Erro: ${cr.result.error}`);
        });
      }

      // Lista álbuns com tag CURATED
      try {
        const { stdout } = await execAsync(`ls -la "${artistPath}" | grep "\\[CURATED\\]"`);
        if (stdout.trim()) {
          console.log("\n🏷️  ÁLBUNS FLESHGOD APOCALYPSE COM TAG [CURATED]:");
          stdout.split("\n").forEach((line, index) => {
            if (line.includes("[CURATED]")) {
              const name = line.split(" ").slice(8).join(" ");
              console.log(`   ${index + 1}. 🎺 ${name}`);
            }
          });
        }
      } catch (e) {
        // Nenhum álbum curado encontrado ou erro no comando
      }
    } else {
      console.log("📀 Nenhuma consolidação foi necessária");
      console.log("💡 Todos os álbuns Fleshgod Apocalypse já estão organizados ou não há duplicatas");
    }

    // Estado final do diretório
    console.log("\n📂 Estado final do diretório Fleshgod Apocalypse:");
    try {
      const { stdout } = await execAsync(`ls -la "${artistPath}"`);
      const lines = stdout.split("\n").slice(2); // Remove . e ..
      const curated = lines.filter((line) => line.includes("[CURATED]"));
      const normal = lines.filter((line) => line.includes("drw") && !line.includes("[CURATED]"));

      if (curated.length > 0) {
        console.log(`   🏷️  ${curated.length} álbuns curados (consolidados)`);
      }
      if (normal.length > 0) {
        console.log(`   📀 ${normal.length} álbuns não processados`);
      }
    } catch (e) {
      console.log("⚠️  Erro listando estado final");
    }

    console.log("\n" + "=".repeat(80));
    console.log("🎺 CONSOLIDAÇÃO REAL DO FLESHGOD APOCALYPSE CONCLUÍDA!");
    console.log("💡 Verifique o diretório Fleshgod Apocalypse para confirmar as mudanças");
    console.log(`📂 Caminho: ${artistPath}`);
    console.log("🎼 Death metal sinfônico organizado com maestria!");
    console.log("=".repeat(80));
  } catch (error) {
    console.error("\n❌ ERRO CRÍTICO na consolidação:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

realFleshgodApocalypseConsolidation();
