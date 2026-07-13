#!/usr/bin/env sh
set -eu

mkdir -p /app/logs /app/snapshot

python - <<'PY'
import json
import os
from pathlib import Path

path = Path('/app/config/app.json')
config = json.loads(path.read_text(encoding='utf-8'))

host = os.getenv('AGENTSIMS_DB_HOST')
port = os.getenv('AGENTSIMS_DB_PORT')
user = os.getenv('AGENTSIMS_DB_USER')
password = os.getenv('AGENTSIMS_DB_PASSWORD')

for key in ('account', 'game', 'game0001', 'game0002'):
    if host is not None:
        config[f'db_{key}_host'] = host
    if port is not None:
        try:
            config[f'db_{key}_port'] = int(port)
        except ValueError:
            config[f'db_{key}_port'] = port
    if user is not None:
        config[f'db_{key}_user'] = user
    if password is not None:
        config[f'db_{key}_pwd'] = password

path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
PY

if [ "${AGENTSIMS_WAIT_FOR_DB:-1}" = "1" ]; then
  python - <<'PY'
import json
import time
from pathlib import Path
import mysql.connector

config = json.loads(Path('/app/config/app.json').read_text(encoding='utf-8'))
deadline = time.time() + 120
last_error = None

while time.time() < deadline:
    try:
        conn = mysql.connector.connect(
            host=config['db_game_host'],
            port=int(config['db_game_port']),
            user=config['db_game_user'],
            password=config['db_game_pwd'],
            database=config['db_game_name'],
            connection_timeout=3,
        )
        conn.close()
        print('MySQL is ready')
        break
    except Exception as exc:
        last_error = exc
        print(f'Waiting for MySQL: {exc}')
        time.sleep(2)
else:
    raise SystemExit(f'MySQL did not become ready in time: {last_error}')
PY
fi

exec "$@"
