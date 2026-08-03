git status --short --untracked-files=all
git diff --stat
git diff --name-status
git diff --check

$Tracked = @(git diff --name-only)
$Untracked = @(git ls-files --others --exclude-standard)
$Files = @($Tracked + $Untracked | Sort-Object -Unique)

"EXACT_FILE_COUNT=$($Files.Count)"
$Files

$ReviewRoot = "$env:TEMP\P6_3_Current_Closure_Review"
$Zip = "$env:USERPROFILE\OneDrive\Desktop\P6_3_Current_Closure_Review.zip"

Remove-Item $ReviewRoot -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $Zip -Force -ErrorAction SilentlyContinue
$null = New-Item -ItemType Directory -Path $ReviewRoot

foreach ($File in $Files) {
  if (-not (Test-Path $File -PathType Leaf)) {
    throw "Missing changed file: $File"
  }

  $Destination = Join-Path $ReviewRoot $File
  $null = New-Item -ItemType Directory -Path (Split-Path $Destination -Parent) -Force

  Copy-Item $File $Destination -Force
}

git status --short --untracked-files=all | Out-File "$ReviewRoot\00-git-status.txt" -Encoding utf8
git diff --stat | Out-File "$ReviewRoot\01-diff-stat.txt" -Encoding utf8
git diff --name-status | Out-File "$ReviewRoot\02-diff-name-status.txt" -Encoding utf8
git diff | Out-File "$ReviewRoot\03-tracked-source.diff" -Encoding utf8
$Files | Out-File "$ReviewRoot\04-exact-file-manifest.txt" -Encoding utf8

Compress-Archive -Path "$ReviewRoot\*" -DestinationPath $Zip -Force

Get-Item $Zip | Select-Object FullName, Length, LastWriteTime
