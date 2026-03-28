# 控制平面开发说明

## 当前阶段

控制平面 V2 目前处于第一阶段 alpha，目标是：

- 在单机上管理多个 DST 集群
- 支持创建新集群与导入已有集群
- 提供表单编辑与高级原文编辑
- 通过每个集群自己的 `docker compose` 执行生命周期操作

当前并不是为了直接替代成熟的公网上线面板，也不是为了支持复杂多租户。

## 项目结构

- `api/`
  Go 后端。负责鉴权、受控目录、配置解析、任务与审计、API 路由。
- `web/`
  TypeScript/React 前端。负责登录、集群列表、详情页、表单编辑和任务展示。
- `deploy/`
  开发 compose、单镜像部署 compose 和反代示例。
- `docs/`
  控制平面自己的使用、部署与安全说明。
- `tests/e2e/`
  端到端烟雾脚本，覆盖 create/import 两条核心链路。
- `tests/fixtures/`
  e2e 与解析测试使用的最小夹具。

## 开发原则

- 文件是真相源，数据库只保存管理元数据
- 受控根目录是安全边界，不接受越界路径
- 第一阶段执行边界继续维持在 `docker compose`
- 用户文档默认写中文
- 每次提交前必须补对应验证，不跳过 smoke/e2e

## 本地验证

后端验证：

```bash
docker run --rm -v "$PWD":/workspace -w /workspace/control-plane/api golang:1.26.1-bookworm go test ./...
```

前端验证：

```bash
docker run --rm -v "$PWD":/workspace -w /workspace/control-plane/web node:22.22.1-bookworm npm test
```

端到端验证：

```bash
bash control-plane/tests/e2e/create-cluster.sh
bash control-plane/tests/e2e/import-cluster.sh
bash control-plane/tests/e2e/smoke-image.sh
```

开发 compose 配置检查：

```bash
docker compose -f control-plane/deploy/docker-compose.control-plane.dev.yml config
docker compose -f control-plane/deploy/docker-compose.control-plane.yml config
```

仓库级格式检查：

```bash
git diff --check
```

## Toolchain 约定

当前已经验证过的容器工具链版本：

- `golang:1.26.1-bookworm`
- `node:22.22.1-bookworm`

使用容器化工具链的原因是：

- 降低宿主机依赖差异
- 让验证命令更容易复现
- 便于后续 CI 直接复用

## E2E 约定

端到端脚本默认使用：

- 独立的临时数据根目录
- `dry-run` 执行模式
- 固定端口 `18080` / `18081`
- 镜像 smoke 使用固定端口 `18082`

这样可以在不真正启停 DST 集群的前提下，验证控制平面的关键管理链路。

如果脚本失败，它会自动打印对应容器日志，优先用来判断是：

- API 接线问题
- 受控目录问题
- SQLite 或任务层问题
- 健康检查等待时间不足

`smoke-image.sh` 额外覆盖真实部署镜像路径，而不是 `go run` 开发路径。默认会使用本地镜像标签 `dst-control-plane:v2-check`，也可以通过环境变量覆盖：

```bash
CONTROL_PLANE_IMAGE=your-image:tag bash control-plane/tests/e2e/smoke-image.sh
```
