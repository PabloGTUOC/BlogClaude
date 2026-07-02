FROM --platform=linux/amd64 node:20-slim

WORKDIR /app

COPY package*.json ./

# sharp 0.33 and ffmpeg-static/ffprobe-static all ship prebuilt linux-x64
# binaries — no python3/make/g++ toolchain needed in the image.
RUN npm ci --only=production

COPY src/ ./src/

EXPOSE 3000

ENV NODE_ENV=production

# Run as the non-root 'node' user (uid 1000, ships with the base image).
# uid 1000 matches the typical Linux host deploy user, so the bind-mounted
# uploads dir stays writable and the ro firebase json stays readable.
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

# /health is a public route in src/index.js; node 20 has global fetch.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]
