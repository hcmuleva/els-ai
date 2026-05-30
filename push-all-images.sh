#!/usr/bin/env bash

# Exit immediately if any command fails
set -e

echo "🚀 Starting to push all Docker images to Docker Hub..."

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

# 1. Push all Node service images
for service in "${SERVICES[@]}"; do
  echo "----------------------------------------"
  echo "📤 Pushing Node service image: $service..."
  echo "----------------------------------------"
  docker push "harishdell/els-ai-$service:1.1"
done

# 3. Push static Frontend
echo "----------------------------------------"
echo "📤 Pushing Frontend Service..."
echo "----------------------------------------"
docker push "harishdell/els-ai-frontend:1.1"

echo "========================================"
echo "🎉 Successfully pushed all Docker images!"
echo "========================================"
