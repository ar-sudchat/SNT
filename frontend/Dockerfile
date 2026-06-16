# SNT Frontend — Create React App build, served by nginx
# Built for Coolify (Dockerfile build pack)

# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# CRA bakes env at build time. Coolify must pass this as a build arg so the
# compiled bundle points at the real backend, e.g.
#   REACT_APP_API_URL=https://snt-api.<...>.sslip.io/api
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN npm run build

# ---- serve stage ----
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
