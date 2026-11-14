// Chess trainer: interactive lessons with quizzes, flash drills, read-ahead (visualization) drills,
// quick-analysis puzzles, mistake review, and a start-to-finish training plan.
// Everything here is pure data and logic so it can be unit tested without a browser.
import { Chess, DEFAULT_POSITION } from './chess-core.mjs';

export const TRAINER_KEY = 'cash-handling-chess-trainer-v1';
export const TRACKS = ['Thinking', 'Tactics', 'Checkmates', 'Endgames', 'Strategy'];
export const TRACK_NOTES = {
  Thinking: 'How to look at a position before you move.',
  Tactics: 'Short tricks that win material.',
  Checkmates: 'Patterns that end the game.',
  Endgames: 'Few pieces left: kings and pawns matter most.',
  Strategy: 'Long-term plans when there is no trick.',
};

// ---------- small helpers ----------
const fenAfter = (fen, moves = []) => { const chess = new Chess(fen); for (const san of moves) chess.move(san); return chess.fen(); };
const mv = (n, fen, ask, choices, why, extra = {}) => ({ n, kind: 'move', fen, ask, choices, answer: choices[0], why, ...extra });
const idea = (n, fen, ask, choices, why, extra = {}) => ({ n, kind: 'idea', fen, ask, choices, answer: choices[0], why, ...extra });
const concept = (id, title, track, level, summary, when, whenNot, demo, quiz) => ({
  id, title, track, level, summary, when, whenNot,
  demo: { fen: demo.fen, steps: demo.steps.map(([san, note]) => ({ san, note })) },
  quiz: quiz.map(q => ({ ...q, id: `${id}-${q.n}`, concept: id, level: q.level ?? level, fen: q.moves ? fenAfter(q.fen, q.moves) : q.fen })),
});

