# DST 控制平面预检与就绪度设计

## 背景

当前控制平面已经具备：

- 新建集群向导
- 集群详情页长期管理工作区
- 基础日志、备份、恢复、审计

但“为什么这个集群现在不能启动”仍然缺少一个统一、结构化、可提前展示的答案。

目前相关问题主要以三种形式零散出现：

- 创建向导局部字段校验
- runtime 动作失败后的错误字符串
- 用户自己去猜是 token、配置文件还是端口问题

这不符合“标准闭环”的目标。标准闭环要求关键错误能在启动前被发现，而不是等用户点击 `start` 后才从失败任务里倒推原因。

## 目标

为控制平面第一阶段补齐“预检 / 诊断”能力，让用户在以下三个位置都能看到一致的就绪度判断：

1. 创建向导确认页
2. 集群详情页状态区
3. `start` 与创建后 `auto start` 之前

第一版重点解决“能不能启动”与“阻断原因是什么”，不进入运行中健康监控和复杂诊断。

## 非目标

本阶段不做：

- Docker 实时端口占用探测
- 容器启动后的运行健康检查
- mods 完整性与 Workshop 诊断
- 实时资源监控
- 独立的诊断页面
- 历史结果持久化与趋势分析

## 用户面问题

当前要补齐的真实问题是：

- 创建新集群时，用户在点击确认前看不到 token、cluster_key、端口冲突等整体结果
- 详情页虽然能看到状态和日志，但看不到“当前是否具备启动条件”
- `auto start` 现在由前端在 create 成功后补发 `start`，如果失败，只能看到一个笼统错误
- 手动点击 `start` 时，失败信息来自 runtime，下游错误不稳定，也缺少结构化提示

## 方案比较

### 方案 1：运行前统一预检服务

- 新增独立 `preflight` 服务
- 统一生成结构化报告
- 由创建向导、详情页和 runtime 共用

优点：

- 结果一致
- 容易扩展检查项
- 前端和 runtime 都能复用

缺点：

- 需要同时支持“草稿预检”和“已落盘集群预检”

### 方案 2：前端本地校验 + runtime 阻断

- 向导确认页只做前端字段规则
- 启动前才由 runtime 做后端校验

优点：

- 改动较小

缺点：

- 创建确认页看不到真正的文件级或结构级风险
- 与详情页结果不一致

### 方案 3：仅在 runtime 中补错误摘要

- 不新增可视化预检
- 只在 `start` 失败时拼更好的错误文案

优点：

- 风险最低

缺点：

- 仍然不是“启动前可见”
- 无法满足标准闭环目标

## 选型

选择方案 1：`运行前统一预检服务`

原因：

- 这是最符合标准闭环目标的最小实现
- 可以直接覆盖创建确认页、详情页、手动启动、自动启动四条链路
- 检查项集中后，后续加入更多规则时不会继续把逻辑散落到 UI 和 runtime 各处

## 设计总览

第一版预检由两个入口组成：

1. `draft preview`
   面向创建向导确认页，输入为尚未落盘的 `ClusterMutationRequest`
2. `cluster report`
   面向详情页和 runtime，输入为已纳管 cluster slug

两个入口都返回同一种结构化报告：

- `status`
- `fatal_count`
- `warning_count`
- `checks[]`

其中 `checks[]` 每一项包含：

- `code`
- `severity`
- `summary`
- `detail`
- `hint`

## 数据模型

### 报告级别

- `ready`
  没有 `fatal`
- `blocked`
  存在一个或多个 `fatal`

第一版不再额外引入 `degraded`。只要无阻断项，就视为可启动。

### 检查级别

- `fatal`
  会阻止 `start` 和创建后的 `auto start`
- `warning`
  只展示，不阻止

### 检查项编码

第一版固定以下编码：

- `token_missing`
- `cluster_key_missing`
- `cluster_ini_missing`
- `cluster_ini_invalid`
- `master_server_ini_missing`
- `master_server_ini_invalid`
- `caves_server_ini_missing`
- `caves_server_ini_invalid`
- `master_shard_invalid`
- `caves_shard_invalid`
- `host_port_conflict`

不要求一次性做成可配置注册表；第一版用常量即可。

## 第一版检查范围

### 1. 认证材料

检查：

- `cluster_token.txt` 是否存在且非空
- `cluster_key` 是否存在且非空

规则：

- 缺失或空值都是 `fatal`

说明：

- 对创建向导草稿，这两项来自请求体
- 对已落盘集群，这两项分别来自 `cluster_token.txt` 与 `cluster.ini`

### 2. 关键配置文件

检查：

- `cluster.ini`
- `Master/server.ini`
- `Caves/server.ini`

规则：

- 文件缺失是 `fatal`
- 文件存在但解析失败是 `fatal`

### 3. shard 结构合理性

检查：

- Master shard 是否 `is_master = true`
- Caves shard 是否 `is_master = false`
- Master/Caves 名称是否分别为 `Master` / `Caves`
- 必要端口字段是否大于 0

规则：

- 不满足时记为 `fatal`

