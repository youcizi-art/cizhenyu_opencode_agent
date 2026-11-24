# CIZHENYU OpenCode Agent

Deploy 内置第三 Agent 包装仓。用户安装副本：`{systemRoot}/agents/opencode_agent`。

## 结构

- `package.json` / `.npmrc` — `@opencode/cli`
- `deploy/manifest.json` — 安装与 runtime 约定
- `deploy/open-web.mjs` — **本机 serve + 配对 URL**（Deploy 调用）
- `deploy/opencode.mcp.snippet.json` — MCP 骨架参考

## 客户入口

1. Deploy 安装 ZIP + `npm install`
2. Deploy 按 `deploy/manifest.json` → `market` 预装 `awesome-opencode-market`（解压到 `home/config/opencode/plugins/`，写入 `opencode.json` plugins）
3. 打开时 Deploy 执行 `node deploy/open-web.mjs`（环境：`XDG_CONFIG_HOME` / `XDG_CACHE_HOME` / `OPENCODE_PASSWORD`）
4. 脚本输出 `connectUrl`（及项目 `sessionUrl`）→ Deploy 顶级 WebView 打开（用户无需填运行地址）

## 社区插件市场

OpenCode **Web UI 当前无法加载 GUI Market 面板**（Desktop-only）。Deploy Ops 卡片提供「插件市场」抽屉：npm 搜索 + 安装到隔离 `home/config/opencode/plugins/`。验证目录站点：https://awesome-market.github.io/awesome-opencode-market/

安装时仍预装 `awesome-opencode-market` 包；内核 npm 安装过程会心跳更新进度（体积大属正常）。

## 开发

本地改本仓；由维护者审核后自行 push。勿在 Deploy 内再实现 serve/pair。
