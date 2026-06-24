# jira2claw CLI 参考

使用 `j2c` (jira2claw) CLI 操作 Jira。

## 安装

```bash
npm install -g jira2claw-cli
```

安装后全局可用 `jira2claw` 和 `j2c` 命令。

## 调用方式

```bash
j2c <command> [options]
```

## 认证配置

### 非交互模式（推荐 openclaw 等自动化场景）

```bash
j2c setup --pat <token> --kc-username <username> --kc-password <password> --oauth-secret <secret>
```

| 参数 | 说明 |
|------|------|
| `--pat <token>` | Jira Personal Access Token |
| `--kc-username <username>` | Keycloak Username (通常是邮箱) |
| `--kc-password <password>` | Keycloak Password |
| `--oauth-secret <secret>` | OAuth2 Client Secret |

### 交互模式

```bash
j2c setup
```

### 检查状态

```bash
j2c
```

### 更新 CLI

```bash
j2c update [--check]
```

`update` 查询 `fightmonster/j2c` 的 GitHub 最新 Release。发现高于当前版本的 `jira2claw-cli.tgz` 资产时，默认执行全局更新；`--check` 只显示是否有更新。GitHub 不可达、没有新版本或资产未就绪时，不会修改当前 CLI，也不需要 Jira 认证。

## 命令分类

| 分类 | 命令 |
|------|------|
| 工具 | `update` |
| 读取 | `read`, `view`, `list`, `fields`, `list-comments`, `me`, `projects` |
| 更新 | `update-summary`, `update-description`, `fields-update` |
| 评论 | `comment`, `edit-comment`, `delete-comment` |
| 状态/分配 | `status`, `transitions`, `assign` |
| 权限/创建发现 | `permissions`, `create-meta`, `create` |
| 批量操作 | `batch-create`, `batch-transition`, `batch-comment`, `export` |
| 附件 | `upload`, `download` |

---

## 读取类命令

### j2c read - 读取 Issue 为 Markdown

```bash
j2c read <issueId> [options]
```

| 选项 | 说明 |
|------|------|
| `-f, --format <md\|json>` | 输出格式 (默认: md) |
| `-o, --output <file>` | 输出到文件 |

**示例:**
```bash
j2c read XOS-731                          # 输出为 Markdown
j2c read XOS-731 -f json                  # 输出为 JSON
j2c read XOS-731 -o /tmp/issue.md          # 保存到文件
```

---

### j2c view - 查看 Issue 详情

```bash
j2c view <issueId>
```

`view` 是 `read` 的别名，默认输出 table 格式。等价于 `j2c read <issueId> -f table`。

**示例:**
```bash
j2c view XOS-731                          # 表格格式查看
j2c view XOS-731 -f md                    # 切换为 Markdown
```

### j2c list - 搜索 Issues

```bash
j2c list [options]
```

| 选项 | 说明 |
|------|------|
| `-p, --project <name>` | 项目名称 |
| `-i, --id <issueId>` | Issue ID |
| `-a, --assignee <email>` | 经办人 (使用 `me` 表示当前用户) |
| `-s, --status <status>` | 状态 |
| `-t, --type <type>` | Issue 类型 (如 SOC, Task, Bug) |
| `-k, --keyword <text>` | 关键词 (模糊匹配) |
| `-j, --jql <query>` | 直接使用 JQL 查询 |
| `-c, --count` | 只显示数量，不返回详情 |
| `-m, --max <num>` | 最大结果数（非负整数；0=全量自动分页，默认: 50） |
| `-e, --export <md\|csv\|table>` | 输出格式 (默认: table) |
| `--stats <fields>` | 按字段聚合统计，逗号分隔: assignee,project,status,issuetype,priority |
| `--top <num>` | stats 模式只显示前 N 名（正整数，默认: 10） |

**示例:**
```bash
j2c list -a me                              # 我的任务
j2c list -p PNX -s Open                    # PNX 项目的 Open 任务
j2c list -p PNX -a gang.cheng -t SOC        # 按类型筛选
j2c list -a gang.cheng -t SOC --count       # 快速统计数量
j2c list -j "project = PNX AND status = Open" -m 100  # JQL 查询
j2c list -k "登录问题" -e md                # 关键词搜索，输出 Markdown
```

> **大数据量自动导出:** 当查询结果超过 100 条且输出格式为 table/md 时，会自动切换为 CSV 文件导出（`jira_export_<timestamp>.csv`），避免终端输出刷屏。

---

### j2c list - 聚合统计（--stats）

`--stats` 模式按指定字段聚合统计，只传输聚合所需的轻量字段，输出几行结果而非全量数据，节省 token。

