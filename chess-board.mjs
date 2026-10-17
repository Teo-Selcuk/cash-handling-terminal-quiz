// Simple solid SVG pieces. Fill and outline come from CSS, so both sides read clearly on both square colors.
const BASE = '<rect class="piece-body" x="11" y="35" width="23" height="5" rx="1.5"/>';
const SHAPES = {
  p: BASE + '<path class="piece-body" d="M16,35 C16,28 19.5,25 19.5,22 L25.5,22 C25.5,25 29,28 29,35 Z"/><rect class="piece-body" x="17.5" y="19.5" width="10" height="3.5" rx="1.75"/><circle class="piece-body" cx="22.5" cy="14" r="5.5"/>',
  r: '<path class="piece-body" d="M10,40 H35 V35 H31.5 L30,20 H33 V10 H28.5 V13.5 H25 V10 H20 V13.5 H16.5 V10 H12 V20 H15 L13.5,35 H10 Z"/><path class="piece-detail" d="M14.5,20 H30.5 M13.8,31 H31.2"/>',
  n: BASE + '<path class="piece-body" d="M14,35 C13.4,30 14,27.5 15.6,25.4 C18,22.4 21,19.6 21.4,16.8 C20.4,18.3 18.9,19.3 17.4,19.8 L14.4,21.3 C12.4,21.8 11.1,20.3 11.9,18.3 C13.4,14.3 16.4,10.8 19.4,9.3 L21.9,5.8 L22.9,8.8 C26.9,9.8 30.4,12.8 31.9,16.8 C33.9,21.8 34.4,28 34.4,35 Z"/><circle class="piece-eye" cx="19.4" cy="13.3" r="1.3"/>',
  b: BASE + '<path class="piece-body" d="M15,35 L17,30 H28 L30,35 Z"/><rect class="piece-body" x="16" y="27" width="13" height="3.5" rx="1.5"/><path class="piece-body" d="M22.5,8.5 C17.5,12.5 14.6,17.5 15.6,22 C16.1,25 18.6,27 22.5,27 C26.4,27 28.9,25 29.4,22 C30.4,17.5 27.5,12.5 22.5,8.5 Z"/><circle class="piece-body" cx="22.5" cy="6.5" r="2.6"/><path class="piece-detail" d="M20.5,15.5 L25.5,20.5"/>',
  q: '<path class="piece-body" d="M10,40 H35 L34,33.5 L37,16 L31,26 L29,13 L25,25 L22.5,11 L20,25 L16,13 L14,26 L8,16 L11,33.5 Z"/><circle class="piece-body" cx="8" cy="15" r="2.4"/><circle class="piece-body" cx="16" cy="12" r="2.4"/><circle class="piece-body" cx="22.5" cy="9.5" r="2.4"/><circle class="piece-body" cx="29" cy="12" r="2.4"/><circle class="piece-body" cx="37" cy="15" r="2.4"/><path class="piece-detail" d="M11.5,35.5 H33.5"/>',
  k: '<path class="piece-body" d="M11,40 H34 L33,33 C36.5,29.5 38.5,25 36,21 C33.5,17 28.5,17.5 25.5,21.5 L22.5,25.5 L19.5,21.5 C16.5,17.5 11.5,17 9,21 C6.5,25 8.5,29.5 12,33 Z"/><path class="piece-body" d="M19.8,23 L20.5,15.5 H24.5 L25.2,23 Z"/><path class="piece-body" d="M21.3,4 H23.7 V7 H26.5 V9.4 H23.7 V15.5 H21.3 V9.4 H18.5 V7 H21.3 Z"/><path class="piece-detail" d="M12.5,35.5 H32.5"/>',
};
const pieceSvg = (type) => `<svg viewBox="0 0 45 45" aria-hidden="true" focusable="false">${SHAPES[type]}</svg>`;
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
      const glyph = document.createElement('span'); glyph.className = 'chess-piece'; glyph.setAttribute('aria-hidden', 'true');
      if (piece) glyph.innerHTML = pieceSvg(piece.type); else glyph.textContent = target ? '·' : '';
      const coordinate = document.createElement('small'); coordinate.className = 'chess-coordinate'; coordinate.setAttribute('aria-hidden', 'true'); coordinate.textContent = `${square[0] === files[0] && square[1] === String(ranks.at(-1)) ? square : square[0] === files[0] ? square[1] : square[1] === String(ranks.at(-1)) ? square[0] : ''}`;
      button.append(glyph, coordinate);
    }
    this.updateTabStops();
  }
}
