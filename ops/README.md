# Production deployment

The school server keeps PostgreSQL outside the application container. Nginx serves the frontend from `/srv/gtu-its/current/frontend` and proxies `/api/` to loopback port 3001. Each backend image and frontend directory uses the full source commit SHA.

Production credentials live in `/etc/gtu-its`, outside every release. The runtime database account has data access; a separate migration account owns the schema. Original PDF bytes are stored in PostgreSQL and are included in database dumps.

## First installation

1. Inventory existing databases and sites. Back them up before changing server configuration. The installer refuses to take over an existing `gtu_its` database when its configuration is missing.
2. Install these files on the server and run `sudo python3 ops/install-server.py`. This requires PostgreSQL, Docker, Nginx, Python 3 and curl. It preserves an existing production configuration when repeated.
3. Build the backend image with `docker build -t gtu-its-api:COMMIT_SHA backend`. Build the frontend with `npm ci` and `npm run build`, using `REACT_APP_API_URL=/api`. Put the frontend build in `/srv/gtu-its/releases/COMMIT_SHA/frontend`. Existing lint warnings must be reported; the current build requires `CI=false` until they are fixed.
4. Run `sudo gtu-its-deploy COMMIT_SHA`. It takes a database backup, applies migrations, starts the application and checks database-backed health. Migration failure stops the deployment; it does not reset or reseed the database.
5. On the first installation only, run `node scripts/bootstrap-production.js` in the backend image using both `backend.env` and `bootstrap.env`. It creates the initial administrator with a required password change. Repeating it preserves the existing account and password. Remove the bootstrap secret from the server after handing it over securely.
6. Obtain the institution's TLS certificate or issue one using an approved ACME method. Install `nginx-https.conf` as the dedicated site after the certificate exists. Run the installer again to install the Certbot reload hook without changing existing credentials or the HTTPS site, and check renewal before sending users to the login page.

The deployment command does not build, install packages, run tests, create demo accounts or reset databases. Build and test the candidate first. The same command can later be called by a trusted deployment runner with school-network access. PR tests should run separately from production.

## Backups and recovery

`gtu-its-backup.timer` creates a consistent custom-format PostgreSQL dump daily around 02:00 server time. Deployment also takes a backup after stopping application writes. Dumps are root-readable under `/var/backups/gtu-its`; application dumps older than 30 days are removed. Keep a separate protected backup of `/etc/gtu-its` so database roles and environment settings can be recreated.

Copy backups to an institution-approved off-server location. Local dumps do not protect against losing the server disk. Off-server scheduling needs an agreed destination and credentials.

Verify recovery by restoring a dump into a separate database using PostgreSQL tools of the same major version, then compare record counts and original-document byte hashes. Never restore over production just to test a backup. Production tests must not use the demo seed or reset commands.

To roll back application code, call `gtu-its-deploy PREVIOUS_COMMIT_SHA`. Schema changes must remain compatible with the previous version. A health-check failure restores the previous application reference; it does not restore the database. Database recovery is a separate planned operation because restoring a dump can remove writes made after that dump.

Keep old release directories and images until their rollback period ends. Check `systemctl status gtu-its-api`, `journalctl -u gtu-its-api`, `/api/health`, and the backup timer after deployment. Do not paste environment files or user records into logs or GitHub.
