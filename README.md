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

与 DSH `dshmarket` 同属方案 A：安装时默认开启。目录见 [awesome-opencode-market](https://github.com/awesome-market/awesome-opencode-market)。

## 开发

本地改本仓；由维护者审核后自行 push。勿在 Deploy 内再实现 serve/pair。
