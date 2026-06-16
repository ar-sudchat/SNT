# SNT Backend — Express + Prisma (PostgreSQL)
# Built for Coolify (Dockerfile build pack)
FROM node:20-slim

WORKDIR /app

# Prisma query engine needs OpenSSL on Debian slim images
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies (devDeps included so the prisma CLI is available for
# `prisma generate` and `migrate deploy`)
COPY package*.json ./
# npm install (not ci) — the committed package-lock.json is out of sync with
# package.json (the old Koyeb setup used npm install), which makes npm ci fail.
RUN npm install

# App source
COPY . .

# Generate Prisma client against schema.prisma
RUN npx prisma generate

ENV NODE_ENV=production
ENV PORT=5001
EXPOSE 5001

# Container-level healthcheck (Coolify also has its own on /api/health)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||5001)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# This project manages schema with `prisma db push` (no migrations folder).
# db push is idempotent: with the restored schema already in sync it's a no-op,
# and it never drops data unless --accept-data-loss is passed. Then start server.
CMD ["sh", "-c", "npx prisma db push --skip-generate && node server.js"]
