// Plain-language "What this shows" notes for History charts and tables.
// Simple words. Each chart says what it measures, why it matters, how to read it,
// and what your own numbers say right now.

const METRICS = Object.freeze({
  accuracy: ['Accuracy (%)', 'Out of every 100 tries, how many were fully right. Higher is better.'],
  time: ['Time (seconds)', 'How long you took to answer, on average. Lower is faster.'],
  attempts: ['Attempts', 'How many tries are in this group.'],
  'error-rate': ['Error rate (%)', 'Out of every 100 chances to make a mistake, how many were mistakes. Lower is better.'],
  'percentage-error': ['Percentage off (%)', 'How far a wrong number was from the right one, as a share of the right one. Lower is better.'],
  selections: ['Marks to fix', 'How many marks you would need to add or remove to get it fully right. Lower is better.'],
  actions: ['Actions', 'How many clicks or moves this took.'],
  cents: ['Cents off', 'How far your answer was from the right amount, in cents. 100 cents is one dollar. Lower is better.'],
  digits: ['Digits', 'How many digits were wrong, missing, or extra. Lower is better.'],
  WPM: ['WPM', 'Words per minute. One word counts as five typed characters. Higher is faster.'],
  '%': ['Percent', 'A share out of 100.'],
  count: ['Count', 'How many times this happened.'],
  score: ['Score', 'Points earned in one run. Higher is better.'],
  duration: ['Duration (seconds)', 'How long the run lasted before it ended. Longer means you kept up for more time.'],
  tasks: ['Tasks', 'The most mini-tasks you had open at the same time.'],
});

// 1 = higher is better, -1 = lower is better, 0 = neither (counts and spreads).
const DIRECTION = Object.freeze({
  accuracy: 1, WPM: 1, '%': 1, score: 1, duration: 1, tasks: 1,
  time: -1, 'error-rate': -1, 'percentage-error': -1, selections: -1, actions: -1, cents: -1, digits: -1,
  attempts: 0, count: 0,
});
const DIRECTION_BY_CHART = Object.freeze({
  'fraud-false-flags': -1, 'chess-mistakes': -1, 'chess-late': -1, 'chess-move-time': 0,
  'cash-builder-actions': 0, 'cash-error-reasons': 0, 'memory-mismatch-position': 0, 'task-mistake-type': 0,
  'performance-distribution': 0, 'overload-difficulty-distribution': 0, 'error-missed-versus-false': 0,
  'chess-outcomes': 0, 'chess-lessons': 0,
});

const OUTCOME_TERMS = Object.freeze([
  ['Correct', 'You gave the right answer in time.'],
  ['Incorrect', 'You answered, but the answer was wrong.'],
  ['Timed out', 'The timer ran out before you answered.'],
  ['Not answered', 'The question was shown, but you left before answering.'],
]);

const SMALL = 5; // Groups with fewer tries than this are too small to trust.
const BAR_HOW = 'Each bar is one group of tries. The number at the end of a bar belongs to that bar. Groups with only a few tries can jump around a lot, so trust the bars with more tries.';
const LINE_HOW = 'Read the line from left (oldest) to right (newest). One good or bad day does not mean much; look at where the line sits over many points.';

