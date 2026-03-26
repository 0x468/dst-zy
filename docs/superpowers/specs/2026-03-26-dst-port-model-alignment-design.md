# DST Docker 端口模型对齐设计

## 背景

当前仓库的示例 shard 配置与 `docker-compose.yml` 暴露的容器端口并不一致：

- `examples/Cluster_1/Master/server.ini` 的 `server_port` 是 `11000`
- `examples/Cluster_1/Caves/server.ini` 的 `server_port` 是 `11001`
- 两个 shard 的 `master_server_port` 分别是 `27018` 和 `27019`
- 但 `docker-compose.yml` 目前暴露的是容器端口 `10999`、`11000`、`27015`

这会让用户即使照着仓库模板填写，也可能把宿主机端口映射到错误的容器监听端口，最终表现为：

- 服务器列表可见性异常
- 客户端无法稳定连接某个 shard
- 文档、模板、compose 三者互相矛盾，排障成本很高

## 目标

- 让 `docker-compose.yml` 的容器端口与示例 cluster 配置保持一致
- 让 `.env.example` 明确表达四个对外端口的职责
- 让本地 preflight 在起服前发现“示例配置与 host 端口映射不匹配”的情况
- 把这套约定写入中文文档与 smoke 测试，防止后续回归

## 非目标

- 不自动解析所有自定义 shard 配置并动态生成 compose 端口映射
- 不在本轮引入额外的 sidecar、反向代理或管理面板
- 不改变 DST 在 shard 间内部使用的 `cluster.ini` `master_port`

## 方案比较

### 方案 1：按示例 shard 配置修正 compose 和 preflight

- `DST_MASTER_HOST_PORT` 映射到容器 `11000/udp`
- `DST_CAVES_HOST_PORT` 映射到容器 `11001/udp`
- `DST_STEAM_HOST_PORT` 映射到容器 `27018/udp`
- 新增 `DST_CAVES_STEAM_HOST_PORT` 映射到容器 `27019/udp`
- `check-local-config.sh` 校验 host 端口值合法、彼此不冲突，并且和示例 shard 端口职责一致

优点：

- 改动范围小，和当前示例目录、验证记录、真实运行观察一致
- 用户理解成本最低，文档可以直接给出固定四端口模型
- 能快速堵住当前最真实的误配置入口

缺点：

- 仍然是“以当前双分片模板为中心”的约定，不是任意 shard 拓扑的通用端口映射系统

### 方案 2：保留现有 compose，只在文档里解释

优点：

- 代码改动最少

缺点：

- 不能消除真实错误配置
- 用户仍会拿着错误映射起服
- 文档解释无法替代 preflight 和 smoke 的约束

### 方案 3：做成完全动态端口映射生成

优点：

- 理论上最灵活

缺点：

- 超出当前项目阶段
- 需要重新设计 compose 生成方式与更复杂的配置来源
- 对用户价值不如先修正当前错误模型直接

## 选型

选择方案 1。

原因很直接：当前问题不是“缺少高级灵活性”，而是“仓库默认模板存在真实错配风险”。先把默认路径修正正确，比引入复杂抽象更有价值。

## 详细设计

### 1. compose 端口模型

`docker-compose.yml` 改为暴露四个 UDP 端口：

- `${DST_MASTER_HOST_PORT:-11000}:11000/udp`
- `${DST_CAVES_HOST_PORT:-11001}:11001/udp`
- `${DST_STEAM_HOST_PORT:-27018}:27018/udp`
- `${DST_CAVES_STEAM_HOST_PORT:-27019}:27019/udp`

其中：

- `11000/11001` 对应两个 shard 的 `server_port`
- `27018/27019` 对应两个 shard 的 `master_server_port`
- `cluster.ini` 里的 `master_port` 仍用于 shard 间协调，不作为 compose 默认公开端口

### 2. 环境变量模板

`.env.example` 增加：

- `DST_CAVES_STEAM_HOST_PORT=27019`

并同步调整原有默认值，使其和示例 shard 配置一致。

### 3. preflight 校验

`scripts/check-local-config.sh` 增加两类约束：

- 继续校验 host 端口值合法且彼此不冲突
- 读取 `Master/server.ini` 与 `Caves/server.ini`，确认示例模板下的 shard 端口与 compose 所暴露的容器端口职责一致

这里不做“任意值都必须等于某个固定数”的硬编码万能校验，而是面向当前仓库模板给出明确失败信息，避免用户以为 `10999/27015` 这组端口仍然是正确默认值。

### 4. smoke 测试

需要补三类回归：

- `docker compose config` 应渲染四个 published 端口
- `check-local-config.sh` 应识别新的 host 端口变量
- `run-smoke.sh fast --list` 继续包含相关 smoke

### 5. 文档

README 和验证记录统一更新：

- 解释四个对外 UDP 端口的职责
- 明确 `cluster.ini` 的 `master_port` 不等于需要对外暴露的 shard/game/steam 端口
- 避免再出现 `10999/27015` 是默认对外端口的描述

## 验证策略

最少需要重新执行：

- `bash tests/smoke/test-compose-port-envs.sh`
- `bash tests/smoke/test-check-local-config-script.sh`
- `bash tests/smoke/test-check-local-config-ports-and-dirs.sh`
- `bash tests/smoke/test-check-local-config-shard-settings.sh`
- `bash tests/smoke/test-run-smoke-script.sh`
- `bash scripts/run-smoke.sh fast`

如果这些都通过，就说明：

- compose 模板、示例配置、preflight、smoke 清单、中文文档已经重新对齐

## 风险

- 之前已经初始化过本地 `.env` 的用户，可能仍保留旧的 `DST_STEAM_HOST_PORT=27015`；文档需要明确说明需要同步刷新 `.env`
- 如果后续支持非双分片或完全自定义端口拓扑，当前方案还需要进一步抽象

## 决策

本轮实现只修正仓库默认双分片模型，并让默认路径自洽、可验证、可排障。
