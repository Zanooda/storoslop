# storoslop Coding Agent Installer for Windows.
# Installs the GitHub release binary for this platform/arch from
# Zanooda/storoslop. No npm account or Homebrew tap required.
# Usage: irm https://raw.githubusercontent.com/Zanooda/storoslop/main/scripts/install.ps1 | iex
#
# Or with options:
#   & ([scriptblock]::Create((irm https://raw.githubusercontent.com/Zanooda/storoslop/main/scripts/install.ps1))) -Binary
#   & ([scriptblock]::Create((irm https://raw.githubusercontent.com/Zanooda/storoslop/main/scripts/install.ps1))) -Source -Ref main

param(
    [switch]$Source,
    [switch]$Binary,
    [string]$Ref
)

$ErrorActionPreference = "Stop"

$Repo = "Zanooda/storoslop"
$InstallDir = if ($env:PI_INSTALL_DIR) { $env:PI_INSTALL_DIR } else { "$env:LOCALAPPDATA\storoslop" }
$BinaryName = "storoslop-windows-x64.exe"

function Install-Binary {
    if ($Ref) {
        Write-Host "Fetching release $Ref..."
        try {
            $Release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/tags/$Ref" -TimeoutSec 60
        } catch {
            throw "Release tag not found: $Ref"
        }
    } else {
        Write-Host "Fetching latest release..."
        $Release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -TimeoutSec 60
    }

    $Latest = $Release.tag_name
    if (-not $Latest) {
        throw "Failed to fetch release tag"
    }
    Write-Host "Using version: $Latest"

    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

    # Download binary
    $BinaryUrl = "https://github.com/$Repo/releases/download/$Latest/$BinaryName"
    Write-Host "Downloading $BinaryName..."
    $OutPath = Join-Path $InstallDir "storoslop.exe"
    Invoke-WebRequest -Uri $BinaryUrl -OutFile $OutPath -TimeoutSec 900

    Write-Host ""
    Write-Host "[OK] Installed storoslop to $OutPath" -ForegroundColor Green

    # Add to PATH if not already there
    $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $needsRestart = $UserPath -notlike "*$InstallDir*"
    if ($needsRestart) {
        Write-Host "Adding $InstallDir to PATH..."
        [Environment]::SetEnvironmentVariable("Path", "$UserPath;$InstallDir", "User")
    }

    if ($needsRestart) {
        Write-Host "Restart your terminal, then run 'storoslop' to get started!"
    } else {
        Write-Host "Run 'storoslop' to get started!"
    }
}

function Install-FromSource {
    Write-Host "Installing from source..."
    if (-not $Ref) { $Ref = "main" }
    $tmpRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("storoslop-install-" + [System.Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Force -Path $tmpRoot | Out-Null
    try {
        git clone --depth 1 --branch $Ref "https://github.com/$Repo.git" $tmpRoot | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to clone $Repo@$Ref"
        }
        $packagePath = Join-Path $tmpRoot "packages\coding-agent"
        if (-not (Test-Path $packagePath)) {
            throw "Expected package at $packagePath"
        }
        Push-Location $tmpRoot
        try {
            bun install
            if ($LASTEXITCODE -ne 0) { throw "bun install failed" }
            bun run build
            if ($LASTEXITCODE -ne 0) { throw "bun run build failed" }
        } finally {
            Pop-Location
        }
        New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
        $outPath = Join-Path $InstallDir "storoslop.exe"
        $src = Join-Path $packagePath "dist\storoslop"
        if (-not (Test-Path $src -PathType Leaf)) {
            $src = Join-Path $packagePath "dist\storoslop.exe"
        }
        Copy-Item $src $outPath -Force
        Write-Host ""
        Write-Host "[OK] Installed storoslop (from source) to $outPath" -ForegroundColor Green
    } finally {
        Remove-Item -Recurse -Force $tmpRoot -ErrorAction SilentlyContinue
    }
}

# Main logic: default to the GitHub release binary. Source is opt-in.
if ($Source) {
    Install-FromSource
} else {
    Install-Binary
}
