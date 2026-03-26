# DST Docker 运行说明

## 项目目标
本仓库在现有的 `Dockerfile`、`entrypoint.sh` 和 `supervisord.conf` 基础上，提供一个可直接运行的 `docker-compose.yml`，搭配 `.env` 模板和中文文档，帮助用户在本地快速启动一个完整的 DST dedicated server（Master + Caves）。

## 快速准备
如果你想先把目录跑起来，再按需微调，建议直接从 [`examples/Cluster_1`](/mnt/d/DST/docker/examples/Cluster_1) 复制：

1. 运行 `bash scripts/bootstrap-local.sh Cluster_1`
2. 编辑 `data/Cluster_1/cluster_token.txt`，填入你自己的 token
3. 按需修改 `cluster.ini`、`Master/server.ini`、`Caves/server.ini`、`modoverrides.lua`
4. 再执行 `docker compose up --build`

`bootstrap-local.sh` 会自动：

- 创建 `steam-state/`、`dst/`、`ugc/`、`data/`
- 在缺失时复制 `.env.example` 为 `.env`
- 把 `.env` 里的 `DST_CLUSTER_NAME` 调整为你指定的名字
- 调用 `init-cluster.sh` 生成 `data/<cluster>`

如果你不想用脚本，也可以手动复制 [`examples/Cluster_1`](/mnt/d/DST/docker/examples/Cluster_1) 到 `data/Cluster_1`，再把 `cluster_token.txt.example` 重命名为 `cluster_token.txt`。

如果宿主机 UDP 端口已经被占用，可以在 `.env` 里覆盖：

- `DST_MASTER_HOST_PORT`
- `DST_CAVES_HOST_PORT`
- `DST_STEAM_HOST_PORT`

## 回归检查
如果你改了脚本、文档或镜像逻辑，建议至少跑一次：

- `bash scripts/run-smoke.sh fast`

如果你还想把依赖 Docker 的 smoke 一起跑掉，则使用：

- `bash scripts/run-smoke.sh full`

如果只是想在起服前检查本地准备是否齐全，可以先运行：

- `bash scripts/check-local-config.sh`

如果你是第一次在本地准备运行目录，建议按这个顺序：

1. `bash scripts/bootstrap-local.sh Cluster_1`
2. 编辑 `data/Cluster_1/cluster_token.txt`
3. `bash scripts/check-local-config.sh`
4. `docker compose up --build`

## 目录职责
- `/usr/local/steamcmd`：SteamCMD 程序文件被固定安装在镜像内的此路径，`entrypoint.sh` 直接调用 `/usr/local/steamcmd/steamcmd.sh`，因此用户无法通过挂载覆盖程序。
- `./steam-state`：挂载到容器的 `/steam-state` 目录，为 SteamCMD 的 `HOME` 提供持久化状态（缓存、安装临时文件等），也就是唯一对外暴露的 Steam 状态目录。
- SteamCMD 首次 36MB 程序自更新现在已经前移到镜像构建阶段，因此运行时不再需要额外完成这一步 bootstrap；`./steam-state` 主要承接运行状态、日志与 app/depot cache，而不是承接 SteamCMD 程序本体升级。
- `./dst`：DST dedicated server 的安装目录（`/opt/dst`），包含二进制、`mods` 目录以及由 `dedicated_server_mods_setup.lua` 同步进来的内容。
- `./ugc`：`-ugc_directory` 指向的工作组/用户自定义内容目录，务必挂载以避免 Workshop 下载重复。
- `./data`：专门用于存放对应 `DST_CLUSTER_NAME` 的配置、存档与 mod 资料，默认例子仍是 `Cluster_1`：
  - `./data/<DST_CLUSTER_NAME>/cluster.ini` 与 `cluster_token.txt`
  - `./data/<DST_CLUSTER_NAME>/Master/server.ini` 与 `./data/<DST_CLUSTER_NAME>/Caves/server.ini`
  - `./data/<DST_CLUSTER_NAME>/mods/dedicated_server_mods_setup.lua`（mod 下载列表）
- `./data/<DST_CLUSTER_NAME>`：`DST_CLUSTER_NAME` 与 `./data` 下的集群目录必须保持一致，修改变量值时务必同步重命名或新建对应目录并补齐配置文件。

