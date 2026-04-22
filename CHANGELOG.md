# Changelog

All notable changes to this project will be documented in this file.

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