// [what (several sentences: what it is, why it matters), how to read it, extra terms]
const CHARTS = Object.freeze({
  outcomes: ['This bar splits every answer you gave into how it ended: right, wrong, out of time, or left before answering. It is the quickest way to see your overall result in one look. Wrong answers and time-outs point to different problems: wrong answers mean a slip in the work, while time-outs mean you need more speed.', 'The wider a colored piece, the bigger its share of your answers. The pieces add up to 100%.', OUTCOME_TERMS],
  'accuracy-by-difficulty': ['This chart shows how often you were right at each difficulty level. It tells you whether your skill holds up as the questions get harder, and which level is ready for more practice. A steady drop from Easy to Hard is normal; a sudden drop at one level shows where your skill stops for now.', 'Each row is one level, and the number at the end of the row belongs to that bar. The rows add up to the total above the chart.', [
    ['Accuracy (%)', 'Out of every 100 tries at that level, how many were right.'],
    ['(47 of 60 correct)', 'Right answers, then all tries at that level. The rows add up to the total above the chart.'],
    ['Points', 'Number memory gives part credit, so its rows count points instead of right answers.'],
  ]],
  'accuracy-over-time': ['This line tracks the share of right answers on each day you practiced. It shows whether your practice is paying off. A line that climbs means you are learning; a flat line near the top means you have mastered the current level and could try a harder one.', LINE_HOW, [['Each point', 'One day with practice.']]],
  'response-time-over-time': ['This line tracks your average answer time on each day you practiced. Getting faster while staying right is the main sign that a skill is becoming automatic. Times that drop while accuracy also drops mean you may be rushing.', `${LINE_HOW} Lower points mean faster answers.`, [['Each point', 'Your average answer time on one day.']]],
  'attempts-per-day': ['This chart counts how many tries you did on each day. Steady, regular practice builds skill faster than a few long sessions with big gaps. Use it to check that you are practicing often enough.', 'Each bar is one day. Taller bars mean more tries that day. Days with no practice do not appear.', []],
  'speed-vs-accuracy': ['This chart puts speed and accuracy side by side for each level. It answers one question: does going faster cost you right answers? The best spot is up and to the left: fast and right at the same time.', 'Each dot is one level. Dots further right took longer; dots higher up were more often right.', [['Across', 'Average answer time.'], ['Up', 'Accuracy at that level.']]],
  'accuracy-by-response-band': ['This chart groups your answers by how many seconds they took, then shows how often each group was right. It shows whether you do better when you take your time or when you go with your first instinct. If fast answers are much less accurate, slowing down a little is the easiest way to improve.', BAR_HOW, [['Time bands', 'Groups of answers by how many seconds they took.']]],
  'performance-distribution': ['This chart counts how many of your answers fell into each time range. It shows your usual pace and how steady it is. A tall bar in one band means a steady pace; a long spread to the right means some questions slow you down a lot.', 'Each bar is one time range. Taller bars mean more answers took that long.', [['Each bar', 'How many answers took that long.']]],
  'best-vs-recent': ['This chart puts your first 20 tries next to your latest 20. It is the simplest test of whether you have improved since you started. A higher Recent bar means your practice is working.', 'Compare the two bars directly. A gap of only a few points can be chance; a large gap is real change.', []],
  'weakest-variables': ['This chart lists the conditions where your accuracy is lowest, such as a certain amount, clue count, or setting. These are the spots where extra practice will help the most. Only conditions with enough tries are shown, so one bad try does not put a condition on the list.', 'Each bar is one condition. The lowest bars are the ones to practice first.', []],
  'strongest-variables': ['This chart lists the conditions where your accuracy is highest. These are skills you already have under control. If your strongest areas are near 100%, they are ready for a harder setting.', 'Each bar is one condition. The highest bars are your strongest areas.', []],
  // Cash handling
  'cash-denomination-accuracy': ['This chart shows how often you were right when a question used each bill or coin. Some denominations, like quarters or $20 bills, can trip people up more than others. A low bar points to the money piece you should count more carefully.', BAR_HOW, []],
  'cash-pieces': ['This chart groups questions by how many bills and coins they had in total. More pieces means more counting and more chances to slip. Watch whether your accuracy drops as the pile grows.', BAR_HOW, []],
  'cash-denomination-types': ['This chart groups questions by how many different kinds of bills and coins they mixed. Switching between many kinds is harder than counting many of one kind. A drop on the right side means mixing is your weak spot.', BAR_HOW, []],
  'cash-transaction-type': ['This chart compares the kinds of cash tasks, such as giving change or paying the exact amount. Each kind uses a different step of math. A lower bar shows which kind of task needs more practice.', BAR_HOW, []],
  'cash-due-band': ['This chart groups questions by how much money was due. Larger amounts need more steps to add up and to make change. A drop for bigger amounts means you should slow down on large totals.', BAR_HOW, []],
  'cash-customer-request': ['This chart groups questions by the special request the customer made, such as wanting certain bills back. Requests add an extra rule to follow on top of the math. A low bar shows a request type you tend to forget.', BAR_HOW, []],
  'cash-hundred-bills': ['This chart groups questions by how many $100 bills were involved. Large bills change the size of the answer quickly, so a slip with them costs a lot. A drop as the count rises means you should double-check large bills.', BAR_HOW, []],
  'cash-error-distance': ['This chart shows, for each kind of task, how far off your wrong answers were on average. Being off by a few cents is a small slip; being off by dollars is a bigger miss, like a missed bill. The size of the miss tells you what kind of mistake you are making.', `${BAR_HOW} Shorter bars mean smaller misses.`, []],
  'cash-builder-actions': ['This chart compares how many clicks you used to build the cash for right answers and for wrong ones. Many extra clicks can mean you are unsure and changing your mind. If wrong answers use far more clicks, slow, careful building may help.', 'Each bar is one result group. Compare the bars against each other.', []],
  'cash-workload': ['This chart groups questions by how much adding and multiplying they need, worked out from the bills and coins. It is an estimate, not a record of what you did in your head. It shows how much mental math you can handle before mistakes start.', BAR_HOW, [['× and +', 'How many multiply and add steps the question needs.']]],
  'cash-error-reasons': ['This chart sorts your wrong cash answers by the most likely cause. Knowing why you miss is more useful than knowing how often. Fix the biggest bar first, since it covers the most mistakes.', 'Each bar is one cause. Taller bars mean that cause happened more often.', []],
  // Number memory
  'memory-digit-length': ['This chart shows how often you recalled a number correctly, grouped by how many digits it had. Longer numbers are harder to hold in mind. The point where your accuracy drops off is your current memory span.', BAR_HOW, []],
  'memory-digit-speed': ['This chart shows your average answer time for each number length. Longer numbers usually take longer to type back. A big jump in time at one length means that is where recall starts to feel hard.', `${BAR_HOW} Shorter bars mean faster answers.`, []],
  'memory-total-load': ['This chart groups rounds by the total number of digits you had to remember, across all values shown. It measures your whole memory load at once. Accuracy that holds up at higher loads means a strong memory.', BAR_HOW, []],
  'memory-value-count': ['This chart groups rounds by how many separate numbers you had to remember. Keeping several numbers apart is harder than one long number. A drop as the count grows means you should practice holding more values.', BAR_HOW, []],
  'memory-read-duration': ['This chart groups rounds by how long the number stayed on screen. Less time to read means less time to memorize. If short display times hurt you most, practice reading in chunks.', BAR_HOW, []],
  'memory-mismatch-position': ['This chart counts where in the number your mistakes happen, from the first digit to the last. Many people slip in the middle, where memory is weakest. Knowing your weak position tells you where to focus.', 'Each bar is one position in the number. Taller bars mean more mistakes at that spot.', []],
  'memory-decimal': ['This chart compares numbers with a decimal point and numbers without one. The decimal adds an extra detail to remember. A lower bar for decimals means you sometimes lose where the point goes.', BAR_HOW, []],
  'memory-error-distance': ['This chart shows how many digits were wrong, on average, at each memory load. It shows how badly a miss goes wrong, not only how often. Small numbers mean near misses; large numbers mean the number was mostly forgotten.', `${BAR_HOW} Shorter bars mean fewer wrong digits.`, []],
  'memory-partial-recall': ['This chart shows how much of each number you got right, even when the whole answer was not perfect. It gives credit for near misses. High bars here with lower full accuracy mean you are close and need only small fixes.', BAR_HOW, []],
  // Task simulation
  'task-workflow': ['This chart shows how well you followed the right order of steps for each workflow. Real tasks fail when steps are skipped or done out of order. A low bar shows which workflow you should walk through more often.', BAR_HOW, []],
  'task-steps': ['This chart groups tasks by how many steps they needed. Longer tasks need you to keep track of more. Watch whether your result drops as the number of steps grows.', BAR_HOW, []],
  'task-workspace-load': ['This chart groups tasks by how many rows and tabs were open on the screen. A busy screen makes it harder to find the right place. A drop for busy screens means you should practice staying organized.', BAR_HOW, []],
  'task-timing': ['This chart groups tasks by how long you had to recall the steps. Less time means more pressure. A big gap between the bars shows how much time pressure affects you.', BAR_HOW, []],
  'task-mistake-type': ['This chart counts your task mistakes by kind, such as a wrong step or a missed step. It shows the habit behind most of your errors. Work on the tallest bar first.', 'Each bar is one kind of mistake. Taller bars mean it happened more often.', []],
  'task-sequence-by-workflow': ['This chart shows, for each workflow, how much of the step order you got right on average. It gives part credit when only some steps were wrong. High bars mean you know the order well even when you slip once.', BAR_HOW, []],
  'task-action-distance': ['This chart shows how many actions were wrong, on average, for each workflow. It measures how far off a task was, not just whether it failed. Small numbers mean near misses.', `${BAR_HOW} Shorter bars mean fewer wrong actions.`, []],
  'task-errors-by-speed': ['This chart groups tasks by how fast you finished them and shows the average number of wrong actions. It shows whether rushing leads to more errors. If fast tasks have more errors, slow down a little.', `${BAR_HOW} Shorter bars mean fewer wrong actions.`, []],
  // Error detection
  'error-family': ['This chart shows how often you solved each kind of puzzle. Each family checks a different skill, like spotting a pattern or checking a code. A low bar points to the puzzle type to practice.', BAR_HOW, []],
  'error-rule-layer': ['This chart groups puzzles by how many rules were stacked on top of each other. More layers means more to check at once. A drop as layers grow shows where the puzzles get too hard for now.', BAR_HOW, []],
  'error-clues': ['This chart groups puzzles by how many clues they had. More clues means more to read and compare. Watch whether your accuracy drops as the clue count rises.', BAR_HOW, []],
  'error-anomaly-count': ['This chart groups puzzles by how many real mistakes were hidden in them. Zero means the puzzle was clean. It shows whether you find every mistake or stop after the first one.', BAR_HOW, []],
  'error-missed-versus-false': ['This chart puts two kinds of mistakes side by side: real mistakes you did not mark, and fine items you marked anyway. They need different fixes. Missing too much means look more closely; marking too much means be more sure before you mark.', 'Compare the two bars. The taller one is the habit to work on first.', [['Missed', 'A real mistake you did not mark.'], ['False flag', 'You marked something that was fine.']]],
  'error-clean-puzzle': ['This chart compares puzzles with no mistakes in them to puzzles that had some. A clean puzzle is right only if you mark nothing. A low bar for clean puzzles means you tend to see mistakes that are not there.', BAR_HOW, []],
  'error-selection-distance': ['This chart shows, for each puzzle family, how many marks you would need to add or remove to be fully right. It shows how close your wrong answers were. Values under 1 mean most misses were off by only one mark.', `${BAR_HOW} Shorter bars mean you were closer.`, []],
  'cipher-rule-distance': ['This chart shows how close your Cipher Ring answers were for each number of rule layers. It measures how far off you were, not only whether you missed. A rise with more layers shows where the rules start to pile up.', `${BAR_HOW} Shorter bars mean you were closer.`, []],
  // Check & ID fraud inspection
  'fraud-run-mode': ['This chart shows how often you marked exactly the right set of problems in each run mode. A case counts as right only if you found every real problem and marked nothing extra. A low bar shows which mode puts you under too much pressure.', BAR_HOW, []],
  'fraud-difficulty': ['This chart shows exact-set accuracy at each case difficulty. Harder cases hide problems better. A steady result across levels means your checking routine is solid.', BAR_HOW, []],
  'fraud-clean': ['This chart compares cases with nothing wrong to cases with real problems. On a clean case the right answer is to mark nothing. A low bar for clean cases means you are flagging too much.', BAR_HOW, []],
  'fraud-issue-count': ['This chart groups cases by how many real problems they had. Cases with several problems test whether you keep looking after the first find. A drop as the count rises means you stop checking too early.', BAR_HOW, []],
  'fraud-selection-distance': ['This chart shows, for each run mode, how many marks you would need to add or remove to be fully right. It shows how close your wrong answers were. Values under 1 mean most misses were off by a single item.', `${BAR_HOW} Shorter bars mean you were closer.`, []],
  'fraud-issue-detection': ['This chart shows, for each kind of problem, how often you found it when it was really there. It is your catch rate. A low bar is a kind of fraud you tend to miss, which is the most costly mistake on the job.', BAR_HOW, []],
  'fraud-false-flags': ['This chart shows, for each kind of problem, how often you marked it when it was not there. False flags slow down honest customers. Lower is better here.', `${BAR_HOW} Shorter bars are better.`, []],
  // Typing
  'typing-speed': ['This line tracks your typing speed on each test. Speed grows slowly with steady practice. Look for a line that drifts upward over weeks, not day to day.', LINE_HOW, []],
  'typing-character-accuracy': ['This line tracks how many typed characters matched the prompt on each test. Speed only counts if the text is right. Aim to keep this near the top while your speed grows.', LINE_HOW, []],
  // Multitasker
  'overload-score': ['This line tracks your score on each Multitasker run. The score sums up how much you handled before the run ended. A rising line means you are handling more at once.', LINE_HOW, []],
  'overload-accuracy': ['This line tracks the share of your actions that were right on each run. Under pressure, people often start making careless clicks. Steady accuracy while scores rise is the best sign.', LINE_HOW, []],
  'overload-response': ['This line tracks how long you took to respond to each mini-task, on average, per run. Faster responses keep tasks from piling up. A falling line means you are reacting quicker.', `${LINE_HOW} Lower points mean faster responses.`, []],
  'overload-survival': ['This line tracks how long each run lasted before it ended. Longer runs mean you kept up with the tasks for more time. It is a good overall measure of how much load you can carry.', LINE_HOW, []],
  'overload-peak': ['This line tracks the most mini-tasks you had open at the same time in each run. A higher peak means you handled a heavier load. It rises as you get better at switching between tasks.', LINE_HOW, []],
  'overload-task-errors': ['This chart shows your error rate for each mini-game. Some mini-games are harder for you than others. The tallest bar is the mini-game to practice on its own.', `${BAR_HOW} Shorter bars are better.`, []],
  'overload-task-response': ['This chart shows your average response time for each mini-game. Slow mini-games let other tasks pile up. The tallest bar is where you lose the most time.', `${BAR_HOW} Shorter bars mean faster responses.`, []],
  'overload-difficulty': ['This chart shows your action accuracy at each difficulty step reached during runs. Difficulty rises as a run goes on. The step where accuracy falls off is your current limit.', BAR_HOW, []],
  'overload-task-count': ['This chart shows your error rate based on how many mini-tasks were open at once. More open tasks means more to juggle. A steep rise shows the point where juggling breaks down.', `${BAR_HOW} Shorter bars are better.`, []],
  'overload-overlap': ['This chart shows how often you made mistakes when several tasks needed attention at the same time. Overlap is where multitasking is hardest. Lower bars mean you stay calm under pressure.', `${BAR_HOW} Shorter bars are better.`, []],
  'overload-difficulty-distribution': ['This chart counts how many runs reached each difficulty step. It shows how far you usually get. More runs on the right side means you are lasting longer.', 'Each bar is one difficulty step. Taller bars mean more runs ended there.', []],
  // Error analysis (shared by the scored games)
  'error-rate-category': ['This chart splits your mistakes by the part of the answer that went wrong, and shows how often each part goes wrong when it comes up. A rate is fairer than a plain count, because some parts come up far more often than others. The tallest bar is the part of the work to slow down on.', `${BAR_HOW} Shorter bars are better.`, []],
  'error-rate-raw-input': ['This chart looks at the raw things you typed or clicked, and shows how often each kind of input was wrong. It can catch slips of the hand, like a wrong key, that the final answer hides. A tall bar means that input needs more care.', `${BAR_HOW} Shorter bars are better.`, []],
  'error-rate-over-time': ['This line tracks your error rate on each day you practiced. It is the mirror of accuracy: it counts the chances you had to slip and how many you missed. A falling line means you are making fewer mistakes.', `${LINE_HOW} Lower points are better.`, []],
  'numeric-percentage-error': ['This line shows, for each wrong number answer, how far off it was as a share of the right answer. Being 1% off is a small slip; being 50% off usually means a wrong step, like adding instead of subtracting. Watch for big spikes; they point to a step you skipped.', `${LINE_HOW} Lower points mean smaller misses.`, []],
  // Number memory: digit-level detail
  'memory-position-error': ['This chart shows how often each digit position was wrong, counting from the start of the number. It shows exactly where your memory fades. Most people hold the start and end best and lose the middle.', `${BAR_HOW} Shorter bars are better.`, []],
  'memory-position-accuracy': ['This chart shows how often each digit position was right, counting from the start of the number. It is the same data as the error-by-position chart, seen from the right-answer side. Low bars mark the positions to repeat to yourself while studying.', BAR_HOW, []],
  'memory-value-position-error': ['When a round shows several numbers, this chart shows how often the first, second, third, and so on were wrong. Later numbers often push out earlier ones. A tall bar shows which number in the list you tend to lose.', `${BAR_HOW} Shorter bars are better.`, []],
  'memory-value-position-accuracy': ['When a round shows several numbers, this chart shows how often each one in the list was recalled right. It shows whether you lose the first, middle, or last number. Practice saying the weak one back to yourself.', BAR_HOW, []],
  'memory-value-count-credit': ['This chart shows how many numbers you recalled right, on average, based on how many numbers the round showed. It gives credit for each right number, not only a perfect round. The point where it falls off is how many numbers you can hold right now.', BAR_HOW, []],
  'memory-total-load-error': ['This chart shows how likely a number was to come back wrong, based on the total digits shown in the round. More digits in total means a heavier memory load. A steep rise shows the load where your memory starts to drop things.', `${BAR_HOW} Shorter bars are better.`, []],
  'memory-difficulty-load': ['This chart shows how many numbers you recalled right at each difficulty and memory load. It mixes the level you picked with how much there was to remember. Use it to find the hardest setting you can still handle well.', BAR_HOW, []],
  'memory-length-error': ['This chart shows how often digits were wrong, grouped by how long the number was. Longer numbers give more chances to slip. A sharp jump at one length is where your memory span ends for now.', `${BAR_HOW} Shorter bars are better.`, []],
  'memory-region-error': ['This chart splits each number into a beginning, middle, and end, and shows how often digits in each part were wrong. Most people remember the start and end best. A tall middle bar is normal; a tall start or end bar is worth practicing.', `${BAR_HOW} Shorter bars are better.`, []],
  'memory-position-N-time': ['This line tracks how often you got one digit position right, day by day. It shows whether a weak spot in the number is getting better with practice. Pick a different position from the list to compare.', LINE_HOW, []],
  // Cash handling: arithmetic detail
  'cash-stage-errors': ['This chart counts your cash mistakes by the step of the math where they happened, like totaling the cash or working out the change. Some steps are confirmed from your answer; others are a best guess. The tallest bar is the step to slow down on.', 'Each bar is one step. Taller bars mean more mistakes at that step.', []],
  'cash-likely-causes': ['This chart counts the most likely causes behind your wrong cash answers, such as a missed carry or a wrong bill. One wrong answer can fit more than one cause, so the bars can add up to more than your mistakes. Use the top causes as a short list of habits to fix.', 'Each bar is one possible cause. Taller bars mean it fits more of your mistakes.', []],
  'cash-bill-confusion': ['This chart counts wrong answers that fit mixing up one bill for another, like a $10 for a $20. It is a guess based on how far off the answer was. A tall bar suggests you should check bill values one more time.', 'Each bar is one possible mix-up. Taller bars mean it fits more mistakes.', []],
  'cash-coin-confusion': ['This chart counts wrong answers that fit mixing up one coin for another, like a nickel for a dime. It is a guess based on how far off the answer was. A tall bar suggests you should check coin values one more time.', 'Each bar is one possible mix-up. Taller bars mean it fits more mistakes.', []],
  'cash-components': ['This chart shows whether your mistakes are in the dollars, the cents, or both. Dollar slips often come from bills; cent slips often come from coins or carrying. Knowing which part goes wrong tells you where to look.', `${BAR_HOW} Shorter bars are better.`, []],
  'cash-operations': ['This chart compares how often you got adding steps right with how often you got subtracting steps right. Making change uses subtraction, which many people find harder. A lower bar shows which kind of math to practice.', BAR_HOW, []],
  'cash-operator-confusion': ['This chart counts wrong answers that fit adding when you should have subtracted, or the other way around. It is a guess based on the size of the miss. Any count here means you should say the step out loud before doing it.', 'The bar is how many mistakes fit this pattern. Lower is better.', []],
  'cash-cent-mistakes': ['This chart shows how often cent amounts were wrong when you added them and when you subtracted them. Cents are small, but mistakes in them are common. A tall bar shows which cent step needs more care.', `${BAR_HOW} Shorter bars are better.`, []],
  'cash-cent-confusion': ['This chart shows how often your cent mistakes fit adding when you should have subtracted, or the reverse. It is a guess based on the size of the miss. A high rate means slow down on the cents step.', `${BAR_HOW} Shorter bars are better.`, []],
  'cash-carry-borrow': ['This chart shows how often you likely forgot to carry or borrow, for example when cents went past 100. This is one of the most common cash math slips. A high rate means you should check every time the cents cross a dollar.', `${BAR_HOW} Shorter bars are better.`, []],
  'cash-magnitude': ['This chart groups your wrong cash answers by how far off they were, from a few cents to many dollars. Small misses are usually a coin or a carry; large misses are usually a bill or a wrong step. The tallest bar tells you which kind of miss you make most.', 'Each bar is one size of miss. Taller bars mean more answers were off by that much.', []],
  'cash-common-mistakes': ['This chart ranks your cash mistake types from most to least common. One answer can fit more than one type, so the bars can add up to more than your mistakes. Start with the top bar; it covers the most errors.', 'Each bar is one mistake type. Taller bars happened more often.', []],
  'cash-mistakes-time': ['This line counts your cash math mistakes on each day you practiced. It shows whether mistakes are becoming less common. Remember that busy days have more tries, so they can show more mistakes.', `${LINE_HOW} Compare with Attempts per day to be fair.`, []],
  'cash-difficulty': ['This chart shows how often your cash math steps were right at each difficulty. Harder levels use bigger amounts and more pieces. A level near 90% or above is ready for the next one.', BAR_HOW, []],
  'cash-transaction': ['This chart shows how often your cash math steps were right for each kind of transaction. Giving change has more steps than an exact payment. A lower bar shows which transaction to practice.', BAR_HOW, []],
  'cash-step-N-time': ['This line tracks how often you got one step of the cash math right, day by day. It shows whether that step is getting more reliable. A rising line means the step is becoming automatic.', LINE_HOW, []],
  'cash-cause-N-time': ['This line counts, day by day, how many mistakes fit one likely cause. It shows whether a bad habit is fading. Remember that busy days have more tries, so they can show more mistakes.', `${LINE_HOW} Fewer is better.`, []],
  // Chess
  'chess-outcomes': ['This chart counts how your chess games ended: wins, draws, and losses. It is your overall record. Compare it with the computer level you play to judge if the level is right for you.', 'Each bar is one result. Taller bars mean more games ended that way.', []],
  'chess-difficulty': ['This chart shows your win rate against each computer level. It tells you which level is a fair challenge. A win rate near 50% is a good level to learn at; near 100% means move up.', BAR_HOW, []],
  'chess-clock': ['This chart shows your win rate for each time control. Faster clocks leave less time to think. A big gap means you play much better with more time.', BAR_HOW, []],
  'chess-move-time': ['This line tracks your average time per move in each game. It shows whether you rush or take your time. Very fast moves often lead to mistakes; very slow moves can lose on the clock.', LINE_HOW, []],
  'chess-late': ['This line counts moves you made with little time left on your clock, game by game. Many late moves mean you spend too long early in the game. Lower is better.', LINE_HOW, []],
  'chess-mistakes': ['This chart counts how many of your moves the engine rated as mistakes, by how bad they were. Big mistakes usually decide games. Cut the most serious kind first.', 'Each bar is one kind of mistake. Shorter bars are better.', []],
  'chess-lessons': ['This chart shows how many lessons you solved and how many you did not. Lessons teach patterns you will meet in real games. A high solved count means the patterns are sticking.', 'Each bar is one result. Compare the two bars.', []],
});

