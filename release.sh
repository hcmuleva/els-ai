#!/usr/bin/env bash

# Master release script: build → push → deploy
# Usage: ./release.sh [--skip-build] [--skip-push] [--skip-deploy]

set -e

SKIP_BUILD=false
SKIP_PUSH=false
SKIP_DEPLOY=false

for arg in "$@"; do
  case $arg in
    --skip-build)  SKIP_BUILD=true ;;
    --skip-push)   SKIP_PUSH=true ;;
    --skip-deploy) SKIP_DEPLOY=true ;;
  esac
done

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "========================================"
echo "🎯 ELS-AI Release Pipeline"
echo "========================================"

if [ "$SKIP_BUILD" = false ]; then
  echo ""
  echo "🔨 Step 1/3: Building Docker images..."
  bash "$DIR/build-all-images.sh"
else
  echo "⏩ Step 1/3: Skipping build."
fi

if [ "$SKIP_PUSH" = false ]; then
  echo ""
  echo "📤 Step 2/3: Pushing Docker images..."
  bash "$DIR/push-all-images.sh"
else
  echo "⏩ Step 2/3: Skipping push."
fi

if [ "$SKIP_DEPLOY" = false ]; then
  echo ""
  echo "🚀 Step 3/3: Deploying to K8s..."
  bash "$DIR/deploy-k8s.sh"
else
  echo "⏩ Step 3/3: Skipping deploy."
fi

echo ""
echo "========================================"
echo "🎉 Release pipeline complete!"
echo "========================================"
