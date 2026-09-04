$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot '..\Cash-Handling-Terminal-Quiz.ps1'
$source = Get-Content -LiteralPath $scriptPath -Raw

function Assert-Contains {
    param(
        [string]$Needle,
        [string]$Description
    )

    if (-not $source.Contains($Needle)) {
        throw "Missing ${Description}: $Needle"
    }
}

function Assert-Matches {
    param(
        [string]$Pattern,
        [string]$Description
    )

    if ($source -notmatch $Pattern) {
        throw "Missing $Description."
    }
}

Assert-Contains 'function Read-QuizSettings' 'persistent settings loader'
Assert-Contains 'function Save-QuizSettings' 'persistent settings writer'
Assert-Contains 'DefaultQuestionCount' 'saved default question count'
Assert-Contains 'DefaultTimeLimitSeconds' 'saved default time limit'
Assert-Contains 'DataDirectory' 'saved data directory'
Assert-Contains 'ClickableBillCoinModeEnabled = $false' 'off-by-default bill/coin setting'
Assert-Contains 'Use clickable bill/coin mode? [Y/N] [N]' 'bill/coin setup prompt'
Assert-Contains 'function Show-CashConstructionFeedback' 'cash-construction feedback presenter'
Assert-Contains 'Required amount:' 'required amount feedback'
Assert-Contains 'Selected amount:' 'selected amount feedback'
Assert-Contains 'Selected bills/coins:' 'selected denominations feedback'
Assert-Contains 'Difference:' 'incorrect-selection difference feedback'
Assert-Contains 'Example correct breakdown:' 'example correct breakdown feedback'
Assert-Contains 'UserCashBreakdown = $AnswerResult.CashBreakdown' 'selected breakdown history field'
Assert-Contains 'Outcome = $outcome' 'result history field'
Assert-Matches 'DeclaredAnswer' 'declared answer handoff to cash construction'
Assert-Contains '$addButton.Text = ''+''' 'plus denomination control'
Assert-Contains '$removeButton.Text = ''-''' 'minus denomination control'
Assert-Contains '$form.AutoScaleMode = ''Dpi''' 'DPI-aware cash-builder scaling'
Assert-Contains '$form.BackColor = $uiBackground' 'high-contrast cash-builder background'
Assert-Contains '$headerPanel = New-Object System.Windows.Forms.Panel' 'grouped transaction header'
Assert-Contains '$billsGroup.Text = ''BILLS''' 'bills section heading'
Assert-Contains '$coinsGroup.Text = ''COINS''' 'coins section heading'
Assert-Contains '$addButton.AccessibleName' 'accessible add-denomination control'
Assert-Contains '$removeButton.AccessibleName' 'accessible remove-denomination control'
Assert-Contains '$form.AcceptButton = $submitButton' 'keyboard submit action'
Assert-Contains '$form.CancelButton = $cancelButton' 'keyboard cancel action'
Assert-Contains '$form.DrawToBitmap' 'real-form visual snapshot support'
Assert-Contains 'Press Enter to submit' 'visible keyboard shortcut hint'

if ($source.Contains('The selected cash total must match your declared amount.')) {
    throw 'Incorrect cash selections must be submitted for feedback and history, not blocked.'
}

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

foreach ($functionName in @(
        'Format-Money',
        'Read-ClickableModeSetting',
        'Show-CashConstructionFeedback'
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
        throw "Could not load $functionName for cash-construction feedback tests."
    }

    Invoke-Expression $definition.Extent.Text
}

function Get-RecommendedAnswerGuidance {
    param([object]$Question)

    return '1 x $10 bill, 1 x $5 bill, 3 x quarters, 3 x pennies'
}

function Get-FeedbackText {
    param([scriptblock]$Action)

    $records = @(& $Action 6>&1)

    return (
        $records |
            ForEach-Object {
                if ($_ -is [System.Management.Automation.InformationRecord]) {
                    [string]$_.MessageData
                }
                else {
                    [string]$_
                }
            }
    ) -join "`n"
}

$script:promptAnswers = [System.Collections.Queue]::new()
$script:promptAnswers.Enqueue('')
$script:promptAnswers.Enqueue('Y')
$script:promptAnswers.Enqueue('')

function Read-Host {
    param([string]$Prompt)

    return $script:promptAnswers.Dequeue()
}

if (Read-ClickableModeSetting -Default $false) {
    throw 'An empty bill/coin mode answer should keep the default off.'
}

