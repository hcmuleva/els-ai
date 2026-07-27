#!/usr/bin/env bash

# Exit immediately if any command fails
set -e

SSH_HOST="els"
REMOTE_DIR="~/k8s-els-ai"

echo "🚀 Deploying K8s manifests to server ($SSH_HOST)..."

# 1. Sync k8s manifests to the remote server
echo "----------------------------------------"
echo "📁 Syncing k8s-els-ai/ to $SSH_HOST:$REMOTE_DIR ..."
echo "----------------------------------------"
rsync -avz --delete \
  ./k8s-els-ai/ \
  els:$REMOTE_DIR/

# 2. Apply via kustomize on the remote & restart deployments to pull fresh images
echo "----------------------------------------"
echo "⚙️  Applying kubectl on $SSH_HOST..."
echo "----------------------------------------"
ssh els "sudo kubectl apply -k $REMOTE_DIR/ && sudo kubectl rollout restart deployment -n els-ai"

echo "========================================"
echo "✅ K8s deployment complete!"
echo "========================================"
