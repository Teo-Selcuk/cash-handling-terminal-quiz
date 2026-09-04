param(
    [string]$PreviewScreenshotPath = '',
    [switch]$PreviewOnly
)

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
    throw $parseErrors[0]
}

$culture = [System.Globalization.CultureInfo]::GetCultureInfo('en-US')
$allDenominations = @(
    [pscustomobject]@{ Cents = [long]10000; Singular = '$100 bill'; Plural = '$100 bills'; Category = 'Bill' }
    [pscustomobject]@{ Cents = [long]5000; Singular = '$50 bill'; Plural = '$50 bills'; Category = 'Bill' }
    [pscustomobject]@{ Cents = [long]2000; Singular = '$20 bill'; Plural = '$20 bills'; Category = 'Bill' }
    [pscustomobject]@{ Cents = [long]1000; Singular = '$10 bill'; Plural = '$10 bills'; Category = 'Bill' }
    [pscustomobject]@{ Cents = [long]500; Singular = '$5 bill'; Plural = '$5 bills'; Category = 'Bill' }
    [pscustomobject]@{ Cents = [long]100; Singular = '$1 bill'; Plural = '$1 bills'; Category = 'Bill' }
    [pscustomobject]@{ Cents = [long]25; Singular = 'quarter'; Plural = 'quarters'; Category = 'Coin' }
    [pscustomobject]@{ Cents = [long]10; Singular = 'dime'; Plural = 'dimes'; Category = 'Coin' }
    [pscustomobject]@{ Cents = [long]5; Singular = 'nickel'; Plural = 'nickels'; Category = 'Coin' }
    [pscustomobject]@{ Cents = [long]1; Singular = 'penny'; Plural = 'pennies'; Category = 'Coin' }
)

function Format-Money {
    param([long]$Cents)

    $amount = ([decimal]$Cents) / [decimal]100
    return ('$' + $amount.ToString('N2', $culture))
}

$cashBuilderFunction = $ast.Find(
    {
        param($node)
        $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
        $node.Name -eq 'Read-ClickableCashAnswer'
    },
    $true
)

if ($null -eq $cashBuilderFunction) {
    throw 'Read-ClickableCashAnswer was not found in the quiz script.'
}

Invoke-Expression $cashBuilderFunction.Extent.Text

$question = [pscustomobject]@{
    DueCents = [long]12035
    BreakdownText = 'Smoke-test customer cash'
}
$declaredAnswer = [pscustomobject]@{
    Type = 'Change'
    AmountCents = [long]12035
}

$cashAnswerParameters = @{
    Seconds = 90
    Question = $question
    DeclaredAnswer = $declaredAnswer
}

if (-not [string]::IsNullOrWhiteSpace($PreviewScreenshotPath)) {
    $cashAnswerParameters.PreviewScreenshotPath = $PreviewScreenshotPath
    $cashAnswerParameters.PreviewOnly = $PreviewOnly
}

$result = Read-ClickableCashAnswer @cashAnswerParameters

$result | ConvertTo-Json -Compress

if ($PreviewOnly) {
    if (-not (Test-Path -LiteralPath $PreviewScreenshotPath)) {
        throw 'The cash-builder visual preview was not created.'
    }

    exit 0
}

if (
    -not $result.Valid -or
    -not $result.BreakdownMatchesAmount -or
    $result.CashTotalCents -ne 12035
) {
    exit 1
}
