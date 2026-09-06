#!/usr/bin/env bash

set -euo pipefail

IMAGE_TAG="${IMAGE_TAG:-2.1}"
IMAGE_PREFIX="${IMAGE_PREFIX:-harishdell/els-ai}"

build_service() {
  local service="$1"
  local image="$2"

  echo "Building ${image}:${IMAGE_TAG}"
  docker build \
    --build-arg SERVICE_WORKSPACE="backend/${service}" \
    -t "${IMAGE_PREFIX}-${image}:${IMAGE_TAG}" \
    -f Dockerfile.service .
}

build_service "core-api" "core-api"
build_service "workers" "workers"
build_service "media-service" "media-api"
build_service "ai-service" "education-ai-api"
build_service "gateway" "gateway"

docker build \
  --build-arg EXPO_PUBLIC_API_BASE_URL="https://emeelan.in/els-ai/api" \
  --build-arg EXPO_PUBLIC_TTS_URL="https://emeelan.in/els-ai/tts" \
  -t "${IMAGE_PREFIX}-frontend:${IMAGE_TAG}" \
  -f frontend/Dockerfile .

echo "ELS consolidated images built with tag ${IMAGE_TAG}"