if (-not (Read-ClickableModeSetting -Default $false)) {
    throw 'Y should turn bill/coin mode on for the current quiz.'
}

if (-not (Read-ClickableModeSetting -Default $true)) {
    throw 'An empty bill/coin mode answer should keep a saved on default.'
}

Remove-Item -LiteralPath Function:\Read-Host -Force

$feedbackQuestion = [pscustomobject]@{
    ExpectedAmountCents = [long]1578
}
$incorrectCashAnswer = [pscustomobject]@{
    CashTotalCents = [long]1500
    CashBreakdown = '1 x $10 bill, 1 x $5 bill'
}
$incorrectFeedback = Get-FeedbackText {
    Show-CashConstructionFeedback `
        -Question $feedbackQuestion `
        -AnswerResult $incorrectCashAnswer `
        -Correct $false
}

foreach ($expectedText in @(
        'Required amount: $15.78',
        'Selected amount: $15.00',
        'Selected bills/coins: 1 x $10 bill, 1 x $5 bill',
        'Difference: $0.78 short of the required amount',
        'Result: Incorrect',
        'Example correct breakdown: 1 x $10 bill, 1 x $5 bill, 3 x quarters, 3 x pennies'
    )) {
    if (-not $incorrectFeedback.Contains($expectedText)) {
        throw "Cash-construction feedback was missing: $expectedText"
    }
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
    throw 'Start-CashQuiz was not found for workflow tests.'
}

$startQuizSource = $startQuizDefinition.Extent.Text
$typedAnswerIndex = $startQuizSource.IndexOf('Read-TimedAnswer')
$cashBuilderIndex = $startQuizSource.IndexOf('Read-ClickableCashAnswer')

if ($typedAnswerIndex -lt 0 -or $cashBuilderIndex -lt 0 -or $typedAnswerIndex -ge $cashBuilderIndex) {
    throw 'Cash construction must follow the typed exact/change/short answer.'
}

if (-not $startQuizSource.Contains('-DeclaredAnswer $answerResult')) {
    throw 'The final cash-construction step does not receive the declared answer.'
}

if ($startQuizSource.IndexOf('Read-ClickableModeSetting') -lt 0) {
    throw 'Quiz setup does not ask whether to use bill/coin mode.'
}

if ($startQuizSource.IndexOf('Show-CashConstructionFeedback') -lt 0) {
    throw 'Quiz setup does not show cash-construction feedback after grading.'
}

foreach ($functionName in @(
        'Get-RecommendedQuizDataDirectory',
        'Get-DefaultQuizSettings',
        'Read-QuizSettings',
        'Save-QuizSettings',
        'Resolve-QuizDataDirectory'
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
        throw "Could not load $functionName for settings behavior tests."
    }

    Invoke-Expression $definition.Extent.Text
}

$temporaryRoot = Join-Path `
    ([System.IO.Path]::GetTempPath()) `
    ('Cash-Handling-Quiz-Test-' + [guid]::NewGuid().ToString('N'))

try {
    $settingsPath = Join-Path $temporaryRoot 'Settings.json'
    $configuredDataDirectory = Join-Path $temporaryRoot 'saved-data'
    $settings = Get-DefaultQuizSettings
    $settings.DefaultQuestionCount = 17
    $settings.DefaultTimeLimitSeconds = 45
    $settings.DataDirectory = Resolve-QuizDataDirectory $configuredDataDirectory
    if ($settings.ClickableBillCoinModeEnabled) {
        throw 'Bill/coin mode should default to off.'
    }

    $settings.ClickableBillCoinModeEnabled = $true

    Save-QuizSettings -Settings $settings -Path $settingsPath
    $loadedSettings = Read-QuizSettings -Path $settingsPath

    if ($loadedSettings.DefaultQuestionCount -ne 17) {
        throw 'Default question count was not persisted.'
    }

    if ($loadedSettings.DefaultTimeLimitSeconds -ne 45) {
        throw 'Default time limit was not persisted.'
    }

    if ($loadedSettings.DataDirectory -ne $settings.DataDirectory) {
        throw 'Data directory was not persisted.'
    }

    if (-not $loadedSettings.ClickableBillCoinModeEnabled) {
        throw 'Bill/coin mode setting was not persisted.'
    }
}
finally {
    if (Test-Path -LiteralPath $temporaryRoot) {
        Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
    }
}

Write-Host 'Cash-Handling-Terminal-Quiz structural tests passed.' -ForegroundColor Green
