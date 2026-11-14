// Realistic 3D chessboard drawn with WebGL (three.js): turned Staunton-style pieces in boxwood and ebony,
// a polished wooden board, soft shadows and reflections. Loaded on demand by chess-board.mjs, which keeps
// its hidden button grid for keyboard and screen-reader use; this view only draws and turns clicks into squares.
import * as THREE from './assets/three/three.module.min.js';

const FILES = 'abcdefgh';
const BOARD_HALF = 4.7; // half the frame width, in squares
const PIECE_SCALE = 0.9;

// ---------- procedural textures ----------
function seeded(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function canvasTexture(size, draw, renderer, { repeat = 1 } = {}) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat); texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}
function drawWood(ctx, size, { base, light, dark, seed = 1, angle = 0, figure = 1 }) {
  const rand = seeded(seed);
  ctx.save(); ctx.translate(size / 2, size / 2); ctx.rotate(angle); ctx.translate(-size, -size);
  ctx.fillStyle = base; ctx.fillRect(0, 0, size * 2, size * 2);
  // Broad colour bands, then fine grain lines that wander a little, like quarter-sawn timber.
  for (let i = 0; i < 26; i++) {
    const y = rand() * size * 2, h = 10 + rand() * 60;
    ctx.fillStyle = rand() < 0.5 ? light : dark; ctx.globalAlpha = 0.05 + rand() * 0.08;
    ctx.fillRect(0, y, size * 2, h);
  }
  for (let i = 0; i < 260 * figure; i++) {
    const y0 = rand() * size * 2, amp = 2 + rand() * 9, freq = 0.004 + rand() * 0.012, phase = rand() * 6.28;
    ctx.beginPath();
    for (let x = 0; x <= size * 2; x += 8) ctx.lineTo(x, y0 + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.1) * amp * 0.25);
    ctx.strokeStyle = rand() < 0.75 ? dark : light; ctx.globalAlpha = 0.05 + rand() * 0.14; ctx.lineWidth = 0.6 + rand() * 1.8; ctx.stroke();
  }
  for (let i = 0; i < 18; i++) { // small pores and flecks
    ctx.fillStyle = dark; ctx.globalAlpha = 0.15; ctx.fillRect(rand() * size * 2, rand() * size * 2, 1 + rand() * 6, 1);
  }
  ctx.restore(); ctx.globalAlpha = 1;
}
function drawMarble(ctx, size, { base, vein, seed = 1 }) {
  const rand = seeded(seed);
  ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 70; i++) {
    let x = rand() * size, y = rand() * size; const steps = 30 + rand() * 50;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let s = 0; s < steps; s++) { x += (rand() - 0.35) * 18; y += (rand() - 0.5) * 18; ctx.lineTo(x, y); }
    ctx.strokeStyle = vein; ctx.globalAlpha = 0.04 + rand() * 0.12; ctx.lineWidth = 0.5 + rand() * 2.5; ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
const THEMES = {
  wood: { light: { base: '#e3c48f', light: '#f1d9ab', dark: '#b88d55' }, dark: { base: '#6b4227', light: '#8a5a37', dark: '#3e2414' }, frame: { base: '#4a2c19', light: '#6b4127', dark: '#24130a' }, label: '#e8cf9f', kind: 'wood' },
  green: { light: { base: '#ecebd0', light: '#f7f6e2', dark: '#cfcca8' }, dark: { base: '#6f9452', light: '#86ab67', dark: '#4f7236' }, frame: { base: '#3f2a1b', light: '#5c3e28', dark: '#1f140c' }, label: '#e9e3c7', kind: 'paint' },
  marble: { light: { base: '#eef1f4', vein: '#8a97a6' }, dark: { base: '#5d7690', vein: '#e8eef5' }, frame: { base: '#2f3d4d', light: '#475a6f', dark: '#18212b' }, label: '#dbe6f2', kind: 'marble' },
  night: { light: { base: '#97a3b5', light: '#aab5c5', dark: '#7d899b' }, dark: { base: '#323c4d', light: '#414c5e', dark: '#212938' }, frame: { base: '#161b24', light: '#252d3a', dark: '#07090d' }, label: '#b9c6d8', kind: 'paint' },
};

