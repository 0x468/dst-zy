FROM node:22.22.1-bookworm AS web-builder
WORKDIR /src/control-plane/web
COPY control-plane/web/package.json control-plane/web/package-lock.json ./
RUN npm ci
COPY control-plane/web/ ./
RUN npm run build

FROM golang:1.26.1-bookworm AS api-builder
WORKDIR /src/control-plane/api
COPY control-plane/api/go.mod control-plane/api/go.sum ./
RUN go mod download
COPY control-plane/api/ ./
RUN go build -o /out/dst-control-plane ./cmd/server

FROM debian:bookworm-slim
WORKDIR /opt/dst-control-plane
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates docker.io \
  && rm -rf /var/lib/apt/lists/*
COPY --from=api-builder /out/dst-control-plane /usr/local/bin/dst-control-plane
COPY --from=web-builder /src/control-plane/web/dist /opt/dst-control-plane/web
ENV DST_CONTROL_PLANE_LISTEN_ADDR=:8080
ENV DST_CONTROL_PLANE_DATA_ROOT=/opt/dst-control-plane/data
ENV DST_CONTROL_PLANE_WEB_STATIC_DIR=/opt/dst-control-plane/web
EXPOSE 8080
VOLUME ["/opt/dst-control-plane/data"]
CMD ["dst-control-plane"]
