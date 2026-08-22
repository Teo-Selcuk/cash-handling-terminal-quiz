& {
    Set-StrictMode -Version 2.0
    $ErrorActionPreference = 'Stop'

    $culture = [System.Globalization.CultureInfo]::GetCultureInfo('en-US')

    function Read-QuizDataDirectory {
        $userProfile = [Environment]::GetFolderPath('UserProfile')

        if ([string]::IsNullOrWhiteSpace($userProfile)) {
            $userProfile = $env:USERPROFILE
        }

        $downloads = Join-Path $userProfile 'Downloads'
        $recommendedDirectory = Join-Path $downloads 'Cash-Handling-Quiz-Data'

        while ($true) {
            Write-Host ''
            Write-Host 'QUIZ DATA LOCATION' -ForegroundColor Cyan
            Write-Host 'Recommended: save your quiz history in your Windows Downloads folder.'
            Write-Host "Default folder: $recommendedDirectory" -ForegroundColor DarkGray

            $rawDirectory = Read-Host 'Press Enter to use the recommended folder, or type another folder path'

            if ([string]::IsNullOrWhiteSpace($rawDirectory)) {
                $selectedDirectory = $recommendedDirectory
            }
            else {
                $selectedDirectory = [Environment]::ExpandEnvironmentVariables(
                    $rawDirectory.Trim().Trim('"')
                )

                if ($selectedDirectory -eq '~') {
                    $selectedDirectory = $userProfile
                }
                elseif ($selectedDirectory.StartsWith('~\')) {
                    $selectedDirectory = Join-Path $userProfile $selectedDirectory.Substring(2)
                }
            }

            try {
                if (-not (Test-Path -LiteralPath $selectedDirectory)) {
                    New-Item `
                        -ItemType Directory `
                        -Path $selectedDirectory `
                        -Force | Out-Null
                }

                $resolvedDirectory = (
                    Resolve-Path -LiteralPath $selectedDirectory
                ).Path

                Write-Host "Quiz data will be saved in: $resolvedDirectory" -ForegroundColor Green
                return $resolvedDirectory
            }
            catch {
                Write-Host 'That folder could not be used. Please enter another location.' -ForegroundColor Yellow
                Write-Host $_.Exception.Message -ForegroundColor DarkGray
            }
        }
    }

    $dataDirectory = Read-QuizDataDirectory
    $historyPath = Join-Path $dataDirectory 'Cash-Handling-Quiz-History.csv'

    $allDenominations = @(
        [pscustomobject]@{
            Cents = [long]10000
            Singular = '$100 bill'
            Plural = '$100 bills'
            Category = 'Bill'
        }
        [pscustomobject]@{
            Cents = [long]5000
            Singular = '$50 bill'
            Plural = '$50 bills'
            Category = 'Bill'
        }
        [pscustomobject]@{
            Cents = [long]2000
            Singular = '$20 bill'
            Plural = '$20 bills'
            Category = 'Bill'
        }
        [pscustomobject]@{
            Cents = [long]1000
            Singular = '$10 bill'
            Plural = '$10 bills'
            Category = 'Bill'
        }
        [pscustomobject]@{
            Cents = [long]500
            Singular = '$5 bill'
            Plural = '$5 bills'
            Category = 'Bill'
        }
        [pscustomobject]@{
            Cents = [long]100
            Singular = '$1 bill'
            Plural = '$1 bills'
            Category = 'Bill'
        }
        [pscustomobject]@{
            Cents = [long]25
            Singular = 'quarter'
            Plural = 'quarters'
            Category = 'Coin'
        }
        [pscustomobject]@{
            Cents = [long]10
            Singular = 'dime'
            Plural = 'dimes'
            Category = 'Coin'
        }
        [pscustomobject]@{
            Cents = [long]5
            Singular = 'nickel'
            Plural = 'nickels'
            Category = 'Coin'
        }
        [pscustomobject]@{
            Cents = [long]1
            Singular = 'penny'
            Plural = 'pennies'
            Category = 'Coin'
        }
    )

    function Format-Money {
        param([long]$Cents)

        $amount = ([decimal]$Cents) / [decimal]100
        return ('$' + $amount.ToString('N2', $culture))
    }

    function Get-LevelConfig {
        param(
            [ValidateSet('Easy', 'Medium', 'Hard')]
            [string]$Level
        )

        switch ($Level) {
            'Easy' {
                return [pscustomobject]@{
                    MinDue = [long]500
                    MaxDue = [long]20000
                    Step = [long]25
                    MaxDifference = [long]3000
                    SplitCount = 1
                }
            }

            'Medium' {
                return [pscustomobject]@{
                    MinDue = [long]100
                    MaxDue = [long]100000
                    Step = [long]1
                    MaxDifference = [long]15000
                    SplitCount = 4
                }
            }

            'Hard' {
                return [pscustomobject]@{
                    MinDue = [long]100
                    MaxDue = [long]500000
                    Step = [long]1
                    MaxDifference = [long]75000
                    SplitCount = 8
                }
            }
        }
    }

    function Get-DenominationsForLevel {
        param(
            [ValidateSet('Easy', 'Medium', 'Hard')]
            [string]$Level
        )

        switch ($Level) {
            'Easy' {
                $allowed = @(2000, 1000, 500, 100, 25)
                break
            }

            'Medium' {
                $allowed = @(
                    10000, 5000, 2000, 1000, 500,
                    100, 25, 10, 5, 1
                )
                break
            }

            'Hard' {
                $allowed = @(
                    10000, 5000, 2000, 1000, 500,
                    100, 25, 10, 5, 1
                )
                break
            }
        }

        return @(
            $allDenominations |
                Where-Object {
                    $allowed -contains $_.Cents
                }
        )
    }

    function Get-RandomSteppedNumber {
        param(
            [long]$Minimum,
            [long]$Maximum,
            [long]$Step
        )

        if ($Maximum -lt $Minimum) {
            return $Minimum
        }

        $firstIndex = [long][Math]::Ceiling(
            ([double]$Minimum) / ([double]$Step)
        )

        $lastIndex = [long][Math]::Floor(
            ([double]$Maximum) / ([double]$Step)
        )

        if ($lastIndex -lt $firstIndex) {
            return $Minimum
        }

        $numberOfChoices = [int](
            $lastIndex - $firstIndex + 1
        )

        $offset = Get-Random `
            -Minimum 0 `
            -Maximum $numberOfChoices

        return [long](
            ($firstIndex + $offset) * $Step
        )
    }

    function Get-CashBreakdown {
        param(
            [long]$AmountCents,
            [object[]]$Denominations,
            [int]$SplitCount
        )

        $counts = @{}
        $remaining = $AmountCents

        foreach ($denomination in $Denominations) {
            $count = [long][Math]::Floor(
                ([double]$remaining) /
                ([double]$denomination.Cents)
            )

            $counts[[string]$denomination.Cents] = $count

            $remaining -= (
                $count * [long]$denomination.Cents
            )
        }

        if ($remaining -ne 0) {
            throw 'The cash amount could not be divided into the selected denominations.'
        }

        for (
            $split = 0
            $split -lt $SplitCount
            $split++
        ) {
            $possibleSources = @(
                foreach ($sourceDenomination in $Denominations) {
                    $sourceKey = [string]$sourceDenomination.Cents

                    if ($counts[$sourceKey] -gt 0) {
                        $lowerOptions = @(
                            $Denominations |
                                Where-Object {
                                    $_.Category -eq $sourceDenomination.Category -and
                                    $_.Cents -lt $sourceDenomination.Cents -and
                                    (
                                        $sourceDenomination.Cents %
                                        $_.Cents
                                    ) -eq 0
                                }
                        )

                        if ($lowerOptions.Count -gt 0) {
                            $sourceDenomination
                        }
                    }
                }
            )

            if ($possibleSources.Count -eq 0) {
                break
            }

            $source = $possibleSources | Get-Random

            $lowerChoices = @(
                $Denominations |
                    Where-Object {
                        $_.Category -eq $source.Category -and
                        $_.Cents -lt $source.Cents -and
                        (
                            $source.Cents %
                            $_.Cents
                        ) -eq 0
                    } |
                    Sort-Object Cents -Descending |
                    Select-Object -First 3
            )

            $destination = $lowerChoices | Get-Random

            $sourceKey = [string]$source.Cents
            $destinationKey = [string]$destination.Cents

            $counts[$sourceKey]--

            $counts[$destinationKey] += [long](
                $source.Cents /
                $destination.Cents
            )
        }

        return @(
            foreach ($denomination in $Denominations) {
                $key = [string]$denomination.Cents

                if ($counts[$key] -gt 0) {
                    [pscustomobject]@{
                        Cents = [long]$denomination.Cents
                        Count = [long]$counts[$key]
                        Singular = $denomination.Singular
                        Plural = $denomination.Plural
                    }
                }
            }
        )
    }

    function Format-CashBreakdown {
        param([object[]]$Breakdown)

        $parts = @(
            foreach ($item in $Breakdown) {
                $label = if ($item.Count -eq 1) {
                    $item.Singular
                }
                else {
                    $item.Plural
                }

                "$($item.Count) x $label"
            }
        )

        return ($parts -join ', ')
    }

    function New-CashQuestion {
        param(
            [ValidateSet('Easy', 'Medium', 'Hard')]
            [string]$Level
        )

        $config = Get-LevelConfig -Level $Level

        $denominations = Get-DenominationsForLevel `
            -Level $Level

        do {
            $due = Get-RandomSteppedNumber `
                -Minimum $config.MinDue `
                -Maximum $config.MaxDue `
                -Step $config.Step

            $roll = Get-Random `
                -Minimum 1 `
                -Maximum 101

            if ($roll -le 45) {
                $scenario = 'Change'
            }
            elseif ($roll -le 90) {
                $scenario = 'Short'
            }
            else {
                $scenario = 'Exact'
            }

            switch ($scenario) {
                'Change' {
                    $difference = Get-RandomSteppedNumber `
                        -Minimum $config.Step `
                        -Maximum $config.MaxDifference `
                        -Step $config.Step

                    $tendered = $due + $difference
                }

                'Short' {
                    $maxShort = [long][Math]::Min(
                        [long]$config.MaxDifference,
                        [long]($due - 100)
                    )

                    if ($maxShort -lt $config.Step) {
                        $scenario = 'Exact'
                        $difference = [long]0
                        $tendered = $due
                    }
                    else {
                        $difference = Get-RandomSteppedNumber `
                            -Minimum $config.Step `
                            -Maximum $maxShort `
                            -Step $config.Step

                        $tendered = $due - $difference
                    }
                }

                'Exact' {
                    $difference = [long]0
                    $tendered = $due
                }
            }
        }
        while (
            $tendered -lt 100 -or
            ($tendered % 100) -eq 0
        )

        $breakdown = Get-CashBreakdown `
            -AmountCents $tendered `
            -Denominations $denominations `
            -SplitCount $config.SplitCount

        return [pscustomobject]@{
            DueCents = [long]$due
            TenderedCents = [long]$tendered
            ExpectedType = $scenario
            ExpectedAmountCents = [long]$difference
            Breakdown = $breakdown
            BreakdownText = Format-CashBreakdown `
                -Breakdown $breakdown
        }
    }

    function Read-TimedAnswer {
        param([int]$Seconds)

        $oldTitle = $null
        $canSetTitle = $false

        try {
            $oldTitle = [Console]::Title
            $canSetTitle = $true
        }
        catch {
            $canSetTitle = $false
        }

        $stopwatch = [Diagnostics.Stopwatch]::StartNew()
        $buffer = New-Object System.Text.StringBuilder
        $lastRemaining = -1
        $result = $null

        [Console]::Write('Your answer: ')

        try {
            while (
                $stopwatch.Elapsed.TotalSeconds -lt $Seconds
            ) {
                $remaining = [int][Math]::Ceiling(
                    $Seconds -
                    $stopwatch.Elapsed.TotalSeconds
                )

                if ($remaining -ne $lastRemaining) {
                    if ($canSetTitle) {
                        [Console]::Title = (
                            "Cash Quiz - $remaining seconds left"
                        )
                    }

                    $lastRemaining = $remaining
                }

                if ([Console]::KeyAvailable) {
                    $key = [Console]::ReadKey($true)

                    if ($key.Key -eq [ConsoleKey]::Enter) {
                        [Console]::WriteLine()

                        $result = [pscustomobject]@{
                            Text = $buffer.ToString().Trim()
                            TimedOut = $false
                            Cancelled = $false
                            ElapsedSeconds = [Math]::Round(
                                $stopwatch.Elapsed.TotalSeconds,
                                2
                            )
                        }

                        break
                    }

                    if ($key.Key -eq [ConsoleKey]::Escape) {
                        [Console]::WriteLine()

                        $result = [pscustomobject]@{
                            Text = ''
                            TimedOut = $false
                            Cancelled = $true
                            ElapsedSeconds = [Math]::Round(
                                $stopwatch.Elapsed.TotalSeconds,
                                2
                            )
                        }

                        break
                    }

                    if (
                        $key.Key -eq
                        [ConsoleKey]::Backspace
                    ) {
                        if ($buffer.Length -gt 0) {
                            $buffer.Remove(
                                $buffer.Length - 1,
                                1
                            ) | Out-Null

                            [Console]::Write("`b `b")
                        }

                        continue
                    }

                    if (
                        -not [char]::IsControl(
                            $key.KeyChar
                        )
                    ) {
                        $buffer.Append(
                            $key.KeyChar
                        ) | Out-Null

                        [Console]::Write(
                            $key.KeyChar
                        )
                    }
                }
                else {
                    Start-Sleep -Milliseconds 35
                }
            }

            if ($null -eq $result) {
                [Console]::WriteLine()

                $result = [pscustomobject]@{
                    Text = ''
                    TimedOut = $true
                    Cancelled = $false
                    ElapsedSeconds = [Math]::Round(
                        $stopwatch.Elapsed.TotalSeconds,
                        2
                    )
                }
            }
        }
        finally {
            $stopwatch.Stop()

            if ($canSetTitle) {
                try {
                    [Console]::Title = $oldTitle
                }
                catch {
                }
            }
        }

        return $result
    }

    function ConvertFrom-CashAnswer {
        param([string]$Text)

        if ([string]::IsNullOrWhiteSpace($Text)) {
            return [pscustomobject]@{
                Valid = $false
                Type = ''
                AmountCents = [long]0
            }
        }

        $answer = $Text.Trim().ToLowerInvariant()

        if (
            $answer -match
            '^(e|exact|exact amount)$'
        ) {
            return [pscustomobject]@{
                Valid = $true
                Type = 'Exact'
                AmountCents = [long]0
            }
        }

        $type = ''
        $valueText = ''

        if (
            $answer -match
            '^(?:c|change)\s*:?\s*(.+)$'
        ) {
            $type = 'Change'
            $valueText = $Matches[1]
        }
        elseif (
            $answer -match
            '^(?:s|short|shortage|insufficient\s+by|insufficient)\s*:?\s*(.+)$'
        ) {
            $type = 'Short'
            $valueText = $Matches[1]
        }
        else {
            return [pscustomobject]@{
                Valid = $false
                Type = ''
                AmountCents = [long]0
            }
        }

        $valueText = (
            $valueText -replace '[\$,]', ''
        ).Trim()

        if (
            $valueText -notmatch
            '^(?:\d+|\d*\.\d{1,2})$'
        ) {
            return [pscustomobject]@{
                Valid = $false
                Type = ''
                AmountCents = [long]0
            }
        }

        [decimal]$amount = 0

        $parsed = [decimal]::TryParse(
            $valueText,
            [System.Globalization.NumberStyles]::Number,
            [System.Globalization.CultureInfo]::InvariantCulture,
            [ref]$amount
        )

        if (-not $parsed -or $amount -lt 0) {
            return [pscustomobject]@{
                Valid = $false
                Type = ''
                AmountCents = [long]0
            }
        }

        $cents = [long][Math]::Round(
            $amount * [decimal]100,
            0,
            [MidpointRounding]::AwayFromZero
        )

        return [pscustomobject]@{
            Valid = $true
            Type = $type
            AmountCents = $cents
        }
    }

    function Get-ExpectedAnswerText {
        param([object]$Question)

        switch ($Question.ExpectedType) {
            'Change' {
                return (
                    'Change ' +
                    (Format-Money `
                        $Question.ExpectedAmountCents)
                )
            }

            'Short' {
                return (
                    'Short by ' +
                    (Format-Money `
                        $Question.ExpectedAmountCents)
                )
            }

            'Exact' {
                return 'Exact amount'
            }
        }
    }

    function Show-AnswerSyntaxNote {
        param([bool]$ClickableMode)

        Write-Host ''
        Write-Host 'ANSWER NOTE' -ForegroundColor Cyan
        Write-Host 'E = Exact amount' -ForegroundColor White
        Write-Host 'C = Change' -ForegroundColor White
        Write-Host 'S = Short' -ForegroundColor White

        if ($ClickableMode) {
            Write-Host ''
            Write-Host 'Clickable mode:' -ForegroundColor Cyan
            Write-Host '1. Choose E, C, or S.'
            Write-Host '2. For C or S, type the total amount.'
            Write-Host '3. Click bills and coins until the selected cash equals that total.'
            Write-Host 'For C, the cash is what you give back. For S, it is what the customer still needs to give.'
        }
        else {
            Write-Host ''
            Write-Host 'Typed mode examples:' -ForegroundColor Cyan
            Write-Host 'E          = exact amount'
            Write-Host 'C 12.35    = give $12.35 in change'
            Write-Host 'S 4.10     = customer is $4.10 short'
        }

        Write-Host ''
        Write-Host 'During a question, E means Exact—not Easy.' -ForegroundColor DarkGray
    }

    function Read-ClickableModeSetting {
        while ($true) {
            $raw = (
                Read-Host 'Turn clickable denomination mode ON? [Y/N] [N]'
            ).Trim().ToLowerInvariant()

            if (
                [string]::IsNullOrWhiteSpace($raw) -or
                $raw -eq 'n' -or
                $raw -eq 'no' -or
                $raw -eq 'off'
            ) {
                return $false
            }

            if (
                $raw -eq 'y' -or
                $raw -eq 'yes' -or
                $raw -eq 'on'
            ) {
                return $true
            }

            Write-Host 'Enter Y to turn it on or N to leave it off.' -ForegroundColor Yellow
        }
    }

    function Test-ClickableModeAvailable {
        if ($env:OS -ne 'Windows_NT') {
            return $false
        }

        try {
            Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
            Add-Type -AssemblyName System.Drawing -ErrorAction Stop
            return $true
        }
        catch {
            Write-Host 'Clickable mode could not load on this computer.' -ForegroundColor Yellow
            Write-Host $_.Exception.Message -ForegroundColor DarkGray
            return $false
        }
    }

    function ConvertTo-AmountCents {
        param([string]$Text)

        if ([string]::IsNullOrWhiteSpace($Text)) {
            return [pscustomobject]@{
                Valid = $false
                Cents = [long]0
            }
        }

        $valueText = (
            $Text.Trim() -replace '[\$,]', ''
        ).Trim()

        if (
            $valueText -notmatch
            '^(?:\d+|\d*\.\d{1,2})$'
        ) {
            return [pscustomobject]@{
                Valid = $false
                Cents = [long]0
            }
        }

        [decimal]$amount = 0

        $parsed = [decimal]::TryParse(
            $valueText,
            [System.Globalization.NumberStyles]::Number,
            [System.Globalization.CultureInfo]::InvariantCulture,
            [ref]$amount
        )

        if (-not $parsed -or $amount -lt 0) {
            return [pscustomobject]@{
                Valid = $false
                Cents = [long]0
            }
        }

        $cents = [long][Math]::Round(
            $amount * [decimal]100,
            0,
            [MidpointRounding]::AwayFromZero
        )

        return [pscustomobject]@{
            Valid = $true
            Cents = $cents
        }
    }

    function Get-CountsTotalCents {
        param([hashtable]$Counts)

        [long]$total = 0

        foreach ($denomination in $allDenominations) {
            $key = [string]$denomination.Cents

            if ($Counts.ContainsKey($key)) {
                $total += (
                    [long]$Counts[$key] *
                    [long]$denomination.Cents
                )
            }
        }

        return $total
    }

    function Format-CountsBreakdown {
        param([hashtable]$Counts)

        $parts = @(
            foreach ($denomination in $allDenominations) {
                $key = [string]$denomination.Cents
                [long]$count = 0

                if ($Counts.ContainsKey($key)) {
                    $count = [long]$Counts[$key]
                }

                if ($count -gt 0) {
                    $label = if ($count -eq 1) {
                        $denomination.Singular
                    }
                    else {
                        $denomination.Plural
                    }

                    "$count x $label"
                }
            }
        )

        if ($parts.Count -eq 0) {
            return '<NONE>'
        }

        return ($parts -join ', ')
    }

    function Get-RecommendedBreakdownText {
        param([long]$AmountCents)

        if ($AmountCents -eq 0) {
            return 'No cash is needed.'
        }

        $breakdown = Get-CashBreakdown `
            -AmountCents $AmountCents `
            -Denominations $allDenominations `
            -SplitCount 0

        return Format-CashBreakdown -Breakdown $breakdown
    }

    function Get-RecommendedAnswerGuidance {
        param([object]$Question)

        switch ($Question.ExpectedType) {
            'Change' {
                return (
                    'One way to give the customer ' +
                    (Format-Money $Question.ExpectedAmountCents) +
                    ' in change: ' +
                    (Get-RecommendedBreakdownText $Question.ExpectedAmountCents)
                )
            }

            'Short' {
                return (
                    'The customer still needs to give ' +
                    (Format-Money $Question.ExpectedAmountCents) +
                    '. One possible combination: ' +
                    (Get-RecommendedBreakdownText $Question.ExpectedAmountCents)
                )
            }

            'Exact' {
                return 'The customer gave the exact amount. No change or additional cash is needed.'
            }
        }
    }

    function ConvertTo-NormalizedTypedAnswer {
        param([object]$TimedAnswer)

        $parsedAnswer = ConvertFrom-CashAnswer -Text $TimedAnswer.Text

        $validationMessage = if ($TimedAnswer.TimedOut) {
            'Time expired.'
        }
        elseif ($TimedAnswer.Cancelled) {
            'Quiz cancelled.'
        }
        elseif (-not $parsedAnswer.Valid) {
            'Use E, C followed by an amount, or S followed by an amount.'
        }
        else {
            ''
        }

        return [pscustomobject]@{
            Text = $TimedAnswer.Text
            TimedOut = [bool]$TimedAnswer.TimedOut
            Cancelled = [bool]$TimedAnswer.Cancelled
            ElapsedSeconds = [double]$TimedAnswer.ElapsedSeconds
            Valid = [bool]$parsedAnswer.Valid
            Type = [string]$parsedAnswer.Type
            AmountCents = [long]$parsedAnswer.AmountCents
            CashTotalCents = [long]0
            CashBreakdown = '<NOT REQUIRED IN TYPED MODE>'
            BreakdownMatchesAmount = $true
            ValidationMessage = $validationMessage
        }
    }

    function Read-ClickableCashAnswer {
        param(
            [int]$Seconds,
            [object]$Question
        )

        Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop
        Add-Type -AssemblyName System.Drawing -ErrorAction Stop
        [System.Windows.Forms.Application]::EnableVisualStyles()

        $counts = @{}

        foreach ($denomination in $allDenominations) {
            $counts[[string]$denomination.Cents] = [long]0
        }

        $state = @{
            Counts = $counts
            Submitted = $false
            TimedOut = $false
            Cancelled = $false
            Type = ''
            AmountCents = [long]0
            CashTotalCents = [long]0
            CashBreakdown = '<NONE>'
            BreakdownMatchesAmount = $false
            Text = ''
            ValidationMessage = ''
        }

        $denominationsForForm = @($allDenominations)
        $localCulture = $culture

        $getLocalCashTotal = {
            param([hashtable]$LocalCounts)

            [long]$localTotal = 0

            foreach ($localDenomination in $denominationsForForm) {
                $localKey = [string]$localDenomination.Cents
                $localTotal += (
                    [long]$LocalCounts[$localKey] *
                    [long]$localDenomination.Cents
                )
            }

            return $localTotal
        }.GetNewClosure()

        $formatLocalMoney = {
            param([long]$LocalCents)

            $localAmount = ([decimal]$LocalCents) / [decimal]100
            return ('$' + $localAmount.ToString('N2', $localCulture))
        }.GetNewClosure()

        $parseLocalAmount = {
            param([string]$LocalText)

            if ([string]::IsNullOrWhiteSpace($LocalText)) {
                return [pscustomobject]@{
                    Valid = $false
                    Cents = [long]0
                }
            }

            $localValueText = (
                $LocalText.Trim() -replace '[\$,]', ''
            ).Trim()

            if (
                $localValueText -notmatch
                '^(?:\d+|\d*\.\d{1,2})$'
            ) {
                return [pscustomobject]@{
                    Valid = $false
                    Cents = [long]0
                }
            }

            [decimal]$localAmount = 0

            $localParsed = [decimal]::TryParse(
                $localValueText,
                [System.Globalization.NumberStyles]::Number,
                [System.Globalization.CultureInfo]::InvariantCulture,
                [ref]$localAmount
            )

            if (-not $localParsed -or $localAmount -lt 0) {
                return [pscustomobject]@{
                    Valid = $false
                    Cents = [long]0
                }
            }

            return [pscustomobject]@{
                Valid = $true
                Cents = [long][Math]::Round(
                    $localAmount * [decimal]100,
                    0,
                    [MidpointRounding]::AwayFromZero
                )
            }
        }.GetNewClosure()

        $formatLocalBreakdown = {
            param([hashtable]$LocalCounts)

            $localParts = @(
                foreach ($localDenomination in $denominationsForForm) {
                    $localKey = [string]$localDenomination.Cents
                    [long]$localCount = [long]$LocalCounts[$localKey]

                    if ($localCount -gt 0) {
                        $localLabel = if ($localCount -eq 1) {
                            $localDenomination.Singular
                        }
                        else {
                            $localDenomination.Plural
                        }

                        "$localCount x $localLabel"
                    }
                }
            )

            if ($localParts.Count -eq 0) {
                return '<NONE>'
            }

            return ($localParts -join ', ')
        }.GetNewClosure()

        $stopwatch = [Diagnostics.Stopwatch]::StartNew()

        $form = New-Object System.Windows.Forms.Form
        $form.Text = 'Cash Handling Quiz - Clickable Denomination Mode'
        $form.StartPosition = 'CenterScreen'
        $form.ClientSize = New-Object System.Drawing.Size(960, 735)
        $form.FormBorderStyle = 'FixedDialog'
        $form.MaximizeBox = $false
        $form.MinimizeBox = $false
        $form.TopMost = $true

        $questionLabel = New-Object System.Windows.Forms.Label
        $questionLabel.Location = New-Object System.Drawing.Point(20, 15)
        $questionLabel.Size = New-Object System.Drawing.Size(700, 90)
        $questionLabel.Font = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.FontStyle]::Bold)
        $questionLabel.Text = (
            'Customer owes: ' +
            (Format-Money $Question.DueCents) +
            "`r`nCustomer hands you:`r`n" +
            $Question.BreakdownText
        )
        $form.Controls.Add($questionLabel)

        $timerLabel = New-Object System.Windows.Forms.Label
        $timerLabel.Location = New-Object System.Drawing.Point(735, 20)
        $timerLabel.Size = New-Object System.Drawing.Size(205, 45)
        $timerLabel.TextAlign = 'MiddleCenter'
        $timerLabel.Font = New-Object System.Drawing.Font('Segoe UI', 12, [System.Drawing.FontStyle]::Bold)
        $timerLabel.Text = "Time remaining: $Seconds"
        $form.Controls.Add($timerLabel)

        $instructionLabel = New-Object System.Windows.Forms.Label
        $instructionLabel.Location = New-Object System.Drawing.Point(20, 108)
        $instructionLabel.Size = New-Object System.Drawing.Size(920, 42)
        $instructionLabel.Text = 'Choose E, C, or S. For C or S, enter the total and build the same amount with the bill and coin buttons.'
        $form.Controls.Add($instructionLabel)

        $exactRadio = New-Object System.Windows.Forms.RadioButton
        $exactRadio.Location = New-Object System.Drawing.Point(25, 150)
        $exactRadio.Size = New-Object System.Drawing.Size(150, 30)
        $exactRadio.Text = 'E - Exact amount'
        $form.Controls.Add($exactRadio)

        $changeRadio = New-Object System.Windows.Forms.RadioButton
        $changeRadio.Location = New-Object System.Drawing.Point(205, 150)
        $changeRadio.Size = New-Object System.Drawing.Size(145, 30)
        $changeRadio.Text = 'C - Change'
        $form.Controls.Add($changeRadio)

        $shortRadio = New-Object System.Windows.Forms.RadioButton
        $shortRadio.Location = New-Object System.Drawing.Point(380, 150)
        $shortRadio.Size = New-Object System.Drawing.Size(145, 30)
        $shortRadio.Text = 'S - Short'
        $form.Controls.Add($shortRadio)

        $amountLabel = New-Object System.Windows.Forms.Label
        $amountLabel.Location = New-Object System.Drawing.Point(25, 190)
        $amountLabel.Size = New-Object System.Drawing.Size(250, 25)
        $amountLabel.Text = 'Total change or shortage amount:'
        $form.Controls.Add($amountLabel)

        $amountTextBox = New-Object System.Windows.Forms.TextBox
        $amountTextBox.Location = New-Object System.Drawing.Point(285, 187)
        $amountTextBox.Size = New-Object System.Drawing.Size(150, 30)
        $amountTextBox.Font = New-Object System.Drawing.Font('Segoe UI', 11)
        $form.Controls.Add($amountTextBox)

        $selectedTotalLabel = New-Object System.Windows.Forms.Label
        $selectedTotalLabel.Location = New-Object System.Drawing.Point(475, 188)
        $selectedTotalLabel.Size = New-Object System.Drawing.Size(300, 30)
        $selectedTotalLabel.Font = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.FontStyle]::Bold)
        $selectedTotalLabel.Text = 'Selected cash total: $0.00'
        $form.Controls.Add($selectedTotalLabel)

        $purposeLabel = New-Object System.Windows.Forms.Label
        $purposeLabel.Location = New-Object System.Drawing.Point(25, 222)
        $purposeLabel.Size = New-Object System.Drawing.Size(900, 30)
        $purposeLabel.Text = 'C: select what you give back. S: select what the customer still needs to give. E: select no cash.'
        $form.Controls.Add($purposeLabel)

        $countLabels = @{}
        $rowHeight = 68

        for ($index = 0; $index -lt $allDenominations.Count; $index++) {
            $denomination = $allDenominations[$index]
            $column = $index % 2
            $row = [Math]::Floor($index / 2)
            $x = 20 + ($column * 465)
            $y = 255 + ($row * $rowHeight)

            $panel = New-Object System.Windows.Forms.Panel
            $panel.Location = New-Object System.Drawing.Point($x, $y)
            $panel.Size = New-Object System.Drawing.Size(445, 60)
            $panel.BorderStyle = 'FixedSingle'
            $form.Controls.Add($panel)

            $nameLabel = New-Object System.Windows.Forms.Label
            $nameLabel.Location = New-Object System.Drawing.Point(10, 18)
            $nameLabel.Size = New-Object System.Drawing.Size(145, 27)
            $nameLabel.Font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
            $nameLabel.Text = $denomination.Singular
            $panel.Controls.Add($nameLabel)

            $addButton = New-Object System.Windows.Forms.Button
            $addButton.Location = New-Object System.Drawing.Point(160, 10)
            $addButton.Size = New-Object System.Drawing.Size(100, 38)
            $addButton.Text = 'Add one'
            $panel.Controls.Add($addButton)

            $removeButton = New-Object System.Windows.Forms.Button
            $removeButton.Location = New-Object System.Drawing.Point(270, 10)
            $removeButton.Size = New-Object System.Drawing.Size(80, 38)
            $removeButton.Text = 'Remove'
            $panel.Controls.Add($removeButton)

            $countLabel = New-Object System.Windows.Forms.Label
            $countLabel.Location = New-Object System.Drawing.Point(360, 17)
            $countLabel.Size = New-Object System.Drawing.Size(75, 28)
            $countLabel.Font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
            $countLabel.Text = 'Count: 0'
            $panel.Controls.Add($countLabel)

            $keyCopy = [string]$denomination.Cents
            $countLabels[$keyCopy] = $countLabel

            $addButton.Add_Click({
                $state.Counts[$keyCopy] = [long]$state.Counts[$keyCopy] + 1

                [long]$newTotal = & $getLocalCashTotal $state.Counts
                $selectedTotalLabel.Text = 'Selected cash total: ' + (& $formatLocalMoney $newTotal)

                foreach ($item in $allDenominations) {
                    $itemKey = [string]$item.Cents
                    $countLabels[$itemKey].Text = 'Count: ' + [string]$state.Counts[$itemKey]
                }
            }.GetNewClosure())

            $removeButton.Add_Click({
                if ([long]$state.Counts[$keyCopy] -gt 0) {
                    $state.Counts[$keyCopy] = [long]$state.Counts[$keyCopy] - 1
                }

                [long]$newTotal = & $getLocalCashTotal $state.Counts
                $selectedTotalLabel.Text = 'Selected cash total: ' + (& $formatLocalMoney $newTotal)

                foreach ($item in $allDenominations) {
                    $itemKey = [string]$item.Cents
                    $countLabels[$itemKey].Text = 'Count: ' + [string]$state.Counts[$itemKey]
                }
            }.GetNewClosure())
        }

        $errorLabel = New-Object System.Windows.Forms.Label
        $errorLabel.Location = New-Object System.Drawing.Point(25, 600)
        $errorLabel.Size = New-Object System.Drawing.Size(910, 42)
        $errorLabel.ForeColor = [System.Drawing.Color]::DarkRed
        $errorLabel.Font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
        $form.Controls.Add($errorLabel)

        $submitButton = New-Object System.Windows.Forms.Button
        $submitButton.Location = New-Object System.Drawing.Point(25, 655)
        $submitButton.Size = New-Object System.Drawing.Size(215, 50)
        $submitButton.Text = 'Submit answer'
        $submitButton.Font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
        $form.Controls.Add($submitButton)

        $clearButton = New-Object System.Windows.Forms.Button
        $clearButton.Location = New-Object System.Drawing.Point(265, 655)
        $clearButton.Size = New-Object System.Drawing.Size(190, 50)
        $clearButton.Text = 'Clear selections'
        $form.Controls.Add($clearButton)

        $cancelButton = New-Object System.Windows.Forms.Button
        $cancelButton.Location = New-Object System.Drawing.Point(480, 655)
        $cancelButton.Size = New-Object System.Drawing.Size(190, 50)
        $cancelButton.Text = 'Stop quiz'
        $form.Controls.Add($cancelButton)

        $clearButton.Add_Click({
            foreach ($key in @($state.Counts.Keys)) {
                $state.Counts[$key] = [long]0
            }

            $exactRadio.Checked = $false
            $changeRadio.Checked = $false
            $shortRadio.Checked = $false
            $amountTextBox.Text = ''
            $errorLabel.Text = ''
            $selectedTotalLabel.Text = 'Selected cash total: $0.00'

            foreach ($item in $allDenominations) {
                $itemKey = [string]$item.Cents
                $countLabels[$itemKey].Text = 'Count: 0'
            }
        }.GetNewClosure())

        $cancelButton.Add_Click({
            $state.Cancelled = $true
            $form.Close()
        }.GetNewClosure())

        $submitButton.Add_Click({
            $errorLabel.Text = ''

            $selectedType = if ($exactRadio.Checked) {
                'Exact'
            }
            elseif ($changeRadio.Checked) {
                'Change'
            }
            elseif ($shortRadio.Checked) {
                'Short'
            }
            else {
                ''
            }

            if ([string]::IsNullOrWhiteSpace($selectedType)) {
                $errorLabel.Text = 'Choose E, C, or S before submitting.'
                return
            }

            if ($selectedType -eq 'Exact') {
                [long]$exactCashTotal = & $getLocalCashTotal $state.Counts

                if ($exactCashTotal -ne 0) {
                    $errorLabel.Text = 'Exact means no change or additional cash. Clear the selected bills and coins.'
                    return
                }

                $state.Type = 'Exact'
                $state.AmountCents = [long]0
                $state.CashTotalCents = [long]0
                $state.CashBreakdown = '<NONE>'
                $state.BreakdownMatchesAmount = $true
                $state.Text = 'E'
                $state.ValidationMessage = ''
                $state.Submitted = $true
                $form.Close()
                return
            }

            $parsedAmount = & $parseLocalAmount $amountTextBox.Text

            if (-not $parsedAmount.Valid -or $parsedAmount.Cents -le 0) {
                $errorLabel.Text = 'Enter a valid amount, such as 12.35.'
                return
            }

            [long]$cashTotal = & $getLocalCashTotal $state.Counts

            if ($cashTotal -le 0) {
                $errorLabel.Text = 'Add bills or coins to build the amount.'
                return
            }

            if ($cashTotal -ne $parsedAmount.Cents) {
                $errorLabel.Text = (
                    'The typed amount is ' +
                    (& $formatLocalMoney $parsedAmount.Cents) +
                    ', but the selected cash equals ' +
                    (& $formatLocalMoney $cashTotal) +
                    '. Make them match.'
                )
                return
            }

            $state.Type = $selectedType
            $state.AmountCents = [long]$parsedAmount.Cents
            $state.CashTotalCents = $cashTotal
            $state.CashBreakdown = & $formatLocalBreakdown $state.Counts
            $state.BreakdownMatchesAmount = $true
            $state.Text = if ($selectedType -eq 'Change') {
                'C ' + (([decimal]$parsedAmount.Cents / 100).ToString('0.00', [CultureInfo]::InvariantCulture))
            }
            else {
                'S ' + (([decimal]$parsedAmount.Cents / 100).ToString('0.00', [CultureInfo]::InvariantCulture))
            }
            $state.ValidationMessage = ''
            $state.Submitted = $true
            $form.Close()
        }.GetNewClosure())

        $timer = New-Object System.Windows.Forms.Timer
        $timer.Interval = 100
        $timer.Add_Tick({
            $remaining = [int][Math]::Ceiling(
                $Seconds - $stopwatch.Elapsed.TotalSeconds
            )

            if ($remaining -lt 0) {
                $remaining = 0
            }

            $timerLabel.Text = "Time remaining: $remaining"

            if ($remaining -le 0) {
                $state.TimedOut = $true
                $state.ValidationMessage = 'Time expired.'
                $form.Close()
            }
        }.GetNewClosure())

        $form.Add_FormClosing({
            if (
                -not $state.Submitted -and
                -not $state.TimedOut -and
                -not $state.Cancelled
            ) {
                $state.Cancelled = $true
                $state.ValidationMessage = 'Quiz cancelled.'
            }
        }.GetNewClosure())

        $timer.Start()
        [void]$form.ShowDialog()
        $timer.Stop()
        $stopwatch.Stop()

        $elapsed = [Math]::Round(
            $stopwatch.Elapsed.TotalSeconds,
            2
        )

        if ($state.Submitted) {
            return [pscustomobject]@{
                Text = [string]$state.Text
                TimedOut = $false
                Cancelled = $false
                ElapsedSeconds = [double]$elapsed
                Valid = $true
                Type = [string]$state.Type
                AmountCents = [long]$state.AmountCents
                CashTotalCents = [long]$state.CashTotalCents
                CashBreakdown = [string]$state.CashBreakdown
                BreakdownMatchesAmount = [bool]$state.BreakdownMatchesAmount
                ValidationMessage = [string]$state.ValidationMessage
            }
        }

        return [pscustomobject]@{
            Text = ''
            TimedOut = [bool]$state.TimedOut
            Cancelled = [bool]$state.Cancelled
            ElapsedSeconds = [double]$elapsed
            Valid = $false
            Type = ''
            AmountCents = [long]0
            CashTotalCents = [long]0
            CashBreakdown = '<NONE>'
            BreakdownMatchesAmount = $false
            ValidationMessage = [string]$state.ValidationMessage
        }
    }

    function Save-History {
        param(
            [string]$SessionId,
            [string]$Difficulty,
            [int]$QuestionNumber,
            [int]$TimeLimitSeconds,
            [string]$AnswerMode,
            [object]$Question,
            [object]$AnswerResult,
            [bool]$Correct
        )

        if ($AnswerResult.TimedOut) {
            $userAnswer = '<TIME EXPIRED>'
            $outcome = 'Timed Out'
        }
        elseif (
            [string]::IsNullOrWhiteSpace(
                $AnswerResult.Text
            )
        ) {
            $userAnswer = '<BLANK>'
            $outcome = 'Incorrect'
        }
        else {
            $userAnswer = $AnswerResult.Text

            $outcome = if ($Correct) {
                'Correct'
            }
            else {
                'Incorrect'
            }
        }

        $declaredAmount = if ($AnswerResult.Type -eq 'Exact') {
            '$0.00'
        }
        elseif ($AnswerResult.Valid) {
            Format-Money $AnswerResult.AmountCents
        }
        else {
            '<INVALID OR NOT ENTERED>'
        }

        $selectedCashTotal = if ($AnswerMode -eq 'Clickable denominations') {
            Format-Money $AnswerResult.CashTotalCents
        }
        else {
            '<NOT REQUIRED>'
        }

        $row = [pscustomobject]@{
            Timestamp = (
                Get-Date
            ).ToString('yyyy-MM-dd HH:mm:ss')

            SessionId = $SessionId
            Difficulty = $Difficulty
            QuestionNumber = $QuestionNumber
            AnswerMode = $AnswerMode
            TimeLimitSeconds = $TimeLimitSeconds

            TimeUsedSeconds = (
                [double]$AnswerResult.ElapsedSeconds
            ).ToString(
                '0.00',
                [CultureInfo]::InvariantCulture
            )

            AmountDue = Format-Money `
                $Question.DueCents

            AmountDueCents = $Question.DueCents

            CashGivenTotal = Format-Money `
                $Question.TenderedCents

            CashGivenCents = $Question.TenderedCents

            CashBreakdown = $Question.BreakdownText

            ExpectedAnswer = Get-ExpectedAnswerText `
                $Question

            RecommendedBreakdown = Get-RecommendedAnswerGuidance `
                $Question

            UserAnswer = $userAnswer
            UserDeclaredAmount = $declaredAmount
            UserDeclaredAmountCents = $AnswerResult.AmountCents
            UserCashTotal = $selectedCashTotal
            UserCashTotalCents = $AnswerResult.CashTotalCents
            UserCashBreakdown = $AnswerResult.CashBreakdown
            BreakdownMatchesDeclaredAmount = $AnswerResult.BreakdownMatchesAmount
            ValidationMessage = $AnswerResult.ValidationMessage
            Outcome = $outcome
        }

        $row |
            Export-Csv `
                -LiteralPath $historyPath `
                -NoTypeInformation `
                -Append `
                -Encoding UTF8
    }

    function Get-OptionalPropertyValue {
        param(
            [object]$InputObject,
            [string]$Name,
            [object]$Default = ''
        )

        $property = $InputObject.PSObject.Properties[$Name]

        if ($null -eq $property) {
            return $Default
        }

        return $property.Value
    }

    function Ensure-HistorySchema {
        if (-not (Test-Path -LiteralPath $historyPath)) {
            return
        }

        $header = Get-Content `
            -LiteralPath $historyPath `
            -TotalCount 1

        if ([string]::IsNullOrWhiteSpace($header)) {
            Remove-Item -LiteralPath $historyPath -Force
            return
        }

        $requiredColumns = @(
            'AnswerMode',
            'RecommendedBreakdown',
            'UserCashBreakdown',
            'ValidationMessage'
        )

        $needsMigration = $false

        foreach ($requiredColumn in $requiredColumns) {
            if ($header -notmatch ('"' + [regex]::Escape($requiredColumn) + '"')) {
                $needsMigration = $true
                break
            }
        }

        if (-not $needsMigration) {
            return
        }

        $legacyRows = @(
            Import-Csv -LiteralPath $historyPath
        )

        $backupPath = Join-Path `
            $dataDirectory `
            (
                'Cash-Handling-Quiz-History-Legacy-' +
                (Get-Date).ToString('yyyyMMdd-HHmmss') +
                '.csv'
            )

        Copy-Item `
            -LiteralPath $historyPath `
            -Destination $backupPath `
            -Force

        if ($legacyRows.Count -eq 0) {
            Remove-Item -LiteralPath $historyPath -Force
            return
        }

        $migratedRows = @(
            foreach ($legacyRow in $legacyRows) {
                [pscustomobject]@{
                    Timestamp = Get-OptionalPropertyValue $legacyRow 'Timestamp'
                    SessionId = Get-OptionalPropertyValue $legacyRow 'SessionId'
                    Difficulty = Get-OptionalPropertyValue $legacyRow 'Difficulty'
                    QuestionNumber = Get-OptionalPropertyValue $legacyRow 'QuestionNumber'
                    AnswerMode = Get-OptionalPropertyValue $legacyRow 'AnswerMode' 'Typed (legacy)'
                    TimeLimitSeconds = Get-OptionalPropertyValue $legacyRow 'TimeLimitSeconds'
                    TimeUsedSeconds = Get-OptionalPropertyValue $legacyRow 'TimeUsedSeconds'
                    AmountDue = Get-OptionalPropertyValue $legacyRow 'AmountDue'
                    AmountDueCents = Get-OptionalPropertyValue $legacyRow 'AmountDueCents'
                    CashGivenTotal = Get-OptionalPropertyValue $legacyRow 'CashGivenTotal'
                    CashGivenCents = Get-OptionalPropertyValue $legacyRow 'CashGivenCents'
                    CashBreakdown = Get-OptionalPropertyValue $legacyRow 'CashBreakdown'
                    ExpectedAnswer = Get-OptionalPropertyValue $legacyRow 'ExpectedAnswer'
                    RecommendedBreakdown = Get-OptionalPropertyValue $legacyRow 'RecommendedBreakdown' '<NOT RECORDED IN LEGACY HISTORY>'
                    UserAnswer = Get-OptionalPropertyValue $legacyRow 'UserAnswer'
                    UserDeclaredAmount = Get-OptionalPropertyValue $legacyRow 'UserDeclaredAmount' '<NOT RECORDED>'
                    UserDeclaredAmountCents = Get-OptionalPropertyValue $legacyRow 'UserDeclaredAmountCents' '0'
                    UserCashTotal = Get-OptionalPropertyValue $legacyRow 'UserCashTotal' '<NOT RECORDED>'
                    UserCashTotalCents = Get-OptionalPropertyValue $legacyRow 'UserCashTotalCents' '0'
                    UserCashBreakdown = Get-OptionalPropertyValue $legacyRow 'UserCashBreakdown' '<NOT RECORDED>'
                    BreakdownMatchesDeclaredAmount = Get-OptionalPropertyValue $legacyRow 'BreakdownMatchesDeclaredAmount' '<NOT RECORDED>'
                    ValidationMessage = Get-OptionalPropertyValue $legacyRow 'ValidationMessage' ''
                    Outcome = Get-OptionalPropertyValue $legacyRow 'Outcome'
                }
            }
        )

        $migratedRows |
            Export-Csv `
                -LiteralPath $historyPath `
                -NoTypeInformation `
                -Encoding UTF8

        Write-Host ''
        Write-Host 'Existing quiz history was upgraded for the new answer mode.' -ForegroundColor Cyan
        Write-Host "Legacy backup: $backupPath" -ForegroundColor DarkGray
    }

    function Read-IntegerSetting {
        param(
            [string]$Prompt,
            [int]$Default,
            [int]$Minimum,
            [int]$Maximum
        )

        while ($true) {
            $raw = Read-Host "$Prompt [$Default]"

            if ([string]::IsNullOrWhiteSpace($raw)) {
                return $Default
            }

            [int]$value = 0

            if (
                [int]::TryParse(
                    $raw,
                    [ref]$value
                ) -and
                $value -ge $Minimum -and
                $value -le $Maximum
            ) {
                return $value
            }

            Write-Host `
                "Enter a whole number from $Minimum to $Maximum." `
                -ForegroundColor Yellow
        }
    }

    function Read-Difficulty {
        while ($true) {
            $raw = (
                Read-Host `
                    'Difficulty: [E]asy, [M]edium, or [H]ard [E]'
            ).Trim().ToLowerInvariant()

            if (
                [string]::IsNullOrWhiteSpace($raw) -or
                $raw -eq 'e' -or
                $raw -eq 'easy'
            ) {
                return 'Easy'
            }

            if (
                $raw -eq 'm' -or
                $raw -eq 'medium'
            ) {
                return 'Medium'
            }

            if (
                $raw -eq 'h' -or
                $raw -eq 'hard'
            ) {
                return 'Hard'
            }

            Write-Host `
                'Enter E, M, or H.' `
                -ForegroundColor Yellow
        }
    }

    function Show-History {
        if (-not (Test-Path -LiteralPath $historyPath)) {
            Write-Host `
                'No quiz history exists yet.' `
                -ForegroundColor Yellow

            return
        }

        $rows = @(
            Import-Csv -LiteralPath $historyPath
        )

        if ($rows.Count -eq 0) {
            Write-Host `
                'No quiz history exists yet.' `
                -ForegroundColor Yellow

            return
        }

        $correctCount = @(
            $rows |
                Where-Object {
                    $_.Outcome -eq 'Correct'
                }
        ).Count

        $timedOutCount = @(
            $rows |
                Where-Object {
                    $_.Outcome -eq 'Timed Out'
                }
        ).Count

        $accuracy = [Math]::Round(
            ($correctCount * 100.0) /
            $rows.Count,
            1
        )

        Write-Host ''
        Write-Host `
            'CASH QUIZ HISTORY' `
            -ForegroundColor Cyan

        Write-Host (
            "Questions: $($rows.Count) | " +
            "Correct: $correctCount | " +
            "Timed out: $timedOutCount | " +
            "Accuracy: $accuracy%"
        )

        Write-Host `
            "History file: $historyPath" `
            -ForegroundColor DarkGray

        $rawCount = (
            Read-Host `
                'How many recent records should be shown? Enter A for all [20]'
        ).Trim()

        if ([string]::IsNullOrWhiteSpace($rawCount)) {
            $numberToShow = [Math]::Min(
                20,
                $rows.Count
            )
        }
        elseif ($rawCount -match '^(a|all)$') {
            $numberToShow = $rows.Count
        }
        else {
            [int]$requested = 0

            if (
                -not [int]::TryParse(
                    $rawCount,
                    [ref]$requested
                ) -or
                $requested -lt 1
            ) {
                $requested = 20
            }

            $numberToShow = [Math]::Min(
                $requested,
                $rows.Count
            )
        }

        $selected = @(
            $rows |
                Select-Object -Last $numberToShow
        )

        for (
            $index = $selected.Count - 1
            $index -ge 0
            $index--
        ) {
            $record = $selected[$index]

            Write-Host ''
            Write-Host `
                ('-' * 72) `
                -ForegroundColor DarkGray

            $outcomeColor = if (
                $record.Outcome -eq 'Correct'
            ) {
                'Green'
            }
            elseif (
                $record.Outcome -eq 'Timed Out'
            ) {
                'Yellow'
            }
            else {
                'Red'
            }

            Write-Host (
                "$($record.Timestamp) | " +
                "$($record.Difficulty) | " +
                "$($record.Outcome)"
            ) -ForegroundColor $outcomeColor

            Write-Host (
                'Session/question: ' +
                "$($record.SessionId) / " +
                "$($record.QuestionNumber)"
            )

            Write-Host (
                'Answer mode: ' +
                (Get-OptionalPropertyValue $record 'AnswerMode' 'Typed (legacy)')
            )

            Write-Host `
                "Customer owed: $($record.AmountDue)"

            Write-Host `
                "Customer handed you: $($record.CashBreakdown)"

            Write-Host `
                "Cash actually handed over: $($record.CashGivenTotal)"

            Write-Host `
                "Correct result: $($record.ExpectedAnswer)"

            $recommended = Get-OptionalPropertyValue `
                $record `
                'RecommendedBreakdown' `
                '<NOT RECORDED>'

            Write-Host `
                "Suggested cash handling: $recommended"

            Write-Host `
                "Your answer: $($record.UserAnswer)"

            $userCashBreakdown = Get-OptionalPropertyValue `
                $record `
                'UserCashBreakdown' `
                '<NOT RECORDED>'

            if (
                -not [string]::IsNullOrWhiteSpace(
                    [string]$userCashBreakdown
                )
            ) {
                Write-Host `
                    "Your selected cash: $userCashBreakdown"
            }

            $userCashTotal = Get-OptionalPropertyValue `
                $record `
                'UserCashTotal' `
                '<NOT RECORDED>'

            Write-Host `
                "Your selected cash total: $userCashTotal"

            $validationMessage = Get-OptionalPropertyValue `
                $record `
                'ValidationMessage' `
                ''

            if (
                -not [string]::IsNullOrWhiteSpace(
                    [string]$validationMessage
                )
            ) {
                Write-Host `
                    "Validation note: $validationMessage" `
                    -ForegroundColor Yellow
            }

            Write-Host (
                'Time used: ' +
                "$($record.TimeUsedSeconds) seconds " +
                "out of $($record.TimeLimitSeconds)"
            )
        }

        Write-Host ''
    }

    function Clear-History {
        if (-not (Test-Path -LiteralPath $historyPath)) {
            Write-Host `
                'There is no history to clear.' `
                -ForegroundColor Yellow

            return
        }

        $confirmation = Read-Host `
            'Type CLEAR to permanently delete the quiz history'

        if ($confirmation -ceq 'CLEAR') {
            Remove-Item `
                -LiteralPath $historyPath `
                -Force

            Write-Host `
                'Quiz history was deleted.' `
                -ForegroundColor Green
        }
        else {
            Write-Host `
                'History was not changed.' `
                -ForegroundColor Yellow
        }
    }

    function Start-CashQuiz {
        $difficulty = Read-Difficulty
        $clickableMode = Read-ClickableModeSetting

        if (
            $clickableMode -and
            -not (Test-ClickableModeAvailable)
        ) {
            Write-Host 'Switching to typed mode.' -ForegroundColor Yellow
            $clickableMode = $false
        }

        $questionCount = Read-IntegerSetting `
            -Prompt 'Number of questions' `
            -Default 10 `
            -Minimum 1 `
            -Maximum 100

        $timeLimit = Read-IntegerSetting `
            -Prompt 'Seconds allowed for each answer' `
            -Default 20 `
            -Minimum 3 `
            -Maximum 300

        $answerMode = if ($clickableMode) {
            'Clickable denominations'
        }
        else {
            'Typed'
        }

        $sessionId = (
            Get-Date
        ).ToString('yyyyMMdd-HHmmss') +
        '-' +
        (
            Get-Random `
                -Minimum 1000 `
                -Maximum 10000
        )

        $sessionResults = @()

        Show-AnswerSyntaxNote -ClickableMode $clickableMode

        Write-Host (
            "Starting $difficulty quiz: " +
            "$questionCount questions, " +
            "$timeLimit seconds each."
        ) -ForegroundColor Cyan

        Write-Host "Answer mode: $answerMode" -ForegroundColor Cyan

        if ($clickableMode) {
            Write-Host 'A clickable bill-and-coin window will open for each question.' -ForegroundColor DarkGray
            Write-Host 'Close the window or click Stop quiz to end the session.' -ForegroundColor DarkGray
        }
        else {
            Write-Host 'Press Esc during an answer to stop the quiz.' -ForegroundColor DarkGray
        }

        for (
            $questionNumber = 1
            $questionNumber -le $questionCount
            $questionNumber++
        ) {
            $question = New-CashQuestion `
                -Level $difficulty

            Write-Host ''
            Write-Host `
                ('=' * 72) `
                -ForegroundColor DarkGray

            Write-Host (
                "QUESTION $questionNumber OF " +
                "$questionCount | " +
                "$($difficulty.ToUpperInvariant()) | " +
                "$timeLimit SECONDS"
            ) -ForegroundColor Cyan

            Write-Host (
                'Customer owes: ' +
                (
                    Format-Money `
                        $question.DueCents
                )
            ) -ForegroundColor White

            Write-Host `
                'Customer hands you:' `
                -ForegroundColor White

            foreach ($cashItem in $question.Breakdown) {
                $label = if ($cashItem.Count -eq 1) {
                    $cashItem.Singular
                }
                else {
                    $cashItem.Plural
                }

                Write-Host `
                    "  $($cashItem.Count) x $label"
            }

            Write-Host `
                'Give change, report the shortage, or say exact.' `
                -ForegroundColor White

            $usedClickableForQuestion = $clickableMode
            $questionAnswerMode = $answerMode

            if ($clickableMode) {
                try {
                    $answerResult = Read-ClickableCashAnswer `
                        -Seconds $timeLimit `
                        -Question $question
                }
                catch {
                    Write-Host 'The clickable window could not open. This question will use typed mode.' -ForegroundColor Yellow
                    Write-Host $_.Exception.Message -ForegroundColor DarkGray

                    $usedClickableForQuestion = $false
                    $questionAnswerMode = 'Typed fallback'

                    $timedAnswer = Read-TimedAnswer `
                        -Seconds $timeLimit

                    $answerResult = ConvertTo-NormalizedTypedAnswer `
                        -TimedAnswer $timedAnswer
                }
            }
            else {
                $timedAnswer = Read-TimedAnswer `
                    -Seconds $timeLimit

                $answerResult = ConvertTo-NormalizedTypedAnswer `
                    -TimedAnswer $timedAnswer
            }

            if ($answerResult.Cancelled) {
                Write-Host `
                    'Quiz stopped. Completed questions are already in your history.' `
                    -ForegroundColor Yellow

                break
            }

            $correct = $false

            if (
                -not $answerResult.TimedOut -and
                $answerResult.Valid
            ) {
                $correct = (
                    $answerResult.Type -eq
                    $question.ExpectedType -and

                    $answerResult.AmountCents -eq
                    $question.ExpectedAmountCents
                )

                if ($usedClickableForQuestion) {
                    $correct = (
                        $correct -and
                        $answerResult.BreakdownMatchesAmount -and
                        $answerResult.CashTotalCents -eq
                        $question.ExpectedAmountCents
                    )
                }
            }

            $expectedText = Get-ExpectedAnswerText `
                -Question $question

            if ($correct) {
                Write-Host `
                    "CORRECT - $expectedText" `
                    -ForegroundColor Green
            }
            elseif ($answerResult.TimedOut) {
                Write-Host `
                    "TIME EXPIRED - Correct answer: $expectedText" `
                    -ForegroundColor Yellow
            }
            elseif (-not $answerResult.Valid) {
                Write-Host `
                    "INVALID ANSWER - Correct answer: $expectedText" `
                    -ForegroundColor Red

                Write-Host `
                    $answerResult.ValidationMessage `
                    -ForegroundColor Yellow
            }
            else {
                Write-Host `
                    "INCORRECT - Correct answer: $expectedText" `
                    -ForegroundColor Red
            }

            if (
                $usedClickableForQuestion -and
                $answerResult.Valid
            ) {
                Write-Host (
                    'Your selected cash: ' +
                    $answerResult.CashBreakdown +
                    ' = ' +
                    (Format-Money $answerResult.CashTotalCents)
                ) -ForegroundColor DarkGray
            }

            Write-Host (
                'Customer actually handed you: ' +
                (
                    Format-Money `
                        $question.TenderedCents
                )
            ) -ForegroundColor DarkGray

            Write-Host (
                'Time used: ' +
                $answerResult.ElapsedSeconds.ToString('N2') +
                ' seconds'
            ) -ForegroundColor DarkGray

            Write-Host ''
            Write-Host `
                (Get-RecommendedAnswerGuidance -Question $question) `
                -ForegroundColor Cyan

            $saveParameters = @{
                SessionId = $sessionId
                Difficulty = $difficulty
                QuestionNumber = $questionNumber
                TimeLimitSeconds = $timeLimit
                AnswerMode = $questionAnswerMode
                Question = $question
                AnswerResult = $answerResult
                Correct = $correct
            }

            Save-History @saveParameters

            $sessionResults += [pscustomobject]@{
                Correct = $correct
                TimedOut = $answerResult.TimedOut
                ElapsedSeconds = [double](
                    $answerResult.ElapsedSeconds
                )
            }

            if ($questionNumber -lt $questionCount) {
                [void](
                    Read-Host `
                        'Press Enter for the next question'
                )
            }
        }

        if ($sessionResults.Count -gt 0) {
            $sessionCorrect = @(
                $sessionResults |
                    Where-Object {
                        $_.Correct
                    }
            ).Count

            $sessionTimedOut = @(
                $sessionResults |
                    Where-Object {
                        $_.TimedOut
                    }
            ).Count

            $sessionAccuracy = [Math]::Round(
                ($sessionCorrect * 100.0) /
                $sessionResults.Count,
                1
            )

            $averageTime = [Math]::Round(
                (
                    $sessionResults |
                        Measure-Object `
                            -Property ElapsedSeconds `
                            -Average
                ).Average,
                2
            )

            Write-Host ''
            Write-Host `
                'SESSION RESULTS' `
                -ForegroundColor Cyan

            Write-Host (
                "Score: $sessionCorrect / " +
                "$($sessionResults.Count) " +
                "($sessionAccuracy%)"
            )

            Write-Host `
                "Timed out: $sessionTimedOut"

            Write-Host `
                "Average response time: $averageTime seconds"

            Write-Host `
                "Saved history: $historyPath" `
                -ForegroundColor DarkGray
        }
    }

    Ensure-HistorySchema

    Write-Host ''
    Write-Host `
        'CASH HANDLING TERMINAL QUIZ' `
        -ForegroundColor Cyan

    Write-Host `
        'Random cash questions with typed and clickable denomination modes.'

    Write-Host `
        "History is saved at: $historyPath" `
        -ForegroundColor DarkGray

    while ($true) {
        Write-Host ''

        Write-Host `
            '[1] Start quiz  [2] View detailed history  [3] Clear history  [Q] Quit' `
            -ForegroundColor White

        $menuChoice = (
            Read-Host 'Choose an option'
        ).Trim().ToLowerInvariant()

        switch ($menuChoice) {
            '1' {
                Start-CashQuiz
            }

            '2' {
                Show-History
            }

            '3' {
                Clear-History
            }

            'q' {
                break
            }

            'quit' {
                break
            }

            default {
                Write-Host `
                    'Choose 1, 2, 3, or Q.' `
                    -ForegroundColor Yellow
            }
        }

        if (
            $menuChoice -eq 'q' -or
            $menuChoice -eq 'quit'
        ) {
            break
        }
    }
}
