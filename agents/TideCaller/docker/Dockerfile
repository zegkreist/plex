FROM python:3.11-slim

# Metadados
LABEL maintainer="streamrip-docker"
LABEL description="Streamrip - A scriptable music downloader for Qobuz, Tidal, Deezer and SoundCloud"

# Argumentos para UID e GID do usuário (passados do docker-compose)
ARG USER_ID=1000
ARG GROUP_ID=1000

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

# Criar diretório de trabalho
WORKDIR /app

# Instalar streamrip
RUN pip3 install --no-cache-dir streamrip --upgrade

# Criar grupo e usuário com o mesmo UID/GID do host
RUN groupadd -g ${GROUP_ID} streamrip && \
    useradd -u ${USER_ID} -g ${GROUP_ID} -m -s /bin/bash streamrip

# Criar diretórios para config e downloads
RUN mkdir -p /config /downloads

# Definir permissões corretas para o usuário streamrip
RUN chown -R streamrip:streamrip /config /downloads /app

# Definir volumes
VOLUME ["/config", "/downloads"]

# Definir variáveis de ambiente
ENV HOME=/config
ENV PYTHONUNBUFFERED=1

# Mudar para o usuário não-root
USER streamrip

# Comando padrão
ENTRYPOINT ["rip"]
CMD ["--help"]
