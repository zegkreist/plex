import { WebSearch } from "./src/web-search.js";

async function testIMDb() {
  const webSearch = new WebSearch();

  console.log("=== Testando IMDb Suggestion API ===\n");

  // Teste 1: Filme clássico
  console.log("1️⃣ Buscando: Inception (2010)");
  const inception = await webSearch.searchIMDB("Inception", "2010");
  console.log("Resultado:", JSON.stringify(inception, null, 2));
  console.log("\n" + "=".repeat(60) + "\n");

  // Teste 2: Filme famoso sem ano
  console.log("2️⃣ Buscando: The Matrix");
  const matrix = await webSearch.searchIMDB("The Matrix");
  console.log("Resultado:", JSON.stringify(matrix, null, 2));
  console.log("\n" + "=".repeat(60) + "\n");

  // Teste 3: Série
  console.log("3️⃣ Buscando: Breaking Bad");
  const breakingBad = await webSearch.searchIMDB("Breaking Bad");
  console.log("Resultado:", JSON.stringify(breakingBad, null, 2));
  console.log("\n" + "=".repeat(60) + "\n");

  // Teste 4: Filme inexistente
  console.log("4️⃣ Buscando: FilmeQueNaoExiste123456");
  const notFound = await webSearch.searchIMDB("FilmeQueNaoExiste123456");
  console.log("Resultado:", JSON.stringify(notFound, null, 2));
}

testIMDb().catch(console.error);
