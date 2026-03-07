import { AllFather } from "../index.js";

/**
 * Exemplo de uso do AllFather com busca na web
 */
async function main() {
  const allFather = new AllFather();

  console.log("🔍 Testando AllFather com Web Search\n");

  try {
    // Verifica conexão com Ollama
    const isConnected = await allFather.checkConnection();
    if (!isConnected) {
      console.error("❌ Ollama não está rodando!");
      process.exit(1);
    }
    console.log("✅ Conectado ao Ollama\n");

    // Teste 1: Busca sobre um artista musical
    console.log("--- Teste 1: Busca sobre artista ---");
    console.log('Pergunta: "Quem é Freddie Mercury?"\n');

    const answer1 = await allFather.askWithWebSearch("Quem é Freddie Mercury?", { source: "all", maxResults: 3 });
    console.log("Resposta:", answer1);
    console.log("\n" + "=".repeat(80) + "\n");

    // Teste 2: Busca apenas no Wikipedia
    console.log("--- Teste 2: Busca no Wikipedia ---");
    console.log('Pergunta: "O que é inteligência artificial?"\n');

    const answer2 = await allFather.askWithWebSearch("O que é inteligência artificial?", { source: "wikipedia", language: "pt" });
    console.log("Resposta:", answer2);
    console.log("\n" + "=".repeat(80) + "\n");

    // Teste 3: Busca apenas no Google
    console.log("--- Teste 3: Busca no Google ---");
    console.log('Pergunta: "Qual último álbum do Metallica?"\n');

    const answer3 = await allFather.askWithWebSearch("Qual último álbum do Metallica?", { source: "google", maxResults: 5 });
    console.log("Resposta:", answer3);
    console.log("\n" + "=".repeat(80) + "\n");

    // Teste 4: Comparação com busca normal (sem web)
    console.log("--- Teste 4: Comparação sem web ---");
    console.log('Pergunta: "Quando foi lançado o filme Duna 2?"\n');

    console.log("Sem web search:");
    const answerNoWeb = await allFather.ask("Quando foi lançado o filme Duna 2?");
    console.log("Resposta:", answerNoWeb);

    console.log("\nCom web search:");
    const answerWithWeb = await allFather.askWithWebSearch("Quando foi lançado o filme Duna 2?", { source: "all", maxResults: 3 });
    console.log("Resposta:", answerWithWeb);
  } catch (error) {
    console.error("❌ Erro:", error.message);
    console.error(error);
  }
}

main();
