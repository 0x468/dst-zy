# DST 最后三项优化设计

## 背景

当前仓库的 V1 基础链路已经可用，但还存在三类值得继续收尾的优化点：

1. `DST_UPDATE_MODE=update/validate` 目前已有控制流 smoke，但缺少真实 `steamcmd` 慢回归。
2. 社区里存在 `steamclient.so` workaround 方向，但仓库还没有显式的实验开关。
3. server mod 的缓存/缺失/fallback 日志已经可读，但还不够结构化，难以快速区分“命中缓存”“metadata 缺失”“fallback 下载失败”等状态。

这些问题不会阻塞当前仓库使用，但会影响长期维护和排障效率。

## 目标

- 增加一条可选的真实 `steamcmd` 慢回归，覆盖 `update` 与 `validate` 的真实调用链
- 提供一个显式、默认关闭的 `steamclient.so` 实验开关
- 把 server mod 的状态日志标准化为更易检索和分类的形式

## 非目标

- 不把 `steamclient.so` workaround 设为默认行为
- 不把慢回归放进默认 `fast/full` 套件
- 不重构整个 `entrypoint.sh` 架构

## 方案比较

### 方案 1：只补文档，不补代码

优点：

- 风险最低

缺点：

- 真实 `update/validate` 仍然缺自动化证据
- `steamclient.so` 方向仍停留在口头讨论
- 日志可读性问题继续存在

### 方案 2：最小实现三项优化

- 新增单独的慢测试脚本，不接入默认 `fast/full`
- 新增 `DST_EXPERIMENTAL_STEAMCLIENT_WORKAROUND=1` 开关
- 在 `entrypoint.sh` 内把 mod 状态输出规范化

优点：

- 不改变默认行为
- 收益直接，风险可控
- 能把剩余“可做的优化”基本做完

缺点：

- `entrypoint.sh` 会继续增长一些逻辑

### 方案 3：大幅重构入口脚本和测试体系

优点：

- 理论上长期更整洁

缺点：

- 超出当前收尾范围
- 风险明显大于收益

## 选型

选择方案 2。

原因：

- 它能覆盖当前三项优化目标
- 不会把默认运行路径变慢
- 不会把社区 workaround 冒进地变成默认行为

## 详细设计

### 1. 真实 `update/validate` 慢回归

新增一个单独脚本，例如 `tests/slow/test-real-steamcmd-update-modes.sh`，或保留在 `tests/smoke/` 下但不接入默认套件。

测试逻辑：

- 复用本地镜像 `dst-docker:v1`
- 使用独立的临时挂载目录
- 先在 `DST_UPDATE_MODE=update` 下跑一次容器，确认日志中出现 `update mode: running SteamCMD app_update`
- 再在 `DST_UPDATE_MODE=validate` 下跑一次容器，确认日志中出现 `validate mode: running SteamCMD app_update validate`
- 断言 `steamcmd-app-update.log` 和 DST binary 都落盘

这条测试必须是“显式手动跑”的慢测试，不纳入默认 `fast/full`。

### 2. `steamclient.so` 实验开关

新增环境变量：

- `DST_EXPERIMENTAL_STEAMCLIENT_WORKAROUND=0`（默认）

当值为 `1` 时：

- 如果存在 `/usr/local/steamcmd/linux64/steamclient.so`
- 且存在 DST 运行目录（优先 `bin64`）
- 则把该文件复制到 DST 运行目录下一个固定位置
- 同时打印明确日志：已启用实验开关、复制到了哪里

当值不为 `1` 时：

- 完全不做任何复制

这个开关只服务于未来上游波动排障，不应该影响现在的默认路径。

### 3. 结构化 server mod 日志

当前日志仍偏自由文本，后续应改为固定前缀，例如：

- `server mods status: ugc-hit workshop-...`
- `server mods status: local-hit workshop-...`
- `server mods status: missing workshop-...`
- `server mods status: legacy-fallback-installed workshop-...`
- `server mods status: legacy-fallback-metadata-missing workshop-...`
- `server mods status: legacy-fallback-download-failed workshop-...`

这样做的好处：

- `docker logs | grep 'server mods status:'` 就能快速过滤
- 用户可以直接看出每个 mod 处于哪一类状态
- 后续如果还要接更高级的诊断脚本，也更容易解析

### 4. 文档

README 和验证记录需要补充：

- 慢回归脚本的用途和运行方式
- `DST_EXPERIMENTAL_STEAMCLIENT_WORKAROUND` 的用途、默认值和风险
- 新的结构化 mod 状态日志示例

## 验证策略

至少需要：

- 新增/更新的 smoke tests 通过
- `bash scripts/run-smoke.sh full` 继续通过
- 慢回归脚本至少完成一次真实运行并把结果写入 `docs/verification.md`

## 风险

- 真实 `update/validate` 慢回归依赖 Docker 和 Steam 在线服务，可能受网络波动影响
- `steamclient.so` workaround 是实验能力，文档必须明确“默认关闭”
- 日志结构化不能破坏现有 fallback 行为

## 结论

这三项优化都值得做，但都应保持“默认路径稳、实验能力显式开启、慢回归不拖慢常规开发”的边界。