```bash
j2c list -j "<jql>" --stats <field1[,field2,...]> [--top <n>] [-e csv]
```

**支持字段:** `assignee`, `project`, `status`, `issuetype`, `priority`

**示例:**
```bash
# 谁的未关闭 issue 最多 top 3
j2c list -j "statusCategory != Done" --stats assignee --top 3

# 按项目+经办人分组
j2c list -j "statusCategory != Done" --stats project,assignee --top 10

# 按项目统计 Open issue
j2c list -j "status = Open" --stats project

# CSV 格式输出（方便 AI 解析）
j2c list -j "statusCategory != Done" --stats project,assignee -e csv
```

---

### j2c list - JQL 高级查询

使用 `-j` 或 `--jql` 选项可以直接编写 JQL 查询，实现复杂筛选：

```bash
j2c list -j "<jql_query>" [options]
```

> **💡 AI 使用提示：**
> 1. **优先使用 JQL 精确筛选**，而不是先导出 JSON 再分析。`j2c list -j` 已经足够强大。
> 2. **严格匹配用户指定的字段名**，不要模糊猜测。例如用户说 "SoC Req ID"，就用 `"SoC Req ID"`，不要猜测为 "Req ID"。
> 3. **先用 `j2c fields <issueId>` 确认字段名**，再用 JQL 筛选。
> 4. **自定义字段 JQL 语法**：`"字段名" is not EMPTY` 或 `"字段名" = "值"`

**常用字段:**

| 字段 | 说明 | 示例 |
|------|------|------|
| `assignee` | 经办人 | `assignee = jun.luo` |
| `reporter` | 报告人 | `reporter = jun.luo` |
| `project` | 项目 | `project = XOS` |
| `status` | 状态 | `status = Open` |
| `statusCategory` | 状态分类 | `statusCategory = Done` |
| `issuetype` | Issue 类型 | `issuetype = Bug` |
| `created` | 创建时间 | `created >= 2026-04-01` |
| `updated` | 更新时间 | `updated < -7d` |
| `commentCount` | 评论数 | `commentCount = 0` |
| `priority` | 优先级 | `priority = High` |
| `summary` | 标题（模糊） | `summary ~ "登录问题"` |

**常用时间表达式:**

| 表达式 | 说明 |
|--------|------|
| `2026-04-13` | 指定日期 |
| `-7d` | 7 天前 |
| `-30d` | 30 天前 |

**状态分类值:** `Done`（已完成）、`In Progress`（进行中）、`Open`（未开始）

**常用组合示例:**

```bash
# 查看名下 7 天没动的 issue
j2c list -j "assignee = jun.luo AND updated < -7d" -e md

# 查看 7 天没评论的 Open issue
j2c list -j "assignee = jun.luo AND updated < -7d AND commentCount = 0 AND statusCategory = Open"

# 查看某天创建的 issue
j2c list -j "assignee = jun.luo AND created = 2026-04-10"

# 统计 7 天没动的 issue 数量
j2c list -j "assignee = jun.luo AND updated < -7d" --count

# 导出 7 天没动的 issue 到文件
j2c list -j "assignee = jun.luo AND updated < -7d" -e md -o stale_issues.md
```

---

### j2c fields - 列出自定义字段

```bash
j2c fields <issueId>
```

**示例:**
```bash
j2c fields PNX-3                            # 列出所有自定义字段
```

---

### j2c list-comments - 列出/读取评论

```bash
j2c list-comments <issueId> [options]
```

> 列表模式默认输出每条评论的**完整 body**（面向 AI agent 场景，一次拿全信息）。人类概览或节流用 `--max-chars`，精准取单条用 `--comment-id`。

| 选项 | 说明 |
|------|------|
| `--last` | 只显示最后一条评论 |
| `--comment-id <id>` | 只输出指定评论的完整内容 |
| `--max-chars <n>` | 列表模式截断到指定字符数（默认 0=不截断） |
| `-o, --output <file>` | 输出到文件 (配合 --last / --comment-id 写回) |
| `--render` | 渲染 WikiMarkup 表格为终端表格 (默认输出原始文本) |

**示例:**
```bash
j2c list-comments XOS-731                                # 列出所有评论（完整 body）
j2c list-comments XOS-731 --max-chars 100                # 概览（截断到 100 字符）
j2c list-comments XOS-731 --last                          # 只看最后一条评论
j2c list-comments XOS-731 --comment-id 13026              # 查看指定评论完整内容
j2c list-comments XOS-731 --comment-id 13026 -o c.txt     # 导出指定评论到文件
```

