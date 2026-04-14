#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Museum OLED Display - One-Click Launcher
=========================================
Run this script to start the museum display application.

    python start.py

On first run, it will create a virtual environment and install Flask.
"""

import subprocess
import sys
import os

# Fix Windows console encoding - must be before any print()
if os.name == "nt":
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
import json
import shutil
import webbrowser
import threading
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PORT = 8080
HOST = "0.0.0.0"
BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = BASE_DIR / "dist"
ARTIFACTS_DIR = BASE_DIR / "public" / "artifacts"
DATA_FILE = ARTIFACTS_DIR / "data.json"
VENV_DIR = BASE_DIR / ".venv"


def pause_and_exit(code=1):
    """Pause so the user can read the message before the terminal closes."""
    print()
    input("Press Enter to exit...")
    sys.exit(code)


# ---------------------------------------------------------------------------
# Auto-create venv and install Flask if needed
# ---------------------------------------------------------------------------
def ensure_venv_and_flask():
    """Create a virtual environment, install Flask, and re-launch if needed."""
    if os.name == "nt":
        venv_python = VENV_DIR / "Scripts" / "python.exe"
    else:
        venv_python = VENV_DIR / "bin" / "python3"

    # If we're already running inside the venv, just return
    if VENV_DIR.exists() and Path(sys.executable).resolve() == venv_python.resolve():
        return

    # Create venv if it doesn't exist
    if not VENV_DIR.exists():
        print("[setup] Creating virtual environment...")
        subprocess.check_call([sys.executable, "-m", "venv", str(VENV_DIR)])
        print("[setup] Virtual environment created at .venv/")

    # Install Flask if not present in the venv
    result = subprocess.run(
        [str(venv_python), "-c", "import flask"],
        capture_output=True,
    )
    if result.returncode != 0:
        print("[setup] Installing Flask...")
        if os.name == "nt":
            pip = VENV_DIR / "Scripts" / "pip.exe"
        else:
            pip = VENV_DIR / "bin" / "pip3"
        subprocess.check_call([str(pip), "install", "flask"])
        print("[setup] Flask installed successfully.")

    # Re-launch this script under the venv python
    print("[setup] Launching with virtual environment...")
    ret = subprocess.call([str(venv_python), __file__] + sys.argv[1:])
    if ret != 0:
        print()
        print(f"[error] Script exited with code {ret}")
        pause_and_exit(ret)
    sys.exit(0)


# ---------------------------------------------------------------------------
# Auto-install Node.js if needed
# ---------------------------------------------------------------------------
def ensure_node():
    """Check if Node.js/npm is available, install if not."""
    if shutil.which("npm"):
        return

    print("[setup] Node.js/npm not found. Attempting to install...")

    if os.name == "nt":
        # Windows - try winget
        if shutil.which("winget"):
            print("[setup] Installing Node.js via winget...")
            subprocess.call(
                ["winget", "install", "OpenJS.NodeJS.LTS",
                 "--accept-package-agreements", "--accept-source-agreements"]
            )
            # winget installs to a new PATH entry - refresh by reading from registry
            # User may need to restart the script for PATH to take effect
            if not shutil.which("npm"):
                print()
                print("=" * 60)
                print("  Node.js was installed but 'npm' is not yet in PATH.")
                print("  Please close this window and re-run start.bat")
                print("=" * 60)
                pause_and_exit(1)
        else:
            print()
            print("=" * 60)
            print("  Node.js is not installed and winget is not available.")
            print()
            print("  Please install Node.js manually:")
            print("    https://nodejs.org/")
            print("  Then re-run this script.")
            print("=" * 60)
            pause_and_exit(1)
    else:
        # macOS / Linux
        if shutil.which("brew"):
            print("[setup] Installing Node.js via Homebrew...")
            subprocess.check_call(["brew", "install", "node"])
        elif shutil.which("apt-get"):
            print("[setup] Installing Node.js via apt...")
            subprocess.check_call(["sudo", "apt-get", "update"])
            subprocess.check_call(["sudo", "apt-get", "install", "-y", "nodejs", "npm"])
        elif shutil.which("dnf"):
            print("[setup] Installing Node.js via dnf...")
            subprocess.check_call(["sudo", "dnf", "install", "-y", "nodejs", "npm"])
        else:
            print()
            print("=" * 60)
            print("  Node.js is not installed.")
            print("  Please install it from: https://nodejs.org/")
            print("  Then re-run this script.")
            print("=" * 60)
            pause_and_exit(1)

    if shutil.which("npm"):
        print("[setup] Node.js installed successfully.")
    else:
        print("[error] npm still not found after install attempt.")
        pause_and_exit(1)


# ---------------------------------------------------------------------------
# Build frontend if dist/ is missing
# ---------------------------------------------------------------------------
def ensure_frontend_built():
    """Run npm install + npm run build if dist/ doesn't exist."""
    if DIST_DIR.exists():
        return

    print("[build] 'dist/' not found - building frontend...")
    print()

    # Check if package.json exists (are we in the full project?)
    package_json = BASE_DIR / "package.json"
    if not package_json.exists():
        print("=" * 60)
        print("ERROR: 'package.json' not found.")
        print()
        print("This folder is missing the project source code.")
        print("Copy the entire RC-display project folder, not just")
        print("start.py, to this PC.")
        print("=" * 60)
        pause_and_exit(1)

    # Ensure Node.js is available
    ensure_node()

    # On Windows, npm is a .cmd script and needs shell=True
    use_shell = os.name == "nt"

    # npm install
    node_modules = BASE_DIR / "node_modules"
    if not node_modules.exists():
        print("[build] Running npm install...")
        subprocess.check_call(["npm", "install"], cwd=str(BASE_DIR), shell=use_shell)
        print("[build] npm install complete.")
    else:
        print("[build] node_modules/ exists, skipping npm install.")

    # npm run build
    print("[build] Running npm run build...")
    subprocess.check_call(["npm", "run", "build"], cwd=str(BASE_DIR), shell=use_shell)
    print("[build] Frontend built successfully.")
    print()


