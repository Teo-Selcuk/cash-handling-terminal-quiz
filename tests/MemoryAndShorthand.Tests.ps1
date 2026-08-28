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
    'ConvertTo-NormalizedMemoryAnswer'
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

$memoryChallenge = New-MemoryChallenge -Level Medium -Digits 7
if ($memoryChallenge.Value.Length -ne 7 -or $memoryChallenge.Value -notmatch '^[1-9]\d{6}$') {
    throw 'Memory challenge did not create the requested number of digits.'
}

if ((ConvertTo-NormalizedMemoryAnswer -Text '123 456') -ne '123456') {
    throw 'Memory answers should allow spacing without changing digit order.'
}

Write-Host 'Memory and shorthand structural tests passed.' -ForegroundColor Green
