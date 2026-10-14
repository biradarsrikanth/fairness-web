# Build stage: the production Angular build
FROM node:24-alpine AS build
WORKDIR /app

# Install dependencies first so they are cached until the lock file changes
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npx ng build

# Runtime stage: Nginx serves the app and passes /api to the gateway (same origin, so the refresh cookie and
# relative /api URLs work as with the dev server)
FROM nginx:1.29-alpine

# The image fills ${GATEWAY_URL} into the template at start-up
ENV GATEWAY_URL=http://gateway:8080
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist/fairness-web/browser /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1/healthz > /dev/null || exit 1
