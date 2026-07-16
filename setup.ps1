[CmdletBinding()]
param(
    [switch]$Update,
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [switch]$SkipMigrations
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Stop-WithError {
    param([string]$Message)
    Write-Host "ERROR: $Message" -ForegroundColor Red
    exit 1
}

function Invoke-Checked {
    param(
        [string]$CommandLabel,
        [scriptblock]$Command
    )

    Write-Host $CommandLabel -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) {
        Stop-WithError "$CommandLabel failed."
    }
}

Write-Host "=== BrakePoint Setup ===" -ForegroundColor Cyan
if ($Update) {
    Write-Host "Mode: UPDATE (pull latest changes + reinstall dependencies)" -ForegroundColor Green
} else {
    Write-Host "Mode: SETUP (install dependencies for first run)" -ForegroundColor Green
}

# --- Resolve paths ---
$rootPath = $PSScriptRoot
$backendPath = Join-Path $rootPath "backend"
$frontendPath = Join-Path $rootPath "frontend\brakepoint_app"
$venvPath = Join-Path $rootPath ".venv"
$venvPython = Join-Path $venvPath "Scripts\python.exe"
$venvPip = Join-Path $venvPath "Scripts\pip.exe"

if (-not (Test-Path (Join-Path $rootPath "package.json"))) {
    Stop-WithError "Run this script from the repository root where package.json exists."
}

# --- Optional: update source code ---
if ($Update) {
    $git = Get-Command git -ErrorAction SilentlyContinue
    if ($git) {
        Push-Location $rootPath
        try {
            Write-Host "`nPulling latest changes (git pull --ff-only)..." -ForegroundColor Cyan
            git pull --ff-only
            if ($LASTEXITCODE -ne 0) {
                Write-Host "WARNING: Git pull failed (possibly local changes or branch divergence)." -ForegroundColor Yellow
                Write-Host "         Resolve Git state manually, then rerun this script." -ForegroundColor Yellow
            }
        }
        finally {
            Pop-Location
        }
    } else {
        Write-Host "`nWARNING: Git is not installed or not in PATH. Skipping git pull." -ForegroundColor Yellow
    }
}

# --- Find Python ---
$python = $null
$pyLauncher = Get-Command py -ErrorAction SilentlyContinue
if ($pyLauncher) {
    try {
        $python = (& py -3 -c "import sys; print(sys.executable)").Trim()
    }
    catch {
        $python = $null
    }
}

if (-not $python) {
    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCmd) {
        $python = $pythonCmd.Source
    }
}

if (-not $python) {
    Stop-WithError "Could not find Python 3. Install it from https://www.python.org/downloads/"
}
Write-Host "Using Python: $python" -ForegroundColor Green

# --- Check npm ---
$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    Stop-WithError "npm was not found. Install Node.js from https://nodejs.org/"
}
Write-Host "Using npm: $($npmCmd.Source)" -ForegroundColor Green

# --- Create virtual environment ---
if (-not (Test-Path $venvPython)) {
    Invoke-Checked -CommandLabel "`nCreating virtual environment..." -Command {
        & $python -m venv $venvPath
    }
} else {
    Write-Host "`nVirtual environment already exists, reusing it." -ForegroundColor Gray
}

if (-not $SkipBackend) {
    if (-not (Test-Path $venvPip)) {
        Stop-WithError "pip was not found in .venv. Delete .venv and rerun setup."
    }

    Invoke-Checked -CommandLabel "`nUpgrading pip tooling..." -Command {
        & $venvPip install --upgrade pip setuptools wheel
    }

    Invoke-Checked -CommandLabel "Installing backend Python dependencies..." -Command {
        & $venvPip install -r (Join-Path $backendPath "requirements.txt")
    }
}

if (-not $SkipFrontend) {
    Push-Location $rootPath
    try {
        Invoke-Checked -CommandLabel "`nInstalling root npm dependencies..." -Command {
            npm install
        }
    }
    finally {
        Pop-Location
    }

    Push-Location $frontendPath
    try {
        Invoke-Checked -CommandLabel "Installing frontend npm dependencies..." -Command {
            npm install
        }
    }
    finally {
        Pop-Location
    }
}

if ((-not $SkipBackend) -and (-not $SkipMigrations)) {
    Push-Location $backendPath
    try {
        Invoke-Checked -CommandLabel "`nApplying Django migrations..." -Command {
            & $venvPython manage.py migrate --noinput
        }
    }
    finally {
        Pop-Location
    }
}

# --- Check for .env files ---
Write-Host ""
if (-not (Test-Path (Join-Path $backendPath ".env"))) {
    Write-Host "WARNING: backend\.env not found." -ForegroundColor Yellow
    Write-Host "         Create backend\.env and add required variables." -ForegroundColor Yellow
}
if (-not (Test-Path (Join-Path $frontendPath ".env.development"))) {
    Write-Host "WARNING: frontend\brakepoint_app\.env.development not found." -ForegroundColor Yellow
    Write-Host "         Create .env.development and set NEXT_PUBLIC_API_URL, etc." -ForegroundColor Yellow
}

Write-Host "`n=== Setup complete! ===" -ForegroundColor Green
Write-Host "Start the app with: npm run dev" -ForegroundColor Cyan
Write-Host "Update later with: powershell -ExecutionPolicy Bypass -File setup.ps1 -Update" -ForegroundColor Cyan
