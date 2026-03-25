# DST Docker 运行说明

## 项目目标
本仓库在现有的 `Dockerfile`、`entrypoint.sh` 和 `supervisord.conf` 基础上，提供一个可直接运行的 `docker-compose.yml`，搭配 `.env` 模板和中文文档，帮助用户在本地快速启动一个完整的 DST dedicated server（Master + Caves）。

## 目录职责
- `./steamcmd`：容器内 SteamCMD 所在目录，也是 `entrypoint.sh` 启动时需要的 Steam 状态持久化位置。
- `./dst`：DST dedicated server 的安装目录（`/opt/dst`），包含二进制、`mods` 目录以及由 `dedicated_server_mods_setup.lua` 同步进来的内容。
- `./ugc`：`-ugc_directory` 指向的工作组/用户自定义内容目录，务必挂载以避免 Workshop 下载重复。
- `./data`：专门用于存放对应 `DST_CLUSTER_NAME` 的配置、存档与 mod 资料，默认例子仍是 `Cluster_1`：
  - `./data/<DST_CLUSTER_NAME>/cluster.ini` 与 `cluster_token.txt`
  - `./data/<DST_CLUSTER_NAME>/Master/server.ini` 与 `./data/<DST_CLUSTER_NAME>/Caves/server.ini`
  - `./data/<DST_CLUSTER_NAME>/mods/dedicated_server_mods_setup.lua`（mod 下载列表）
- `./data/<DST_CLUSTER_NAME>`：`DST_CLUSTER_NAME` 与 `./data` 下的集群目录必须保持一致，修改变量值时务必同步重命名或新建对应目录并补齐配置文件。

## 首次启动行为
`entrypoint.sh` 会按顺序执行：
1. 确认 `./steamcmd`、`./dst`、`./ugc`、`./data/<DST_CLUSTER_NAME>` 等目录存在，并创建缺失项。
2. 检查必须的配置文件（`./data/<DST_CLUSTER_NAME>/cluster.ini`、`./data/<DST_CLUSTER_NAME>/cluster_token.txt`、两个 shard 的 `server.ini`）。
3. 根据 `DST_UPDATE_MODE` 决定是否通过 SteamCMD 安装/更新（默认 `install-only` 只在首次无 binary 时安装）。
4. 将 `./data/<DST_CLUSTER_NAME>/mods/dedicated_server_mods_setup.lua` 同步到 `/opt/dst/mods`。
5. 向 `supervisord` 交付 Master 与 Caves 进程。

## 更新模式切换
1. 复制 `.env.example` 为 `.env` 并根据需要调整：「`cp .env.example .env`」。
2. 将 `DST_UPDATE_MODE` 设置为 `update`（或 `validate`），保存 `.env`。
3. 执行 `docker compose up --build`，容器启动时会执行 `steamcmd +app_update 343050`（`validate` 会附带 `validate` 参数并可能覆盖默认文件，entrypoint 会在 SteamCMD 完成后自动同步 mod setup）。
4. 更新完成后，再将 `DST_UPDATE_MODE` 改回 `install-only`，重启容器以恢复常规启动流程。

## mod 配置职责
- `dedicated_server_mods_setup.lua`（位于 `./data/<DST_CLUSTER_NAME>/mods/`）负责回答 “要下载哪些 Workshop/server mods”，它会被同步到 `/opt/dst/mods`，让 DST 本体在启动前得以触发下载/更新。
- `modoverrides.lua`（`./data/<DST_CLUSTER_NAME>/Master/modoverrides.lua` 与 `./data/<DST_CLUSTER_NAME>/Caves/modoverrides.lua`）负责回答 “每个 shard 是否启用某个 mod 以及具体配置是什么”，Klei 的 shard 配置只会读取这个文件。
- 该分工的好处是：`dedicated_server_mods_setup.lua` 统筹下载行为，`modoverrides.lua` 遵循 shard 级别的启用/配置策略。

## 验证状态
- 已验证：
  - `docker compose config` 能够解析当前 `docker-compose.yml` 且展现了 `.env` 中的 `DST` 环境变量。
- 待验证：
  - `update`/`validate` 模式在真实 Workshop mod 场景中的实际效果；
  - `UGC`（`/ugc`）目录是否完全覆盖 SteamCMD 的下载落盘位置；
  - `./data` 下的 mod 配置在多 shard 启动过程中的稳定性；
  - 其他 DST 更新参数与 mod 下载的完整性。

## 其他说明
- 目录挂载后的第一级路径（`steamcmd`、`dst`、`ugc`、`data`）必须由用户提前创建并赋予合适权限。
- 当前的 compose 版本只依赖本地构建，后续可考虑用远程镜像替代。
