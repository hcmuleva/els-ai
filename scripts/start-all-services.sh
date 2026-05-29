#!/bin/sh
set -eu

SERVICES="
auth-service|backend/auth-service|4101
quiz-service|backend/quiz-service|4002
classroom-service|backend/classroom-service|4006
achievement-service|backend/achievement-service|4007
question-bank-service|backend/question-bank-service|4008
content-service|backend/content-service|4009
topic-service|backend/topic-service|4010
assignment-service|backend/assignment-service|4011
org-service|backend/org-service|4012
media-service|backend/media-service|4004
ai-service|backend/ai-service|4003
notification-service|backend/notification-service|4013
story-service|backend/story-service|4014
gateway|backend/gateway|4000
"

PIDS=""

start_service() {
  name="$1"
  workspace="$2"
  port="$3"

  echo "Starting ${name} on port ${port}..."
  PORT="$port" npm run start --workspace "$workspace" &
  pid="$!"
  PIDS="${PIDS} ${pid}:${name}"
}

shutdown_all() {
  echo "Stopping all services..."
  for entry in $PIDS; do
    pid="${entry%%:*}"
    kill "$pid" 2>/dev/null || true
  done
}

trap 'shutdown_all; exit 0' INT TERM

for svc in $SERVICES; do
  IFS='|' read -r name workspace port <<EOF
$svc
EOF
  start_service "$name" "$workspace" "$port"
done

echo "All services started."

while true; do
  for entry in $PIDS; do
    pid="${entry%%:*}"
    name="${entry#*:}"
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "Service ${name} exited unexpectedly."
      shutdown_all
      exit 1
    fi
  done
  sleep 2
done
