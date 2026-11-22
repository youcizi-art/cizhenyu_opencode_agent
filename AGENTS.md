# OpenCode Agent 源码约定

- 只改本仓；由维护者审核后自行 push。勿改用户 `{systemRoot}/agents/opencode_agent` 业务代码。
- Deploy：ZIP 安装、`npm install`、MCP 写入 `home/config/opencode/opencode.json`。
- 客户入口：Deploy 后台 `opencode serve` + 顶级 WebView（官方 Web UI）；CLI 仅调试。
- 勿把会话 / `OPENCODE_PASSWORD` / `home/` 提交进 Git。
