#!/usr/bin/env bash
set -euo pipefail
umask 077
backup_dir=/var/backups/gtu-its
install -d -m 700 "$backup_dir"
backup_file="$backup_dir/gtu_its-$(date -u +%Y%m%dT%H%M%S)-$(cat /proc/sys/kernel/random/uuid).dump"
# The database includes original PDF bytes, so one consistent dump covers both.
runuser -u postgres -- pg_dump --format=custom --no-owner --no-acl gtu_its > "$backup_file.tmp"
pg_restore --list "$backup_file.tmp" > /dev/null
mv "$backup_file.tmp" "$backup_file"
find "$backup_dir" -maxdepth 1 -type f -name 'gtu_its-*.dump' -mtime +30 -delete
printf '%s\n' "$backup_file"
