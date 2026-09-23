# Estágio 1: build do React (testes Vitest + checagem de tipos + bundle).
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run test -- --run \
    && npm run build

# Estágio 2: nginx servindo os estáticos e fazendo proxy para a API e o inspetor.
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
