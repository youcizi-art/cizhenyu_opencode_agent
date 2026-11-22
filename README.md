# CIZHENYU OpenCode Agent

Deploy 内置第三 Agent 包装仓。用户安装副本：`{systemRoot}/agents/opencode_agent`。

## 结构

- `package.json` — 依赖 `@opencode/cli`（npm postinstall 拉平台二进制；内含官方 Web UI）
- `.npmrc` — 允许 `@opencode/cli` lifecycle scripts
- `deploy/manifest.json` — 版本与安装 / runtime 约定
- `home/` — 仅安装副本；`XDG_CONFIG_HOME` → `home/config`

## 客户入口（Web）

Deploy **不**内嵌聊天 SPA，也 **不**下载 OpenCode Desktop。

1. 后台启动：`opencode serve --hostname 127.0.0.1 --port 13990`（端口可顺延）
2. 环境：`XDG_CONFIG_HOME={install}/home/config`，`OPENCODE_PASSWORD`（写入 `home/.cizhenyu-opencode-password`，勿进 Git）
3. 顶级 WebView 打开官方 Web UI（Basic 认证 URL）
4. 卡片「命令行」仅为调试用 TUI

## 隔离

配置落在：

`{install}/home/config/opencode/opencode.json`

禁止用本机 `~/.config/opencode` 冒充隔离数据面。MCP 由 Deploy 注入 `mcp.servers`。

## 开发

本地改本仓；**由维护者审核后自行 push** 到 https://github.com/youcizi-art/cizhenyu_opencode_agent.git 。用户侧 Deploy「Agent」第三张卡片安装 / 打开。
