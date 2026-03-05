# Plex Media Server com Docker

Este projeto configura um servidor Plex Media Server usando Docker e Docker Compose.

## 📋 Pré-requisitos

- Docker instalado
- Docker Compose instalado
- Conta Plex (gratuita em https://www.plex.tv/)

## 🚀 Instalação

### 1. Clone ou configure o projeto

```bash
cd /home/zegkreist/Documents/Pessoal/plex_server
```

### 2. Configure as variáveis de ambiente

Edite o arquivo `.env` e adicione seu PLEX_CLAIM:

1. Acesse https://www.plex.tv/claim/
2. Faça login com sua conta Plex
3. Copie o código de claim (válido por 4 minutos)
4. Cole no arquivo `.env`:

```bash
PLEX_CLAIM=claim-xxxxxxxxxxxxxxxxxx
```

> **Nota:** O PLEX_CLAIM é necessário apenas na primeira execução. Depois de configurar, você pode removê-lo do arquivo.

### 3. Ajuste o timezone e permissões

Se necessário, ajuste o timezone e IDs de usuário no arquivo `.env`:

```bash
# Descobrir seu UID e GID
id

# Editar .env conforme necessário
PUID=1000
PGID=1000
TZ=Europe/Lisbon
```

### 4. Crie os diretórios de mídia

Os diretórios serão criados automaticamente, mas você pode criá-los manualmente:

```bash
mkdir -p config tv movies music
```

## 🎬 Uso

### Iniciar o servidor

```bash
docker-compose up -d
```

### Ver logs

```bash
docker-compose logs -f plex
```

### Parar o servidor

```bash
docker-compose down
```

### Reiniciar o servidor

```bash
docker-compose restart
```

## 📁 Estrutura de diretórios

```
plex_server/
├── docker-compose.yml    # Configuração do Docker Compose
├── .env                  # Variáveis de ambiente (não commitar!)
├── .env.example          # Exemplo de variáveis de ambiente
├── config/               # Configurações do Plex (criado automaticamente)
├── tv/                   # Coloque suas séries aqui
├── movies/               # Coloque seus filmes aqui
├── music/                # Coloque suas músicas aqui
├── ollama/               # Dados do Ollama (modelos LLM)
├── agents/               # Agents Node.js para automação
├── ollama-setup.sh       # Script de gerenciamento do Ollama
├── OLLAMA.md            # Documentação completa do Ollama
└── README.md            # Este arquivo
```

## 🦙 Ollama - LLMs Locais

Este projeto inclui o **Ollama** para executar modelos de linguagem (LLMs) localmente, sem custos e com total privacidade.

### Iniciar Ollama

```bash
# Subir todos os serviços (Plex + Ollama)
docker-compose up -d

# Ou apenas o Ollama
docker-compose up -d ollama
```

### Gerenciar modelos

Use o script interativo:

```bash
./ollama-setup.sh
```

Ou comandos diretos:

```bash
# Baixar modelo recomendado (3GB)
./ollama-setup.sh pull llama3.2:3b

# Listar modelos instalados
./ollama-setup.sh list

# Testar modelo
./ollama-setup.sh test llama3.2:3b
```

### Para que serve?

- 🤖 **Agents inteligentes**: Os agents podem usar IA para tarefas avançadas
- 🎵 **Curadoria de música**: Análise e organização inteligente
- 🎬 **Análise de conteúdo**: Categorização automática
- 💬 **ChatBot**: Assistente para buscar e recomendar mídia

📖 **[Ver documentação completa do Ollama →](OLLAMA.md)**

## 🤖 Agents

O projeto inclui agents Node.js para automação:

- **MusicCurator**: Organiza e cura a biblioteca de música

📖 **[Ver documentação dos Agents →](agents/README.md)**

## 🌐 Acessar o Plex

Após iniciar o container, acesse:

- **Local:** http://localhost:32400/web
- **Remoto:** Configure em Settings > Remote Access

## 📚 Adicionando mídia

1. Copie seus arquivos de mídia para as pastas correspondentes:
   - `tv/` para séries
   - `movies/` para filmes
   - `music/` para músicas

2. No Plex Web, vá em **Settings > Manage > Libraries** e adicione as bibliotecas

3. O Plex irá escanear e organizar sua mídia automaticamente

## 🔧 Configurações avançadas

### Aceleração de hardware (GPU)

O docker-compose.yml já inclui suporte para aceleração de hardware Intel (Quick Sync):

```yaml
devices:
  - /dev/dri:/dev/dri
```

Para outras GPUs:

- **NVIDIA:** Instale nvidia-docker e ajuste o compose file
- **AMD:** Pode funcionar com /dev/dri, dependendo dos drivers

### Alterar portas

Se precisar alterar a porta (não recomendado para Plex), modifique o `network_mode` no docker-compose.yml.

### Backup

Faça backup regularmente do diretório `config/`:

```bash
tar -czf plex-backup-$(date +%Y%m%d).tar.gz config/
```

## 🐛 Troubleshooting

### Container não inicia

```bash
# Verificar logs
docker-compose logs plex

# Verificar se a porta 32400 está em uso
sudo lsof -i :32400
```

### Não consigo acessar o Plex

1. Verifique se o container está rodando:

   ```bash
   docker-compose ps
   ```

2. Certifique-se de que não há firewall bloqueando a porta 32400

3. Em algumas configurações, você pode precisar usar `http://IP-DO-SERVIDOR:32400/web`

### Permissões de arquivo

Se tiver problemas de permissões, ajuste PUID e PGID no `.env` para corresponder ao seu usuário:

```bash
id
# Use os valores de uid e gid no .env
```

## 📝 Notas

- O Plex usa `network_mode: host` para melhor descoberta de dispositivos na rede local
- Os dados de configuração ficam em `./config` e persistem entre reinicializações
- **IMPORTANTE:** Adicione o `.env` ao `.gitignore` para não expor seu PLEX_CLAIM

## 🔗 Links úteis

- [Plex Official Website](https://www.plex.tv/)
- [Plex Docker Image (LinuxServer)](https://docs.linuxserver.io/images/docker-plex)
- [Plex Support](https://support.plex.tv/)

## 📜 Licença

Este é um projeto pessoal para uso próprio.
