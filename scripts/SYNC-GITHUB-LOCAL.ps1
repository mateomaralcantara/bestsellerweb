param(
    [switch]$InstallTask
)

$ErrorActionPreference = "Stop"
$Repo = "C:\Users\martin\Desktop\VSC\BestS\bestsellerweb"
$TaskName = "LibroSeller-GitHub-AutoSync"

if (-not (Test-Path -LiteralPath (Join-Path $Repo ".git"))) {
    throw "No se encontró el repositorio LibroSeller en: $Repo"
}

$ScriptPath = $MyInvocation.MyCommand.Path
$GitDir = (& git -C $Repo rev-parse --git-dir).Trim()
if (-not [System.IO.Path]::IsPathRooted($GitDir)) {
    $GitDir = Join-Path $Repo $GitDir
}
$Log = Join-Path $GitDir "libroseller-autosync.log"

function Write-SyncLog([string]$Message) {
    $Line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    Add-Content -LiteralPath $Log -Value $Line -Encoding UTF8
    Write-Host $Line
}

if ($InstallTask) {
    if (-not $ScriptPath) {
        throw "No se pudo determinar la ruta de este script."
    }

    $Action = New-ScheduledTaskAction `
        -Execute "powershell.exe" `
        -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""

    $Trigger = New-ScheduledTaskTrigger `
        -Once `
        -At (Get-Date).AddMinutes(1) `
        -RepetitionInterval (New-TimeSpan -Minutes 1)

    $Settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable

    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $Action `
        -Trigger $Trigger `
        -Settings $Settings `
        -Description "Sincroniza origin/main de LibroSeller con el repositorio local sin sobrescribir trabajo local." `
        -Force | Out-Null

    Write-Host "Tarea instalada: $TaskName" -ForegroundColor Green
}

# Siempre actualizar los objetos y referencias remotas locales.
& git -C $Repo fetch origin main --prune --quiet
if ($LASTEXITCODE -ne 0) {
    Write-SyncLog "ERROR: git fetch origin main falló."
    exit 1
}

$OriginMain = (& git -C $Repo rev-parse origin/main).Trim()
$CurrentBranch = (& git -C $Repo branch --show-current).Trim()
$LocalMain = (& git -C $Repo rev-parse main 2>$null).Trim()

if (-not $OriginMain) {
    Write-SyncLog "ERROR: No se pudo resolver origin/main."
    exit 1
}

if ($CurrentBranch -eq "main") {
    # Solo los cambios tracked impiden el fast-forward. Los archivos untracked
    # no se borran; si alguno colisiona con Git, Git abortará el merge de forma segura.
    $TrackedChanges = @(& git -C $Repo status --porcelain --untracked-files=no)

    if ($TrackedChanges.Count -gt 0) {
        Write-SyncLog "PENDIENTE: origin/main=$($OriginMain.Substring(0,7)); main tiene cambios tracked locales. No se sobrescribió nada."
        exit 2
    }

    if ($LocalMain -eq $OriginMain) {
        Write-SyncLog "OK: main ya está sincronizado en $($OriginMain.Substring(0,7))."
        exit 0
    }

    & git -C $Repo merge --ff-only origin/main --quiet
    if ($LASTEXITCODE -eq 0) {
        $NewHead = (& git -C $Repo rev-parse HEAD).Trim()
        Write-SyncLog "OK: main actualizado por fast-forward a $($NewHead.Substring(0,7))."
        exit 0
    }

    Write-SyncLog "PENDIENTE: Git bloqueó el fast-forward (posible archivo untracked en conflicto o historial divergente). No se sobrescribió nada."
    exit 3
}

# Si se trabaja en una rama distinta, el working tree no se toca. Se actualiza
# el puntero local main únicamente cuando el movimiento es fast-forward.
& git -C $Repo merge-base --is-ancestor main origin/main 2>$null
if ($LASTEXITCODE -eq 0) {
    & git -C $Repo update-ref refs/heads/main $OriginMain $LocalMain
    if ($LASTEXITCODE -eq 0) {
        Write-SyncLog "OK: origin/main y la rama local main quedaron en $($OriginMain.Substring(0,7)); rama activa: $CurrentBranch."
        exit 0
    }
}

Write-SyncLog "PENDIENTE: main no pudo actualizarse automáticamente; rama activa: $CurrentBranch. No se sobrescribió nada."
exit 4
