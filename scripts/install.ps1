# storoslop Installer for Windows
# Usage: irm https://raw.githubusercontent.com/Zanooda/storoslop/main/scripts/install.ps1 | iex
#
# Or with options:
#   & ([scriptblock]::Create((irm https://raw.githubusercontent.com/Zanooda/storoslop/main/scripts/install.ps1))) -Source
#   & ([scriptblock]::Create((irm https://raw.githubusercontent.com/Zanooda/storoslop/main/scripts/install.ps1))) -Binary
#   & ([scriptblock]::Create((irm https://raw.githubusercontent.com/Zanooda/storoslop/main/scripts/install.ps1))) -Source -Ref v3.20.1
#   & ([scriptblock]::Create((irm https://raw.githubusercontent.com/Zanooda/storoslop/main/scripts/install.ps1))) -Source -Ref main
#   & ([scriptblock]::Create((irm https://raw.githubusercontent.com/Zanooda/storoslop/main/scripts/install.ps1))) -Binary -Ref v3.20.1

param(
    [switch]$Source,
    [switch]$Binary,
    [string]$Ref
)

$ErrorActionPreference = "Stop"

# Fail fast on hosts older than Windows PowerShell 5.1: cmdlets used below
# (e.g. Invoke-WebRequest -TimeoutSec) are missing or unreliable there and
# fail with cryptic errors halfway through the install. Anything newer,
# including PowerShell 7+, passes this check.
if ($PSVersionTable.PSVersion -lt [version]"5.1") {
    throw "Windows PowerShell 5.1 or newer is required (found $($PSVersionTable.PSVersion)). Install PowerShell 7 from https://aka.ms/powershell and re-run the installer."
}

$Repo = "Zanooda/storoslop"
$InstallDir = if ($env:PI_INSTALL_DIR) { $env:PI_INSTALL_DIR } else { "$env:LOCALAPPDATA\storoslop" }
# Windows PowerShell 5.1 (.NET Framework) does not reliably resolve
# [System.Runtime.InteropServices.RuntimeInformation] without an
# assembly-qualified name, while PowerShell 7+ (Core) loads that type from a
# different assembly — so read the OS architecture from the environment
# instead, which works on both. Prefer PROCESSOR_ARCHITEW6432 so a 32-bit
# host on 64-bit Windows still reports the OS architecture.
# Note: PROCESSOR_ARCHITEW6432 is only set for 32-bit (WOW64) processes, so
# x64 PowerShell under ARM64 emulation reports AMD64 and installs the x64
# binary (runs emulated, not natively). Native ARM64 and x86-on-ARM64 hosts
# still resolve to arm64.
$RawArchitecture = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
if (-not $RawArchitecture) {
    throw "Unable to determine Windows architecture"
}
$NativeArchitecture = switch ($RawArchitecture.ToUpperInvariant()) {
    "AMD64" { "x64" }
    "ARM64" { "arm64" }
    default { throw "Unsupported Windows architecture: $RawArchitecture" }
}
$BinaryName = "storoslop-windows-$NativeArchitecture.exe"
$MinimumBunVersion = "1.4.4"

# PowerShell 5.1 raises a terminating NativeCommandError for any line a native
# executable writes to stderr while $ErrorActionPreference is "Stop", regardless
# of the process exit code. Tools like bun and git emit normal progress on
# stderr, so run them with the preference relaxed to "Continue" and let callers
# gate on $LASTEXITCODE. Global "Stop" stays in effect for the cmdlet-driven
# operations (Invoke-WebRequest/Invoke-RestMethod) that depend on it.
function Invoke-Native {
    param([Parameter(Mandatory = $true)][scriptblock]$Command)
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $Command
    } finally {
        $ErrorActionPreference = $previous
    }
}

