const GLYPHS = { w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' }, b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' } };
const NAMES = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
export class ChessBoard {
  constructor(root, onSelect) {
    this.root = root; this.onSelect = onSelect; this.flipped = false; this.focusSquare = 'e2';
    this.buttons = new Map();
    for (const file of 'abcdefgh') for (let rank = 1; rank <= 8; rank++) {
      const square = file + rank, button = document.createElement('button');
      button.type = 'button'; button.dataset.square = square;
      button.addEventListener('click', () => { this.focusSquare = square; this.onSelect(square); });
      button.addEventListener('focus', () => { this.focusSquare = square; this.updateTabStops(); });
      this.buttons.set(square, button);
    }
    this.root.addEventListener('keydown', event => {
      const index = this.order.indexOf(event.target.dataset.square);
      const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 };
      if (index >= 0 && event.key in offsets) {
        event.preventDefault(); this.buttons.get(this.order[Math.max(0, Math.min(63, index + offsets[event.key]))]).focus();
      } else if (event.key === 'Escape') { event.preventDefault(); this.onSelect(null); }
    });
  }
  updateTabStops() { for (const [square, button] of this.buttons) button.tabIndex = square === this.focusSquare ? 0 : -1; }
  render(chess, { selected = null, targets = [], lastMove = null, hint = null } = {}) {
    const ranks = this.flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
    const files = this.flipped ? 'hgfedcba' : 'abcdefgh';
    const order = ranks.flatMap(rank => [...files].map(file => file + rank));
    if (order.join() !== this.order?.join()) {
      const activeSquare = document.activeElement?.dataset.square;
      this.order = order; this.root.replaceChildren(...order.map(square => this.buttons.get(square)));
      if (activeSquare) this.buttons.get(activeSquare)?.focus();
    }
    for (const square of order) {
      const button = this.buttons.get(square), piece = chess.get(square), target = targets.includes(square);
      button.className = `chess-square ${(square.charCodeAt(0) + Number(square[1])) % 2 ? 'square-light' : 'square-dark'}${selected === square ? ' is-selected' : ''}${target ? ' is-target' : ''}${lastMove && (lastMove.from === square || lastMove.to === square) ? ' last-move' : ''}${hint && (hint.slice(0, 2) === square || hint.slice(2, 4) === square) ? ' is-hint' : ''}`;
      button.dataset.pieceColor = piece?.color ?? '';
      button.setAttribute('aria-pressed', String(selected === square));
      button.setAttribute('aria-label', `${square}, ${piece ? (piece.color === 'w' ? 'White ' : 'Black ') + NAMES[piece.type] : 'empty'}${target ? ', legal destination' : ''}`);
      button.replaceChildren();
      const glyph = document.createElement('span'); glyph.className = 'chess-piece'; glyph.setAttribute('aria-hidden', 'true'); glyph.textContent = piece ? GLYPHS[piece.color][piece.type] : target ? '·' : '';
      const coordinate = document.createElement('small'); coordinate.className = 'chess-coordinate'; coordinate.setAttribute('aria-hidden', 'true'); coordinate.textContent = square;
      button.append(glyph, coordinate);
    }
    this.updateTabStops();
  }
}
