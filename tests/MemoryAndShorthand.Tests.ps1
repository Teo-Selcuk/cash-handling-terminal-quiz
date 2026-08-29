$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot '..\Cash-Handling-Terminal-Quiz.ps1'
$source = Get-Content -LiteralPath $scriptPath -Raw

function Assert-Contains {
    param([string]$Needle, [string]$Label)

    if (-not $source.Contains($Needle)) {
        throw "Missing $Label."
    }
}

Assert-Contains 'function ConvertFrom-CashBuilderShorthand' 'cash-builder shorthand parser'
Assert-Contains 'function New-MemoryChallenge' 'memory challenge generator'
Assert-Contains 'function Start-MemoryQuiz' 'memory-game terminal workflow'
Assert-Contains 'Apply fast entry' 'cash-builder fast-entry control'
Assert-Contains '[2] Number memory game' 'memory-game main menu option'
Assert-Contains 'AutoContinueOnTimeoutEnabled = $false' 'off-by-default auto-continue setting'
Assert-Contains 'function Read-AutoContinueOnTimeoutSetting' 'auto-continue setup prompt'

$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
    $scriptPath,
    [ref]$tokens,
    [ref]$parseErrors
)

if ($parseErrors.Count -gt 0) {
    throw ($parseErrors | ForEach-Object Message | Out-String)
}

$allDenominations = @(10000, 5000, 2000, 1000, 500, 100, 25, 10, 5, 1 | ForEach-Object {
    [pscustomobject]@{ Cents = [long]$_ }
})

foreach ($functionName in @(
    'ConvertFrom-CashBuilderShorthand',
    'New-MemoryChallenge',
    'ConvertTo-NormalizedMemoryAnswer',
    'ConvertTo-NormalizedMemoryAnswerList',
    'Read-AutoContinueOnTimeoutSetting'
)) {
    $functionAst = $ast.FindAll({
        param($node)
        $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
        $node.Name -eq $functionName
    }, $true) | Select-Object -First 1

    if ($null -eq $functionAst) {
        throw "Could not load $functionName for behavior tests."
    }

    Invoke-Expression $functionAst.Extent.Text
}

$fastEntry = ConvertFrom-CashBuilderShorthand -Text '2x$10, one $1 bill, 2d, two quarters'
if (-not $fastEntry.Valid -or $fastEntry.Counts['1000'] -ne 2 -or $fastEntry.Counts['25'] -ne 2 -or $fastEntry.Counts['10'] -ne 2) {
    throw 'Fast cash entry did not build the requested bill and coin counts.'
}

if ((ConvertFrom-CashBuilderShorthand -Text '2x$10, unknown').Valid) {
    throw 'Fast cash entry accepted an unknown token.'
}

$memoryChallenge = New-MemoryChallenge `
    -Level Medium `
    -MinimumDigits 100 `
    -MaximumDigits 100 `
    -MinimumValues 100 `
    -MaximumValues 100
if (
    $memoryChallenge.ValueCount -ne 100 -or
    $memoryChallenge.Values.Count -ne 100 -or
    @($memoryChallenge.Values | Where-Object { $_ -notmatch '^[1-9]\d{99}$' }).Count -ne 0
) {
    throw 'Memory challenge did not create up to 100 requested values with 100 digits each.'
}

if ((ConvertTo-NormalizedMemoryAnswer -Text '123 456') -ne '123456') {
    throw 'Memory answers should allow spacing without changing digit order.'
}

$memoryAnswers = @(ConvertTo-NormalizedMemoryAnswerList -Text '123 456, 789 012')
if ($memoryAnswers.Count -ne 2 -or $memoryAnswers[0] -ne '123456' -or $memoryAnswers[1] -ne '789012') {
    throw 'Memory answers should preserve comma-separated values while allowing spaces inside each value.'
}

$script:autoContinuePromptAnswers = [System.Collections.Queue]::new()
$script:autoContinuePromptAnswers.Enqueue('')
$script:autoContinuePromptAnswers.Enqueue('Y')
$script:autoContinuePromptAnswers.Enqueue('')

function Read-Host {
    param([string]$Prompt)

    return $script:autoContinuePromptAnswers.Dequeue()
}

if (Read-AutoContinueOnTimeoutSetting -Default $false) {
    throw 'An empty auto-continue answer should keep the default off.'
}

if (-not (Read-AutoContinueOnTimeoutSetting -Default $false)) {
    throw 'Y should turn auto-continue on for the current session.'
}

if (-not (Read-AutoContinueOnTimeoutSetting -Default $true)) {
    throw 'An empty auto-continue answer should keep a saved on default.'
}

Remove-Item -LiteralPath Function:\Read-Host -Force

foreach ($functionName in @('Start-CashQuiz', 'Start-MemoryQuiz')) {
    $functionAst = $ast.FindAll({
        param($node)
        $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
        $node.Name -eq $functionName
    }, $true) | Select-Object -First 1

    if ($null -eq $functionAst) {
        throw "Could not load $functionName for auto-continue checks."
    }

    $functionSource = $functionAst.Extent.Text
    if ($functionSource -notmatch 'Read-AutoContinueOnTimeoutSetting') {
        throw "$functionName does not offer the auto-continue setting."
    }

    if ($functionSource -notmatch 'TimedOut\s+-and\s+\$autoContinueOnTimeout') {
        throw "$functionName does not skip its next-question pause after a timeout."
    }
}

$memoryWorkflow = $ast.FindAll({
    param($node)
    $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
    $node.Name -eq 'Start-MemoryQuiz'
}, $true) | Select-Object -First 1

if ($memoryWorkflow.Extent.Text -notmatch 'Minimum values per round' -or
    $memoryWorkflow.Extent.Text -notmatch 'Maximum values per round' -or
    $memoryWorkflow.Extent.Text -notmatch 'Maximum 100') {
    throw 'Number Memory does not expose the 100-value range in the PowerShell workflow.'
}

Write-Host 'Memory and shorthand structural tests passed.' -ForegroundColor Green
