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
- `DST_CONTROL_PLANE_SESSION_TTL`
  会话 token 与 cookie 的有效期，默认 `12h`
- `DST_CONTROL_PLANE_SESSION_COOKIE_SECURE`
  是否给会话 cookie 打上 `Secure`，默认 `false`；在 HTTPS 反代场景建议设成 `true`
- `DST_CONTROL_PLANE_EXECUTION_MODE`
  `dry-run` 用于开发验证，`compose` 用于真实执行
- `DST_CONTROL_PLANE_LOGIN_RATE_LIMIT_MAX_ATTEMPTS`
  登录失败限流阈值，默认 `5`
- `DST_CONTROL_PLANE_LOGIN_RATE_LIMIT_WINDOW`
  登录失败限流时间窗，默认 `5m`

开发时推荐先用：

```bash
docker compose -f control-plane/deploy/docker-compose.control-plane.dev.yml up
```

如果只是本地验证 API/页面交互，可以把执行模式设成 `dry-run`，这样“启动/停止/更新/校验”只会生成任务记录，不会真正调用 `docker compose`。

如果你不是通过前端页面，而是自己用 `curl` 或脚本直接调用控制平面写接口，需要额外带上：

```text
X-DST-Control-Plane-CSRF: 1
```

当前要求这个 header 的接口包括登录、退出、create/import、config save、lifecycle action。

如果你要直接试跑单镜像部署，推荐用：

```bash
docker compose -f control-plane/deploy/docker-compose.control-plane.yml up --build
```

这条路径会：

- 构建一个同时包含 Go 后端和前端静态文件的镜像
- 由同一个进程对外提供 API 和页面
- 把 `/var/run/docker.sock` 挂进容器，让控制平面能真正执行 `docker compose`

请注意，挂载 Docker socket 代表控制平面对宿主机 Docker 拥有较高权限，这只适合当前第一阶段的单机/可信用户场景。

如果你希望在真正导入自己的集群前，先确认这套控制平面“当前到底能不能用”，建议继续看：

- [control-plane/docs/verification.md](verification.md)
- [control-plane/docs/troubleshooting.md](troubleshooting.md)

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

在创建向导进入 Review 步骤后，页面现在还会主动执行一次预检（preflight）预览，提前告诉你：

- token 或 `cluster_key` 是否缺失
- `cluster.ini` / `server.ini` 是否存在明显结构问题
- Master / Caves shard 结构是否不合理
- 与其他已纳管集群之间是否存在宿主机端口冲突

如果存在 `fatal` 级别问题，Review 区会直接显示阻断项。即使你勾选了 `Auto start after creation`，控制平面也会在创建后阻止自动启动，而不是等 `start` 失败后再让你从任务日志里倒推原因。

默认生成的 `cluster_key` 只是占位值，正式使用前应改成你自己的随机值；`cluster_token.txt` 仍需由你向 Klei 申请并放入对应 Cluster 目录。

当前标准闭环 UI 已经把这条创建链路固定成“列表页 -> 向导 -> 详情页”三段：

- 列表页负责选择当前集群和展示运行摘要
- 创建向导负责生成一个可长期管理的 `Master + Caves` 集群
- 详情页负责后续的运行控制、配置编辑、日志查看和备份恢复

## 导入已有集群

如果你已经有自己的存档和配置，推荐按下面的方式导入：

1. 准备一个 Cluster 目录，里面至少有：
   - `cluster.ini`
   - `Master/server.ini`
   - `Caves/server.ini`
2. 如果使用 mods，再补上：
   - `mods/dedicated_server_mods_setup.lua`
   - `Master/modoverrides.lua`
   - `Caves/modoverrides.lua`
3. 如果已经有 `cluster_token.txt`，一并带上。
4. 通过控制平面的导入流程选择这个目录。

导入时，控制平面会递归复制这个目录里的现有内容。所以如果你的源目录里已经包含存档、`saveindex`、`mods/`、世界生成配置或其他 shard 相关文件，它们也会一并被带入受控布局，而不只是复制三份 ini。

第一阶段控制平面只接受受控根目录内的导入源路径，不接受越界目录。这是故意的安全边界，用来避免任意读取宿主机路径。

## 集群详情页现在能做什么

当前详情页已经按“长期管理”思路收敛成一个固定工作区，Overview 模式下至少包含下面六类信息和操作：

- 状态总览
  展示当前状态、显示名称、slug、房间摘要和最近更新时间。
- 运行控制
  支持 `start`、`stop`、`restart`、`update`、`validate`、`backup`。
- 基础配置
  可以直接编辑房间名称和描述，不需要先切到原文模式。
- 端口与连接
  会优先显示当前集群真实的宿主机映射端口；如果还没有单独映射值，则回退到配置快照里的默认端口。
- 就绪度（Readiness）
  会读取当前集群的统一预检报告，展示 `ready/blocked` 状态、fatal/warning 数量，以及每条阻断/警告项的摘要、细节和修复提示。
- 日志
  当前只支持三类基础日志源：`jobs`、`master`、`caves`，以“最近片段 + 手动刷新”为边界。
- 备份与恢复
  支持刷新备份列表、下载备份、恢复指定归档。

有两个需要特别知道的护栏：

- 恢复备份只会在 `stopped` 集群上显示；运行中集群不会提供 restore 按钮。
- 删除集群同样只允许在 `stopped` 状态下执行，并且仍要求输入 slug 做确认。

## 生命周期操作

第一阶段生命周期操作仍然走每个集群自己的 `docker compose`：

- `start`
- `stop`
- `restart`
- `update`
- `validate`
- `backup`

其中 `backup` 不会调用 `docker compose`，而是直接把当前集群的 `runtime/data/<ClusterName>/` 打成 `.tar.gz` 归档，放到该集群目录下的 `meta/backups/`。这份归档可以直接作为后续迁移、手工保留或额外离线备份的基础材料。
备份完成后，Overview 页面里的 Backups 区会列出已生成归档，并直接提供下载链接。

其中 `start` 现在会先执行一次后端预检：

- 如果没有 `fatal` 项，才会继续进入 runtime / compose 执行链
- 如果存在 `fatal` 项，任务会直接失败，并在错误摘要里明确写出是 preflight 阻断，而不是模糊地显示为 compose 异常

`restore` 当前也已经接入同一条详情页工作流，但与其他生命周期动作不同：

- 它不会在运行中集群上暴露入口
- 支持恢复最新备份，也支持恢复指定归档
- 执行完成后，详情页会主动刷新 jobs、audit、backups 和 cluster 状态，而不是只在局部静默更新

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

当前已经支持删除集群，但有两个明确护栏：

- 只有 `stopped` 集群允许删除
- 删除前必须在页面里输入该集群的 slug 作为确认

删除会移除受控根目录下对应的集群目录和元数据记录，所以在执行前应确认你已经完成备份。

如果你只是想暂时停用某个集群，而不是永久删除，应该优先使用 `stop`，不要直接删除。

- 仍然偏向单机、自用、少量可信用户
- 还没有成熟的公网暴露方案，公网部署必须配合反向代理与额外认证
- 还没有完善的细粒度权限模型，当前是单管理员模型
- 前端和后端仍处于 alpha 阶段，升级前应先备份 `app.db` 与集群目录
