# DST 镜像验证记录

## 官方已确认
- SteamCMD 的 `+app_update 343050`/`validate` 流程是 Valve 官方提供的 DST dedicated server 安装路径，镜像通过 `run_steamcmd_app_update` 直接复用此命令组完成下载与校验；在最初的探测流程中（运行在旧版状态目录配置之前）`/opt/dst` 目录被填充为 4.3G 的专用服务器文件组。
- 官方包中包含主二进制 `/opt/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64`（兼容的 `bin/dontstarve_dedicated_server_nullrenderer` 也可作为备用），`find` 命令曾列出该路径以及 `/opt/dst/mods/dedicated_server_mods_setup.lua`，说明 SteamCMD 与 entrypoint 期望的目录结构是一致的。此后，在没有 `cluster_token.txt` 等配置的环境中再次运行 `+app_update`/`validate` 时会报 `ERROR! Failed to install app '343050' (Missing configuration)`，完整安装不会留下任何二进制，说明安装失败的根本原因依然是缺少配置。

## 工程约定
- 镜像把宿主目录映射到：`./steam-state` → `/steam-state`（Steam 状态持久化）、`./dst` → `/opt/dst`（服务器主程序）、`./ugc` → `/ugc`（Workshop/UGC 缓存）、`./data` → `/data`（集群配置、存档与 mod）。entrypoint 依赖这些挂载点并默认创建缺失部分。
- SteamCMD 程序文件固定在 `/usr/local/steamcmd`，entrypoint 直接调用 `/usr/local/steamcmd/steamcmd.sh`，同时以 `/steam-state` 作为 `HOME`，保证用户无法通过挂载覆盖核心程序且所有运行状态都落在独立目录。
- `entrypoint.sh` 会在 `/data/<DST_CLUSTER_NAME>` 下查找 `cluster.ini`、`cluster_token.txt` 与两个 shard 的 `server.ini`，没有这些文件启动就会在 preflight 阶段失败（脚本里用 `require_file` 明确退出）。
- 通过 `find_dst_binary` 和 `run_steamcmd_app_update` 两段逻辑，entrypoint 会优先定位 `/opt/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64`，如缺失再调用 SteamCMD 下载，`DST_UPDATE_MODE` 支持 `install-only`/`update`/`validate`/`never` 四种运行方式。
- supervisor 配置(`supervisord.conf`)中用 `%(ENV_DST_SERVER_BINARY)s`、`%(ENV_DST_CLUSTER_NAME)s`、`%(ENV_DST_DATA_DIR)s`、`%(ENV_DST_UGC_DIR)s` 定义 Master 与 Caves 的启动命令，entrypoint 会在前期导出这些变量供 supervisord 读取。

## 已实验验证
- `docker build --pull=false -t dst-docker:v1 .`：镜像成功构建，所有步骤均命中缓存，Dockerfile 能顺利生成 `dst-docker:v1`。
- `bash -n entrypoint.sh`：入口脚本无语法错误，`set -euo pipefail` 也可正常解析。
- `bash tests/smoke/test-preflight-missing-token.sh`：烟雾测试确认缺少 `cluster_token.txt` 会通过 entrypoint 的 preflight 跳出。
- `docker run --rm dst-docker:v1`：entrypoint 会在缺少 `/data/Cluster_1/cluster.ini` 时立即报 `preflight error: missing cluster.ini at /data/Cluster_1/cluster.ini`，说明仍然需要配置文件才能完成启动。
- `docker compose config`：临时补充 `.env` 后 `docker compose config` 能正确展开 ports/volumes/environment 的设定。
- `docker run --rm --entrypoint cat dst-docker:v1 /etc/supervisor/conf.d/supervisord.conf`：supervisor 配置可读，Master/Caves 启动命令继续消费 entrypoint 导出的环境变量。
- `mkdir -p .tmp/steam-state-empty && docker run --rm -v "$PWD/.tmp/steam-state-empty:/steam-state" --entrypoint bash dst-docker:v1 -lc 'test -x /usr/local/steamcmd/steamcmd.sh'`：在没有覆盖程序目录的情况下，以空 `./steam-state` 挂载运行容器仍然能找到可执行的 `/usr/local/steamcmd/steamcmd.sh`，验证程序路径与状态目录已经分离。
- `rm -rf .tmp/steam-state-probe && mkdir -p .tmp/steam-state-probe && docker run --rm -v "$PWD/.tmp/steam-state-probe:/steam-state" --entrypoint bash dst-docker:v1 -lc 'HOME=/steam-state /usr/local/steamcmd/steamcmd.sh +quit || true; find /steam-state -maxdepth 3 -type f | sort'`：首次运行会在 `/steam-state` 中生成真实的 Steam 配置与日志文件（`Steam/config/config.vdf` 和 `Steam/logs/appinfo_log.txt` 等），SteamCMD 输出“Logging directory: '/steam-state/Steam/logs'”与“Verifying installation”说明状态目录在本次 session 中被写入。
- `docker run --rm -v "$PWD/.tmp/steam-state-probe:/steam-state" --entrypoint bash dst-docker:v1 -lc 'HOME=/steam-state /usr/local/steamcmd/steamcmd.sh +quit || true; find /steam-state -maxdepth 3 -type f | sort'`：第二次运行再次打印“Checking for available updates...”/“Downloading update...”/“Verifying installation...”等自更新日志，`find` 结果与第一次完全一致，说明 SteamCMD 虽然继续走更新流程但依旧读取了已经存在的 `/steam-state/Steam/config` 与 `Steam/logs` 文件。

## 待继续验证
- SteamCMD 的 `app_update 343050 validate` 在当前环境仍然报 `Missing configuration`，导致无法自动填充 `/opt/dst` 并验证 `find_dst_binary`。需要找到触发该错误的配置项（可能是 Steam 端或网络代理）后再复用这一命令确认二进制位置与版本。
- 完整的“端到端”启动依旧被 `require_file cluster.ini/cluster_token.txt/Master/server.ini/Caves/server.ini` 拦截，缺乏真正的 `cluster_token.txt`（和其他配置）时无法让 supervisord 真正启动 Master/Caves 进程，等待拥有真实的 token 与［真实配置］后再验证 `docker compose up` 或 `supervisord` 启动通路。
- 虽然 `/steam-state` 中的配置和日志文件在第二次 SteamCMD 启动时仍旧存在，但第二次 run 仍会输出 `Checking for available updates…`/`Downloading update…`/`Verifying installation…` 等自更新日志，说明只靠这一持久化状态尚无法跳过每次启动的 bootstrap；是否能利用已有 `/steam-state` 内容让后续运行真正复用且跳过下载仍需进一步调查。
