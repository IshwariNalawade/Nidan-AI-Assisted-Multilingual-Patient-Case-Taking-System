FROM node:22-slim
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=3000 PUBLIC_HTTPS=true COOKIE_SECURE=true COOKIE_SAME_SITE=none TRUST_PROXY=true NIDAN_STORAGE_BACKEND=project BHASHINI_ENABLED=false
COPY package.json package-lock.json ./
COPY scripts/copy-ocr-assets.mjs ./scripts/copy-ocr-assets.mjs
RUN npm ci --include=dev
COPY . .
RUN npm run db:generate && npm run build:all && npm prune --omit=dev
USER node
EXPOSE 3000
CMD ["npm", "start"]