---

### j2c me - 显示当前用户及项目统计

```bash
j2c me
```

显示当前用户信息及其在各个项目中的 issue 统计（总数、已完成、未完成）。

**示例输出:**
```
Current User:
  Display Name: JUN LUO
  Email:        jun.luo@brkg.com
  Username:     jun.luo

My Issues Statistics:

  Foxx SW Requirements (FSW):
    Total:   66
    Done:    0
    Open:    66

  XOS (XOS):
    Total:   63
    Done:    15
    Open:    48

  Total:
    Total:   129
    Done:    15
    Open:    114
```

---

### j2c projects - 列出项目 / 查看项目详情

```bash
j2c projects [projectKey] [options]
```

| 选项 | 说明 |
|------|------|
| `-e, --export <table\|json>` | 输出格式 (默认: table) |

**示例:**
```bash
j2c projects                                 # 列出所有项目
j2c projects XOS                             # 查看 XOS 项目 issue 统计
j2c projects XOS -e json                     # JSON 格式输出
```

**输出示例:**
```
All Projects (18):
  Key    Name                      Type
  XOS    XOS                       Software
  PNX    Foxx SW Requirements      Software
  ...

Project XOS Issue Counts:
  Status       Count
  Total        689
  To Do        420
  In Progress  89
  Done         180
```

---

## 更新类命令

### j2c update-summary - 更新 Summary

```bash
j2c update-summary <issueId> <summary> [options]
```

| 选项 | 说明 |
|------|------|
| `-d, --dry-run` | 预览模式，不实际更新 |

**示例:**
```bash
j2c update-summary XOS-731 "新的标题"
j2c update-summary XOS-731 "新标题" --dry-run
```

---

### j2c update-description - 更新 Description

```bash
j2c update-description <issueId> <description> [options]
```

| 选项 | 说明 |
|------|------|
| `-d, --dry-run` | 预览模式，不实际更新 |

**示例:**
```bash
j2c update-description XOS-731 "新的描述内容"
```

---

### j2c fields-update - 更新自定义字段

```bash
j2c fields-update <issueId> <field> <value>
```

**示例:**
```bash
j2c fields-update PNX-3 "SoC Req ID" "CDR-BAS-004"
```

---

## 评论类命令

### j2c comment - 添加评论

```bash
j2c comment <issueId> -m "<content>" [options]
```

| 选项 | 说明 |
|------|------|
| `-m, --message <text>` | 评论内容（自动检测格式：纯文本/Markdown/ADF JSON） |
| `--markdown` | 强制指定内容为 Markdown 格式 |
| `--adf <json>` | ADF JSON 格式 (Atlassian Document Format) |
| `--attach <filePath>` | 附加文件到评论（自动处理中文文件名） |

**自动格式检测：**
- **ADF JSON**：以 `{` 开头且包含 `"type": "doc"`
- **Markdown**：包含 Markdown 语法（`#` 标题、`**` 粗体、表格、列表、代码块等）
- **纯文本**：无特殊格式标记

**Markdown → WikiMarkup 转换：**
- 符合 Confluence Wiki Markup 9.1 规范（Jira Server 9.12 兼容）
- 表格对齐行自动移除（WikiMarkup 不支持）
- `<br>` 转为 `\\`（表格内换行）或 `\n`（普通换行）

**示例:**
```bash
j2c comment XOS-731 -m "这是一个评论"                    # 自动识别为纯文本
j2c comment XOS-731 -m "## 分析结果\n\n**粗体**"        # 自动识别为 Markdown
j2c comment XOS-731 -m "| 列1 | 列2 |\n|---|---|\n| a | b |"  # 表格自动转换
j2c comment XOS-731 --adf '{"type":"doc",...}'         # ADF JSON 格式
```

---

### j2c edit-comment - 编辑评论

```bash
j2c edit-comment <issueId> [commentId] [body] [options]
```

写回前自动检测格式：Markdown 自动转换为 WikiMarkup（与 `comment` 命令一致），纯文本/已有 WikiMarkup 原样发送。`--fix-format` 可一键修正已存在评论的格式（自动读取现有内容并转换后写回）。

| 选项 | 说明 |
|------|------|
| `--last` | 编辑最后一条评论 |
| `-f, --file <path>` | 从文件读取评论内容 |
| `--markdown` | 强制按 Markdown 处理（自动转换为 WikiMarkup） |
| `--fix-format` | 读取该评论现有内容，自动修正格式后写回 |
| `-d, --dry-run` | 预览模式，不实际更新 |

**推荐工作流:**

