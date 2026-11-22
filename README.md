# CIZHENYU OpenCode Agent

Deploy 内置第三 Agent 包装仓。用户安装副本：`{systemRoot}/agents/opencode_agent`。

## 结构

- `package.json` — 依赖 `@opencode/cli`（npm postinstall 拉平台二进制）
- `.npmrc` — 允许 `@opencode/cli` lifecycle scripts
- `deploy/manifest.json` — 版本与安装约定
- `home/` — 仅安装副本；`XDG_CONFIG_HOME` → `home/config`

## 隔离

Deploy 启动时设置 `XDG_CONFIG_HOME={install}/home/config`，配置落在：

`{install}/home/config/opencode/opencode.json`

禁止用本机 `~/.config/opencode` 冒充隔离数据面。

## 开发

推送到 https://github.com/youcizi-art/cizhenyu_opencode_agent.git ；用户侧 Deploy「Agent」第三张卡片安装/打开。
