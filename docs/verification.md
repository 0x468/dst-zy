# DST 镜像验证记录

## 官方已确认
- SteamCMD 的 `+app_update 343050`/`validate` 流程是 Valve 官方提供的 DST dedicated server 安装路径，镜像通过 `run_steamcmd_app_update` 直接复用此命令组完成下载与校验；在最初的探测流程中，`/opt/dst` 目录被填充为 4.3G 的专用服务器文件组。
- 官方包中包含主二进制 `/opt/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64`（兼容的 `bin/dontstarve_dedicated_server_nullrenderer` 也可作为备用），`find` 命令曾列出该路径以及 `/opt/dst/mods/dedicated_server_mods_setup.lua`，说明 SteamCMD 与 entrypoint 期望的目录结构是一致的。

## 工程约定
- 镜像把宿主目录映射到：`./steamcmd` → `/opt/steamcmd`（Steam 状态持久化）、`./dst` → `/opt/dst`（服务器主程序）、`./ugc` → `/ugc`（Workshop/UGC 缓存）、`./data` → `/data`（集群配置、存档与 mod）。entrypoint 依赖这些挂载点并默认创建缺失部分。
- `entrypoint.sh` 会在 `/data/<DST_CLUSTER_NAME>` 下查找 `cluster.ini`、`cluster_token.txt` 与两个 shard 的 `server.ini`，没有这些文件启动就会在 preflight 阶段失败（脚本里用 `require_file` 明确退出）。
- 通过 `find_dst_binary` 和 `run_steamcmd_app_update` 两段逻辑，entrypoint 会优先定位 `/opt/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64`，如缺失再调用 SteamCMD 下载，`DST_UPDATE_MODE` 支持 `install-only`/`update`/`validate`/`never` 四种运行方式。
- supervisor 配置(`supervisord.conf`)中用 `%(ENV_DST_SERVER_BINARY)s`、`%(ENV_DST_CLUSTER_NAME)s`、`%(ENV_DST_DATA_DIR)s`、`%(ENV_DST_UGC_DIR)s` 定义 Master 与 Caves 的启动命令，entrypoint 会在前期导出这些变量供 supervisord 读取。

## 已实验验证
- `docker build --pull=false -t dst-docker:v1 .`：镜像成功构建，所有步骤均命中缓存，Dockerfile 能顺利生成 `dst-docker:v1`。
- `bash -n entrypoint.sh`：入口脚本无语法错误，`set -euo pipefail` 也可正常解析。
- `bash tests/smoke/test-preflight-missing-token.sh`：烟雾测试确认缺少 `cluster_token.txt` 会通过 entrypoint 的 preflight 跳出，覆盖最常见的失败路径。
- `docker run --rm dst-docker:v1`：容器启动时 entrypoint 创建目录，但随着 `require_file cluster.ini /data/Cluster_1/cluster.ini` 抛出 `preflight error: missing cluster.ini at /data/Cluster_1/cluster.ini`，表明缺乏配置时不会假装启动成功，完整服务实际上仍然需要目录和 `cluster_token.txt` 等文件。
- `docker run --rm --entrypoint bash dst-docker:v1 -c "/opt/steamcmd/steamcmd.sh +force_install_dir /opt/dst +login anonymous +app_update 343050 validate +quit && find /opt/dst -maxdepth 4 -type f | grep -E 'dontstarve|dedicated|nullrenderer'"`：SteamCMD 运行到最后报 `ERROR! Failed to install app '343050' (Missing configuration)`，因此此次尝试并未留下具体文件；我们也用空 `find` 命令确认 `/opt/dst` 暂无上述二进制。
- `docker compose config`：临时补充 `.env` 中的 `DST_<…>` 变量后，compose 能正确展开配置并显示所有 port、volume、environment 设定（命令运行后删除了临时 `.env` 文件）。
- `docker run --rm --entrypoint cat dst-docker:v1 /etc/supervisor/conf.d/supervisord.conf`：supervisor 配置可读，Master/Caves 都指向 `%(ENV_DST_SERVER_BINARY)s` 及相关环境变量，说明 entrypoint 导出的变量可被 supervisord 直接消费。

## 待继续验证
- SteamCMD 的 `app_update 343050 validate` 在当前环境仍然报 `Missing configuration`，导致无法自动填充 `/opt/dst` 并验证 `find_dst_binary`。需要找到触发该错误的配置项（可能是 Steam 端或网络代理）后再复用这一命令确认二进制位置与版本。
- 完整的“端到端”启动依旧被 `require_file cluster.ini/cluster_token.txt/Master/server.ini/Caves/server.ini` 拦截，缺乏真正的 `cluster_token.txt`（和其他配置）时无法让 supervisord 真正启动 Master/Caves 进程，等待拥有真实的 token 与［真实配置］后再验证 `docker compose up` 或 `supervisord` 启动通路。