```bash
# 一键修正某条 Markdown 评论的格式（最常用）
j2c edit-comment XOS-731 13026 --fix-format

# 先预览转换效果，不实际写回
j2c edit-comment XOS-731 13026 --fix-format --dry-run

# 从文件读取（Markdown 或 WikiMarkup）写回，自动检测转换
j2c list-comments XOS-731 --comment-id 13026 -o comment.txt
vim comment.txt
j2c edit-comment XOS-731 13026 --file comment.txt
```

**示例:**
```bash
j2c edit-comment XOS-731 13026 "新内容"             # 指定 ID 编辑
j2c edit-comment XOS-731 --last "新内容"             # 编辑最后一条
j2c edit-comment XOS-731 13026 --fix-format          # 一键修格式
j2c edit-comment XOS-731 13026 "## 标题" --markdown  # 强制按 Markdown 转换写回
```

---

### j2c delete-comment - 删除评论

```bash
j2c delete-comment <issueId> [commentId] [options]
```

| 选项 | 说明 |
|------|------|
| `--last` | 删除最后一条评论 |

**示例:**
```bash
j2c delete-comment XOS-731 13026           # 删除指定评论
j2c delete-comment XOS-731 --last          # 删除最后一条评论
```

---

## 状态/分配类命令

### j2c status - 查看/更改 Issue 状态

```bash
j2c status <issueId> [targetStatus] [options]
```

| 选项 | 说明 |
|------|------|
| `-d, --dry-run` | 预览模式，不实际更新 |

**示例:**
```bash
j2c status XOS-731                    # 查看可用状态转换
j2c status XOS-731 Done             # 更改状态
j2c status XOS-731 --dry-run         # 预览状态更改
```

---

### j2c assign - 分配 Issue

```bash
j2c assign <issueId> <username>
```

**示例:**
```bash
j2c assign XOS-731 jun.luo
```

---

## 批量操作命令

### j2c batch-create - CSV 批量创建

```bash
j2c batch-create --csv <path> [options]
```

| 选项 | 说明 |
|------|------|
| `--csv <path>` | CSV 文件路径；至少需要 `summary` 列 |
| `-p, --project <key>` | 默认项目；CSV 的 `project` 列可覆盖 |
| `-t, --type <name>` | 默认类型；CSV 的 `type` 列可覆盖，默认 `R&D` |
| `--dry-run` | 校验 CSV 和 Jira 创建元数据，不创建 Issue |
| `--concurrency <count>` | 创建并发数，范围 1-10，默认 3 |
| `--format <text\|json>` | 创建结果格式，默认 text |
| `--result-file <path>` | 每个创建批次后写入 JSON 结果，用于恢复部分成功 |

除 `project`、`type`、`summary`、`description`、`priority`、`assignee` 外，CSV 列名必须是目标项目类型可创建的 Jira field ID。写入前会校验全部行；运行中出现部分失败时，使用 `--result-file` 中的已创建 key 处理失败行，不要直接重跑整个 CSV。

**示例:**
```bash
# 只校验，不创建
j2c batch-create --csv issues.csv -p XOS --dry-run

# 实际创建，并输出机器可读结果和恢复文件
j2c batch-create --csv issues.csv -p XOS -t 'R&D' \
  --format json --result-file .local/batch-create-result.json
```

---

### j2c batch-transition - 批量更改状态

```bash
j2c batch-transition [issueIds...] [options]
```

| 选项 | 说明 |
|------|------|
| `--jql <jql>` | 使用 JQL 查询获取 Issue 列表 |
| `-s, --status <status>` | 目标状态 |
| `--dry-run` | 预览模式 |
| `-c, --concurrency <num>` | 并发数 (默认: 5) |

**示例:**
```bash
j2c batch-transition XOS-730 XOS-731 -s Done
j2c batch-transition --jql "project = XOS AND status = Open" -s Done
j2c batch-transition --jql "project = XOS" -s Done --dry-run
```

---

### j2c batch-comment - 批量添加评论

```bash
j2c batch-comment [issueIds...] [options]
```

| 选项 | 说明 |
|------|------|
| `--jql <jql>` | 使用 JQL 查询获取 Issue 列表 |
| `-m, --message <text>` | 评论内容（自动检测格式：纯文本/Markdown） |
| `--markdown` | 强制指定内容为 Markdown 格式 |
| `--dry-run` | 预览模式 |

**示例:**
```bash
j2c batch-comment --jql "project = XOS AND status = Done" -m "已处理"  # 自动检测
j2c batch-comment XOS-730 XOS-731 -m "## 分析结果\n\n**粗体**"          # Markdown 格式
```

