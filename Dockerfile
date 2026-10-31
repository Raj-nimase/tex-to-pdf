# Production-grade Node.js container with Tectonic LaTeX engine
FROM node:22-slim

# Install system dependencies needed for font handling and certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    fontconfig \
    tar \
    && rm -rf /var/lib/apt/lists/*

# Install Tectonic (statically linked Linux x86_64 binary)
ARG TECTONIC_VERSION=0.17.0
RUN curl -fsSL "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-x86_64-unknown-linux-musl.tar.gz" \
    | tar -xz -C /usr/local/bin/ \
    && chmod +x /usr/local/bin/tectonic \
    && tectonic --version

WORKDIR /app

# Install Node production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Pre-warm common LaTeX fonts, formats, and packages into cache
RUN printf '\\documentclass[11pt,a4paper]{article}\n\\usepackage{amsmath,amssymb,amsthm,geometry,hyperref,titlesec,enumitem,graphicx,xcolor,array,booktabs}\n\\begin{document}init\\end{document}' > /tmp/warmup.tex \
    && tectonic /tmp/warmup.tex -o /tmp \
    && rm -f /tmp/warmup.*

ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/server.js"]