const round = (value, places = 1) => Number(Number(value).toFixed(places));

function formatValue(value, metric) {
  if (!Number.isFinite(value)) return '—';
  if (['accuracy', 'error-rate', 'percentage-error', '%'].includes(metric)) return `${round(value)}%`;
  if (metric === 'time' || metric === 'duration') return `${round(value)} s`;
  if (metric === 'cents') return `${round(value, 0)} cents ($${(value / 100).toFixed(2)})`;
  if (metric === 'WPM') return `${round(value)} WPM`;
  return `${round(value, Math.abs(value) < 10 ? 2 : 1)}`;
}

const tries = (count) => `${count} ${count === 1 ? 'try' : 'tries'}`;
const isPercent = (metric) => ['accuracy', '%'].includes(metric);

function percentVerdict(value) {
  if (value >= 90) return 'strong: it meets the 90% bar the speed goals use';
  if (value >= 75) return 'solid, but still below the 90% bar the speed goals use';
  if (value >= 50) return 'a skill that needs more practice';
  return 'a clear weak spot right now';
}

function weightedAverage(points) {
  const total = points.reduce((sum, point) => sum + (point.count || 0), 0);
  if (!total) return points.reduce((sum, point) => sum + point.value, 0) / points.length;
  return points.reduce((sum, point) => sum + point.value * (point.count || 0), 0) / total;
}

