#!/usr/bin/env bash
# Deploys the bike configurator as ONE Docker container on this host.
#
# SINGLE INSTANCE ONLY. Carts, stock reservations and idempotency keys live in
# process memory, so two instances would each hold different carts and stock.
# Never run several replicas, never put this on serverless. This script keeps
# one container named "$NAME" and replaces it on every deploy.
#
# Usage: scripts/deploy.sh [--dry-run] [--tag TAG] [--help]
#   --dry-run  print the steps without running docker
#   --tag TAG  deploy this image tag instead of the git short sha
#
# Environment (all optional):
#   PORT=3000            host and container port
#   REVALIDATE_SECRET    enables POST /api/revalidate (unset: endpoint refuses)
#   STOCK_FAILURE_RATE, STOCK_LATENCY_MIN_MS, STOCK_LATENCY_MAX_MS, STOCK_SEED
#   APP_NAME=bikes       container and image name
#   HEALTH_TIMEOUT=60    seconds to wait for the container to become healthy
#
# Rollback: the previously running tag is recorded before the swap. If the new
# container is not healthy within HEALTH_TIMEOUT, it is removed and the
# previous tag is started again. Memory state (carts) is lost on any swap.
set -euo pipefail

NAME="${APP_NAME:-bikes}"
PORT="${PORT:-3000}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"
DRY_RUN=0
TAG=""

usage() { sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'; }
die() { echo "deploy: $*" >&2; exit 2; }

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --tag)
      [ $# -ge 2 ] || die "--tag needs a value"
      TAG="$2"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument: $1 (try --help)" ;;
  esac
  shift
done

case "$PORT" in ''|*[!0-9]*) die "PORT must be a number, got '$PORT'" ;; esac
case "$HEALTH_TIMEOUT" in ''|*[!0-9]*) die "HEALTH_TIMEOUT must be a number" ;; esac

if [ -z "$TAG" ]; then
  TAG="$(git rev-parse --short HEAD 2>/dev/null)" || die "not a git checkout; pass --tag"
fi
IMAGE="$NAME:$TAG"

run() {
  if [ "$DRY_RUN" = 1 ]; then echo "+ $*"; else "$@"; fi
}

env_args=(-e "PORT=$PORT")
for var in REVALIDATE_SECRET STOCK_FAILURE_RATE STOCK_LATENCY_MIN_MS STOCK_LATENCY_MAX_MS STOCK_SEED; do
  [ -z "${!var:-}" ] || env_args+=(-e "$var")
done

start() { # image
  run docker run -d --name "$NAME" --restart unless-stopped \
    -p "$PORT:$PORT" "${env_args[@]}" "$1"
}

wait_healthy() {
  [ "$DRY_RUN" = 1 ] && { echo "+ wait up to ${HEALTH_TIMEOUT}s for $NAME to report healthy"; return 0; }
  local waited=0 status
  while [ "$waited" -lt "$HEALTH_TIMEOUT" ]; do
    status="$(docker inspect -f '{{.State.Health.Status}}' "$NAME" 2>/dev/null || echo missing)"
    [ "$status" = healthy ] && return 0
    [ "$status" = unhealthy ] && return 1
    sleep 2; waited=$((waited + 2))
  done
  return 1
}

previous=""
if [ "$DRY_RUN" = 1 ]; then
  echo "+ previous=\$(docker inspect -f '{{.Config.Image}}' $NAME)  # remembered for rollback"
else
  previous="$(docker inspect -f '{{.Config.Image}}' "$NAME" 2>/dev/null || true)"
fi

run docker build -t "$IMAGE" .
if [ "$DRY_RUN" = 1 ]; then echo "+ docker rm -f $NAME  # if present"; else docker rm -f "$NAME" >/dev/null 2>&1 || true; fi
start "$IMAGE"

if wait_healthy; then
  [ "$DRY_RUN" = 1 ] && echo "deploy: dry run, nothing was run" || echo "deploy: $IMAGE is healthy on port $PORT"
  exit 0
fi

echo "deploy: $IMAGE did not become healthy; rolling back" >&2
docker logs --tail 30 "$NAME" >&2 || true
docker rm -f "$NAME" >/dev/null 2>&1 || true
if [ -n "$previous" ]; then
  start "$previous"
  echo "deploy: rolled back to $previous" >&2
else
  echo "deploy: no previous container to roll back to" >&2
fi
exit 1
