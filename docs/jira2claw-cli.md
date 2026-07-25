# jira2claw CLI 参考

版本：1.6.6

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

### 中文别名与 Agent 生成约定

CLI 支持中文命令和常用中文参数别名，方便人工在中文 Jira 环境下直接操作。英文命令保持兼容，中文别名会映射到同一个英文实现。

Hermes/openclaw skill 生成命令时应始终使用英文规范命令和参数，不应生成中文子命令或中文参数名。Jira 状态、标题、描述、评论等业务值按用户输入或 Jira 页面语言保留中文。`--type` 只表示 Jira Issue Type；用户泛称“bug/问题/单/issue”时不要自动加 `--type Bug`，除非用户明确要求类型为 Bug 或项目元数据确认存在该类型。

Agent 推荐生成：

```bash
j2c comment XOS-731 --message "这是一个评论"
j2c list --project XOS --status "处理中"
j2c list --assignee me --status "开放"
j2c status XOS-731 "完成"
```

人工也可以使用：

```bash
j2c 评论 XOS-731 --内容 "这是一个评论"
j2c 列表 --项目 XOS --状态 "处理中"
j2c 改状态 XOS-731 "完成"
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

`update` 查询 `fightmonster/j2c` 的 GitHub 最新 Release。发现高于当前版本的 `jira2claw-cli.tgz` 资产时，会优先复用当前 `j2c` 的安装方式；无法判断上次安装方式时，按首次安装策略优先尝试 `npm`，再尝试 `pnpm`、`yarn`。也可以用 `J2C_UPDATE_PACKAGE_MANAGER=pnpm` 强制指定。`--check` 只显示是否有更新。GitHub 不可达、没有新版本或资产未就绪时，不会修改当前 CLI，也不需要 Jira 认证。

## 命令分类

| 分类 | 命令 |
|------|------|
| 工具 | `update` |
| 读取 | `read`, `view`, `list`, `fields`, `list-comments`, `activity`, `changelog`, `worklog`, `links`, `attachments`, `dashboard`, `ftp`, `me`, `projects` |
| 更新 | `update-summary`, `update-description`, `fields-update` |
| 评论 | `comment`, `edit-comment`, `delete-comment` |
| 状态/分配 | `status`, `transitions`, `assign` |
| 关注/投票 | `watch`, `vote` |
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
| `-t, --type <type>` | Jira Issue Type；仅在明确指定类型时使用，不要把泛称 bug/问题/单自动映射为 Bug |
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

### j2c dashboard - 仪表盘

```bash
j2c dashboard [options]
```

| 选项 | 说明 |
|------|------|
| `--id <dashboardId>` | 读取指定 dashboard |
| `--filter <favourite\|my>` | 过滤 dashboard |
| `--start-at <number>` | 分页起点 (默认: 0) |
| `--max-results <number>` | 每页数量 (默认: 50) |
| `--item <itemId>` | dashboard item id，用于 item property API |
| `--property <key>` | dashboard item property key |
| `--value <jsonOrText>` | 设置 item property 值，JSON 会自动解析 |
| `--value-file <path>` | 从文件读取 item property 值，JSON 会自动解析 |
| `--delete-property` | 删除 item property |
| `-f, --format <text\|json>` | 输出格式 (默认: text) |

**示例:**
```bash
j2c dashboard --format json
j2c dashboard --filter my --max-results 20
j2c dashboard --id 10000
j2c dashboard --id 10000 --item 20000 --format json
j2c dashboard --id 10000 --item 20000 --property my.key
j2c dashboard --id 10000 --item 20000 --property my.key --value '{"enabled":true}'
j2c dashboard --id 10000 --item 20000 --property my.key --delete-property
```

Jira Server/Data Center 9.12.10 官方 REST 文档只公开 dashboard 列表、dashboard 详情，以及 dashboard item property 的读取/设置/删除。创建/删除整个仪表盘、添加/删除 gadget 不在该版本公开 REST 文档中，CLI 不提供这些命令，agent 不应生成相关操作。

---

### j2c ftp - FTP 日志探测/下载

```bash
j2c ftp [ftpUrl|issueKey] [options]
```

| 选项 | 说明 |
|------|------|
| `--status` | 读取下载目录中的状态文件，不连接 FTP 服务器 |
| `--download [pattern]` | 下载文件；目录 URL 可用通配符，如 `*.log` |
| `-d, --dir <directory>` | 下载目录 (默认: `./downloads/ftp`) |
| `--max-size <size>` | 大文件阈值，超过默认跳过下载 (默认: `100MB`) |
| `--force` | 即使超过 `--max-size` 也用 j2c 下载 |
| `--password-env <name>` | 从环境变量读取 FTP 密码，避免命令行明文 |
| `--secure` | 使用 FTPS；未指定时可从 `~/.jira2claw/ftp.json` 读取 |
| `--insecure` | 接受自签名或不受信任的 FTPS 证书 |
| `--no-resume` | 禁用断点续传；默认保留 `.part` 文件并从已下载位置继续 |
| `--retries <count>` | 已获取部分数据后传输中断时的自动重连次数 (默认: `2`)；首次连接失败不重试 |
| `--progress` | 在 stderr 显示实时下载进度 |
| `-f, --format <text\|json>` | 输出格式 (默认: text) |

**示例:**
```bash
j2c ftp ftp://loguser@ftp.example.com/logs/ISSUE-123 --format json
j2c ftp ftp://loguser@ftp.example.com/logs/ISSUE-123 --download "*.log" -d ./logs
j2c ftp ftp://loguser@ftp.example.com/logs/ISSUE-123/crash.log --download -d ./logs
J2C_FTP_PASSWORD=secret j2c ftp ftp://loguser@ftp.example.com/logs/ISSUE-123 --password-env J2C_FTP_PASSWORD
j2c ftp ftp://ftp.example.com/logs/ISSUE-123/bugreport.zip --download --force --progress
j2c ftp --status -d ./logs --format json
j2c ftp XOS-791 --format json
```

目标可以是 `ftp://` 或 `ftps://` URL，也可以是 Jira issue key。传 issue key 时，CLI 会读取 issue 描述和评论，提取所有 FTP 链接，去重后逐个独立处理。JSON 输出中每个链接都会保留来源字段：

