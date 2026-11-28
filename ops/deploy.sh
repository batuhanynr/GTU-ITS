#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run as root.' >&2; exit 1; }
release=${1:?Usage: gtu-its-deploy COMMIT_SHA}
[[ $release =~ ^[a-f0-9]{40}$ ]] || { echo 'Use a full commit SHA.' >&2; exit 1; }
root=/srv/gtu-its
image="gtu-its-api:$release"
[[ -f "$root/releases/$release/frontend/index.html" ]] || { echo 'Frontend artifact is missing.' >&2; exit 1; }
[[ -f /etc/gtu-its/backend.env ]] || { echo 'Production environment is missing.' >&2; exit 1; }
docker image inspect "$image" >/dev/null
exec 9>/run/lock/gtu-its-deploy.lock
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
previous=$(readlink -f "$root/current" || true)
previous_image=$(sed -n 's/^APP_IMAGE=//p' /etc/gtu-its/release.env 2>/dev/null || true)
rollback() {
    trap - ERR
    echo 'Deployment failed; keeping the database and restoring the previous application.' >&2
    systemctl stop gtu-its-api.service || true
    if [[ -n "$previous_image" ]]; then
        printf 'APP_IMAGE=%s\n' "$previous_image" > /etc/gtu-its/release.env
        if [[ -n "$previous" ]]; then
            ln -sfn "$previous" "$root/.current-rollback"
            mv -Tf "$root/.current-rollback" "$root/current"
        fi
        systemctl start gtu-its-api.service || true
    fi
    exit 1
}
trap rollback ERR
systemctl stop gtu-its-api.service
# Pause writes before the backup and migration; production data is never reseeded.
/usr/local/sbin/gtu-its-backup
docker run --rm --network host --env-file /etc/gtu-its/migrate.env "$image" ./node_modules/.bin/prisma migrate deploy
umask 077
printf 'APP_IMAGE=%s\n' "$image" > /etc/gtu-its/release.env
ln -sfn "$root/releases/$release" "$root/.current-next"
mv -Tf "$root/.current-next" "$root/current"
systemctl start gtu-its-api.service
healthy=false
for attempt in {1..30}; do
    if curl --fail --silent --max-time 3 http://127.0.0.1:3001/api/health >/dev/null; then healthy=true; break; fi
    sleep 1
done
[[ $healthy == true ]]
nginx -t
systemctl reload nginx
printf 'Deployed %s\n' "$release"
