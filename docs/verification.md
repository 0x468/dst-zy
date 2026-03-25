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
- `mods` 目录位置：`/opt/dst/mods`，安装完成后该目录内存在 `dedicated_server_mods_setup.lua`，说明 SteamCMD 会在安装目录内创建此配置文件，符合预期的同步目标。
- 其他安装结构：`/opt/dst/bin64` 中除了主服务还包含 `dontstarve`、`dontstarve.xpm` 和 `scripts/launch_dedicated_server.sh`；`/opt/dst/data/sound` 目录保存了音频资源；主目录的 `bin` 也有历史兼容二进制。

## 备注
- 这个验证确认了 `entrypoint.sh` 中预设的路径（`/opt/dst`、`/opt/dst/mods`、`/ugc`、`/data`）都能在真实 install-only 流程下被 SteamCMD 填充，后续的 supervisor 启动可以直接调用 `bin64` 下的 x64 可执行文件。
