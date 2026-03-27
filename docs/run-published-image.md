# 使用已发布镜像

## 适用场景

这条路径适合：

- 你不打算 clone 当前仓库
- 你只想直接拉取已经发布好的镜像
- 你自己维护 `docker-compose.yml`、挂载目录和 Cluster 配置

这条路径不依赖仓库里的本地辅助脚本，也不要求先在本地执行 `docker build`。

## 你真正需要准备的东西

如果直接使用已发布镜像，最小需要的是：

1. 一个镜像地址，例如 `docker.io/<your-name>/dst-docker:v1`
2. 一份 compose 文件
3. 四个宿主机目录：
   - `steam-state/`
   - `dst/`
   - `ugc/`
   - `data/`
4. `data/<cluster>/` 下的 Cluster 配置

## compose 示例

仓库根目录提供了一个可直接复制的模板：

- [docker-compose.image.yml.example](/mnt/d/dst/docker/docker-compose.image.yml.example)

它的核心思路只有一个：把本地 `build:` 路径改成 `image:` 路径，其余挂载和环境变量保持一致。

```yaml
services:
  dst:
    image: docker.io/example/dst-docker:v1
    environment:
      DST_CLUSTER_NAME: Cluster_1
      DST_UPDATE_MODE: install-only
      DST_SERVER_MODS_UPDATE_MODE: runtime
      TZ: Asia/Shanghai
    volumes:
      - ./steam-state:/steam-state
      - ./dst:/opt/dst
      - ./ugc:/ugc
      - ./data:/data
    ports:
      - "11000:11000/udp"
      - "11001:11001/udp"
      - "27018:27018/udp"
      - "27019:27019/udp"
    restart: unless-stopped
```

使用时只需要把 `image:` 替换成你实际发布的镜像地址即可。

## 如果你的 Cluster 不是默认内部端口

上面的示例使用的是模板默认端口：

- Master `server_port = 11000`
- Caves `server_port = 11001`
- Master `master_server_port = 27018`
- Caves `master_server_port = 27019`

如果你自己的 Cluster 使用的是别的内部端口，那么 compose 右侧目标端口也必须跟着改。

例如，你的旧配置是：

```ini
# Master/server.ini
[NETWORK]
server_port = 12345

[STEAM]
master_server_port = 23456
```

```ini
# Caves/server.ini
[NETWORK]
server_port = 12346

[STEAM]
master_server_port = 23457
```

那么 compose 可以写成：

```yaml
ports:
  - "11000:12345/udp"
  - "11001:12346/udp"
  - "27018:23456/udp"
  - "27019:23457/udp"
```

或者宿主机也直接沿用原端口：

```yaml
ports:
  - "12345:12345/udp"
  - "12346:12346/udp"
  - "23456:23456/udp"
  - "23457:23457/udp"
```

重点是：

- 左边宿主机端口，你可以自己决定
- 右边容器内端口，必须和你实际 `server.ini` 里的值一致

## 启动流程

典型流程如下：

1. 准备好 `steam-state/`、`dst/`、`ugc/`、`data/`
2. 把 Cluster 配置放到 `data/<DST_CLUSTER_NAME>/`
3. 编辑 compose，把 `image:` 改成实际镜像地址
4. 检查 `DST_CLUSTER_NAME` 是否与实际目录一致
5. 如果世界使用 mods，确认 `dedicated_server_mods_setup.lua` 和 `modoverrides.lua` 已准备好
6. 执行 `docker compose pull`
7. 执行 `docker compose up -d`

## 更新已发布镜像

如果后续镜像标签更新了，例如从 `v1` 切到 `v1.1.0`，只需要：

1. 修改 compose 里的 `image:` 标签
2. 重新 `docker compose pull`
3. 再执行一次 `docker compose up -d`

如果你只是想更新 DST 本体，而不是升级镜像标签，则仍然使用容器内的：

- `DST_UPDATE_MODE=update`
- 或 `DST_UPDATE_MODE=validate`

镜像标签升级与 DST 本体更新是两件不同的事情。

## 与仓库脚本的关系

这条路径通常不需要：

- `scripts/bootstrap-local.sh`
- `scripts/init-cluster.sh`
- `scripts/check-local-config.sh`
- `scripts/run-smoke.sh`

这些脚本主要用于仓库开发、回归测试和本地示例初始化，不是“已发布镜像”使用路径的必需步骤。
