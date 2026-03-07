import { WebSearch } from "./src/web-search.js";

async function debugInception() {
  const webSearch = new WebSearch();

  console.log("=== Debug: Buscando Inception ===\n");

  // Teste direto na API
  console.log("1️⃣ Teste direto com searchIMDB:");
  const imdbResult = await webSearch.searchIMDB("Inception");
  console.log("IMDB Result:", JSON.stringify(imdbResult, null, 2));
  console.log("\n" + "=".repeat(70) + "\n");

  // Teste com searchMovieOrSeries
  console.log("2️⃣ Teste com searchMovieOrSeries:");
  const combined = await webSearch.searchMovieOrSeries("Inception");
  console.log("Combined Result:", JSON.stringify(combined, null, 2));
}

debugInception().catch(console.error);
