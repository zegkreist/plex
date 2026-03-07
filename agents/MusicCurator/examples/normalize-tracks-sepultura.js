import dotenv from "dotenv";
import { AllFather } from "@plex-agents/allfather";
import { AlbumConsolidator } from "../src/album-consolidator.js";
import { exec } from "child_process";
import { promisify } from "util";

dotenv.config();

const execAsync = promisify(exec);

/**
 * TESTE REAL de NORMALIZAÇÃO COMPLETA do SEPULTURA
 * Este script testa a nova funcionalidade de normalização completa que:
 * 1. Verifica nomes corretos dos álbuns via AllFather
 * 2. Renomeia pastas de álbuns se necessário
 * 3. Normaliza numeração de tracks mesmo quando não há duplicatas para consolidar
 */
async function realSepulturaNormalization() {
  try {
    const artistPath = "/home/zegkreist/Documents/Pessoal/plex_server/music/Sepultura";

    console.log("🎵 MusicCurador - TESTE NORMALIZAÇÃO COMPLETA SEPULTURA");
    console.log("=".repeat(80));
    console.log("⚠️  ATENÇÃO: NORMALIZAÇÃO COMPLETA ATIVADA!");
    console.log("⚠️  Este script vai:");
    console.log("   - Corrigir permissões automaticamente");
    console.log("   - Verificar nomes corretos dos álbuns via AllFather");
    console.log("   - Renomear pastas de álbuns se necessário");
    console.log("   - Normalizar numeração de faixas (01, 02, 03...)");
    console.log("   - Limpar numerações bagunçadas (102, Track 05, etc.)");
    console.log("   - RENOMEAR arquivos de música (sem duplicar)");
    console.log("   - Aplicar tags [CURATED] aos álbuns normalizados");
    console.log("=".repeat(80));

    // Verifica se o diretório existe
    try {
      await execAsync(`ls "${artistPath}"`);
    } catch (error) {
      console.error(`❌ Diretório Sepultura não encontrado: ${artistPath}`);
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

    // Mostra estado inicial das faixas
    console.log("\n📂 Estado atual das faixas (primeiras por álbum):");
    try {
      const { stdout } = await execAsync(`find "${artistPath}" -name "*.flac" -o -name "*.mp3" -o -name "*.mp4" | head -20`);
      stdout.split("\n").forEach((file, index) => {
        if (file.trim()) {
          const trackName = file.split("/").pop();
          console.log(`   ${index + 1}. ${trackName}`);
        }
      });
      console.log("   ... (mais faixas)");
    } catch (error) {
      console.log("⚠️  Erro listando faixas");
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

    // Configurações para NORMALIZAÇÃO COMPLETA
    const options = {
      dryRun: false, // ← NORMALIZAÇÃO FÍSICA REAL!
      skipCurated: true, // Pula já curados (mantém álbuns processados)
      similarityThreshold: 0.5, // Threshold baixo para detectar Ratamahatta e Itsari
      normalizeToTitleCase: true, // Title Case + [CURATED]
      normalizeAllTracks: true, // ← NORMALIZAÇÃO COMPLETA! Verifica nomes via AllFather + tracks
    };

    console.log("\n⚙️  Configurações NORMALIZAÇÃO COMPLETA:");
    console.log(`   - Normalização física: ${!options.dryRun ? "✅ ATIVADA" : "❌ Desativada"}`);
    console.log(`   - Threshold similaridade: ${options.similarityThreshold * 100}% (reduzido para detectar Ratamahatta/Itsari)`);
    console.log(`   - Pular já curados: ${options.skipCurated ? "SIM" : "NÃO"}`);
    console.log(`   - Normalização Title Case: ${options.normalizeToTitleCase ? "SIM" : "NÃO"}`);
    console.log(`   - Verificação via AllFather: ${options.normalizeAllTracks ? "✅ SIM" : "NÃO"}`);

    console.log("\n🔥 NORMALIZAÇÃO COMPLETA QUE SERÁ APLICADA:");
    console.log("   🧠 AllFather verifica nomes corretos dos álbuns");
    console.log("   📂 Pastas de álbuns renomeadas com nomes corretos");
    console.log("   📦 Faixas serão RENOMEADAS fisicamente");
    console.log("   🔢 Numeração limpa: '01 - Nome.flac', '02 - Nome.flac'...");
    console.log("   🧹 Remove números bagunçados: '102 - ', 'Track 05 - ', etc.");
    console.log("   🏷️  Tag [CURATED] aplicada aos álbuns normalizados");
    console.log("   🤘 Álbuns de metal completamente organizados!");

    // Confirmação final
    console.log("\n❓ Confirma a normalização completa física REAL do SEPULTURA?");
    console.log("💡 Aguardando 5 segundos... (Ctrl+C para cancelar)");

    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log("\n🚀 INICIANDO NORMALIZAÇÃO COMPLETA FÍSICA REAL...\n");

    // Executa normalização REAL (verifica nomes via AllFather + normaliza tracks)
    const result = await consolidator.consolidateArtistAlbums(artistPath, "Sepultura", options);

    // Mostra resultado final das faixas renomeadas
    console.log("\n📂 Estado final das faixas (amostra):");
    try {
      const { stdout } = await execAsync(`find "${artistPath}" -name "*.flac" -o -name "*.mp3" -o -name "*.mp4" | head -20`);
      stdout.split("\n").forEach((file, index) => {
        if (file.trim()) {
          const trackName = file.split("/").pop();
          console.log(`   ${index + 1}. ${trackName}`);
        }
      });
      console.log("   ... (mais faixas)");
    } catch (e) {
      console.log("⚠️  Erro listando faixas finais");
    }

    // Estado final do diretório
    console.log("\n📂 Estado final do diretório Sepultura:");
    try {
      const { stdout } = await execAsync(`ls -la "${artistPath}"`);
      const lines = stdout.split("\n").slice(2); // Remove . e ..
      const curated = lines.filter((line) => line.includes("[CURATED]"));
      const normal = lines.filter((line) => line.includes("drw") && !line.includes("[CURATED]"));

      if (curated.length > 0) {
        console.log(`   🏷️  ${curated.length} álbuns curados (normalizados)`);
      }
      if (normal.length > 0) {
        console.log(`   📀 ${normal.length} álbuns não processados`);
      }
    } catch (e) {
      console.log("⚠️  Erro listando estado final");
    }

    console.log("\n" + "=".repeat(80));
    console.log("🤘 NORMALIZAÇÃO COMPLETA DO SEPULTURA CONCLUÍDA!");
    console.log("💡 Nomes de álbuns verificados via AllFather e tracks renumeradas");
    console.log(`📂 Caminho: ${artistPath}`);
    console.log("🎸 Álbuns de metal completamente organizados!");
    console.log("=".repeat(80));
  } catch (error) {
    console.error("\n❌ ERRO CRÍTICO na normalização:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

realSepulturaNormalization();
