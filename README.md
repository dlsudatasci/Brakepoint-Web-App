# BrakePoint Web App

This repository contains the BrakePoint backend (Django) and frontend (Next.js).

## Quick Start (Windows)

### 1. Run setup

From the repository root, run:

```powershell
powershell -ExecutionPolicy Bypass -File setup.ps1
```

What setup does:
- Creates or reuses `.venv`
- Installs backend Python dependencies
- Installs root npm dependencies
- Installs frontend npm dependencies
- Applies Django migrations

### 2. Start the app

```powershell
npm run dev
```

This starts both backend and frontend.

## Update Existing Clone

To pull latest changes and refresh dependencies:

```powershell
powershell -ExecutionPolicy Bypass -File setup.ps1 -Update
```

## Optional Setup Flags

Use these only when needed:
- `-SkipBackend`
- `-SkipFrontend`
- `-SkipMigrations`

Example:

```powershell
powershell -ExecutionPolicy Bypass -File setup.ps1 -Update -SkipMigrations
```

## Required Environment Files

Create these files before running the full app:
- `backend/.env`
- `frontend/brakepoint_app/.env.development`

At minimum, frontend usually needs `NEXT_PUBLIC_API_URL`.

## Common Troubleshooting

- Python not found:
  - Install Python 3 from https://www.python.org/downloads/
- npm not found:
  - Install Node.js LTS from https://nodejs.org/
- PowerShell script execution blocked:
  - Run in current shell only:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
```

Then rerun setup.
