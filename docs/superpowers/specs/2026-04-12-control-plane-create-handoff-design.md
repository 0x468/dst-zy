# DST 控制平面创建接管增强设计

## 背景

当前标准闭环已经具备以下能力：

- 向导式创建 `Master + Caves` 集群
- 创建前预检
- 创建后进入长期管理详情页
- 基础的启停、日志、备份、配置编辑

但“在面板里新建并长期管理集群”这条主线仍有两个明显缺口：

- 创建阶段缺少少量高频、长期管理会马上用到的字段
- Review 页对“将会生成什么、创建后将接管什么”展示不够完整

这会导致用户虽然能创建集群，但在创建完成之前，很难确信最终落盘配置和后续接管结果是否符合预期。

## 目标

在不扩大范围的前提下，增强“创建后立即接管”的产品闭环，使用户在创建阶段就能完成一组高频长期管理字段的配置，并在确认页清楚看到：

- 将写入哪些核心配置
- 将使用哪些端口
- 将生成哪些目录
- 创建后会进入哪个长期管理工作区

## 非目标

本阶段不包含：

- 图形化 mod 管理
- 历史集群扫描和自动纳管
- 世界参数大全表单
- 额外的运行时动作扩展
- 复杂权限或多租户

## 方案

本阶段只增强现有标准闭环，不新增新的流程分支。

### 1. 创建向导新增高频管理字段

在现有向导字段基础上，新增三项高频字段：

- `cluster password`
- `pvp`
- `pause when empty`

选择这三项的原因：

- 都是标准 `cluster.ini` 的核心字段
- 都直接影响新集群的实际游玩体验
- 都属于创建后短时间内最常被调整的配置
- 不会引入复杂的高级世界参数爆炸

字段分布：

- `cluster password` 放在 `Authentication` 步骤
- `pvp`、`pause when empty` 放在 `Basics` 步骤

### 2. Review 页增强为“创建接管摘要”

当前 Review 页只展示少量标识与端口信息，不足以支撑创建确认。

增强后应至少展示：

- 标识信息：`slug`、`display name`、`cluster name`
- 房间信息：`description`、`game mode`、`max players`、`intent`
- 运行信息：`time zone`、`auto start`
- 游戏行为：`pvp`、`pause when empty`
- 认证信息：是否设置 `cluster password`、`cluster key`
- 端口信息：四个 host 端口
- 运行结构：将生成的 `compose/`、`runtime/data/<cluster>`、`runtime/ugc/`、`runtime/dst/`、`runtime/steam-state/`

其中：

- `cluster password` 不回显真实值，只显示“已设置/未设置”
- Review 页明确说明创建完成后会自动切换到该集群详情页继续长期管理

### 3. 后端创建链路同步写入新字段

创建请求需要新增并贯通以下字段：

- `cluster_password`
- `pvp`
- `pause_when_empty`

后端 `snapshotFromCreateRequest` 和 `writeSnapshot` 必须确保这些字段真正写入 `cluster.ini`，否则 Review 页与真实落盘结果会不一致。

### 4. 数据与兼容性原则

- 仅扩展创建请求，不修改现有导入链路的必填要求
- 新字段均有合理默认值
- 对旧前端或未传字段的场景保持兼容，后端使用现有默认快照进行补全

## 测试策略

### 后端

- `handlers` 测试覆盖新建请求 JSON 解码与字段透传
- `service` 测试覆盖 `snapshotFromCreateRequest` 和最终 `cluster.ini` 落盘结果

### 前端

- `CreateClusterWizard` 测试覆盖新增字段输入、Review 展示、提交 payload
- `App` 层只在必要时补充联通性测试，不重复测试向导细节

## 结果预期

完成后，用户在控制平面里创建新集群时，将不再只是“填一个最小可启动表单”，而是能够在创建阶段完成一组真正服务于长期管理的核心配置，并在确认页清楚理解：

- 这次创建会生成什么
- 会写入哪些关键参数
- 创建后将进入哪个被控制平面长期接管的工作区
