# 控制平面快速上手

## 当前定位

DST Control Plane V2 当前是第一阶段 alpha：

- 适合同一台主机上的自用场景，或少数可信用户协作使用
- 负责管理多个 DST 集群目录、配置文件和 `docker compose` 生命周期
- 不负责替代公网边界上的反向代理、WAF 或零信任接入

如果你需要的是“直接起 DST 游戏服”，请先看仓库根目录的 [README.md](../../README.md)。控制平面是额外的管理项目，不会替代现有游戏镜像。

## 目录结构

控制平面第一阶段约定一个受控根目录（managed root），默认是 `/opt/dst-control-plane/data`。它下面建议至少包含：

- `app.db`
  控制平面的 SQLite 数据库，只保存管理元数据、任务和审计记录
- `clusters/<slug>/compose/`
  某个集群对应的 `docker-compose.yml` 与 `.env`
- `clusters/<slug>/runtime/steam-state/`
  SteamCMD 状态目录
- `clusters/<slug>/runtime/dst/`
  DST dedicated server 本体
- `clusters/<slug>/runtime/ugc/`
  Workshop/UGC 缓存
- `clusters/<slug>/runtime/data/<ClusterName>/`
  真正的 Cluster 配置、存档、日志与 mods 文件

数据库不是配置真相源。`cluster.ini`、`server.ini`、`cluster_token.txt`、`dedicated_server_mods_setup.lua` 这些文件仍然是最终真相源。

## 启动方式

当前仓库现在提供两条启动路径：

- 开发/本地试跑：
  [control-plane/deploy/docker-compose.control-plane.dev.yml](../deploy/docker-compose.control-plane.dev.yml)
- 单镜像本地部署：
  [control-plane/deploy/docker-compose.control-plane.yml](../deploy/docker-compose.control-plane.yml)

最小流程如下：

1. 进入仓库根目录。
2. 为控制平面准备数据目录，例如 `control-plane/.tmp/local-data/`。
3. 设置管理员账号、密码和会话密钥。
4. 按你的场景选择开发 compose 或单镜像 compose。

建议的最小环境变量：

- `DST_CONTROL_PLANE_LISTEN_ADDR`
  后端监听地址，默认 `:8080`
- `DST_CONTROL_PLANE_DATA_ROOT`
  受控根目录
- `DST_CONTROL_PLANE_ADMIN_USERNAME`
  首个管理员用户名
- `DST_CONTROL_PLANE_ADMIN_PASSWORD`
  首个管理员密码
- `DST_CONTROL_PLANE_SESSION_SECRET`
  会话签名密钥，至少应使用高强度随机值
- `DST_CONTROL_PLANE_EXECUTION_MODE`
  `dry-run` 用于开发验证，`compose` 用于真实执行

开发时推荐先用：

```bash
docker compose -f control-plane/deploy/docker-compose.control-plane.dev.yml up
```

如果只是本地验证 API/页面交互，可以把执行模式设成 `dry-run`，这样“启动/停止/更新/校验”只会生成任务记录，不会真正调用 `docker compose`。

如果你要直接试跑单镜像部署，推荐用：

```bash
docker compose -f control-plane/deploy/docker-compose.control-plane.yml up --build
```

这条路径会：

- 构建一个同时包含 Go 后端和前端静态文件的镜像
- 由同一个进程对外提供 API 和页面
- 把 `/var/run/docker.sock` 挂进容器，让控制平面能真正执行 `docker compose`

请注意，挂载 Docker socket 代表控制平面对宿主机 Docker 拥有较高权限，这只适合当前第一阶段的单机/可信用户场景。

## 创建新集群

控制平面当前支持两种入口：

- 创建新集群
  在受控根目录下生成新的 cluster 布局、compose 文件和默认 ini 文件
- 导入已有集群
  把你已有的 Cluster 目录复制进受控布局，然后继续通过控制平面管理

创建新集群时，控制平面会：

1. 校验 slug，并把集群固定到 `clusters/<slug>/`
2. 生成 compose 与 `.env`
3. 生成默认的 `cluster.ini`、`Master/server.ini`、`Caves/server.ini`
4. 把运行状态初始化为 `stopped`

默认生成的 `cluster_key` 只是占位值，正式使用前应改成你自己的随机值；`cluster_token.txt` 仍需由你向 Klei 申请并放入对应 Cluster 目录。

## 导入已有集群

如果你已经有自己的存档和配置，推荐按下面的方式导入：

1. 准备一个“裸 Cluster 目录”，里面至少有：
   - `cluster.ini`
   - `Master/server.ini`
   - `Caves/server.ini`
2. 如果使用 mods，再补上：
   - `mods/dedicated_server_mods_setup.lua`
   - `Master/modoverrides.lua`
   - `Caves/modoverrides.lua`
3. 如果已经有 `cluster_token.txt`，一并带上。
4. 通过控制平面的导入流程选择这个目录。

第一阶段控制平面只接受受控根目录内的导入源路径，不接受越界目录。这是故意的安全边界，用来避免任意读取宿主机路径。

## 生命周期操作

第一阶段生命周期操作仍然走每个集群自己的 `docker compose`：

- `start`
- `stop`
- `restart`
- `update`
- `validate`

它们的执行边界是该集群目录下的 compose 文件，而不是直接操作 Docker API 对象。

这带来的好处是：

- 真实运行方式与现有 DST 镜像一致
- 生成出来的 compose 文件可以独立迁移、排查、备份
- 第一阶段不需要把控制平面做成强耦合编排器

## 备份与迁移

建议把以下内容纳入备份：

- `app.db`
  保留控制平面的集群元数据、任务和审计记录
- `clusters/<slug>/runtime/data/`
  保留真正的 DST 配置、存档与日志
- `clusters/<slug>/runtime/ugc/`
  如果你希望减少重新下载 mod 的时间
- `clusters/<slug>/runtime/dst/`
  如果你希望减少重新安装 DST 本体的时间

如果只关心游戏存档本身，至少备份 `runtime/data/<ClusterName>/`。

## 当前限制

- 仍然偏向单机、自用、少量可信用户
- 还没有成熟的公网暴露方案，公网部署必须配合反向代理与额外认证
- 还没有完善的细粒度权限模型，当前是单管理员模型
- 前端和后端仍处于 alpha 阶段，升级前应先备份 `app.db` 与集群目录
