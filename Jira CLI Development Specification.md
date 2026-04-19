# Jira CLI Development Specification

## 1. Project Overview

A Node.js CLI tool for interacting with an internal Jira Server system, accessible behind Cloudflare Access protection. Supports issue querying, status transitions, commenting, file attachments, and automatic CF cookie management.

## 2. Environment & System Constraints

* **Target Environment:** macOS, Node.js v18+
* **Jira Instance:** Jira Server / Data Center (Version 9.12.10)
* **API Version:** Jira REST API v2 (NOT v3)
* **Base URL:** `https://www.rxpim.com`
* **Authentication:** PAT (Personal Access Token) via `Authorization: Bearer` header
* **Cloudflare Access:** Site protected by Cloudflare Access, requires `CF-Access-Client-Id` / `CF-Access-Client-Secret` headers alongside PAT
* **SSL:** Internal server, SSL verification bypassed (`NODE_TLS_REJECT_UNAUTHORIZED=0`)

## 3. Tech Stack

| Package | Purpose |
|---------|---------|
| `commander` | CLI argument parsing |
| `chalk` | Terminal color output |
| `cli-table3` | Formatted table display |
| `form-data` | Multipart file uploads |
| `ws` | WebSocket client for Chrome DevTools Protocol |

> Note: Uses raw `node:https` for API requests instead of `jira.js` SDK, to have full control over CF cookie handling and retry logic.

## 4. Project Structure

```
jira-cli/
├── src/
│   ├── cli/
│   │   ├── index.ts         # CLI entry point, command definitions
│   │   └── commands/        # Command implementations
│   ├── client/
│   │   ├── jira-client.ts   # API client with PAT auth + CF Service Token headers
│   │   ├── cf-middleware.ts # CF Access middleware (direct header auth)
│   │   └── config.ts        # Unified config management (~/.jira2claw/config.json)
│   ├── converter/           # Markdown/ADF converters
│   ├── formatter/           # Output formatting (table, markdown, CSV, detail view)
│   └── types/               # TypeScript type definitions
├── doc/                     # Reference documentation
├── docs/                    # CLI user guide
└── package.json
```

## 5. Authentication

### 5.1 PAT Token

Read from (in order):
1. `JIRA_PAT` environment variable
2. `~/.jira2claw/config.json` config file

### 5.2 Cloudflare Access

The Jira site is behind Cloudflare Access. PAT alone gets blocked by 302 redirect. Every request must include `CF-Access-Client-Id` and `CF-Access-Client-Secret` headers.

**Configuration:**
```bash
j2c setup --cf-client-id <id> --cf-client-secret <secret>
```

**Credential sources** (priority order):
1. `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` environment variables
2. `~/.jira2claw/config.json` config file

**How it works:**
- CF Service Token credentials are sent directly as HTTP headers on every request
- No cookie exchange needed — simpler and more reliable than the old CF Cookie approach
- Headers: `CF-Access-Client-Id: <id>` + `CF-Access-Client-Secret: <secret>`

## 6. CLI Commands

### 6.1 `jira list [options]`

Search and list issues using JQL.

| Option | Description |
|--------|-------------|
| `-p, --project <name>` | Filter by project key |
| `-i, --id <issueId>` | Filter by specific issue ID |
| `-a, --assignee <email>` | Filter by assignee (`me` or `currentUser()` as shorthand) |
| `-s, --status <status>` | Filter by status |
| `-k, --keyword <text>` | Fuzzy match using JQL `~` operator |
| `-e, --export <format>` | Export as `md` (Markdown) or `csv` |

Default (no options): `assignee = currentUser() ORDER BY updated DESC`

```bash
jira list                              # My issues, sorted by updated
jira list -p XOS -s Open               # XOS project, Open issues
jira list -a me -e csv                 # My issues, export CSV
jira list -k "Google" --export md      # Search keyword, export Markdown
```

### 6.2 `jira view <issueId>`

Display full issue details: summary, status, type, priority, assignee, reporter, dates, description, comments, and attachments.

```bash
jira view XOS-729
```

### 6.3 `jira status <issueId> [targetStatus]`

View or change issue status. Without a target, shows available transitions. With a target, displays available transitions then executes the matching one.

```bash
jira status XOS-729                    # Show available transitions
jira status XOS-729 "In Progress"      # Change to In Progress
jira status XOS-729 "Resolved"         # Change to Resolved
```

### 6.4 `jira assign <issueId> <username>`

Assign issue to a user.

```bash
jira assign XOS-729 jun.luo@brkg.com
```

### 6.5 `jira comment <issueId> -m "<text>" [--attach <file>]`

Add a comment. Supports file attachment with automatic Wiki Markup linking.

| Option | Description |
|--------|-------------|
| `-m, --message <text>` | Comment text (required) |
| `--attach <filePath>` | Attach a file (image or document) |

Images are embedded as `!filename!`, other files as `[^filename]` (Jira Wiki Markup).

```bash
jira comment XOS-729 -m "Fixed in build 123"
jira comment XOS-729 -m "See screenshot" --attach ./screenshot.png
```

### 6.6 `jira download <issueId>`

Download attachments from an issue.

| Option | Description |
|--------|-------------|
| `-d, --dir <directory>` | Download directory (default: `./downloads`) |
| `-n, --filename <name>` | Download only the matching file |

```bash
jira download XOS-729                    # All attachments
jira download XOS-729 -n crash.log       # Specific file
jira download XOS-729 -d /tmp/files      # Custom directory
```

### 6.7 `jira setup`

Configure authentication credentials.

| Option | Description |
|--------|-------------|
| `--pat <token>` | Jira Personal Access Token |
| `--cf-client-id <id>` | CF Access Client ID |
| `--cf-client-secret <secret>` | CF Access Client Secret |

```bash
j2c setup                                           # Interactive mode
j2c setup --pat <token> --cf-client-id <id> --cf-client-secret <secret>  # Non-interactive
```

### 6.8 `jira me`

Show current logged-in user info. Useful for verifying token and connectivity.

```bash
jira me
```

## 7. Architecture

### Request Flow

```
CLI Command (src/cli/index.ts)
  → API function (src/client/jira-client.ts)
    → HTTP request with PAT Bearer + CF-Access-Client-Id/Secret headers
    → If CF blocked (302): CF Service Token invalid
    → If 401/403: PAT invalid
```

### Key Design Decisions

- **CF Service Token headers:** CF credentials sent directly as HTTP headers on every request (no cookie exchange)
- **jira.js SDK:** Uses `jira.js` for standard API calls, raw `node:https` for file uploads and custom operations
- **Wiki Markup:** Jira Server v2 uses Wiki Markup (not Markdown) for comments and descriptions

## 8. Testing

```bash
node test/mock-test.js
```

Tests cover:
- `formatTable`, `formatMarkdown`, `formatCSV`, `formatIssueDetail` output
- Unassigned issue handling
- JQL builder logic (all options, defaults, `currentUser()` shorthand)
