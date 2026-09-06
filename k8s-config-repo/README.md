# ELS AI production deployment (k3s + NGINX ingress)

## 1) Build and push consolidated images (Docker Hub: `harishdell`)

The consolidated ELS profile uses five long-running application images:

```bash
IMAGE_TAG=2.1 ./build-els-images.sh

docker push harishdell/els-ai-core-api:2.1
docker push harishdell/els-ai-workers:2.1
docker push harishdell/els-ai-media-api:2.1
docker push harishdell/els-ai-education-ai-api:2.1
docker push harishdell/els-ai-gateway:2.1
docker push harishdell/els-ai-frontend:2.1
```

## 2) Configure secrets

Edit `k8s/secrets.yaml` and replace all `change-me` values.

## 3) Deploy consolidated ELS to k3s

```bash
kubectl apply -k k8s
kubectl -n els-ai get pods
```

The default `kustomization.yaml` deploys `core-api`, `workers`, `media-service`,
`ai-service`, `gateway`, and `frontend`. The older per-service manifests have
been moved to `tbd/k8s-legacy-per-service/` at the repo root as a rollback/
reference path; they are no longer applied by this kustomization.

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

## 5) Migrate local media assets (`audio-images` + `assets`)

```bash
POD=$(kubectl -n els-ai get pod -l app=gateway -o jsonpath='{.items[0].metadata.name}')
kubectl -n els-ai cp ./audio-images/. "$POD:/app/audio-images"
kubectl -n els-ai cp ./assets/. "$POD:/app/assets"
kubectl -n els-ai exec -it "$POD" -- ls /app/audio-images
kubectl -n els-ai exec -it "$POD" -- ls /app/assets
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
