# Jira CLI

Jira 命令行工具，支持 Cloudflare Access 认证。

> GitHub: https://github.com/fightmonster/j2c

## 安装

```bash
npm install -g https://github.com/fightmonster/j2c/releases/latest/download/jira2claw-cli-1.2.2.tgz
```

安装后全局可用 `jira2claw` 和 `j2c` 命令。

## 认证配置

### 非交互模式（推荐自动化场景）

```bash
j2c setup --pat <token> --cf-client-id <id> --cf-client-secret <secret>
```

| 参数 | 说明 |
|------|------|
| `--pat <token>` | Jira Personal Access Token |
| `--cf-client-id <id>` | CF Access Client ID |
| `--cf-client-secret <secret>` | CF Access Client Secret |

### 交互模式

```bash
j2c setup
```

### 检查状态

```bash
j2c
```

## 命令列表

| 命令 | 说明 |
|------|------|
| `j2c setup` | 配置认证信息（交互式或命令行参数） |
| `j2c me` | 显示当前用户信息及 issue 统计 |
| `j2c list [options]` | 搜索/列出 Issues |
| `j2c view <issueId>` | 查看 Issue 详情（表格格式） |
| `j2c read <issueId>` | 读取 Issue 输出为 Markdown/JSON |
| `j2c projects [key]` | 列出所有项目 / 查看项目 issue 统计 |
| `j2c status <issueId> [target]` | 查看或更改 Issue 状态 |
| `j2c assign <issueId> <user>` | 分配 Issue |
| `j2c comment <issueId> -m <text>` | 添加评论 |
| `j2c list-comments <issueId>` | 列出评论 |
| `j2c edit-comment <issueId>` | 编辑评论 |
| `j2c delete-comment <issueId>` | 删除评论 |
| `j2c fields <issueId>` | 列出 Issue 的自定义字段 |
| `j2c fields-update <issueId> <f> <v>` | 更新自定义字段 |
| `j2c update-summary <issueId> <text>` | 更新 Summary |
| `j2c update-description <issueId> <text>` | 更新 Description |
| `j2c download <issueId>` | 下载附件 |
| `j2c export --jql <jql>` | 批量导出 Issues（自动分页，全量字段） |
| `j2c batch-transition [ids...]` | 批量更改状态 |
| `j2c batch-comment [ids...]` | 批量添加评论 |

## 示例

### 日常使用

```bash
# 查看当前用户信息及项目统计
j2c me

# 列出所有项目
j2c projects

# 查看项目 issue 统计
j2c projects XOS

# 搜索我的 Open issues
j2c list -a me -s Open

# 查看指定 issue
j2c view XOS-731

# 读取 issue 为 Markdown
j2c read XOS-731

# 使用 JQL 搜索
j2c list -j "project = XOS AND status = Open ORDER BY updated DESC"

# 统计数量
j2c list -p XOS -t Bug --count

# 自定义字段筛选（注意：严格匹配字段名）
j2c list -j "project = PNX AND \"SoC Req ID\" is not EMPTY" -e table
```

> **💡 AI 使用提示：**
> - **优先使用 JQL 精确筛选**，而不是先导出 JSON 再分析
> - **严格匹配字段名**：用户说 "SoC Req ID" 就用 `"SoC Req ID"`，不要猜测
> - **先用 `j2c fields <issueId>` 确认字段名**，再用 JQL 筛选

### 聚合统计（--stats）

```bash
# 谁的未关闭 issue 最多 top 3
j2c list -j "statusCategory != Done" --stats assignee --top 3

# 按项目+经办人分组
j2c list -j "statusCategory != Done" --stats project,assignee --top 10

# 按项目统计
j2c list -j "status = Open" --stats project

# CSV 格式输出（方便 AI 解析）
j2c list -j "statusCategory != Done" --stats project,assignee -e csv

# 全量列表（自动分页）
j2c list -j "project != XOS AND status = Open" -e csv -m 0
```

### 数据导出

```bash
# 全量导出项目为 CSV（自动分页，含全部 navigable 字段）
j2c export --jql "project = XOS" -o xos_all.csv

# 导出 Open 状态 issue 为 JSON
j2c export --jql "project = XOS AND status = Open" -f json -o xos_open.json

# 导出为 Markdown
j2c export --jql "project = XOS" -f md -o xos.md

# 限制导出数量
j2c export --jql "project = XOS" -m 100 -o xos_100.csv

# 包含所有字段（含不可导航字段）
j2c export --jql "project = XOS" --all-fields -o xos_full.csv
```

### 状态和评论操作

```bash
# 更改 issue 状态
j2c status XOS-731 "In Progress"

# 分配 issue
j2c assign XOS-731 john.doe

# 添加评论
j2c comment XOS-731 -m "这是一个评论"

# 添加 Markdown 格式评论
j2c comment XOS-731 -m "## 分析结果\n\n问题已确认" --markdown

# 读取评论到文件，编辑后写回
j2c list-comments XOS-731 --last -o comment.txt
vim comment.txt
j2c edit-comment XOS-731 --last --file comment.txt -y
```

### 批量操作

```bash
# 批量更改状态
j2c batch-transition --jql "project = XOS AND status = Open" -s Done -y

# 批量添加评论
j2c batch-comment --jql "project = XOS" -m "统一处理" --markdown -y

# 预览模式
j2c batch-transition --jql "project = XOS" -s Done --dry-run
```

## 获取认证信息

### CF Service Token

```bash
j2c setup --cf-client-id <id> --cf-client-secret <secret>
```

CF Access Client ID 和 Client Secret 由管理员提供。

### PAT (Personal Access Token)

1. 访问 https://www.rxpim.com/secure/ViewProfile.jspa
2. 点击 Security → API tokens
3. 创建新令牌

```bash
j2c setup --pat <token>
```

## 更新日志

查看 [CHANGELOG.md](./CHANGELOG.md) 了解版本更新历史。

## 当前版本

v1.2.2 - 修复 assign 命令在 Jira Server 版本的兼容性问题
