#!/usr/bin/env bash

set -euo pipefail

IMAGE_TAG="${IMAGE_TAG:-2.1}"
IMAGE_PREFIX="${IMAGE_PREFIX:-harishdell/els-ai}"

IMAGES=(
  "core-api"
  "workers"
  "media-api"
  "education-ai-api"
  "gateway"
  "frontend"
)

for image in "${IMAGES[@]}"; do
  echo "Pushing ${IMAGE_PREFIX}-${image}:${IMAGE_TAG}"
  docker push "${IMAGE_PREFIX}-${image}:${IMAGE_TAG}"
done

echo "ELS consolidated images pushed with tag ${IMAGE_TAG}"
