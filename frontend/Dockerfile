FROM node:20-alpine AS build
WORKDIR /app/frontend

ARG EXPO_PUBLIC_API_BASE_URL=https://emeelan.in/els-ai/api
ARG EXPO_PUBLIC_TTS_URL=

ENV EXPO_PUBLIC_API_BASE_URL=${EXPO_PUBLIC_API_BASE_URL}
ENV EXPO_PUBLIC_TTS_URL=${EXPO_PUBLIC_TTS_URL}

COPY frontend/package.json frontend/package-lock.json ./
RUN npm install --no-audit --no-fund

COPY frontend ./

RUN npx expo export --platform web

FROM nginx:1.27-alpine AS runtime
WORKDIR /usr/share/nginx/html

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist ./

EXPOSE 80
