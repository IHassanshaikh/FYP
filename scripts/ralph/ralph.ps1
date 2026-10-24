<#
.SYNOPSIS
  Ralph Wiggum - Autonomous AI Agent Loop for Windows (PowerShell)
.DESCRIPTION
  Runs AI coding tool (Claude Code or Amp) in fresh iterations until PRD items are complete.
  Each iteration runs with clean context window. State persists via git, prd.json, progress.txt.
.PARAMETER Tool
  "claude" (default) or "amp"
.PARAMETER MaxIterations
  Maximum number of loops to execute (default: 10)
#>
param (
    [string]$Tool = "claude",
    [int]$MaxIterations = 10
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PrdFile = Join-Path $ScriptDir "prd.json"
$ProgressFile = Join-Path $ScriptDir "progress.txt"
$ArchiveDir = Join-Path $ScriptDir "archive"
$LastBranchFile = Join-Path $ScriptDir ".last-branch"
$ClaudePromptFile = Join-Path $ScriptDir "CLAUDE.md"
$AmpPromptFile = Join-Path $ScriptDir "prompt.md"

if ($Tool -ne "claude" -and $Tool -ne "amp") {
    Write-Error "Invalid tool '$Tool'. Must be 'claude' or 'amp'."
    exit 1
}

# Archive previous run if branch changed
if ((Test-Path $PrdFile) -and (Test-Path $LastBranchFile)) {
    try {
        $prdContent = Get-Content $PrdFile -Raw | ConvertFrom-Json
        $currentBranch = $prdContent.branchName
        $lastBranch = (Get-Content $LastBranchFile -Raw).Trim()

        if ($currentBranch -and $lastBranch -and ($currentBranch -ne $lastBranch)) {
            $date = Get-Date -Format "yyyy-MM-dd"
            $folderName = $lastBranch -replace "^ralph/", ""
            $archiveFolder = Join-Path $ArchiveDir "$date-$folderName"

            Write-Host "Archiving previous run: $lastBranch to $archiveFolder" -ForegroundColor Cyan
            New-Item -ItemType Directory -Path $archiveFolder -Force | Out-Null
            if (Test-Path $PrdFile) { Copy-Item $PrdFile $archiveFolder -Force }
            if (Test-Path $ProgressFile) { Copy-Item $ProgressFile $archiveFolder -Force }

            Set-Content -Path $ProgressFile -Value "# Ralph Progress Log`nStarted: $(Get-Date)`n---`n"
        }
    } catch {
        Write-Warning "Could not parse previous branch metadata: $_"
    }
}

# Track current branch
if (Test-Path $PrdFile) {
    try {
        $prdContent = Get-Content $PrdFile -Raw | ConvertFrom-Json
        if ($prdContent.branchName) {
            Set-Content -Path $LastBranchFile -Value $prdContent.branchName -Force
        }
    } catch {}
}

# Ensure progress file exists
if (-not (Test-Path $ProgressFile)) {
    Set-Content -Path $ProgressFile -Value "# Ralph Progress Log`nStarted: $(Get-Date)`n---`n"
}

Write-Host "===============================================================" -ForegroundColor Yellow
Write-Host "  Starting Ralph Loop - Tool: $Tool - Max: $MaxIterations" -ForegroundColor Yellow
Write-Host "===============================================================" -ForegroundColor Yellow

for ($i = 1; $i -le $MaxIterations; $i++) {
    Write-Host ""
    Write-Host "===============================================================" -ForegroundColor Cyan
    Write-Host "  Ralph Iteration $i of $MaxIterations ($Tool)" -ForegroundColor Cyan
    Write-Host "===============================================================" -ForegroundColor Cyan

    $output = ""
    if ($Tool -eq "claude") {
        # Feed CLAUDE.md into claude code
        $promptText = Get-Content $ClaudePromptFile -Raw
        $output = & claude --dangerously-skip-permissions --print $promptText 2>&1 | Out-String
        Write-Host $output
    } else {
        $promptText = Get-Content $AmpPromptFile -Raw
        $output = & amp --dangerously-allow-all $promptText 2>&1 | Out-String
        Write-Host $output
    }

    if ($output -match "<promise>COMPLETE</promise>") {
        Write-Host ""
        Write-Host "Ralph completed all tasks in $PrdFile!" -ForegroundColor Green
        Write-Host "Completed at iteration $i of $MaxIterations" -ForegroundColor Green
        exit 0
    }

    Write-Host "Iteration $i complete. Continuing..." -ForegroundColor Gray
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "Ralph reached max iterations ($MaxIterations) without completing all tasks." -ForegroundColor Yellow
Write-Host "Check $ProgressFile for status." -ForegroundColor Yellow
exit 1
