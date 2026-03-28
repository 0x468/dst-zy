# 控制平面验收与回归说明

## 目的

这份文档回答两个问题：

1. 当前控制平面到底应该怎么验收。
2. 每条验证命令分别证明了什么，不证明什么。

第一阶段控制平面仍然处于 alpha，所以“能启动页面”不等于“核心链路可用”。建议至少按下面顺序执行一轮。

## 最小验收顺序

### 1. 后端单元测试

```bash
docker run --rm \
  -e GOPROXY=https://goproxy.cn,direct \
  -v "$PWD":/workspace \
  -w /workspace/control-plane/api \
  golang:1.26.1-bookworm \
  go test ./...
```

这一步主要覆盖：

- 鉴权与会话
- 受控目录边界
- 配置文件解析与落盘
- 任务记录与 compose runtime 接线
- HTTP handler 的状态码与错误映射

它不证明：

- 前端页面交互没问题
- 镜像里的静态资源能正确打包
- 真实部署镜像可以正常提供页面

### 2. 前端测试

```bash
cd control-plane/web
npm test
```

这一步主要覆盖：

- 登录、会话恢复、会话过期
- 集群创建/导入/切换
- 配置保存与高级原文保存
- 生命周期动作与本地错误展示

它不证明：

- Go 后端真实返回的接口都能在容器里跑起来
- `docker compose` 执行链路没有断
- 单镜像部署路径可用

### 3. create/import 端到端脚本

```bash
bash control-plane/tests/e2e/create-cluster.sh
bash control-plane/tests/e2e/import-cluster.sh
```

这两条脚本默认使用：

- 临时数据目录
- `dry-run` 执行模式
- 容器内 `go run`

它们主要证明：

- 登录链路可用
- `create` / `import` 两条核心 API 能走通
- 受控目录与 SQLite 数据流接线正常
- 配置读取、保存、任务列表能闭环

它们不证明：

- 真实部署镜像能正常提供页面
- `compose` 真执行模式下能成功操作宿主机 Docker

### 4. 单镜像 smoke

```bash
docker build -f control-plane/Dockerfile -t dst-control-plane:v2-check .
bash control-plane/tests/e2e/smoke-image.sh
```

`smoke-image.sh` 默认验证：

- `/healthz`
- `/`
- 未登录访问受保护 API 返回 JSON `401`
- 登录后空集群列表可以正常读取

它主要证明：

- Go 二进制与前端静态资源都已打进镜像
- 真实镜像启动路径没有断
- 鉴权中间件与基础 API 在镜像内工作正常

它不证明：

- 完整 create/import 流程在单镜像模式下已逐项覆盖
- `compose` 模式在你当前宿主机权限模型下一定可用

## 推荐组合

### 本地开发时

最少跑：

```bash
docker run --rm \
  -e GOPROXY=https://goproxy.cn,direct \
  -v "$PWD":/workspace \
  -w /workspace/control-plane/api \
  golang:1.26.1-bookworm \
  go test ./...

cd control-plane/web
npm test
```

### 提交前

建议跑：

```bash
docker run --rm \
  -e GOPROXY=https://goproxy.cn,direct \
  -v "$PWD":/workspace \
  -w /workspace/control-plane/api \
  golang:1.26.1-bookworm \
  go test ./...

cd control-plane/web
npm test

bash control-plane/tests/e2e/create-cluster.sh
bash control-plane/tests/e2e/import-cluster.sh

git diff --check
```

### 准备试用镜像时

再额外跑：

```bash
docker build -f control-plane/Dockerfile -t dst-control-plane:v2-check .
bash control-plane/tests/e2e/smoke-image.sh
```

## 常见失败先看哪里

### create/import e2e 启不来

优先看脚本自动打印的容器日志，常见问题是：

- 容器内 `go run` 拉依赖失败
- 健康检查等待超时
- 受控根目录路径不对
- SQLite 初始化失败

### smoke-image 失败

优先区分：

- `/healthz` 不通：镜像启动失败或监听地址不对
- `/` 不通：前端静态资源没有正确打包进镜像
- `/api/clusters` 未登录不是 `401 JSON`：鉴权边界回归
- 登录后读不到空列表：会话或 API 接线异常

### 前端测试失败但后端测试通过

通常先看：

- 错误提示文案是否改了但测试没更新
- 会话恢复或状态清理路径是否被影响
- 本地表单错误是否仍然误走全局 banner

## 当前结论边界

如果以上四类验证都通过，可以比较有把握地说：

- 控制平面的 alpha 关键链路当前可用
- 本地开发路径与单镜像路径都至少通过了 smoke
- 鉴权、配置编辑、任务记录、create/import 主链路没有明显断点

但仍然不能因此推出：

- 公网部署已经安全
- 多用户与权限模型已经成熟
- `compose` 真执行模式在所有宿主机环境都等价稳定

这些边界仍以 [security.md](security.md) 为准。
