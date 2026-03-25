# DST 镜像验证记录

## 官方已确认
- SteamCMD 的 `+app_update 343050`/`validate` 流程是 Valve 官方提供的 DST dedicated server 安装路径，镜像通过 `run_steamcmd_app_update` 直接复用此命令组完成下载与校验；在最初的探测流程中（运行在旧版状态目录配置之前）`/opt/dst` 目录被填充为 4.3G 的专用服务器文件组。
- 官方包中包含主二进制 `/opt/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64`（兼容的 `bin/dontstarve_dedicated_server_nullrenderer` 也可作为备用），`find` 命令曾列出该路径以及 `/opt/dst/mods/dedicated_server_mods_setup.lua`，说明 SteamCMD 与 entrypoint 期望的目录结构是一致的。此后，在没有 `cluster_token.txt` 等配置的环境中再次运行 `+app_update`/`validate` 时会报 `ERROR! Failed to install app '343050' (Missing configuration)`，完整安装不会留下任何二进制，说明安装失败的根本原因依然是缺少配置。

## 工程约定
- 镜像把宿主目录映射到：`./steam-state` → `/steam-state`（Steam 状态持久化）、`./dst` → `/opt/dst`（服务器主程序）、`./ugc` → `/ugc`（Workshop/UGC 缓存）、`./data` → `/data`（集群配置、存档与 mod）。entrypoint 依赖这些挂载点并默认创建缺失部分。
- SteamCMD 程序文件固定在 `/usr/local/steamcmd`，entrypoint 直接调用 `/usr/local/steamcmd/steamcmd.sh`，同时以 `/steam-state` 作为 `HOME`，保证用户无法通过挂载覆盖核心程序且所有运行状态都落在独立目录。
- `entrypoint.sh` 会在 `/data/<DST_CLUSTER_NAME>` 下查找 `cluster.ini`、`cluster_token.txt` 与两个 shard 的 `server.ini`，没有这些文件启动就会在 preflight 阶段失败（脚本里用 `require_file` 明确退出）。
- 通过 `find_dst_binary` 和 `run_steamcmd_app_update` 两段逻辑，entrypoint 会优先定位 `/opt/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64`，如缺失再调用 SteamCMD 下载，`DST_UPDATE_MODE` 支持 `install-only`/`update`/`validate`/`never` 四种运行方式。
- 通过对 DST dedicated server 二进制执行 `strings`，已经确认其内置支持 `-only_update_server_mods` 与 `-skip_update_server_mods` 两个 server mod 相关参数。因此镜像可以在不自造旁路脚本的前提下，复用 DST 官方行为完成 mod 预热和跳过更新。
- supervisor 配置(`supervisord.conf`)中用 `%(ENV_DST_SERVER_BINARY)s`、`%(ENV_DST_CLUSTER_NAME)s`、`%(ENV_DST_DATA_DIR)s`、`%(ENV_DST_UGC_DIR)s` 定义 Master 与 Caves 的启动命令，entrypoint 会在前期导出这些变量供 supervisord 读取；同时两个 shard 现在都显式以 `/opt/dst/bin64` 作为工作目录启动，避免从 `/` 启动时出现 `databundles/scripts.zip skipped` 与 `scripts/main.lua` 无法加载的问题。
- 当前最小可用双分片配置至少需要：`cluster.ini` 中启用 `[SHARD] shard_enabled = true` 并提供 `bind_ip`/`master_ip`/`master_port`/`cluster_key`，两个 shard 各自的 `server.ini` 中提供独立 `server_port` 与 `STEAM` 端口；`Caves` 额外需要 `leveldataoverride.lua` 或 `worldgenoverride.lua` 指向洞穴 preset 才能稳定生成洞穴世界。

