# 迁移已有 Cluster 指南

## 适用场景

这份指南适用于以下情况：

- 你已经有一个可用的 DST Cluster 目录
- 你想把现有存档、设置、世界配置迁移到当前镜像
- 你没有现成的 `ugc/`、`dst/`、`steam-state/` 缓存也没关系
- 你可以调整 compose，但不希望被迫大改现有 Cluster 目录内的文件

## 可以不带哪些目录

迁移时，你可以只有现成的 `Cluster` 目录，而没有下面这些缓存目录：

- `dst/`
- `ugc/`
- `steam-state/`

这是可行的。首次启动时：

- `/opt/dst` 缺失本体时，镜像会自动通过 SteamCMD 安装 DST dedicated server
- `/ugc` 缺失缓存时，后续 mod 下载会自动写入
- `/steam-state` 缺失时，镜像会自动创建并在后续运行中持久化 SteamCMD 状态

也就是说，真正必须准备的是 Cluster 配置和存档本身。

## 迁移时必须有的文件

在 `data/<你的集群目录名>/` 下，至少需要：

- `cluster.ini`
- `cluster_token.txt`
- `Master/server.ini`
- `Caves/server.ini`

如果你的旧世界用了 mods，还需要：

- `mods/dedicated_server_mods_setup.lua`
- `Master/modoverrides.lua`
- `Caves/modoverrides.lua`

重点说明：

- 没有 `ugc` 缓存可以
- 没有 `dst/mods` 缓存也可以
- 但如果世界依赖 mods，却没有 `dedicated_server_mods_setup.lua`，镜像就不知道要去下载哪些 mod

## `cluster_token.txt` 和 `cluster_key` 不是一回事

- `cluster_token.txt`
  来自 Klei，是集群在官方服务侧注册所需的 token。
- `cluster.ini` 里的 `cluster_key`
  是同一个集群内各 shard 共用的内部密钥，用于分片之间认证。它不是 Klei 自动生成给你的值，通常由你自己生成并长期保存。

如果你迁移的是已有双分片集群，通常直接保留原来的 `cluster_key` 即可。

## 目录名是否必须改成 `Cluster_1`

不需要。

你只需要确保两件事一致：

1. 宿主机实际目录名
2. 容器环境变量 `DST_CLUSTER_NAME`

例如，你原来的目录名叫 `MyOldWorld`，那就让宿主机挂载中存在：

```text
./data/MyOldWorld
```

然后在 compose 里设置：

```yaml
environment:
  DST_CLUSTER_NAME: MyOldWorld
```

镜像会去读取 `/data/MyOldWorld/...`，不要求你改成 `Cluster_1`。

## 端口怎么理解

请把端口分成三类：

- `cluster.ini` 的 `master_port`
  Master 与 Caves 分片内部协同端口，通常不需要对宿主机公开。
- `Master/server.ini` 和 `Caves/server.ini` 的 `server_port`
  各 shard 的游戏监听端口。
- 两个 `server.ini` 的 `master_server_port`
  DST/Steam 相关端口。

Docker 的端口映射语义是：

```text
宿主机端口:容器内端口/udp
```

因此：

- compose 左边的宿主机端口，你可以自由决定
- compose 右边的容器内端口，必须和你实际 `server.ini` 中的端口一致
- 镜像本身不会在运行时重写你的 ini 端口

例如，你原来的配置是：

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

如果你想宿主机也继续沿用原始端口，同样可以写成：

```yaml
ports:
  - "12345:12345/udp"
  - "12346:12346/udp"
  - "23456:23456/udp"
  - "23457:23457/udp"
```

## 推荐迁移步骤

1. 准备宿主机目录：
   - `steam-state/`
   - `dst/`
   - `ugc/`
   - `data/`
2. 把你原有的 Cluster 目录放到：
   - `data/<你的集群目录名>/`
3. 检查至少存在：
   - `cluster.ini`
   - `cluster_token.txt`
   - `Master/server.ini`
   - `Caves/server.ini`
4. 如果原世界用了 mods，补齐：
   - `mods/dedicated_server_mods_setup.lua`
   - 两个 shard 的 `modoverrides.lua`
5. 在 compose 里设置：
   - `DST_CLUSTER_NAME=<你的集群目录名>`
6. 按你的真实 `server.ini` 端口修改 compose 的右侧目标端口
7. 选择你想暴露的宿主机端口，填写 compose 左侧端口
8. 启动容器

## 首次迁移启动时会发生什么

首次启动时，典型流程如下：

1. 入口脚本确认必须目录和配置文件存在
2. 如果 `dst/` 里没有 DST 本体，则自动安装
3. 如果存在 `dedicated_server_mods_setup.lua`，则同步到 `/opt/dst/mods`
4. 根据 `DST_SERVER_MODS_UPDATE_MODE` 决定 mod 是运行时更新、预热更新，还是只复用现有缓存
5. 启动 Master 与 Caves

因此：

- 没有 `dst/` 缓存，不是问题
- 没有 `ugc/` 缓存，不是问题
- 没有 `steam-state/` 缓存，不是问题
- 缺少 Cluster 核心配置文件，才会真正阻塞启动

## 关于仓库里的辅助脚本

如果你是直接使用镜像迁移，通常不需要运行仓库里的：

- `scripts/bootstrap-local.sh`
- `scripts/init-cluster.sh`
- `scripts/check-local-config.sh`
- `scripts/run-smoke.sh`

这些脚本主要面向仓库维护、从源码本地试跑或做 smoke 验证的人。

## 常见误区

- 误区 1：没有 `ugc/` 就不能迁移
  不对。`ugc/` 只是缓存目录，可以后续自动生成。
- 误区 2：没有 `dst/` 就不能迁移
  不对。镜像默认 `install-only`，首次会自动安装 DST 本体。
- 误区 3：只要有 `modoverrides.lua` 就能自动下载 mod
  不对。下载列表仍然需要 `dedicated_server_mods_setup.lua`。
- 误区 4：必须把旧 Cluster 的目录名改成 `Cluster_1`
  不对。只要 `DST_CLUSTER_NAME` 与目录名一致即可。
- 误区 5：必须使用仓库自带的辅助脚本
  不对。直接写自己的 compose 并挂载目录即可。
