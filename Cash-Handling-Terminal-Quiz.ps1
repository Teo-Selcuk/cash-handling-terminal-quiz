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

    function Save-History {
        param(
            [string]$SessionId,
            [string]$Difficulty,
            [int]$QuestionNumber,
            [int]$TimeLimitSeconds,
            [object]$Question,
            [object]$TimedAnswer,
            [bool]$Correct
        )

        if ($TimedAnswer.TimedOut) {
            $userAnswer = '<TIME EXPIRED>'
            $outcome = 'Timed Out'
        }
        elseif (
            [string]::IsNullOrWhiteSpace(
                $TimedAnswer.Text
            )
        ) {
            $userAnswer = '<BLANK>'
            $outcome = 'Incorrect'
        }
        else {
            $userAnswer = $TimedAnswer.Text

            $outcome = if ($Correct) {
                'Correct'
            }
            else {
                'Incorrect'
            }
        }

        $row = [pscustomobject]@{
            Timestamp = (
                Get-Date
            ).ToString('yyyy-MM-dd HH:mm:ss')

            SessionId = $SessionId
            Difficulty = $Difficulty
            QuestionNumber = $QuestionNumber
            TimeLimitSeconds = $TimeLimitSeconds

            TimeUsedSeconds = (
                [double]$TimedAnswer.ElapsedSeconds
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

            UserAnswer = $userAnswer
            Outcome = $outcome
        }

        $row |
            Export-Csv `
                -LiteralPath $historyPath `
                -NoTypeInformation `
                -Append `
                -Encoding UTF8
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
                "Session/question: " +
                "$($record.SessionId) / " +
                "$($record.QuestionNumber)"
            )

            Write-Host `
                "Customer owed: $($record.AmountDue)"

            Write-Host `
                "Customer handed you: $($record.CashBreakdown)"

            Write-Host `
                "Cash actually handed over: $($record.CashGivenTotal)"

            Write-Host `
                "Correct result: $($record.ExpectedAnswer)"

            Write-Host `
                "Your answer: $($record.UserAnswer)"

            Write-Host (
                "Time used: " +
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

        Write-Host ''

        Write-Host (
            "Starting $difficulty quiz: " +
            "$questionCount questions, " +
            "$timeLimit seconds each."
        ) -ForegroundColor Cyan

        Write-Host `
            'Answer formats: c 12.35 = change | s 4.10 = short | e = exact' `
            -ForegroundColor DarkGray

        Write-Host `
            'Press Esc during an answer to stop the quiz.' `
            -ForegroundColor DarkGray

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

            $timedAnswer = Read-TimedAnswer `
                -Seconds $timeLimit

            if ($timedAnswer.Cancelled) {
                Write-Host `
                    'Quiz stopped. Completed questions are already in your history.' `
                    -ForegroundColor Yellow

                break
            }

            $parsedAnswer = ConvertFrom-CashAnswer `
                -Text $timedAnswer.Text

            $correct = $false

            if (
                -not $timedAnswer.TimedOut -and
                $parsedAnswer.Valid
            ) {
                $correct = (
                    $parsedAnswer.Type -eq
                    $question.ExpectedType -and

                    $parsedAnswer.AmountCents -eq
                    $question.ExpectedAmountCents
                )
            }

            $expectedText = Get-ExpectedAnswerText `
                -Question $question

            if ($correct) {
                Write-Host `
                    "CORRECT - $expectedText" `
                    -ForegroundColor Green
            }
            elseif ($timedAnswer.TimedOut) {
                Write-Host `
                    "TIME EXPIRED - Correct answer: $expectedText" `
                    -ForegroundColor Yellow
            }
            elseif (-not $parsedAnswer.Valid) {
                Write-Host `
                    "INVALID FORMAT - Correct answer: $expectedText" `
                    -ForegroundColor Red

                Write-Host `
                    'Use c 12.35, s 4.10, or e.' `
                    -ForegroundColor Yellow
            }
            else {
                Write-Host `
                    "INCORRECT - Correct answer: $expectedText" `
                    -ForegroundColor Red
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
                $timedAnswer.ElapsedSeconds.ToString('N2') +
                ' seconds'
            ) -ForegroundColor DarkGray

            $saveParameters = @{
                SessionId = $sessionId
                Difficulty = $difficulty
                QuestionNumber = $questionNumber
                TimeLimitSeconds = $timeLimit
                Question = $question
                TimedAnswer = $timedAnswer
                Correct = $correct
            }

            Save-History @saveParameters

            $sessionResults += [pscustomobject]@{
                Correct = $correct
                TimedOut = $timedAnswer.TimedOut
                ElapsedSeconds = [double](
                    $timedAnswer.ElapsedSeconds
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

    Write-Host ''
    Write-Host `
        'CASH HANDLING TERMINAL QUIZ' `
        -ForegroundColor Cyan

    Write-Host `
        'All transaction amounts are generated randomly.'

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