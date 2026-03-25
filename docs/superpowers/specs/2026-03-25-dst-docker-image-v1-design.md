# DST Docker 镜像 V1 设计文档

## 概述

本项目要构建一个轻量、透明、可维护的《饥荒联机版》专用服务器 Docker 镜像。

V1 聚焦于一个最小但可用的运行骨架：

- 单容器
- 基于 Debian 的镜像
- 镜像内置 SteamCMD
- DST 服务端本体不打进镜像层，而是持久化在外部目录
- Master 和 Caves 在同一个容器内运行
- 默认更新模式为 `install-only`
- 启动时输出明确的路径与行为日志

V1 不包含 Web 面板、多集群编排、自动备份或复杂的健康检查平台。

## 目标

- 保持路径清晰、固定、可理解
- 尽量减少重复下载和黑盒式启动行为
- 支持单容器运行 Master + Caves
- 支持 dedicated server mod，且职责边界明确
- 将更新行为设计为用户显式控制，而不是默认隐式执行
- 交付一个可分发、可复用、可通过 compose 启动的基础镜像

## 非目标

- Web 管理后台
- 自动备份工作流
- 多 cluster 调度与编排
- 重 sidecar 的复杂架构
- 完整的生产级可观测性平台

## 架构设计

### 容器模型

V1 使用一个容器承载两个 shard：

- `entrypoint.sh` 负责所有启动前准备逻辑
- `supervisord` 负责管理长驻的 shard 进程
- Master 和 Caves 以两个独立进程运行

这样可以把职责拆清楚：

- 启动前行为归 `entrypoint.sh`
- 进程生命周期归 `supervisord`
- DST 本身只负责游戏服务运行

### 基础镜像

V1 采用 Debian 系基础镜像。

原因：

- 对 SteamCMD 和游戏二进制的兼容性风险更低
- 排障成本低于 Alpine
- 更适合作为第一个保守可用版本

Alpine 暂不纳入 V1，因为它的体积优势不足以覆盖额外的兼容性和调试成本。

## 运行目录设计

本设计会明确区分三类信息：

- 已有一手依据确认的机制
- 本项目主动选择的工程约定
- 在实现阶段必须继续验证的假设

### 已确认的机制

根据 Klei 官方 dedicated server 命令行文档：

- cluster 和 shard 的查找由 `-persistent_storage_root`、`-conf_dir`、`-cluster`、`-shard` 控制
- `Cluster_1` 是默认 cluster 名称
- `-ugc_directory` 是官方支持的服务端参数，用于 mod 相关目录查找

根据 Valve 官方 SteamCMD 文档：

- `app_update 343050` 用于安装或更新 DST dedicated server
- `validate` 会在更新基础上增加完整性校验，并可能覆盖被修改过的默认文件

### V1 的工程约定

下面这些是本项目的目录约定，不代表 Klei 或 Valve 把这些路径写死在程序里：

- `/opt/steamcmd`
  - 镜像内 SteamCMD 所在目录，以及镜像默认采用的主要 Steam 状态持久化位置
- `/opt/dst`
  - DST dedicated server 本体安装目录
- `/ugc`
  - 默认的 UGC/workshop 持久化目录，并通过 `-ugc_directory /ugc` 传给服务端
- `/data`
  - dedicated server 数据根目录
- `/data/Cluster_1`
  - V1 固定使用的 cluster 根目录

### 各目录职责

- `/opt/steamcmd`
  - 存放 SteamCMD 程序，以及容器内主要的 Steam 运行状态
- `/opt/dst`
  - 存放 DST dedicated server 本体，以及安装目录下的 `mods` 目录
- `/ugc`
  - 存放通过 `-ugc_directory` 指向的 workshop/UGC 内容
- `/data/Cluster_1`
  - 存放 `cluster.ini`、`cluster_token.txt`、分片配置、存档数据，以及用户维护的 mod 下载配置