function assessLine(points, metric, direction) {
  if (direction === 0 && metric !== 'attempts') {
    const avg = points.reduce((sum, point) => sum + point.value, 0) / points.length;
    const low = points.reduce((a, b) => (b.value < a.value ? b : a));
    const high = points.reduce((a, b) => (b.value > a.value ? b : a));
    return [`On average this is ${formatValue(avg, metric)}, ranging from ${formatValue(low.value, metric)} (${low.label}) to ${formatValue(high.value, metric)} (${high.label}).`,
      `Your latest point (${points.at(-1).label}) is ${formatValue(points.at(-1).value, metric)}.`];
  }
  if (direction === 0) {
    const total = points.reduce((sum, point) => sum + point.value, 0);
    const busiest = points.reduce((best, point) => (point.value > best.value ? point : best));
    return [`${round(total, 0)} in total across ${points.length} points, about ${round(total / points.length)} per point.`,
      `The highest point was ${busiest.label} with ${round(busiest.value, 1)}.`];
  }
  const latest = points.at(-1);
  const best = points.reduce((a, b) => ((b.value - a.value) * direction > 0 ? b : a));
  const lines = [`Your latest point (${latest.label}) is ${formatValue(latest.value, metric)}. Your best was ${formatValue(best.value, metric)} on ${best.label}.`];
  if (points.length < 4) {
    lines.push(`There are only ${points.length} points so far, which is too few to show a trend. Keep practicing and check back.`);
    return lines;
  }
  const third = Math.max(1, Math.floor(points.length / 3));
  const early = points.slice(0, third).reduce((sum, point) => sum + point.value, 0) / third;
  const recent = points.slice(-third).reduce((sum, point) => sum + point.value, 0) / third;
  const change = recent - early;
  const meaningful = isPercent(metric) || metric === 'error-rate' ? Math.abs(change) >= 3 : Math.abs(change) >= Math.max(Math.abs(early) * 0.05, 0.01);
  const better = change * direction > 0;
  lines.push(`Your first ${third} points average ${formatValue(early, metric)}; your latest ${third} average ${formatValue(recent, metric)}.`);
  lines.push(!meaningful ? 'That is about the same, so this skill is holding steady. To push it higher, try a harder setting or a speed goal.'
    : better ? 'That is a real improvement: your practice is paying off.'
      : 'That is worse than when you started. Recent sessions may have been harder, rushed, or tired; slow down and check your work.');
  if (isPercent(metric)) lines.push(`Recent results are ${percentVerdict(recent)}.`);
  return lines;
}