## 已实验验证
- `docker build --pull=false -t dst-docker:v1 .`：镜像成功构建，所有步骤均命中缓存，Dockerfile 能顺利生成 `dst-docker:v1`。
- `bash -n entrypoint.sh`：入口脚本无语法错误，`set -euo pipefail` 也可正常解析。
- `bash tests/smoke/test-preflight-missing-token.sh`：烟雾测试确认缺少 `cluster_token.txt` 会通过 entrypoint 的 preflight 跳出。
- `docker run --rm dst-docker:v1`：entrypoint 会在缺少 `/data/Cluster_1/cluster.ini` 时立即报 `preflight error: missing cluster.ini at /data/Cluster_1/cluster.ini`，说明仍然需要配置文件才能完成启动。
- `docker compose config`：临时补充 `.env` 后 `docker compose config` 能正确展开 ports/volumes/environment 的设定。
- `docker run --rm --entrypoint cat dst-docker:v1 /etc/supervisor/conf.d/supervisord.conf`：supervisor 配置可读，Master/Caves 启动命令继续消费 entrypoint 导出的环境变量。
- `bash tests/smoke/test-supervisord-config.sh`：确认 `supervisord.conf` 为 `master`/`caves` 都声明了 `directory=/opt/dst/bin64`，且 `[supervisord]` 明确设置 `user=root`，避免默认配置扫描与错误工作目录带来的噪音和启动失败。
- `timeout 90s docker run --rm -v "$PWD/.tmp/e2e/steam-state:/steam-state" -v "$PWD/.tmp/e2e/dst:/opt/dst" -v "$PWD/.tmp/leveldata-probe/data:/data" -v "$PWD/.tmp/e2e/ugc:/ugc" dst-docker:v1`：在仅提供 `leveldataoverride.lua`、不提供 `worldgenoverride.lua` 的情况下，Caves 日志明确打印 `Loaded and applied level data override from ../leveldataoverride.lua`，说明这条路径可以直接作为正式配置依据。
- `mkdir -p .tmp/steam-state-empty && docker run --rm -v "$PWD/.tmp/steam-state-empty:/steam-state" --entrypoint bash dst-docker:v1 -lc 'test -x /usr/local/steamcmd/steamcmd.sh'`：在没有覆盖程序目录的情况下，以空 `./steam-state` 挂载运行容器仍然能找到可执行的 `/usr/local/steamcmd/steamcmd.sh`，验证程序路径与状态目录已经分离。
- `rm -rf .tmp/steam-state-probe && mkdir -p .tmp/steam-state-probe && docker run --rm -v "$PWD/.tmp/steam-state-probe:/steam-state" --entrypoint bash dst-docker:v1 -lc 'HOME=/steam-state /usr/local/steamcmd/steamcmd.sh +quit || true; find /steam-state -maxdepth 3 -type f | sort'`：首次运行会在 `/steam-state` 中生成真实的 Steam 配置与日志文件（`Steam/config/config.vdf` 和 `Steam/logs/appinfo_log.txt` 等），SteamCMD 输出“Logging directory: '/steam-state/Steam/logs'”与“Verifying installation”说明状态目录在本次 session 中被写入。
- `docker run --rm -v "$PWD/.tmp/steam-state-probe:/steam-state" --entrypoint bash dst-docker:v1 -lc 'HOME=/steam-state /usr/local/steamcmd/steamcmd.sh +quit || true; find /steam-state -maxdepth 3 -type f | sort'`：第二次运行再次打印“Checking for available updates...”/“Downloading update...”/“Verifying installation...”等自更新日志，`find` 结果与第一次完全一致，说明 SteamCMD 虽然继续走更新流程但依旧读取了已经存在的 `/steam-state/Steam/config` 与 `Steam/logs` 文件。
- `timeout 120s docker run --rm -v "$PWD/.tmp/e2e/steam-state:/steam-state" -v "$PWD/.tmp/e2e/dst:/opt/dst" -v "$PWD/.tmp/e2e/ugc:/ugc" -v "$PWD/.tmp/e2e-shards/data:/data" dst-docker:v1`：使用真实 token、改进后的最小双分片配置运行时，Master/Caves 均打印 `Mounting file system databundles/scripts.zip successful.`，随后完成 worldgen、Master/Caves shard 握手，并在约 120 秒超时前正常保存退出；这证明工作目录修复和最小双分片配置已经足以支撑正向启动。
- `timeout 240s docker run --rm -e DST_SERVER_MODS_UPDATE_MODE=prewarm -v "$PWD/.tmp/e2e/steam-state:/steam-state" -v "$PWD/.tmp/e2e/dst:/opt/dst" -v "$PWD/.tmp/prewarm-e2e/ugc:/ugc" -v "$PWD/.tmp/prewarm-e2e/data:/data" dst-docker:v1`：entrypoint 会先调用 DST 官方参数 `-only_update_server_mods` 完成一次预热，然后再以 `-skip_update_server_mods` 启动 Master/Caves。正式 shard 启动阶段不再出现 Workshop 下载流程，而是直接加载已缓存的 `3359995816` 与 `378160973`；这证明 `prewarm` 模式能显著降低冷缓存首启时的 shard 并发竞争。
- `timeout 180s docker run --rm -e DST_SERVER_MODS_UPDATE_MODE=skip -v "$PWD/.tmp/e2e/steam-state:/steam-state" -v "$PWD/.tmp/e2e/dst:/opt/dst" -v "$PWD/.tmp/prewarm-e2e/ugc:/ugc" -v "$PWD/.tmp/skip-e2e/data:/data" dst-docker:v1`：在已有 `./ugc` 缓存的前提下，Master/Caves 启动日志里不再出现任何 Workshop 下载流程，而是直接注册并加载 `3359995816` 与 `378160973`；这证明 `skip` 模式适合“缓存已准备好、只想快速起服”的场景。
- `timeout 240s docker run --rm -v "$PWD/.tmp/e2e/steam-state:/steam-state" -v "$PWD/.tmp/e2e/dst:/opt/dst" -v "$PWD/.tmp/e2e-mod-check/ugc:/ugc" -v "$PWD/.tmp/e2e-mod-check/data:/data" dst-docker:v1`：首次冷缓存的 `runtime` mod 实验中，`dedicated_server_mods_setup.lua` 触发了 Workshop 查询与下载，文件实际写入了 `/ugc/content/322330/<workshop-id>`；其中 `3359995816` 与 `378160973` 成功落盘并由 Master 加载，`362175979` 与 `661253977` 持续报 `ODPF failed entirely: 16`，而 Caves 在这次首跑中未能及时注册已下载 mod。
- `timeout 180s docker run --rm -v "$PWD/.tmp/e2e/steam-state:/steam-state" -v "$PWD/.tmp/e2e/dst:/opt/dst" -v "$PWD/.tmp/e2e-mod-check/ugc:/ugc" -v "$PWD/.tmp/e2e-mod-check-reuse/data:/data" dst-docker:v1`：第二次复用同一 `./ugc` 缓存时，日志明确显示 `ModQuery already have IDs: {2.0.2,3359995816} {1.7.5,378160973}`，且 Master/Caves 都能启用并注册 `workshop-3359995816` 与 `workshop-378160973`；这表明首次问题主要出现在“并发冷下载”窗口，而不是 `modoverrides.lua` 的启用语义本身。