# ---------------------------------------------------------------------------
# Check prerequisites
# ---------------------------------------------------------------------------
def check_prerequisites():
    ensure_frontend_built()

    if not DATA_FILE.exists():
        print("=" * 60)
        print("ERROR: 'public/artifacts/data.json' not found.")
        print()
        print("Make sure the 'public/artifacts/' directory exists")
        print("with at least a data.json file.")
        print("=" * 60)
        pause_and_exit(1)


# ---------------------------------------------------------------------------
# Flask application
# ---------------------------------------------------------------------------
def create_app():
    from flask import Flask, request, jsonify, send_from_directory, send_file

    app = Flask(__name__, static_folder=None)

    # --- Serve built frontend (dist/) ---

    @app.route("/")
    @app.route("/admin")
    @app.route("/admin/")
    def serve_index():
        return send_file(DIST_DIR / "index.html")

    @app.route("/assets/<path:filename>")
    def serve_assets(filename):
        return send_from_directory(DIST_DIR / "assets", filename)

    # --- Serve artifact files (photos, videos, 3D models) ---

    @app.route("/artifacts/<path:filename>")
    def serve_artifacts(filename):
        return send_from_directory(ARTIFACTS_DIR, filename)

    # --- Admin API ---

    @app.route("/api/data", methods=["GET"])
    def get_data():
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return jsonify(data)

    @app.route("/api/data", methods=["PUT"])
    def put_data():
        data = request.get_json()
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return jsonify({"ok": True})

    @app.route("/api/upload", methods=["POST"])
    def upload_file():
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]
        dest_path = request.form.get("path", "")

        dest_dir = ARTIFACTS_DIR / dest_path
        # Security: ensure dest is within ARTIFACTS_DIR
        try:
            dest_dir.resolve().relative_to(ARTIFACTS_DIR.resolve())
        except ValueError:
            return jsonify({"error": "Path traversal not allowed"}), 403

        dest_dir.mkdir(parents=True, exist_ok=True)
        save_path = dest_dir / file.filename
        file.save(str(save_path))

        relative_path = save_path.relative_to(ARTIFACTS_DIR)
        return jsonify({"path": str(relative_path)})

    @app.route("/api/files", methods=["DELETE"])
    def delete_files():
        data = request.get_json()
        file_path = ARTIFACTS_DIR / data.get("path", "")

        # Security: ensure path is within ARTIFACTS_DIR
        try:
            file_path.resolve().relative_to(ARTIFACTS_DIR.resolve())
        except ValueError:
            return jsonify({"error": "Path traversal not allowed"}), 403

        if file_path.exists():
            if file_path.is_dir():
                shutil.rmtree(file_path)
            else:
                file_path.unlink()

        return jsonify({"ok": True})

    # --- Catch-all for SPA routing ---

    @app.route("/<path:path>")
    def catch_all(path):
        # Try dist/ first (static assets like favicon, etc.)
        file_path = DIST_DIR / path
        if file_path.is_file():
            return send_file(file_path)
        # Fall back to index.html for SPA client-side routing
        return send_file(DIST_DIR / "index.html")

    return app


# ---------------------------------------------------------------------------
# Open browser after short delay
# ---------------------------------------------------------------------------
def open_browser():
    import time
    time.sleep(1.5)
    url = f"http://localhost:{PORT}"
    print(f"[browser] Opening {url}")
    webbrowser.open(url)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    docker_mode = "--docker" in sys.argv

    print()
    print("=" * 60)
    print("  Museum OLED Display - Starting...")
    print("=" * 60)
    print()

    if not docker_mode:
        # Local mode: handle venv, npm, etc.
        ensure_venv_and_flask()
        check_prerequisites()
    else:
        # Docker mode: just check data file exists
        if not DATA_FILE.exists():
            print("[warning] data.json not found, creating empty one...")
            ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
            with open(DATA_FILE, "w", encoding="utf-8") as f:
                json.dump({"artifacts": []}, f)

    app = create_app()

    print(f"[server] Serving frontend from: {DIST_DIR}")
    print(f"[server] Serving artifacts from: {ARTIFACTS_DIR}")
    print()
    print(f"  Kiosk Display:  http://localhost:{PORT}/")
    print(f"  Admin Panel:    http://localhost:{PORT}/admin")
    print()
    print("  Press Ctrl+C to stop the server.")
    print("=" * 60)
    print()

    if not docker_mode:
        # Open browser in a background thread (not in Docker)
        threading.Thread(target=open_browser, daemon=True).start()

    # Start Flask server
    app.run(host=HOST, port=PORT, debug=False)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[server] Stopped.")
    except Exception as e:
        print()
        print("=" * 60)
        print(f"ERROR: {e}")
        print("=" * 60)
        import traceback
        traceback.print_exc()
        pause_and_exit(1)
