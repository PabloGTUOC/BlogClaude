FROM --platform=linux/amd64 node:20-slim

# Install system dependencies if required for sharp (sharp usually brings prebuilt binaries)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY src/ ./src/

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npm", "start"]
