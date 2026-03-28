# DST Docker 运行说明

## 这份仓库适合谁

这份仓库同时服务两类读者：

- 镜像使用者：关心如何准备 Cluster 配置、如何写 `docker-compose.yml`、如何挂载目录并启动容器。
- 仓库维护者：关心本地初始化脚本、smoke 测试、验证记录和设计文档。

如果你只是想使用镜像起服，不需要先跑仓库里的辅助脚本；它们不是镜像运行必需条件。

## 文档入口

- 镜像使用与快速上手：当前这份 [README.md](/mnt/d/dst/docker/README.md)
- 直接使用已发布镜像： [docs/run-published-image.md](/mnt/d/dst/docker/docs/run-published-image.md)
- 迁移已有存档/已有 Cluster： [docs/migrate-existing-cluster.md](/mnt/d/dst/docker/docs/migrate-existing-cluster.md)
- 仓库目录、脚本与测试职责： [docs/repository-map.md](/mnt/d/dst/docker/docs/repository-map.md)
- 验证记录、外部资料与已知问题： [docs/verification.md](/mnt/d/dst/docker/docs/verification.md)
- 控制平面 V2 快速上手： [control-plane/docs/quickstart.md](control-plane/docs/quickstart.md)
- 控制平面 V2 安全边界： [control-plane/docs/security.md](control-plane/docs/security.md)
- 控制平面 V2 开发说明： [control-plane/docs/development.md](control-plane/docs/development.md)

## 项目目标

本仓库提供一个基于 Debian 的 DST dedicated server 镜像，默认以单容器运行一个完整集群（Master + Caves）。镜像内负责：

- 安装并调用 SteamCMD
- 在缺失 DST 本体时自动安装
- 按需执行 `update` 或 `validate`
- 同步 `dedicated_server_mods_setup.lua`
- 启动 Master 与 Caves

镜像外由用户提供并持久化：

- `steam-state/`：SteamCMD 运行状态
- `dst/`：DST dedicated server 本体
- `ugc/`：Workshop/UGC 缓存
- `data/<cluster>/`：配置、存档、日志、mod 配置

## 两种使用方式

当前仓库明确支持两条路径：

- 本地仓库路径
  你 clone 仓库，在本地使用 [docker-compose.yml](/mnt/d/dst/docker/docker-compose.yml) 和 `build: .` 来构建并启动。
- 已发布镜像路径
  你不需要 clone 仓库，只需要拿到镜像地址，使用 `image:` 方式直接拉取和启动。可参考 [docs/run-published-image.md](/mnt/d/dst/docker/docs/run-published-image.md) 与 [docker-compose.image.yml.example](/mnt/d/dst/docker/docker-compose.image.yml.example)。

如果你只是普通使用者，通常更适合第二条；如果你正在修改镜像、脚本或做验证，才更适合第一条。

## 快速开始

如果你只是想直接起一个新的集群，建议从 [`examples/Cluster_1`](/mnt/d/dst/docker/examples/Cluster_1) 复制一份开始。

最小准备项如下：

1. 准备四个宿主机目录：`steam-state/`、`dst/`、`ugc/`、`data/`
2. 在 `data/<你的集群名>/` 下准备：
   - `cluster.ini`
   - `cluster_token.txt`
   - `Master/server.ini`
   - `Caves/server.ini`
3. 如果你要启用 server mods，再准备：
   - `mods/dedicated_server_mods_setup.lua`
   - `Master/modoverrides.lua`
   - `Caves/modoverrides.lua`
4. 启动容器

仓库里提供了 `scripts/bootstrap-local.sh` 和 `scripts/init-cluster.sh` 来帮你生成这些目录，但它们只是本地辅助工具，不是镜像运行必需条件。

## 最小 compose 示例

下面这份 compose 更接近“镜像使用者”路径：你可以直接按自己的 Cluster 配置修改挂载和端口，而不是必须照抄仓库默认值。

