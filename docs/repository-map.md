# 仓库文件职责说明

## 先说结论

如果你只是使用镜像起服，真正与你运行结果直接相关的只有：

- 镜像里的运行文件
- 你自己的 compose
- 你自己的挂载目录和 Cluster 配置

仓库里的大多数脚本与测试文件，都是给仓库维护者、本地试跑和 smoke 验证用的，不会 build 进镜像。

## 哪些文件会 build 进镜像

下面这些文件会进入镜像，并直接影响容器运行：

- [Dockerfile](/mnt/d/dst/docker/Dockerfile)
  负责构建镜像、安装依赖、安装 SteamCMD、复制入口脚本和库文件。
- [entrypoint.sh](/mnt/d/dst/docker/entrypoint.sh)
  镜像启动入口。负责 preflight、DST 安装/更新、mod setup 同步、启动 `supervisord`。
- [lib/steamcmd_retry.sh](/mnt/d/dst/docker/lib/steamcmd_retry.sh)
  负责 SteamCMD `Missing configuration` 瞬时失败的有限重试逻辑。
- [lib/legacy_workshop_fallback.sh](/mnt/d/dst/docker/lib/legacy_workshop_fallback.sh)
  负责少数 legacy Workshop mod 的 fallback 下载与解压逻辑。
- [supervisord.conf](/mnt/d/dst/docker/supervisord.conf)
  负责启动并托管 Master 与 Caves 两个 shard 进程。

## 哪些内容是运行时外部数据

下面这些不是 build 进镜像的文件，而是用户运行时提供和持久化的数据：

- `steam-state/`
  SteamCMD 的运行状态、缓存和日志。
- `dst/`
  DST dedicated server 本体安装目录。
- `ugc/`
  Workshop/UGC 缓存目录。
- `data/<cluster>/`
  Cluster 配置、存档、日志、mod 配置。

镜像启动后是否能真正成功起服，很大程度取决于你挂载进去的这些运行时数据是否齐全。

## 哪些脚本只是本地辅助工具

下面这些脚本默认不会 build 进镜像。它们的定位是“本地辅助工具”，不是镜像运行必需条件。

- [scripts/bootstrap-local.sh](/mnt/d/dst/docker/scripts/bootstrap-local.sh)
  一键准备本地运行目录，补 `.env`，必要时生成示例 Cluster。
- [scripts/init-cluster.sh](/mnt/d/dst/docker/scripts/init-cluster.sh)
  从 `examples/Cluster_1` 复制出一个新的示例集群目录。
- [scripts/check-local-config.sh](/mnt/d/dst/docker/scripts/check-local-config.sh)
  宿主机预检脚本。它的目标是让“从源码仓库试跑的人”在真正起容器前，先得到一份更直白的错误反馈。
- [scripts/run-smoke.sh](/mnt/d/dst/docker/scripts/run-smoke.sh)
  统一执行 `fast` / `full` smoke 套件。

## `check-local-config.sh` 到底有什么用

它不是镜像运行必需条件，也不会被容器自动执行。

它的作用是：

- 在宿主机本地提前检查目录和关键文件是否存在
- 检查 token 是否还是示例占位值
- 检查端口有没有明显冲突
- 让从源码仓库直接试跑的人，在 `docker compose up` 之前就能得到更友好的错误信息

如果你不用它，会怎样？

- 仍然可以直接启动容器
- 只是错误会延后到容器内的 `entrypoint.sh` preflight 阶段才暴露出来

所以它更像是：

- 一个开发/维护阶段的 QA 辅助工具
- 而不是发给镜像消费者的强制前置步骤

## 哪些文件只是测试

下面这些文件同样不会 build 进镜像，它们只用于验证仓库实现：

- [tests/smoke](/mnt/d/dst/docker/tests/smoke)
  轻量 smoke 测试，覆盖模板、脚本、entrypoint 分支和一些 Docker 配置回归。
- [tests/slow](/mnt/d/dst/docker/tests/slow)
  慢回归，使用真实 SteamCMD 验证更重的更新链路。

如果你是普通镜像用户，通常不需要关注它们。

## 哪些文件主要是示例和文档

- [examples/Cluster_1](/mnt/d/dst/docker/examples/Cluster_1)
  示例集群模板，用于帮助新建集群或生成测试数据。
- [README.md](/mnt/d/dst/docker/README.md)
  面向镜像使用者的入口文档。
- [docs/migrate-existing-cluster.md](/mnt/d/dst/docker/docs/migrate-existing-cluster.md)
  面向迁移旧集群的用户文档。
- [docs/verification.md](/mnt/d/dst/docker/docs/verification.md)
  面向维护者的验证记录、外部资料和已知问题说明。

## 推荐的两条使用路径

### 路径 1：镜像使用者

如果你是最终用户或朋友，只需要：

1. 获取镜像
2. 写自己的 compose
3. 准备挂载目录
4. 提供 Cluster 配置
5. 启动容器

这条路径通常不需要执行任何仓库脚本。

### 路径 2：仓库维护者

如果你在修改镜像、脚本或控制流，则通常会用到：

1. `scripts/bootstrap-local.sh`
2. `scripts/init-cluster.sh`
3. `scripts/check-local-config.sh`
4. `scripts/run-smoke.sh`
5. `tests/smoke/*`
6. `tests/slow/*`

这条路径服务于开发、验证和回归，不是普通用户的主路径。
