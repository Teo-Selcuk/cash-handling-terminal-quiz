& {
    Set-StrictMode -Version 2.0
    $ErrorActionPreference = 'Stop'

    $culture = [System.Globalization.CultureInfo]::GetCultureInfo('en-US')

    function Get-RecommendedQuizDataDirectory {
        $userProfile = [Environment]::GetFolderPath('UserProfile')

        if ([string]::IsNullOrWhiteSpace($userProfile)) {
            $userProfile = $env:USERPROFILE
        }

        return Join-Path `
            (Join-Path $userProfile 'Downloads') `
            'Cash-Handling-Quiz-Data'
    }
    function Get-QuizSettingsPath {
        $localAppData = [Environment]::GetFolderPath('LocalApplicationData')

        if ([string]::IsNullOrWhiteSpace($localAppData)) {
            $localAppData = Join-Path $env:USERPROFILE 'AppData\Local'
        }

        return Join-Path `
            (Join-Path $localAppData 'Cash-Handling-Terminal-Quiz') `
            'Settings.json'
    }
    function Get-DefaultQuizSettings {
        return [pscustomobject]@{
            DefaultQuestionCount = 10
            DefaultTimeLimitSeconds = 20
            DataDirectory = Get-RecommendedQuizDataDirectory
            ClickableBillCoinModeEnabled = $false
            AutoContinueOnTimeoutEnabled = $false
        }
    }
    function Read-QuizSettings {
        param([string]$Path)

        $settings = Get-DefaultQuizSettings

        if (-not (Test-Path -LiteralPath $Path)) {
            return $settings
        }

        try {
            $saved = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json

            [int]$numberOfQuestions = 0
            if (
                [int]::TryParse(
                    [string]$saved.DefaultQuestionCount,
                    [ref]$numberOfQuestions
                ) -and
                $numberOfQuestions -ge 1 -and
                $numberOfQuestions -le 100
            ) {
                $settings.DefaultQuestionCount = $numberOfQuestions
            }

            [int]$timeLimitSeconds = 0
            if (
                [int]::TryParse(
                    [string]$saved.DefaultTimeLimitSeconds,
                    [ref]$timeLimitSeconds
                ) -and
                $timeLimitSeconds -ge 3 -and
                $timeLimitSeconds -le 300
            ) {
                $settings.DefaultTimeLimitSeconds = $timeLimitSeconds
            }

            if (-not [string]::IsNullOrWhiteSpace([string]$saved.DataDirectory)) {
                $settings.DataDirectory = [string]$saved.DataDirectory
            }

            $billCoinMode = $saved.PSObject.Properties['ClickableBillCoinModeEnabled']
            if ($null -ne $billCoinMode) {
                $settings.ClickableBillCoinModeEnabled = [bool]$billCoinMode.Value
            }

            $autoContinue = $saved.PSObject.Properties['AutoContinueOnTimeoutEnabled']
            if ($null -ne $autoContinue) {
                $settings.AutoContinueOnTimeoutEnabled = [bool]$autoContinue.Value
            }
        }
        catch {
            Write-Host 'Saved settings could not be read. Default settings will be used.' -ForegroundColor Yellow
            Write-Host $_.Exception.Message -ForegroundColor DarkGray
        }

        return $settings
    }
    function Save-QuizSettings {
        param(
            [object]$Settings,
            [string]$Path
        )

        $settingsDirectory = Split-Path -Path $Path -Parent
        if (-not (Test-Path -LiteralPath $settingsDirectory)) {
            New-Item -ItemType Directory -Path $settingsDirectory -Force | Out-Null
        }

        $Settings |
            ConvertTo-Json -Depth 4 |
            Set-Content -LiteralPath $Path -Encoding UTF8
    }
    function Resolve-QuizDataDirectory {
        param([string]$Directory)

        if ([string]::IsNullOrWhiteSpace($Directory)) {
            throw 'A quiz data folder is required.'
        }

        $userProfile = [Environment]::GetFolderPath('UserProfile')
        if ([string]::IsNullOrWhiteSpace($userProfile)) {
            $userProfile = $env:USERPROFILE
        }

        $selectedDirectory = [Environment]::ExpandEnvironmentVariables(
            $Directory.Trim().Trim('"')
        )
        if ($selectedDirectory -eq '~') {
            $selectedDirectory = $userProfile
        }
        elseif ($selectedDirectory.StartsWith('~\')) {
            $selectedDirectory = Join-Path $userProfile $selectedDirectory.Substring(2)
        }

        if (-not (Test-Path -LiteralPath $selectedDirectory)) {
            New-Item `
                -ItemType Directory `
                -Path $selectedDirectory `
                -Force | Out-Null
        }

        return (Resolve-Path -LiteralPath $selectedDirectory).Path
    }
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

    $settingsPath = Get-QuizSettingsPath
    $settings = Read-QuizSettings -Path $settingsPath
    $resolvedDataDirectory = Resolve-QuizDataDirectory `
        -Directory $settings.DataDirectory

    $settings.DataDirectory = $resolvedDataDirectory
    $appState = [pscustomobject]@{
        Settings = $settings
        DataDirectory = $resolvedDataDirectory
        HistoryPath = Join-Path `
            $resolvedDataDirectory `
            'Cash-Handling-Quiz-History.csv'
    }
    $script:dataDirectory = $appState.DataDirectory
    $script:historyPath = $appState.HistoryPath
    Save-QuizSettings -Settings $settings -Path $settingsPath

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

    function ConvertFrom-CashBuilderShorthand {
        param([string]$Text)

        $counts = @{}

        foreach ($denomination in $allDenominations) {
            $counts[[string]$denomination.Cents] = [long]0
        }

        if ([string]::IsNullOrWhiteSpace($Text)) {
            return [pscustomobject]@{
                Valid = $false
                Counts = $counts
                Error = 'Enter at least one bill or coin.'
            }
        }

        $wordCounts = @{
            one = 1; two = 2; three = 3; four = 4; five = 5
            six = 6; seven = 7; eight = 8; nine = 9; ten = 10
        }

        $parts = @(
            $Text -split '[,;\r\n]' |
                ForEach-Object { $_.Trim() } |
                Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
        )

        if ($parts.Count -eq 0) {
            return [pscustomobject]@{
                Valid = $false
                Counts = $counts
                Error = 'Enter at least one bill or coin.'
            }
        }

        foreach ($part in $parts) {
            [long]$count = 1
            $token = $part
            $compactCoin = [regex]::Match($part, '^(?<count>\d+)(?<token>[qdnp])$', 'IgnoreCase')
            $explicitCount = [regex]::Match($part, '^(?<count>\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*[x\*]\s*(?<token>.+)$', 'IgnoreCase')
            $spacedCount = [regex]::Match($part, '^(?<count>\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?<token>.+)$', 'IgnoreCase')

            $countMatch = if ($compactCoin.Success) {
                $compactCoin
            }
            elseif ($explicitCount.Success) {
                $explicitCount
            }
            elseif ($spacedCount.Success) {
                $spacedCount
            }
            else {
                $null
            }

            if ($null -ne $countMatch) {
                $rawCount = $countMatch.Groups['count'].Value.ToLowerInvariant()
                $token = $countMatch.Groups['token'].Value

                if ($wordCounts.ContainsKey($rawCount)) {
                    $count = [long]$wordCounts[$rawCount]
                }
                elseif (-not [long]::TryParse($rawCount, [ref]$count)) {
                    $count = [long]0
                }
            }

            $normalizedToken = ($token.ToLowerInvariant() -replace '\s', '')
            [long]$cents = 0

            switch ($normalizedToken) {
                { $_ -in @('q', 'quarter', 'quarters') } { $cents = 25; break }
                { $_ -in @('d', 'dime', 'dimes') } { $cents = 10; break }
                { $_ -in @('n', 'nickel', 'nickels') } { $cents = 5; break }
                { $_ -in @('p', 'penny', 'pennies') } { $cents = 1; break }
                default {
                    $billMatch = [regex]::Match($normalizedToken, '^\$?(100|50|20|10|5|1)(?:b|bill|bills)?$')

                    if ($billMatch.Success) {
                        $cents = [long]([int]$billMatch.Groups[1].Value * 100)
                    }
                }
            }

            if ($count -lt 1 -or $count -gt 10000 -or $cents -le 0) {
                return [pscustomobject]@{
                    Valid = $false
                    Counts = $counts
                    Error = "Could not read '$part'."
                }
            }

            $key = [string]$cents
            $counts[$key] = [long]$counts[$key] + $count
        }

        return [pscustomobject]@{
            Valid = $true
            Counts = $counts
            Error = ''
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
        param([bool]$BillCoinModeEnabled)

        Write-Host ''
        Write-Host 'ANSWER NOTE' -ForegroundColor Cyan
        Write-Host 'E = Exact amount' -ForegroundColor White
        Write-Host 'C = Change' -ForegroundColor White
        Write-Host 'S = Short' -ForegroundColor White

        Write-Host ''
        Write-Host 'Answer examples:' -ForegroundColor Cyan
        Write-Host 'E          = exact amount'
        Write-Host 'C 12.35    = give $12.35 in change'
        Write-Host 'S 4.10     = customer is $4.10 short'
        if ($BillCoinModeEnabled) {
            Write-Host ''
            Write-Host 'Final cash-construction step:' -ForegroundColor Cyan
            Write-Host 'After a valid answer, build your declared amount with + and - bill and coin controls.'
            Write-Host 'The selected total must match the amount you declared before the transaction can be submitted.'
        }

        Write-Host ''
        Write-Host 'During a question, E means Exact—not Easy.' -ForegroundColor DarkGray
    }

    function Read-ClickableModeSetting {
        param([bool]$Default = $false)

        while ($true) {
            $prompt = if ($Default) {
                'Use clickable bill/coin mode? [Y/N] [Y]'
            }
            else {
                'Use clickable bill/coin mode? [Y/N] [N]'
            }

            $raw = (
                Read-Host $prompt
            ).Trim().ToLowerInvariant()

            if (
                ([string]::IsNullOrWhiteSpace($raw) -and -not $Default) -or
                $raw -eq 'n' -or
                $raw -eq 'no' -or
                $raw -eq 'off'
            ) {
                return $false
            }

            if (
                ([string]::IsNullOrWhiteSpace($raw) -and $Default) -or
                $raw -eq 'y' -or
                $raw -eq 'yes' -or
                $raw -eq 'on'
            ) {
                return $true
            }

            Write-Host 'Enter Y to turn it on or N to leave it off.' -ForegroundColor Yellow
        }
    }

    function Read-AutoContinueOnTimeoutSetting {
        param([bool]$Default = $false)

        while ($true) {
            $prompt = if ($Default) {
                'Auto-continue after a timeout? [Y/N] [Y]'
            }
            else {
                'Auto-continue after a timeout? [Y/N] [N]'
            }

            $raw = (Read-Host $prompt).Trim().ToLowerInvariant()

            if (
                ([string]::IsNullOrWhiteSpace($raw) -and -not $Default) -or
                $raw -eq 'n' -or
                $raw -eq 'no' -or
                $raw -eq 'off'
            ) {
                return $false
            }

            if (
                ([string]::IsNullOrWhiteSpace($raw) -and $Default) -or
                $raw -eq 'y' -or
                $raw -eq 'yes' -or
                $raw -eq 'on'
            ) {
                return $true
            }

            Write-Host 'Enter Y to start the next question automatically after a timeout, or N to keep the pause.' -ForegroundColor Yellow
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
            [object]$Question,
            [object]$DeclaredAnswer = $null,
            [double]$ElapsedSecondsBefore = 0,
            [string]$PreviewScreenshotPath = '',
            [switch]$PreviewOnly
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

        $uiBackground = [System.Drawing.Color]::FromArgb(15, 23, 42)
        $uiSurface = [System.Drawing.Color]::FromArgb(30, 41, 59)
        $uiSurfaceRaised = [System.Drawing.Color]::FromArgb(51, 65, 85)
        $uiText = [System.Drawing.Color]::FromArgb(248, 250, 252)
        $uiMutedText = [System.Drawing.Color]::FromArgb(203, 213, 225)
        $uiAccent = [System.Drawing.Color]::FromArgb(20, 184, 166)
        $uiAccentDark = [System.Drawing.Color]::FromArgb(15, 118, 110)
        $uiSuccess = [System.Drawing.Color]::FromArgb(52, 211, 153)
        $uiDanger = [System.Drawing.Color]::FromArgb(253, 164, 175)

        $form = New-Object System.Windows.Forms.Form
        $form.Text = 'Cash Handling Quiz - Clickable Bill/Coin Mode'
        $form.StartPosition = 'CenterScreen'
        $form.ClientSize = New-Object System.Drawing.Size(1040, 840)
        $form.AutoScaleMode = 'Dpi'
        $form.Font = New-Object System.Drawing.Font('Segoe UI', 10)
        $form.BackColor = $uiBackground
        $form.ForeColor = $uiText
        $form.FormBorderStyle = 'FixedDialog'
        $form.MaximizeBox = $false
        $form.MinimizeBox = $false
        $form.TopMost = $true

        $headerPanel = New-Object System.Windows.Forms.Panel
        $headerPanel.Location = New-Object System.Drawing.Point(20, 18)
        $headerPanel.Size = New-Object System.Drawing.Size(1000, 108)
        $headerPanel.BackColor = $uiSurface
        $headerPanel.BorderStyle = 'FixedSingle'
        $form.Controls.Add($headerPanel)

        $questionLabel = New-Object System.Windows.Forms.Label
        $questionLabel.Location = New-Object System.Drawing.Point(20, 15)
        $questionLabel.Size = New-Object System.Drawing.Size(720, 78)
        $questionLabel.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 11.5)
        $questionLabel.ForeColor = $uiText
        $questionLabel.Text = (
            'Customer owes: ' +
            (Format-Money $Question.DueCents) +
            "`r`nCustomer hands you:`r`n" +
            $Question.BreakdownText
        )
        $headerPanel.Controls.Add($questionLabel)

        $timerPanel = New-Object System.Windows.Forms.Panel
        $timerPanel.Location = New-Object System.Drawing.Point(760, 18)
        $timerPanel.Size = New-Object System.Drawing.Size(215, 68)
        $timerPanel.BackColor = $uiAccentDark
        $headerPanel.Controls.Add($timerPanel)

        $timerLabel = New-Object System.Windows.Forms.Label
        $timerLabel.Dock = 'Fill'
        $timerLabel.TextAlign = 'MiddleCenter'
        $timerLabel.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 12)
        $timerLabel.ForeColor = $uiText
        $timerLabel.Text = "Time remaining: $Seconds"
        $timerPanel.Controls.Add($timerLabel)

        $answerPanel = New-Object System.Windows.Forms.Panel
        $answerPanel.Location = New-Object System.Drawing.Point(20, 138)
        $answerPanel.Size = New-Object System.Drawing.Size(1000, 196)
        $answerPanel.BackColor = $uiSurface
        $answerPanel.BorderStyle = 'FixedSingle'
        $form.Controls.Add($answerPanel)

        $instructionLabel = New-Object System.Windows.Forms.Label
        $instructionLabel.Location = New-Object System.Drawing.Point(20, 12)
        $instructionLabel.Size = New-Object System.Drawing.Size(960, 38)
        $instructionLabel.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 10.5)
        $instructionLabel.ForeColor = $uiMutedText
        $instructionLabel.Text = 'Choose E, C, or S. For C or S, enter the total and build the same amount with the bill and coin buttons.'
        $answerPanel.Controls.Add($instructionLabel)

        $exactRadio = New-Object System.Windows.Forms.RadioButton
        $exactRadio.Location = New-Object System.Drawing.Point(20, 54)
        $exactRadio.Size = New-Object System.Drawing.Size(160, 30)
        $exactRadio.ForeColor = $uiText
        $exactRadio.Text = 'E - Exact amount'
        $answerPanel.Controls.Add($exactRadio)

        $changeRadio = New-Object System.Windows.Forms.RadioButton
        $changeRadio.Location = New-Object System.Drawing.Point(190, 54)
        $changeRadio.Size = New-Object System.Drawing.Size(145, 30)
        $changeRadio.ForeColor = $uiText
        $changeRadio.Text = 'C - Change'
        $answerPanel.Controls.Add($changeRadio)

        $shortRadio = New-Object System.Windows.Forms.RadioButton
        $shortRadio.Location = New-Object System.Drawing.Point(345, 54)
        $shortRadio.Size = New-Object System.Drawing.Size(135, 30)
        $shortRadio.ForeColor = $uiText
        $shortRadio.Text = 'S - Short'
        $answerPanel.Controls.Add($shortRadio)

        $amountLabel = New-Object System.Windows.Forms.Label
        $amountLabel.Location = New-Object System.Drawing.Point(505, 58)
        $amountLabel.Size = New-Object System.Drawing.Size(180, 25)
        $amountLabel.ForeColor = $uiMutedText
        $amountLabel.Text = 'Change or shortage amount:'
        $answerPanel.Controls.Add($amountLabel)

        $amountTextBox = New-Object System.Windows.Forms.TextBox
        $amountTextBox.Location = New-Object System.Drawing.Point(690, 54)
        $amountTextBox.Size = New-Object System.Drawing.Size(130, 30)
        $amountTextBox.Font = New-Object System.Drawing.Font('Segoe UI', 11)
        $amountTextBox.BackColor = $uiSurfaceRaised
        $amountTextBox.ForeColor = $uiText
        $amountTextBox.BorderStyle = 'FixedSingle'
        $answerPanel.Controls.Add($amountTextBox)

        $selectedTotalLabel = New-Object System.Windows.Forms.Label
        $selectedTotalLabel.Location = New-Object System.Drawing.Point(830, 53)
        $selectedTotalLabel.Size = New-Object System.Drawing.Size(150, 34)
        $selectedTotalLabel.TextAlign = 'MiddleRight'
        $selectedTotalLabel.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 11)
        $selectedTotalLabel.ForeColor = $uiAccent
        $selectedTotalLabel.Text = 'Selected: $0.00'
        $answerPanel.Controls.Add($selectedTotalLabel)

        $purposeLabel = New-Object System.Windows.Forms.Label
        $purposeLabel.Location = New-Object System.Drawing.Point(20, 100)
        $purposeLabel.Size = New-Object System.Drawing.Size(475, 28)
        $purposeLabel.ForeColor = $uiMutedText
        $purposeLabel.Text = 'C: select what you give back. S: select what the customer still needs to give. E: select no cash.'
        $answerPanel.Controls.Add($purposeLabel)

        $selectionStatusLabel = New-Object System.Windows.Forms.Label
        $selectionStatusLabel.Location = New-Object System.Drawing.Point(505, 96)
        $selectionStatusLabel.Size = New-Object System.Drawing.Size(475, 32)
        $selectionStatusLabel.TextAlign = 'MiddleRight'
        $selectionStatusLabel.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 10)
        $selectionStatusLabel.ForeColor = $uiMutedText
        $selectionStatusLabel.Text = 'Selected cash total updates as you build it.'
        $answerPanel.Controls.Add($selectionStatusLabel)

        $fastEntryLabel = New-Object System.Windows.Forms.Label
        $fastEntryLabel.Location = New-Object System.Drawing.Point(20, 140)
        $fastEntryLabel.Size = New-Object System.Drawing.Size(185, 30)
        $fastEntryLabel.ForeColor = $uiMutedText
        $fastEntryLabel.Text = 'Fast cash entry:'
        $answerPanel.Controls.Add($fastEntryLabel)

        $fastEntryTextBox = New-Object System.Windows.Forms.TextBox
        $fastEntryTextBox.Location = New-Object System.Drawing.Point(170, 136)
        $fastEntryTextBox.Size = New-Object System.Drawing.Size(525, 32)
        $fastEntryTextBox.Font = New-Object System.Drawing.Font('Consolas', 10.5)
        $fastEntryTextBox.BackColor = $uiSurfaceRaised
        $fastEntryTextBox.ForeColor = $uiText
        $fastEntryTextBox.BorderStyle = 'FixedSingle'
        $fastEntryTextBox.AccessibleName = 'Fast bill and coin entry'
        $fastEntryTextBox.AccessibleDescription = 'Examples: 2x$10, one $1 bill, 2d, 2q.'
        $answerPanel.Controls.Add($fastEntryTextBox)

        $applyFastEntryButton = New-Object System.Windows.Forms.Button
        $applyFastEntryButton.Location = New-Object System.Drawing.Point(710, 132)
        $applyFastEntryButton.Size = New-Object System.Drawing.Size(170, 40)
        $applyFastEntryButton.Text = 'Apply fast entry'
        $applyFastEntryButton.AccessibleName = 'Apply fast cash entry'
        $applyFastEntryButton.TabIndex = 8
        $applyFastEntryButton.FlatStyle = 'Flat'
        $applyFastEntryButton.FlatAppearance.BorderSize = 0
        $applyFastEntryButton.BackColor = $uiSurfaceRaised
        $applyFastEntryButton.ForeColor = $uiText
        $applyFastEntryButton.UseVisualStyleBackColor = $false
        $applyFastEntryButton.Cursor = [System.Windows.Forms.Cursors]::Hand
        $answerPanel.Controls.Add($applyFastEntryButton)

        $fastEntryHintLabel = New-Object System.Windows.Forms.Label
        $fastEntryHintLabel.Location = New-Object System.Drawing.Point(20, 170)
        $fastEntryHintLabel.Size = New-Object System.Drawing.Size(960, 20)
        $fastEntryHintLabel.ForeColor = $uiMutedText
        $fastEntryHintLabel.Font = New-Object System.Drawing.Font('Segoe UI', 9)
        $fastEntryHintLabel.Text = 'Use commas: 2x$10, one $1 bill, 2d, 2q. Fast entry replaces the selection; you can still adjust every button.'
        $answerPanel.Controls.Add($fastEntryHintLabel)

        if ($null -ne $DeclaredAnswer) {
            switch ($DeclaredAnswer.Type) {
                'Exact' {
                    $exactRadio.Checked = $true
                }
                'Change' {
                    $changeRadio.Checked = $true
                }
                'Short' {
                    $shortRadio.Checked = $true
                }
                default {
                    throw 'The cash-construction step needs a valid declared answer.'
                }
            }

            $amountTextBox.Text = (
                ([decimal]$DeclaredAnswer.AmountCents / 100).ToString(
                    '0.00',
                    [CultureInfo]::InvariantCulture
                )
            )
            $exactRadio.AutoCheck = $false
            $changeRadio.AutoCheck = $false
            $shortRadio.AutoCheck = $false
            $exactRadio.TabStop = $false
            $changeRadio.TabStop = $false
            $shortRadio.TabStop = $false
            $amountTextBox.ReadOnly = $true
            $amountTextBox.TabStop = $false
            $amountLabel.Text = 'Your declared amount:'
            $instructionLabel.Text = (
                'FINAL STEP: Construct ' +
                (& $formatLocalMoney $DeclaredAnswer.AmountCents) +
                ' using bills and coins. The selected total must match your declared amount.'
            )
            $purposeLabel.Text = if ($DeclaredAnswer.Type -eq 'Change') {
                'Build the change you would give back to the customer.'
            }
            elseif ($DeclaredAnswer.Type -eq 'Short') {
                'Build the additional cash the customer still needs to give.'
            }
            else {
                'Exact amount requires no selected bills or coins.'
            }
            $form.Text = 'Cash Handling Quiz - Final Cash Construction'
        }

        $refreshSelectionStatus = {
            param([long]$SelectedCents)

            if ($null -eq $DeclaredAnswer) {
                return
            }

            [long]$targetCents = [long]$DeclaredAnswer.AmountCents
            [long]$differenceCents = $SelectedCents - $targetCents

            if ($differenceCents -eq 0) {
                $selectionStatusLabel.Text = 'Selected cash matches the declared amount.'
                $selectionStatusLabel.ForeColor = $uiSuccess
            }
            elseif ($differenceCents -gt 0) {
                $selectionStatusLabel.Text = (
                    'Selected cash is ' +
                    (& $formatLocalMoney $differenceCents) +
                    ' over the declared amount.'
                )
                $selectionStatusLabel.ForeColor = $uiDanger
            }
            else {
                $selectionStatusLabel.Text = (
                    'Selected cash is ' +
                    (& $formatLocalMoney (-$differenceCents)) +
                    ' short of the declared amount.'
                )
                $selectionStatusLabel.ForeColor = $uiDanger
            }
        }.GetNewClosure()

        & $refreshSelectionStatus 0

        $styleFlatButton = {
            param(
                [System.Windows.Forms.Button]$Button,
                [System.Drawing.Color]$BackColor,
                [System.Drawing.Color]$ForeColor
            )

            $Button.FlatStyle = 'Flat'
            $Button.FlatAppearance.BorderSize = 0
            $Button.BackColor = $BackColor
            $Button.ForeColor = $ForeColor
            $Button.UseVisualStyleBackColor = $false
            $Button.Cursor = [System.Windows.Forms.Cursors]::Hand
        }.GetNewClosure()

        $billsGroup = New-Object System.Windows.Forms.GroupBox
        $billsGroup.Text = 'BILLS'
        $billsGroup.Location = New-Object System.Drawing.Point(20, 350)
        $billsGroup.Size = New-Object System.Drawing.Size(620, 345)
        $billsGroup.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 11)
        $billsGroup.BackColor = $uiSurface
        $billsGroup.ForeColor = $uiMutedText
        $form.Controls.Add($billsGroup)

        $coinsGroup = New-Object System.Windows.Forms.GroupBox
        $coinsGroup.Text = 'COINS'
        $coinsGroup.Location = New-Object System.Drawing.Point(655, 350)
        $coinsGroup.Size = New-Object System.Drawing.Size(365, 345)
        $coinsGroup.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 11)
        $coinsGroup.BackColor = $uiSurface
        $coinsGroup.ForeColor = $uiMutedText
        $form.Controls.Add($coinsGroup)

        $countLabels = @{}
        $billIndex = 0
        $coinIndex = 0

        for ($index = 0; $index -lt $allDenominations.Count; $index++) {
            $denomination = $allDenominations[$index]

            if ($denomination.Category -eq 'Bill') {
                $parentGroup = $billsGroup
                $cardWidth = 280
                $cardHeight = 82
                $column = $billIndex % 2
                $row = [Math]::Floor($billIndex / 2)
                $x = 18 + ($column * 292)
                $y = 36 + ($row * 94)
                $billIndex++
            }
            else {
                $parentGroup = $coinsGroup
                $cardWidth = 325
                $cardHeight = 64
                $x = 18
                $y = 36 + ($coinIndex * 70)
                $coinIndex++
            }

            $panel = New-Object System.Windows.Forms.Panel
            $panel.Location = New-Object System.Drawing.Point($x, $y)
            $panel.Size = New-Object System.Drawing.Size($cardWidth, $cardHeight)
            $panel.BackColor = $uiSurfaceRaised
            $parentGroup.Controls.Add($panel)

            $nameLabel = New-Object System.Windows.Forms.Label
            $nameLabel.Location = New-Object System.Drawing.Point(14, 8)
            $nameLabel.Size = New-Object System.Drawing.Size(110, ($cardHeight - 16))
            $nameLabel.TextAlign = 'MiddleLeft'
            $nameLabel.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 10.5)
            $nameLabel.ForeColor = $uiText
            $nameLabel.Text = $denomination.Singular
            $panel.Controls.Add($nameLabel)

            $removeButton = New-Object System.Windows.Forms.Button
            $removeButton.Location = New-Object System.Drawing.Point(($cardWidth - 148), (($cardHeight - 44) / 2))
            $removeButton.Size = New-Object System.Drawing.Size(44, 44)
            $removeButton.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 15)
            $removeButton.Text = '-'
            $removeButton.AccessibleName = 'Remove one ' + $denomination.Singular
            $removeButton.TabIndex = 10 + ($index * 2)
            & $styleFlatButton $removeButton $uiBackground $uiText
            $panel.Controls.Add($removeButton)

            $countLabel = New-Object System.Windows.Forms.Label
            $countLabel.Location = New-Object System.Drawing.Point(($cardWidth - 100), (($cardHeight - 36) / 2))
            $countLabel.Size = New-Object System.Drawing.Size(48, 36)
            $countLabel.TextAlign = 'MiddleCenter'
            $countLabel.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 13)
            $countLabel.ForeColor = $uiText
            $countLabel.Text = '0'
            $countLabel.AccessibleName = $denomination.Singular + ' count'
            $panel.Controls.Add($countLabel)

            $addButton = New-Object System.Windows.Forms.Button
            $addButton.Location = New-Object System.Drawing.Point(($cardWidth - 48), (($cardHeight - 44) / 2))
            $addButton.Size = New-Object System.Drawing.Size(44, 44)
            $addButton.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 15)
            $addButton.Text = '+'
            $addButton.AccessibleName = 'Add one ' + $denomination.Singular
            $addButton.TabIndex = 11 + ($index * 2)
            & $styleFlatButton $addButton $uiAccentDark $uiText
            $panel.Controls.Add($addButton)

            $keyCopy = [string]$denomination.Cents
            $countLabels[$keyCopy] = $countLabel

            $addButton.Add_Click({
                $state.Counts[$keyCopy] = [long]$state.Counts[$keyCopy] + 1

                [long]$newTotal = & $getLocalCashTotal $state.Counts
                $selectedTotalLabel.Text = 'Selected: ' + (& $formatLocalMoney $newTotal)
                & $refreshSelectionStatus $newTotal

                foreach ($item in $allDenominations) {
                    $itemKey = [string]$item.Cents
                    $countLabels[$itemKey].Text = [string]$state.Counts[$itemKey]
                }
            }.GetNewClosure())

            $removeButton.Add_Click({
                if ([long]$state.Counts[$keyCopy] -gt 0) {
                    $state.Counts[$keyCopy] = [long]$state.Counts[$keyCopy] - 1
                }

                [long]$newTotal = & $getLocalCashTotal $state.Counts
                $selectedTotalLabel.Text = 'Selected: ' + (& $formatLocalMoney $newTotal)
                & $refreshSelectionStatus $newTotal

                foreach ($item in $allDenominations) {
                    $itemKey = [string]$item.Cents
                    $countLabels[$itemKey].Text = [string]$state.Counts[$itemKey]
                }
            }.GetNewClosure())
        }

        $refreshCashSelection = {
            [long]$newTotal = & $getLocalCashTotal $state.Counts
            $selectedTotalLabel.Text = 'Selected: ' + (& $formatLocalMoney $newTotal)
            & $refreshSelectionStatus $newTotal

            foreach ($item in $allDenominations) {
                $itemKey = [string]$item.Cents
                $countLabels[$itemKey].Text = [string]$state.Counts[$itemKey]
            }
        }.GetNewClosure()

        $errorLabel = New-Object System.Windows.Forms.Label
        $errorLabel.Location = New-Object System.Drawing.Point(28, 708)
        $errorLabel.Size = New-Object System.Drawing.Size(992, 42)
        $errorLabel.TextAlign = 'MiddleLeft'
        $errorLabel.BackColor = $uiSurface
        $errorLabel.ForeColor = $uiMutedText
        $errorLabel.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 10)
        $keyboardHintText = 'Tip: Press Enter to submit | Press Esc to stop the quiz. Apply fast entry before submitting, or press Enter in its field to apply it.'
        $errorLabel.Text = $keyboardHintText
        $form.Controls.Add($errorLabel)

        $applyFastEntryButton.Add_Click({
            $parsedFastEntry = ConvertFrom-CashBuilderShorthand `
                -Text $fastEntryTextBox.Text

            if (-not $parsedFastEntry.Valid) {
                $errorLabel.ForeColor = $uiDanger
                $errorLabel.Text = $parsedFastEntry.Error + ' Use entries such as 2x$10, one $1 bill, 2d, 2q.'
                $fastEntryTextBox.Focus()
                return
            }

            foreach ($item in $allDenominations) {
                $itemKey = [string]$item.Cents
                $state.Counts[$itemKey] = [long]$parsedFastEntry.Counts[$itemKey]
            }

            $fastEntryTextBox.Clear()
            $errorLabel.ForeColor = $uiMutedText
            $errorLabel.Text = 'Fast entry applied. You can still adjust any bill or coin button.'
            & $refreshCashSelection
        }.GetNewClosure())

        $fastEntryTextBox.Add_KeyDown({
            param($sender, $eventArgs)

            if ($eventArgs.KeyCode -eq [System.Windows.Forms.Keys]::Enter) {
                $eventArgs.SuppressKeyPress = $true
                $eventArgs.Handled = $true
                $applyFastEntryButton.PerformClick()
            }
        }.GetNewClosure())

        $actionPanel = New-Object System.Windows.Forms.Panel
        $actionPanel.Location = New-Object System.Drawing.Point(20, 762)
        $actionPanel.Size = New-Object System.Drawing.Size(1000, 64)
        $actionPanel.BackColor = $uiBackground
        $form.Controls.Add($actionPanel)

        $submitButton = New-Object System.Windows.Forms.Button
        $submitButton.Location = New-Object System.Drawing.Point(0, 4)
        $submitButton.Size = New-Object System.Drawing.Size(280, 56)
        $submitButton.Text = 'Submit answer'
        $submitButton.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 11)
        $submitButton.AccessibleName = 'Submit cash answer'
        $submitButton.TabIndex = 40
        & $styleFlatButton $submitButton $uiAccentDark $uiText
        $actionPanel.Controls.Add($submitButton)

        $clearButton = New-Object System.Windows.Forms.Button
        $clearButton.Location = New-Object System.Drawing.Point(296, 4)
        $clearButton.Size = New-Object System.Drawing.Size(210, 56)
        $clearButton.Text = 'Clear selections'
        $clearButton.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 10.5)
        $clearButton.AccessibleName = 'Clear selected bills and coins'
        $clearButton.TabIndex = 41
        & $styleFlatButton $clearButton $uiSurfaceRaised $uiText
        $actionPanel.Controls.Add($clearButton)

        $cancelButton = New-Object System.Windows.Forms.Button
        $cancelButton.Location = New-Object System.Drawing.Point(820, 4)
        $cancelButton.Size = New-Object System.Drawing.Size(180, 56)
        $cancelButton.Text = 'Stop quiz'
        $cancelButton.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 10.5)
        $cancelButton.AccessibleName = 'Stop the quiz'
        $cancelButton.TabIndex = 42
        & $styleFlatButton $cancelButton $uiSurfaceRaised $uiText
        $actionPanel.Controls.Add($cancelButton)

        if ($null -ne $DeclaredAnswer) {
            $submitButton.Text = 'Submit cash construction'
            $clearButton.Text = 'Clear cash selections'
        }

        $form.AcceptButton = $submitButton
        $form.CancelButton = $cancelButton

        $clearButton.Add_Click({
            foreach ($key in @($state.Counts.Keys)) {
                $state.Counts[$key] = [long]0
            }

            $fastEntryTextBox.Clear()

            if ($null -eq $DeclaredAnswer) {
                $exactRadio.Checked = $false
                $changeRadio.Checked = $false
                $shortRadio.Checked = $false
                $amountTextBox.Text = ''
            }
            $errorLabel.ForeColor = $uiMutedText
            $errorLabel.Text = $keyboardHintText
            $selectedTotalLabel.Text = 'Selected: $0.00'
            & $refreshSelectionStatus 0

            foreach ($item in $allDenominations) {
                $itemKey = [string]$item.Cents
                $countLabels[$itemKey].Text = '0'
            }
        }.GetNewClosure())

        $cancelButton.Add_Click({
            $state.Cancelled = $true
            $form.Close()
        }.GetNewClosure())

        $submitButton.Add_Click({
            $errorLabel.ForeColor = $uiMutedText
            $errorLabel.Text = $keyboardHintText

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
                $errorLabel.ForeColor = $uiDanger
                $errorLabel.Text = 'Choose E, C, or S before submitting.'
                return
            }

            if ($selectedType -eq 'Exact') {
                [long]$exactCashTotal = & $getLocalCashTotal $state.Counts

                $state.Type = 'Exact'
                $state.AmountCents = [long]0
                $state.CashTotalCents = $exactCashTotal
                $state.CashBreakdown = & $formatLocalBreakdown $state.Counts
                $state.BreakdownMatchesAmount = ($exactCashTotal -eq 0)
                $state.Text = 'E'
                $state.ValidationMessage = ''
                $state.Submitted = $true
                $form.Close()
                return
            }

            $parsedAmount = & $parseLocalAmount $amountTextBox.Text

            if (-not $parsedAmount.Valid -or $parsedAmount.Cents -le 0) {
                $errorLabel.ForeColor = $uiDanger
                $errorLabel.Text = 'Enter a valid amount, such as 12.35.'
                return
            }

            [long]$cashTotal = & $getLocalCashTotal $state.Counts

            $state.Type = $selectedType
            $state.AmountCents = [long]$parsedAmount.Cents
            $state.CashTotalCents = $cashTotal
            $state.CashBreakdown = & $formatLocalBreakdown $state.Counts
            $state.BreakdownMatchesAmount = ($cashTotal -eq $parsedAmount.Cents)
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

        if (-not [string]::IsNullOrWhiteSpace($PreviewScreenshotPath)) {
            $form.Add_Shown({
                $form.Refresh()
                [System.Windows.Forms.Application]::DoEvents()

                $previewDirectory = Split-Path `
                    -Path $PreviewScreenshotPath `
                    -Parent

                if (
                    -not [string]::IsNullOrWhiteSpace($previewDirectory) -and
                    -not (Test-Path -LiteralPath $previewDirectory)
                ) {
                    New-Item `
                        -ItemType Directory `
                        -Path $previewDirectory `
                        -Force | Out-Null
                }

                $previewBitmap = New-Object System.Drawing.Bitmap(
                    $form.Width,
                    $form.Height
                )

                try {
                    $previewBounds = New-Object System.Drawing.Rectangle(
                        0,
                        0,
                        $form.Width,
                        $form.Height
                    )
                    $form.DrawToBitmap($previewBitmap, $previewBounds)
                    $previewBitmap.Save(
                        $PreviewScreenshotPath,
                        [System.Drawing.Imaging.ImageFormat]::Png
                    )
                }
                finally {
                    $previewBitmap.Dispose()
                }

                if ($PreviewOnly) {
                    $state.Cancelled = $true
                    $state.ValidationMessage = 'Visual preview captured.'
                    $form.Close()
                }
            }.GetNewClosure())
        }

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
                ElapsedSeconds = [double](
                    $elapsed + $ElapsedSecondsBefore
                )
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
            ElapsedSeconds = [double](
                $elapsed + $ElapsedSecondsBefore
            )
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

        $selectedCashTotal = if ($AnswerMode -eq 'Typed + bill/coin buttons') {
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
                -LiteralPath $appState.HistoryPath `
                -NoTypeInformation `
                -Append `
                -Encoding UTF8
    }

    function Show-CashConstructionFeedback {
        param(
            [object]$Question,
            [object]$AnswerResult,
            [bool]$Correct
        )

        [long]$requiredCents = [long]$Question.ExpectedAmountCents
        [long]$selectedCents = [long]$AnswerResult.CashTotalCents

        Write-Host ''
        Write-Host 'BILL/COIN RESULT' -ForegroundColor Cyan
        Write-Host ('Required amount: ' + (Format-Money $requiredCents))
        Write-Host ('Selected amount: ' + (Format-Money $selectedCents))
        Write-Host ('Selected bills/coins: ' + $AnswerResult.CashBreakdown)

        if (-not $Correct) {
            [long]$differenceCents = $selectedCents - $requiredCents

            $differenceText = if ($differenceCents -gt 0) {
                (Format-Money $differenceCents) + ' over the required amount'
            }
            elseif ($differenceCents -lt 0) {
                (Format-Money (-$differenceCents)) + ' short of the required amount'
            }
            else {
                '$0.00 (selected amount matches the required amount, but the declared answer was incorrect)'
            }

            Write-Host ('Difference: ' + $differenceText) -ForegroundColor Yellow
        }

        $resultText = if ($Correct) { 'Correct' } else { 'Incorrect' }
        $resultColor = if ($Correct) { 'Green' } else { 'Red' }
        Write-Host ('Result: ' + $resultText) -ForegroundColor $resultColor
        Write-Host (
            'Example correct breakdown: ' +
            (Get-RecommendedAnswerGuidance -Question $Question)
        ) -ForegroundColor Cyan
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
        if (-not (Test-Path -LiteralPath $appState.HistoryPath)) {
            return
        }

        $header = Get-Content `
            -LiteralPath $appState.HistoryPath `
            -TotalCount 1

        if ([string]::IsNullOrWhiteSpace($header)) {
            Remove-Item -LiteralPath $appState.HistoryPath -Force
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
            Import-Csv -LiteralPath $appState.HistoryPath
        )

        $backupPath = Join-Path `
            $appState.DataDirectory `
            (
                'Cash-Handling-Quiz-History-Legacy-' +
                (Get-Date).ToString('yyyyMMdd-HHmmss') +
                '.csv'
            )

        Copy-Item `
            -LiteralPath $appState.HistoryPath `
            -Destination $backupPath `
            -Force

        if ($legacyRows.Count -eq 0) {
            Remove-Item -LiteralPath $appState.HistoryPath -Force
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
                -LiteralPath $appState.HistoryPath `
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

    function Read-DataDirectorySetting {
        param([string]$CurrentDirectory)

        while ($true) {
            Write-Host ''
            Write-Host "Current data folder: $CurrentDirectory" -ForegroundColor DarkGray
            $rawDirectory = Read-Host 'Press Enter to keep it, or type a new data folder path'

            if ([string]::IsNullOrWhiteSpace($rawDirectory)) {
                return $CurrentDirectory
            }

            try {
                return Resolve-QuizDataDirectory -Directory $rawDirectory
            }
            catch {
                Write-Host 'That folder could not be used. Please enter another location.' -ForegroundColor Yellow
                Write-Host $_.Exception.Message -ForegroundColor DarkGray
            }
        }
    }
    function Show-QuizSettings {
        while ($true) {
            Write-Host ''
            Write-Host 'SETTINGS' -ForegroundColor Cyan
            Write-Host "[1] Default number of questions: $($appState.Settings.DefaultQuestionCount)"
            Write-Host "[2] Default seconds per transaction: $($appState.Settings.DefaultTimeLimitSeconds)"
            Write-Host "[3] Stats and history folder: $($appState.DataDirectory)"
            Write-Host "[4] Clickable bill/coin mode default: $(if ($appState.Settings.ClickableBillCoinModeEnabled) { 'ON' } else { 'OFF' })"
            Write-Host "[5] Auto-continue after timeout default: $(if ($appState.Settings.AutoContinueOnTimeoutEnabled) { 'ON' } else { 'OFF' })"
            Write-Host '[B] Back to main menu'

            $choice = (Read-Host 'Choose a setting').Trim().ToLowerInvariant()
            $changed = $false

            switch ($choice) {
                '1' {
                    $appState.Settings.DefaultQuestionCount = Read-IntegerSetting `
                        -Prompt 'Default number of questions' `
                        -Default $appState.Settings.DefaultQuestionCount `
                        -Minimum 1 `
                        -Maximum 100
                    $changed = $true
                }
                '2' {
                    $appState.Settings.DefaultTimeLimitSeconds = Read-IntegerSetting `
                        -Prompt 'Default seconds allowed for each transaction' `
                        -Default $appState.Settings.DefaultTimeLimitSeconds `
                        -Minimum 3 `
                        -Maximum 300
                    $changed = $true
                }
                '3' {
                    $newDataDirectory = Read-DataDirectorySetting `
                        -CurrentDirectory $appState.DataDirectory
                    $appState.Settings.DataDirectory = $newDataDirectory
                    $appState.DataDirectory = $newDataDirectory
                    $appState.HistoryPath = Join-Path `
                        $newDataDirectory `
                        'Cash-Handling-Quiz-History.csv'
                    $script:dataDirectory = $appState.DataDirectory
                    $script:historyPath = $appState.HistoryPath
                    $changed = $true
                    Ensure-HistorySchema
                    Write-Host "Future history will be saved in: $($appState.HistoryPath)" -ForegroundColor Green
                }
                '4' {
                    $appState.Settings.ClickableBillCoinModeEnabled = -not [bool]$appState.Settings.ClickableBillCoinModeEnabled
                    $changed = $true
                }
                '5' {
                    $appState.Settings.AutoContinueOnTimeoutEnabled = -not [bool]$appState.Settings.AutoContinueOnTimeoutEnabled
                    $changed = $true
                }
                'b' {
                    return
                }
                'back' {
                    return
                }
                default {
                    Write-Host 'Choose 1 through 5, or B.' -ForegroundColor Yellow
                }
            }

            if ($changed) {
                Save-QuizSettings `
                    -Settings $appState.Settings `
                    -Path $settingsPath
                Write-Host 'Settings saved.' -ForegroundColor Green
            }
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

    function Get-MemoryModeConfig {
        param(
            [ValidateSet('Easy', 'Medium', 'Hard')]
            [string]$Level
        )

        switch ($Level) {
            'Easy' {
                return [pscustomobject]@{
                    MinimumDigits = 4
                    MaximumDigits = 6
                    MinimumValues = 1
                    MaximumValues = 2
                    ReadSeconds = 5
                    WriteSeconds = 10
                }
            }
            'Medium' {
                return [pscustomobject]@{
                    MinimumDigits = 6
                    MaximumDigits = 8
                    MinimumValues = 2
                    MaximumValues = 3
                    ReadSeconds = 4
                    WriteSeconds = 8
                }
            }
            'Hard' {
                return [pscustomobject]@{
                    MinimumDigits = 8
                    MaximumDigits = 10
                    MinimumValues = 3
                    MaximumValues = 5
                    ReadSeconds = 3
                    WriteSeconds = 6
                }
            }
        }
    }

    function New-MemoryChallenge {
        param(
            [ValidateSet('Easy', 'Medium', 'Hard')]
            [string]$Level,
            [ValidateRange(1, 100)]
            [int]$MinimumDigits,
            [ValidateRange(1, 100)]
            [int]$MaximumDigits,
            [ValidateRange(1, 100)]
            [int]$MinimumValues,
            [ValidateRange(1, 100)]
            [int]$MaximumValues
        )

        if ($MinimumDigits -gt $MaximumDigits) {
            throw 'Minimum digits cannot be greater than maximum digits.'
        }

        if ($MinimumValues -gt $MaximumValues) {
            throw 'Minimum values cannot be greater than maximum values.'
        }

        $valueCount = Get-Random -Minimum $MinimumValues -Maximum ($MaximumValues + 1)
        $digitsByValue = @()
        $values = @()

        for ($valueIndex = 0; $valueIndex -lt $valueCount; $valueIndex++) {
            $digits = Get-Random -Minimum $MinimumDigits -Maximum ($MaximumDigits + 1)
            $number = [string](Get-Random -Minimum 1 -Maximum 10)

            for ($index = 1; $index -lt $digits; $index++) {
                $number += [string](Get-Random -Minimum 0 -Maximum 10)
            }

            $digitsByValue += $digits
            $values += $number
        }

        return [pscustomobject]@{
            Level = $Level
            MinimumDigits = $MinimumDigits
            MaximumDigits = $MaximumDigits
            MinimumValues = $MinimumValues
            MaximumValues = $MaximumValues
            ValueCount = $valueCount
            DigitsByValue = $digitsByValue
            Values = $values
            Value = $values -join ', '
        }
    }

    function ConvertTo-NormalizedMemoryAnswer {
        param([string]$Text)

        if ($null -eq $Text) {
            return ''
        }

        return ($Text -replace '[^\d]', '')
    }

    function ConvertTo-NormalizedMemoryAnswerList {
        param([string]$Text)

        if ([string]::IsNullOrWhiteSpace($Text)) {
            return @()
        }

        return @(
            $Text -split '[,;]+' |
                ForEach-Object {
                    ConvertTo-NormalizedMemoryAnswer -Text $_
                } |
                Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
        )
    }

    function Start-MemoryQuiz {
        $difficulty = Read-Difficulty
        $defaults = Get-MemoryModeConfig -Level $difficulty
        $questionCount = Read-IntegerSetting `
            -Prompt 'Number of memory rounds' `
            -Default $appState.Settings.DefaultQuestionCount `
            -Minimum 1 `
            -Maximum 100
        $minimumValues = Read-IntegerSetting `
            -Prompt 'Minimum values per round' `
            -Default $defaults.MinimumValues `
            -Minimum 1 `
            -Maximum 100
        $maximumValues = Read-IntegerSetting `
            -Prompt 'Maximum values per round' `
            -Default $defaults.MaximumValues `
            -Minimum $minimumValues `
            -Maximum 100
        $minimumDigits = Read-IntegerSetting `
            -Prompt 'Minimum digits in each value' `
            -Default $defaults.MinimumDigits `
            -Minimum 1 `
            -Maximum 100
        $maximumDigits = Read-IntegerSetting `
            -Prompt 'Maximum digits in each value' `
            -Default $defaults.MaximumDigits `
            -Minimum $minimumDigits `
            -Maximum 100
        $readSeconds = Read-IntegerSetting `
            -Prompt 'Seconds to read each number' `
            -Default $defaults.ReadSeconds `
            -Minimum 1 `
            -Maximum 60
        $writeSeconds = Read-IntegerSetting `
            -Prompt 'Seconds to write each number from memory' `
            -Default $defaults.WriteSeconds `
            -Minimum 1 `
            -Maximum 300
        $autoContinueOnTimeout = Read-AutoContinueOnTimeoutSetting `
            -Default $appState.Settings.AutoContinueOnTimeoutEnabled

        $results = @()

        Write-Host ''
        Write-Host 'NUMBER MEMORY GAME' -ForegroundColor Cyan
        Write-Host "Mode: $difficulty | $minimumValues-$maximumValues values per round | $minimumDigits-$maximumDigits digits per value | read: $readSeconds seconds | write: $writeSeconds seconds" -ForegroundColor Cyan
        Write-Host "Auto-continue after timeouts: $(if ($autoContinueOnTimeout) { 'ON' } else { 'OFF' })" -ForegroundColor Cyan
        Write-Host 'Read every value, then type them after the screen clears. Separate values with commas; spaces inside a value are allowed.' -ForegroundColor DarkGray

        for ($round = 1; $round -le $questionCount; $round++) {
            $challenge = New-MemoryChallenge `
                -Level $difficulty `
                -MinimumDigits $minimumDigits `
                -MaximumDigits $maximumDigits `
                -MinimumValues $minimumValues `
                -MaximumValues $maximumValues

            Write-Host ''
            Write-Host ('=' * 72) -ForegroundColor DarkGray
            Write-Host "MEMORY ROUND $round OF $questionCount | $difficulty" -ForegroundColor Cyan
            Write-Host "Read these $($challenge.ValueCount) value(s). Each has $minimumDigits-$maximumDigits digits and hides in $readSeconds seconds:" -ForegroundColor White
            Write-Host ''
            for ($valueIndex = 0; $valueIndex -lt $challenge.Values.Count; $valueIndex++) {
                Write-Host ("Value {0}: {1}" -f ($valueIndex + 1), $challenge.Values[$valueIndex]) -ForegroundColor Green
            }

            for ($secondsRemaining = $readSeconds; $secondsRemaining -gt 0; $secondsRemaining--) {
                $percentComplete = [Math]::Round(
                    (($readSeconds - $secondsRemaining) * 100.0) / $readSeconds,
                    0
                )
                Write-Progress `
                    -Activity 'Memorize the number' `
                    -Status "$secondsRemaining seconds remaining" `
                    -PercentComplete $percentComplete
                Start-Sleep -Seconds 1
            }
            Write-Progress -Activity 'Memorize the number' -Completed
            Clear-Host

            Write-Host 'NUMBER MEMORY GAME' -ForegroundColor Cyan
            Write-Host "Round $round of $questionCount | The number is hidden." -ForegroundColor White
            Write-Host "Type $($challenge.ValueCount) value(s) from memory, separated by commas, within $writeSeconds seconds. Press Esc to stop the game." -ForegroundColor DarkGray

            $timedAnswer = Read-TimedAnswer -Seconds $writeSeconds

            if ($timedAnswer.Cancelled) {
                Write-Host 'Memory game stopped.' -ForegroundColor Yellow
                break
            }

            $normalizedAnswerValues = ConvertTo-NormalizedMemoryAnswerList `
                -Text $timedAnswer.Text
            $correct = -not $timedAnswer.TimedOut -and $normalizedAnswerValues.Count -eq $challenge.Values.Count

            if ($correct) {
                for ($valueIndex = 0; $valueIndex -lt $challenge.Values.Count; $valueIndex++) {
                    if ($normalizedAnswerValues[$valueIndex] -ne $challenge.Values[$valueIndex]) {
                        $correct = $false
                        break
                    }
                }
            }

            if ($correct) {
                Write-Host 'CORRECT - You recalled the number in order.' -ForegroundColor Green
            }
            elseif ($timedAnswer.TimedOut) {
                Write-Host "TIME EXPIRED - The number was $($challenge.Value)." -ForegroundColor Yellow
            }
            else {
                Write-Host "NOT QUITE - The number was $($challenge.Value)." -ForegroundColor Red
            }

            Write-Host "Your entry: $(if ($normalizedAnswerValues.Count -eq 0) { '<NONE>' } else { $normalizedAnswerValues -join ', ' })" -ForegroundColor DarkGray
            Write-Host ("Time used: " + $timedAnswer.ElapsedSeconds.ToString('N2') + ' seconds') -ForegroundColor DarkGray

            $results += [pscustomobject]@{
                Correct = $correct
                TimedOut = [bool]$timedAnswer.TimedOut
                ElapsedSeconds = [double]$timedAnswer.ElapsedSeconds
            }

            if ($round -lt $questionCount) {
                if ($timedAnswer.TimedOut -and $autoContinueOnTimeout) {
                    continue
                }

                [void](Read-Host 'Press Enter for the next memory round')
                Clear-Host
            }
        }

        if ($results.Count -gt 0) {
            $correctCount = @($results | Where-Object { $_.Correct }).Count
            $timedOutCount = @($results | Where-Object { $_.TimedOut }).Count
            $accuracy = [Math]::Round(($correctCount * 100.0) / $results.Count, 1)
            $averageTime = [Math]::Round(($results | Measure-Object -Property ElapsedSeconds -Average).Average, 2)

            Write-Host ''
            Write-Host 'MEMORY SESSION RESULTS' -ForegroundColor Cyan
            Write-Host "Score: $correctCount / $($results.Count) ($accuracy%)"
            Write-Host "Timed out: $timedOutCount"
            Write-Host "Average writing time: $averageTime seconds"
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
        $cashConstructionForQuiz = Read-ClickableModeSetting `
            -Default $appState.Settings.ClickableBillCoinModeEnabled

        if (
            $cashConstructionForQuiz -and
            -not (Test-ClickableModeAvailable)
        ) {
            Write-Host 'Cash construction is unavailable on this computer. This quiz will use typed answers only.' -ForegroundColor Yellow
            $cashConstructionForQuiz = $false
        }

        $questionCount = Read-IntegerSetting `
            -Prompt 'Number of questions' `
            -Default $appState.Settings.DefaultQuestionCount `
            -Minimum 1 `
            -Maximum 100

        $timeLimit = Read-IntegerSetting `
            -Prompt 'Seconds allowed for each answer' `
            -Default $appState.Settings.DefaultTimeLimitSeconds `
            -Minimum 3 `
            -Maximum 300
        $autoContinueOnTimeout = Read-AutoContinueOnTimeoutSetting `
            -Default $appState.Settings.AutoContinueOnTimeoutEnabled

        $answerMode = if ($cashConstructionForQuiz) {
            'Typed + bill/coin buttons'
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

        Show-AnswerSyntaxNote `
            -BillCoinModeEnabled $cashConstructionForQuiz

        Write-Host (
            "Starting $difficulty quiz: " +
            "$questionCount questions, " +
            "$timeLimit seconds each."
        ) -ForegroundColor Cyan

        Write-Host "Answer mode: $answerMode" -ForegroundColor Cyan
        Write-Host "Auto-continue after timeouts: $(if ($autoContinueOnTimeout) { 'ON' } else { 'OFF' })" -ForegroundColor Cyan

        if ($cashConstructionForQuiz) {
            Write-Host 'Answer the transaction first. A final bill-and-coin button window follows each valid answer.' -ForegroundColor DarkGray
            Write-Host 'Close that window or click Stop quiz to end the session.' -ForegroundColor DarkGray
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

            $usedCashConstructionForQuestion = $cashConstructionForQuiz
            $questionAnswerMode = $answerMode

            if ($cashConstructionForQuiz) {
                $answerResult = $null
                try {
                    $timedAnswer = Read-TimedAnswer `
                        -Seconds $timeLimit

                    $answerResult = ConvertTo-NormalizedTypedAnswer `
                        -TimedAnswer $timedAnswer

                    if (
                        -not $answerResult.TimedOut -and
                        -not $answerResult.Cancelled -and
                        $answerResult.Valid
                    ) {
                        $remainingSeconds = [int][Math]::Floor(
                            $timeLimit - $answerResult.ElapsedSeconds
                        )

                        if ($remainingSeconds -lt 1) {
                            $answerResult.TimedOut = $true
                            $answerResult.Valid = $false
                            $answerResult.CashBreakdown = '<NOT COMPLETED>'
                            $answerResult.BreakdownMatchesAmount = $false
                            $answerResult.ValidationMessage = 'Time expired before the final cash-construction step could start.'
                        }
                        else {
                            $answerResult = Read-ClickableCashAnswer `
                                -Seconds $remainingSeconds `
                                -Question $question `
                                -DeclaredAnswer $answerResult `
                                -ElapsedSecondsBefore $timedAnswer.ElapsedSeconds
                        }
                    }
                }
                catch {
                    Write-Host 'The final cash-construction window could not open. This transaction is not scored.' -ForegroundColor Yellow
                    Write-Host $_.Exception.Message -ForegroundColor DarkGray

                    if ($null -eq $answerResult) {
                        $answerResult = [pscustomobject]@{
                            Text = ''
                            TimedOut = $false
                            Cancelled = $false
                            ElapsedSeconds = [double]0
                            Valid = $false
                            Type = ''
                            AmountCents = [long]0
                            CashTotalCents = [long]0
                            CashBreakdown = '<NOT COMPLETED>'
                            BreakdownMatchesAmount = $false
                            ValidationMessage = 'Cash construction could not be completed.'
                        }
                    }
                    else {
                        $answerResult.Valid = $false
                        $answerResult.CashBreakdown = '<NOT COMPLETED>'
                        $answerResult.BreakdownMatchesAmount = $false
                        $answerResult.ValidationMessage = 'Cash construction could not be completed.'
                    }
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

                if ($usedCashConstructionForQuestion) {
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

            if ($usedCashConstructionForQuestion) {
                Show-CashConstructionFeedback `
                    -Question $question `
                    -AnswerResult $answerResult `
                    -Correct $correct
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
                if ($answerResult.TimedOut -and $autoContinueOnTimeout) {
                    continue
                }

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
        'Cash handling practice plus a configurable number memory game.'

    Write-Host `
        "History is saved at: $($appState.HistoryPath)" `
        -ForegroundColor DarkGray

    while ($true) {
        Write-Host ''

        Write-Host `
            '[1] Cash handling quiz  [2] Number memory game  [3] View detailed history  [4] Clear history  [5] Settings  [Q] Quit' `
            -ForegroundColor White

        $menuChoice = (
            Read-Host 'Choose an option'
        ).Trim().ToLowerInvariant()

        switch ($menuChoice) {
            '1' {
                Start-CashQuiz
            }

            '2' {
                Start-MemoryQuiz
            }

            '3' {
                Show-History
            }
            '4' {
                Clear-History
            }
            '5' {
                Show-QuizSettings
            }

            'q' {
                break
            }

            'quit' {
                break
            }

            default {
                Write-Host `
                    'Choose 1, 2, 3, 4, 5, or Q.' `
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