---

### j2c export - 批量导出

```bash
j2c export [options]
```

| 选项 | 说明 |
|------|------|
| `--jql <jql>` | JQL 查询语句 |
| `-f, --format <csv\|json\|md>` | 输出格式 (默认: csv) |
| `-o, --output <file>` | 输出到文件 |
| `-m, --max <num>` | 最大结果数 (默认: 0，即全量自动分页) |
| `--all-fields` | 获取所有字段（含不可导航字段），默认只取 navigable 字段 |

**CSV 全量字段:** 默认导出包含所有 navigable 字段，包括：
- 标准字段: Key, Type, Summary, Status, Priority, Assignee, Reporter, Created, Updated, Resolution, Labels, Description
- 自定义字段: 自动从 issue 数据中动态发现，列头格式为 `显示名 (customfield_xxxxx)`（如 `SW Version (customfield_10115)`），无需硬编码

**示例:**
```bash
# 全量导出 XOS 项目（自动分页，CSV 含全部 navigable 字段）
j2c export --jql "project = XOS" -o xos_all.csv

# 导出为 JSON
j2c export --jql "project = XOS" -f json -o xos.json

# 限制数量
j2c export --jql "project = XOS" -m 100 -o xos_100.csv

# 包含不可导航字段（完整字段导出）
j2c export --jql "project = XOS" --all-fields -o xos_full.csv

# Markdown 格式导出
j2c export --jql "project = XOS" -f md -o xos.md
```

---

## 附件命令

### j2c upload - 上传附件

```bash
j2c upload <issueId> <filePath>
```

**示例:**
```bash
j2c upload XOS-731 ./screenshot.png
```

### j2c download - 下载附件

```bash
j2c download <issueId> [options]
```

| 选项 | 说明 |
|------|------|
| `-d, --dir <directory>` | 下载目录 (默认: ./downloads) |
| `-n, --filename <name>` | 只下载匹配此文件名的附件 |

**示例:**
```bash
j2c download XOS-731
j2c download XOS-731 -d /tmp/attachments
j2c download XOS-731 -n screenshot
```

---

## 常用组合

```bash
# 快速统计数量（不下载详情）
j2c list -p PNX -a gang.cheng -t SOC --count
# 输出: 368

# 查我的任务（AI 场景）
j2c list -a me -m 20 -e md

# JQL 搜索
j2c list -j "project = PNX AND assignee = gang.cheng AND issuetype = SOC" -m 5

# 聚合统计：谁未关闭 issue 最多
j2c list -j "statusCategory != Done" --stats assignee --top 3

# 聚合统计：按项目+经办人分组
j2c list -j "statusCategory != Done" --stats project,assignee --top 10

# 全量列表（自动分页）
j2c list -j "project != XOS AND status = Open" -e csv -m 0

# 读取 Issue
j2c read XOS-731

# 列出所有项目
j2c projects

# 查看某项目 issue 统计
j2c projects XOS

# 全量导出项目为 CSV（自动分页，含全部 navigable 字段）
j2c export --jql "project = XOS" -o xos_all.csv

# 导出 Open 状态 issue 为 JSON
j2c export --jql "project = XOS AND status = Open" -f json -o xos_open.json

# 读取评论到文件，编辑后写回（完整 WikiMarkup 支持）
j2c list-comments XOS-731 --last -o comment.txt
vim comment.txt
j2c edit-comment XOS-731 --last --file comment.txt

# 添加分析评论
j2c comment XOS-731 -m "## 分析结果\n\n1. 问题确认\n2. 原因分析" --markdown

# 批量处理
j2c batch-transition --jql "project = XOS AND status = Open" -s Done

# 批量评论
j2c batch-comment --jql "project = XOS AND status = Done" -m "统一处理" --markdown
```

---

## 选项说明

| 选项 | 说明 |
|------|------|
| `--dry-run` | 预览模式，显示将执行的操作但不实际执行 |
| `--last` | 操作最后一条（评论相关命令） |
| `-o, --output <file>` | 输出到文件 |
| `-f, --file <path>` | 从文件读取内容 |
| `-e, --export <format>` | 输出格式 (md/csv/table) |
| `-m, --max <num>` | 最大结果数 (0=全量自动分页) |
| `-c, --count` | 只显示数量 |
| `-j, --jql <query>` | 直接使用 JQL 查询 |
| `--stats <fields>` | 按字段聚合统计，逗号分隔 |
| `--top <num>` | stats 模式只显示前 N 名 (默认: 10) |
| `--render` | 渲染 WikiMarkup 表格为终端表格 |
