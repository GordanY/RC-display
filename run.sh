#!/bin/bash
#
# Museum OLED Display - Docker Launcher
#

echo
echo "============================================================"
echo "  Museum OLED Display - Docker Launcher"
echo "============================================================"
echo

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "[error] Docker is not running."
    echo
    echo "  Please start Docker Desktop first, then run this again."
    echo "  Download: https://www.docker.com/products/docker-desktop/"
    echo
    exit 1
fi

echo "[ok] Docker is running."
echo "[ok] Building and starting the museum display..."
echo

docker compose up --build