// ---------- lesson content ----------
export const TRAINER_CONCEPTS = [
  concept('cct', 'Checks, captures, threats', 'Thinking', 1,
    'Every move, look at checks first, then captures, then threats. Forcing moves leave your opponent little choice, so they are the fastest to check.',
    ['Every single move, for both sides.', 'When the position feels unclear: list the forcing moves first.'],
    ['Do not play the first check you see without checking the reply.', 'A check that loses a piece is not a good check.'],
    { fen: '6k1/8/8/r7/8/8/8/3Q3K w - - 0 1', steps: [['Qd5+', 'Check first: the queen checks the king on g8 and also hits the rook on a5.'], ['Kf8', 'Black must deal with the check, so the rook cannot run away.'], ['Qxa5', 'Capture the rook. One forcing move won a whole rook.']] },
    [
      mv(1, '4k3/8/8/8/7b/8/8/1K1Q4 w - - 0 1', 'Scan checks first. Which check wins material?', ['Qa4+', 'Qe2+', 'Qd4', 'Qg4'], 'Qa4+ checks the king along a4–e8 and attacks the bishop on h4 along the 4th rank. After the king moves, Qxh4 wins the bishop.'),
      idea(2, null, 'In what order should you scan the board before every move?', ['Checks, captures, threats — for both sides', 'Only your own attacking ideas', 'Start with the piece you moved last', 'Pieces on the edge first'], 'Forcing moves (checks, then captures, then threats) limit the replies. Scan them for your opponent too, so you see what they want to do.'),
      mv(3, 'k7/8/4p3/3n2b1/8/8/8/K1QR4 w - - 0 1', 'Two captures are possible. Which one is safe?', ['Qxg5', 'Rxd5', 'Qc4', 'Rd3'], 'The bishop on g5 has no defender, so Qxg5 wins it for free. Rxd5 runs into exd5 because the e6 pawn guards d5.'),
    ]),
  concept('hanging', 'Count attackers and defenders', 'Thinking', 1,
    'Before you capture, count. If a piece has more attackers than defenders, you can usually win it. If it has as many defenders, the trade usually goes against the attacker.',
    ['Before every capture on a guarded square.', 'When your piece is attacked: count its defenders.'],
    ['Do not capture with a valuable piece when a cheap piece guards the square.', 'Do not trust the count if one defender is pinned or overloaded.'],
    { fen: 'k7/8/4p3/3n4/2B5/8/8/K2R4 w - - 0 1', steps: [['Bxd5', 'd5 has two attackers (bishop and rook) and one defender (the e6 pawn). Start with the cheaper attacker.'], ['exd5', 'Black recaptures with its only defender.'], ['Rxd5', 'Now nothing guards d5. White won a knight and a pawn for a bishop.']] },
    [
      idea(1, 'k7/8/2p1p3/3n4/2B5/8/8/K2R4 w - - 0 1', 'White traded Bxd5 cxd5. The d5 pawn still has a defender (e6) and one attacker. Should White take again with Rxd5?', ['No — exd5 recaptures and White gives a rook for a pawn', 'Yes — always finish the trade', 'Yes — rooks are safe in the center'], 'Count before each capture. After Bxd5 cxd5 the trade is even; Rxd5 exd5 would throw away a rook.', { moves: ['Bxd5', 'cxd5'], check: { type: 'bad', move: 'Rxd5' } }),
      mv(2, '6k1/6p1/2p5/3n4/r7/8/8/3Q2K1 w - - 0 1', 'Find the piece with no defender.', ['Qxa4', 'Qxd5', 'Qb3', 'Qd4'], 'The rook on a4 is not guarded, so Qxa4 wins it. The knight on d5 is guarded by the c6 pawn, so Qxd5 loses the queen.'),
      idea(3, null, 'Your knight is attacked by a pawn and defended by your queen. Is the knight safe?', ['No — the pawn is worth much less, so even one cheap attacker wins material', 'Yes — any defended piece is safe', 'Yes — queens defend everything'], 'Counting only works when the values are close. A pawn capturing a knight wins material even if you recapture, so move the knight.'),
    ]),
  concept('threats', 'Spot the threat', 'Thinking', 1,
    'After every opponent move ask: what does that move want to do next? Then decide whether to stop it.',
    ['After every move your opponent makes.', 'When a queen or bishop lines up with your king.'],
    ['Do not panic over a threat you can ignore because your own threat is bigger (a check or mate).', 'Do not defend with a move that creates a new weakness if a simple one exists.'],
    { fen: DEFAULT_POSITION, steps: [['e4', 'White opens lines for the queen and bishop.'], ['e5', 'Black answers in the center.'], ['Qh5', 'Threat 1: the queen attacks e5 and eyes f7.'], ['Nc6', 'Black guards e5.'], ['Bc4', 'Threat 2: Qxf7 would be checkmate. Two pieces now aim at f7.'], ['g6', 'Black spots it and kicks the queen while blocking the line to f7.'], ['Qf3', 'The queen keeps aiming at f7.'], ['Nf6', 'Black blocks the f-file and develops. The threat is gone.']] },
    [
      mv(1, DEFAULT_POSITION, 'White threatens Qxf7#. Which move stops it?', ['g6', 'Nf6', 'd6', 'a6'], 'g6 attacks the queen and blocks the h5–f7 line. After Nf6, d6 or a6, Qxf7 is checkmate.', { moves: ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4'], mirror: false, check: { type: 'best', depth: 1 } }),
      idea(2, 'k7/8/5n2/3p4/8/8/8/K2Q4 w - - 0 1', 'White sees a pawn on d5. Is Qxd5 a good idea?', ['No — the knight on f6 guards d5, so the queen would be lost', 'Yes — a pawn is a pawn', 'Yes — queens can capture anything'], 'Ask what Black does next: Nxd5 takes the queen. A free-looking pawn was a trap.', { check: { type: 'bad', move: 'Qxd5' } }),
      idea(3, null, 'Your opponent just moved a bishop so it points at your king. What is the first question to ask?', ['What does this move threaten next?', 'Can I copy the move?', 'Which of my pawns is furthest forward?', 'Should I offer a draw?'], 'Every move has a purpose. Name the threat first; then decide whether to defend or to make a bigger threat.'),
    ]),
  concept('fork', 'Fork: one piece, two targets', 'Tactics', 1,
    'A fork attacks two things at once. Your opponent can only save one. Knights are the best forkers because their jumps are hard to see.',
    ['Two enemy pieces (or king + piece) are a knight jump, a pawn step, or one line apart from a single square.', 'Even better when one target is the king: check forces the reply.'],
    ['Do not fork from a square the enemy can capture on.', 'Do not fork two pieces that defend each other if you lose your forking piece.'],
    { fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', steps: [['Nc7+', 'The knight jumps to c7: it checks the king on e8 and attacks the rook on a8.'], ['Kd7', 'Black has to answer the check.'], ['Nxa8', 'The knight collects the rook.']] },
    [
      mv(1, '2q1k3/8/8/1N6/8/8/8/4K3 w - - 0 1', 'Find the knight fork.', ['Nd6+', 'Nc7+', 'Na7', 'Nd4'], 'Nd6+ checks the king on e8 and attacks the queen on c8. After the king moves, Nxc8 wins the queen.'),
      idea(2, '2q1k3/4p3/8/1N6/8/8/8/4K3 w - - 0 1', 'Nd6+ attacks the king and queen again. Is it a good idea here?', ['No — the e7 pawn guards d6 and simply takes the knight', 'Yes — a fork always wins', 'Yes — but only after castling'], 'Always check the fork square. Here exd6 removes the knight, so the fork fails.', { check: { type: 'bad', move: 'Nd6+' } }),
      mv(3, '8/8/2n1n3/8/3P4/8/k7/6K1 w - - 0 1', 'Pawns fork too. Which move wins a piece?', ['d5', 'Kg2', 'Kf2', 'Kh1'], 'd5 attacks both knights, on c6 and e6, at the same time. Black saves one; White takes the other.'),
    ]),
  concept('pin', 'Pin: a piece that cannot move', 'Tactics', 1,
    'A pin attacks a piece that has something more valuable behind it. If the piece behind is the king, the pinned piece cannot legally move at all.',
    ['An enemy piece stands on a line between your bishop, rook or queen and their king or queen.', 'Then attack the pinned piece again — it cannot run.'],
    ['Do not pin with a piece that can simply be captured.', 'A relative pin (to a queen, not the king) can still be broken by moving the piece.'],
    { fen: '4k3/8/8/4q3/8/8/5K2/R7 w - - 0 1', steps: [['Re1', 'The rook pins the queen to the king on the e-file. The queen may only move along that file.'], ['Qxe1+', 'The queen cannot escape the pin, so Black gives it up for the rook.'], ['Kxe1', 'White recaptures and is a queen up for a rook.']] },
    [
      mv(1, 'k7/1q6/8/8/8/5P2/2B5/6K1 w - - 0 1', 'Find the pin that wins the queen.', ['Be4', 'Bb3', 'Bd3', 'f4'], 'Be4 pins the queen on b7 to the king on a8. The f3 pawn guards the bishop, so Qxe4 fxe4 wins the queen for a bishop.'),
      idea(2, '4k3/8/2n5/1B6/8/8/8/4K3 b - - 0 1', 'The knight on c6 stands between the bishop and its king. Can Black play Nd4?', ['No — the knight is pinned; moving it would leave the king in check, so it is illegal', 'Yes — knights can jump over pieces', 'Yes, but only if it captures something'], 'This is an absolute pin: the bishop on b5 would check the king on e8 if the knight moved.', { check: { type: 'illegal', move: 'Nd4' } }),
      idea(3, '3qk3/8/8/3n4/8/8/8/3RK3 b - - 0 1', 'The rook pins the knight to the queen (not the king). Can the knight move?', ['It is legal, but then Rxd8+ wins the queen for a rook', 'It is illegal because the knight is pinned', 'It is completely safe because the king guards the queen'], 'A pin to a queen is a relative pin: the move is legal, but you lose more than you save.', { check: { type: 'relative', move: 'Nf4', punish: 'Rxd8+' } }),
    ]),
  concept('skewer', 'Skewer: attack through a piece', 'Tactics', 2,
    'A skewer is a pin in reverse: you attack a valuable piece, it moves away, and you capture the piece behind it.',
    ['The king or queen stands in front of another piece on one line.', 'A check that forces the front piece off the line.'],
    ['Do not skewer from a square that is guarded.', 'It fails if the back piece is protected and worth less than your attacker.'],
    { fen: '4q3/8/8/4k3/8/8/8/R6K w - - 0 1', steps: [['Re1+', 'Check along the e-file. The queen hides behind the king.'], ['Kd5', 'The king must step off the file.'], ['Rxe8', 'Now the rook takes the queen behind it.']] },
    [
      mv(1, '8/q3k3/8/8/8/8/8/5K1R w - - 0 1', 'Find the skewer.', ['Rh7+', 'Rh6', 'Rh8', 'Kg2'], 'Rh7+ checks the king along the 7th rank. When the king moves, Rxa7 takes the queen.'),
      idea(2, '8/q3k3/5n2/8/8/8/8/5K1R w - - 0 1', 'Is the skewer Rh7+ a good idea here?', ['No — the knight on f6 guards h7 and takes the rook', 'Yes — skewers always win the back piece', 'Yes — the king must move first'], 'Look at the square you land on. Nxh7 removes the rook before the skewer works.', { check: { type: 'bad', move: 'Rh7+' } }),
      mv(3, '6q1/8/8/3k4/8/8/8/1B5K w - - 0 1', 'Find the bishop skewer.', ['Ba2+', 'Be4+', 'Bc2', 'Bd3'], 'Ba2+ checks the king on d5 along a2–g8. When the king steps away, Bxg8 wins the queen. Be4+ just loses the bishop to Kxe4.'),
    ]),
  concept('discovered', 'Discovered attack', 'Tactics', 2,
    'When a piece moves out of the way, the piece behind it suddenly attacks. You get two attacks for one move: the moving piece and the uncovered line.',
    ['Your bishop, rook or queen is blocked by your own piece, aimed at a target.', 'Best when the uncovered attack is a check: then the moving piece can grab anything.'],
    ['Do not move the front piece to a square where it is simply lost unless the uncovered attack wins more.', 'Check your own lines too: your opponent can discover attacks against you.'],
    { fen: 'q3k3/8/8/8/4B3/8/8/4R1K1 w - - 0 1', steps: [['Bxa8+', 'The bishop takes the queen and uncovers the rook: discovered check on the e-file.'], ['Kd7', 'Black must answer the check and cannot recapture.']] },
    [
      mv(1, '3q2k1/8/4P3/6N1/8/8/8/6RK w - - 0 1', 'Move the knight to uncover the rook — and win something.', ['Nf7+', 'Ne4+', 'Nh7+', 'e7'], 'Nf7+ uncovers check from the g1 rook and attacks the queen on d8. The e6 pawn guards f7, so after the king moves, Nxd8 wins the queen.'),
      idea(2, null, 'Your rook is behind your own bishop, aimed at the enemy king. What happens when the bishop moves off the line?', ['The rook gives check — a discovered check — and the bishop is free to attack something else', 'Nothing — only the piece that moves can attack', 'The move is illegal'], 'That is a discovered check. The opponent must deal with the rook, so the bishop can capture or fork without being taken.'),
    ]),
  concept('double-check', 'Double check', 'Tactics', 2,
    'A double check is a discovered check where the moving piece also gives check. Two pieces check at once, so the only answer is to move the king.',
    ['You have a discovered check and the moving piece can also check.', 'The enemy king has few squares — double check often leads to mate.'],
    ['Do not expect a block or capture to save you: in double check only a king move works.'],
    { fen: '4k3/8/8/8/8/8/4B3/4R2K w - - 0 1', steps: [['Bb5+', 'The bishop checks from b5 and uncovers the rook on e1: double check.'], ['Kf7', 'Black cannot block both lines, so the king must move.']] },
    [
      mv(1, '4k3/8/8/8/4N3/8/8/4R1K1 w - - 0 1', 'Every knight move here gives a discovered check. Which one is a double check?', ['Nf6+', 'Nc5+', 'Ng3+', 'Nc3+'], 'Nf6+ uncovers the rook and the knight itself checks e8. Two checks at once: Black must move the king.', { check: { type: 'double' } }),
      idea(2, null, 'In a double check, how must the defender answer?', ['Move the king — blocking or capturing one checker cannot stop the other', 'Block one of the checks', 'Capture either checking piece', 'Castle'], 'One block or capture only stops one of the two checks. The king has to move.'),
    ]),
  concept('remove-defender', 'Remove the defender', 'Tactics', 2,
    'If a piece is guarded only once, capture (or chase away) its guard first. Then the piece is loose.',
    ['A target is defended by exactly one piece.', 'You can capture that guard, ideally with check.'],
    ['Do not trade off the defender if you lose more than you win.', 'Check that there is not a second hidden defender.'],
    { fen: 'k7/8/2n5/1B6/3q4/8/7K/3R4 w - - 0 1', steps: [['Bxc6+', 'The knight on c6 is the only guard of the queen on d4. Take it — with check.'], ['Kb8', 'Black must answer the check.'], ['Rxd4', 'Now the queen has no defender and falls.']] },
    [
      mv(1, '7k/8/5n2/6B1/4q3/8/K7/4R3 w - - 0 1', 'The knight on f6 is the queen’s only guard. Win the most material.', ['Bxf6+', 'Rxe4', 'Bh4', 'Kb3'], 'Bxf6+ removes the guard with check; after the king moves, Rxe4 wins the queen too. Rxe4 first wins the queen for a rook only.'),
      idea(2, 'k7/8/2n5/1B6/3q4/8/7K/3R4 w - - 0 1', 'Should White take the queen right away with Rxd4?', ['No — Bxc6+ first wins the knight and then the queen', 'Yes — always take the biggest piece first', 'Yes — the rook is safe on d4'], 'Rxd4 Nxd4 only trades rook for queen. Removing the defender first wins both pieces.', { check: { type: 'compare', better: 'Bxc6+', worse: 'Rxd4' } }),
    ]),
  concept('deflection', 'Deflection: lure the guard away', 'Tactics', 3,
    'A deflection forces a defender to leave its post. Attack it with something cheap; if it moves, the thing it guarded collapses.',
    ['One enemy piece has an important job (guarding mate or a piece).', 'You can attack that piece with a pawn or make it capture.'],
    ['Do not attack the guard if it can move to a square where it still does its job.'],
    { fen: '5rk1/5pp1/5n2/8/4P3/3B3Q/8/6K1 w - - 0 1', steps: [['e5', 'The pawn attacks the knight, which is the only guard of h7. It also opens the bishop’s line to h7.'], ['Nh5', 'The only way to stop Qh7#: block the queen. Every other knight move allows mate.'], ['Qxh5', 'White wins the knight.']] },
    [
      mv(1, '1kr5/1pp5/2n5/8/3P4/Q3B3/8/1K6 w - - 0 1', 'Chase the guard of a7 away.', ['d5', 'Qa7+', 'Bf4', 'Qa4'], 'd5 attacks the knight on c6, the only guard of a7. Black must give up the knight or allow Qa7 mate.', { mirror: false }),
      idea(2, null, 'What is the idea of a deflection?', ['Force a defender away from the square or piece it protects', 'Trade all the pieces', 'Push pawns toward promotion', 'Move your king to safety'], 'Find the piece with an important job and give it a reason to leave.'),
    ]),
  concept('overload', 'Overloaded defender', 'Tactics', 3,
    'A defender with two jobs can only do one. Make it choose.',
    ['One enemy piece guards two things (for example a piece and the back rank).', 'Capture one of the guarded things.'],
    ['Do not assume overload if another piece helps defend.'],
    { fen: '3r2k1/5ppp/8/8/3n4/8/5PPP/3RR1K1 w - - 0 1', steps: [['Rxd4', 'The d8 rook guards both the knight and the back rank. Take the knight.'], ['h6', 'If Rxd4, Re8 is checkmate. So Black makes an escape square instead.'], ['Rxd8+', 'White is a knight up and trades into a won ending.']] },
    [
      mv(1, '1k2r3/ppp5/8/8/4n3/8/PPP5/1K1RR3 w - - 0 1', 'One black rook has two jobs. Which capture exploits it?', ['Rxe4', 'Rd8+', 'Re3', 'a3'], 'The e8 rook guards the knight and the back rank. If Rxe4 Rxe4, Rd8 is mate, so the knight is simply lost.', { mirror: false }),
      idea(2, null, 'A defender is overloaded when…', ['it has two jobs and can only do one of them', 'it is attacked by a pawn', 'it stands on the edge of the board', 'it has already moved twice'], 'Find the piece guarding two things, then hit one of them.'),
    ]),
  concept('back-rank', 'Back-rank mate', 'Checkmates', 1,
    'A king behind its own unmoved pawns has no escape. A rook or queen on the back rank is checkmate.',
    ['The enemy king is on its first rank behind three pawns.', 'No enemy piece guards the back rank.'],
    ['It is not mate if the king has an escape square (for example after h6).', 'It fails if a piece can capture or block on the back rank.'],
    { fen: '6k1/5ppp/8/8/8/8/8/R6K w - - 0 1', steps: [['Ra8#', 'The rook checks along the 8th rank. The king’s own pawns block every escape: checkmate.']] },
    [
      mv(1, '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', 'Find checkmate in one.', ['Rd8#', 'Rd7', 'h3', 'Kf1'], 'Rd8 checks along the back rank and the pawns on f7, g7, h7 trap the king.', { check: { type: 'mate' } }),
      idea(2, '6k1/5pp1/7p/8/8/8/5PPP/3R2K1 w - - 0 1', 'White plays Rd8+. Is it checkmate?', ['No — h6 made an escape square on h7', 'Yes — the back rank is always deadly', 'Yes — the rook cannot be captured'], 'That pawn move is called luft (air). The king escapes to h7.', { check: { type: 'notmate', move: 'Rd8+' } }),
      mv(3, '6k1/5ppp/8/8/8/8/1Q3PPP/6K1 w - - 0 1', 'Mate in one with the queen.', ['Qb8#', 'Qxg7+', 'Qb3', 'Qe5'], 'Qb8 reaches the back rank. Qxg7+ just loses the queen to Kxg7.', { check: { type: 'mate' } }),
    ]),
  concept('smothered', 'Smothered mate', 'Checkmates', 2,
    'When a king is surrounded by its own pieces, a single knight check is mate — knight checks cannot be blocked.',
    ['The enemy king is in a corner with its own rook and pawns next to it.', 'Your knight can reach a square that checks it.'],
    ['It is not mate if the knight can be captured or the king has a free square.'],
    { fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', steps: [['Nf7#', 'The knight checks h8. g8, g7 and h7 are filled by Black’s own pieces: smothered mate.']] },
    [
      mv(1, '6rk/6pp/8/4N3/8/8/8/6K1 w - - 0 1', 'Find the smothered mate.', ['Nf7#', 'Ng6+', 'Nd7', 'Kf2'], 'Nf7 checks the boxed-in king. Ng6+ is check too, but hxg6 captures the knight.', { check: { type: 'mate' } }),
      idea(2, null, 'Why does a smothered mate work?', ['The king is boxed in by its own pieces, and a knight check cannot be blocked', 'Knights move like bishops near kings', 'The king is in the center', 'The queen supports the knight'], 'Blocking only works against lines (rook, bishop, queen). A knight jumps, so the only defences are capturing it or moving the king.'),
    ]),
  concept('ladder', 'Two-rook ladder mate', 'Checkmates', 1,
    'Two rooks take turns: one cuts off a rank, the other checks on the next. The king is pushed to the edge and mated.',
    ['You have two rooks (or rook + queen) and the enemy king is near an edge.'],
    ['Do not put a rook next to the enemy king where it can be captured.', 'Do not rush checks that let the king escape toward the center.'],
    { fen: '4k3/8/8/8/8/8/R7/1R4K1 w - - 0 1', steps: [['Ra7', 'The a-rook cuts off the 7th rank. The king is stuck on the 8th.'], ['Kd8', 'Black waits.'], ['Rb8#', 'The second rook checks on the 8th rank: checkmate.']] },
    [
      mv(1, '3k4/R7/8/8/8/8/8/1R4K1 w - - 0 1', 'Finish the ladder.', ['Rb8#', 'Ra8+', 'Rb6', 'Rd1+'], 'The a7 rook already guards the 7th rank. Rb8 checks on the 8th: no escape.', { check: { type: 'mate' } }),
    ]),
  concept('queen-mate', 'Queen mate — avoid stalemate', 'Checkmates', 2,
    'A queen next to the enemy king, protected by your king, is mate. But if the enemy king has no move and is not in check, it is stalemate — a draw.',
    ['Your king supports the queen next to the cornered king.'],
    ['Do not take away every square without giving check: that is stalemate.'],
    { fen: '7k/8/6K1/8/8/8/8/5Q2 w - - 0 1', steps: [['Qf8#', 'Check on the back rank. Your king covers g7 and h7: checkmate.']] },
    [
      mv(1, '7k/8/5K2/8/8/8/8/6Q1 w - - 0 1', 'Find checkmate (not stalemate).', ['Qg7#', 'Qg6', 'Qh2+', 'Qg5'], 'Qg7 is protected by the king on f6 and checks h8: mate. Qg6 takes every square without check — stalemate.', { check: { type: 'mate' } }),
      idea(2, '7k/8/5K2/8/8/8/8/6Q1 w - - 0 1', 'White plays Qg6 to box the king in. What happens?', ['Stalemate — Black has no legal move and is not in check, so it is a draw', 'Checkmate', 'Black must move the king to g8'], 'Always ask: after my move, does the other side have a legal move? If not and there is no check, it is a draw.', { check: { type: 'stalemate', move: 'Qg6' } }),
    ]),
  concept('square-rule', 'The rule of the square', 'Endgames', 2,
    'Can a king catch a passed pawn? Draw a square from the pawn to its promotion rank. If the king can step inside the square, it catches the pawn.',
    ['King against a lone passed pawn, no other pieces nearby.'],
    ['The rule is a shortcut: blocked paths or other pieces change the count.', 'A pawn on its first move can go two squares — count from the square in front of it.'],
    { fen: '8/8/8/8/3k3P/8/8/K7 w - - 0 1', steps: [['h5', 'The pawn needs 4 moves to queen. The king on d4 is inside the h4–h8 square.'], ['Ke5', 'The king walks toward the corner.'], ['h6', 'Pawn races on.'], ['Kf6', 'The king stays inside the shrinking square.'], ['h7', 'One step from queening.'], ['Kg7', 'The king now guards h8.'], ['h8=Q+', 'The pawn promotes…'], ['Kxh8', '…and the king captures it. Draw.']] },
    [
      idea(1, '8/8/8/8/2k4P/8/8/K7 w - - 0 1', 'White to move. Can the black king catch the h-pawn?', ['No — the king on c4 is outside the square, so the pawn queens', 'Yes — kings are always fast enough', 'Yes — but only with check'], 'The square from h4 reaches d4–d8. The king on c4 is one file too far, and White moves first.'),
      idea(2, '8/8/8/8/2k4P/8/8/K7 b - - 0 1', 'Same position, but Black to move. Can the king catch the pawn now?', ['Yes — Kd5 steps into the square in time', 'No — the pawn is still too fast', 'Only if White blunders'], 'Moving first gives the king one extra step: Kd5 enters the square and the king reaches the corner in time.'),
    ]),
  concept('opposition', 'Opposition', 'Endgames', 3,
    'When kings face each other with one square between them, the side that must move has to give way. Taking the opposition helps your king walk forward.',
    ['King and pawn endings, kings close to each other.'],
    ['A spare pawn move can change who must move — count waiting moves.'],
    { fen: '8/8/4k3/8/8/4K3/4P3/8 w - - 0 1', steps: [['Ke4', 'White takes the opposition: the kings face each other with e5 between them.'], ['Kd6', 'Black must give way.'], ['Kf5', 'White’s king walks forward.'], ['Ke7', 'Black tries to block.'], ['Ke5', 'White keeps the king in front of its pawn and gains ground.']] },
    [
      idea(1, null, 'Kings face each other with one square between them. Who is better off?', ['The side that does NOT have to move', 'The side to move', 'The side with the bigger king', 'Neither — it is always a draw'], 'Kings may not stand next to each other, so the side to move must step aside and lets the other king in.'),
      idea(2, null, 'In a king-and-pawn ending, where should your king usually stand?', ['In front of its pawn', 'Behind its pawn', 'In the corner', 'As far away as possible'], 'A king in front of the pawn clears the way and fights for the key squares.'),
    ]),
  concept('promotion', 'Promotion and underpromotion', 'Endgames', 1,
    'A pawn that reaches the last rank becomes a queen, rook, bishop or knight. Almost always pick the queen — but check for stalemate and knight checks.',
    ['Your pawn is one step from the last rank and the square is safe.'],
    ['Do not promote to a queen if it is stalemate; a rook may win instead.', 'Do not push if the promotion square is guarded and you lose the pawn.'],
    { fen: '7k/P7/8/8/8/8/8/7K w - - 0 1', steps: [['a8=Q+', 'Promote to a queen with check along the 8th rank.'], ['Kg7', 'Black steps out of check. White has a new queen.']] },
    [
      mv(1, '8/5P1k/8/8/8/8/8/7K w - - 0 1', 'A normal promotion lets the king escape. Which promotion gives check?', ['f8=N+', 'f8=Q', 'f8=R', 'Kg2'], 'A knight on f8 checks the king on h7. A queen or rook on f8 does not give check here.', { check: { type: 'check' } }),
    ]),
  concept('development', 'Develop and fight for the center', 'Strategy', 1,
    'In the opening: put a pawn in the center, bring out knights and bishops, castle, and connect your rooks. Each move should help a piece join the game.',
    ['The first 10 moves of almost every game.'],
    ['Do not move the same piece twice without a reason.', 'Do not bring the queen out early where it gets chased.', 'Do not grab pawns while your pieces are still at home.'],
    { fen: DEFAULT_POSITION, steps: [['e4', 'Take the center and open lines for the bishop and queen.'], ['e5', 'Black does the same.'], ['Nf3', 'Develop with a threat to e5.'], ['Nc6', 'Black develops and defends.'], ['Bc4', 'Develop the bishop toward f7.'], ['Bc5', 'Black copies.'], ['O-O', 'Castle: the king is safe and the rook joins the game.']] },
    [
      mv(1, DEFAULT_POSITION, 'Which move follows opening principles best?', ['Nf3', 'h4', 'a4', 'Ke2'], 'Nf3 develops a piece, attacks e5 and prepares castling. Edge pawn moves and king walks do not help development.', { moves: ['e4', 'e5'], check: { type: 'none' }, mirror: false }),
      idea(2, null, 'Is it a good idea to bring the queen out early to grab pawns?', ['Usually not — it gets chased and you lose time while your other pieces sit at home', 'Yes — the queen is the strongest piece, so use it first', 'Yes — pawns win games'], 'Each time the queen is attacked you must move it again. Your opponent develops with tempo.'),
      idea(3, null, 'When is castling usually a good idea?', ['Early, once the knight and bishop between king and rook have moved', 'Never — kings should lead the attack', 'Only after the queens are traded', 'Only when you are in check'], 'Castling makes the king safe and connects your rooks. You cannot castle out of check.'),
    ]),
  concept('outpost', 'Outposts for knights', 'Strategy', 2,
    'An outpost is a square in the enemy half that your pawn protects and no enemy pawn can ever attack. A knight there is very strong.',
    ['Middle games with locked or fixed pawns.', 'A hole in front of an enemy pawn that has advanced.'],
    ['It is not an outpost if an enemy pawn can still step forward and attack it.', 'Do not spend many moves reaching it if your opponent is attacking.'],
    { fen: '6k1/pp3ppp/3p4/8/2P1P3/2N5/PP3PPP/6K1 w - - 0 1', steps: [['Nd5', 'The knight lands on d5. The c4 and e4 pawns guard it, and Black has no c- or e-pawn that could ever attack it.'], ['Kf8', 'Black can only wait.'], ['Kf1', 'White improves the king. The knight stays on its outpost for good.'], ['Ke8', 'The knight on d5 controls b6, c7, e7 and f6 deep in Black’s camp.']] },
    [
      idea(1, '6k1/pp3ppp/3p4/8/2P1P3/5N2/PP3PPP/6K1 w - - 0 1', 'Which square is a true outpost for White’s knight?', ['d5', 'f5', 'b5', 'd4'], 'd5 is guarded by the c4 and e4 pawns, and Black has no c- or e-pawn left to attack it. f5 can be hit by g6, b5 by a6, and d4 is in White’s own half.', { check: { type: 'outpost', color: 'w' } }),
      idea(2, null, 'Why is an outpost so good for a knight?', ['It can never be chased away by a pawn, so the knight stays there for good', 'Knights move faster from the edge', 'Pawns cannot capture knights', 'It lets the knight move like a bishop'], 'Pieces can trade with it, but pawns cannot drive it away. A knight deep in enemy land attacks many squares.'),
    ]),
  concept('open-file', 'Rooks on open files', 'Strategy', 1,
    'A file with no pawns is open. Rooks belong there: they can reach the 7th rank and attack.',
    ['A file has no pawns of either color.', 'Two rooks on the same open file (doubled) are even stronger.'],
    ['Do not put a rook behind your own pawn where it cannot move forward.', 'Do not put a rook on an open file where the enemy can trade it off for free.'],
    { fen: '6k1/pp3ppp/2p5/4p3/4P3/2P5/PP3PPP/R5K1 w - - 0 1', steps: [['Rd1', 'The d-file has no pawns. The rook takes it.'], ['Kf8', 'Black is slow.'], ['Rd7', 'The rook reaches the 7th rank and attacks pawns.']] },
    [
      idea(1, '6k1/pp3ppp/2p5/4p3/4P3/2P5/PP3PPP/R5K1 w - - 0 1', 'Where should the rook go?', ['Rd1', 'Re1', 'Rc1', 'Rb1'], 'Only the d-file has no pawns. On e1, c1 or b1 the rook is stuck behind pawns.', { check: { type: 'openfile' } }),
    ]),
  concept('king-safety', 'King safety and luft', 'Strategy', 1,
    'Keep your king behind pawns, but give it one escape square (luft) so a back-rank check is not mate.',
    ['Rooks or queens are still on the board and your king is on the back rank.', 'You have a quiet moment to spend one move.'],
    ['Do not push many pawns in front of your king: it opens lines.', 'Do not make luft if you must deal with a bigger threat first.'],
    { fen: '1r4k1/5ppp/8/8/8/8/2R2PPP/6K1 w - - 0 1', steps: [['h3', 'White spends one quiet move to make an escape square on h2.'], ['Rb1+', 'Black checks on the back rank…'], ['Kh2', '…but the king simply steps to h2. Without h3 this would have been checkmate.'], ['h6', 'Black makes luft too.'], ['Rc8+', 'Now White checks on Black’s back rank.'], ['Kh7', 'Thanks to h6 the king escapes. Luft saved both kings.']] },
    [
      idea(1, null, 'What is luft?', ['A pawn move that gives your king an escape square', 'A way to castle twice', 'A rook move to the 7th rank', 'A queen trade'], 'Luft is German for air. One small pawn move (like h3) can prevent a back-rank mate.'),
      idea(2, null, 'Your king is castled and your opponent has no pieces nearby. Should you push the pawns in front of it?', ['No — every pawn move in front of the king creates holes', 'Yes — pawns should always advance', 'Yes — to make room for the queen'], 'Pawns cannot move back. Keep the shelter until you have a clear reason.'),
    ]),
  concept('read-ahead', 'Read ahead: calculate before you move', 'Thinking', 2,
    'Strong players picture the board a few moves ahead without moving pieces. Start with 2 half-moves (your move and the reply), then 3, then 4.',
    ['Any forcing move (check, capture, threat): picture the reply before you play it.', 'Use the Read ahead drill daily to build the skill.'],
    ['Do not calculate every quiet move deeply; use principles for those.', 'Do not stop calculating at a capture: the opponent may recapture.'],
    { fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', steps: [['Nc7+', 'Move 1 (you): check.'], ['Kd7', 'Move 2 (reply): the king steps away. Picture it before you look.'], ['Nxa8', 'Move 3 (you): the rook falls. You saw all three moves in your head first.']] },
    [
      idea(1, null, 'You found a capture that wins a pawn. What should you check before playing it?', ['The opponent’s best reply — can they recapture or check?', 'Nothing — captures are always good', 'Whether the pawn is on a light square'], 'Calculate one more move than feels necessary. Many “free” pawns are traps.'),
      idea(2, null, 'What is a candidate move?', ['A move worth calculating: checks, captures, threats and good plans', 'Any legal move', 'The move your opponent wants', 'A move that does not move a pawn'], 'Pick 2–3 candidate moves, read each one ahead, then choose. That is how you avoid blunders.'),
    ]),
];

// ---------- mirroring (a<->h) doubles the puzzle pool for drills ----------
const mirrorFile = file => String.fromCharCode(201 - file.charCodeAt(0)); // 'a'(97) <-> 'h'(104)
export function mirrorFen(fen) {
  const [board, turn, , ep, half = '0', full = '1'] = fen.split(' ');
  const rows = board.split('/').map(row => row.replace(/\d/g, d => '1'.repeat(Number(d))).split('').reverse().join('').replace(/1+/g, ones => String(ones.length)));
  return [rows.join('/'), turn, '-', ep === '-' ? '-' : mirrorFile(ep[0]) + ep[1], half, full].join(' ');
}
export const mirrorSan = san => san.replace(/[a-h]/g, mirrorFile);
export const mirrorText = text => text
  .replace(/(?<![A-Za-z])[KQRBN]?[a-h]?x?[a-h][1-8](?![0-9])/g, token => mirrorSan(token))
  .replace(/(?<![A-Za-z])([a-h])-(?=file|pawn| or )/g, (_, f) => `${mirrorFile(f)}-`);
const canMirror = q => q.fen && q.mirror !== false && !/[KQkq]/.test(q.fen.split(' ')[2]) && !/kingside|queenside|castl/i.test(`${q.ask} ${q.why}`);
export function mirrorQuestion(q) {
  const move = q.kind === 'move' || q.check?.type === 'outpost' || q.check?.type === 'openfile';
  const choice = c => (move ? mirrorSan(c) : mirrorText(c));
  const check = q.check && Object.fromEntries(Object.entries(q.check).map(([k, v]) => [k, ['move', 'better', 'worse', 'punish'].includes(k) ? mirrorSan(v) : v]));
  return { ...q, id: `${q.id}-m`, mirrored: true, fen: mirrorFen(q.fen), ask: mirrorText(q.ask), why: mirrorText(q.why), choices: q.choices.map(choice), answer: choice(q.answer), ...(check ? { check } : {}) };
}

export const ALL_QUESTIONS = TRAINER_CONCEPTS.flatMap(c => c.quiz);
export const DRILL_QUESTIONS = [...ALL_QUESTIONS, ...ALL_QUESTIONS.filter(canMirror).map(mirrorQuestion)];
export const conceptById = id => TRAINER_CONCEPTS.find(c => c.id === id);

// ---------- seeded randomness so tests and replays are repeatable ----------
export function rng(seed = Date.now()) {
  let s = (Number(seed) >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export function shuffle(list, random = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

// ---------- tiny material search: refutations for wrong answers, and content checks in tests ----------
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const MATE = 1000;
function material(chess) {
  let score = 0;
  for (const row of chess.board()) for (const piece of row) if (piece) score += (piece.color === chess.turn() ? 1 : -1) * VALUE[piece.type];
  return score;
}
const ordered = moves => moves.sort((a, b) => (b.captured ? VALUE[b.captured] * 10 - VALUE[b.piece] : -1) + (b.san.includes('+') ? 5 : 0) - ((a.captured ? VALUE[a.captured] * 10 - VALUE[a.piece] : -1) + (a.san.includes('+') ? 5 : 0)));
function quiesce(chess, alpha, beta, ply, budget) {
  const moves = chess.moves({ verbose: true });
  if (!moves.length) return chess.isCheck() ? -(MATE - ply) : 0;
  const stand = material(chess);
  if (budget <= 0 || stand >= beta) return stand;
  alpha = Math.max(alpha, stand);
  for (const move of ordered(moves.filter(m => m.captured || m.promotion))) {
    chess.move(move); const value = -quiesce(chess, -beta, -alpha, ply + 1, budget - 1); chess.undo();
    if (value >= beta) return value;
    alpha = Math.max(alpha, value);
  }
  return alpha;
}
export function negamax(chess, depth, alpha = -Infinity, beta = Infinity, ply = 0) {
  const moves = chess.moves({ verbose: true });
  if (!moves.length) return chess.isCheck() ? -(MATE - ply) : 0;
  if (chess.isInsufficientMaterial()) return 0;
  if (depth <= 0) return quiesce(chess, alpha, beta, ply, 4);
  let best = -Infinity;
  for (const move of ordered(moves)) {
    chess.move(move); const value = -negamax(chess, depth - 1, -beta, -alpha, ply + 1); chess.undo();
    if (value > best) best = value;
    if (value > alpha) alpha = value;
    if (alpha >= beta) break;
  }
  return best;
}
/** Material score (pawns) for the side that plays `san`, after searching `depth` more half-moves. */
export function scoreMove(fen, san, depth = 3) {
  const chess = new Chess(fen); chess.move(san);
  return -negamax(chess, depth, -Infinity, Infinity, 1);
}
/** The opponent's best reply to `san`, for explaining why a wrong move fails. */
export function refutation(fen, san) {
  const chess = new Chess(fen);
  let played;
  try { played = chess.move(san); } catch { return null; }
  if (chess.isCheckmate()) return { san: null, mate: true, text: `${played.san} is checkmate.` };
  if (chess.isStalemate()) return { san: null, text: `${played.san} is stalemate — a draw.` };
  let best = null, bestValue = -Infinity;
  for (const reply of ordered(chess.moves({ verbose: true }))) {
    chess.move(reply); const value = chess.isCheckmate() ? MATE : -quiesce(chess, -Infinity, Infinity, 2, 4); chess.undo();
    if (value > bestValue) { bestValue = value; best = reply; }
  }
  if (!best) return null;
  chess.move(best);
  const mate = chess.isCheckmate();
  return { san: best.san, from: best.from, to: best.to, mate, text: mate ? `After ${played.san}, ${best.san} is checkmate.` : best.captured ? `After ${played.san}, the reply ${best.san} captures your ${PIECE_NAMES[best.captured]}.` : `After ${played.san}, the reply ${best.san} keeps the advantage for the other side.` };
}
export const PIECE_NAMES = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };

// ---------- quiz building ----------
/** A lesson quiz: the concept's questions in order, choices shuffled. */
export function lessonQuiz(conceptId, random = Math.random) {
  const item = conceptById(conceptId);
  return item ? item.quiz.map(q => withShuffledChoices(q, random)) : [];
}
export const withShuffledChoices = (q, random = Math.random) => ({ ...q, choices: shuffle(q.choices, random) });

/** "Name that idea": show a tactic's answer and ask which concept it is. */
export function nameThatIdea(q, random = Math.random) {
  const own = conceptById(q.concept);
  const others = shuffle(TRAINER_CONCEPTS.filter(c => ['Tactics', 'Checkmates'].includes(c.track) && c.id !== own.id), random).slice(0, 3).map(c => c.title);
  return { ...q, id: `${q.id}-name`, kind: 'name', ask: `The best move is ${q.answer}. Which idea does it use?`, showMove: q.answer, choices: shuffle([own.title, ...others], random), answer: own.title, why: `${own.title}: ${own.summary}` };
}

export const FLASH_LEVELS = {
  Easy: { seconds: 20, maxLevel: 1, mirrors: false, count: 10 },
  Medium: { seconds: 12, maxLevel: 2, mirrors: true, count: 12 },
  Hard: { seconds: 7, maxLevel: 3, mirrors: true, count: 15 },
};
/** Flash drill: rapid mixed questions, weighted toward concepts you miss. */
export function flashDeck({ level = 'Medium', tracks = TRACKS, stats = emptyStats(), random = Math.random } = {}) {
  const config = FLASH_LEVELS[level] ?? FLASH_LEVELS.Medium;
  const pool = (config.mirrors ? DRILL_QUESTIONS : ALL_QUESTIONS).filter(q => q.level <= config.maxLevel && tracks.includes(conceptById(q.concept).track));
  const accuracy = conceptAccuracy(stats);
  const weighted = pool.flatMap(q => { const a = accuracy[q.concept]; return Array(a === undefined ? 2 : a < 0.6 ? 3 : a < 0.85 ? 2 : 1).fill(q); });
  const picked = [], seen = new Set();
  for (const q of shuffle(weighted, random)) {
    if (seen.has(q.id)) continue; seen.add(q.id);
    const tactic = q.kind === 'move' && ['Tactics', 'Checkmates'].includes(conceptById(q.concept).track);
    picked.push(tactic && random() < 0.3 ? nameThatIdea(q, random) : withShuffledChoices(q, random));
    if (picked.length === config.count) break;
  }
  return { seconds: config.seconds, questions: picked };
}

/** Quick analysis from the puzzle bank: only "find the move" positions. */
export function analysisDeck({ count = 10, maxLevel = 3, random = Math.random } = {}) {
  const pool = DRILL_QUESTIONS.filter(q => q.kind === 'move' && q.level <= maxLevel && q.check?.type !== 'none');
  return shuffle(pool, random).slice(0, count).map(q => withShuffledChoices(q, random));
}

// ---------- read ahead (visualization) ----------
function readAheadLines(openings = []) {
  const lines = TRAINER_CONCEPTS.filter(c => c.demo.steps.length >= 3).map(c => ({ source: c.title, fen: c.demo.fen, moves: c.demo.steps.map(s => s.san), tactic: ['Tactics', 'Checkmates', 'Thinking'].includes(c.track) }));
  for (const lesson of openings) if (lesson.steps?.length >= 4) lines.push({ source: lesson.title, fen: lesson.fen, moves: lesson.steps.map(s => s.move), tactic: false });
  return lines;
}
const squareName = (chess, square) => { const p = chess.get(square); return p ? `${p.color === 'w' ? 'White' : 'Black'} ${PIECE_NAMES[p.type]}` : 'Empty'; };
/**
 * Read-ahead question: the board shows the start; `moves` are only listed (or flashed);
 * the question is about the position after them.
 */
export function readAheadQuestion({ depth = 2, openings = [], random = Math.random } = {}) {
  const lines = readAheadLines(openings).filter(line => line.moves.length >= depth + (line.tactic ? 1 : 0));
  for (let attempt = 0; attempt < 40; attempt++) {
    const line = lines[Math.floor(random() * lines.length)];
    const finalTactic = line.tactic && line.moves.length === depth + 1 && random() < 0.6;
    const start = finalTactic ? 0 : Math.floor(random() * (line.moves.length - depth + 1));
    const chess = new Chess(line.fen);
    for (const san of line.moves.slice(0, start)) chess.move(san);
    const fen = chess.fen(), played = [];
    for (const san of line.moves.slice(start, start + depth)) played.push(chess.move(san));
    const base = { id: `read-${line.source}-${start}-${depth}`, kind: 'read', fen, line: played.map(m => m.san), source: line.source, depth };
    if (finalTactic) {
      const answer = line.moves[depth];
      const others = shuffle(chess.moves().filter(san => san !== answer), random).slice(0, 3);
      if (others.length < 3) continue;
      return { ...base, finalFen: chess.fen(), ask: `Picture the position after these moves. What is ${chess.turn() === 'w' ? 'White' : 'Black'}’s best move now?`, choices: shuffle([answer, ...others], random), answer, why: `${line.source}: after ${base.line.join(' ')}, ${answer} wins. ${TRAINER_CONCEPTS.find(c => c.title === line.source)?.demo.steps[depth]?.note ?? ''}`.trim(), playable: true };
    }
    const index = Math.floor(random() * played.length), mover = played[index];
    if (random() < 0.5) {
      // Where did a piece end up? Trace it back to its start square, then forward through the line.
      let origin = mover.from;
      for (let i = index - 1; i >= 0; i--) if (played[i].to === origin) origin = played[i].from;
      let square = origin, captured = false;
      for (const m of played) {
        if (m.from === square) square = m.to;
        else if (m.to === square) captured = true;
        if (m.flags.includes('k') || m.flags.includes('q')) { const rank = m.color === 'w' ? '1' : '8'; const [rf, rt] = m.flags.includes('k') ? ['h', 'f'] : ['a', 'd']; if (square === rf + rank) square = rt + rank; }
      }
      if (captured) continue;
      const owner = mover.color === 'w' ? 'White' : 'Black', answer = square;
      const others = shuffle([...new Set([origin, ...played.map(m => m.from), ...played.map(m => m.to), ...new Chess(fen).moves({ verbose: true }).map(m => m.to)])].filter(sq => sq !== answer), random).slice(0, 3);
      if (others.length < 3) continue;
      return { ...base, finalFen: chess.fen(), ask: `Follow the ${owner} ${PIECE_NAMES[mover.piece]} that starts on ${origin}. Which square is it on at the end?`, choices: shuffle([answer, ...others], random), answer, why: `Follow it move by move: ${base.line.join(' ')}. It ends on ${answer}.`, highlight: answer, origin };
    }
    // What stands on a square?
    const square = random() < 0.5 ? mover.to : mover.from;
    const answer = squareName(chess, square);
    const names = ['Empty', 'White pawn', 'Black pawn', 'White knight', 'Black knight', 'White bishop', 'Black bishop', 'White rook', 'Black rook', 'White queen', 'Black queen'];
    const others = shuffle(names.filter(n => n !== answer), random).slice(0, 3);
    return { ...base, finalFen: chess.fen(), ask: `After these moves, what stands on ${square}?`, choices: shuffle([answer, ...others], random), answer, why: `Play it out: ${base.line.join(' ')}. On ${square}: ${answer.toLowerCase()}.`, highlight: square };
  }
  return null;
}

// ---------- stats ----------
export const emptyStats = () => ({ version: 1, answers: [], lessons: {}, runs: [] });
export function readStats(storage = globalThis.localStorage) {
  try {
    const data = JSON.parse(storage.getItem(TRAINER_KEY) ?? 'null');
    if (!data || data.version !== 1 || !Array.isArray(data.answers) || !Array.isArray(data.runs) || typeof data.lessons !== 'object') return emptyStats();
    return data;
  } catch { return emptyStats(); }
}
export function writeStats(stats, storage = globalThis.localStorage) { storage.setItem(TRAINER_KEY, JSON.stringify(stats)); }
export function recordAnswer(stats, { mode, question, correct, ms, at = new Date().toISOString(), timedOut = false }) {
  const answers = [...stats.answers, { at, mode, qid: question.id, concept: question.concept ?? null, kind: question.kind, correct: Boolean(correct), ms: Math.round(ms ?? 0), timedOut, depth: question.depth ?? null }].slice(-1500);
  return { ...stats, answers };
}
export function recordRun(stats, run) { return { ...stats, runs: [...stats.runs, { at: new Date().toISOString(), ...run }].slice(-300) }; }
export function recordLesson(stats, conceptId, { correctFirstTry, total }) {
  const previous = stats.lessons[conceptId];
  const stars = correctFirstTry === total ? 3 : correctFirstTry >= total - 1 ? 2 : 1;
  return { ...stats, lessons: { ...stats.lessons, [conceptId]: { completed: true, stars: Math.max(stars, previous?.stars ?? 0), attempts: (previous?.attempts ?? 0) + 1, at: new Date().toISOString() } } };
}
export function conceptAccuracy(stats) {
  const totals = {};
  for (const a of stats.answers) if (a.concept) { const t = totals[a.concept] ??= [0, 0]; t[0] += a.correct ? 1 : 0; t[1]++; }
  return Object.fromEntries(Object.entries(totals).map(([id, [right, all]]) => [id, right / all]));
}
export function modeSummary(stats, mode, filter = () => true) {
  const list = stats.answers.filter(a => a.mode === mode && filter(a));
  const right = list.filter(a => a.correct).length;
  let streak = 0, best = 0;
  for (const a of list) { streak = a.correct ? streak + 1 : 0; best = Math.max(best, streak); }
  const timed = list.filter(a => a.ms > 0);
  return { answered: list.length, correct: right, accuracy: list.length ? right / list.length : null, bestStreak: best, averageSeconds: timed.length ? timed.reduce((s, a) => s + a.ms, 0) / timed.length / 1000 : null };
}
/** Questions whose most recent answer was wrong: the mistake-review queue. */
export function mistakeQueue(stats) {
  const last = new Map();
  for (const a of stats.answers) if (a.kind !== 'read' && !String(a.qid).endsWith('-name')) last.set(a.qid, a.correct);
  return DRILL_QUESTIONS.filter(q => last.get(q.id) === false);
}
export function weakestConcepts(stats, count = 3) {
  return Object.entries(conceptAccuracy(stats)).filter(([id]) => conceptById(id)).sort((a, b) => a[1] - b[1]).slice(0, count).map(([id, accuracy]) => ({ concept: conceptById(id), accuracy }));
}

// ---------- the training plan: start to finish ----------
const lessonsDone = (stats, track) => TRAINER_CONCEPTS.filter(c => c.track === track && stats.lessons[c.id]?.completed).length;
const trackSize = track => TRAINER_CONCEPTS.filter(c => c.track === track).length;
const recentRuns = (stats, mode, test) => stats.runs.filter(r => r.mode === mode && test(r)).length;
export const PLAN_STAGES = [
  { id: 'thinking', title: '1. Learn how to look', detail: 'Lessons in the Thinking track: checks-captures-threats, counting, spotting threats, reading ahead.', action: { tab: 'lessons', track: 'Thinking' }, progress: s => [lessonsDone(s, 'Thinking'), trackSize('Thinking')] },
  { id: 'tactics', title: '2. Tactics toolkit', detail: 'Forks, pins, skewers, discovered attacks, removing defenders, deflection and overload. Each lesson: idea → animated demo → quiz.', action: { tab: 'lessons', track: 'Tactics' }, progress: s => [lessonsDone(s, 'Tactics'), trackSize('Tactics')] },
  { id: 'mates', title: '3. Checkmate patterns', detail: 'Back rank, smothered, ladder and queen mates — and how to avoid stalemate.', action: { tab: 'lessons', track: 'Checkmates' }, progress: s => [lessonsDone(s, 'Checkmates'), trackSize('Checkmates')] },
  { id: 'flash', title: '4. Flash drills', detail: 'Rapid-fire cards with a timer. Pass 3 Medium or Hard runs at 80% or better.', action: { tab: 'flash' }, progress: s => [Math.min(3, recentRuns(s, 'flash', r => r.level !== 'Easy' && r.total && r.score / r.total >= 0.8)), 3] },
  { id: 'read', title: '5. Read ahead', detail: 'Picture 2, then 3, then 4 half-moves without moving pieces. Pass a run at each depth with 80%+.', action: { tab: 'read' }, progress: s => [[2, 3, 4].filter(d => recentRuns(s, 'read', r => r.depth === d && r.total && r.score / r.total >= 0.8)).length, 3] },
  { id: 'analysis', title: '6. Quick analysis', detail: 'Timed best-move choices from puzzles and from positions in your own games. Get 20 positions right.', action: { tab: 'analysis' }, progress: s => [Math.min(20, modeSummary(s, 'analysis').correct), 20] },
  { id: 'endgame', title: '7. Endgames and strategy', detail: 'Square rule, opposition, promotion, development, outposts, open files and king safety.', action: { tab: 'lessons', track: 'Endgames' }, progress: s => [lessonsDone(s, 'Endgames') + lessonsDone(s, 'Strategy'), trackSize('Endgames') + trackSize('Strategy')] },
  { id: 'play', title: '8. Play, review, repeat', detail: 'Play 3 games against the computer (coaching on at first) and press Analyze game after each. Fix wrong answers in the Mistakes tab. Raise the bot level when you win half your games.', action: { tab: 'play' }, progress: (s, extra) => [Math.min(3, extra.reviewedGames ?? 0), 3] },
];
export function planProgress(stats, extra = {}) {
  return PLAN_STAGES.map(stage => { const [done, total] = stage.progress(stats, extra); return { ...stage, done, total, complete: done >= total }; });
}
export const nextStage = (stats, extra) => planProgress(stats, extra).find(stage => !stage.complete) ?? null;

/** Daily workout: a short mixed session that follows the plan. */
export function dailyWorkout({ stats = emptyStats(), openings = [], random = Math.random } = {}) {
  const weak = weakestConcepts(stats, 2).map(w => w.concept.id);
  const weakPool = ALL_QUESTIONS.filter(q => weak.includes(q.concept));
  const flash = flashDeck({ level: 'Medium', stats, random }).questions.slice(0, 5);
  const fromWeak = shuffle(weakPool, random).slice(0, 2).map(q => withShuffledChoices(q, random));
  const reads = [2, 2, 3].map(depth => readAheadQuestion({ depth, openings, random })).filter(Boolean);
  const analysis = analysisDeck({ count: 3, random });
  const seen = new Set();
  return [...fromWeak, ...flash, ...reads, ...analysis].filter(q => (seen.has(q.id) ? false : seen.add(q.id)));
}
