import { AllFather } from '../index.js';

/**
 * Exemplo de uso do askWithAutoWebSearch
 * O modelo decide automaticamente se precisa buscar informações
 */
async function main() {
  const allFather = new AllFather();

  console.log('🧠 Testando AllFather com Busca Automática no Wikipedia\n');
  console.log('O modelo decide se precisa buscar informações e gera a query apropriada\n');

  try {
    // Verifica conexão com Ollama
    const isConnected = await allFather.checkConnection();
    if (!isConnected) {
      console.error('❌ Ollama não está rodando!');
      process.exit(1);
    }
    console.log('✅ Conectado ao Ollama\n');

    // Teste 1: Pergunta que o modelo provavelmente sabe (conceito geral)
    console.log('='.repeat(80));
    console.log('Teste 1: Pergunta sobre conceito geral');
    console.log('='.repeat(80));
    console.log('Pergunta: "O que é um loop em programação?"\n');
    
    const answer1 = await allFather.askWithAutoWebSearch('O que é um loop em programação?');
    console.log('Resposta:', answer1);
    console.log('\n');

    // Teste 2: Pergunta sobre algo específico (banda)
    console.log('='.repeat(80));
    console.log('Teste 2: Pergunta sobre banda específica');
    console.log('='.repeat(80));
    console.log('Pergunta: "Quem é o vocalista do Radiohead?"\n');
    
    const answer2 = await allFather.askWithAutoWebSearch('Quem é o vocalista do Radiohead?');
    console.log('Resposta:', answer2);
    console.log('\n');

    // Teste 3: Pergunta sobre álbum específico
    console.log('='.repeat(80));
    console.log('Teste 3: Pergunta sobre álbum específico');
    console.log('='.repeat(80));
    console.log('Pergunta: "Quando foi lançado o álbum OK Computer?"\n');
    
    const answer3 = await allFather.askWithAutoWebSearch('Quando foi lançado o álbum OK Computer?');
    console.log('Resposta:', answer3);
    console.log('\n');

    // Teste 4: Pergunta sobre pessoa/artista
    console.log('='.repeat(80));
    console.log('Teste 4: Pergunta sobre artista');
    console.log('='.repeat(80));
    console.log('Pergunta: "Quais são os principais álbuns do David Bowie?"\n');
    
    const answer4 = await allFather.askWithAutoWebSearch('Quais são os principais álbuns do David Bowie?');
    console.log('Resposta:', answer4);
    console.log('\n');

    // Teste 5: Pergunta simples de matemática (não deve buscar)
    console.log('='.repeat(80));
    console.log('Teste 5: Pergunta simples');
    console.log('='.repeat(80));
    console.log('Pergunta: "Quanto é 15 + 27?"\n');
    
    const answer5 = await allFather.askWithAutoWebSearch('Quanto é 15 + 27?');
    console.log('Resposta:', answer5);
    console.log('\n');

    // Teste 6: Pergunta sobre evento recente/específico
    console.log('='.repeat(80));
    console.log('Teste 6: Pergunta sobre filme específico');
    console.log('='.repeat(80));
    console.log('Pergunta: "Quem dirigiu o filme Inception?"\n');
    
    const answer6 = await allFather.askWithAutoWebSearch('Quem dirigiu o filme Inception?');
    console.log('Resposta:', answer6);
    console.log('\n');

    console.log('='.repeat(80));
    console.log('✅ Testes concluídos!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
  }
}

main();
