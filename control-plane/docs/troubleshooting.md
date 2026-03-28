# 控制平面故障排查

## 适用范围

这份文档面向控制平面 V2 第一阶段 alpha，重点处理下面几类问题：

- 服务起不来
- 页面能开但 API 不通
- create/import/save/action 失败
- e2e/smoke 脚本失败
- 单镜像部署路径异常

如果你现在还没有跑过基础验收，建议先看：

- [verification.md](verification.md)

## 先做的三件事

出现问题时，先不要猜。优先确认这三件事：

1. `/healthz` 是否正常。
2. 未登录访问 `/api/clusters` 是否返回 JSON `401`。
3. 容器日志里第一处真正的错误是什么。

最小检查命令：

```bash
curl -i http://127.0.0.1:8080/healthz
curl -i http://127.0.0.1:8080/api/clusters
docker logs <control-plane-container>
```

## 常见问题

### 1. `/healthz` 不通

通常先看：

- 容器有没有真正启动
- `DST_CONTROL_PLANE_LISTEN_ADDR` 是否和端口映射一致
- 宿主机端口是否冲突

常见现象：

- `curl: (7) Failed to connect`
- 容器反复退出重启
- `docker ps` 看不到服务

如果是单镜像部署，还要额外确认：

- 镜像是否真的重新 build 过
- compose 文件里的 `ports` 是否映射到正确宿主机端口

### 2. 页面能打开，但 `/api/*` 一直 `401`

先区分两种情况：

- 未登录时 `401`
  这是正常行为。
- 已登录后所有受保护 API 都变成 `401`
  优先怀疑会话失效、`DST_CONTROL_PLANE_SESSION_SECRET` 变更，或 cookie 没带上。

当前控制平面现在会把 `401` 统一返回为：

```json
{"error":"Unauthorized"}
```

如果前端已经登录，但某个动作突然把你打回登录页并提示 `Session expired`，通常说明：

- 会话真的过期了
- 服务端重启后会话密钥变了
- 请求实际上打到了另一个会话状态不同的实例

### 3. 登录直接变成 `429`

如果 `/api/login` 返回：

```json
{"error":"too many login attempts"}
```

说明基础登录失败限流已经触发。

优先检查：

- 最近是不是连续输错了密码
- `DST_CONTROL_PLANE_LOGIN_RATE_LIMIT_MAX_ATTEMPTS` 是否配得过小
- `DST_CONTROL_PLANE_LOGIN_RATE_LIMIT_WINDOW` 是否配得过长

当前第一阶段实现是进程内限流，所以：

- 等待时间窗过去后会自动恢复
- 重启服务也会清空计数
- 这属于基础防护，不是更完整的公网级防爆破方案

### 4. create/import 返回 `400`

这类通常不是服务坏了，而是输入被后端明确拒绝了。当前常见错误包括：

- `invalid cluster slug`
- `base_dir required for import`
- `path outside managed root`

优先检查：

- slug 有没有包含 `/`、`\`、`..`
- import 模式是否真的提供了 `base_dir`
- `base_dir` 是否位于 `DST_CONTROL_PLANE_DATA_ROOT` 之下

第一阶段控制平面故意不允许越界导入宿主机任意路径，这是安全边界，不是 bug。

### 5. config save / raw save 返回 `400`

最常见的是：

- `invalid cluster.ini`

说明原文编辑区提交的 `cluster.ini` 内容已经无法被当前解析器接受。优先检查：

- 是否缺了 `=` 号
- section 头是否写错，例如 `[NETWORK`
- 是否把原文编辑内容截断了

现在前端会把这类错误直接显示在对应表单内部，而不是只丢到页面最上方。

### 6. action 失败

如果是 `dry-run` 模式：

- 重点看任务有没有被创建出来
- 不要期待真的启动或停止 DST 容器

如果是 `compose` 模式：

- 先看任务详情里的 `stdout_excerpt` / `stderr_excerpt`
- 再看目标集群目录下生成的 compose 与 `.env`
- 最后再看宿主机 Docker 权限是否真的允许控制平面操作

如果错误是：

- `unsupported action`

说明请求里传了当前控制平面不支持的动作值，而不是底层 Docker 执行失败。

### 7. e2e 脚本起不来

create/import 脚本当前走的是容器内 `go run` 路径。优先看脚本自动打印的容器日志，常见问题包括：

- Go 依赖下载失败
- 健康检查没等到服务起来
- 临时数据目录权限不对
- 受控根目录路径与容器内路径不一致

当前脚本已经显式设置：

```text
GOPROXY=https://goproxy.cn,direct
```

如果你在不同网络环境里仍然拉依赖失败，可以先手动确认对应镜像是否能访问代理，或者改用预构建镜像 smoke。

### 8. `smoke-image.sh` 失败

先定位是哪一步挂了：

- `/healthz` 挂：
  服务没起来，或监听地址/端口不对。
- `/` 挂：
  静态资源没打进镜像。
- 未登录 `/api/clusters` 不是 JSON `401`：
  鉴权边界回归。
- 登录后空列表读不到：
  会话或 API 接线异常。

这条脚本默认不覆盖 create/import 全链路，它只负责验证“真实镜像路径的最小可用性”。

## 日志看什么

### 控制平面容器日志

优先关注：

- 服务是否开始监听
- 第一条 panic 或 fatal
- 与 SQLite、Docker、文件路径相关的错误

### 前端页面里的错误提示

当前前端已经做了两层区分：

- 全局错误
  登录、会话恢复、会话过期这类状态问题。
- 本地表单错误
  create/import、配置保存、原文保存、生命周期动作。

如果错误只在本地表单区域出现，优先怀疑那一块操作本身，不要先怀疑整个控制平面都坏了。

## 什么时候该怀疑是代码回归

下面这些更像代码回归，而不是环境问题：

- 未登录访问受保护 API 不再返回 JSON `401`
- create/import/save/action 的具体错误文案突然变回笼统失败
- 切换 cluster 时详情区又短暂显示上一个 cluster 的旧配置
- 会话恢复失败却仍然进入 dashboard

这类情况建议直接重新跑：

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

## 当前边界

如果你排查到最后发现问题和下面这些主题有关，那大概率已经超出第一阶段既定边界：

- 多用户 / RBAC
- 公网暴露策略
- 更严格的 CSRF 与限流
- 更细的安全审计与告警
- 非 compose 执行后端

这些不是当前版本承诺已经完善的部分，相关限制以 [security.md](security.md) 为准。
