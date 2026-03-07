# 🎵 Streamrip - Guia de Referência Rápida

## Instalação e Configuração

```bash
# 1. Executar o script de instalação
./install_streamrip.sh

# 2. Abrir configuração
./rip.sh config open

# 3. Editar o arquivo de configuração manualmente
nano ./config/.config/streamrip/config.toml
# ou
code ./config/.config/streamrip/config.toml
```

## Comandos Básicos

### Download por URL

```bash
# Baixar álbum do Qobuz
./rip.sh url https://www.qobuz.com/us-en/album/ALBUM_URL

# Baixar álbum do Tidal
./rip.sh url https://tidal.com/browse/album/ALBUM_ID

# Baixar playlist do Deezer
./rip.sh url https://www.deezer.com/playlist/PLAYLIST_ID

# Baixar do SoundCloud
./rip.sh url https://soundcloud.com/artist/track
```

### Download com Opções

```bash
# Baixar em qualidade máxima e converter para MP3
./rip.sh --quality 3 --codec mp3 url ALBUM_URL

# Baixar em 320kbps
./rip.sh --quality 1 url ALBUM_URL

# Baixar em qualidade FLAC CD
./rip.sh --quality 2 url ALBUM_URL
```

### Buscar e Baixar

```bash
# Buscar álbum no Tidal
./rip.sh search tidal album 'nome do artista álbum'

# Buscar playlist no Qobuz
./rip.sh search qobuz playlist 'nome da playlist'

# Buscar artista no Deezer
./rip.sh search deezer artist 'nome do artista'

# Buscar track específica
./rip.sh search tidal track 'nome da música'
```

### Download de Discografia

```bash
# Baixar discografia completa de um artista
./rip.sh url https://www.qobuz.com/us-en/interpreter/ARTIST_NAME/ARTIST_ID
```

### Playlist do Last.fm

```bash
# Baixar playlist do last.fm
./rip.sh lastfm https://www.last.fm/user/USERNAME/playlists/PLAYLIST_ID
```

## Níveis de Qualidade

| Nível | Qualidade             | Serviços                         |
| ----- | --------------------- | -------------------------------- |
| 0     | 128 kbps MP3/AAC      | Deezer, Tidal, SoundCloud        |
| 1     | 320 kbps MP3/AAC      | Deezer, Tidal, Qobuz, SoundCloud |
| 2     | 16 bit, 44.1 kHz (CD) | Deezer, Tidal, Qobuz             |
| 3     | 24 bit, ≤ 96 kHz      | Tidal (MQA), Qobuz               |
| 4     | 24 bit, ≤ 192 kHz     | Qobuz                            |

## Codecs de Conversão

```bash
# Converter para MP3
./rip.sh --codec mp3 url ALBUM_URL

# Converter para AAC
./rip.sh --codec aac url ALBUM_URL

# Converter para OPUS
./rip.sh --codec opus url ALBUM_URL

# Manter original (FLAC geralmente)
./rip.sh --codec flac url ALBUM_URL
```

## Ajuda

```bash
# Ajuda geral
./rip.sh --help

# Ajuda do comando url
./rip.sh url --help

# Ajuda do comando search
./rip.sh search --help

# Ajuda do comando config
./rip.sh config --help
```

## 🔒 Gerenciamento de Permissões

```bash
# Corrigir permissões de arquivos existentes (se necessário)
./fix_permissions.sh

# Verificar permissões atuais
ls -la config/ downloads/

# Verificar seu UID/GID
id

# Os scripts já configuram permissões automaticamente
# Arquivos novos virão com suas permissões, não como root
```

**Nota:** Os arquivos agora são criados automaticamente com as permissões do seu usuário. Você não precisa mais usar `sudo` para acessar config ou downloads!

## Gerenciamento Docker

```bash
# Reconstruir a imagem (após atualização)
docker-compose build --no-cache

# Ver logs do container
docker-compose logs

# Remover container e volumes
docker-compose down -v

# Ver imagens
docker images | grep streamrip

# Remover imagem antiga
docker rmi streamrip:latest
```

## Localização dos Arquivos

```
streamrip/
├── config/                              # Configurações
│   └── .config/
│       └── streamrip/
│           ├── config.toml             # Arquivo de configuração principal
│           └── downloads.db            # Database de downloads
└── downloads/                           # Músicas baixadas (ATENÇÃO: verifique caminho no config!)
    ├── [Artista]/
    │   └── [Álbum]/
    │       └── [Músicas]
```

### ⚠️ IMPORTANTE: Caminho de Downloads

Verifique no `config.toml` se o caminho está correto:

```bash
# Deve mostrar: folder = "/downloads"
grep "^folder = " config/.config/streamrip/config.toml
```

**Correto**: `folder = "/downloads"` → Arquivos vão para `./downloads/`  
**Errado**: `folder = "/config/..."` → Arquivos vão para a pasta errada!

Se configurou errado:

```bash
# 1. Corrigir no config.toml
nano config/.config/streamrip/config.toml
# Alterar para: folder = "/downloads"

# 2. Mover arquivos se necessário
./move_downloads.sh
```

## Troubleshooting

### Resetar configuração

```bash
rm -rf config/
./rip.sh config open
```

### Corrigir permissões

```bash
sudo chown -R $USER:$USER downloads/ config/
```

### Limpar cache do Docker

```bash
docker system prune -a
docker volume prune
```

### Ver versão do streamrip

```bash
./rip.sh --version
```

## Dicas

1. **Assinatura Premium**: Você precisa de assinatura premium do Qobuz ou Tidal para downloads em alta qualidade
2. **Credenciais**: Configure suas credenciais no arquivo `config.toml` antes de usar
3. **Rate Limiting**: O streamrip já controla a taxa de downloads automaticamente
4. **Database**: O arquivo `downloads.db` evita downloads duplicados
5. **FFmpeg**: Já incluído na imagem Docker para conversão de áudio

## Links Úteis

- [GitHub do Streamrip](https://github.com/nathom/streamrip)
- [Wiki Oficial](https://github.com/nathom/streamrip/wiki/)
- [Issues](https://github.com/nathom/streamrip/issues)
- [Documentação do Docker](https://docs.docker.com/)