## 首次启动行为
`entrypoint.sh` 会按顺序执行：
1. 确认 `./steam-state`、`./dst`、`./ugc`、`./data/<DST_CLUSTER_NAME>` 等目录存在，并创建缺失项。
2. 检查必须的配置文件（`./data/<DST_CLUSTER_NAME>/cluster.ini`、`./data/<DST_CLUSTER_NAME>/cluster_token.txt`、两个 shard 的 `server.ini`），并自动补齐空的 `adminlist.txt`、`blocklist.txt`、`whitelist.txt`。
3. 根据 `DST_UPDATE_MODE` 决定是否通过 SteamCMD 安装/更新（默认 `install-only` 只在首次无 binary 时安装）。
4. 将 `./data/<DST_CLUSTER_NAME>/mods/dedicated_server_mods_setup.lua` 同步到 `/opt/dst/mods`。
5. 根据 `DST_SERVER_MODS_UPDATE_MODE` 决定 server mods 的更新策略。
6. 向 `supervisord` 交付 Master 与 Caves 进程。

补充说明：
- SteamCMD 的 `app_update 343050` 在当前环境下偶发返回 `ERROR! Failed to install app '343050' (Missing configuration)`。镜像现在会仅针对这个已验证的瞬时错误自动重试一次；如果第二次仍失败，容器仍会照常退出，不会无限重试掩盖真实问题。

## 更新模式切换
1. 复制 `.env.example` 为 `.env` 并根据需要调整：「`cp .env.example .env`」。
2. 将 `DST_UPDATE_MODE` 设置为 `update`（或 `validate`），保存 `.env`。
3. 执行 `docker compose up --build`，容器启动时会执行 `steamcmd +app_update 343050`（`validate` 会附带 `validate` 参数并可能覆盖默认文件，entrypoint 会在 SteamCMD 完成后自动同步 mod setup）。
4. 更新完成后，再将 `DST_UPDATE_MODE` 改回 `install-only`，重启容器以恢复常规启动流程。

## Server Mod 更新模式
`DST_SERVER_MODS_UPDATE_MODE` 只影响 `dedicated_server_mods_setup.lua` 对应的 Workshop server mods，不影响 SteamCMD 的 DST 本体安装/更新。

- `runtime`：默认值。由 Master/Caves 在各自启动时自行检查和下载 mod。优点是逻辑最贴近 DST 原生行为；缺点是首次冷缓存时两个 shard 可能并发访问 Workshop，日志也会更嘈杂。
- `prewarm`：entrypoint 先用 DST 二进制的 `-only_update_server_mods` 预热一次 mod 缓存，随后再让 Master/Caves 以 `-skip_update_server_mods` 启动。优点是首次冷缓存更稳定，两个 shard 会直接复用 `/ugc` 已经下载好的内容；缺点是正式开服前会多一个预热阶段。
- `skip`：完全跳过 shard 启动阶段的 mod 更新，要求你已经有可用的 `/ugc` 缓存。适合已知缓存完整、想压低启动噪音或避免访问 Workshop 的场景。
- 无论使用哪种模式，只要存在 `dedicated_server_mods_setup.lua`，entrypoint 都会先打印一份缓存摘要，例如 `ugc workshop-...` / `local workshop-...` / `missing workshop-...`，方便你快速判断当前究竟是 `/ugc` 缓存命中、还是本地 fallback 命中、还是依旧缺失。
- 当 `runtime` 或 `prewarm` 遇到“Steam metadata 中仍公开 `file_url` 的 legacy Workshop mod”且 `/ugc` 中没有对应缓存时，entrypoint 会额外查询 Steam metadata，并把 zip 解到 `/opt/dst/mods/workshop-<id>` 作为本地 fallback。`skip` 模式不会主动触发这条联网 fallback，只会复用现有的 `ugc` / `local` 内容。

