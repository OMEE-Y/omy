
#!/usr/bin/env bash
set -Eeuo pipefail

REPO="https://github.com/omee-y/omy.git"
INSTALL_DIR="$HOME/.omy"

echo ""
echo "  OMY AI Agent Installer"
echo "  ======================"

# Dependencies
for cmd in git node npm; do
    command -v "$cmd" >/dev/null 2>&1 || {
        echo "Error: $cmd is required."
        exit 1
    }
done

# Node 22+
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")

if [ "$NODE_MAJOR" -lt 22 ]; then
    echo "Error: Node.js 22+ required."
    exit 1
fi

# Clone or update
if [ -d "$INSTALL_DIR/.git" ]; then
    echo "Updating OMY..."
    git -C "$INSTALL_DIR" pull --ff-only origin main
elif [ -e "$INSTALL_DIR" ]; then
    echo "Error: $INSTALL_DIR already exists and is not a Git repository."
    exit 1
else
    echo "Downloading OMY..."
    git clone --branch main "$REPO" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# Install and build
echo "Installing dependencies..."
npm ci

echo "Building OMY..."
npm run build

# Global command
echo "Registering OMY..."
npm link

# Setup
echo ""
if [ -r /dev/tty ]; then
    echo "Starting OMY setup..."
    node dist/index.js setup </dev/tty || {
        echo "Setup skipped. Run 'omy setup' later."
    }
else
    echo "Run 'omy setup' after installation."
fi

echo ""
echo "OMY installed successfully!"

if command -v omy >/dev/null 2>&1; then
    echo "Run: omy --help"
else
    echo "Restart your terminal or check your npm global PATH."
fi