// ---------- Staunton piece geometry ----------
const v = (x, y) => new THREE.Vector2(x, y);
function arc(cx, cy, r, from, to, steps = 10) { const out = []; for (let i = 0; i <= steps; i++) { const a = from + (to - from) * i / steps; out.push(v(cx + Math.cos(a) * r, cy + Math.sin(a) * r)); } return out; }
// Shared base: wide foot with a bead and a cove, as on a turned Staunton piece.
const base = (r = 0.37, top = 0.2) => [v(0, 0), v(r, 0), v(r + 0.01, 0.025), v(r, 0.055), v(r - 0.04, 0.07), ...arc(r - 0.04, 0.095, 0.025, -Math.PI / 2, Math.PI / 2, 6), v(r - 0.07, 0.125), v(r - 0.11, 0.15), v(r - 0.1, top - 0.02), v(r - 0.13, top)];
const collar = (y, r) => [v(r - 0.03, y - 0.02), ...arc(r - 0.03, y, 0.022, -Math.PI / 2, Math.PI / 2, 5), v(r - 0.04, y + 0.025)];
const lathe = (points, segments = 56) => new THREE.LatheGeometry(points, segments);
function profile(type) {
  switch (type) {
    case 'p': return [...base(0.31, 0.17), v(0.15, 0.24), v(0.11, 0.36), v(0.1, 0.42), ...collar(0.45, 0.2), v(0.1, 0.5), ...arc(0, 0.62, 0.15, -Math.PI / 2 + 0.6, Math.PI / 2, 14)];
    case 'r': return [...base(0.36, 0.2), v(0.21, 0.3), v(0.18, 0.5), v(0.18, 0.62), ...collar(0.66, 0.27), v(0.22, 0.7), v(0.25, 0.74), v(0.26, 0.86), v(0.18, 0.86), v(0.18, 0.8), v(0, 0.8)];
    case 'n': return [...base(0.36, 0.2), v(0.2, 0.22), v(0, 0.22)];
    case 'b': return [...base(0.34, 0.2), v(0.17, 0.32), v(0.1, 0.55), v(0.09, 0.64), ...collar(0.68, 0.21), v(0.11, 0.72), v(0.15, 0.78), v(0.17, 0.86), v(0.15, 0.96), v(0.1, 1.04), v(0.04, 1.09), ...arc(0, 1.13, 0.045, -Math.PI / 2 + 0.4, Math.PI / 2, 8)];
    case 'q': return [...base(0.39, 0.22), v(0.2, 0.34), v(0.12, 0.66), v(0.11, 0.8), ...collar(0.84, 0.22), ...collar(0.89, 0.18), v(0.12, 0.92), v(0.17, 1.02), v(0.24, 1.12), v(0.22, 1.15), v(0.14, 1.16), v(0.12, 1.2), ...arc(0, 1.25, 0.065, -Math.PI / 2 + 0.3, Math.PI / 2, 8)];
    case 'k': return [...base(0.4, 0.22), v(0.21, 0.36), v(0.13, 0.7), v(0.12, 0.86), ...collar(0.9, 0.23), ...collar(0.95, 0.19), v(0.13, 0.98), v(0.18, 1.09), v(0.23, 1.2), v(0.21, 1.24), v(0.12, 1.26), v(0.1, 1.3), v(0, 1.3)];
    default: return [v(0, 0), v(0.3, 0), v(0, 0.5)];
  }
}
function knightHead() {
  // Side silhouette of a Staunton knight, facing +x, extruded and bevelled.
  const pts = [[-0.25, 0], [0.24, 0], [0.2, 0.1], [0.12, 0.2], [0.15, 0.3], [0.26, 0.4], [0.37, 0.47], [0.42, 0.53], [0.41, 0.6], [0.33, 0.64], [0.22, 0.65], [0.16, 0.72], [0.1, 0.84], [0.05, 0.78], [-0.02, 0.85], [-0.07, 0.77], [-0.16, 0.7], [-0.25, 0.56], [-0.3, 0.4], [-0.31, 0.22], [-0.28, 0.08]];
  const shape = new THREE.Shape(pts.map(([x, y]) => v(x, y)));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 4, curveSegments: 8 });
  geometry.translate(0, 0, -0.1); geometry.computeVertexNormals();
  return geometry;
}
function buildPiece(type, material, accent) {
  const group = new THREE.Group();
  const add = (geometry, mat = material, setup = () => {}) => { const mesh = new THREE.Mesh(geometry, mat); mesh.castShadow = true; mesh.receiveShadow = true; setup(mesh); group.add(mesh); return mesh; };
  add(lathe(profile(type)));
  if (type === 'r') for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.12, 0.09, 0.09), material, m => { const a = i / 6 * Math.PI * 2 + Math.PI / 6; m.position.set(Math.cos(a) * 0.22, 0.9, Math.sin(a) * 0.22); m.rotation.y = -a; });
  if (type === 'b') add(new THREE.BoxGeometry(0.02, 0.16, 0.26), accent, m => { m.position.set(0.05, 0.94, 0); m.rotation.z = -0.65; });
  if (type === 'q') for (let i = 0; i < 9; i++) add(new THREE.SphereGeometry(0.035, 12, 8), material, m => { const a = i / 9 * Math.PI * 2; m.position.set(Math.cos(a) * 0.215, 1.165, Math.sin(a) * 0.215); });
  if (type === 'k') { add(new THREE.BoxGeometry(0.06, 0.24, 0.06), material, m => m.position.set(0, 1.42, 0)); add(new THREE.BoxGeometry(0.17, 0.06, 0.06), material, m => m.position.set(0, 1.45, 0)); }
  if (type === 'n') {
    add(knightHead(), material, m => { m.position.y = 0.2; });
    for (const z of [-0.12, 0.12]) add(new THREE.SphereGeometry(0.025, 10, 8), accent, m => m.position.set(0.22, 0.75, z));
  }
  return group;
}

