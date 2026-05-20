$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$frontendPath = Join-Path $repoRoot "MealplannerApp/frontend"
$backendProject = Join-Path $repoRoot "MealplannerApp/MealPlannerApi/MealPlannerApi.csproj"
$npmCommand = if ($IsWindows -or $env:OS -eq "Windows_NT") { "npm.cmd" } else { "npm" }

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string[]] $CommandLine
    )

    $filePath = $CommandLine[0]
    $arguments = if ($CommandLine.Count -gt 1) { $CommandLine[1..($CommandLine.Count - 1)] } else { @() }

    & $filePath $arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$filePath $($arguments -join ' ') failed with exit code $LASTEXITCODE."
    }
}

Push-Location $frontendPath
try {
    Invoke-CheckedCommand -CommandLine @($npmCommand, "install")
    Invoke-CheckedCommand -CommandLine @($npmCommand, "run", "lint")
    Invoke-CheckedCommand -CommandLine @($npmCommand, "run", "build")

    $package = Get-Content "package.json" -Raw | ConvertFrom-Json
    if ($package.scripts.PSObject.Properties.Name -contains "test") {
        Invoke-CheckedCommand -CommandLine @($npmCommand, "test", "--", "--run")
    } else {
        Write-Host "No frontend test script found yet; skipping."
    }
}
finally {
    Pop-Location
}

Invoke-CheckedCommand -CommandLine @("dotnet", "restore", $backendProject)
Invoke-CheckedCommand -CommandLine @("dotnet", "format", $backendProject, "--verify-no-changes", "--verbosity", "diagnostic")
Invoke-CheckedCommand -CommandLine @("dotnet", "build", $backendProject, "--configuration", "Release", "--no-restore")

$testProjects = Get-ChildItem -Path (Join-Path $repoRoot "MealplannerApp") -Recurse -Filter "*Tests.csproj"
if ($testProjects.Count -eq 0) {
    Write-Host "No backend test projects found yet; skipping."
} else {
    foreach ($project in $testProjects) {
        Invoke-CheckedCommand -CommandLine @("dotnet", "test", $project.FullName, "--configuration", "Release", "--no-restore", "--verbosity", "normal")
    }
}
