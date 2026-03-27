# 控制平面开发说明

## 当前状态

控制平面 V2 目前处于骨架阶段：

- `api/` 提供最小 Go 服务入口
- `web/` 提供最小 React + TypeScript + Vite 前端入口
- `deploy/docker-compose.control-plane.yml` 提供本地开发用 compose 模板

## 目录约定

- `api/`
  Go 后端
- `web/`
  前端控制台
- `deploy/`
  本地开发和部署模板
- `docs/`
  控制平面自身文档

## 后续开发原则

- 后端测试优先走 Go 单元测试
- 前端优先围绕 API 契约和关键页面写测试
- 真实集群配置以文件为准，不把数据库做成唯一真相源