function Test-BunInstalled {
    try {
        $null = Get-Command bun -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

function Get-BunVersion {
    try {
        $versionText = (bun --version 2>$null)
        if (-not $versionText) {
            return $null
        }

        $clean = $versionText.Trim().Split("-")[0]
        return [version]$clean
    } catch {
        return $null
    }
}

function Test-BunVersion {
    param([string]$MinimumVersion)

    $currentVersion = Get-BunVersion
    if (-not $currentVersion) {
        return $false
    }

    return $currentVersion -ge [version]$MinimumVersion
}

function Assert-BunVersion {
    param([string]$MinimumVersion)

    if (-not (Test-BunVersion $MinimumVersion)) {
        $current = Get-BunVersion
        $currentText = if ($current) { $current.ToString() } else { "unknown" }
        throw "Bun $MinimumVersion or newer is required. Current version: $currentText. Upgrade Bun at https://bun.sh/docs/installation"
    }
}

function Test-GitInstalled {
    try {
        $null = Get-Command git -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

function Test-GitLfsInstalled {
    try {
        $null = Get-Command git-lfs -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

function Find-BashShell {
    # Check Git Bash first (most common on Windows)
    $gitBash = "C:\Program Files\Git\bin\bash.exe"
    if (Test-Path $gitBash) {
        return $gitBash
    }

    # Check bash.exe on PATH (Cygwin, MSYS2, WSL)
    try {
        $bashCmd = Get-Command bash.exe -ErrorAction Stop
        return $bashCmd.Source
    } catch {
        return $null
    }
}

function Configure-BashShell {
    try {
        $settingsDir = Join-Path $env:USERPROFILE ".storoslop\agent"
        $settingsFile = Join-Path $settingsDir "settings.json"

        # Check if settings.json already has a shellPath configured
        if (Test-Path $settingsFile) {
            try {
                $existingSettings = Get-Content $settingsFile -Raw | ConvertFrom-Json
                if ($existingSettings.shellPath) {
                    Write-Host "Bash shell already configured: $($existingSettings.shellPath)" -ForegroundColor Cyan
                    return
                }
            } catch {
                # Invalid JSON, we'll overwrite it
            }
        }

        $bashPath = Find-BashShell

        if ($bashPath) {
            Write-Host "Found bash shell: $bashPath" -ForegroundColor Cyan

            # Create settings directory if needed
            if (-not (Test-Path $settingsDir)) {
                New-Item -ItemType Directory -Force -Path $settingsDir | Out-Null
            }

            # Read existing settings or create new. ConvertFrom-Json -AsHashtable
            # requires PowerShell 6+; build the hashtable manually so Windows
            # PowerShell 5.1 merges instead of clobbering existing settings.
            $settings = @{}
            if (Test-Path $settingsFile) {
                try {
                    $parsed = Get-Content $settingsFile -Raw | ConvertFrom-Json
                    foreach ($prop in $parsed.PSObject.Properties) {
                        $settings[$prop.Name] = $prop.Value
                    }
                } catch {
                    $settings = @{}
                }
            }

            # Set shellPath
            $settings["shellPath"] = $bashPath

            # Write settings
            $settings | ConvertTo-Json -Depth 10 | Set-Content $settingsFile -Encoding UTF8
            Write-Host "[OK] Configured shell path in $settingsFile" -ForegroundColor Green
        } else {
            Write-Host ""
            Write-Host "No bash shell found - OMP will use its built-in shell." -ForegroundColor Cyan
            Write-Host "  For shell snapshots and interactive terminals, install Git for Windows:" -ForegroundColor Cyan
            Write-Host "    https://git-scm.com/download/win" -ForegroundColor Cyan
            Write-Host "  Or set a custom path in:" -ForegroundColor Cyan
            Write-Host "    $settingsFile" -ForegroundColor Cyan
            Write-Host '    { "shellPath": "C:\\path\\to\\bash.exe" }' -ForegroundColor Cyan
        }
    } catch {
        Write-Host "[WARN] Could not configure bash shell: $_" -ForegroundColor Yellow
    }
}

function Install-Bun {
    Write-Host "Installing bun..."
    Invoke-Native { irm bun.sh/install.ps1 | iex }
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "User") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    Assert-BunVersion $MinimumBunVersion
}

function Install-FromSource {
    Write-Host "Installing from source..."
    if (-not (Test-GitInstalled)) {
        throw "git is required for -Source. Install Git for Windows from https://git-scm.com/download/win and re-run."
    }
    if (-not (Test-BunInstalled)) {
        Install-Bun
    }
    Assert-BunVersion $MinimumBunVersion

    $sourceRef = if ($Ref) { $Ref } else { "main" }
    $tmpRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("storoslop-install-" + [System.Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Force -Path $tmpRoot | Out-Null

    try {
        $repoUrl = "https://github.com/$Repo.git"
        Invoke-Native { git clone --depth 1 --branch $sourceRef $repoUrl $tmpRoot 2>&1 | Out-Null }
        if ($LASTEXITCODE -ne 0) {
            Invoke-Native { git clone $repoUrl $tmpRoot 2>&1 | Out-Null }
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to clone $repoUrl"
            }
            Push-Location $tmpRoot
            try {
                Invoke-Native { git checkout $sourceRef 2>&1 | Out-Null }
                if ($LASTEXITCODE -ne 0) {
                    throw "Failed to checkout $sourceRef"
                }
            } finally {
                Pop-Location
            }
        }

        # Pull LFS files
        if (Test-GitLfsInstalled) {
            Push-Location $tmpRoot
            try {
                Invoke-Native { git lfs pull 2>&1 | Out-Null }
            } finally {
                Pop-Location
            }
        }

        Push-Location $tmpRoot
        try {
            Invoke-Native { bun install }
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to install workspace dependencies via bun"
            }
            Invoke-Native { bun run build }
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to build the binary via bun"
            }
        } finally {
            Pop-Location
        }

        $builtExe = Join-Path $tmpRoot "packages\coding-agent\dist\storoslop.exe"
        if (-not (Test-Path $builtExe)) {
            $builtExe = Join-Path $tmpRoot "packages\coding-agent\dist\storoslop"
        }
        if (-not (Test-Path $builtExe)) {
            throw "Build finished but no binary was produced under packages\coding-agent\dist"
        }

        New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
        $OutPath = Join-Path $InstallDir "storoslop.exe"
        Copy-Item -Force -LiteralPath $builtExe -Destination $OutPath
    } finally {
        Remove-Item -Recurse -Force $tmpRoot -ErrorAction SilentlyContinue
    }

    Write-Host ""
    Write-Host "[OK] Installed storoslop (from source) to $OutPath" -ForegroundColor Green
    $needsRestart = Add-InstallDirToPath

    Configure-BashShell

    if ($needsRestart) {
        Write-Host "Restart your terminal, then run 'storoslop' to get started!"
    } else {
        Write-Host "Run 'storoslop' to get started!"
    }
}

# Add $InstallDir to the user PATH when it is missing. Returns $true when the
# PATH changed and the user must restart their terminal to pick it up.
function Add-InstallDirToPath {
    $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($UserPath -notlike "*$InstallDir*") {
        Write-Host "Adding $InstallDir to PATH..."
        [Environment]::SetEnvironmentVariable("Path", "$UserPath;$InstallDir", "User")
        return $true
    }
    return $false
}

function Install-Binary {
    if ($Ref) {
        Write-Host "Fetching release $Ref..."
        try {
            $Release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/tags/$Ref" -TimeoutSec 60
        } catch {
            throw "Release tag not found: $Ref`nFor branch/commit installs, use -Source with -Ref."
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
    # Verify against the release's SHA256SUMS.txt (sha256sum format) before
    # replacing any existing install.
    $SumsUrl = "https://github.com/$Repo/releases/download/$Latest/SHA256SUMS.txt"
    $Sums = (Invoke-WebRequest -Uri $SumsUrl -TimeoutSec 60).Content
    $ExpectedSha256 = $null
    foreach ($SumsLine in ($Sums -split "`n")) {
        if ($SumsLine -match "^([0-9a-fA-F]{64})\s+$([regex]::Escape($BinaryName))\s*$") {
            $ExpectedSha256 = $Matches[1].ToLowerInvariant()
            break
        }
    }
    if (-not $ExpectedSha256) {
        throw "Release $Latest has no checksum for $BinaryName (SHA256SUMS.txt)"
    }
    $DownloadPath = Join-Path $InstallDir ".storoslop.download.exe"
    try {
        Invoke-WebRequest -Uri $BinaryUrl -OutFile $DownloadPath -TimeoutSec 900
        $ActualSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $DownloadPath).Hash.ToLowerInvariant()
        if ($ActualSha256 -ne $ExpectedSha256) {
            throw "Checksum mismatch for ${BinaryName}: expected $ExpectedSha256, got $ActualSha256"
        }
        Move-Item -Force -LiteralPath $DownloadPath -Destination $OutPath
    } finally {
        Remove-Item -Force -LiteralPath $DownloadPath -ErrorAction SilentlyContinue
    }

    Write-Host ""
    Write-Host "[OK] Installed storoslop to $OutPath" -ForegroundColor Green

    $needsRestart = Add-InstallDirToPath

    Configure-BashShell

    if ($needsRestart) {
        Write-Host "Restart your terminal, then run 'storoslop' to get started!"
    } else {
        Write-Host "Run 'storoslop' to get started!"
    }
}

# Main logic. The binary comes from GitHub Releases by default; -Source builds
# from a checkout instead. Nothing is fetched from a package registry.
if ($Source) {
    Install-FromSource
} else {
    Install-Binary
}
