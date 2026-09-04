$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot '..\Cash-Handling-Terminal-Quiz.ps1'
$source = Get-Content -LiteralPath $scriptPath -Raw
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

function Import-QuizFunction {
    param([string]$Name)

    $definition = $ast.Find(
        {
            param($node)
            $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
            $node.Name -eq $Name
        },
        $true
    )

    if ($null -eq $definition) {
        throw "Missing customer bill request function: $Name"
    }

    $globalDefinition = [regex]::Replace(
        $definition.Extent.Text,
        ('(?im)^function\s+' + [regex]::Escape($Name) + '\b'),
        ('function global:' + $Name),
        1
    )
    Invoke-Expression $globalDefinition
}

foreach ($functionName in @(
        'Format-Money',
        'Get-RecommendedQuizDataDirectory',
        'Get-DefaultQuizSettings',
        'Read-QuizSettings',
        'Save-QuizSettings',
        'Resolve-QuizDataDirectory',
        'Get-CashBreakdown',
        'Format-CashBreakdown',
        'Get-CustomerBillDenominations',
        'New-CustomerCashCounts',
        'ConvertTo-CustomerCashBreakdown',
        'Get-CustomerBillCount',
        'Get-CustomerBillList',
        'Split-OneCustomerBill',
        'New-CustomerBillRequest',
        'Test-CustomerBillRequest',
        'Get-RecommendedBreakdownText',
        'Get-RecommendedAnswerGuidance'
    )) {
    Import-QuizFunction -Name $functionName
}

function New-CountsFromBreakdown {
    param([object[]]$Breakdown)

    $counts = @{}
    foreach ($denomination in $allDenominations) {
        $counts[[string]$denomination.Cents] = [long]0
    }
    foreach ($item in $Breakdown) {
        $counts[[string]$item.Cents] = [long]$item.Count
    }
    return $counts
}

$targetCents = [long]32000
foreach ($kind in @('Specific', 'Remainder', 'Mixed', 'Low', 'High')) {
    $request = New-CustomerBillRequest -AmountCents $targetCents -Kind $kind
    if ($request.Kind -ne $kind -or -not $request.IsValid) {
        throw "$kind request was not generated as a valid request."
    }
    $counts = New-CountsFromBreakdown -Breakdown $request.ExpectedBreakdown
    $result = Test-CustomerBillRequest -Request $request -Counts $counts
    if (-not $result.Matches) {
        throw "$kind request did not accept its example cash selection."
    }
}

$mismatched = New-CustomerBillRequest -AmountCents $targetCents -Kind Mismatch
if ($mismatched.IsValid -or -not $mismatched.CanFlag -or $mismatched.RequestedCents -ne 35000) {
    throw 'The $320 mismatch request was not flagged as a $350 request.'
}
if ($mismatched.Text -notmatch '10 x \$20 bills, 1 x \$50 bill, and 1 x \$100 bill') {
    throw 'The mismatch request did not explain the requested bill counts.'
}

$unsupported = New-CustomerBillRequest -AmountCents $targetCents -Kind Unsupported
if ($unsupported.IsValid -or -not $unsupported.CanFlag -or $unsupported.Text -notmatch '\$30 bill') {
    throw 'An unavailable $30 bill should be flaggable rather than treated as a denomination.'
}

$validGuidanceRequest = New-CustomerBillRequest -AmountCents $targetCents -Kind Specific
$validGuidance = Get-RecommendedAnswerGuidance -Question ([pscustomobject]@{
        ExpectedType = 'Change'
        ExpectedAmountCents = $targetCents
        CustomerBillRequest = $validGuidanceRequest
    })
$expectedRequestedBreakdown = Format-CashBreakdown -Breakdown $validGuidanceRequest.ExpectedBreakdown
if (
    $validGuidance -notmatch 'honor the customer' -or
    $validGuidance -notmatch [regex]::Escape($expectedRequestedBreakdown)
) {
    throw 'Feedback should recommend the valid customer-requested bill mix.'
}

$invalidGuidance = Get-RecommendedAnswerGuidance -Question ([pscustomobject]@{
        ExpectedType = 'Change'
        ExpectedAmountCents = $targetCents
        CustomerBillRequest = $mismatched
    })
if ($invalidGuidance -notmatch 'Flag it' -or $invalidGuidance -notmatch 'exactly \$320\.00') {
    throw 'Feedback should explain both resolution options for an impossible request.'
}

if ($source -notmatch 'CustomerBillRequestsEnabled = \$false') {
    throw 'Customer bill requests must be off by default in saved settings.'
}
if ($source -notmatch 'Include customer bill requests\? \[Y/N\]') {
    throw 'Cash quiz setup must offer the customer bill-request option.'
}
$startQuizDefinition = $ast.Find(
    {
        param($node)
        $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
        $node.Name -eq 'Start-CashQuiz'
    },
    $true
)

if ($null -eq $startQuizDefinition) {
    throw 'Start-CashQuiz was not found.'
}

$startQuizSource = $startQuizDefinition.Extent.Text
if ($startQuizSource -notmatch 'Read-CustomerBillRequestsSetting') {
    throw 'Cash quiz setup must read the customer bill-request option.'
}
if ($startQuizSource -notmatch 'IncludeCustomerBillRequests:\$customerBillRequestsForQuiz') {
    throw 'Cash questions must be generated with the customer bill-request option.'
}
if ($startQuizSource -notmatch '-CustomerBillRequest\s+\$question\.CustomerBillRequest') {
    throw 'Cash-builder handoff must receive the customer bill request.'
}

$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('Cash-Handling-Customer-Request-Test-' + [guid]::NewGuid().ToString('N'))
try {
    $settingsPath = Join-Path $temporaryRoot 'Settings.json'
    $settings = Get-DefaultQuizSettings
    if ($settings.CustomerBillRequestsEnabled) {
        throw 'Customer bill requests should be off by default.'
    }

    $settings.CustomerBillRequestsEnabled = $true
    Save-QuizSettings -Settings $settings -Path $settingsPath
    $loadedSettings = Read-QuizSettings -Path $settingsPath
    if (-not $loadedSettings.CustomerBillRequestsEnabled) {
        throw 'Customer bill request setting was not persisted.'
    }
}
finally {
    if (Test-Path -LiteralPath $temporaryRoot) {
        Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
    }
}

Write-Host 'Customer bill request tests passed.' -ForegroundColor Green
