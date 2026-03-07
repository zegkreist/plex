# Streamrip Docker

Configuração Docker para executar o [streamrip](https://github.com/nathom/streamrip) - um downloader de música para Qobuz, Tidal, Deezer e SoundCloud.

## 📋 Pré-requisitos

- Docker
- Docker Compose

## � Gerenciamento de Permissões

**✅ Configuração automática**: Este projeto está configurado para criar arquivos com as permissões do seu usuário, não como root!

Os scripts `rip.sh` e `tidal.sh` automaticamente configuram as permissões corretas. Você terá acesso total aos arquivos em `config/` e `downloads/` sem precisar de `sudo`.

**Se você já tinha arquivos criados como root**, execute:

```bash
./fix_permissions.sh
```

📚 Para mais detalhes: [PERMISSIONS.md](PERMISSIONS.md)

## �🚀 Como usar

### 1. Construir a imagem Docker

```bash
docker-compose build
```

### 2. Configuração inicial

Primeiro, crie o arquivo de configuração do streamrip:

```bash
./rip.sh config open
```

Isso criará o arquivo de configuração em `./config/.config/streamrip/config.toml`. Você precisará editar este arquivo para adicionar suas credenciais do Qobuz, Tidal ou Deezer.

### 3. Executar comandos

Você pode executar o streamrip de duas maneiras:

#### Usando o script auxiliar (recomendado):

```bash
chmod +x rip.sh  # Tornar o script executável (apenas primeira vez)
./rip.sh [comandos]
```

#### Ou diretamente com docker-compose:

```bash
docker-compose run --rm streamrip [comandos]
```

### 4. 🎵 Script Helper para Tidal (NOVO!)

Se você usa principalmente o Tidal, temos um script auxiliar com funções prontas:

```bash
# Menu interativo (mais fácil)
./tidal.sh menu

# Ou use funções diretamente
source tidal.sh
tidal_album "https://tidal.com/browse/album/123456" 3
tidal_search_album "daft punk discovery"
```

**Recursos do tidal.sh:**

- ✅ Menu interativo amigável
- ✅ Funções para álbuns, playlists, tracks e artistas
- ✅ Busca integrada com auto-download
- ✅ Conversão automática para MP3/FLAC
- ✅ Ver histórico e downloads falhados

📚 **Guia completo**: [TIDAL_GUIDE.md](TIDAL_GUIDE.md)

## 📖 Exemplos de uso

### Baixar um álbum do Qobuz

```bash
./rip.sh url https://www.qobuz.com/us-en/album/rumours-fleetwood-mac/0603497941032
```

### Baixar e converter para MP3

```bash
./rip.sh --codec mp3 url https://open.qobuz.com/album/0060253780968
```

### Buscar e baixar

```bash
./rip.sh search tidal album 'fleetwood mac rumours'
```

### Definir qualidade (0-4)

```bash
./rip.sh --quality 3 url https://tidal.com/browse/album/147569387
```

Qualidades disponíveis:

- **0**: 128 kbps MP3 ou AAC
- **1**: 320 kbps MP3 ou AAC
- **2**: 16 bit, 44.1 kHz (CD)
- **3**: 24 bit, ≤ 96 kHz
- **4**: 24 bit, ≤ 192 kHz

### Ver ajuda

```bash
./rip.sh --help
./rip.sh url --help
```

## 📁 Estrutura de diretórios

```
streamrip/
├── Dockerfile              # Definição da imagem Docker
├── docker-compose.yml      # Configuração do Docker Compose
├── install_streamrip.sh    # Script de instalação automatizada
├── rip.sh                  # Script auxiliar básico
├── tidal.sh                # Script helper para Tidal (NOVO!)
├── setup_tidal.sh          # Script para configurar tokens do Tidal
├── get_tidal_tokens.py     # Script Python para obter tokens
├── readme.md               # Este arquivo
├── TIDAL_GUIDE.md          # Guia completo do tidal.sh
├── QUICK_REFERENCE.md      # Referência rápida de comandos
├── CONFIG_GUIDE.md         # Guia de configuração
├── config/                 # Configurações do streamrip (criado automaticamente)
│   └── .config/
│       └── streamrip/
│           └── config.toml
└── downloads/              # Músicas baixadas (criado automaticamente)
```

## ⚙️ Configuração

O arquivo de configuração fica em `./config/.config/streamrip/config.toml`.

Para editar:

```bash
./rip.sh config open
```

Ou edite manualmente o arquivo `./config/.config/streamrip/config.toml`.

### Principais configurações:

1. **Credenciais**: Adicione suas credenciais de Qobuz, Tidal ou Deezer
2. **Download path**: ⚠️ **IMPORTANTE** - Deve ser `/downloads` (não `/config/...`)
3. **Qualidade padrão**: Defina a qualidade preferida
4. **Formato de conversão**: Configure mp3, flac, etc.

#### ⚠️ Caminho de Downloads

O caminho de downloads no `config.toml` deve ser:

```toml
[downloads]
folder = "/downloads"
```

**Não use** `/config/StreamripDownloads` ou outros caminhos. O caminho `/downloads` dentro do container corresponde à pasta `./downloads/` no seu sistema.

Se você já baixou arquivos na pasta errada, use:

```bash
./move_downloads.sh
```

2. **Download path**: Por padrão já está configurado para `/downloads`
3. **Qualidade padrão**: Defina a qualidade preferida
4. **Formato de conversão**: Configure mp3, flac, etc.

### Configurando o Tidal

Para configurar o Tidal, você precisa obter tokens de autenticação. Use o script auxiliar fornecido:

```bash
./setup_tidal.sh
```

Este script irá:

1. Instalar a biblioteca necessária (`tidalapi`)
2. Abrir um link no navegador para você fazer login no Tidal
3. Gerar os tokens automaticamente
4. Salvar os tokens em `tidal_tokens.txt`

Depois, basta copiar o conteúdo gerado para a seção `[tidal]` do arquivo `./config/.config/streamrip/config.toml`.

**Nota:** Os tokens do Tidal expiram após 7 dias de inatividade. Se precisar renovar, execute o script novamente.

Para mais detalhes sobre configuração, consulte [CONFIG_GUIDE.md](CONFIG_GUIDE.md).

## 🔧 Troubleshooting

### Permissões de arquivo

Se tiver problemas com permissões nos arquivos baixados:

```bash
sudo chown -R $USER:$USER downloads/
```

### Recriar a configuração

```bash
rm -rf config/
./rip.sh config open
```

### Atualizar o streamrip

```bash
docker-compose build --no-cache
```

## 📚 Recursos

- [GitHub do Streamrip](https://github.com/nathom/streamrip)
- [Wiki do Streamrip](https://github.com/nathom/streamrip/wiki/)
- [Instruções de instalação detalhadas](https://github.com/nathom/streamrip/wiki#detailed-installation-instructions)

## ⚠️ Aviso

Você é responsável pelo uso do streamrip. Ao usar esta ferramenta, você concorda com os termos e condições das APIs do Qobuz, Tidal e Deezer.

## 📝 Notas

- Os downloads são salvos em `./downloads`
- A configuração é persistida em `./config`
- É necessário ter assinatura premium do Tidal ou Qobuz para usar todos os recursos
- FFmpeg já está incluído na imagem para conversão de áudio
