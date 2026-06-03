# ============================================
# ARCHIVO: scripts/audit-upload-formats.ps1
# ============================================
# Auditor de formatos de subida para BestSeller.
#
# OBJETIVO:
# - Revisar si el dashboard permite subir PDF.
# - Detectar inputs que solo aceptan EPUB.
# - Detectar campos viejos como book_file o preview_epub.
# - Revisar si la API acepta manuscript_pdf.
# - Generar reporte en reports/upload-formats-audit.txt
#
# USO:
# powershell -ExecutionPolicy Bypass -File ".\scripts\audit-upload-formats.ps1"
# ============================================

$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\Users\martin\Desktop\VSC\BestS\bestsellerweb"

if (-not (Test-Path -LiteralPath $ProjectRoot)) {
  Write-Host "ERROR: No existe la carpeta del proyecto:" -ForegroundColor Red
  Write-Host $ProjectRoot
  exit 1
}

Set-Location -LiteralPath $ProjectRoot

$ReportDir = Join-Path $ProjectRoot "reports"
$ReportPath = Join-Path $ReportDir "upload-formats-audit.txt"

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

$IgnoredFoldersPattern = "\\node_modules\\|\\.next\\|\\dist\\|\\build\\|\\reports\\"

$Findings = New-Object System.Collections.Generic.List[string]
$Warnings = New-Object System.Collections.Generic.List[string]
$Errors = New-Object System.Collections.Generic.List[string]

function Add-Line {
  param([string]$Text = "")

  $script:Findings.Add($Text) | Out-Null
  Write-Host $Text
}

function Add-Ok {
  param([string]$Text)

  $line = "OK: $Text"
  $script:Findings.Add($line) | Out-Null
  Write-Host $line -ForegroundColor Green
}

function Add-WarningLine {
  param([string]$Text)

  $line = "ADVERTENCIA: $Text"
  $script:Warnings.Add($line) | Out-Null
  $script:Findings.Add($line) | Out-Null
  Write-Host $line -ForegroundColor Yellow
}

function Add-ErrorLine {
  param([string]$Text)

  $line = "ERROR: $Text"
  $script:Errors.Add($line) | Out-Null
  $script:Findings.Add($line) | Out-Null
  Write-Host $line -ForegroundColor Red
}

function Safe-Value {
  param(
    [string]$Value,
    [string]$Fallback
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $Fallback
  }

  return $Value
}