- `/opt/dst/mods`
  - 作为 `dedicated_server_mods_setup.lua` 的运行时同步目标

### 必须验证的假设

- `/opt/steamcmd` 是否覆盖了避免重复 bootstrap 所需的全部 Steam 状态目录
- `-ugc_directory /ugc` 在实践中是否能稳定承载我们关心的 workshop 内容
- 将 `dedicated_server_mods_setup.lua` 同步到 `/opt/dst/mods` 是否是稳定可靠的必要条件

## 启动流程与更新模式

### 启动流程

`entrypoint.sh` 应按固定顺序执行以下阶段：

1. 输出启动摘要日志
2. 创建或校验所需目录
3. 判断 `DST_UPDATE_MODE`
4. 根据模式执行 install、update、validate 或跳过
5. 将 `dedicated_server_mods_setup.lua` 同步到 `/opt/dst/mods`
6. 校验必需配置文件是否存在
7. 交给 `supervisord` 启动并管理 shard 进程

### 启动摘要日志

启动日志至少要输出：

- 当前 `DST_UPDATE_MODE`
- 当前 cluster 名称
- DST 目录
- SteamCMD 目录
- UGC 目录
- data 目录
- 本次是否执行 install、update 或 validate
- 本次是否执行 mod setup 同步

### 更新模式

#### `install-only`（默认）

- 如果 DST 尚未安装，则执行安装
- 如果 DST 已存在，则跳过联网更新检查
- 然后继续启动服务端

之所以作为默认值，是因为当前项目更重视启动稳定性和可预测性，而不是每次启动都去追最新版本。

#### `update`

- 执行 `steamcmd +app_update 343050`
- 完成后继续启动服务端

这个模式只用于用户明确需要更新 DST 本体时，不作为日常启动默认行为。

#### `validate`

- 执行 `steamcmd +app_update 343050 validate`
- 完成后继续启动服务端

这个模式是修复路径，不是默认路径。因为 `validate` 可能覆盖默认文件，所以 mod setup 的同步必须放在它之后。

#### `never`

- 不安装
- 不更新
- 若 DST 本体不存在则直接失败退出

这个模式只适合需要完全手动控制安装与更新节奏的高级用户。

### 用户如何触发更新

用户通过容器环境变量切换 `DST_UPDATE_MODE`。

典型流程如下：

- compose 默认写成 `install-only`
- 需要更新时，临时改为 `update`
- 重启容器
- 更新完成后，再改回 `install-only`

这样符合 Docker 的正常使用习惯，不需要用户进入容器手工执行命令。

## mod 职责划分

V1 必须明确区分 mod 的三个职责：

- 下载
- 启用
- 配置

### 下载来源

用户维护的源文件为：

- `/data/Cluster_1/mods/dedicated_server_mods_setup.lua`

在 shard 启动前，镜像将其同步到：

- `/opt/dst/mods/dedicated_server_mods_setup.lua`

这一设计建立在较强的实测经验与社区讨论基础上，但仍属于项目内需要继续验证的行为假设。

### 启用与配置

各 shard 的启用与配置统一读取：

- `/data/Cluster_1/Master/modoverrides.lua`
- `/data/Cluster_1/Caves/modoverrides.lua`

职责边界如下：

- `dedicated_server_mods_setup.lua` 回答“要下载哪些 mod”
- `modoverrides.lua` 回答“这个 shard 是否启用某个 mod，以及它的具体配置是什么”

### mod 下载时机

当前设计采用如下时序假设：

- SteamCMD 先准备好 DST 服务端本体
- 然后把 setup 文件同步到运行时 `mods` 目录
- 最后由 shard 启动过程触发 workshop/server mod 的处理

这符合当前最强的证据链，但仍然属于实现阶段必须验证的事项，而不是可以直接当成厂商正式规格的结论。

## 失败模型

V1 应当明确失败，而不是在配置不完整时“半成功”地继续往下跑。

遇到以下情况时，容器应带着清晰日志直接退出：

