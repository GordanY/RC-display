#!/bin/bash
#
# Museum OLED Display — Setup & Launch
# Run: ./start.sh
#

set -e

echo
echo "============================================================"
echo "  Museum OLED Display — Setup"
echo "============================================================"
echo

# Find Python 3
PYTHON_CMD=""
if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
elif command -v python &>/dev/null; then
    # Verify it's Python 3
    PY_VER=$(python --version 2>&1 | grep -o "3\." || true)
    if [ -n "$PY_VER" ]; then
        PYTHON_CMD="python"
    fi
fi

if [ -z "$PYTHON_CMD" ]; then
    echo "[setup] Python 3 not found. Attempting to install..."
    echo

    # macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if command -v brew &>/dev/null; then
            echo "[setup] Installing Python via Homebrew..."
            brew install python3
            PYTHON_CMD="python3"
        else
            echo "============================================================"
            echo "  Python 3 is not installed."
            echo
            echo "  Install via Homebrew:"
            echo "    /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            echo "    brew install python3"
            echo
            echo "  Or download from: https://www.python.org/downloads/"
            echo "============================================================"
            read -p "Press Enter to exit..."
            exit 1
        fi
    # Linux
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command -v apt-get &>/dev/null; then
            echo "[setup] Installing Python via apt..."
            sudo apt-get update && sudo apt-get install -y python3 python3-venv
            PYTHON_CMD="python3"
        elif command -v dnf &>/dev/null; then
            echo "[setup] Installing Python via dnf..."
            sudo dnf install -y python3
            PYTHON_CMD="python3"
        else
            echo "============================================================"
            echo "  Python 3 is not installed."
            echo "  Please install it using your package manager."
            echo "============================================================"
            read -p "Press Enter to exit..."
            exit 1
        fi
    fi
fi

echo "[ok] Using: $PYTHON_CMD ($($PYTHON_CMD --version 2>&1))"
echo

# Run the Python launcher
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
$PYTHON_CMD "$SCRIPT_DIR/start.py"
