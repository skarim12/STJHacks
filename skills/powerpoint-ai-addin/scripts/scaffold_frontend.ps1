param(
  [string]$ProjectName = "powerpoint-ai-addin",
  [string]$OutDir = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

Write-Host "Scaffolding Office PowerPoint Task Pane add-in: $ProjectName" -ForegroundColor Cyan
Write-Host "Output directory: $OutDir" -ForegroundColor Cyan

Set-Location $OutDir

# 1) Ensure tooling
npm install -g yo generator-office

# 2) Generate project
# This is interactive. Choose:
# - Office Add-in Task Pane project
# - TypeScript
# - PowerPoint
yo office

# 3) Install deps (run inside generated project directory)
Write-Host "\nAfter generation, cd into the created project folder and run:" -ForegroundColor Yellow
Write-Host "npm install react react-dom zustand axios @fluentui/react @fluentui/react-icons" -ForegroundColor Yellow
Write-Host "npm install -D @types/react @types/react-dom" -ForegroundColor Yellow