### 4. 已纳管集群间端口冲突

检查：

- 当前集群声明的 host port 是否与其他已纳管集群重复
- 检查范围只包含：
  - `master_host_port`
  - `caves_host_port`
  - `master_steam_host_port`
  - `caves_steam_host_port`

规则：

- 与其他已纳管集群重复是 `fatal`

说明：

- 第一版不做宿主机实时端口探测
- 只解决“控制平面自己已经管理的集群之间的明显冲突”

## API 设计

### 1. 草稿预检

`POST /api/preflight`

请求体：

- 复用 `ClusterMutationRequest`
- 第一版只接受 `mode = "create"`

返回：

- `200 OK`
- 报告结构

用途：

- 创建向导 review 步骤主动请求
- 在真正 `POST /api/clusters` 前给用户展示预检结果

### 2. 已纳管集群预检

`GET /api/clusters/{slug}/preflight`

返回：

- `200 OK`
- 报告结构

用途：

- 详情页 “Readiness” 卡片
- runtime `start` 前校验

## runtime 接入

### 手动 `start`

在 runtime 执行 `start` 前：

1. 读取该 cluster 的预检报告
2. 如果 `fatal_count > 0`
   - 不调用 compose
   - job 标记为 `failed`
   - `stderr_excerpt` 写入预检摘要
   - 返回 `apierror.Invalid`
3. 如果没有 `fatal`
   - 继续执行原有 `start`

### 创建后的 `auto start`

当前 `auto start` 仍由前端在 create 成功后补发 `start`。

因此不单独在 create service 中耦合预检阻断，而是：

- review 步骤先展示草稿预检
- 若用户仍提交，create 正常落盘
- 随后 `start` 会再次走已纳管集群预检并决定是否阻断

这样可以保证：

- review 页面和真实启动前使用的是同一种规则模型
- 前端不需要自己复制一套阻断逻辑

## 前端接入

### 1. 创建向导确认页

新增一个 `Preflight` 卡片：

- 进入 review 步骤时触发
- 展示总状态、fatal/warning 数量
- 展示每条检查项的 `summary` 与必要 `hint`

行为：

- 当预检结果为 `blocked` 时，不隐藏“Create cluster”按钮
- 但如果 `auto start = true`，要明确提示“创建仍可继续，但随后 auto-start 会被阻断”

这样可以避免：

- 把“生成目录和文件”与“是否立即可启动”强耦合
- 也符合当前 create 和 start 分离的实现现实

### 2. 详情页 Overview

新增一个 `Readiness` 卡片：

- 常驻显示最近一次报告
- 展示总状态与重点阻断项
- 提供手动刷新按钮

位置：

- 放在现有 Overview 工作区中
- 与状态、连接、日志保持同级

### 3. 动作失败反馈

当 `start` 因预检失败被阻断时：

- 前端沿用现有 action 错误展示
- 把后端返回的结构化摘要展示到局部错误区域

第一版不要求把完整 `checks[]` 嵌回 action 错误对话框。

## 文案与展示边界

第一版文案要求：

- `summary`
  一句话说明问题
- `detail`
  说明当前检测到了什么
- `hint`
  给出最直接修复建议

示例：

- `summary`: `cluster_token.txt is missing`
- `detail`: `runtime/data/Cluster_A/cluster_token.txt was not found`
- `hint`: `Add a valid Klei cluster token before starting the cluster`

前端展示时：

- 默认显示 `summary`
- 需要时再显示 `hint`
- 不在卡片里塞太长路径说明

## 测试策略

### 后端

至少覆盖：

- 草稿预检正常通过
- 草稿预检发现 token/key 缺失
- 已纳管集群预检发现配置文件缺失/解析失败
- 已纳管集群预检发现与其他集群 host port 冲突
- runtime `start` 在存在 `fatal` 时被阻断且 job 标记失败
- handler 正确暴露两个预检接口

### 前端

至少覆盖：

- 创建向导 review 步骤会请求并展示预检摘要
- blocked 结果会展示阻断提示
- 详情页会展示 Readiness 卡片
- 详情页刷新预检时能更新状态
- `start` 失败时局部错误仍能展示

## 风险与取舍

### 1. create 与 start 仍然分离

这会导致：

- 用户可以在 blocked 状态下创建成功
- 但随后 auto-start 被阻断

这是当前阶段有意接受的取舍，因为：

- create 的职责是生成受控布局
- start 的职责是判断能否实际运行
- 先不要把 create 和 runtime 强行耦合到一个事务里

### 2. 只做已纳管冲突，不做宿主机实时探测

这意味着：

- 仍可能与控制平面外的程序或容器撞端口

这是第一版边界，后续若需要可再接宿主机级探测。

## 结论

预检第一版应作为标准闭环的基础能力补齐，并以统一服务的方式同时服务：

- 创建向导确认页
- 详情页就绪度展示
- 手动和自动启动前阻断

这样用户第一次能在控制平面里直接看到“当前为什么不能启动”，而不是继续依赖失败任务和经验猜测。