- 在 `never` 模式下找不到 DST 本体
- 缺少 `/data/Cluster_1/cluster.ini`
- 缺少 `/data/Cluster_1/cluster_token.txt`
- 缺少 `/data/Cluster_1/Master/server.ini`
- 缺少 `/data/Cluster_1/Caves/server.ini`

日志需要明确指出：

- 缺了哪个文件
- 它影响的是安装、启动还是 mod 行为

## 验证策略

V1 只有在关键假设被验证并记录后，才能算真正完成。

### 必做验证项

- 空的 DST 目录 + `install-only`
  - 预期：自动安装后开服
- 已有 DST 本体 + `install-only`
  - 预期：跳过更新，直接开服
- 已有 DST 本体 + `update`
  - 预期：执行更新后开服
- 已有 DST 本体 + `validate`
  - 预期：执行校验，重新同步 mod setup，然后开服
- `-ugc_directory /ugc` 的实际落盘行为
  - 预期：记录 workshop 资源实际落在哪些目录
- mod setup 同步效果
  - 预期：验证同步到 `/opt/dst/mods` 是否足以稳定触发下载
- SteamCMD 状态持久化行为
  - 预期：找出哪些目录必须持久化，才能避免重复 bootstrap

### 证据记录要求

验证结果不能只留在口头经验里，必须写入项目文档。

至少应区分：

- 哪些是官方已有文档支撑的
- 哪些是工程推断
- 哪些是实验验证得到的
- 哪些仍然存在不确定性

## 交付物

V1 应至少交付以下受版本管理的文件：

- `Dockerfile`
- `entrypoint.sh`
- `supervisord.conf`
- `docker-compose.yml`
- `.env.example`
- `README.md`
- `docs/verification.md` 或等价的验证记录文档
- `AGENTS.md`
- `.gitignore`

## 仓库协作约定

仓库应在 `AGENTS.md` 中明确协作与提交规范。

至少包含：

- 使用 Conventional Commits
- Git commit `subject` 使用英文
- Git commit `body` 必填，并使用中文
- 除非明确要求，否则不使用 amend
- 在宣称完成前先完成相应验证
- 用户文档默认中文
- 开发文档默认中文
- 代码标识符、路径、命令、环境变量保持英文

## 本地私有资料目录

仓库应预留一个本地专用、被 git 忽略的资料目录，用于存放用户提供的临时观察、草稿和私人工作资料。

建议目录名：

- `.local-notes/`

这个目录不参与版本管理，和正式交付文档分开。

## V1 完成标准

只有满足以下全部条件，V1 才算完成：

- 镜像可以成功构建
- 容器在首次启动时能完成 DST 安装并开服
- 容器在 DST 已存在时能直接启动
- 用户可以通过环境变量触发 update 模式
- Master 和 Caves 均由 supervisor 管理
- 启动日志足够清楚，能解释容器当前行为
- mod setup 同步链路已实现并经过验证
- UGC 行为已被观察并记录
- SteamCMD 持久化行为已被观察并记录

## 参考来源

- [Klei Dedicated Server Command Line Options Guide](https://support.klei.com/hc/en-us/articles/360029556192-Dedicated-Server-Command-Line-Options-Guide)
- [Valve Developer Community: SteamCMD](https://developer.valvesoftware.com/wiki/SteamCMD)
- [Klei forum discussion on `dedicated_server_mods_setup.lua`](https://forums.kleientertainment.com/forums/topic/64363-dedicated_server_mods_setuplua-not-getting-read/)
- [Klei forum discussion on server mods and `modoverrides.lua`](https://forums.kleientertainment.com/forums/topic/93107-a-ubuntu-server-mod-questionthanks/)
- [Klei bug tracker report on `validate` resetting config](https://forums.kleientertainment.com/klei-bug-tracker/dont-starve-together/dedicated-server-linux-validate-option-steamcmd-clears-some-essential-config-files-to-default-r24623/)
