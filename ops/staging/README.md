# CI and staging

GitHub Actions runs the backend, PostgreSQL, frontend and Chromium tests on branch pushes and PRs. The browser checks the built app through its real API and a temporary database. When a regression fails, fix the app. If the expected behavior has changed, link the decision and have the other code owner review the test change.

On `batuhan-oracle1`, `gtu-stage-sync.timer` checks `main` as the `gtu-its-stage` user. It builds the exact commit whose push run passed. Deployment applies migrations and checks the gateway and database-backed API. If the application fails its startup checks, the script restarts the previous application images. Staging database migrations must remain compatible with that version. The university deployment is a separate release step.

Connect through the server's SSH session:

```sh
ssh -N -L 18126:127.0.0.1:18126 batuhan-oracle1
```

Open `http://127.0.0.1:18126` and select `2026–2027 Dönem Arası (Staging)` for the winter demo. The dates are sample values. Use synthetic records.

| Role | Demo email |
| --- | --- |
| General Admin | `admin1@gtu.edu.tr` |
| Commission Chair | `ceng_chair@gtu.edu.tr` |
| Commission Member | `ceng_member1@gtu.edu.tr` |

The 11 staff accounts use the local demo names and emails. Their individual passwords start with `staging-`. Ask Batuhan for staging access and the password for your account.

## Server setup

Use an isolated rootless Docker account with its own home, systemd user session and resource limits. Clone `main` to `$HOME/source` without checking it out. Create `$HOME/staging.env` with mode `0600` and independent, randomly generated hexadecimal `POSTGRES_PASSWORD` and `JWT_SECRET` values. Install `sync.sh` as `$HOME/bin/gtu-stage-sync` and both units under `$HOME/.config/systemd/user/`. Run `systemctl --user daemon-reload` and `systemctl --user enable --now gtu-stage-sync.timer`. Check the deployment log with `journalctl --user -u gtu-stage-sync.service`. Reinstall the script and units when they change.

After the first deploy, run this as the staging user from its home. Keep the generated password file for repeat runs.

```sh
umask 077
export REVISION=$(basename "$(readlink current)")
compose() { docker compose -p gtu-its-staging --env-file staging.env -f current/ops/staging/compose.yml "$@"; }
if [ ! -f demo-accounts.json ]; then
  compose exec -T api node --input-type=module - --generate-passwords < current/ops/staging/seed-demo.mjs > demo-accounts.json.tmp &&
    mv demo-accounts.json.tmp demo-accounts.json
fi
STAGING_DEMO_PASSWORDS=$(cat demo-accounts.json) compose exec -T -e STAGING_DEMO_PASSWORDS api \
  node --input-type=module < current/ops/staging/seed-demo.mjs
```