// ---------- the view ----------
export class Board3D {
  static supported() { try { const c = document.createElement('canvas'); return Boolean(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } }
  constructor(host, { onSelect, theme = 'wood' }) {
    this.host = host; this.onSelect = onSelect; this.flipped = false; this.pieces = new Map(); this.tweens = []; this.dirty = true;
    const renderer = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.98;
    renderer.domElement.className = 'chess-webgl'; renderer.domElement.setAttribute('aria-hidden', 'true');
    host.append(renderer.domElement);

    const scene = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);
    this.yaw = 0; this.view = { elevation: 0.82, distance: 18, targetZ: 1 };
    // Soft studio reflections: a simple room with bright panels, pre-filtered for the glossy finishes.
    const pmrem = new THREE.PMREMGenerator(renderer), room = new THREE.Scene();
    room.add(new THREE.Mesh(new THREE.BoxGeometry(30, 16, 30), new THREE.MeshBasicMaterial({ color: 0x5b5048, side: THREE.BackSide })));
    for (const [x, y, z, w, h, c] of [[-8, 7, 4, 10, 5, 6], [9, 6, -4, 6, 6, 3], [0, 7.9, 0, 12, 0.2, 4], [0, 3, 14.9, 12, 4, 2]]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.96, 0.9).multiplyScalar(c) }));
      panel.position.set(x, y, z); panel.lookAt(0, 0, 0); room.add(panel);
    }
    scene.environment = pmrem.fromScene(room, 0.03).texture; scene.environmentIntensity = 0.55;

    scene.add(new THREE.HemisphereLight(0xfff3e2, 0x2a1d14, 0.42));
    const key = this.key = new THREE.DirectionalLight(0xfff0dc, 2.6);
    key.position.set(-5.5, 12, 6.5); key.castShadow = true;
    Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 });
    key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 5;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xc9dcff, 0.55); fill.position.set(7, 6, -5); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.45); rim.position.set(0, 5, -11); scene.add(rim);

    // Table under the board catches the board's shadow.
    const table = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.32 }));
    table.rotation.x = -Math.PI / 2; table.position.y = -0.42; table.receiveShadow = true; scene.add(table);

    this.boardGroup = new THREE.Group(); scene.add(this.boardGroup);
    this.squares = new Map(); this.overlays = new Map();
    const tile = new THREE.BoxGeometry(1, 0.05, 1), overlayGeometry = new THREE.PlaneGeometry(0.96, 0.96);
    for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
      const square = FILES[f] + (r + 1), mesh = new THREE.Mesh(tile);
      mesh.position.set(f - 3.5, -0.025, 3.5 - r); mesh.receiveShadow = true; mesh.userData.square = square;
      this.boardGroup.add(mesh); this.squares.set(square, mesh);
      const overlay = new THREE.Mesh(overlayGeometry, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
      overlay.rotation.x = -Math.PI / 2; overlay.position.set(f - 3.5, 0.003, 3.5 - r); overlay.visible = false; overlay.renderOrder = 1;
      this.boardGroup.add(overlay); this.overlays.set(square, overlay);
    }
    this.frame = new THREE.Mesh(new THREE.BoxGeometry(BOARD_HALF * 2, 0.36, BOARD_HALF * 2));
    this.frame.position.y = -0.23; this.frame.castShadow = true; this.frame.receiveShadow = true; this.boardGroup.add(this.frame);
    this.frameTop = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_HALF * 2, BOARD_HALF * 2));
    this.frameTop.rotation.x = -Math.PI / 2; this.frameTop.position.y = -0.049; this.frameTop.receiveShadow = true; this.boardGroup.add(this.frameTop);

    this.markers = new THREE.Group(); this.arrowGroup = new THREE.Group(); scene.add(this.markers, this.arrowGroup);
    this.dotGeometry = new THREE.CircleGeometry(0.14, 32); this.ringGeometry = new THREE.RingGeometry(0.4, 0.47, 48);
    this.focusGeometry = new THREE.RingGeometry(0.44, 0.49, 4, 1, Math.PI / 4);

    this.setTheme(theme);
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', event => { this.down = { x: event.clientX, y: event.clientY }; });
    canvas.addEventListener('pointerup', event => {
      if (!this.down || Math.hypot(event.clientX - this.down.x, event.clientY - this.down.y) > 8) return;
      const square = this.squareAt(event.clientX, event.clientY);
      if (square) this.onSelect(square);
    });
    canvas.addEventListener('pointermove', event => { canvas.style.cursor = this.squareAt(event.clientX, event.clientY) ? 'pointer' : 'default'; });
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(host); this.resizeObserver.observe(renderer.domElement);
    this.resize();
    // Test and debugging hook: where a square's centre appears on screen.
    host.chessView = { screenPoint: square => this.screenPoint(square), ready: true };
  }
  setTheme(name) {
    const theme = THEMES[name] ?? THEMES.wood, r = this.renderer; this.themeName = name;
    const make = (spec, seed, angle) => canvasTexture(512, (ctx, size) => (theme.kind === 'marble' ? drawMarble(ctx, size, { ...spec, seed }) : drawWood(ctx, size, { ...spec, seed, angle, figure: theme.kind === 'paint' ? 0.35 : 1 })), r);
    const clear = theme.kind === 'marble' ? 0.9 : 0.55;
    // Two large textures (one per square colour); each square shows a different patch of it, so no two look alike.
    const sheets = { light: make(theme.light, 11, 0), dark: make(theme.dark, 23, 0) };
    for (const [square, mesh] of this.squares) {
      const f = FILES.indexOf(square[0]), rank = Number(square[1]) - 1, light = (f + rank) % 2 === 1;
      mesh.material?.map?.dispose(); mesh.material?.dispose?.();
      const map = sheets[light ? 'light' : 'dark'].clone();
      map.repeat.set(0.25, 0.25); map.offset.set(((f * 3 + rank * 5) % 4) * 0.25, ((f * 7 + rank) % 4) * 0.25);
      if ((f + rank * 3) % 2) { map.rotation = Math.PI / 2; map.center.set(0.5, 0.5); }
      mesh.material = new THREE.MeshPhysicalMaterial({ map, roughness: theme.kind === 'marble' ? 0.18 : 0.42, clearcoat: clear, clearcoatRoughness: 0.18 });
    }
    const frameTexture = canvasTexture(1024, (ctx, size) => {
      drawWood(ctx, size, { ...theme.frame, seed: 91, angle: 0 });
      // Inlay line and coordinates on the border.
      const border = size * (0.7 / (BOARD_HALF * 2)), cell = (size - border * 2) / 8;
      ctx.strokeStyle = theme.label; ctx.globalAlpha = 0.55; ctx.lineWidth = size * 0.004; ctx.strokeRect(border - size * 0.012, border - size * 0.012, size - 2 * border + size * 0.024, size - 2 * border + size * 0.024);
      ctx.globalAlpha = 0.85; ctx.fillStyle = theme.label; ctx.font = `600 ${Math.round(cell * 0.3)}px Georgia, 'Times New Roman', serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < 8; i++) {
        ctx.fillText(FILES[i], border + cell * (i + 0.5), size - border * 0.48); ctx.fillText(String(8 - i), border * 0.48, border + cell * (i + 0.5));
        ctx.save(); ctx.translate(border + cell * (i + 0.5), border * 0.48); ctx.rotate(Math.PI); ctx.fillText(FILES[i], 0, 0); ctx.restore();
        ctx.save(); ctx.translate(size - border * 0.48, border + cell * (i + 0.5)); ctx.rotate(Math.PI); ctx.fillText(String(8 - i), 0, 0); ctx.restore();
      }
      ctx.globalAlpha = 1;
    }, r);
    this.frameTop.material?.dispose?.(); this.frame.material?.dispose?.();
    this.frameTop.material = new THREE.MeshPhysicalMaterial({ map: frameTexture, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.15 });
    this.frame.material = new THREE.MeshPhysicalMaterial({ map: canvasTexture(256, (ctx, size) => drawWood(ctx, size, { ...theme.frame, seed: 5 }), r), roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2 });
    // Pieces: boxwood (warm, satin) and ebony (deep black, high polish).
    const grain = (spec, seed) => canvasTexture(256, (ctx, size) => drawWood(ctx, size, { ...spec, seed, angle: Math.PI / 2, figure: 0.5 }), r);
    this.materials ??= {};
    this.materials.w ??= new THREE.MeshPhysicalMaterial({ map: grain({ base: '#ddbd85', light: '#efd6a6', dark: '#b8915a' }, 17), roughness: 0.4, clearcoat: 0.75, clearcoatRoughness: 0.22, sheen: 0.3, sheenColor: new THREE.Color(0xfff1d6) });
    this.materials.b ??= new THREE.MeshPhysicalMaterial({ map: grain({ base: '#1c1411', light: '#2d221c', dark: '#0b0806' }, 29), roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.08 });
    this.materials.wAccent ??= new THREE.MeshStandardMaterial({ color: 0x5a3b1c, roughness: 0.6 });
    this.materials.bAccent ??= new THREE.MeshStandardMaterial({ color: 0x9a8f86, roughness: 0.5 });
    this.invalidate();
  }
  resize() {
    const width = this.renderer.domElement.clientWidth, height = this.renderer.domElement.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    this.fitCamera(width); this.invalidate();
  }
  /** Camera on a circle around the board: yaw 0 is White's side, π is Black's. */
  placeCamera(yaw = this.yaw) {
    const { elevation, distance, targetZ } = this.view, target = new THREE.Vector3(Math.sin(yaw) * targetZ, 0, Math.cos(yaw) * targetZ);
    this.camera.position.set(target.x + Math.sin(yaw) * Math.cos(elevation) * distance, Math.sin(elevation) * distance, target.z + Math.cos(yaw) * Math.cos(elevation) * distance);
    this.camera.lookAt(target); this.camera.updateMatrixWorld();
  }
  /**
   * Fit the whole board (frame and the tallest back-rank pieces) into the canvas, whatever its shape.
   * Small screens look down more steeply, so the far squares stay big enough to tap.
   */
  fitCamera(width) {
    this.view.elevation = (width < 520 ? 66 : width < 900 ? 57 : 48) * Math.PI / 180;
    const points = [];
    for (const x of [-BOARD_HALF, BOARD_HALF]) for (const z of [-BOARD_HALF, BOARD_HALF]) points.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, -0.41, z));
    for (const x of [-3.5, 3.5]) for (const z of [-3.5, 3.5]) points.push(new THREE.Vector3(x, 1.35, z));
    for (let i = 0; i < 12; i++) {
      this.placeCamera(0);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of points) { const q = p.clone().project(this.camera); minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x); minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y); }
      this.view.distance *= Math.max((maxX - minX) / 2 / 0.97, (maxY - minY) / 2 / 0.95);
      this.view.targetZ -= (maxY + minY) / 2 * this.view.distance * 0.18;
    }
    this.placeCamera();
  }
  squarePosition(square) { return new THREE.Vector3(FILES.indexOf(square[0]) - 3.5, 0, 3.5 - (Number(square[1]) - 1)); }
  screenPoint(square) {
    this.camera.updateMatrixWorld();
    const point = this.squarePosition(square).project(this.camera), rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + (point.x + 1) / 2 * rect.width, y: rect.top + (1 - point.y) / 2 * rect.height };
  }
  squareAt(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(this.pointer, this.camera);
    // The square under the pointer wins; a click on a piece counts only when that square is empty
    // (tall pieces stand in front of the squares behind them).
    const board = this.raycaster.intersectObjects([...this.squares.values()], false)[0]?.object.userData.square ?? null;
    if (board && this.pieces.has(board)) return board;
    let node = this.raycaster.intersectObjects([...this.pieces.values()], true)[0]?.object;
    while (node && !node.userData.square) node = node.parent;
    return node?.userData.square ?? board;
  }
  setFlipped(flipped) {
    if (flipped === this.flipped) return;
    this.flipped = flipped;
    const from = this.yaw, to = flipped ? Math.PI : 0, start = performance.now();
    this.tweens.push(now => {
      const t = Math.min(1, (now - start) / 650), e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      this.yaw = from + (to - from) * e; this.placeCamera();
      return t < 1;
    });
    this.invalidate();
  }
  placePiece(group, square) { const p = this.squarePosition(square); group.position.set(p.x, 0, p.z); group.userData.square = square; }
  newPiece(piece, square) {
    const group = buildPiece(piece.type, this.materials[piece.color], this.materials[piece.color + 'Accent']);
    // Knights show their profile, turned a little toward the opponent; other pieces get a small random turn like a real set.
    group.rotation.y = piece.type === 'n' ? (piece.color === 'w' ? Math.PI - 0.45 : -0.45) : (FILES.indexOf(square[0]) * 0.7);
    group.scale.setScalar(PIECE_SCALE);
    group.userData.piece = piece.color + piece.type; this.placePiece(group, square); this.scene.add(group);
    return group;
  }
  /** Draw a position: pieces [{square,color,type}], highlights, and an optional move to animate. */
  update({ pieces, selected = null, targets = [], lastMove = null, hint = null, focus = null, check = null, captures = [], animate = null }) {
    const next = new Map(), old = this.pieces, used = new Set();
    const take = (square, code) => { const mesh = old.get(square); if (mesh && !used.has(square) && mesh.userData.piece === code) { used.add(square); return mesh; } return null; };
    const moves = animate ? [[animate.from, animate.to], ...(animate.rook ? [animate.rook] : [])] : [];
    for (const { square, color, type } of pieces) {
      const code = color + type;
      let mesh = take(square, code);
      if (!mesh) {
        const move = moves.find(([, to]) => to === square);
        const mover = move && old.get(move[0]);
        if (mover && !used.has(move[0]) && mover.userData.piece[0] === color) {
          used.add(move[0]);
          if (mover.userData.piece !== code) { this.scene.remove(mover); mesh = this.newPiece({ color, type }, move[0]); } else mesh = mover;
          this.slide(mesh, move[0], square);
        } else mesh = this.newPiece({ color, type }, square);
      }
      next.set(square, mesh);
    }
    for (const [square, mesh] of old) if (!used.has(square)) {
      if (animate && square === animate.to) this.sink(mesh); else this.scene.remove(mesh);
    }
    this.pieces = next;
    for (const [square, mesh] of next) mesh.userData.square = square;
    // Square highlights.
    const tint = { selected: [0x3aa0ff, 0.5], last: [0xf2e45c, 0.42], hint: [0xffa51f, 0.55], check: [0xff3b30, 0.6] };
    for (const [square, overlay] of this.overlays) {
      const state = square === check ? 'check' : square === selected ? 'selected' : hint && (hint.slice(0, 2) === square || hint.slice(2, 4) === square) ? 'hint' : lastMove && (lastMove.from === square || lastMove.to === square) ? 'last' : null;
      overlay.visible = Boolean(state);
      if (state) { overlay.material.color.setHex(tint[state][0]); overlay.material.opacity = tint[state][1]; }
    }
    this.markers.clear();
    for (const square of targets) {
      const capture = captures.includes(square), p = this.squarePosition(square);
      const mesh = new THREE.Mesh(capture ? this.ringGeometry : this.dotGeometry, new THREE.MeshBasicMaterial({ color: 0x0f2a1f, transparent: true, opacity: capture ? 0.45 : 0.38, depthWrite: false }));
      mesh.rotation.x = -Math.PI / 2; mesh.position.set(p.x, 0.006, p.z); mesh.renderOrder = 2; this.markers.add(mesh);
    }
    if (focus) {
      const p = this.squarePosition(focus), mesh = new THREE.Mesh(this.focusGeometry, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }));
      mesh.rotation.x = -Math.PI / 2; mesh.position.set(p.x, 0.008, p.z); mesh.renderOrder = 3; this.markers.add(mesh);
    }
    this.invalidate();
  }
  slide(mesh, from, to) {
    const a = this.squarePosition(from), b = this.squarePosition(to), start = performance.now(), distance = a.distanceTo(b);
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 260 + distance * 45, lift = 0.25 + Math.sqrt(distance) * 0.28;
    mesh.position.copy(a);
    this.tweens.push(now => {
      const t = Math.min(1, (now - start) / duration), e = 1 - (1 - t) ** 3;
      mesh.position.lerpVectors(a, b, e); mesh.position.y = Math.sin(Math.PI * t) * lift;
      return t < 1;
    });
    this.invalidate();
  }
  sink(mesh) {
    const start = performance.now();
    this.tweens.push(now => {
      const t = Math.min(1, (now - start) / 380);
      mesh.scale.setScalar(PIECE_SCALE * (1 - t * 0.6)); mesh.position.y = -t * 0.4;
      if (t === 1) this.scene.remove(mesh);
      return t < 1;
    });
  }
  setArrows(arrows = [], marks = []) {
    this.arrowGroup.clear();
    const colors = { good: 0x23a455, bad: 0xe04848, hint: 0xf0a81c, line: 0x2f86e0 };
    for (const arrow of arrows) {
      const a = this.squarePosition(arrow.from), b = this.squarePosition(arrow.to), length = a.distanceTo(b);
      if (!length) continue;
      const width = arrow.kind === 'line' ? 0.09 : 0.15, head = 0.38, shaft = Math.max(0.05, length - head - 0.18);
      const shape = new THREE.Shape([v(-width / 2, 0.12), v(width / 2, 0.12), v(width / 2, 0.12 + shaft), v(head * 0.6, 0.12 + shaft), v(0, 0.12 + shaft + head), v(-head * 0.6, 0.12 + shaft), v(-width / 2, 0.12 + shaft)]);
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: colors[arrow.kind] ?? colors.hint, transparent: true, opacity: 0.82, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      // The shape points along +y; laid flat, local +y becomes -z, so this angle aims it at the target square.
      mesh.rotation.x = -Math.PI / 2; mesh.rotation.z = Math.atan2(-(b.x - a.x), -(b.z - a.z)); mesh.position.set(a.x, 0.012, a.z); mesh.renderOrder = 4;
      this.arrowGroup.add(mesh);
    }
    for (const mark of marks) {
      const p = this.squarePosition(mark.square), mesh = new THREE.Mesh(this.ringGeometry, new THREE.MeshBasicMaterial({ color: colors[mark.kind === 'good' ? 'good' : mark.kind === 'bad' ? 'bad' : 'hint'], transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
      mesh.rotation.x = -Math.PI / 2; mesh.position.set(p.x, 0.012, p.z); mesh.renderOrder = 4; this.arrowGroup.add(mesh);
    }
    this.invalidate();
  }
  invalidate() {
    if (this.frameRequested) return;
    this.frameRequested = true;
    requestAnimationFrame(now => this.frame_(now));
  }
  frame_(now) {
    this.frameRequested = false;
    this.tweens = this.tweens.filter(step => step(now));
    this.renderer.render(this.scene, this.camera);
    if (this.tweens.length) this.invalidate();
  }
}
