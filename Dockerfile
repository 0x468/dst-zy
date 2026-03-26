FROM debian:bookworm-slim

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
        jq \
        libcurl3-gnutls \
        lib32gcc-s1 \
        lib32stdc++6 \
        lib32tinfo6 \
        supervisor \
        unzip \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /usr/local/steamcmd /usr/local/lib/dst /opt/dst /ugc /data /steam-state /var/log/supervisor /etc/supervisor/conf.d

RUN curl -fsSL https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz \
    | tar -C /usr/local/steamcmd -xzf -

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY lib/legacy_workshop_fallback.sh /usr/local/lib/dst/legacy_workshop_fallback.sh
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/lib/dst/legacy_workshop_fallback.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
