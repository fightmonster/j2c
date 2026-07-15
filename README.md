# Jira CLI

Jira command-line tool for agent/Hermes workflows and manual use.

Release package: https://github.com/fightmonster/j2c

Source code: https://github.com/fightmonster/j2c-src

## Install

Install the latest release:

```bash
npm install -g https://github.com/fightmonster/j2c/releases/latest/download/jira2claw-cli.tgz
```

The package provides both commands:

```bash
j2c
jira2claw
```

## Setup

Configure Jira and Keycloak credentials before first use:

```bash
j2c setup
```

Non-interactive setup:

```bash
j2c setup --pat <jira_pat> --kc-username <username> --kc-password <password> --oauth-secret <secret>
```

Check connection status and show the installed documentation path:

```bash
j2c
```

## Update

```bash
j2c update
j2c update --check
```

`j2c update` installs from the GitHub Release asset `jira2claw-cli.tgz`.

## Documentation

Quick help:

```bash
j2c --help
j2c <command> --help
```

Full documentation is packaged at:

```text
docs/jira2claw-cli.md
```

After installation, run `j2c` to print the absolute path to the installed documentation file.

## Examples

```bash
j2c me
j2c list --assignee me --status "开放"
j2c read XOS-123
j2c comment XOS-123 --message "分析完成"
j2c ftp XOS-123 --format json
```

Hermes/agent should prefer canonical English commands and options. Chinese command aliases are supported for manual operation.
