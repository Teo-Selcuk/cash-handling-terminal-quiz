# Chess in the browser

Choose **Chess** in setup, select the computer difficulty, color, and time control, then start a game. Click or tap a piece and its destination; arrow keys navigate the board, Enter/Space select, and Escape clears the selection. Promotion offers all four pieces. Flip, resign, rematch, and PGN export are available.

The computer uses pinned Stockfish 19 lite single-threaded, with skill levels 0/3/10/20 for Beginner/Easy/Medium/Hard and a bounded search (normally 400 ms). These are practice levels, not measured Elo ratings. The worker loads only when Chess is opened. Engine failures pause the game and clocks and expose a retry control.

## Timing and recovery

- Untimed is the default.
- Game clocks offer 1/3/5/10/15-minute presets, custom 1–60 minutes per player, and 0–30 seconds increment. A flag ends the game; a player without mating possibilities cannot win on time.
- Seconds per move accepts 1–300 seconds, default 30. Passing the deadline marks that turn late once; it does not end the game. Only a legal move resets the deadline.
- Clocks use elapsed wall time, including hidden tabs. Loading and engine failures do not consume time. **Save & return to setup** pauses the game and labels it interrupted practice.
- Active games are checkpointed on legal moves, periodically while playing, and on page exit. Reload and choose **Resume saved game**. Downtime during reload is excluded and the game is labeled resumed practice. Starting a new game replaces the active checkpoint.

## Lessons and coaching

There are eight pieces/rules lessons, eight openings lessons, and eight tactics/endgames lessons. Guided exercises let you move both sides. Legal alternatives receive feedback while the exercise waits for its intended move. Hints, retries, and completions are saved independently from game results. **Try this position against the computer** uses the selected setup settings and labels the game as a lesson position; if the exercise ended in mate/draw, it uses the lesson’s starting position.

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