function assessCounts(points, spec) {
  const total = points.reduce((sum, point) => sum + point.value, 0);
  if (!total) return ['Nothing has been counted here yet.'];
  const sorted = [...points].sort((a, b) => b.value - a.value);
  const [top, next] = sorted;
  const lines = [`${round(total, 0)} counted in total. The biggest group is "${top.label}" with ${round(top.value, 0)} (${round((top.value / total) * 100, 0)}%).`];
  if (next && next.value > 0) lines.push(`Next is "${next.label}" with ${round(next.value, 0)} (${round((next.value / total) * 100, 0)}%).`);
  if (spec.id === 'error-missed-versus-false' && next) {
    const missed = points.find((point) => /miss/i.test(point.label));
    const flagged = points.find((point) => /false/i.test(point.label));
    if (missed && flagged) lines.push(missed.value > flagged.value
      ? 'You miss real mistakes more often than you mark fine items. Look at every clue before you finish.'
      : missed.value < flagged.value ? 'You mark fine items more often than you miss real mistakes. Be sure a clue is wrong before you mark it.'
        : 'Both kinds of mistakes happen equally often.');
  } else if (['cash-error-reasons', 'task-mistake-type', 'chess-mistakes'].includes(spec.id)) {
    lines.push(`Fixing "${top.label}" first would remove the most mistakes.`);
  }
  return lines;
}

