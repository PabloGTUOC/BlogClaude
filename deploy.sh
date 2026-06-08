#!/bin/bash
# ============================================================
# ENDERTHOUGHTS // COMPILING & DEPLOYMENT UTILITY
# ============================================================

set -e

echo "=== STEP 1: COMPILING PLATFORM IMAGES FOR TARGET x86_64 ==="
docker build --platform linux/amd64 -t enderthoughts-api:latest ./api
docker build --platform linux/amd64 -t enderthoughts-frontend:latest ./frontend

echo "=== STEP 2: SHUTTING DOWN ACTIVE INSTANCES ==="
docker compose down || true

echo "=== STEP 3: LAUNCHING ORCHESTRATION DAEMON ==="
docker compose up -d

echo "=== DEPLOYMENT COMPLETED SECURELY ==="
docker compose ps
