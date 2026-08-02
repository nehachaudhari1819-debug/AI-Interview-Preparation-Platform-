$ErrorActionPreference = "Stop"

$Doc = "docs/backend/phase-6/02-interview-answer-evaluation-result-database-foundation.md"
$Migration = "supabase/migrations/20260101000025_phase6_2_interview_answer_evaluation_result_foundation.sql"
$Patch = "p6_2_gate_b_migration25_corrected_native.patch"

Write-Host "Adding intent-to-add entries..."
git add -N -- $Doc $Migration

Write-Host "Running git diff --check..."
git diff --check
$diffCheckExit = $LASTEXITCODE

if ($diffCheckExit -ne 0) {
    Write-Host "Trailing whitespace detected! Aborting patch generation."
    git reset
    exit 1
}

Write-Host "Generating native patch (UTF-8)..."
git diff | Out-File -Encoding UTF8 -FilePath $Patch

Write-Host "Resetting intent-to-add entries..."
git reset

Write-Host "Copying patch to artifacts directory..."
Copy-Item $Patch -Destination "C:\Users\rondp\.gemini\antigravity-ide\brain\b879197a-b6bd-44a8-a065-dacf5ced1390\" -Force

Write-Host "Verification complete. Patch generated at: $Patch"
