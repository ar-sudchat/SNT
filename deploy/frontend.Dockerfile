# Frontend image for the Coolify self-hosted stack.
# Build context = repo root (so it can use deploy/nginx.coolify.conf without
# touching frontend/nginx.conf, which still serves the old setup).
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
ARG REACT_APP_API_URL=/api
ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN npm run build

FROM nginx:alpine
COPY deploy/nginx.coolify.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
