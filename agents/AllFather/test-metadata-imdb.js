import { AllFather } from "./index.js";

async function testMetadata() {
  const allFather = new AllFather({
    temperature: 0.1,
    systemMessage: "Você é um assistente especializado em metadata de filmes e séries.",
  });

  console.log("=== Testando Metadata via AllFather ===\n");

  // Teste 1: Filme
  console.log("1️⃣ Buscando metadata de filme: Inception");
  const movieMetadata = await allFather.getMovieMetadata("Inception");
  console.log("Resultado:", JSON.stringify(movieMetadata, null, 2));
  console.log("\n" + "=".repeat(70) + "\n");

  // Teste 2: Série
  console.log("2️⃣ Buscando metadata de série: Breaking Bad");
  const seriesMetadata = await allFather.getSeriesMetadata("Breaking Bad");
  console.log("Resultado:", JSON.stringify(seriesMetadata, null, 2));
  console.log("\n" + "=".repeat(70) + "\n");

  // Teste 3: The Matrix
  console.log("3️⃣ Buscando metadata de filme: The Matrix");
  const matrixMetadata = await allFather.getMovieMetadata("The Matrix");
  console.log("Resultado:", JSON.stringify(matrixMetadata, null, 2));
}

testMetadata().catch(console.error);
