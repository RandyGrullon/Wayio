# Worker de video de Wayio: Node + ffmpeg + yt-dlp, sin dependencias npm.
# Se construye desde esta carpeta (worker-video/). Ver README.md.
FROM node:22-bookworm-slim

# yt-dlp: binario oficial (trae su Python, curl_cffi y los scripts de YouTube),
# verificado con el SHA2-256SUMS de la versión. «latest» o una etiqueta, p. ej.
# --build-arg YTDLP_VERSION=2026.10.26. Además se actualiza solo al arrancar
# (YTDLP_AUTOACTUALIZAR).
ARG YTDLP_VERSION=latest

# ffmpeg del sistema; tini como PID 1 (reenvía señales y recoge los procesos
# huérfanos de yt-dlp); curl solo para la descarga y se quita en la misma capa.
RUN set -eux; \
  apt-get update; \
  apt-get install -y --no-install-recommends ffmpeg tini ca-certificates curl; \
  case "$(dpkg --print-architecture)" in \
    amd64) archivo=yt-dlp_linux ;; \
    arm64) archivo=yt-dlp_linux_aarch64 ;; \
    *) echo "Arquitectura no soportada" >&2; exit 1 ;; \
  esac; \
  if [ "$YTDLP_VERSION" = latest ]; then \
    base=https://github.com/yt-dlp/yt-dlp/releases/latest/download; \
  else \
    base="https://github.com/yt-dlp/yt-dlp/releases/download/$YTDLP_VERSION"; \
  fi; \
  mkdir -p /opt/yt-dlp; \
  cd /opt/yt-dlp; \
  curl -fsSL --retry 3 -o "$archivo" "$base/$archivo"; \
  curl -fsSL --retry 3 -o SHA2-256SUMS "$base/SHA2-256SUMS"; \
  grep " $archivo\$" SHA2-256SUMS | sha256sum -c -; \
  mv "$archivo" yt-dlp; \
  rm SHA2-256SUMS; \
  chmod 755 yt-dlp; \
  chown -R node:node /opt/yt-dlp; \
  apt-get purge -y --auto-remove curl; \
  rm -rf /var/lib/apt/lists/*; \
  ffmpeg -hide_banner -version | head -n 1; \
  /opt/yt-dlp/yt-dlp --version

ENV NODE_ENV=production \
    PORT=8080 \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    YTDLP_PATH=/opt/yt-dlp/yt-dlp \
    YTDLP_JS_RUNTIMES=node \
    YTDLP_AUTOACTUALIZAR=true

WORKDIR /app
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

# Sin root: el usuario node puede actualizar /opt/yt-dlp pero no el sistema.
USER node
EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "src/servidor.mjs"]