function Get-RelativePath {
  param([string]$FullPath)

  return $FullPath.Replace($ProjectRoot, "").TrimStart("\")
}

function Get-ProjectFiles {
  $files = Get-ChildItem -Path $ProjectRoot -Recurse -File -Include *.ts, *.tsx, *.js, *.jsx |
    Where-Object { $_.FullName -notmatch $IgnoredFoldersPattern } |
    Sort-Object FullName -Unique

  return $files
}

function Get-FileInputBlocks {
  param([string]$Content)

  $blocks = New-Object System.Collections.Generic.List[string]

  $patterns = @(
    '<input[\s\S]{0,1500}?type=["'']file["''][\s\S]{0,1500}?>',
    '<input[\s\S]{0,1500}?type=\{["'']file["'']\}[\s\S]{0,1500}?>'
  )

  foreach ($pattern in $patterns) {
    $matches = [regex]::Matches($Content, $pattern, "IgnoreCase")

    foreach ($match in $matches) {
      $blocks.Add($match.Value) | Out-Null
    }
  }

  return $blocks
}

function Get-AttributeValue {
  param(
    [string]$Block,
    [string]$Attribute
  )

  $patterns = @(
    "$Attribute\s*=\s*`"([^`"]*)`"",
    "$Attribute\s*=\s*'([^']*)'",
    "$Attribute\s*=\s*\{`"([^`"]*)`"\}",
    "$Attribute\s*=\s*\{'([^']*)'\}"
  )

  foreach ($pattern in $patterns) {
    $match = [regex]::Match($Block, $pattern, "IgnoreCase")

    if ($match.Success) {
      return $match.Groups[1].Value
    }
  }

  return ""
}

function Get-FormatStatusFromAccept {
  param([string]$Accept)

  $lower = $Accept.ToLowerInvariant()

  $hasPdf = $lower.Contains(".pdf") -or $lower.Contains("application/pdf")
  $hasEpub = $lower.Contains(".epub") -or $lower.Contains("application/epub+zip")

  if ($hasPdf -and $hasEpub) {
    return "PDF_Y_EPUB"
  }

  if ($hasPdf) {
    return "PDF"
  }

  if ($hasEpub) {
    return "SOLO_EPUB"
  }

  if ([string]::IsNullOrWhiteSpace($Accept)) {
    return "SIN_ACCEPT"
  }

  return "OTRO"
}

function Audit-FileInputs {
  param($Files)

  Add-Line ""
  Add-Line "============================================================"
  Add-Line "1) AUDITORIA DE INPUTS type=file"
  Add-Line "============================================================"

  $totalInputs = 0
  $pdfInputs = 0
  $epubOnlyInputs = 0
  $mixedInputs = 0
  $missingAcceptInputs = 0

  foreach ($file in $Files) {
    $relativePath = Get-RelativePath $file.FullName

    if ($relativePath -notmatch "^app\\dashboard|^components\\|^app\\api\\books") {
      continue
    }

    $content = Get-Content -Raw -LiteralPath $file.FullName
    $blocks = Get-FileInputBlocks -Content $content

    if ($blocks.Count -eq 0) {
      continue
    }

    Add-Line ""
    Add-Line "ARCHIVO: $relativePath"

    foreach ($block in $blocks) {
      $totalInputs++

      $name = Get-AttributeValue -Block $block -Attribute "name"
      $id = Get-AttributeValue -Block $block -Attribute "id"
      $accept = Get-AttributeValue -Block $block -Attribute "accept"
      $status = Get-FormatStatusFromAccept -Accept $accept

      $safeName = Safe-Value -Value $name -Fallback "SIN_NAME"
      $safeId = Safe-Value -Value $id -Fallback "SIN_ID"
      $safeAccept = Safe-Value -Value $accept -Fallback "SIN_ACCEPT"

      Add-Line "  - input file:"
      Add-Line "    name:   $safeName"
      Add-Line "    id:     $safeId"
      Add-Line "    accept: $safeAccept"
      Add-Line "    status: $status"

      if ($status -eq "SOLO_EPUB") {
        $epubOnlyInputs++
        Add-ErrorLine "En $relativePath hay un input que solo acepta EPUB."
      }

      if ($status -eq "PDF") {
        $pdfInputs++
      }

      if ($status -eq "PDF_Y_EPUB") {
        $mixedInputs++
        Add-WarningLine "En $relativePath hay input mixto PDF/EPUB. Conviene separar PDF principal y EPUB opcional."
      }

      if ($status -eq "SIN_ACCEPT") {
        $missingAcceptInputs++
        Add-WarningLine "En $relativePath hay input file sin accept."
      }
    }
  }

  Add-Line ""
  Add-Line "RESUMEN INPUTS:"
  Add-Line "  Total inputs file: $totalInputs"
  Add-Line "  Inputs PDF: $pdfInputs"
  Add-Line "  Inputs mixtos PDF/EPUB: $mixedInputs"
  Add-Line "  Inputs solo EPUB: $epubOnlyInputs"
  Add-Line "  Inputs sin accept: $missingAcceptInputs"

  if ($totalInputs -eq 0) {
    Add-ErrorLine "No se encontraron inputs type=file."
  }

  if ($epubOnlyInputs -gt 0) {
    Add-WarningLine "Debes cambiar inputs de manuscrito que aceptan solo EPUB por PDF."
  }

  if ($pdfInputs -eq 0 -and $mixedInputs -eq 0) {
    Add-ErrorLine "No se encontró ningún input que acepte PDF."
  }
}

function Audit-FieldNames {
  param($Files)

  Add-Line ""
  Add-Line "============================================================"
  Add-Line "2) AUDITORIA DE NOMBRES DE CAMPOS"
  Add-Line "============================================================"

  $terms = @(
    "manuscript_pdf",
    "pdf_file",
    "book_pdf",
    "book_file",
    "epub_file",
    "preview_epub",
    "epub_preview",
    "application/pdf",
    "application/epub+zip",
    ".pdf",
    ".epub"
  )

  foreach ($term in $terms) {
    $foundPaths = New-Object System.Collections.Generic.List[string]

    foreach ($file in $Files) {
      $content = Get-Content -Raw -LiteralPath $file.FullName

      if ($content -match [regex]::Escape($term)) {
        $foundPaths.Add((Get-RelativePath $file.FullName)) | Out-Null
      }
    }

    if ($foundPaths.Count -gt 0) {
      Add-Line ""
      Add-Line "TERMINO ENCONTRADO: $term"

      $foundPaths | Sort-Object -Unique | ForEach-Object {
        Add-Line "  - $_"
      }
    } else {
      Add-Line ""
      Add-Line "TERMINO NO ENCONTRADO: $term"
    }
  }
}

function Audit-ApiRoute {
  Add-Line ""
  Add-Line "============================================================"
  Add-Line "3) AUDITORIA DE API app/api/books/[bookkey]/route.ts"
  Add-Line "============================================================"

  $apiPath = Join-Path $ProjectRoot "app\api\books\[bookkey]\route.ts"

  if (-not (Test-Path -LiteralPath $apiPath)) {
    Add-ErrorLine "No existe app/api/books/[bookkey]/route.ts"
    return
  }

  $content = Get-Content -Raw -LiteralPath $apiPath

  $requiredChecks = @(
    @{
      Label = "Acepta manuscript_pdf"
      Pattern = "manuscript_pdf"
    },
    @{
      Label = "Tiene validacion PDF"
      Pattern = "application/pdf"
    },
    @{
      Label = "Marca preview como pdf_images"
      Pattern = "pdf_images"
    },
    @{
      Label = "Tiene MAX_PDF_SIZE"
      Pattern = "MAX_PDF_SIZE"
    }
  )

  foreach ($check in $requiredChecks) {
    if ($content -match [regex]::Escape($check.Pattern)) {
      Add-Ok $check.Label
    } else {
      Add-ErrorLine "Falta en API: $($check.Label)"
    }
  }

  $warningChecks = @(
    @{
      Label = "Sigue usando book_file"
      Pattern = "book_file"
    },
    @{
      Label = "Sigue usando preview_epub"
      Pattern = "preview_epub"
    },
    @{
      Label = "Sigue usando epub_preview"
      Pattern = "epub_preview"
    },
    @{
      Label = "Sigue usando MAX_BOOK_SIZE_MB generico"
      Pattern = "MAX_BOOK_SIZE_MB"
    }
  )

  foreach ($check in $warningChecks) {
    if ($content -match [regex]::Escape($check.Pattern)) {
      Add-WarningLine "$($check.Label). Revisa si todavía es necesario."
    } else {
      Add-Ok "No detectado: $($check.Label)"
    }
  }
}

function Audit-DashboardFolders {
  Add-Line ""
  Add-Line "============================================================"
  Add-Line "4) ARCHIVOS PROBABLES DEL DASHBOARD"
  Add-Line "============================================================"

  $candidates = @(
    "app\dashboard\books\new",
    "app\dashboard\books\[id]\edit",
    "components\dashboard",
    "components\books"
  )

  foreach ($candidate in $candidates) {
    $fullPath = Join-Path $ProjectRoot $candidate

    if (-not (Test-Path -LiteralPath $fullPath)) {
      Add-WarningLine "No existe: $candidate"
      continue
    }

    Add-Ok "Existe: $candidate"

    $files = Get-ChildItem -LiteralPath $fullPath -Recurse -File -Include *.ts, *.tsx |
      Where-Object { $_.FullName -notmatch $IgnoredFoldersPattern }

    foreach ($file in $files) {
      $relativePath = Get-RelativePath $file.FullName
      $content = Get-Content -Raw -LiteralPath $file.FullName

      $hasFileInput = $content -match "type\s*=\s*[`"']file[`"']|type\s*=\s*\{[`"']file[`"']\}"
      $hasAccept = $content -match "accept\s*="
      $hasPdf = $content -match "application/pdf|\.pdf|manuscript_pdf|pdf_file|book_pdf"
      $hasEpub = $content -match "application/epub\+zip|\.epub|epub_file|preview_epub|epub_preview"

      if ($hasFileInput -or $hasAccept -or $hasPdf -or $hasEpub) {
        Add-Line "  - $relativePath"
        Add-Line "    file input: $hasFileInput"
        Add-Line "    accept:     $hasAccept"
        Add-Line "    PDF:        $hasPdf"
        Add-Line "    EPUB:       $hasEpub"
      }
    }
  }
}

function Print-SqlHint {
  Add-Line ""
  Add-Line "============================================================"
  Add-Line "5) SQL RECOMENDADO SI asset_type ES ENUM"
  Add-Line "============================================================"

  Add-Line "Ejecuta en Supabase si falta manuscript_pdf:"
  Add-Line ""
  Add-Line "ALTER TYPE public.asset_type ADD VALUE IF NOT EXISTS 'manuscript_pdf';"
}

function Print-FinalVerdict {
  Add-Line ""
  Add-Line "============================================================"
  Add-Line "DIAGNOSTICO FINAL"
  Add-Line "============================================================"

  if ($Errors.Count -eq 0) {
    Add-Ok "No se detectaron errores criticos."
  } else {
    Add-ErrorLine "Se detectaron $($Errors.Count) errores criticos."
  }

  if ($Warnings.Count -gt 0) {
    Add-WarningLine "Se detectaron $($Warnings.Count) advertencias."
  }

  Add-Line ""
  Add-Line "REGLA RECOMENDADA:"
  Add-Line "  - Manuscrito principal: PDF"
  Add-Line "  - Campo de formulario: manuscript_pdf"
  Add-Line "  - accept: application/pdf,.pdf"
  Add-Line "  - asset_type: manuscript_pdf"
  Add-Line "  - Leer fragmento: PDF convertido a imagenes en book_preview_pages"
  Add-Line "  - EPUB: opcional"
}

$StartedAt = Get-Date

Add-Line "============================================================"
Add-Line "AUDITORIA DE FORMATOS DE SUBIDA"
Add-Line "============================================================"
Add-Line "Proyecto: $ProjectRoot"
Add-Line "Inicio: $StartedAt"

$files = Get-ProjectFiles

Add-Line "Archivos analizados: $($files.Count)"

Audit-FileInputs -Files $files
Audit-FieldNames -Files $files
Audit-ApiRoute
Audit-DashboardFolders
Print-SqlHint
Print-FinalVerdict

$FinishedAt = Get-Date

Add-Line ""
Add-Line "Fin: $FinishedAt"
Add-Line "Reporte guardado en:"
Add-Line "$ReportPath"

$Findings | Set-Content -LiteralPath $ReportPath -Encoding UTF8

if ($Errors.Count -gt 0) {
  exit 1
}

exit 0
