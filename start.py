#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Museum OLED Display - One-Click Launcher
=========================================
Run this script to start the museum display application.

    python start.py
    python start.py --log-file logs/start.log

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

import argparse
import json
import logging
import shutil
import webbrowser
import threading
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PORT = 8080
HOST = "127.0.0.1"
BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = BASE_DIR / "dist"
ARTIFACTS_DIR = BASE_DIR / "public" / "artifacts"
DATA_FILE = ARTIFACTS_DIR / "data.json"
VENV_DIR = BASE_DIR / ".venv"

# Module-level logger and log file path
log = logging.getLogger("museum")
LOG_FILE_PATH = None


# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
def parse_args():
    parser = argparse.ArgumentParser(description="Museum OLED Display Launcher")
    parser.add_argument(
        "--log-file",
        type=str,
        default=None,
        help="Path to log file (created by start.bat/start.sh)",
    )
    return parser.parse_args()


# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------
def setup_logging(log_path=None):
    """Configure dual logging: console (clean) + file (timestamped)."""
    global LOG_FILE_PATH

    if log_path is None:
        logs_dir = BASE_DIR / "logs"
        logs_dir.mkdir(exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_path = logs_dir / f"start_{timestamp}.log"

    log_path = Path(log_path)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    LOG_FILE_PATH = log_path

    log.setLevel(logging.DEBUG)

    # Console handler — clean output matching existing style
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(logging.INFO)
    console.setFormatter(logging.Formatter("%(message)s"))
    log.addHandler(console)

    # File handler — append mode (start.bat may have already written to this file)
    fh = logging.FileHandler(str(log_path), mode="a", encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    log.addHandler(fh)

    log.info(f"[log] Logging to: {log_path}")

    # Clean up old log files (keep last 10)
    cleanup_old_logs(log_path.parent)

    return log_path


def cleanup_old_logs(logs_dir):
    """Keep only the 10 most recent log files."""
    log_files = sorted(logs_dir.glob("start_*.log"))
    for old_file in log_files[:-10]:
        try:
            old_file.unlink()
        except OSError:
            pass


def pause_and_exit(code=1):
    """Pause so the user can read the message before the terminal closes."""
    if LOG_FILE_PATH:
        print(f"\n  See log: {LOG_FILE_PATH}")
    print()
    input("Press Enter to exit...")
    sys.exit(code)


# ---------------------------------------------------------------------------
# Auto-create venv and install Flask if needed
# ---------------------------------------------------------------------------
def ensure_venv_and_flask():
    """Create a virtual environment, install Flask, and re-launch if needed."""
    log.debug(f"Python: {sys.executable}")
    log.debug(f"Project: {BASE_DIR}")

    if os.name == "nt":
        venv_python = VENV_DIR / "Scripts" / "python.exe"
    else:
        venv_python = VENV_DIR / "bin" / "python3"

    # If we're already running inside the venv, just return
    if VENV_DIR.exists() and Path(sys.executable).resolve() == venv_python.resolve():
        log.info("[setup] Already in virtual environment.")
        return

    # Create venv if it doesn't exist
    if not VENV_DIR.exists():
        log.info("[setup] Creating virtual environment...")
        subprocess.check_call([sys.executable, "-m", "venv", str(VENV_DIR)])
        log.info("[setup] Virtual environment created at .venv/")
    else:
        log.info("[setup] Virtual environment exists.")

    # Verify venv python exists
    if not venv_python.exists():
        log.error(f"[error] venv Python not found at: {venv_python}")
        log.info("[setup] Deleting broken venv and retrying...")
        shutil.rmtree(VENV_DIR, ignore_errors=True)
        subprocess.check_call([sys.executable, "-m", "venv", str(VENV_DIR)])
        if not venv_python.exists():
            log.error("[error] Still not found. Python may not support venv.")
            pause_and_exit(1)

    # Install Flask if not present in the venv
    result = subprocess.run(
        [str(venv_python), "-c", "import flask"],
        capture_output=True,
    )
    if result.returncode != 0:
        log.info("[setup] Installing Flask...")
        if os.name == "nt":
            pip = VENV_DIR / "Scripts" / "pip.exe"
        else:
            pip = VENV_DIR / "bin" / "pip3"
        subprocess.check_call([str(pip), "install", "flask"])
        log.info("[setup] Flask installed successfully.")
    else:
        log.info("[setup] Flask already installed.")

    # Re-launch this script under the venv python
    log.info(f"[setup] Re-launching with: {venv_python}")
    relaunch_args = [str(venv_python), __file__] + sys.argv[1:]
    if "--log-file" not in sys.argv and LOG_FILE_PATH:
        relaunch_args.extend(["--log-file", str(LOG_FILE_PATH)])
    ret = subprocess.call(relaunch_args)
    if ret != 0:
        log.error(f"[error] Script exited with code {ret}")
        pause_and_exit(ret)
    sys.exit(0)


# ---------------------------------------------------------------------------
# Auto-install Node.js if needed
# ---------------------------------------------------------------------------
def ensure_node():
    """Check if Node.js/npm is available, install if not."""
    if shutil.which("npm"):
        return

    log.info("[setup] Node.js/npm not found. Attempting to install...")

    if os.name == "nt":
        # On Windows, start.bat should have already set up Node.js
        # via PATH detection or bundled zip extraction.
        # If we still can't find npm, something went wrong.
        log.error("")
        log.error("=" * 60)
        log.error("  Node.js/npm is not available.")
        log.error("")
        log.error("  If running directly (not via start.bat), please either:")
        log.error("    1. Run start.bat instead (recommended)")
        log.error("    2. Install Node.js from https://nodejs.org/")
        log.error("=" * 60)
        pause_and_exit(1)
    else:
        # macOS / Linux
        if shutil.which("brew"):
            log.info("[setup] Installing Node.js via Homebrew...")
            subprocess.check_call(["brew", "install", "node"])
        elif shutil.which("apt-get"):
            log.info("[setup] Installing Node.js via apt...")
            subprocess.check_call(["sudo", "apt-get", "update"])
            subprocess.check_call(
                ["sudo", "apt-get", "install", "-y", "nodejs", "npm"]
            )
        elif shutil.which("dnf"):
            log.info("[setup] Installing Node.js via dnf...")
            subprocess.check_call(["sudo", "dnf", "install", "-y", "nodejs", "npm"])
        else:
            log.error("")
            log.error("=" * 60)
            log.error("  Node.js is not installed.")
            log.error("  Please install it from: https://nodejs.org/")
            log.error("  Then re-run this script.")
            log.error("=" * 60)
            pause_and_exit(1)

    if shutil.which("npm"):
        log.info("[setup] Node.js installed successfully.")
    else:
        log.error("[error] npm still not found after install attempt.")
        pause_and_exit(1)


# ---------------------------------------------------------------------------
# Build frontend if dist/ is missing
# ---------------------------------------------------------------------------
def ensure_frontend_built():
    """Run npm install + npm run build if dist/ doesn't exist."""
    if DIST_DIR.exists():
        return

    log.info("[build] 'dist/' not found - building frontend...")
    log.info("")

    # Check if package.json exists (are we in the full project?)
    package_json = BASE_DIR / "package.json"
    if not package_json.exists():
        log.error("=" * 60)
        log.error("ERROR: 'package.json' not found.")
        log.error("")
        log.error("This folder is missing the project source code.")
        log.error("Copy the entire RC-display project folder, not just")
        log.error("start.py, to this PC.")
        log.error("=" * 60)
        pause_and_exit(1)

    # Ensure Node.js is available
    ensure_node()

    # On Windows, npm is a .cmd script and needs shell=True
    use_shell = os.name == "nt"

    # npm install
    node_modules = BASE_DIR / "node_modules"
    if not node_modules.exists():
        log.info("[build] Running npm install...")
        subprocess.check_call(["npm", "install"], cwd=str(BASE_DIR), shell=use_shell)
        log.info("[build] npm install complete.")
    else:
        log.info("[build] node_modules/ exists, skipping npm install.")

    # npm run build
    log.info("[build] Running npm run build...")
    subprocess.check_call(["npm", "run", "build"], cwd=str(BASE_DIR), shell=use_shell)
    log.info("[build] Frontend built successfully.")
    log.info("")


# ---------------------------------------------------------------------------
# Check prerequisites
# ---------------------------------------------------------------------------
def check_prerequisites():
    ensure_frontend_built()

    if not DATA_FILE.exists():
        log.error("=" * 60)
        log.error("ERROR: 'public/artifacts/data.json' not found.")
        log.error("")
        log.error("Make sure the 'public/artifacts/' directory exists")
        log.error("with at least a data.json file.")
        log.error("=" * 60)
        pause_and_exit(1)


# ---------------------------------------------------------------------------
# Pre-flight summary
# ---------------------------------------------------------------------------
def print_preflight_summary():
    """Display a summary of all checked dependencies."""
    log.info("")
    log.info("=" * 60)
    log.info("  Pre-flight Check")
    log.info("=" * 60)

    # Python version
    py_ver = sys.version.split()[0]
    log.info(f"  Python ............. {py_ver:<20s} [ok]")

    # Venv
    log.info(f"  Virtual env ........ .venv/{'':<15s} [ok]")

    # Flask version
    try:
        import flask

        flask_ver = flask.__version__
    except ImportError:
        flask_ver = "missing"
    log.info(f"  Flask .............. {flask_ver:<20s} [ok]")

    # Node.js version
    try:
        use_shell = os.name == "nt"
        node_ver = (
            subprocess.check_output(
                ["node", "--version"], stderr=subprocess.DEVNULL, shell=use_shell
            )
            .decode()
            .strip()
        )
    except Exception:
        node_ver = "bundled"
    log.info(f"  Node.js ............ {node_ver:<20s} [ok]")

    # Frontend
    log.info(f"  Frontend ........... dist/{'':<16s} [ok]")

    # data.json
    log.info(f"  data.json .......... found{'':<15s} [ok]")

    log.info("=" * 60)
    log.info("")


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
    log.info(f"[browser] Opening {url}")
    webbrowser.open(url)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    args = parse_args()
    setup_logging(args.log_file)

    log.info("")
    log.info("=" * 60)
    log.info("  Museum OLED Display - Starting...")
    log.info("=" * 60)
    log.info("")

    # Handle venv, npm, etc.
    ensure_venv_and_flask()
    check_prerequisites()

    # Show pre-flight summary
    print_preflight_summary()

    app = create_app()

    log.info(f"[server] Serving frontend from: {DIST_DIR}")
    log.info(f"[server] Serving artifacts from: {ARTIFACTS_DIR}")
    log.info("")
    log.info(f"  Kiosk Display:  http://localhost:{PORT}/")
    log.info(f"  Admin Panel:    http://localhost:{PORT}/admin")
    log.info("")
    log.info("  Press Ctrl+C to stop the server.")
    log.info("=" * 60)
    log.info("")

    # Open browser in a background thread
    threading.Thread(target=open_browser, daemon=True).start()

    # Start Flask server
    app.run(host=HOST, port=PORT, debug=False)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log.info("\n[server] Stopped.")
    except Exception as e:
        log.error("")
        log.error("=" * 60)
        log.error(f"ERROR: {e}")
        log.error("=" * 60)
        import traceback

        log.error(traceback.format_exc())
        if LOG_FILE_PATH:
            log.error(f"See log: {LOG_FILE_PATH}")
        pause_and_exit(1)
