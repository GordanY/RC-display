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
import re
import shutil
import webbrowser
import threading
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DEFAULT_PORT = 8080
PORT_SEARCH_RANGE = 20
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
# MTL path normalization — mirrors src/admin/mtlParse.ts:normalizeMtlText.
# Rewrites map_Kd values to bare basenames so obj2gltf finds JPEGs that the
# admin uploaded flat into the artifact directory. Preserves option flags
# (-clamp, -mm, -s …) by treating only the trailing token as the filename.
# Saves the original to <name>.mtl.original on the first rewrite.
# ---------------------------------------------------------------------------
MAP_KD_LINE_RE = re.compile(
    r"^([ \t]*map_Kd\s+(?:.*\s)?)(\S+)([ \t]*)$",
    re.IGNORECASE | re.MULTILINE,
)


def normalize_mtl_text(text):
    """Returns (new_text, changed)."""
    changed = [False]

    def _sub(match):
        prefix, file, trail = match.group(1), match.group(2), match.group(3)
        base = file.rsplit("/", 1)[-1] if "/" in file else file
        if base != file:
            changed[0] = True
        return prefix + base + trail

    new_text = MAP_KD_LINE_RE.sub(_sub, text)
    return new_text, changed[0]


def normalize_mtls_in_dir(dir_abs):
    """Normalize every .mtl in dir_abs in place. Returns list of changed names."""
    changed_names = []
    try:
        entries = os.listdir(dir_abs)
    except OSError:
        return changed_names
    for name in entries:
        if not name.lower().endswith(".mtl"):
            continue
        mtl_path = os.path.join(dir_abs, name)
        if not os.path.isfile(mtl_path):
            continue
        with open(mtl_path, "r", encoding="utf-8") as f:
            original = f.read()
        new_text, did_change = normalize_mtl_text(original)
        if not did_change:
            continue
        backup = mtl_path + ".original"
        if not os.path.exists(backup):
            with open(backup, "w", encoding="utf-8") as f:
                f.write(original)
        with open(mtl_path, "w", encoding="utf-8") as f:
            f.write(new_text)
        changed_names.append(name)
    return changed_names


# ---------------------------------------------------------------------------
# Network + port helpers
# ---------------------------------------------------------------------------
def has_internet(timeout=3):
    """True if we can open a TCP connection to a well-known DNS server."""
    import socket
    for host in ("1.1.1.1", "8.8.8.8"):
        try:
            with socket.create_connection((host, 53), timeout=timeout):
                return True
        except OSError:
            continue
    return False


def warn_if_offline(reason):
    """Print a prominent warning when we're about to do something that needs internet."""
    if has_internet():
        return
    log.warning("")
    log.warning("=" * 60)
    log.warning(f"  [warn] No internet connection detected.")
    log.warning(f"  Needed for: {reason}")
    log.warning(f"  Connect to the internet and re-run if this step fails.")
    log.warning("=" * 60)
    log.warning("")


