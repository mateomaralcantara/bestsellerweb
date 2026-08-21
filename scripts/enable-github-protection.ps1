param(
    [string]$Repository = "mateomaralcantara/bestsellerweb",
    [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"
$Gh = "C:\Program Files\GitHub CLI\gh.exe"

if (-not (Test-Path -LiteralPath $Gh)) {
    $Gh = "gh"
}

& $Gh auth status
if ($LASTEXITCODE -ne 0) {
    throw "GitHub CLI no está autenticado."
}

$Payload = @{
    required_status_checks = @{
        strict = $true
        contexts = @("verify")
    }
    enforce_admins = $true
    required_pull_request_reviews = @{
        dismiss_stale_reviews = $true
        require_code_owner_reviews = $false
        required_approving_review_count = 0
        require_last_push_approval = $false
    }
    restrictions = $null
    required_linear_history = $true
    allow_force_pushes = $false
    allow_deletions = $false
    block_creations = $false
    required_conversation_resolution = $true
    lock_branch = $false
    allow_fork_syncing = $true
} | ConvertTo-Json -Depth 8

$Payload | & $Gh api `
    --method PUT `
    -H "Accept: application/vnd.github+json" `
    -H "X-GitHub-Api-Version: 2022-11-28" `
    "repos/$Repository/branches/$Branch/protection" `
    --input -

if ($LASTEXITCODE -ne 0) {
    throw "No se pudo proteger la rama $Branch."
}

Write-Host "RAMA $Branch PROTEGIDA CORRECTAMENTE." -ForegroundColor Green
