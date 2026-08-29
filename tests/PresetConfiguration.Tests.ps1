$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot '..\Cash-Handling-Terminal-Quiz.ps1'
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

foreach ($functionName in @(
        'Get-RecommendedQuizDataDirectory',
        'New-DefaultCashDifficultyPresets',
        'New-DefaultMemoryDifficultyPresets',
        'Get-DefaultQuizSettings',
        'Get-RequiredPresetProperty',
        'ConvertTo-PresetInteger',
        'Test-CashDifficultyPreset',
        'Test-MemoryDifficultyPreset',
        'Format-Money',
        'Get-LevelConfig',
        'Get-MemoryModeConfig',
        'Read-IntegerSetting',
        'Read-MoneySetting',
        'Read-Difficulty',
        'Set-CashDifficultyPreset',
        'Set-MemoryDifficultyPreset',
        'Restore-DifficultyPresets'
    )) {
    $definition = $ast.Find(
        {
            param($node)
            $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
            $node.Name -eq $functionName
        },
        $true
    )
    if ($null -eq $definition) {
        throw "Could not load $functionName for preset tests."
    }
    Invoke-Expression $definition.Extent.Text
}

$global:culture = [System.Globalization.CultureInfo]::GetCultureInfo('en-US')
$global:appState = [pscustomobject]@{
    Settings = Get-DefaultQuizSettings
}

$script:answers = [System.Collections.Queue]::new()
foreach ($answer in @('e', '5', '200', '25', '60', '2')) {
    $script:answers.Enqueue($answer)
}

function Read-Host {
    param([string]$Prompt)

    return $script:answers.Dequeue()
}

if (-not (Set-CashDifficultyPreset)) {
    throw 'The custom Easy cash preset was not accepted.'
}

$cash = Get-LevelConfig -Level Easy
if ($cash.MinDue -ne 500 -or $cash.MaxDue -ne 20000 -or $cash.Step -ne 25 -or $cash.MaxDifference -ne 6000 -or $cash.SplitCount -ne 2) {
    throw 'The saved Easy cash preset was not returned by the quiz configuration.'
}

$script:answers = [System.Collections.Queue]::new()
foreach ($answer in @('h', '3', '6', '8', '12', '4', '9')) {
    $script:answers.Enqueue($answer)
}

if (-not (Set-MemoryDifficultyPreset)) {
    throw 'The custom Hard number-memory preset was not accepted.'
}

$memory = Get-MemoryModeConfig -Level Hard
if ($memory.MinimumValues -ne 3 -or $memory.MaximumValues -ne 6 -or $memory.MinimumDigits -ne 8 -or $memory.MaximumDigits -ne 12 -or $memory.ReadSeconds -ne 4 -or $memory.WriteSeconds -ne 9) {
    throw 'The saved Hard number-memory preset was not returned by the game configuration.'
}

Restore-DifficultyPresets
if ((Get-LevelConfig -Level Easy).MaxDue -ne 20000 -or (Get-MemoryModeConfig -Level Hard).MaximumDigits -ne 10) {
    throw 'Restoring presets did not return the shipped difficulty values.'
}

Remove-Item -LiteralPath Function:\Read-Host -Force
Remove-Variable -Name appState, culture -Scope Global

Write-Host 'Preset configuration behavior tests passed.' -ForegroundColor Green
