param(
  [Parameter(Mandatory = $true)]
  [string]$Slug,

  [Parameter(Mandatory = $true)]
  [string]$Pdf,

  [int]$Pages = 25,

  [int]$Dpi = 120
)

$ErrorActionPreference = "Stop"

# La muestra pública siempre tiene 25 páginas.
$Pages = 25

$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
Set-Location $ProjectRoot

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "GENERAR PREVIEW DE LIBRO" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Slug:" -ForegroundColor Yellow
Write-Host $Slug -ForegroundColor Green

Write-Host ""
Write-Host "PDF:" -ForegroundColor Yellow
Write-Host $Pdf -ForegroundColor Green

Write-Host ""
Write-Host "Paginas:" -ForegroundColor Yellow
Write-Host $Pages -ForegroundColor Green

Write-Host ""
Write-Host "DPI:" -ForegroundColor Yellow
Write-Host $Dpi -ForegroundColor Green

if (!(Test-Path -LiteralPath $Pdf)) {
  Write-Host ""
  Write-Host "ERROR: No existe el PDF indicado." -ForegroundColor Red
  Write-Host $Pdf -ForegroundColor Yellow
  exit 1
}

$pdfFile = Get-Item -LiteralPath $Pdf

if ($pdfFile.Extension.ToLower() -ne ".pdf") {
  Write-Host ""
  Write-Host "ERROR: El archivo debe ser PDF." -ForegroundColor Red
  exit 1
}

$pdftoppm = Get-Command "pdftoppm" -ErrorAction SilentlyContinue

if (!$pdftoppm) {
  Write-Host ""
  Write-Host "ERROR: Poppler no esta instalado o pdftoppm no esta disponible." -ForegroundColor Red
  Write-Host "Instala con:" -ForegroundColor Yellow
  Write-Host "winget install -e --id oschwartz10612.Poppler" -ForegroundColor Green
  Write-Host "Luego cierra y abre PowerShell otra vez." -ForegroundColor Yellow
  exit 1
}

$tmpRoot = Join-Path $ProjectRoot ".tmp-preview"
$popplerDir = Join-Path $tmpRoot "poppler"

New-Item -ItemType Directory -Force -Path $tmpRoot | Out-Null
New-Item -ItemType Directory -Force -Path $popplerDir | Out-Null

Remove-Item -Force "$popplerDir\*.png" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Convirtiendo PDF a PNG con Poppler..." -ForegroundColor Cyan

pdftoppm `
  -png `
  -f 1 `
  -l $Pages `
  -r $Dpi `
  $pdfFile.FullName `
  "$popplerDir\page"

$images = Get-ChildItem $popplerDir -Filter "*.png" | Sort-Object Name

if ($images.Count -eq 0) {
  Write-Host ""
  Write-Host "ERROR: Poppler no genero imagenes." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Imagenes generadas:" -ForegroundColor Green
Write-Host $images.Count

Write-Host ""
Write-Host "Subiendo imagenes a Supabase y actualizando book_preview_pages..." -ForegroundColor Cyan

node ".\scripts\upload-poppler-preview.mjs" `
  --slug $Slug `
  --images-dir $popplerDir `
  --pages $Pages

if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "ERROR: No se pudo subir el preview a Supabase." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "PREVIEW GENERADO Y SUBIDO CORRECTAMENTE" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
