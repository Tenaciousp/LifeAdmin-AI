#!/usr/bin/env bash
set -Eeuo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Run this on an authorised Docker host such as the existing Codespace." >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required." >&2
  exit 1
fi
if ! command -v python >/dev/null 2>&1; then
  echo "python is required." >&2
  exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
work_dir="$(mktemp -d "${TMPDIR:-/tmp}/lifeadmin-docker-verify.XXXXXX")"
data_dir="$work_dir/data"
cookie_file="$work_dir/cookies.txt"
image="lifeadmin-ai:release-verify"
container="lifeadmin-release-verify-$$"
session_secret="synthetic-release-verification-secret-2026-only"
base_url=""

mkdir -p "$data_dir"

cleanup() {
  status=$?
  if docker container inspect "$container" >/dev/null 2>&1; then
    if [ "$status" -ne 0 ]; then
      echo "Container logs:" >&2
      docker logs "$container" >&2 || true
    fi
    docker rm --force "$container" >/dev/null 2>&1 || true
  fi
  if [ "$status" -eq 0 ]; then
    docker image rm "$image" >/dev/null 2>&1 || true
  fi
  if [[ "$work_dir" == "${TMPDIR:-/tmp}/lifeadmin-docker-verify."* ]]; then
    rm -rf -- "$work_dir"
  fi
  exit "$status"
}
trap cleanup EXIT

start_container() {
  docker run --detach \
    --name "$container" \
    --publish 127.0.0.1::8000 \
    --mount "type=bind,src=$data_dir,dst=/app/artifacts/api-server/data" \
    --env APP_ENV=production \
    --env "SESSION_SECRET=$session_secret" \
    --env SQLITE_DB_PATH=/app/artifacts/api-server/data/lifeadmin.sqlite3 \
    --env DEMO_PAYMENTS=false \
    --env ADMIN_EMAILS=admin@example.invalid \
    "$image" >/dev/null

  host_port="$(docker inspect --format '{{(index (index .NetworkSettings.Ports "8000/tcp") 0).HostPort}}' "$container")"
  base_url="http://127.0.0.1:$host_port"
  for attempt in $(seq 1 60); do
    if curl --fail --silent "$base_url/api/health" >/dev/null; then
      return
    fi
    sleep 1
  done
  echo "Container did not become healthy within 60 seconds." >&2
  return 1
}

cd "$repo_root"
echo "Building production image..."
docker build --file Dockerfile --tag "$image" .

echo "Starting production container with private synthetic storage..."
start_container

curl --fail --silent --show-error "$base_url/" | python -c 'import sys; assert "LifeAdmin" in sys.stdin.read()'
LIFEADMIN_SMOKE_BASE_URL="$base_url" python scripts/smoke_api.py

curl --fail --silent --show-error \
  --cookie "$cookie_file" --cookie-jar "$cookie_file" \
  --header 'Content-Type: application/json' \
  --data '{"title":"Docker persistence check","category_id":"energy_water","goal_id":"prepare_renewal","priority":"Medium","details":{"provider":"Synthetic Energy","account_reference":"SYN-DOCKER-001"},"notes":""}' \
  "$base_url/api/tasks" > "$work_dir/created-task.json"

task_id="$(python -c 'import json,sys; print(json.load(open(sys.argv[1]))["task"]["id"])' "$work_dir/created-task.json")"

docker exec "$container" python scripts/backup_data.py \
  /app/artifacts/api-server/data /tmp/lifeadmin-release-backup >/dev/null
docker exec "$container" test -s /tmp/lifeadmin-release-backup/manifest.json

echo "Restarting from the same mounted storage..."
docker rm --force "$container" >/dev/null
start_container

curl --fail --silent --show-error \
  --cookie "$cookie_file" --cookie-jar "$cookie_file" \
  "$base_url/api/tasks" > "$work_dir/tasks-after-restart.json"

python - "$work_dir/tasks-after-restart.json" "$task_id" <<'PY'
import json
import sys

payload = json.load(open(sys.argv[1], encoding="utf-8"))
task_id = sys.argv[2]
task = next((item for item in payload["tasks"] if item["id"] == task_id), None)
assert task is not None, "Synthetic task did not survive the container restart"
assert task["details"]["provider"] == "Synthetic Energy"
assert task["details"]["account_reference"] == "SYN-DOCKER-001"
PY

curl --fail --silent --show-error \
  --cookie "$cookie_file" --cookie-jar "$cookie_file" \
  --header 'Content-Type: application/json' \
  --data "{\"id\":\"$task_id\"}" \
  "$base_url/api/tasks/delete" >/dev/null

echo "Docker release verification passed: image build, startup, web/API smoke, preview-only payments, mounted-data restart and backup helper."
