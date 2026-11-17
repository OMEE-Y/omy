
$ErrorActionPreference = "Stop"

$Repo = "https://github.com/omee-y/omy.git"
$InstallDir = Join-Path $env:USERPROFILE ".omy"

Write-Host ""
Write-Host "  OMY AI Agent Installer"
Write-Host "  ======================"

# Dependencies
foreach ($cmd in @("git", "node", "npm")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        throw "$cmd is required. Install it first."
    }
}

# Node 22+
$NodeMajor = [int](node -p "process.versions.node.split('.')[0]")

if ($NodeMajor -lt 22) {
    throw "Node.js 22 or newer is required."
}

# Clone or update
if (Test-Path (Join-Path $InstallDir ".git")) {
    Write-Host "Updating OMY..."
    git -C $InstallDir pull --ff-only origin main

    if ($LASTEXITCODE -ne 0) {
        throw "Git update failed."
    }
}
elseif (Test-Path $InstallDir) {
    throw "$InstallDir already exists."
}
else {
    Write-Host "Downloading OMY..."
    git clone --branch main $Repo $InstallDir

    if ($LASTEXITCODE -ne 0) {
        throw "Git clone failed."
    }
}

Set-Location $InstallDir

# Dependencies
Write-Host "Installing dependencies..."
npm ci

if ($LASTEXITCODE -ne 0) {
    throw "Dependency installation failed."
}

# Build
Write-Host "Building OMY..."
npm run build

if ($LASTEXITCODE -ne 0) {
    throw "Build failed."
}

# Register globally
Write-Host "Registering OMY..."
npm link

if ($LASTEXITCODE -ne 0) {
    throw "npm link failed."
}

# Setup
Write-Host ""
Write-Host "Starting OMY setup..."

try {
    node .\dist\index.js setup

    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Setup skipped. Run 'omy setup' later."
    }
}
catch {
    Write-Warning "Setup skipped. Run 'omy setup' later."
}

Write-Host ""
Write-Host "OMY installed successfully!" -ForegroundColor Green

if (Get-Command omy -ErrorAction SilentlyContinue) {
    Write-Host "Run: omy --help"
}
else {
    Write-Warning "Restart your terminal or check your npm global PATH."
}
