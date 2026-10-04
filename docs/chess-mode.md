# Chess in the browser

Choose **Chess** in setup, select the computer difficulty, color, and time control, then start a game. Click or tap a piece and its destination; arrow keys navigate the board, Enter/Space select, and Escape clears the selection. Promotion offers all four pieces. Flip, resign, rematch, and PGN export are available.

The computer uses pinned Stockfish 19 lite single-threaded, with default skill levels 0/3/10/20 for Beginner/Easy/Medium/Hard. The numeric slider fine-tunes any preset from 0 through 20, and the chosen level is retained in saved games, replay, PGN, CSV, and difficulty charts. Searches use that chosen level and a bounded search (normally 400 ms). These are practice levels, not measured Elo ratings. The worker loads only when Chess is opened. Engine failures pause the game and clocks and expose a retry control.

## Website layout and optional fullscreen

Starting or resuming a game, opening lessons, and opening replay keep Chess inside the normal website layout. The board is slightly larger on desktop. **Enter fullscreen** is optional; Escape returns to the website layout. **Save & return to setup** saves and pauses the game and exits fullscreen if it is active. Progress and history remain available after a result, during lesson practice, and in replay. Narrow screens stack the tools below the board. Low game clocks show a distinct warning style below 20 seconds.

## Timing and recovery

- Untimed is the default.
- Quick presets switch directly to a game clock: Bullet 1+0, Blitz 3+0 / 3+2 / 5+0 / 5+3, and Rapid 10+0 / 15+0. Game clocks also offer custom 1–60 minutes per player, and 0–30 seconds increment. A flag ends the game; a player without mating possibilities cannot win on time.
- Seconds per move accepts 1–300 seconds, default 30. Passing the deadline marks that turn late once; it does not end the game. Only a legal move resets the deadline.
- Clocks use elapsed wall time, including hidden tabs. Loading and engine failures do not consume time. **Save & return to setup** pauses the game and labels it interrupted practice.
- Active games are checkpointed on legal moves, periodically while playing, and on page exit. Reload and choose **Resume saved game**. Downtime during reload is excluded and the game is labeled resumed practice. Starting a new game replaces the active checkpoint.

## Lessons and coaching

There are 44 lessons: eight pieces/rules, twenty openings, and sixteen tactics/endgames. The 20 additions include twelve openings and eight practical patterns such as pawn/bishop/queen forks, removing a defender, opposition, passed-pawn support, underpromotion, and making a king escape square. Each lesson starts with a step-by-step demonstration: **Show next move** moves the piece, highlights its squares, and explains its purpose. After the full demonstration, **Practice it yourself** resets the position and lets you repeat the moves for both sides. Demonstration moves do not count as practice moves or completions. Legal alternatives receive feedback while the exercise waits for its intended move. Hints, retries, and completions are saved independently from game results. **Try this position against the computer** uses the selected setup settings and labels the game as a lesson position; if the exercise ended in mate/draw, it uses the lesson’s starting position.

Coaching defaults off. When enabled, hints highlight a suggested move and move feedback reports an estimated category and alternative line. Assistance is recorded. Original instructional explanations link to further reading; no opening is presented as universally best.

## History and analysis

The **Chess** tab in **History | Progress** shows local real chess data, separate from quiz accuracy and sample quiz data. Filter by difficulty, clock, dates, assisted games, resumed/interrupted practice, lesson positions, or unassisted uninterrupted games. Use replay, chart tables/appearance/zoom controls, PGN export, and CSV export.

Postgame **Analyze game** evaluates each move with two 250 ms searches at skill 20: the best move and the played move constrained by `searchmoves`. Scores are from the mover’s perspective. Centipawn loss is `max(0, best score − played score)` when both searches yield centipawn scores. Categories are exclusive: Good <50, Inaccuracy 50–99, Mistake 100–199, Blunder ≥200. Missed winning mates or newly allowed losing mates are recorded as forced-mate errors without inventing a centipawn value. A short search is an estimate, not proof of a move’s quality.

Average centipawn loss and mistake totals use only the player’s evaluated moves. Unknown scores remain unknown; pending/unavailable analysis is visible and can be retried. Late-move frequency uses only the player’s seconds-per-move opportunities. Game and lesson counts are separate. Win rate is wins divided by finished games, including draws in the denominator. Analysis records engine version, search budgets, depth, scores, and principal variations.

## Local interfaces and deployment

- `ChessSession` owns legal moves, timing, result, position identity, snapshots, and PGN. Restore replays the entire move list to preserve repetition detection.
- `ChessEngine` serializes UCI searches, drains canceled responses, and tags results with position identifiers. UI checks prevent old replies from changing another position or game.
- `ChessStore` keeps version-1 envelopes under `cash-handling-chess-games-v1`, `cash-handling-chess-lessons-v1`, and `cash-handling-chess-current-v1`. Saving a result/lesson by ID updates it rather than duplicating it. Unreadable data is preserved and a storage error is displayed.
- Rules and engine assets are vendored under `assets/chess/`; licenses and corresponding source links are included. Serve `.wasm` as `application/wasm`. The Pages workflow copies the chess modules and assets explicitly. No accounts, backend, paid services, or runtime third-party requests are needed. The PowerShell quiz is unchanged.

Run `node --test tests/*.test.mjs`. With Playwright on `NODE_PATH`, run `node tests/browser-smoke.mjs`, or set `QUIZ_FOCUSED=chess` for focused checks. `QUIZ_STATIC_ROOT` can point to an assembled Pages directory. Browser checks exercise the actual worker, four difficulties, coaching/review, lessons, exports, keyboard/touch input, reload, hidden-page clocks, failure recovery, and 320–1440px layouts.
