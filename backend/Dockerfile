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
RUN npm ci

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

# Apply DB migrations on boot, then start the server.
# (Safe/idempotent: with the Neon data restored, migrations are already marked applied.)
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
