# OpenCode Agent 源码约定

- 只改本仓；由维护者审核后自行 push。勿改用户 `{systemRoot}/agents/opencode_agent` 业务代码。
- **本仓负责**：`deploy/manifest.json`、`deploy/open-web.mjs`（serve + `/api/pair`）、MCP 骨架、package.json。
- **Deploy 只负责**：ZIP 安装、`npm install`、MCP 注入、调用 `open-web.mjs` 后开顶级 WebView。
- 勿把会话 / `OPENCODE_PASSWORD` / `home/` 提交进 Git。
