# Changelog

All notable changes to this project will be documented in this file.

## [1.4.2] - 2026-06-12

### Changed
- **命令行提示优化**：将 `j2c` 报错与配置提示的命令行示例整合为单条完整命令，并补充 `oauth2ClientSecret` (`--oauth-secret`) 的配置说明，避免用户或 Agent 分步执行导致验证机制阻断。

## [1.4.1] - 2026-06-09

### Fixed
- **文档一致性修复**：修正 `setup` 命令非交互模式的过期 Cloudflare 参数说明，更新为现行的 Keycloak 认证及 OAuth 秘钥参数。
- **文档参数补齐**：补齐 `list-comments` 命令的 `--render` 选项描述。
- **AI 体验优化**：优化未登录或连接失败状态下的提示信息，在错误退出逻辑中也输出说明文档路径，确保 AI Agent 在任何状态下都能定位到 [docs/jira2claw-cli.md](file:///Users/luojun/workspace/jira-cli/docs/jira2claw-cli.md)。

## [1.4.0] - 2026-05-07

### Added
- **自动格式检测**：`comment` 和 `batch-comment` 命令支持自动识别内容格式
  - 自动检测纯文本、Markdown、ADF JSON 格式
  - 无需手动指定 `--markdown` 参数
  - 检测规则：ADF JSON（以 `{` 开头且含 `"type": "doc"`）、Markdown（含 `#`、`**`、表格、列表等语法）、纯文本

### Fixed
- **Markdown → WikiMarkup 转换优化**：符合 Confluence Wiki Markup 9.1 规范
  - 修复引用块转换：`> quote` → `bq. quote`（单行引用语法）
  - 修复表格内换行：`<br>` 转为 `\\` 后自动补空格（`\\•` → `\\ •`）
  - 修复连续换行：`<br><br>` → `\\ \\`（空格分隔）
  - 所有转换现已通过 Jira Server 9.12 测试

### Changed
- `comment` 命令输出显示检测到的格式类型：`(format: Markdown)`

## [1.3.0] - 2026-04-23

### Added
- **批量导出增强**：`export` 命令支持全量字段导出
  - 新增 `--all-fields` 选项，包含不可导航字段
  - CSV 自动包含所有 navigable 字段（含自定义字段）
  - 字段列头格式：`显示名 (customfield_xxxxx)`

### Fixed
- 修复中文文件名上传问题：自动转换为 Unicode 转义序列

## [1.2.2] - 2026-04-22

### Fixed
- **assign 命令修复**：修复了 Jira Server 版本的 issue 分配功能
  - 使用官方 REST API `/rest/api/2/issue/{issueId}/assignee` 端点
  - 使用 `name` 参数（用户名）而不是 `accountId`（Jira Cloud）或 `key`（已废弃）
  - 参考：https://docs.atlassian.com/software/jira/docs/api/REST/9.12.10/#api/2/issue-assign
  - 测试通过：XOS-730 和 XOS-731 分配功能正常工作

### Changed
- 改进了错误处理和错误信息显示

## [1.2.1] - 2026-04-15

### Added
- 初始版本发布
- 支持 Cloudflare Access 认证
- 支持基本的 Jira 操作（查看、搜索、评论、状态变更等）