function assessGroups(points, metric, direction, spec) {
  if (points.length === 1) {
    const [only] = points;
    const lines = [`Only one group so far: "${only.label}" at ${formatValue(only.value, metric)} from ${tries(only.count ?? 0)}.`];
    if (isPercent(metric) && direction > 0) lines.push(`That is ${percentVerdict(only.value)}.`);
    return lines;
  }
  const avg = weightedAverage(points);
  const ranked = [...points].sort((a, b) => (b.value - a.value) * direction);
  const best = ranked[0];
  const worst = ranked.at(-1);
  const lines = [`Across all groups the average is ${formatValue(avg, metric)}.`,
    `Best: "${best.label}" at ${formatValue(best.value, metric)} (${tries(best.count ?? 0)}). Weakest: "${worst.label}" at ${formatValue(worst.value, metric)} (${tries(worst.count ?? 0)}).`];
  if (spec.id === 'best-vs-recent') {
    const first = points[0];
    const recent = points.at(-1);
    const change = recent.value - first.value;
    lines.splice(0, 2, Math.abs(change) < 5 ? `Your recent tries (${formatValue(recent.value, metric)}) are about the same as your first ones (${formatValue(first.value, metric)}).`
      : change * direction > 0 ? `Your recent tries (${formatValue(recent.value, metric)}) beat your first ones (${formatValue(first.value, metric)}) by ${round(Math.abs(change))} points: you have improved.`
        : `Your recent tries (${formatValue(recent.value, metric)}) are below your first ones (${formatValue(first.value, metric)}). You may be playing harder levels now, or rushing.`);
    if (isPercent(metric) && direction > 0) lines.push(`Your recent level is ${percentVerdict(recent.value)}.`);
    return lines;
  } else if (spec.id === 'accuracy-by-response-band') {
    const fast = points[0];
    const rest = points.slice(1);
    const restAvg = weightedAverage(rest);
    if (fast.value + 5 < restAvg) lines.push(`Your fastest answers (${fast.label}) are less accurate than the rest (${formatValue(fast.value, metric)} against ${formatValue(restAvg, metric)}). Taking a second longer to check would win back points.`);
    else if (fast.value > restAvg + 5) lines.push('Your fastest answers are your most accurate ones. Slow answers usually mean a hard question, not careless work.');
    else lines.push('Your accuracy is about the same whether you answer fast or slow, so speed is not costing you right answers.');
  } else {
    const gap = Math.abs(best.value - worst.value);
    const percentScale = isPercent(metric) || metric === 'error-rate';
    const clear = percentScale ? gap >= 10 : gap >= Math.abs(avg) * 0.25;
    lines.push(clear ? `The gap between best and weakest is ${percentScale ? `${round(gap)} points` : formatValue(gap, metric)}, which is large. Practice "${worst.label}" to bring it up.`
      : 'The groups are close together, so no single condition stands out as a problem.');
  }
  if (isPercent(metric) && direction > 0) lines.push(`Overall, this is ${percentVerdict(avg)}.`);
  const small = points.filter((point) => (point.count ?? 0) < SMALL);
  if (small.length) lines.push(`${small.length === 1 ? `"${small[0].label}" has` : `${small.length} groups have`} fewer than ${SMALL} tries, so ${small.length === 1 ? 'its number' : 'their numbers'} can change a lot with the next few tries.`);
  return lines;
}

