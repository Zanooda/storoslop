#!/bin/sh
set -e

# storoslop Coding Agent Installer.
# Installs the GitHub release binary for this platform/arch from
# Zanooda/storoslop. No npm account or Homebrew tap required.
# Usage: curl -fsSL https://raw.githubusercontent.com/Zanooda/storoslop/main/scripts/install.sh | sh
#
# Options:
#   --source       Install from source via bun (requires bun up to spec)
#   --ref <ref>    Install a specific release tag (e.g. v1.2.0)
#   -r <ref>       Shorthand for --ref

REPO="Zanooda/storoslop"
INSTALL_DIR="${PI_INSTALL_DIR:-$HOME/.local/bin}"
APP_NAME="storoslop"

# Parse arguments
MODE=""
REF=""
while [ $# -gt 0 ]; do
    case "$1" in
        --source)
            MODE="source"
            shift
            ;;
        --ref)
            shift
            if [ -z "$1" ]; then
                echo "Missing value for --ref"
                exit 1
            fi
            REF="$1"
            shift
            ;;
        --ref=*)
            REF="${1#*=}"
            if [ -z "$REF" ]; then
                echo "Missing value for --ref"
                exit 1
            fi
            shift
            ;;
        -r)
            shift
            if [ -z "$1" ]; then
                echo "Missing value for -r"
                exit 1
            fi
            REF="$1"
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

: "${MODE:=binary}"

# Normalized host architecture (x64|arm64). On macOS this uses
# `sysctl hw.optional.arm64` so it stays correct inside a Rosetta session,
# where `uname -m` reports the translated x86_64.
host_arch() {
    if [ "$(uname -s)" = "Darwin" ]; then
        if [ "$(sysctl -in hw.optional.arm64 2>/dev/null || /usr/sbin/sysctl -in hw.optional.arm64 2>/dev/null)" = "1" ]; then
            echo "arm64"
        else
            echo "x64"
        fi
        return
    fi
    case "$(uname -m)" in
        x86_64|amd64)  echo "x64" ;;
        arm64|aarch64) echo "arm64" ;;
        *)             uname -m ;;
    esac
}

# Install the storoslop release binary from GitHub.
install_binary() {
    # Detect platform
    OS="$(uname -s)"
    ARCH="$(host_arch)"

    case "$OS" in
        Linux)  PLATFORM="linux" ;;
        Darwin) PLATFORM="darwin" ;;
        *)      echo "Unsupported OS: $OS"; exit 1 ;;
    esac

    case "$ARCH" in
        x64|arm64) ;;
        *)         echo "Unsupported architecture: $ARCH"; exit 1 ;;
    esac

    if [ "$PLATFORM" = "linux" ]; then
        if [ -f /etc/alpine-release ] || { command -v ldd >/dev/null 2>&1 && ldd --version 2>&1 | grep -qi musl; }; then
            PLATFORM="linux-musl"
        fi
    fi

    BINARY="${APP_NAME}-${PLATFORM}-${ARCH}"
    # Get release tag
    if [ -n "$REF" ]; then
        echo "Fetching release $REF..."
        if RELEASE_JSON=$(curl -fsSL --connect-timeout 10 --max-time 60 "https://api.github.com/repos/${REPO}/releases/tags/${REF}"); then
            LATEST=$(echo "$RELEASE_JSON" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
        else
            echo "Release tag not found: $REF"
            exit 1
        fi
    else
        echo "Fetching latest release..."
        RELEASE_JSON=$(curl -fsSL --connect-timeout 10 --max-time 60 "https://api.github.com/repos/${REPO}/releases/latest")
        LATEST=$(echo "$RELEASE_JSON" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
    fi

    if [ -z "$LATEST" ]; then
        echo "Failed to fetch release tag"
        exit 1
    fi
    echo "Using version: $LATEST"

    mkdir -p "$INSTALL_DIR"
    # Download binary
    BINARY_URL="https://github.com/${REPO}/releases/download/${LATEST}/${BINARY}"
    echo "Downloading ${BINARY}..."
    curl -fsSL --connect-timeout 10 --speed-limit 1024 --speed-time 30 "$BINARY_URL" -o "${INSTALL_DIR}/${APP_NAME}"
    chmod +x "${INSTALL_DIR}/${APP_NAME}"

    # Verify the freshly installed binary can actually start before reporting
    # success. Bun's musl-target binaries link libstdc++/libgcc dynamically,
    # which stock Alpine/musl systems do not ship, so the download succeeds while
    # the binary exits 127 with relocation errors. Never claim success for a
    # binary that cannot run.
    if ! SMOKE_OUTPUT="$("${INSTALL_DIR}/${APP_NAME}" --version 2>&1)"; then
        echo ""
        echo "✗ ${APP_NAME} was downloaded to ${INSTALL_DIR}/${APP_NAME} but cannot start:"
        echo "$SMOKE_OUTPUT" | sed 's/^/    /'
        if [ "$PLATFORM" = "linux-musl" ]; then
            echo ""
            echo "The musl build links libstdc++/libgcc dynamically. Install them, then re-run '${APP_NAME}':"
            if command -v apk >/dev/null 2>&1; then
                echo "    apk add libstdc++ libgcc"
            else
                echo "    (install the libstdc++/libgcc libraries)"
            fi
        fi
        exit 1
    fi

    echo ""
    echo "✓ Installed ${APP_NAME} to ${INSTALL_DIR}/${APP_NAME}"
    echo "Make sure ${INSTALL_DIR} is on your PATH."
}

case "$MODE" in
    binary)
        install_binary
        ;;
    source)
        echo "Installing from source..."
        if [ -z "$REF" ]; then
            REF="main"
        fi
        TMP_DIR="$(mktemp -d)"
        trap 'rm -rf "$TMP_DIR"' EXIT
        git clone --depth 1 --branch "$REF" "https://github.com/${REPO}.git" "$TMP_DIR" >/dev/null 2>&1 || {
            echo "Failed to clone ${REPO}@${REF}"
            exit 1
        }
        if [ ! -d "$TMP_DIR/packages/coding-agent" ]; then
            echo "Expected package at ${TMP_DIR}/packages/coding-agent"
            exit 1
        fi
        (cd "$TMP_DIR" && bun install && bun run build) || {
            echo "Failed to build from source"
            exit 1
        }
        cp "$TMP_DIR/packages/coding-agent/dist/storoslop" "${INSTALL_DIR}/${APP_NAME}"
        chmod +x "${INSTALL_DIR}/${APP_NAME}"
        echo ""
        echo "✓ Installed ${APP_NAME} (from source) to ${INSTALL_DIR}/${APP_NAME}"
        ;;
    *)
        echo "Unknown mode: $MODE"
        exit 1
        ;;
esac