def find_available_port(start=DEFAULT_PORT, attempts=PORT_SEARCH_RANGE):
    """Return the first bindable port starting at `start`, or None if none free."""
    import socket
    for port in range(start, start + attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((HOST, port))
                return port
            except OSError:
                continue
    return None


# ---------------------------------------------------------------------------
# Build staleness detection
# ---------------------------------------------------------------------------
def should_rebuild_frontend():
    """True if dist/ is missing or any watched source is newer than dist/index.html."""
    dist_index = DIST_DIR / "index.html"
    if not dist_index.exists():
        return True
    try:
        dist_mtime = dist_index.stat().st_mtime
    except OSError:
        return True

    watched = [
        BASE_DIR / "src",
        BASE_DIR / "index.html",
        BASE_DIR / "package.json",
        BASE_DIR / "package-lock.json",
        BASE_DIR / "vite.config.ts",
        BASE_DIR / "tailwind.config.js",
        BASE_DIR / "postcss.config.js",
        BASE_DIR / "tsconfig.json",
        BASE_DIR / "tsconfig.app.json",
    ]
    for path in watched:
        if not path.exists():
            continue
        try:
            if path.is_file():
                if path.stat().st_mtime > dist_mtime:
                    return True
            else:
                for f in path.rglob("*"):
                    if f.is_file() and f.stat().st_mtime > dist_mtime:
                        return True
        except OSError:
            continue
    return False


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

    # Install Flask + Flask-Compress if not present in the venv.
    # Flask-Compress gzip/brotli-compresses /artifacts/*.obj responses so the
    # kiosk downloads ~15–20% of the raw OBJ size on first view.
    needed = [
        ("flask", "flask"),
        ("flask_compress", "flask-compress"),
    ]
    missing = []
    for import_name, pkg_name in needed:
        result = subprocess.run(
            [str(venv_python), "-c", f"import {import_name}"],
            capture_output=True,
        )
        if result.returncode != 0:
            missing.append(pkg_name)

    if missing:
        warn_if_offline(f"installing {', '.join(missing)} via pip")
        log.info(f"[setup] Installing: {', '.join(missing)}...")
        # Invoke pip via `python -m pip` rather than the Scripts/pip.exe
        # launcher. Minimal or custom Python installs can produce venvs where
        # the launcher is missing even though the `pip` module is usable —
        # seen in the wild on a Windows 10 kiosk, raised FileNotFoundError
        # [WinError 2] when we called pip.exe directly.
        pip_cmd = [str(venv_python), "-m", "pip"]
        check = subprocess.run([*pip_cmd, "--version"], capture_output=True)
        if check.returncode != 0:
            # Bootstrap pip into the venv. Falls back gracefully on installs
            # that shipped without ensurepip (rare — embeddable distros).
            log.info("[setup] Bootstrapping pip via ensurepip...")
            subprocess.check_call([str(venv_python), "-m", "ensurepip", "--upgrade"])
        subprocess.check_call([*pip_cmd, "install", *missing])
        log.info("[setup] Python packages installed successfully.")
    else:
        log.info("[setup] Flask and Flask-Compress already installed.")

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
    """Run npm install + npm run build if dist/ is missing or stale."""
    if not should_rebuild_frontend():
        return

    if DIST_DIR.exists():
        log.info("[build] Source files changed since last build - rebuilding frontend...")
    else:
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

    # Warn once if offline — both npm install and npm run build download deps on first run
    warn_if_offline("running `npm install` to fetch frontend dependencies")

    # On Windows, npm is a .cmd script and needs shell=True
    use_shell = os.name == "nt"

    # npm install (always run to ensure platform-correct binaries)
    log.info("[build] Running npm install...")
    result = subprocess.run(
        ["npm", "install"], cwd=str(BASE_DIR), shell=use_shell,
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        log.error("[build] npm install failed!")
        if result.stdout:
            for line in result.stdout.strip().splitlines():
                log.error(f"  {line}")
        if result.stderr:
            for line in result.stderr.strip().splitlines():
                log.error(f"  {line}")
        pause_and_exit(1)
    log.info("[build] npm install complete.")

    # npm run build
    log.info("[build] Running npm run build...")
    result = subprocess.run(
        ["npm", "run", "build"], cwd=str(BASE_DIR), shell=use_shell,
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        log.error("[build] npm run build failed!")
        if result.stdout:
            for line in result.stdout.strip().splitlines():
                log.error(f"  {line}")
        if result.stderr:
            for line in result.stderr.strip().splitlines():
                log.error(f"  {line}")
        pause_and_exit(1)
    log.info("[build] Frontend built successfully.")
    log.info("")


# ---------------------------------------------------------------------------
# Check prerequisites
# ---------------------------------------------------------------------------
def check_prerequisites():
    ensure_frontend_built()

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    if not DATA_FILE.exists():
        log.info("[setup] No data.json found — creating empty manifest.")
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump({"exhibitTitle": "", "artifacts": []}, f, ensure_ascii=False, indent=2)


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
    import mimetypes
    from flask import Flask, request, jsonify, send_from_directory, send_file
    from flask_compress import Compress

    # .obj / .mtl have no registered mimetype on most systems, so Flask serves
    # them as application/octet-stream and Flask-Compress (which keys off
    # content-type) skips them. Forcing text/plain makes them compressible
    # without changing how browsers treat the bytes.
    mimetypes.add_type("text/plain", ".obj")
    mimetypes.add_type("text/plain", ".mtl")
    # Binary GLB is pre-packed — gzipping it wastes CPU for ~0% gain, so we
    # keep it OUT of COMPRESS_MIMETYPES below. Registering the correct type
    # lets browsers cache it under the right content-type.
    mimetypes.add_type("model/gltf-binary", ".glb")
    mimetypes.add_type("model/gltf+json", ".gltf")

    app = Flask(__name__, static_folder=None)

    # gzip/brotli everything text-like. The huge OBJ files are text, so this is
    # the single biggest win for cold-load time on 3D models.
    app.config["COMPRESS_MIMETYPES"] = [
        "text/html",
        "text/css",
        "text/xml",
        "text/plain",
        "application/json",
        "application/javascript",
        "application/xml",
        "image/svg+xml",
    ]
    app.config["COMPRESS_MIN_SIZE"] = 1024
    Compress(app)

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
        resp = send_from_directory(ARTIFACTS_DIR, filename)
        # data.json is mutable manifest data — must never be cached or the
        # kiosk serves stale content after a manual paste / admin edit.
        if filename == "data.json":
            resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            resp.headers["Pragma"] = "no-cache"
            resp.headers["Expires"] = "0"
        else:
            # Let browsers cache heavy models/textures for an hour but still
            # revalidate via ETag/Last-Modified so admin re-uploads propagate
            # (we can't use `immutable` since upload overwrites keep filenames).
            resp.headers["Cache-Control"] = "public, max-age=3600, must-revalidate"
        return resp

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
    def upload_files_route():
        # Match server/index.ts: accept `files` (multiple), convert any .obj to
        # a .glb sibling via tools/obj_to_glb.mjs, return { paths: [...] }
        # covering both the originals and the generated GLBs.
        uploaded = request.files.getlist("files")
        if not uploaded:
            return jsonify({"error": "No files uploaded"}), 400

        dest_path = request.form.get("path", "")
        dest_dir = ARTIFACTS_DIR / dest_path
        try:
            dest_dir.resolve().relative_to(ARTIFACTS_DIR.resolve())
        except ValueError:
            return jsonify({"error": "Path traversal not allowed"}), 403
        dest_dir.mkdir(parents=True, exist_ok=True)

        saved_rel = []
        for f in uploaded:
            base = os.path.basename(f.filename or "")
            if not base or ".." in base or "/" in base or "\\" in base:
                return jsonify({"error": f"Invalid filename: {f.filename}"}), 400
            save_path = dest_dir / base
            f.save(str(save_path))
            saved_rel.append(str(save_path.relative_to(ARTIFACTS_DIR)))

        # Normalize any MTL paths first so obj2gltf finds flat-uploaded JPEGs.
        # Runs even when no .obj is in this batch (e.g. MTL-only uploads).
        normalize_mtls_in_dir(str(dest_dir))

        # OBJ→GLB conversion. Mirrors server/index.ts: fail loud on error so
        # the admin UI surfaces it (a silently-broken GLB is worse for the
        # kiosk than an upload error the operator can react to).
        converted_rel = []
        obj_tool = BASE_DIR / "tools" / "obj_to_glb.mjs"
        for rel in list(saved_rel):
            if not rel.lower().endswith(".obj"):
                continue
            obj_path = ARTIFACTS_DIR / rel
            glb_path = obj_path.with_suffix(".glb")
            try:
                subprocess.run(
                    ["node", str(obj_tool), "--force", str(obj_path)],
                    capture_output=True,
                    text=True,
                    check=True,
                    cwd=str(BASE_DIR),
                )
            except (subprocess.CalledProcessError, FileNotFoundError) as e:
                # Best-effort cleanup of a partial .glb; swallow unlink errors.
                try:
                    if glb_path.exists():
                        glb_path.unlink()
                except Exception:
                    pass
                err_msg = ""
                if isinstance(e, subprocess.CalledProcessError):
                    err_msg = (e.stderr or e.stdout or "").strip() or str(e)
                else:
                    err_msg = f"node not available: {e}"
                return (
                    jsonify(
                        {"error": f"obj2gltf failed on {os.path.basename(rel)}: {err_msg}"}
                    ),
                    500,
                )
            if glb_path.exists():
                converted_rel.append(str(glb_path.relative_to(ARTIFACTS_DIR)))

        return jsonify({"paths": saved_rel + converted_rel})

    @app.route("/api/rebuild-glb", methods=["POST"])
    def rebuild_glb():
        # Mirrors server/index.ts: re-runs OBJ→GLB conversion against a
        # file already on disk, so the admin UI can rebuild the GLB after
        # MTL/JPEG sidecars are uploaded. Reuses tools/obj_to_glb.mjs, the
        # same external tool the upload route invokes.
        data = request.get_json() or {}
        rel = data.get("objPath", "")
        if not rel or not isinstance(rel, str):
            return jsonify({"error": "Invalid objPath"}), 400
        if not rel.lower().endswith(".obj"):
            return jsonify({"error": "objPath must end with .obj"}), 400

        obj_path = ARTIFACTS_DIR / rel
        try:
            resolved = obj_path.resolve()
            resolved.relative_to(ARTIFACTS_DIR.resolve())
        except ValueError:
            return jsonify({"error": "Path traversal not allowed"}), 403
        if resolved == ARTIFACTS_DIR.resolve():
            return jsonify({"error": "Invalid objPath"}), 400
        if not resolved.exists():
            return jsonify({"error": "OBJ not found on disk"}), 404

        normalize_mtls_in_dir(str(resolved.parent))

        glb_path = resolved.with_suffix(".glb")
        obj_tool = BASE_DIR / "tools" / "obj_to_glb.mjs"
        try:
            subprocess.run(
                ["node", str(obj_tool), "--force", str(resolved)],
                capture_output=True,
                text=True,
                check=True,
                cwd=str(BASE_DIR),
            )
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            err_msg = ""
            if isinstance(e, subprocess.CalledProcessError):
                err_msg = (e.stderr or e.stdout or "").strip() or str(e)
            else:
                err_msg = f"node not available: {e}"
            return (
                jsonify({"error": f"obj2gltf failed on {resolved.name}: {err_msg}"}),
                500,
            )

        return jsonify({"glbPath": str(glb_path.relative_to(ARTIFACTS_DIR))})

    @app.route("/api/list", methods=["GET"])
    def list_artifact_dir():
        # Mirrors server/index.ts: admin polls this to keep the "files present
        # on disk" indicator in sync. Returns { files: [] } for a missing dir
        # so a freshly-created artifact/creation can poll before upload.
        rel = request.args.get("path", "")
        if not rel:
            return jsonify({"error": "path required"}), 400
        target = ARTIFACTS_DIR / rel
        try:
            resolved = target.resolve()
            resolved.relative_to(ARTIFACTS_DIR.resolve())
        except ValueError:
            return jsonify({"error": "Invalid path"}), 400
        if resolved == ARTIFACTS_DIR.resolve():
            return jsonify({"error": "Invalid path"}), 400
        if not resolved.exists():
            return jsonify({"files": []})
        names = [e.name for e in resolved.iterdir() if e.is_file()]
        return jsonify({"files": names})

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

        # Cascade: deleting foo.obj also removes its generated foo.glb sibling.
        # Mirrors server/index.ts — GLB is derived, OBJ is the source of truth.
        if file_path.suffix.lower() == ".obj":
            glb_sibling = file_path.with_suffix(".glb")
            if glb_sibling.exists():
                glb_sibling.unlink()

        return jsonify({"ok": True})

    # --- Catch-all for SPA routing ---

    @app.route("/<path:path>")
    def catch_all(path):
        # Unknown /api/* must 404 — never fall through to index.html, or a
        # client fetch will see HTML-as-JSON and silently misbehave (this
        # exact drift hid the missing /api/list route for a release).
        if path.startswith("api/"):
            return jsonify({"error": "Not found"}), 404
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
def open_browser(port):
    import time

    time.sleep(1.5)
    url = f"http://localhost:{port}"
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

    port = find_available_port()
    if port is None:
        log.error("=" * 60)
        log.error(f"  ERROR: No free port in range {DEFAULT_PORT}-{DEFAULT_PORT + PORT_SEARCH_RANGE - 1}.")
        log.error("  Close other apps using these ports and try again.")
        log.error("=" * 60)
        pause_and_exit(1)
    if port != DEFAULT_PORT:
        log.info(f"[port] Port {DEFAULT_PORT} is in use — falling back to {port}.")

    log.info(f"[server] Serving frontend from: {DIST_DIR}")
    log.info(f"[server] Serving artifacts from: {ARTIFACTS_DIR}")
    log.info("")
    log.info(f"  Kiosk Display:  http://localhost:{port}/")
    log.info(f"  Admin Panel:    http://localhost:{port}/admin")
    log.info("")
    log.info("  Press Ctrl+C to stop the server.")
    log.info("=" * 60)
    log.info("")

    # Open browser in a background thread
    threading.Thread(target=open_browser, args=(port,), daemon=True).start()

    # Start Flask server
    app.run(host=HOST, port=port, debug=False)


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
