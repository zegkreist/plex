import dotenv from "dotenv";
import { AllFather } from "@plex-agents/allfather";

dotenv.config();

/**
 * TESTE DIRETO com AllFather para descobrir nome do álbum
 */
async function discoverCorrectAlbumName() {
  try {
    console.log("🧠 DESCOBRINDO NOME CORRETO DO ÁLBUM");
    console.log("=".repeat(50));

    const allfather = new AllFather({
      ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
      model: process.env.OLLAMA_DEFAULT_MODEL || "deepseek-r1:7b",
      temperature: 0.1,
    });

    if (!(await allfather.checkConnection())) {
      console.error("❌ Ollama não está conectado");
      process.exit(1);
    }

    console.log("✅ AllFather conectado!");

    // Teste com as duas músicas
    const tracks = ["Ratamahatta", "Itsári"];

    for (const track of tracks) {
      console.log(`\n🎵 Consultando: "${track}" do Sepultura`);

      try {
        const result = await allfather.getMusicMetadata(track, "Sepultura", {
          includeLyrics: false,
          includeGenre: true,
        });

        if (result && result.album) {
          console.log(`📀 Álbum encontrado: "${result.album}"`);
          console.log(`📅 Ano: ${result.year || "N/A"}`);
          console.log(`🎸 Gênero: ${result.genre || "N/A"}`);
        } else {
          console.log("⚠️  Nenhum metadado retornado");
        }
      } catch (error) {
        console.log(`❌ Erro: ${error.message}`);
      }
    }

    // Teste com query mais específica sobre o álbum
    console.log(`\n🔍 Consulta direta sobre álbum que contém ambas as músicas...`);

    try {
      const query = "Qual álbum do Sepultura contém as músicas Ratamahatta e Itsári?";
      const response = await allfather.query(query);

      console.log(`💭 Resposta do AllFather:`);
      console.log(response);
    } catch (error) {
      console.log(`❌ Erro na consulta: ${error.message}`);
    }

    console.log("\n" + "=".repeat(50));
  } catch (error) {
    console.error("❌ ERRO:", error.message);
    process.exit(1);
  }
}

discoverCorrectAlbumName();
