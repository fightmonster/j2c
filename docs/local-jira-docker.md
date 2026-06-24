# Local Jira Docker Environment

This environment is for local CLI testing only. It exposes Jira only on
`http://127.0.0.1:8080` and must not use production Jira, Keycloak, or PAT
credentials. CLI integration uses Jira's native Personal Access Token (PAT)
authentication only; Keycloak is intentionally not part of this local stack.

It uses Jira Software Data Center `9.12.10`, matching the production Jira
version and build line (`9.12.10#9120010`). The first browser setup requires a
Data Center evaluation license from Atlassian.

## Prerequisites

- Docker Desktop is running.
- Docker Desktop has at least 6 GB memory available.
- At least 10 GB free disk space is available for the initial image and data.

## Start

Create the ignored local environment file from the tracked template, then set a
unique local database password:

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker -f docker-compose.local.yml config
docker compose --env-file .env.docker -f docker-compose.local.yml up -d
docker compose --env-file .env.docker -f docker-compose.local.yml logs -f jira
```

The first Jira boot can take several minutes. When the log reports that Jira is
ready, open `http://127.0.0.1:8080` and complete the setup wizard:

1. Select the external PostgreSQL database and enter the values from
   `.env.docker`: host `postgres`, port `5432`, and the configured database,
   username, and password.
2. Enter the Data Center evaluation license.
3. Create a local administrator account.
4. Create a dedicated test project, for example `CLI`.
5. In the local administrator profile, create a local Jira Personal Access
   Token for the CLI test account.

If Docker Hub reports a pull-rate-limit error, authenticate Docker Desktop (or
run `docker login`) and rerun the `up -d` command. No local data is created
until the images are pulled successfully.

Verify the exact product version after setup:

```bash
curl -u '<local-admin>:<password>' http://127.0.0.1:8080/rest/api/2/serverInfo
```

The response must show `"version":"9.12.10"` and `"buildNumber":9120010`.

## Lifecycle

```bash
# Stop while retaining all local Jira data.
docker compose --env-file .env.docker -f docker-compose.local.yml down

# Stop and permanently remove the local Jira database and attachments.
docker compose --env-file .env.docker -f docker-compose.local.yml down -v
```

The final command is destructive, but affects only the named Docker volumes in
this Compose project.

## CLI Isolation (next step)

The CLI changes will introduce `J2C_ENV=docker`. In that mode it will only
allow loopback Jira endpoints, require a PAT passed through `JIRA_PAT`, and
skip Keycloak and all production configuration and credentials.

After building the CLI, run it against the local Jira with a PAT created in
this Jira instance:

```bash
J2C_ENV=docker \
JIRA_PAT='<local-jira-pat>' \
node dist/cli/index.js create -p CLI -t Task -s 'Local create test'
```

Docker mode permits only `http://127.0.0.1:8080`, `http://localhost:8080`, or
`http://[::1]:8080`. `JIRA_HOST` cannot point to the production server in this
mode, and a missing `JIRA_PAT` fails before any request is made.

## Local Create Validation

Use the local non-admin PAT to discover the fields that user can create:

```bash
J2C_ENV=docker JIRA_PAT='<local-jira-pat>' node dist/cli/index.js create-meta -p XOS
J2C_ENV=docker JIRA_PAT='<local-jira-pat>' node dist/cli/index.js create-meta -p XOS -t 'R&D'
```

`create` defaults to `R&D` when `--type` is not supplied. `batch-create` validates every CSV row before it creates anything; `--dry-run` performs the same metadata and CSV validation without writing to Jira.
