# SNT Frontend — Create React App build, served by nginx
# Built for Coolify (Dockerfile build pack)

# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
# npm install (not ci) — committed package-lock.json is out of sync with
# package.json (old Koyeb setup used npm install), so npm ci errors with EUSAGE.
RUN npm install

COPY . .

# Single-domain setup: the SPA calls a relative /api, which nginx proxies to
# the backend container (see nginx.conf). Same-origin -> no CORS, no preflight.
# Defaults to /api so it works even without a Coolify build arg.
ARG REACT_APP_API_URL=/api
ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN npm run build

# ---- serve stage ----
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
