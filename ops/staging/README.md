# CI and staging

GitHub Actions runs the backend, PostgreSQL, frontend and Chromium tests on branch pushes and PRs. The browser checks the built app through its real API and a temporary database. When a regression fails, fix the app. If the expected behavior has changed, link the decision and have the other code owner review the test change.

On `batuhan-oracle1`, `gtu-stage-sync.timer` checks `main` as the `gtu-its-stage` user. It builds the exact commit whose push run passed. Deployment applies migrations and checks the gateway and database-backed API. If the application fails its startup checks, the script restarts the previous application images. Staging database migrations must remain compatible with that version. The university deployment is a separate release step.

Connect through the server's SSH session:

```sh
ssh -N -L 18126:127.0.0.1:18126 batuhan-oracle1
```

Open `http://127.0.0.1:18126`. The demo member is `winter.member@example.test` and the term is `Demo Winter Break 2026–2027`. Ask Batuhan for a staging session and the demo password. Use synthetic records. The demo dates are sample values.

## Server setup

Use an isolated rootless Docker account with its own home, systemd user session and resource limits. Clone `main` to `$HOME/source` without checking it out. Create `$HOME/staging.env` with mode `0600` and independent, randomly generated hexadecimal `POSTGRES_PASSWORD` and `JWT_SECRET` values. Install `sync.sh` as `$HOME/bin/gtu-stage-sync` and both units under `$HOME/.config/systemd/user/`. Run `systemctl --user daemon-reload` and `systemctl --user enable --now gtu-stage-sync.timer`. Check the deployment log with `journalctl --user -u gtu-stage-sync.service`. Reinstall the script and units when they change.

After the first deploy, give the account a separate random password via `DEMO_MEMBER_PASSWORD` and run this as the staging user from its home:

```sh
REVISION=$(basename "$(readlink current)") docker compose -p gtu-its-staging \
  --env-file staging.env -f current/ops/staging/compose.yml \
  exec -T -e DEMO_MEMBER_PASSWORD api node --input-type=module < current/ops/staging/seed-demo.mjs
```
