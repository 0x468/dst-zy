# DST 镜像验证记录

## 探测流程
- 使用 `dst-docker:v1` 镜像在临时环境中执行：
  ```
  /opt/steamcmd/steamcmd.sh +force_install_dir /opt/dst +login anonymous +app_update 343050 validate +quit
  find /opt/dst -maxdepth 4 -type f | grep -E "dontstarve|dedicated|nullrenderer"
  ```
  该命令在容器中从 SteamCMD 拉取了完整的 4.3G 专用服务器二进制，并在退出前列举了 `/opt/dst` 下的相关文件。
 该安装过程依赖 `validate` 以完成缺失配置的自动修复，最终 `Steam Console Client` 报告 `App '343050' fully installed`。

## 关键结果
- 专用服务器可执行文件路径：`/opt/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64`（`find` 输出中还包括 `/opt/dst/bin/dontstarve_dedicated_server_nullrenderer`，但 64 位版本是主流启动目标）。
- 运行时命令使用 `%(ENV_DST_SERVER_BINARY)s -console -cluster %(ENV_DST_CLUSTER_NAME)s -shard <shard> -conf_dir . -persistent_storage_root %(ENV_DST_DATA_DIR)s -ugc_directory %(ENV_DST_UGC_DIR)s`，`entrypoint.sh` 会导出最终的 `DST_CLUSTER_NAME` 与 `DST_SERVER_BINARY` 以及 `DST_DATA_DIR` 和 `DST_UGC_DIR`，`-conf_dir .` 会让专服按照 `<persistent_storage_root>/<conf_dir>/<cluster>/<shard>` 的模型（默认 `DST_CLUSTER_NAME=Cluster_1`）读取对应分片的配置，保持与前置校验路径一致。
- `mods` 目录位置：`/opt/dst/mods`，安装完成后该目录内存在 `dedicated_server_mods_setup.lua`，说明 SteamCMD 会在安装目录内创建此配置文件，符合预期的同步目标。
- 其他安装结构：`/opt/dst/bin64` 中除了主服务还包含 `dontstarve`、`dontstarve.xpm` 和 `scripts/launch_dedicated_server.sh`；`/opt/dst/data/sound` 目录保存了音频资源；主目录的 `bin` 也有历史兼容二进制。

## 备注
- 这个验证通过 `+app_update 343050 validate` 模式完成（非纯 install-only），记录了 `/opt/dst` 及其子目录（如 `bin64`、`mods`、`data/sound`）的结构，并确认 SteamCMD 确实在该目录下安装了专用服务器可执行文件，供 supervisor 启动时使用。