- `sourceType: "description"` 表示链接来自 issue 描述。
- `sourceType: "comment"` 表示链接来自评论，同时返回 `commentId`。
- `source` 保留兼容字符串，例如 `XOS-791:description` 或 `XOS-791:comment:10201`。

下载结果会嵌套在对应 link 的 `downloads` 数组里，因此多 FTP 链接时可以明确判断每个下载文件来自描述还是哪条评论。

默认只探测和列目录/文件大小，不下载。下载超过阈值的大文件时，CLI 默认跳过；确实要用 Node.js 下载时加 `--force`。下载始终单线程，同一目标文件会加本地进程锁，避免多个 agent 同时写入。文件先写入 `<文件名>.part`，网络断开会自动重新连接并从现有文件大小继续，远端大小一致后才改名为最终文件。首次连接失败不会自动重试；只有已经取得部分数据的传输中断才会按 3 秒、6 秒的递增间隔重连，避免触发服务端安全机制。失败时 `.part` 会保留，重新执行相同命令也会继续下载。

下载进度与结果会以原子写入的方式保存到下载目录 `.j2c-ftp-status.json`。运行中的 agent 使用 `--progress` 查看实时进度；另一个 agent 或进程可随时执行 `j2c ftp --status -d <下载目录> --format json` 查询，不会连接 FTP 服务器。状态包含 `downloading`、`completed`、`partial` 或 `skipped`，以及已下载字节数、总大小、重试次数、路径和最后错误。

FTP 用户名、密码和默认 FTPS 设置可保存于 `~/.jira2claw/ftp.json`（建议权限为 `0600`，不要提交到版本库）：

```json
{
  "default": {
    "username": "loguser",
    "password": "replace-with-secret"
  },
  "servers": {
    "ftp.example.com": {
      "username": "loguser",
      "password": "replace-with-secret",
      "protocol": "ftps",
      "insecure": true
    }
  }
}
```

匹配优先级为 URL 中的用户名/密码、`--password-env`、服务器专属配置、默认配置。`protocol` 可为 `ftp` 或 `ftps`（也兼容旧的 `secure: true`）；`sftp` 会明确报不支持，避免误用 FTP 客户端。仅在内网自签名证书场景使用 `insecure: true` 或 `--insecure`。命令不会输出密码；传输进度写入 stderr，`--format json` 的 stdout 只输出最终结构化状态，包含 `status`、`downloaded`、`attempts` 和未完成时的 `partialPath`。

