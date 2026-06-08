# Build Stage
FROM --platform=linux/amd64 node:20-slim AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

# Compile assets via Vite
RUN npm run build

# Run Stage
FROM --platform=linux/amd64 nginx:stable-alpine

COPY --from=build /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
