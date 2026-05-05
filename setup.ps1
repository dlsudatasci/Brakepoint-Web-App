Write-Host "=== BrakePoint Setup ===" -ForegroundColor Cyan

# --- Find Windows CPython (avoid MSYS2/Anaconda) ---
$python = Get-Command python -All -ErrorAction SilentlyContinue |
    Where-Object { $_.Source -match "Python\\Python" } |
    Select-Object -First 1 -ExpandProperty Source

if (-not $python) {
    Write-Host "ERROR: Could not find a Windows CPython installation." -ForegroundColor Red
    Write-Host "Download it from https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}
Write-Host "Using Python: $python" -ForegroundColor Green

# --- Create virtual environment ---
$venvPath = Join-Path $PSScriptRoot ".venv"
if (-not (Test-Path "$venvPath\Scripts\python.exe")) {
    Write-Host "`nCreating virtual environment..." -ForegroundColor Cyan
    & $python -m venv $venvPath
} else {
    Write-Host "`nVirtual environment already exists, skipping." -ForegroundColor Gray
}

# --- Install backend dependencies ---
Write-Host "`nInstalling backend Python dependencies..." -ForegroundColor Cyan
& "$venvPath\Scripts\pip.exe" install -r "$PSScriptRoot\backend\requirements.txt"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install backend dependencies." -ForegroundColor Red
    exit 1
}

# --- Install frontend dependencies ---
Write-Host "`nInstalling frontend npm dependencies..." -ForegroundColor Cyan
Push-Location "$PSScriptRoot\frontend\brakepoint_app"
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install frontend dependencies." -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

# --- Check for .env files ---
Write-Host ""
if (-not (Test-Path "$PSScriptRoot\backend\.env")) {
    Write-Host "WARNING: backend\.env not found." -ForegroundColor Yellow
    Write-Host "         Copy backend\.env.example to backend\.env and fill in your values." -ForegroundColor Yellow
}
if (-not (Test-Path "$PSScriptRoot\frontend\brakepoint_app\.env.development")) {
    Write-Host "WARNING: frontend\brakepoint_app\.env.development not found." -ForegroundColor Yellow
    Write-Host "         Copy .env.development.example and fill in your values." -ForegroundColor Yellow
}

Write-Host "`n=== Setup complete! ===" -ForegroundColor Green
Write-Host "Run 'npm run dev' to start both servers." -ForegroundColor Cyan
