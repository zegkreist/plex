# Ollama - LLMs Locais 🦙

Configuração do Ollama para executar modelos de linguagem (LLMs) localmente no servidor Plex.

## 🎯 O que é Ollama?

Ollama permite executar modelos de linguagem grandes (LLMs) como Llama, Mistral, e outros localmente, sem depender de APIs externas como OpenAI ou Claude.

**Vantagens:**

- ✅ **Privacidade**: Dados processados localmente
- ✅ **Sem custos**: Sem cobrança por token
- ✅ **Sem limites**: Use quanto quiser
- ✅ **Offline**: Funciona sem internet
- ✅ **Personalizável**: Escolha o modelo ideal

## 🚀 Início Rápido

### 1. Iniciar o Ollama

```bash
docker-compose up -d ollama
```

### 2. Verificar se está rodando

```bash
curl http://localhost:11434
```

Deve retornar: "Ollama is running"

### 3. Baixar um modelo

Use o script de gerenciamento:

```bash
# Modo interativo
./ollama-setup.sh

# Ou direto pela linha de comando
./ollama-setup.sh pull llama3.2:3b
```

Ou manualmente:

```bash
docker exec -it ollama ollama pull llama3.2:3b
```

### 4. Testar o modelo

```bash
docker exec -it ollama ollama run llama3.2:3b "Olá! Como você está?"
```

## 🛠️ Script de Gerenciamento

O script `ollama-setup.sh` facilita o gerenciamento:

```bash
# Tornar executável (primeira vez)
chmod +x ollama-setup.sh

# Modo interativo (menu)
./ollama-setup.sh

# Comandos diretos
./ollama-setup.sh status              # Verifica status
./ollama-setup.sh list                # Lista modelos
./ollama-setup.sh pull llama3.2:3b    # Baixa modelo
./ollama-setup.sh test llama3.2:3b    # Testa modelo
./ollama-setup.sh rm llama3.2:3b      # Remove modelo
```

## 📦 Modelos Recomendados

### Para começar (leve e rápido):

- **llama3.2:1b** (1GB) - Muito rápido, ótimo para testes
- **llama3.2:3b** (3GB) - Balanceado, recomendado

### Uso geral (mais poderoso):

- **llama3.1:8b** (4.7GB) - Alta qualidade
- **mistral:7b** (4GB) - Excelente performance

### Para programação:

- **codellama:7b** (4GB) - Especializado em código
- **deepseek-coder:6.7b** (3.8GB) - Muito bom para código

### Em português:

- **sabia-2-small** (3GB) - Treinado em português brasileiro

### Multilíngue:

- **aya:8b** (4.8GB) - Suporta 101 idiomas

## 💻 Comandos Úteis

### Listar modelos instalados

```bash
docker exec ollama ollama list
```

### Baixar modelo

```bash
docker exec ollama ollama pull <modelo>
```

### Executar modelo (chat interativo)

```bash
docker exec -it ollama ollama run <modelo>
```

### Executar comando único

```bash
docker exec ollama ollama run <modelo> "Sua pergunta aqui"
```

### Remover modelo

```bash
docker exec ollama ollama rm <modelo>
```

### Ver logs

```bash
docker-compose logs -f ollama
```

### Parar Ollama

```bash
docker-compose stop ollama
```

## 🔌 API REST

O Ollama expõe uma API REST em `http://localhost:11434`

### Exemplo de uso com curl:

```bash
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2:3b",
  "prompt": "Por que o céu é azul?",
  "stream": false
}'
```

### Exemplo com Node.js:

```javascript
import axios from "axios";

const response = await axios.post("http://localhost:11434/api/generate", {
  model: "llama3.2:3b",
  prompt: "Explique o que é Docker",
  stream: false,
});

console.log(response.data.response);
```

## 🤖 Integração com Agents

Os agents podem usar o Ollama para funcionalidades de IA:

```javascript
// Exemplo de integração em um agent
import axios from "axios";

async function askLLM(prompt, model = "llama3.2:3b") {
  const response = await axios.post("http://localhost:11434/api/generate", {
    model: model,
    prompt: prompt,
    stream: false,
  });

  return response.data.response;
}

// Uso
const result = await askLLM('Analise este nome de música e sugira gênero: "Bohemian Rhapsody"');
console.log(result);
```

## 🎛️ Configuração Avançada

### GPU NVIDIA

Se você tem uma GPU NVIDIA, descomente as linhas no `docker-compose.yml`:

```yaml
ollama:
  # ...
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: all
            capabilities: [gpu]
```

E instale o NVIDIA Container Toolkit:

```bash
# Ubuntu/Debian
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker
```

### Variáveis de ambiente

Adicione ao `.env` se necessário:

```bash
# URL do Ollama (para agents)
OLLAMA_URL=http://localhost:11434

# Modelo padrão
OLLAMA_DEFAULT_MODEL=llama3.2:3b
```

## 📊 Requisitos de Sistema

| Modelo       | RAM | Armazenamento | Velocidade   |
| ------------ | --- | ------------- | ------------ |
| llama3.2:1b  | 2GB | 1GB           | Muito rápida |
| llama3.2:3b  | 4GB | 3GB           | Rápida       |
| llama3.1:8b  | 8GB | 4.7GB         | Média        |
| mistral:7b   | 8GB | 4GB           | Média        |
| codellama:7b | 8GB | 4GB           | Média        |

**Recomendado:**

- CPU: 4+ cores
- RAM: 8GB+ (16GB ideal)
- Armazenamento: 20GB+ livres
- GPU: Opcional, mas acelera significativamente

## 🐛 Troubleshooting

### Container não inicia

```bash
# Ver logs
docker-compose logs ollama

# Verificar se a porta 11434 está em uso
sudo lsof -i :11434
```

### Modelo não baixa / erro de memória

Tente um modelo menor:

```bash
./ollama-setup.sh pull llama3.2:1b
```

### Respostas muito lentas

- Use um modelo menor
- Verifique se tem RAM suficiente
- Considere usar GPU (NVIDIA)

### "Ollama is not running"

```bash
# Reiniciar o container
docker-compose restart ollama

# Verificar se subiu
docker-compose ps ollama
```

## 🔗 Links Úteis

- [Ollama Official](https://ollama.ai/)
- [Lista completa de modelos](https://ollama.ai/library)
- [Ollama API Documentation](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [Ollama GitHub](https://github.com/ollama/ollama)

## 💡 Casos de Uso

### Para Plex Agents:

1. **MusicCurator**:
   - Analisar títulos e sugerir gêneros
   - Corrigir nomes de artistas
   - Gerar descrições de álbuns

2. **MovieCurator** (futuro):
   - Analisar sinopses
   - Sugerir categorias
   - Gerar tags inteligentes

3. **SubtitleManager** (futuro):
   - Traduzir legendas
   - Corrigir erros de OCR

4. **ChatBot** (futuro):
   - Assistente para buscar filmes/séries
   - Recomendações personalizadas

## 📝 Notas

- Os modelos ficam salvos em `./ollama/`
- Modelos persistem entre reinicializações
- Você pode ter múltiplos modelos instalados
- Primeira execução de um modelo é mais lenta (carregamento)
