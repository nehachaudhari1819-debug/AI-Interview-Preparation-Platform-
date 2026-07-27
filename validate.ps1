$ErrorActionPreference = "Stop"

function Run-Step {
    param(
        [string]$Name,
        [scriptblock]$Command
    )

    Write-Host "`n========== $Name ==========" -ForegroundColor Cyan
    & $Command

    if ($LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE"
    }
}

Run-Step "Start Supabase"       { npm run db:start }
Run-Step "Reset Database"       { npm run db:reset }
Run-Step "Generate DB Types"    { npm run db:types:generate }
Run-Step "Format"               { npm run format }
Run-Step "Check DB Types"       { npm run db:types:check }
Run-Step "Validate Database"    { npm run db:validate }
Run-Step "Formatting Check"     { npm run format:check }
Run-Step "Lint"                 { npm run lint }
Run-Step "Typecheck"            { npm run typecheck }
Run-Step "OpenAPI Regression"   { npm run openapi:check }
Run-Step "Application Tests"    { npm test }
Run-Step "Coverage"             { npm run test:coverage }
Run-Step "Build"                { npm run build }
Run-Step "Whitespace Check"     { git diff --check }

Write-Host "`n========== UNSAFE TYPES ==========" -ForegroundColor Cyan
git grep -n -E "\bas any\b|: any\b|as unknown as" -- "src" "tests"
if ($LASTEXITCODE -ne 1 -and $LASTEXITCODE -ne 0) { throw "git grep failed" }

Write-Host "`n========== RPC SECURITY ==========" -ForegroundColor Cyan
git grep -n -E "admin_create_question|admin_update_question|SECURITY INVOKER|REVOKE|GRANT EXECUTE" -- "supabase"

Write-Host "`n========== FINAL CHANGES ==========" -ForegroundColor Cyan
git status --short
git diff --name-status
git diff --stat
