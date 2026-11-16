#!/usr/bin/env bash
# Deploys the bike configurator to Google Cloud Run with `gcloud run deploy --source .`
# (Cloud Build builds the Dockerfile, Artifact Registry stores the image).
#
# SINGLE INSTANCE ONLY. Carts, stock reservations and idempotency keys live in
# process memory, so two instances would each hold different carts and stock.
# The service is pinned to --min-instances=1 --max-instances=1 and
# --no-cpu-throttling (the instance stays warm and keeps CPU between requests).
# Any new revision or restart replaces the process and LOSES ALL CARTS.
#
# Usage: scripts/deploy.sh [--dry-run] [--help]
#   --dry-run  print the steps without calling gcloud or curl
#
# Environment:
#   PROJECT (required)   GCP project id
#   REGION  (required)   Cloud Run region, e.g. europe-west1
#   SERVICE=bikes        Cloud Run service name
#   REVALIDATE_SECRET    enables POST /api/revalidate (unset: endpoint refuses);
#                        prefer Secret Manager, see README
#   STOCK_FAILURE_RATE, STOCK_LATENCY_MIN_MS, STOCK_LATENCY_MAX_MS, STOCK_SEED
#   HEALTH_TIMEOUT=60    seconds to wait for GET /api/health after the deploy
#
# HTTPS is provided by Cloud Run. The cart cookie is Secure in production, so
# browsers drop it over plain http (except on localhost): never front the
# service with plain http.
#
# Rollback: the latest ready revision is recorded before deploying. If the
# deploy fails, Cloud Run keeps serving that revision. If it succeeds but
# GET /api/health on the service URL is not OK within HEALTH_TIMEOUT, traffic is
# shifted back with `gcloud run services update-traffic --to-revisions=<previous>=100`.
set -euo pipefail

SERVICE="${SERVICE:-bikes}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"
DRY_RUN=0

usage() { sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'; }
die() { echo "deploy: $*" >&2; exit 2; }

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument: $1 (try --help)" ;;
  esac
  shift
done

[ -n "${PROJECT:-}" ] || die "PROJECT is required (GCP project id)"
[ -n "${REGION:-}" ] || die "REGION is required (e.g. europe-west1)"
case "$HEALTH_TIMEOUT" in ''|*[!0-9]*) die "HEALTH_TIMEOUT must be a number" ;; esac

# Env vars for the service. "^@^" makes @ the list separator, so values may
# contain commas.
env_list=""
for var in REVALIDATE_SECRET STOCK_FAILURE_RATE STOCK_LATENCY_MIN_MS STOCK_LATENCY_MAX_MS STOCK_SEED; do
  [ -z "${!var:-}" ] || env_list="${env_list:+$env_list@}$var=${!var}"
done

gc=(gcloud --project "$PROJECT" --quiet)
deploy_args=(run deploy "$SERVICE" --source . --region "$REGION"
  --allow-unauthenticated
  --min-instances=1 --max-instances=1 --concurrency=80 --no-cpu-throttling)
[ -z "$env_list" ] || deploy_args+=(--set-env-vars "^@^$env_list")

if [ "$DRY_RUN" = 1 ]; then
  masked=("${deploy_args[@]}")
  for i in "${!masked[@]}"; do
    case "${masked[$i]}" in "^@^"*) masked[i]="^@^<${env_list//=*/}...>" ;; esac
  done
  echo "+ previous=\$(${gc[*]} run services describe $SERVICE --region $REGION --format='value(status.latestReadyRevisionName)')  # remembered for rollback"
  echo "+ ${gc[*]} ${masked[*]}"
  echo "+ url=\$(${gc[*]} run services describe $SERVICE --region $REGION --format='value(status.url)')"
  echo "+ curl -fsS \$url/api/health  # retry up to ${HEALTH_TIMEOUT}s"
  echo "+ on failure: ${gc[*]} run services update-traffic $SERVICE --region $REGION --to-revisions=<previous>=100"
  echo "deploy: dry run, nothing was run"
  exit 0
fi

previous="$("${gc[@]}" run services describe "$SERVICE" --region "$REGION" \
  --format='value(status.latestReadyRevisionName)' 2>/dev/null || true)"

# A failed deploy leaves the previous revision serving traffic.
"${gc[@]}" "${deploy_args[@]}" || { echo "deploy: gcloud deploy failed; Cloud Run keeps serving ${previous:-nothing}" >&2; exit 1; }

url="$("${gc[@]}" run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
waited=0
while [ "$waited" -lt "$HEALTH_TIMEOUT" ]; do
  if curl -fsS --max-time 5 -o /dev/null "$url/api/health"; then
    echo "deploy: $SERVICE is healthy at $url"
    exit 0
  fi
  sleep 3; waited=$((waited + 3))
done

echo "deploy: $url/api/health is not healthy; rolling back" >&2
if [ -n "$previous" ]; then
  "${gc[@]}" run services update-traffic "$SERVICE" --region "$REGION" --to-revisions="$previous=100"
  echo "deploy: traffic shifted back to $previous" >&2
else
  echo "deploy: no previous revision to roll back to" >&2
fi
exit 1
