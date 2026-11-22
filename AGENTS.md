# OpenCode Agent 源码约定

- 只改本仓并 push；勿改用户 `{systemRoot}/agents/opencode_agent` 业务代码。
- Deploy：ZIP 安装、`npm install`、MCP 写入 `home/config/opencode/opencode.json`、带 `XDG_CONFIG_HOME` 启动。
- 勿把会话/密钥提交进 Git。