## 待继续验证
- SteamCMD 的 `app_update 343050 validate` 在当前环境仍然报 `Missing configuration`，导致无法自动填充 `/opt/dst` 并验证 `find_dst_binary`。需要找到触发该错误的配置项（可能是 Steam 端或网络代理）后再复用这一命令确认二进制位置与版本。
- “首次冷缓存 mod 预热” 已经通过 `DST_SERVER_MODS_UPDATE_MODE=prewarm` 固化到镜像逻辑中；后续仍需评估默认值是否保持 `runtime` 最稳妥，以及是否需要进一步记录失败 mod 的状态以避免对永久失效项反复预热。
- 虽然 `/steam-state` 中的配置和日志文件在第二次 SteamCMD 启动时仍旧存在，但第二次 run 仍会输出 `Checking for available updates…`/`Downloading update…`/`Verifying installation…` 等自更新日志，说明只靠这一持久化状态尚无法跳过每次启动的 bootstrap；是否能利用已有 `/steam-state` 内容让后续运行真正复用且跳过下载仍需进一步调查。
- `362175979` 与 `661253977` 在当前验证里都持续报 `ODPF failed entirely: 16`，即使复用已有 `./ugc` 缓存的第二次启动也仍然失败；这更像是具体 workshop 项目可用性/兼容性问题，而不是通用下载链路已经完全打通。