```yaml
services:
  dst:
    image: dst-docker:v1
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

如果你已有旧集群，而且旧配置里的内部端口不是 `11000/11001/27018/27019`，可以直接把 compose 右侧目标端口改成你自己的 `server.ini` 值；镜像本身不会在运行时重写这些端口。详见 [docs/migrate-existing-cluster.md](/mnt/d/dst/docker/docs/migrate-existing-cluster.md)。

如果你想直接使用远程镜像而不是本地 build，可以直接参考 [docs/run-published-image.md](/mnt/d/dst/docker/docs/run-published-image.md)。

## 端口模型

请把这三类端口分开理解：

- `cluster.ini` 里的 `master_port`
  用于 Master 与 Caves 分片内部协同，不是玩家直接连接端口，通常不需要对宿主机公开。
- `Master/server.ini` 与 `Caves/server.ini` 里的 `server_port`
  这是各 shard 的游戏监听端口，玩家最终会访问这里。
- 两个 `server.ini` 里的 `master_server_port`
  这是 DST/Steam 相关端口，同一集群内两个 shard 必须不同。

Docker 端口映射的语义是：

```text
宿主机端口:容器内端口/udp
```

所以：

- 左边宿主机端口可以自由选，只要宿主机没有冲突
- 右边容器内端口必须和你实际 `server.ini` 里的端口一致
- 当前仓库自带的 `docker-compose.yml` 只是基于示例 Cluster 的默认模板，不是镜像硬限制

## `cluster_key` 和 `cluster_token.txt` 的区别

- `cluster_token.txt`
  这是你向 Klei 申请的 cluster token，用来让集群在官方服务侧完成注册。
- `cluster.ini` 里的 `cluster_key`
  这是同一个集群内各 shard 共享的内部密钥，用来让从分片认证到主分片。它不是 Klei 发给你的值，通常由你自己生成并固定保存。

如果是双分片集群，`cluster_key` 必须存在且同集群保持一致。

## 首次启动时会发生什么

镜像入口脚本会按顺序执行：

1. 确保 `/steam-state`、`/opt/dst`、`/ugc`、`/data/<cluster>` 存在
2. 检查 `cluster.ini`、`cluster_token.txt`、两个 `server.ini` 是否存在
3. 自动补齐空的 `adminlist.txt`、`blocklist.txt`、`whitelist.txt`
4. 根据 `DST_UPDATE_MODE` 决定是否通过 SteamCMD 安装/更新 DST 本体
5. 将 `mods/dedicated_server_mods_setup.lua` 同步到 `/opt/dst/mods`
6. 根据 `DST_SERVER_MODS_UPDATE_MODE` 处理 server mod 更新
7. 交给 `supervisord` 启动 Master 与 Caves

补充说明：

- 默认 `DST_UPDATE_MODE=install-only`
  只有在 `/opt/dst` 里还没有 DST 二进制时才会安装；已有本体时直接起服。
- 默认 `DST_SERVER_MODS_UPDATE_MODE=runtime`
  由 Master/Caves 在启动时自行下载和更新 mods。

## Server Mod 配置职责

- `dedicated_server_mods_setup.lua`
  负责告诉服务器“要下载哪些 Workshop/server mods”。
- `modoverrides.lua`
  负责告诉各 shard“要启用哪些 mod，以及具体配置是什么”。

这两者不是一回事。即使你没有现成的 `ugc/` 或 `dst/mods/` 缓存，只要 `dedicated_server_mods_setup.lua` 存在，镜像也可以在首次启动时自动去下载所需 mod。

## 更新模式

`DST_UPDATE_MODE` 支持：

- `install-only`
  默认模式。只有当 `/opt/dst` 里没有 DST 本体时才安装。
- `update`
  每次启动时都执行 `steamcmd +app_update 343050`。
- `validate`
  每次启动时执行 `steamcmd +app_update 343050 validate`。
- `never`
  完全不联网更新，要求 `/opt/dst` 里已经有可用 DST 本体。

常规运行建议保持 `install-only`；只有在你明确要更新或校验时，才临时切到 `update` 或 `validate`。

## Server Mod 更新模式

`DST_SERVER_MODS_UPDATE_MODE` 支持：

- `runtime`
  默认值。由 Master/Caves 启动时自行下载和更新。
- `prewarm`
  先预热 mod 缓存，再启动两个 shard，更适合冷缓存首启。
- `skip`
  跳过 mod 更新，只复用现有缓存。

对少数 legacy Workshop mod，镜像还会在必要时尝试本地 fallback，以提升“能否启动成功”的概率。相关验证和限制见 [docs/verification.md](/mnt/d/dst/docker/docs/verification.md)。

## 仓库脚本是不是必须运行

不是。

如果你只是使用镜像：

- 不需要运行 `scripts/bootstrap-local.sh`
- 不需要运行 `scripts/init-cluster.sh`
- 不需要运行 `scripts/check-local-config.sh`
- 不需要运行 `scripts/run-smoke.sh`

这些脚本主要服务于“从源码仓库直接开发、试跑、验证”的路径。它们的定位和作用见 [docs/repository-map.md](/mnt/d/dst/docker/docs/repository-map.md)。

## 验证状态

当前镜像和控制流的验证记录集中在 [docs/verification.md](/mnt/d/dst/docker/docs/verification.md)：

- 已覆盖 `DST_UPDATE_MODE` 与 `DST_SERVER_MODS_UPDATE_MODE` 的主要分支
- 已验证 `steam-state`、`dst`、`ugc`、`data` 的目录职责
- 已验证 SteamCMD 首次约 36MB bootstrap 已前移到构建阶段
- 已验证 legacy mod fallback、结构化 mod 状态日志与 slow regression 路径

## 其他说明

- 当前默认架构是“一容器一个 DST 集群（Master + Caves）”。
- 如果你要在同一台宿主机上运行多个集群，更推荐启动多个容器，而不是把多个集群塞进一个容器里。
- 当前仓库附带的 `docker-compose.yml` 仍然是示例模板，便于快速本地试跑；生产环境完全可以按你的目录结构、镜像标签和端口策略自行编写 compose。

## 控制平面 V2

仓库中还在推进一个独立的 `control-plane/` 子项目，用来管理多个 DST 集群。它和现有游戏镜像不是一回事：

- 游戏镜像负责真正运行 DST dedicated server
- 控制平面负责管理集群目录、配置文件、任务和 compose 生命周期

如果你要体验控制平面，请先阅读：

- [control-plane/docs/quickstart.md](control-plane/docs/quickstart.md)
- [control-plane/docs/security.md](control-plane/docs/security.md)
- [control-plane/docs/development.md](control-plane/docs/development.md)
