import { AllFather } from "../index.js";

/**
 * Exemplo de como um agente pode usar a busca web do AllFather
 */

class ExampleMusicAgent {
  constructor() {
    this.allfather = new AllFather();
  }

  /**
   * Enriquece informações sobre um artista usando busca web
   */
  async enrichArtistInfo(artistName) {
    console.log(`\n🎵 Enriquecendo informações sobre: ${artistName}\n`);

    try {
      // Busca informações na Wikipedia
      console.log("📚 Buscando na Wikipedia...");
      const wikiInfo = await this.allfather.searchWikipedia(artistName);

      if (wikiInfo) {
        console.log(`✅ Encontrado: ${wikiInfo.title}`);
        console.log(`📄 Resumo: ${wikiInfo.summary.substring(0, 200)}...`);
        console.log(`🔗 URL: ${wikiInfo.url}\n`);
      } else {
        console.log("❌ Não encontrado na Wikipedia\n");
      }

      // Usa o AI para analisar e resumir as informações
      if (wikiInfo) {
        console.log("🤖 Gerando resumo com IA...");
        const formattedResults = this.allfather.formatSearchResults(wikiInfo);

        const summary = await this.allfather.ask(
          `Com base nas informações abaixo sobre ${artistName}, crie um resumo focado em:
- Principais álbuns e sucessos
- Gênero musical
- Período de atividade
- Curiosidades relevantes

Informações:
${formattedResults}

Responda de forma concisa e objetiva.`,
        );

        console.log("\n📝 Resumo Gerado:");
        console.log(summary);

        return {
          artist: artistName,
          wikipedia: wikiInfo,
          aiSummary: summary,
        };
      } else {
        return {
          artist: artistName,
          wikipedia: null,
          aiSummary: null,
        };
      }
    } catch (error) {
      console.error("❌ Erro ao enriquecer informações:", error.message);
      throw error;
    }
  }

  /**
   * Verifica se um nome de artista está correto
   */
  async verifyArtistName(possibleName) {
    console.log(`\n🔍 Verificando nome: "${possibleName}"\n`);

    // Busca na Wikipedia para confirmar
    const wikiResult = await this.allfather.searchWikipedia(possibleName);

    if (wikiResult) {
      console.log(`✅ Nome correto: ${wikiResult.title}`);
      return {
        isValid: true,
        correctName: wikiResult.title,
        info: wikiResult,
      };
    }

    console.log("❌ Nome não encontrado na Wikipedia");
    return {
      isValid: false,
      correctName: null,
      info: null,
    };
  }

  /**
   * Detecta gênero musical usando busca na Wikipedia
   */
  async detectGenreFromWeb(artistName) {
    console.log(`\n🎸 Detectando gênero de: ${artistName}\n`);

    const wikiResult = await this.allfather.searchWikipedia(artistName);

    if (!wikiResult) {
      console.log("❌ Artista não encontrado na Wikipedia");
      return null;
    }

    const formatted = this.allfather.formatSearchResults(wikiResult);

    const genre = await this.allfather.ask(
      `Com base nas informações abaixo, identifique o(s) gênero(s) musical(is) de ${artistName}.
Responda APENAS com o(s) gênero(s), separados por vírgula.

${formatted}`,
    );

    console.log(`🎵 Gênero(s): ${genre}`);
    return genre.trim();
  }
}

// Executa exemplos
async function main() {
  console.log("🧪 Exemplo de Agente usando Web Search do AllFather\n");
  console.log("=".repeat(80));

  const agent = new ExampleMusicAgent();

  try {
    // Verifica conexão
    const connected = await agent.allfather.checkConnection();
    if (!connected) {
      console.error("❌ Ollama não está rodando!");
      process.exit(1);
    }
    console.log("✅ Conectado ao Ollama\n");

    // Exemplo 1: Enriquecer informações sobre artista
    console.log("\n" + "=".repeat(80));
    console.log("EXEMPLO 1: Enriquecer informações sobre artista");
    console.log("=".repeat(80));
    await agent.enrichArtistInfo("Pink Floyd");

    // Exemplo 2: Verificar nome de artista
    console.log("\n" + "=".repeat(80));
    console.log("EXEMPLO 2: Verificar nome de artista");
    console.log("=".repeat(80));
    await agent.verifyArtistName("The Beatles");

    // Exemplo 3: Detectar gênero musical
    console.log("\n" + "=".repeat(80));
    console.log("EXEMPLO 3: Detectar gênero musical");
    console.log("=".repeat(80));
    await agent.detectGenreFromWeb("Metallica");
  } catch (error) {
    console.error("❌ Erro:", error.message);
    console.error(error);
  }
}

main();
