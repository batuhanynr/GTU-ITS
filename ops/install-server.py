#!/usr/bin/env python3
"""Prepare a dedicated database and service without resetting existing installations."""
import os
from pathlib import Path
import secrets
import shutil
import subprocess

assert os.geteuid() == 0, 'Run as root.'
source = Path(__file__).resolve().parent
config = Path('/etc/gtu-its')
config.mkdir(mode=0o700, exist_ok=True)
os.chmod(config, 0o700)

def sql(query, database='postgres'):
    return subprocess.check_output(['runuser', '-u', 'postgres', '--', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-d', database], input=query.encode()).decode().strip()

def private_file(name, contents):
    path = config / name
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as stream:
        stream.write(contents)

if not (config / 'backend.env').exists():
    # Refuse to adopt an unknown database or account by silently replacing credentials.
    assert not sql("SELECT datname FROM pg_database WHERE datname='gtu_its'"), 'Existing database needs manual review.'
    assert not sql("SELECT rolname FROM pg_roles WHERE rolname IN ('gtu_its_owner','gtu_its_app')"), 'Existing roles need manual review.'
    owner_password, app_password = secrets.token_hex(32), secrets.token_hex(32)
    sql(f"CREATE ROLE gtu_its_owner LOGIN PASSWORD '{owner_password}'; CREATE ROLE gtu_its_app LOGIN PASSWORD '{app_password}';")
    sql('CREATE DATABASE gtu_its OWNER gtu_its_owner;')
    sql('''GRANT CONNECT ON DATABASE gtu_its TO gtu_its_app;
GRANT USAGE ON SCHEMA public TO gtu_its_app;
ALTER DEFAULT PRIVILEGES FOR ROLE gtu_its_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gtu_its_app;
ALTER DEFAULT PRIVILEGES FOR ROLE gtu_its_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO gtu_its_app;''', 'gtu_its')
    private_file('backend.env', f'''NODE_ENV=production
HOST=127.0.0.1
PORT=3001
DATABASE_URL=postgresql://gtu_its_app:{app_password}@127.0.0.1:5432/gtu_its?schema=public
JWT_SECRET={secrets.token_hex(64)}
JWT_EXPIRE=7d
CLIENT_URL=https://bmstaj.gtu.edu.tr
EMAIL_USER=
EMAIL_PASS=
''')
    private_file('migrate.env', f'DATABASE_URL=postgresql://gtu_its_owner:{owner_password}@127.0.0.1:5432/gtu_its?schema=public\n')
    private_file('bootstrap.env', f'BOOTSTRAP_ADMIN_EMAIL=b.yanar2022@gtu.edu.tr\nBOOTSTRAP_ADMIN_NAME=Batuhan Yanar\nBOOTSTRAP_ADMIN_PASSWORD={secrets.token_urlsafe(24)}\n')
else:
    assert (config / 'migrate.env').exists(), 'Migration credentials are missing.'
    print('Existing production credentials preserved.')

for directory, mode in [('/srv/gtu-its/releases', 0o755), ('/var/backups/gtu-its', 0o700), ('/var/lib/letsencrypt', 0o755)]:
    Path(directory).mkdir(parents=True, exist_ok=True, mode=mode)
    os.chmod(directory, mode)
for name in ['gtu-its-api.service', 'gtu-its-backup.service', 'gtu-its-backup.timer']:
    shutil.copyfile(source / name, Path('/etc/systemd/system') / name)
    os.chmod(Path('/etc/systemd/system') / name, 0o644)
for name in ['backup', 'deploy']:
    target = Path(f'/usr/local/sbin/gtu-its-{name}')
    shutil.copyfile(source / f'{name}.sh', target)
    os.chmod(target, 0o750)
site = Path('/etc/nginx/sites-available/gtu-its')
# Keep certificate settings when the installer is repeated after HTTPS setup.
if not site.exists():
    shutil.copyfile(source / 'nginx.conf', site)
link = Path('/etc/nginx/sites-enabled/gtu-its')
if not link.exists():
    link.symlink_to(site)
if Path('/etc/letsencrypt/live/bmstaj.gtu.edu.tr/fullchain.pem').exists():
    hooks = Path('/etc/letsencrypt/renewal-hooks/deploy')
    hooks.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source / 'renew-nginx.sh', hooks / 'gtu-its-nginx.sh')
    os.chmod(hooks / 'gtu-its-nginx.sh', 0o750)
subprocess.run(['nginx', '-t'], check=True)
subprocess.run(['systemctl', 'daemon-reload'], check=True)
subprocess.run(['systemctl', 'enable', 'gtu-its-api.service', 'gtu-its-backup.timer'], check=True)
subprocess.run(['systemctl', 'start', 'gtu-its-backup.timer'], check=True)
subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
print('Dedicated database, service and backup timer prepared. No demo seed was run.')