/** Plain-language reading of the numbers in one chart spec. */
export function assessChart(spec) {
  const metric = spec?.series?.[0]?.metric ?? 'accuracy';
  const points = (spec?.series?.[0]?.points ?? []).filter((point) => Number.isFinite(point?.value));
  if (!points.length) return ['No data for this chart yet. Play a few rounds and it will fill in.'];
  const direction = DIRECTION_BY_CHART[spec.id] ?? DIRECTION[metric] ?? 0;
  if (spec.kind === 'line') return assessLine(points, metric, direction);
  if (direction === 0 && points.some((point) => point.measure === 'mean')) {
    return [`${points.map((point) => `"${point.label}": ${formatValue(point.value, metric)} (${tries(point.count ?? 0)})`).join('; ')}.`,
      'Compare the groups against each other; a big difference shows a different habit for that group.'];
  }
  if (direction === 0) return assessCounts(points, spec);
  return assessGroups(points, metric, direction, spec);
}

/** Explanation for one chart spec: { what, how, terms: [[term, meaning], ...], reading: [sentence, ...] }. */
export function chartExplanation(spec) {
  const metric = spec?.series?.[0]?.metric ?? 'accuracy';
  const [specific, how, specificTerms] = CHARTS[spec?.id] ?? CHARTS[String(spec?.id).replace(/-\d+-time$/, '-N-time')] ?? [];
  const metricTerm = METRICS[metric];
  const title = spec?.title ?? 'This chart';
  const what = specific ?? `${title} splits your tries into groups and shows one number for each group${metricTerm ? `, measured as ${metricTerm[0].toLowerCase()}` : ''}. Comparing the groups shows which conditions help you and which ones cause trouble. Use it to pick what to practice next.`;
  const terms = [...(specificTerms ?? [])];
  if (metricTerm && !terms.some(([term]) => term === metricTerm[0])) terms.push(metricTerm);
  if (spec?.kind === 'line' && !terms.some(([term]) => term === 'Each point')) terms.push(['Each point', 'One day or one try, in time order.']);
  return { what, how: how ?? (spec?.kind === 'line' ? LINE_HOW : BAR_HOW), terms, reading: assessChart(spec) };
}