Hermes/agent 推荐先生成只读探测命令：

```bash
j2c ftp XOS-791 --format json
```

只有用户明确要求下载时才使用 `--download`。如果 issue 中有多条 FTP 链接且用户没有明确说“全部下载”，Hermes/agent 应先执行只读探测并向用户汇报每条链接的来源、文件列表和大小；用户确认后再按指定链接或通配符下载。不要把 FTP 密码写进命令行历史，优先使用 `--password-env` 或交互式输入。

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
| `-m, --message <text>` | 评论内容（自动检测格式：纯文本/Markdown/WikiMarkup/ADF JSON） |
| `--markdown` | 强制指定内容为 Markdown 格式 |
| `--wiki` | 强制指定内容为 Jira WikiMarkup 格式，原样发送 |
| `--adf <json>` | ADF JSON 格式 (Atlassian Document Format) |
| `--attach <filePath>` | 附加文件到评论（自动处理中文文件名） |
| `--footer` | 可选：agent 自行决定是否在评论末尾追加小尾巴（agent 名字）；默认不加 |
| `--agent <name>` | 可选：小尾巴中显示的 agent 名字；也可用 `J2C_AGENT_NAME` |

**自动格式检测：**
- **ADF JSON**：以 `{` 开头且包含 `"type": "doc"`
- **WikiMarkup**：包含 `h1.`、`{panel}`、`{code}`、`{color}`、`||表头||`、`[^附件]`、`!image|thumbnail!` 等 Jira WikiMarkup 标记时原样发送
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
j2c comment XOS-731 -m "{panel:title=分析}\n内容\n{panel}" --wiki  # 原样发送 WikiMarkup
j2c comment XOS-731 -m "分析完成" --footer --agent Hermes # 追加 agent 小尾巴
j2c comment XOS-731 -m "| 列1 | 列2 |\n|---|---|\n| a | b |"  # 表格自动转换
j2c comment XOS-731 --adf '{"type":"doc",...}'         # ADF JSON 格式
```

`--footer` 是给 Hermes/agent 使用的可选标记，不是必选参数。默认不加小尾巴；agent 可以根据自己的 skill 策略决定是否追加。`--footer` 会在创建评论时一次性追加小尾巴，不会为了写 comment id 再编辑第二次。Jira comment id 仍会在 CLI 输出中返回，删除某条评论不会改变其他评论 id。

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
| `--wiki` | 强制按 Jira WikiMarkup 处理，原样发送 |
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

## 活动/日志/关联命令

### j2c activity - 读取活动区

```bash
j2c activity <issueId> [--type all|comments|worklog|changelog|activity] [--format text|json]
```

`all` 会聚合 comments、worklog、changelog 并按时间排序。`activity` 当前作为聚合活动视图处理；Hermes/agent 推荐使用 `--format json`。

### j2c worklog - 工作日志

```bash
j2c worklog <issueId> --format json
j2c worklog <issueId> --add --time-spent "1h 30m" --comment "处理问题"
j2c worklog <issueId> --edit <worklogId> --time-spent "2h" --comment "修正耗时"
j2c worklog <issueId> --delete <worklogId>
```

### j2c changelog - 改动记录

```bash
j2c changelog <issueId> --format json
```

### j2c links - Issue links

```bash
j2c links <issueId> --format json
j2c links <issueId> --add <targetIssueId> --type "Relates"
j2c links <issueId> --delete <linkId>
```

### j2c watch / vote - 关注和投票

```bash
j2c watch <issueId> --format json
j2c watch <issueId> --add
j2c watch <issueId> --delete
j2c vote <issueId> --format json
j2c vote <issueId> --add
j2c vote <issueId> --delete
```

### j2c attachments - 附件列表/删除

```bash
j2c attachments <issueId> --format json
j2c attachments <issueId> --delete <attachmentId>
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
| `-m, --message <text>` | 评论内容（自动检测格式：纯文本/Markdown/WikiMarkup） |
| `--markdown` | 强制指定内容为 Markdown 格式 |
| `--wiki` | 强制指定内容为 Jira WikiMarkup 格式，原样发送 |
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