## mod 配置职责
- `dedicated_server_mods_setup.lua`（位于 `./data/<DST_CLUSTER_NAME>/mods/`）负责回答 “要下载哪些 Workshop/server mods”，它会被同步到 `/opt/dst/mods`，让 DST 本体在启动前得以触发下载/更新。
- `modoverrides.lua`（`./data/<DST_CLUSTER_NAME>/Master/modoverrides.lua` 与 `./data/<DST_CLUSTER_NAME>/Caves/modoverrides.lua`）负责回答 “每个 shard 是否启用某个 mod 以及具体配置是什么”，Klei 的 shard 配置只会读取这个文件。
- 该分工的好处是：`dedicated_server_mods_setup.lua` 统筹下载行为，`modoverrides.lua` 遵循 shard 级别的启用/配置策略。
- 实测下载内容优先落在 `./ugc/content/322330/<workshop-id>`，而不是直接落在 `./dst/mods/workshop-*`。`./dst/mods` 保留 `dedicated_server_mods_setup.lua`、`modsettings.lua` 等入口文件，真正的 Workshop 内容则由 `-ugc_directory /ugc` 管理。
- 对少数 legacy Workshop mod，DST 自身的 `/ugc` 下载流程可能持续报 `ODPF failed entirely: 16`。这时镜像会把 Steam metadata 中仍公开 `file_url` 的旧式 zip 解到 `./dst/mods/workshop-*`，并写入 `.dst-docker-legacy-fallback` 标记文件，供后续启动识别与清理。
- 如果是第一次冷启动且 `./ugc` 里还没有缓存，`runtime` 模式下 Master/Caves 并发启动时可能出现 “Master 已下载并加载部分 mod，但 Caves 还没来得及复用缓存” 的窗口；`prewarm` 模式则会先完成一次统一下载，再让两个 shard 复用同一份缓存。
- `Caves` 若需要固定洞穴世界配置，优先提供 `leveldataoverride.lua`；这是你当前真实集群的做法，也已被验证可直接被 DST 读取。


## 验证状态
`SteamCMD` 程序固定在 `/usr/local/steamcmd`，而运行时状态写入 `/steam-state`。详见 `docs/verification.md` 中对这两个路径的验证。
- 已验证：`docker build --pull=false -t dst-docker:v1 .`、`bash scripts/run-smoke.sh fast`、`bash scripts/check-local-config.sh` 对已初始化示例目录可正确通过、`bash tests/smoke/test-preflight-missing-token.sh`、`bash tests/smoke/test-supervisord-config.sh`、`bash tests/smoke/test-steamcmd-bootstrap-baked.sh`、`bash tests/smoke/test-steamcmd-retry-lib.sh`、`bash tests/smoke/test-legacy-workshop-fallback-lib.sh`、`bash tests/smoke/test-legacy-workshop-extract-warnings.sh`、`bash tests/smoke/test-example-cluster-template.sh`、`bash tests/smoke/test-init-cluster-script.sh`、`bash tests/smoke/test-bootstrap-local-script.sh`、`bash tests/smoke/test-check-local-config-script.sh`、`bash tests/smoke/test-compose-port-envs.sh` 等关键命令均正常返回；`docker run --rm dst-docker:v1` 则在 `entrypoint` 的 preflight 阶段因 `/data/Cluster_1/cluster.ini` 缺失而退出，证明缺乏配置时不会误报成功；临时补充 `.env` 后 `docker compose config` 能完整展现 ports/volumes/environment 设定，且可以通过环境变量覆盖 published UDP ports；`docker run --rm --entrypoint cat dst-docker:v1 /etc/supervisor/conf.d/supervisord.conf` 也确认了 Master/Caves 启动命令消费 entrypoint 导出的环境变量；详见 `docs/verification.md` 获取完整验证流程与观察细节。
- 限制：`cluster.ini`、`cluster_token.txt` 与两个 shard 的 `server.ini` 仍缺失，`entrypoint` 会在 `require_file` 阶段直接退出，因此 `docker compose up` 或 `supervisord` 的真正 Master/Caves 启动依赖这些文件才能完成。
- 待验证：`update`/`validate` 模式在真实的 Workshop mod 场景中是否按预期更新；`./data` 下的 mod/shard 配置在多 shard 并行运行中的长期稳定性；其他 DST 更新参数与 mod 下载行为的完整性；以及是否要把社区里“替换 `steamclient.so`”的 workaround 做成可选实验开关。

## 其他说明
- 目录挂载后的第一级路径（`steam-state`、`dst`、`ugc`、`data`）必须由用户提前创建并赋予合适权限。
- 当前的 compose 版本只依赖本地构建，后续可考虑用远程镜像替代。
