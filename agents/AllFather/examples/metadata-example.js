import { AllFather } from "../index.js";

/**
 * Exemplo de uso dos métodos de metadata do AllFather
 * Testa busca de informações sobre músicas, filmes e séries
 */
async function main() {
  const allFather = new AllFather();

  console.log("🎯 Testando Métodos de Metadata do AllFather\n");
  console.log("=".repeat(80));

  try {
    // Verifica conexão com Ollama
    const isConnected = await allFather.checkConnection();
    if (!isConnected) {
      console.error("❌ Ollama não está rodando!");
      process.exit(1);
    }
    console.log("✅ Conectado ao Ollama\n");

    // ==========================================================================
    // TESTE 1: Metadata de Música
    // ==========================================================================
    console.log("\n" + "=".repeat(80));
    console.log("TESTE 1: Metadata de Música");
    console.log("=".repeat(80));
    console.log('Buscando metadata de: "Bohemian Rhapsody" por Queen\n');

    const musicMetadata = await allFather.getMusicMetadata("Bohemian Rhapsody", "Queen");

    if (musicMetadata) {
      console.log("✅ Metadata obtido:");
      console.log(JSON.stringify(musicMetadata, null, 2));
    } else {
      console.log("❌ Não foi possível obter metadata da música");
    }

    // ==========================================================================
    // TESTE 2: Metadata de Filme
    // ==========================================================================
    console.log("\n" + "=".repeat(80));
    console.log("TESTE 2: Metadata de Filme");
    console.log("=".repeat(80));
    console.log('Buscando metadata de: "The Matrix"\n');

    const movieMetadata = await allFather.getMovieMetadata("The Matrix");

    if (movieMetadata) {
      console.log("✅ Metadata obtido:");
      console.log(JSON.stringify(movieMetadata, null, 2));
    } else {
      console.log("❌ Não foi possível obter metadata do filme");
    }

    // ==========================================================================
    // TESTE 3: Metadata de Série
    // ==========================================================================
    console.log("\n" + "=".repeat(80));
    console.log("TESTE 3: Metadata de Série");
    console.log("=".repeat(80));
    console.log('Buscando metadata de: "Breaking Bad"\n');

    const seriesMetadata = await allFather.getSeriesMetadata("Breaking Bad");

    if (seriesMetadata) {
      console.log("✅ Metadata obtido:");
      console.log(JSON.stringify(seriesMetadata, null, 2));
    } else {
      console.log("❌ Não foi possível obter metadata da série");
    }

    // ==========================================================================
    // TESTE 4: Busca direta no IMDB
    // ==========================================================================
    console.log("\n" + "=".repeat(80));
    console.log("TESTE 4: Busca direta no IMDB");
    console.log("=".repeat(80));
    console.log('Buscando: "Inception"\n');

    const imdbResult = await allFather.searchIMDB("Inception");

    if (imdbResult) {
      console.log("✅ Resultado do IMDB:");
      console.log(`Título: ${imdbResult.title}`);
      console.log(`Ano: ${imdbResult.year}`);
      console.log(`Tipo: ${imdbResult.type}`);
      console.log(`URL: ${imdbResult.url}`);
    } else {
      console.log("❌ Não encontrado no IMDB");
    }

    // ==========================================================================
    // TESTE 5: Busca combinada Filme/Série (Wikipedia + IMDB)
    // ==========================================================================
    console.log("\n" + "=".repeat(80));
    console.log("TESTE 5: Busca Combinada (Wikipedia + IMDB)");
    console.log("=".repeat(80));
    console.log('Buscando: "Stranger Things"\n');

    const combinedResult = await allFather.searchMovieOrSeries("Stranger Things");

    console.log("✅ Resultado combinado:");

    if (combinedResult.imdb) {
      console.log("\n🎬 IMDB:");
      console.log(`  Título: ${combinedResult.imdb.title}`);
      console.log(`  Ano: ${combinedResult.imdb.year}`);
      console.log(`  Tipo: ${combinedResult.imdb.type}`);
    }

    if (combinedResult.wikipedia) {
      console.log("\n📚 Wikipedia:");
      console.log(`  Título: ${combinedResult.wikipedia.title}`);
      console.log(`  Resumo: ${combinedResult.wikipedia.summary.substring(0, 200)}...`);
    }

    // ==========================================================================
    // TESTE 6: Música com artista menos conhecido
    // ==========================================================================
    console.log("\n" + "=".repeat(80));
    console.log("TESTE 6: Música de artista conhecido");
    console.log("=".repeat(80));
    console.log('Buscando metadata de: "Imagine" por John Lennon\n');

    const musicMetadata2 = await allFather.getMusicMetadata("Imagine", "John Lennon");

    if (musicMetadata2) {
      console.log("✅ Metadata obtido:");
      console.log(JSON.stringify(musicMetadata2, null, 2));
    } else {
      console.log("❌ Não foi possível obter metadata da música");
    }

    console.log("\n" + "=".repeat(80));
    console.log("✅ Todos os testes concluídos!");
    console.log("=".repeat(80));
  } catch (error) {
    console.error("❌ Erro:", error.message);
    console.error(error);
  }
}

main();
