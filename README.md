# Jira2Claw CLI

Jira 命令行工具，支持 Cloudflare Access 认证。

## 安装

### 安装最新版本（推荐）

```bash
npm install -g https://github.com/fightmonster/j2c/releases/latest/download/jira2claw-cli.tgz
```

### 安装指定版本

```bash
# 下载指定版本的 tgz 后本地安装
# npm install -g ./jira2claw-cli-<version>.tgz
```

## 使用

安装后全局可用 `jira2claw` 和 `j2c` 命令。

```bash
# 查看帮助
j2c --help

# 配置认证
j2c setup --pat <token> --cf-client-id <id> --cf-client-secret <secret>

# 查看状态
j2c

# 查看当前用户
j2c me

# 搜索 issues
j2c list -j "project = XOS"

# 查看 issue 详情
j2c view XOS-730

# 分配 issue
j2c assign XOS-730 username

# 更改状态
j2c status XOS-730 "In Progress"

# 添加评论
j2c comment XOS-730 -m "这是一个评论"
```

## 版本历史

查看 [Releases](https://github.com/fightmonster/j2c/releases) 了解版本更新历史。

## 当前版本

**v1.2.2** - 修复 assign 命令在 Jira Server 版本的兼容性问题

## 源码

源码仓库：https://github.com/fightmonster/j2c-src

## 文档

完整文档请查看 [Releases](https://github.com/fightmonster/j2c/releases) 中的对应版本。
