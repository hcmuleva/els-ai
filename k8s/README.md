# ELS AI production deployment (k3s + NGINX ingress)

## 1) Build and push images (Docker Hub: `harishdell`)

Use these tags and keep the same names in `k8s/*.yaml`.

```bash
docker build -f Dockerfile.service --build-arg SERVICE_WORKSPACE=backend/auth-service -t harishdell/els-ai-auth-service:1.0 .
docker build -f Dockerfile.service --build-arg SERVICE_WORKSPACE=backend/quiz-service -t harishdell/els-ai-quiz-service:1.0 .
docker build -f Dockerfile.service --build-arg SERVICE_WORKSPACE=backend/media-service -t harishdell/els-ai-media-service:1.0 .
docker build -f Dockerfile.service --build-arg SERVICE_WORKSPACE=backend/ai-service -t harishdell/els-ai-ai-service:1.0 .
docker build -f Dockerfile.service --build-arg SERVICE_WORKSPACE=backend/gateway -t harishdell/els-ai-gateway:1.0 .
docker build -f frontend/Dockerfile -t harishdell/els-ai-frontend:1.0 .

docker push harishdell/els-ai-auth-service:1.0
docker push harishdell/els-ai-quiz-service:1.0
docker push harishdell/els-ai-media-service:1.0
docker push harishdell/els-ai-ai-service:1.0
docker push harishdell/els-ai-gateway:1.0
docker push harishdell/els-ai-frontend:1.0
```

## 2) Configure secrets

Edit `k8s/secrets.yaml` and replace all `change-me` values.

## 3) Deploy to k3s

```bash
kubectl apply -k k8s
kubectl -n els-ai get pods
```

App URLs:
- Frontend: `https://emeelan.in/els-ai`
- API gateway: `https://emeelan.in/els-ai/api`

## 4) Migrate PostgreSQL data

### Export from current DB

```bash
pg_dump -h <old-db-host> -U <old-db-user> -d <old-db-name> -Fc -f els-ai.dump
```

### Copy dump into k3s postgres pod and restore

```bash
POD=$(kubectl -n els-ai get pod -l app=postgres -o jsonpath='{.items[0].metadata.name}')
kubectl -n els-ai cp ./els-ai.dump "$POD:/tmp/els-ai.dump"
kubectl -n els-ai exec -it "$POD" -- sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists /tmp/els-ai.dump'
```

## 5) Migrate local media assets (`audio-images`)

```bash
POD=$(kubectl -n els-ai get pod -l app=gateway -o jsonpath='{.items[0].metadata.name}')
kubectl -n els-ai cp ./audio-images/. "$POD:/app/audio-images"
kubectl -n els-ai exec -it "$POD" -- ls /app/audio-images
```

## 6) Verify ingress paths

```bash
curl -I https://emeelan.in/els-ai
curl -I https://emeelan.in/els-ai/api/health
```

If API calls fail from frontend, ensure `EXPO_PUBLIC_API_BASE_URL` in `k8s/config.yaml` is exactly:

```text
https://emeelan.in/els-ai/api
```
