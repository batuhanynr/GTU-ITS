#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
cd "$HOME"
exec 9>.deploy-lock
flock -n 9 || exit 0

git -C source fetch --quiet origin refs/heads/main:refs/remotes/origin/main
revision=$(git -C source rev-parse refs/remotes/origin/main)
active=$(readlink current || true)
[[ "$active" != "releases/$revision" ]] || exit 0
git -C source cat-file -e "$revision:ops/staging/compose.yml" || exit 0

# Accept only the latest push run for this exact main commit.
result=$(curl --fail --silent --show-error --max-time 20 \
    "https://api.github.com/repos/batuhanynr/GTU-ITS/actions/workflows/ci.yml/runs?branch=main&event=push&head_sha=$revision&per_page=1" |
    jq -r --arg sha "$revision" '.workflow_runs[0] | if .head_sha == $sha and .status == "completed" then .conclusion else "pending" end')
if [[ "$result" != success ]]; then
    printf 'Skipping %s (CI: %s)\n' "$revision" "$result"
    exit 0
fi

compose() {
    local release=$1
    shift
    REVISION=${release##*/} docker compose --project-name gtu-its-staging --env-file "$HOME/staging.env" \
        --file "$HOME/$release/ops/staging/compose.yml" "$@"
}

candidate="releases/$revision"
mkdir -p "$candidate"
# Keep checked-in modes so the non-root API process can read its files.
git -C source archive "$revision" | tar --same-permissions -x -C "$candidate"
# Build one image at a time within the staging account's memory limit.
compose "$candidate" build api
compose "$candidate" build web

# A newer push may have arrived while the images were building.
git -C source fetch --quiet origin refs/heads/main:refs/remotes/origin/main
[[ "$revision" == "$(git -C source rev-parse refs/remotes/origin/main)" ]] || exit 0

compose "$candidate" up --detach --wait --wait-timeout 90 db
compose "$candidate" run --rm --no-deps api ./node_modules/.bin/prisma migrate deploy
if ! compose "$candidate" up --detach --no-build --wait --wait-timeout 90 api web ||
   ! curl --fail --silent --show-error --retry 6 --retry-all-errors --retry-delay 1 --max-time 5 \
       http://127.0.0.1:18126/api/health | jq -e '.status == "ok"' >/dev/null ||
   ! curl --fail --silent --show-error --max-time 5 http://127.0.0.1:18126/ >/dev/null; then
    if [[ -n "$active" ]]; then
        compose "$active" up --detach --no-build --wait --wait-timeout 90 api web
    else
        compose "$candidate" stop api web
    fi
    exit 1
fi

ln -sfn "$candidate" .current-next
mv -Tf .current-next current
printf 'Deployed %s to staging\n' "$revision"

# Keep the active and previous releases on this dedicated daemon.
for release in releases/*; do
    [[ "$release" == "$candidate" || "$release" == "$active" ]] && continue
    [[ "${release##*/}" =~ ^[0-9a-f]{40}$ ]] || continue
    docker image rm "gtu-its-staging-api:${release##*/}" "gtu-its-staging-web:${release##*/}" >/dev/null 2>&1 || true
    rm -rf -- "$release"
done
docker builder prune --filter until=168h --force >/dev/null
