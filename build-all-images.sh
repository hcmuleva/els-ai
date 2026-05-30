#!/usr/bin/env bash

# Exit immediately if any command fails
set -e

echo "🚀 Starting to build all Docker images for els-ai..."

# List of Node services
SERVICES=(
  "auth-service"
  "quiz-service"
  "media-service"
  "ai-service"
  "gateway"
  "classroom-service"
  "achievement-service"
  "question-bank-service"
  "content-service"
  "topic-service"
  "assignment-service"
  "org-service"
  "notification-service"
  "story-service"
)

# 1. Build all Node services using the unified Dockerfile.service
for service in "${SERVICES[@]}"; do
  echo "----------------------------------------"
  echo "📦 Building Node service: $service..."
  echo "----------------------------------------"
  docker build \
    --build-arg SERVICE_WORKSPACE="backend/$service" \
    -t "harishdell/els-ai-$service:1.1" \
    -f Dockerfile.service .
done

# 3. Build static Frontend
echo "----------------------------------------"
echo "🌐 Building Frontend Service..."
echo "----------------------------------------"
docker build \
  --build-arg EXPO_PUBLIC_API_BASE_URL="https://emeelan.in/els-ai/api" \
  --build-arg EXPO_PUBLIC_TTS_URL="https://emeelan.in/els-ai/tts" \
  -t "harishdell/els-ai-frontend:1.1" \
  -f frontend/Dockerfile .

echo "========================================"
echo "🎉 Successfully built all Docker images!"
echo "========================================"