function assessSummary(id, summary) {
  if (!summary?.answered) return ['No answers yet. Play a few rounds and this will fill in.'];
  if (id === 'outcomes') {
    const share = (summary.correct / summary.answered) * 100;
    const misses = (summary.outcomes ?? []).filter((outcome) => outcome.key !== 'correct' && outcome.count > 0);
    const biggest = misses.sort((a, b) => b.count - a.count)[0];
    const lines = [`${summary.correct} of ${summary.answered} answers were right (${round(share)}%). That is ${percentVerdict(share)}.`];
    const advice = { timedOut: 'You often run out of time, so speed is the thing to work on.', notAnswered: 'Many questions were left before answering; finish each round to get a true picture.' };
    if (biggest) lines.push(`Most misses were "${biggest.label}" (${biggest.count}). ${advice[biggest.key] ?? 'Your speed is fine; slow down slightly and check before you submit.'}`);
    return lines;
  }
  const levels = (summary.byDifficulty ?? []).filter((level) => level.answered > 0);
  if (!levels.length) return ['No answers yet.'];
  const ranked = [...levels].sort((a, b) => b.accuracyPercent - a.accuracyPercent);
  const lines = [`Best level: ${ranked[0].level} at ${ranked[0].accuracyPercent}%. Weakest level: ${ranked.at(-1).level} at ${ranked.at(-1).accuracyPercent}%.`];
  const ready = levels.filter((level) => level.accuracyPercent >= 90).map((level) => level.level);
  lines.push(ready.length ? `At or above 90% on: ${ready.join(', ')}. Those levels are mastered; move up when you are ready.`
    : 'No level is at 90% yet. Stay on the level you play most until it reaches 90%.');
  const small = levels.filter((level) => level.answered < SMALL).map((level) => level.level);
  if (small.length) lines.push(`${small.join(', ')} ${small.length === 1 ? 'has' : 'have'} fewer than ${SMALL} tries, so ${small.length === 1 ? 'that number' : 'those numbers'} can still change a lot.`);
  return lines;
}

export function summaryChartExplanation(id, summary) {
  const [what, how, terms] = CHARTS[id];
  return { what, how, terms, reading: summary === undefined ? [] : assessSummary(id, summary) };
}

const COLUMNS = Object.freeze({
  when: 'The date and time of the try.', date: 'The date and time of the try.', game: 'Which game it was.',
  level: 'The difficulty you picked.', difficulty: 'The difficulty you picked.', result: 'Right, wrong, out of time, or not answered.',
  time: 'Seconds you took to answer.', expected: 'The right answer.', 'raw-input mistakes': 'Which typed or clicked parts were wrong.',
  'numeric error': 'How far a wrong number was from the right one.', outcome: 'Right, wrong, out of time, or not answered.',
  answers: 'How many answers are in this row.', share: 'This row as a part of all answers, out of 100.',
  accuracy: 'Out of every 100 tries, how many were right.', 'scored attempts': 'Tries that could be scored.',
  'points / correct': 'Right answers, or points when part credit is given.', category: 'The group this row is about.',
  value: 'The number the chart shows for this group.', evidence: 'How many tries the number is based on.',
  '95% interval': 'The likely true range. A wide range means there is not much data yet.',
  'error rate': 'Out of every 100 chances, how many were mistakes.', errors: 'How many mistakes.',
  opportunities: 'How many chances there were to make that mistake.', attempts: 'How many tries.',
  mode: 'The way the round was played.', score: 'Your points for the run.', duration: 'How long the run lasted.',
  'peak tasks': 'The most tasks open at the same time.', 'action accuracy': 'Out of every 100 actions, how many were right.',
  response: 'Average seconds to respond.', task: 'Which mini-task.', 'wpm / cpm': 'Words and characters typed per minute.',
  'character accuracy': 'Out of every 100 typed characters, how many matched.', 'expected text': 'The text you were asked to type.',
  'your text': 'What you typed.', session: 'Which practice session the try belongs to.', attempt: 'The try number.',
  details: 'Extra facts saved with the try.',
});

/** Explanation for a data table built from its column headers. */
export function tableExplanation(label, headers = []) {
  const terms = headers.map((header) => [header, COLUMNS[header.trim().toLowerCase()]]).filter(([, meaning]) => meaning);
  const what = `${label || 'This table'}: each row is one record. It holds the exact numbers behind the charts, so you can look up any single try or group. Tables start minimized to keep the page short; use Normal Table or Expand Table to open one.`;
  return { what, how: 'Use the column notes below to read each number.', terms };
}

/** A small info toggle: closed by default, opens to show the explanation. */
export function createExplanation({ what, how, terms = [], reading = [] }, label = 'What this shows') {
  const details = document.createElement('details');
  details.className = 'explanation';
  const summary = document.createElement('summary');
  summary.innerHTML = '<span class="explanation-icon" aria-hidden="true">i</span>';
  summary.append(document.createTextNode(label));
  const text = document.createElement('p');
  text.textContent = what;
  details.append(summary, text);
  if (how) {
    const read = document.createElement('p');
    const strong = document.createElement('strong'); strong.textContent = 'How to read it: ';
    read.append(strong, document.createTextNode(how));
    details.append(read);
  }
  if (terms.length) {
    const list = document.createElement('dl');
    for (const [term, meaning] of terms) {
      const dt = document.createElement('dt'); dt.textContent = term;
      const dd = document.createElement('dd'); dd.textContent = meaning;
      list.append(dt, dd);
    }
    details.append(list);
  }
  if (reading.length) {
    const heading = document.createElement('p');
    heading.className = 'explanation-reading-title';
    heading.textContent = 'What your numbers say';
    const list = document.createElement('ul');
    list.className = 'explanation-reading';
    for (const line of reading) {
      const item = document.createElement('li'); item.textContent = line;
      list.append(item);
    }
    details.append(heading, list);
  }
  return details;
}
