# =============================================================
# Museum OLED Display - Docker Build
# =============================================================
# Multi-stage: Node builds frontend, Python serves everything
# =============================================================

# --- Stage 1: Build frontend ---
FROM node:20-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Stage 2: Runtime ---
FROM python:3.12-slim
WORKDIR /app

# Install Flask
RUN pip install --no-cache-dir flask

# Copy built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Copy server script and default data
COPY start.py .
COPY public/artifacts ./public/artifacts

EXPOSE 8080

# Run Flask server directly (no venv/npm needed in container)
CMD ["python", "start.py", "--docker"]
