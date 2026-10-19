'use strict';
(function () {
  // ---------------------------------------------------------------- config
  const CFG = window.GAME_CONFIG || {};
  const T = Object.assign({
    hello: '¡Hola, {name}!', play: '¡A JUGAR!', tapToLaunch: 'Toca para lanzar',
    moveHint: '← Mueve el dedo →', next: 'Siguiente', tapToContinue: 'Toca para seguir',
    revealedCount: 'Fotos descubiertas: {n}', levelDone: 'Nivel {n} superado', nextLevel: 'Nivel {n}',
    wellDone: ['¡Lo lograste!'], cheers: ['¡Muy bien!'], startCheers: ['¡Vamos, {nick}!'], nick: 'Abu',
    powerMulti: '¡Bolas imán!', powerFire: '¡Bola de fuego!', powerHero: '¡Súper {name}!',
    powerHeroNoName: '¡Súper héroe!', powerFrog: '¡La rana!', powerCannon: '¡Cañón de aguacates!'
  }, CFG.text || {});
  const PARAMS = new URLSearchParams(location.search);
  const AUTO = PARAMS.has('auto');          // demo mode: plays itself
  const DEBUG_POWER = PARAMS.get('poder');  // testing: force the first capsule type

  // Ball speed as a fraction of screen height per second; paddle as fraction of width.
  const SPEEDS = { 'muy-lenta': 0.30, 'lenta': 0.40, 'normal': 0.52 };
  const PADDLES = { 'normal': 0.26, 'grande': 0.34, 'muy-grande': 0.44 };
  const COLORS = ['#ff7a59', '#ffb547', '#ffd84d', '#5ed6a0', '#4fb3ff', '#a88bff'];
  const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];
  const COLS = 7;
  // Levels, in order of difficulty. X = normal brick (one hit). S = stone brick (two hits: the
  // first cracks it). rows: a layout on a 7-column grid. move: 'wave' = rows slide left and
  // right; 'bob' = columns move up and down; 'drift' = rows travel sideways and wrap around.
  // amp: how far (or how fast, for drift) they move, 1 = the usual movement; levels 2-6 use less.
  // ring: bricks on turning circles (n bricks, r = size relative to the biggest circle, speed
  // in turns per 10 s; negative = the other way, stones = which bricks are stone). After the
  // last level they repeat, harder: more stone bricks and faster circles.
  const LEVELS = [
    // 1: fixed. 2-6: a little movement from the start, growing level by level; stones appear little by little
    { rows: ['XXXXXXX', 'XXXXXXX', 'XXXXXXX'] },
    { rows: ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'], move: 'bob', amp: 0.35 },   // a heart that breathes
    { rows: ['...S...', '..XXX..', '.XXXXX.', 'XXXXXXX', 'XXXXXXX'], move: 'wave', amp: 0.3 },             // a mountain that sways
    { rows: ['XXXXXXX', 'XSXXXSX', 'XXXXXXX', 'XXXXXXX'], move: 'drift', amp: 0.4 },                       // rows that creep sideways
    { rows: ['..XXX..', '.XXXXX.', 'XXSSSXX', '.XXXXX.', '..XXX..'], move: 'wave', amp: 0.5 },             // a diamond that sways more
    { rows: ['X.X.X.X', '.S.S.S.', 'X.X.X.X', '.X.X.X.', 'X.X.X.X'], move: 'bob', amp: 0.6 },              // a checkerboard that bobs
    // 7-12: first moving levels, gentle
    { rows: ['.XXXXX.', '.XXXXX.', '.XXXXX.', '.XXXXX.'], move: 'wave' },
    { rows: ['XXXXXXX', 'XXXXXXX', 'XXXXXXX'], move: 'bob' },
    { ring: [{ n: 12, r: 1, speed: 0.3, stones: [0, 6] }] },
    { rows: ['.XXXXX.', '.XSXSX.', '.XXXXX.', '.XSXSX.'], move: 'wave' },
    { rows: ['XXXXXXX', '.XXXXX.', '..SSS..', '..XXX..', '.XXXXX.', 'XXXXXXX'] },
    { rows: ['X.X.X.X', 'X.X.X.X', 'X.X.X.X', 'X.X.X.X'], move: 'drift' },
    // 13-18: more stones, faster movement
    { rows: ['XSXXXSX', 'XXXXXXX', 'XSXXXSX', 'XXXXXXX'], move: 'bob' },
    { rows: ['XX.S.XX', 'XX.X.XX', 'XX.S.XX', 'XX.X.XX', 'XX.S.XX'] },
    { ring: [{ n: 14, r: 1, speed: 0.3, stones: [0, 7] }, { n: 7, r: 0.5, speed: -0.5, stones: [3] }] },
    { rows: ['SXXXXXS', 'X.....X', 'X.SSS.X', 'X.....X', 'SXXXXXS'] },
    { rows: ['X.X.X.X', 'S.X.X.S', 'X.X.X.X', 'X.S.S.X'], move: 'drift' },
    { rows: ['..XXX..', '.SXXXS.', '..XSX..', '.XXXXX.', '..SSS..'], move: 'wave' },
    // 19-24: the hard ones
    { ring: [{ n: 16, r: 1, speed: -0.4, stones: [0, 4, 8, 12] }] },
    { rows: ['XXXXXXX', 'XSXSXSX', 'XXXXXXX', 'XSXSXSX', 'XXXXXXX'] },
    { rows: ['SXXSXXS', 'XXSXSXX', 'XSXXXSX', 'SXXSXXS'], move: 'bob' },
    { rows: ['XSXSXSX', 'S.....S', 'XSXSXSX', 'S.....S'], move: 'drift' },
    { ring: [{ n: 14, r: 1, speed: 0.45, stones: [0, 3, 7, 10] }, { n: 8, r: 0.5, speed: -0.7, stones: [0, 4] }] },
    { rows: ['...S...', '..SXS..', '.SXXXS.', 'SXXXXXS', 'XXSSSXX', 'XXXXXXX'] },
    { rows: ['SSSSSSS', 'XXXXXXX', 'SXSXSXS', 'XXXXXXX', 'SSSSSSS', 'XXXXXXX'] }
  ];
  const STONE_COLOR = '#a7b0ba';
  let levelTime = 0; // seconds since the level started (moves the moving bricks)
  // Power-ups ("sorpresas"). None of them needs faster hands: capsules drift to the
  // paddle by themselves, extra balls are pulled to the paddle, the hero and the frog
  // work on their own.
  const POWER_TYPES = ['multi', 'fire', 'hero', 'frog', 'cannon'];
  const POWER_DUR = { multi: 10, fire: 10, frog: 10, cannon: 8 };
  const VERSION = '18 (2026-10-19)'; // shown in the hidden menu; raise with every upload
  // index.html carries the same number. If they differ, the device got a mix of old and new
  // files (it happens for a few minutes after an upload): reload once to get a matching set.
  const htmlVersion = (document.querySelector('meta[name="app-version"]') || {}).content;
  if (htmlVersion && htmlVersion !== VERSION.split(' ')[0]) {
    try {
      if (!sessionStorage.getItem('ark.reloaded')) { sessionStorage.setItem('ark.reloaded', '1'); location.reload(); }
    } catch (e) { /* ignore */ }
  }
  const FROG_SCALE = 0.56; // size of the frog relative to the first version (1 = the big one)

  // ---------------------------------------------------------------- storage
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };
  const DEFAULT_PROGRESS = { level: 0, revealed: 0, current: null, lastPhoto: null, seen: [], everShown: [], adapt: { speed: 0.9, paddle: 0 } };
  const settings = Object.assign({
    playerName: CFG.playerName || '', speed: 'lenta', paddle: 'grande',
    safetyNet: false, sound: true, music: true, track: 'misterio', vibration: true, powerups: true
  }, store.get('ark.settings', {}));
  let progress = Object.assign(JSON.parse(JSON.stringify(DEFAULT_PROGRESS)), store.get('ark.progress', {}));
  progress.adapt = Object.assign({ speed: 0.9, paddle: 0 }, progress.adapt);
  const saveSettings = () => store.set('ark.settings', settings);
  const saveProgress = () => store.set('ark.progress', progress);

  const db = {
    _p: null,
    open() {
      if (this._p) return this._p;
      this._p = new Promise((res, rej) => {
        if (!('indexedDB' in window)) return rej(new Error('no indexedDB'));
        const r = indexedDB.open('recuerdos-photos', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'id' });
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      return this._p;
    },
    async tx(mode, fn) {
      const d = await this.open();
      return new Promise((res, rej) => {
        const t = d.transaction('photos', mode);
        const req = fn(t.objectStore('photos'));
        t.oncomplete = () => res(req && req.result);
        t.onerror = () => rej(t.error);
      });
    },
    all() {
      // Never let a slow or broken storage block the game.
      const timeout = new Promise(res => setTimeout(() => res([]), 4000));
      return Promise.race([this.tx('readonly', s => s.getAll()).then(r => r || []).catch(() => []), timeout]);
    },
    put(rec) { return this.tx('readwrite', s => s.put(rec)); },
    del(id) { return this.tx('readwrite', s => s.delete(id)); }
  };

  // ---------------------------------------------------------------- helpers
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };
  const fmt = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => (o[k] != null ? o[k] : ''));
  const srcW = s => s.naturalWidth || s.width;
  const srcH = s => s.naturalHeight || s.height;
  // Does canvas blur really work here? Safari/iPad accepts `filter` but may ignore it,
  // so draw a white dot with blur and check that it actually spread.
  const FILTER_OK = (() => {
    try {
      const c = mk(9, 9), x = c.getContext('2d');
      x.filter = 'blur(2px)'; x.fillStyle = '#fff'; x.fillRect(4, 4, 1, 1); x.filter = 'none';
      return x.getImageData(1, 4, 1, 1).data[3] > 0;
    } catch (e) { return false; }
  })();

  // ---------------------------------------------------------------- encrypted photos
  // Photos on the server are encrypted (AES-GCM) with a key derived from the family
  // password. The key is derived once per device and kept in local storage.
  const subtle = (window.crypto && crypto.subtle) || null;
  const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const b64e = u => btoa(String.fromCharCode(...new Uint8Array(u)));
  let vault = null;    // photos/meta.json, or null when there are no encrypted photos
  let photoKey = null; // CryptoKey when unlocked
  const keySlot = () => 'ark.key.' + vault.salt;

  async function fetchVaultMeta() {
    try {
      const r = await fetch('photos/meta.json', { cache: 'no-cache' });
      return r.ok ? await r.json() : null;
    } catch (e) { return null; }
  }
  function decryptBuf(key, buf) {
    const u = new Uint8Array(buf);
    return subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, key, u.slice(12));
  }
  const keyFromRaw = raw => subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
  async function keyFromPassword(pw) {
    const base = await subtle.importKey('raw', new TextEncoder().encode(pw.normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
    return subtle.deriveBits({ name: 'PBKDF2', salt: b64d(vault.salt), iterations: vault.iter, hash: 'SHA-256' }, base, 256);
  }
  async function keyWorks(key) {
    try { return new TextDecoder().decode(await decryptBuf(key, b64d(vault.check))) === 'recuerdos'; } catch (e) { return false; }
  }
  // true: photos readable (or there are none). false: the password is needed.
  async function unlockFromStorage() {
    vault = await fetchVaultMeta();
    if (!vault || !subtle) { photoKey = null; return true; }
    const saved = store.get(keySlot(), null);
    if (saved) {
      try { const k = await keyFromRaw(b64d(saved)); if (await keyWorks(k)) { photoKey = k; return true; } } catch (e) { /* ask again */ }
    }
    return false;
  }
  async function unlockWithPassword(pw) {
    const raw = await keyFromPassword(pw);
    const k = await keyFromRaw(raw);
    if (!(await keyWorks(k))) return false;
    store.set(keySlot(), b64e(raw)); photoKey = k; return true;
  }
  function askPassword() {
    return new Promise(res => {
      const scr = $('unlock'), inp = $('pw'), msg = $('pw-msg'), ok = $('pw-ok');
      scr.classList.add('show'); inp.value = ''; msg.textContent = '';
      setTimeout(() => inp.focus(), 300);
      const done = r => { inp.blur(); scr.classList.remove('show'); res(r); }; // blur: so the space bar reaches the game afterwards
      ok.onclick = async () => {
        if (!inp.value) { inp.focus(); return; }
        msg.textContent = 'Comprobando…'; ok.disabled = true;
        let good = false;
        try { good = await unlockWithPassword(inp.value); } catch (e) { good = false; }
        ok.disabled = false;
        if (good) done(true); else { msg.textContent = 'La contraseña no es correcta. Inténtalo otra vez.'; inp.select(); }
      };
      inp.onkeydown = e => { if (e.key === 'Enter') ok.click(); };
      $('pw-skip').onclick = () => done(false);
    });
  }
  async function fetchDecrypted(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error('fetch ' + path);
    return decryptBuf(photoKey, await r.arrayBuffer());
  }

  // ---------------------------------------------------------------- canvas & layout
  const cv = $('game');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  const L = { panelTop: 0 };

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    layout();
    if (photoSrc) buildLayers(photoSrc);
  }

  function layout() {
    L.side = W * 0.035; L.gap = W * 0.014;
    L.bw = (W - 2 * L.side - L.gap * (COLS - 1)) / COLS;
    L.bh = Math.min(Math.max(L.bw * 0.5, 22), H * 0.42 / 6 - L.gap);
    L.top = Math.max(H * 0.09, 40);
    L.paddleY = H * 0.85;
    L.paddleH = clamp(W * 0.05, 18, 34);
    L.ballR = clamp(W * 0.034, 10, 22);
    L.netY = H * 0.955;
    L.panelTop = L.panelTop || H * 0.62;
    moveBricks(levelTime);
    balls.forEach(b => { b.r = L.ballR; });
  }

  function placeBrick(b) {
    b.x = L.side + b.col * (L.bw + L.gap);
    b.y = L.top + b.row * (L.bh + L.gap);
    b.w = L.bw; b.h = L.bh;
  }

  // Puts every brick where it is at time t (fixed bricks don't move; wave/drift rows and rings do).
  function moveBricks(t) {
    const Rmax = Math.min(W * 0.4 - L.bw / 2, H * 0.22), ringCy = L.top + L.bh + Rmax;
    const step = L.bw + L.gap, period = W + step;
    for (const b of bricks) {
      b.w = L.bw; b.h = L.bh;
      if (b.ring) {
        const a = b.ring.a0 + t * b.ring.speed * Math.PI * 2 / 10, R = Rmax * b.ring.r;
        b.x = W / 2 + Math.cos(a) * R - L.bw / 2;
        b.y = ringCy + Math.sin(a) * R - L.bh / 2;
      } else {
        placeBrick(b);
        const amp = b.amp || 1;
        if (b.move === 'wave') b.x += Math.sin(t * 0.9 + b.row * 1.1) * step * amp;
        else if (b.move === 'bob') b.y += Math.sin(t * 1.3 + b.col * 0.9) * L.bh * 0.9 * amp; // columns up and down
        else if (b.move === 'drift') {
          const dir = b.row % 2 ? -1 : 1, v = step * 0.45 * amp; // one brick width every ~2 s at amp 1
          b.x = ((b.x + dir * v * t + L.bw) % period + period) % period - L.bw;
        }
      }
    }
  }
  // Which of the 7 columns a brick is over right now (moving bricks included).
  const brickCol = b => clamp(Math.round((b.x + b.w / 2 - L.side - L.bw / 2) / (L.bw + L.gap)), 0, COLS - 1);

  // ---------------------------------------------------------------- game state
  let state = 'boot'; // boot | title | ready | play | missed | clearing | complete | paused
  let prevState = 'ready';
  let stateTime = 0;
  const paddle = { x: 0, tx: 0, w: 0, squish: 0 };
  let balls = [];
  let bricks = [], dying = [], particles = [], floaters = [], confetti = [], ghosts = [], balloons = [];
  let total = 0, destroyed = 0, reveal = 0, revealShown = 0, cheersGiven = 0;
  let launchTimer = 0, sinceBrick = 0, noteIdx = 0, missTimer = 0, netFlash = 0, freeze = 0;
  let showMoveHint = true;

  // power-ups
  let capsules = [];        // falling capsules
  let power = null;         // { type, t, dur } for multi / fire / frog / cannon
  let hero = null;          // flying grandchild
  let frog = null;          // frog on the paddle
  let avocados = [];        // shots from the avocado cannon
  let cannonTimer = 0, cannonAng = -Math.PI / 2; // where the barrel points (radians, -π/2 = straight up)
  let sinceCapsule = 0;     // bricks broken since the last capsule
  let bag = [];             // shuffled bag so every power-up shows up
  let faces = [];           // [{ name, img }]

  let pool = [];             // [{id, caption, src, kind, enc}]
  const deviceUrls = {};     // id -> object URL
  let currentPhoto = null;   // pool entry
  let photoSrc = null;       // Image or canvas
  let layers = null;         // {heavy, soft, sharp}

  function setState(s) { state = s; stateTime = 0; }
  const newBall = () => ({ x: paddle.x, y: L.paddleY - L.paddleH / 2 - L.ballR - 1, vx: 0, vy: 0, r: L.ballR, trail: [] });

  function paddleWidth() { return Math.min(W * 0.55, W * ((PADDLES[settings.paddle] || 0.34) + progress.adapt.paddle)); }
  function currentSpeed() {
    const lvl = 1 + Math.min(progress.level, 16) * 0.025; // up to +40% by level 17
    return H * (SPEEDS[settings.speed] || 0.4) * lvl * progress.adapt.speed;
  }

  function buildBricks() {
    const def = LEVELS[progress.level % LEVELS.length];
    const cycle = Math.floor(progress.level / LEVELS.length); // 0 the first time through, then harder
    const extraStone = Math.min(0.5, cycle * 0.2); // share of normal bricks that turn to stone
    const mkBrick = (stone, color, extra) => {
      if (!stone && extraStone > 0 && Math.random() < extraStone) stone = true;
      return Object.assign({ color: stone ? STONE_COLOR : color, alive: true, held: false, stone, hp: stone ? 2 : 1 }, extra);
    };
    bricks = [];
    if (def.rows) {
      def.rows.forEach((row, ri) => [...row].forEach((ch, ci) => {
        if (ch !== 'X' && ch !== 'S') return;
        bricks.push(mkBrick(ch === 'S', COLORS[ri % COLORS.length], { row: ri, col: ci, move: def.move || null, amp: def.amp || 1 }));
      }));
    }
    if (def.ring) {
      def.ring.forEach((rg, k) => {
        for (let i = 0; i < rg.n; i++) {
          bricks.push(mkBrick(rg.stones.includes(i), COLORS[(k * 2 + i) % COLORS.length],
            { row: k, col: 0, ring: { a0: i * Math.PI * 2 / rg.n, r: rg.r, speed: rg.speed * (1 + cycle * 0.25) } }));
        }
      });
    }
    levelTime = 0; moveBricks(0);
    total = bricks.length; destroyed = 0; reveal = 0; revealShown = 0; cheersGiven = 0;
    dying = []; particles = []; floaters = []; confetti = []; ghosts = []; balloons = [];
    capsules = []; power = null; hero = null; frog = null; avocados = []; sinceCapsule = 0;
    sinceBrick = 0;
  }

  function resetBall() {
    balls = [newBall()];
    power = null; capsules = []; frog = null; hero = null; avocados = [];
    launchTimer = 3.0;
    setState('ready');
  }

  function launch() {
    const b = balls[0], sp = currentSpeed();
    const a = (Math.random() * 50 - 25) * Math.PI / 180;
    b.vx = Math.sin(a) * sp; b.vy = -Math.cos(a) * sp;
    sinceBrick = 0; noteIdx = 0; showMoveHint = false;
    sfx.launch();
    if (destroyed === 0 && !floaters.length) floaters.push({ text: fmt(pick(T.startCheers), { nick: T.nick }), t: 0, dur: 1.8 });
    setState('play');
  }

  // ---------------------------------------------------------------- photos
  function captionFromName(name) {
    const base = name.replace(/\.[^.]+$/, '');
    if (/^(img|pxl|dsc|dcim|screenshot|whatsapp|vid|photo|image|\d{6,})/i.test(base)) return '';
    return base.replace(/\(\s*\d+\s*\)/g, ' ').replace(/_+/g, ' ').replace(/\s+/g, ' ').replace(/^[\s-]+|[\s-]+$/g, '');
  }

  async function loadPool() {
    const list = [];
    let faceList = [];
    if (vault && photoKey) {
      try {
        const r = await fetch('photos/list.enc', { cache: 'no-cache' });
        if (r.ok) {
          const manifest = JSON.parse(new TextDecoder().decode(await decryptBuf(photoKey, await r.arrayBuffer())));
          const photos = Array.isArray(manifest) ? manifest : (manifest.photos || []);
          faceList = Array.isArray(manifest) ? [] : (manifest.faces || []);
          photos.forEach(p => {
            if (p && p.file) list.push({ id: 'f:' + p.file, caption: p.caption || '', src: 'photos/' + p.file, kind: 'folder', enc: true });
          });
        }
      } catch (e) { /* offline without cache, or wrong key: play with what we have */ }
    }
    const recs = await db.all();
    recs.sort((a, b) => (a.added || 0) - (b.added || 0));
    recs.forEach(r => {
      if (!deviceUrls[r.id]) deviceUrls[r.id] = URL.createObjectURL(r.blob);
      list.push({ id: r.id, caption: r.caption || '', src: deviceUrls[r.id], kind: 'device' });
    });
    pool = list;
    loadFaces(faceList); // in the background; the hero works without them too
  }

  async function loadFaces(faceList) {
    const out = [];
    for (const f of faceList) {
      try {
        const bytes = await fetchDecrypted('photos/' + f.file);
        const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
        out.push({ name: f.name || '', img: await loadImage(url) });
      } catch (e) { /* skip this face */ }
    }
    faces = out;
  }

  function choosePhoto() {
    if (!pool.length) return null;
    let p = pool.find(x => x.id === progress.current);
    if (p) return p;
    const seen = new Set(progress.seen);
    let cand = pool.filter(x => !seen.has(x.id));
    if (!cand.length) {
      progress.seen = [];
      cand = pool.filter(x => x.id !== progress.lastPhoto);
      if (!cand.length) cand = pool;
    }
    const ever = new Set(progress.everShown);
    const fresh = cand.filter(x => !ever.has(x.id)); // newly added photos come first
    p = pick(fresh.length ? fresh : cand);
    progress.current = p.id; saveProgress();
    return p;
  }

  function loadImage(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      const t = setTimeout(() => rej(new Error('timeout')), 15000);
      img.onload = () => { clearTimeout(t); res(img); };
      img.onerror = () => { clearTimeout(t); rej(new Error('load ' + src)); };
      img.src = src;
    });
  }

  let photoUrl = null; // object URL of the decrypted photo in use
  async function loadPhoto(entry) {
    if (!entry.enc) return loadImage(entry.src);
    const bytes = await fetchDecrypted(entry.src);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
    return loadImage(photoUrl);
  }

  function makeFallback(seed) {
    const c = mk(900, 1600), x = c.getContext('2d');
    const hue = (seed * 47 + 20) % 360;
    const g = x.createLinearGradient(0, 0, 0, 1600);
    g.addColorStop(0, `hsl(${hue},65%,55%)`);
    g.addColorStop(0.6, `hsl(${(hue + 35) % 360},80%,72%)`);
    g.addColorStop(1, `hsl(${(hue + 70) % 360},55%,38%)`);
    x.fillStyle = g; x.fillRect(0, 0, 900, 1600);
    x.fillStyle = 'rgba(255,244,210,.92)';
    x.beginPath(); x.arc(450, 760, 170, 0, Math.PI * 2); x.fill();
    for (let i = 0; i < 3; i++) {
      x.fillStyle = `hsla(${(hue + 120 + i * 25) % 360},45%,${34 - i * 8}%,.96)`;
      x.beginPath(); x.moveTo(0, 1600);
      for (let px = 0; px <= 900; px += 30) x.lineTo(px, 1000 + i * 170 + Math.sin(px / 140 + i * 2 + seed) * 60);
      x.lineTo(900, 1600); x.closePath(); x.fill();
    }
    return c;
  }

  async function prepareLevel() {
    buildBricks();
    currentPhoto = choosePhoto();
    let src = null;
    if (currentPhoto) {
      try { src = await loadPhoto(currentPhoto); } catch (e) { src = null; }
    }
    photoSrc = src || makeFallback(progress.level);
    buildLayers(photoSrc);
  }

  // Draw image to fill (cover) the target; vertical crop biased upward to keep faces.
  function drawCover(x, src, w, h, zoom) {
    const iw = srcW(src), ih = srcH(src);
    const s = Math.max(w / iw, h / ih) * (zoom || 1);
    const dw = iw * s, dh = ih * s;
    x.drawImage(src, (w - dw) / 2, (h - dh) * 0.35, dw, dh);
  }

  function blurredLayer(src, w, h, px, desat, dark) {
    const c = mk(w, h), x = c.getContext('2d');
    if (FILTER_OK) {
      x.filter = `blur(${px}px)`; drawCover(x, src, w, h, 1.12); x.filter = 'none';
    } else {
      // No canvas blur (iPad): shrink in halves to a tiny copy, then enlarge in halves.
      // Each step averages pixels, which gives a smooth blur without blocky squares.
      const f = Math.max(2, px * 0.9);
      const tw = Math.max(2, Math.ceil(w / f)), th = Math.max(2, Math.ceil(h / f));
      let cur = mk(w, h); drawCover(cur.getContext('2d'), src, w, h, 1.05);
      const steps = [];
      while (cur.width / 2 >= tw) {
        const n = mk(Math.ceil(cur.width / 2), Math.ceil(cur.height / 2)), nx = n.getContext('2d');
        nx.imageSmoothingEnabled = true; nx.imageSmoothingQuality = 'high';
        nx.drawImage(cur, 0, 0, n.width, n.height);
        steps.push(cur); cur = n;
      }
      while (steps.length) {
        const up = steps.pop(), n = mk(up.width, up.height), nx = n.getContext('2d');
        nx.imageSmoothingEnabled = true; nx.imageSmoothingQuality = 'high';
        nx.drawImage(cur, 0, 0, n.width, n.height);
        cur = n;
      }
      x.drawImage(cur, 0, 0, w, h);
    }
    if (desat > 0) {
      x.globalCompositeOperation = 'saturation';
      x.fillStyle = `rgba(128,128,128,${desat})`; x.fillRect(0, 0, w, h);
      x.globalCompositeOperation = 'source-over';
    }
    if (dark > 0) { x.fillStyle = `rgba(10,6,24,${dark})`; x.fillRect(0, 0, w, h); }
    return c;
  }

  function buildLayers(src) {
    const w = cv.width, h = cv.height;
    const sharp = mk(w, h); drawCover(sharp.getContext('2d'), src, w, h, 1);
    layers = {
      // Blur scaled to the screen so the starting photo can't be recognised on any device.
      heavy: blurredLayer(src, w, h, Math.max(w, h) * 0.12, 0.25, 0.35),
      soft: blurredLayer(src, w, h, Math.max(w, h) * 0.035, 0.25, 0.25),
      sharp,
      // The mix of blurred/sharp is built at half size (4x cheaper on the phone); the blur hides it.
      comp: mk(Math.ceil(w / 2), Math.ceil(h / 2)), tmp: mk(Math.ceil(w / 2), Math.ceil(h / 2)), compP: -1
    };
  }

  // The photo clears from the edges inward: an oval "window" of sharp photo grows from
  // the screen border toward the center. The center is only fully sharp at p = 1
  // (all bricks gone). A half-blurred ring runs just ahead of the sharp edge.
  function buildComposite(p) {
    const { comp, tmp, heavy, soft, sharp } = layers;
    const w = comp.width, h = comp.height;
    const cx = comp.getContext('2d'), tx = tmp.getContext('2d');
    const RMAX = Math.SQRT2, F = 0.28, BAND = 0.35; // in units of half the screen size
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.globalCompositeOperation = 'source-over'; cx.globalAlpha = 1;
    cx.drawImage(heavy, 0, 0, w, h);
    const reveal = (layer, R) => {
      if (R >= RMAX + F) return; // nothing of this layer visible yet
      tx.setTransform(1, 0, 0, 1, 0, 0); tx.globalCompositeOperation = 'source-over';
      tx.clearRect(0, 0, w, h);
      tx.drawImage(layer, 0, 0, w, h);
      if (R > -F) {
        tx.globalCompositeOperation = 'destination-in';
        tx.setTransform(w / 2, 0, 0, h / 2, w / 2, h / 2); // unit circle = oval filling the screen
        const g = tx.createRadialGradient(0, 0, 0, 0, 0, RMAX + F);
        const a = clamp((R - F) / (RMAX + F), 0, 1), b = clamp((R + F) / (RMAX + F), 0, 1);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        if (a > 0) g.addColorStop(a, 'rgba(0,0,0,0)');
        g.addColorStop(Math.max(b, a + 0.001), 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,1)');
        tx.fillStyle = g; tx.fillRect(-1, -1, 2, 2);
        tx.setTransform(1, 0, 0, 1, 0, 0); tx.globalCompositeOperation = 'source-over';
      }
      cx.drawImage(tmp, 0, 0);
    };
    const R = (RMAX + F) * (1 - p) - F * p; // RMAX+F at p=0 (all blurred) → -F at p=1 (all sharp)
    reveal(soft, R + BAND);
    reveal(sharp, R);
    layers.compP = p;
  }

  // ---------------------------------------------------------------- audio & haptics
  // All sound is made in code (no audio files). Sounds and the music follow the ones in the
  // Tile-breaker game by Ruben's brother, adapted to this game.
  let AC = null, master = null;
  function audioInit() {
    if (AC) { if (AC.state === 'suspended') AC.resume(); startMusic(); return; }
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = 0.85;
      const comp = AC.createDynamicsCompressor();
      master.connect(comp); comp.connect(AC.destination);
      startMusic();
    } catch (e) { AC = null; }
  }
  function tone(freq, dur, type, vol, when) {
    if (!AC || !settings.sound) return;
    try {
      const t = AC.currentTime + (when || 0);
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
    } catch (e) { /* audio is never worth a crash */ }
  }
  // A note whose pitch slides from f0 to f1.
  function glide(f0, f1, dur, type, vol, when) {
    if (!AC || !settings.sound) return;
    try {
      const t = AC.currentTime + (when || 0);
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = type || 'triangle';
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
    } catch (e) { /* ignore */ }
  }
  // A quarter second of fading noise, made once.
  let noiseBuf = null;
  function noiseBuffer() {
    if (!noiseBuf) {
      const n = Math.floor(AC.sampleRate * 0.25);
      noiseBuf = AC.createBuffer(1, n, AC.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
    }
    return noiseBuf;
  }
  // A short burst of filtered noise. Low cutoff = a thud or a splat; type 'highpass' = a click
  // or a crack. Every strong effect below is layered the way game sound designers do it: a
  // sharp click (transient), a tone (body), a low thump (weight) and a short tail.
  function puff(vol, cutoff, dur, when, type) {
    if (!AC || !settings.sound) return;
    try {
      const t = AC.currentTime + (when || 0);
      const src = AC.createBufferSource(); src.buffer = noiseBuffer();
      const f = AC.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = cutoff;
      const g = AC.createGain();
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + dur);
    } catch (e) { /* ignore */ }
  }
  const vary = (f, semis) => f * 2 ** ((Math.random() * 2 - 1) * (semis || 0.5) / 12);

  // --- music: five tracks. The menu sets the track; each new level then switches to a
  // different one at random (never in the middle of a level). All are generated as they play.
  //   fiesta:   festive "oom-pah" in C major, 132 bpm (bass, chord stabs, drums, lively melody)
  //   tropical: calypso feel in C major, 104 bpm (off-beat chord "skanks", steel-drum melody,
  //             clave and shaker)
  //   misterio: cheerful but mysterious, A minor with swing, 118 bpm (shimmering pad,
  //             plucked bass, xylophone melody, snaps)
  //   merengue: Dominican merengue in G major, 140 bpm (accordion melody, güira, tambora,
  //             piano off-beats, bouncing bass)
  //   bachata:  Dominican bachata in E minor, 126 bpm (plucked requinto guitar melody, guitar
  //             arpeggios, bongo martillo, güira, syncopated bass)
  // Plays while the game is open, stops while hidden or paused, steps back for the jingles.
  const MUSIC_AHEAD = 1.5, MUSIC_VOLUME = 0.045;
  const midiHz = n => 440 * 2 ** ((n - 69) / 12);
  const MUSIC_STYLES = {
    fiesta: {
      bpm: 132, echo: 3 / 8, filter: 3000,
      chords: [[60, 64, 67, 36], [59, 62, 67, 31], [57, 60, 64, 33], [57, 60, 65, 29], [60, 64, 67, 36], [57, 60, 65, 29], [59, 62, 67, 31], [60, 64, 67, 36]],
      scale: [72, 74, 76, 79, 81, 84, 86, 88], root: 5
    },
    tropical: {
      bpm: 104, echo: 1 / 4, filter: 3800,
      chords: [[60, 64, 67, 69, 36], [57, 60, 65, 69, 29], [59, 62, 67, 69, 31], [57, 60, 65, 69, 29], [60, 64, 67, 69, 36], [57, 60, 64, 67, 33], [59, 62, 65, 67, 31], [60, 64, 67, 69, 36]],
      scale: [72, 74, 76, 79, 81, 84, 86, 88], root: 5
    },
    misterio: {
      bpm: 118, echo: 3 / 8, filter: 2600,
      chords: [[57, 60, 64, 33], [53, 57, 60, 29], [52, 56, 59, 28], [57, 60, 64, 33], [50, 53, 57, 26], [57, 60, 64, 33], [52, 56, 59, 28], [57, 60, 64, 33]],
      scale: [69, 71, 72, 74, 76, 77, 80, 81, 83, 84], root: 7 // A harmonic minor
    },
    merengue: {
      bpm: 140, echo: 1 / 8, filter: 3200,
      chords: [[55, 59, 62, 31], [54, 57, 60, 62, 26], [55, 59, 62, 31], [54, 57, 60, 62, 26], [55, 60, 64, 36], [55, 59, 62, 31], [54, 57, 60, 62, 26], [55, 59, 62, 31]],
      scale: [67, 69, 71, 72, 74, 76, 78, 79, 81, 83], root: 7 // G major
    },
    bachata: {
      bpm: 126, echo: 1 / 4, filter: 3000,
      chords: [[52, 55, 59, 28], [50, 54, 57, 26], [48, 52, 55, 24], [51, 54, 57, 59, 23], [52, 55, 59, 28], [50, 54, 57, 26], [48, 52, 55, 24], [51, 54, 57, 59, 23]],
      scale: [64, 66, 67, 69, 71, 72, 75, 76, 78, 79], root: 7 // E harmonic minor
    }
  };
  const musicStyle = () => MUSIC_STYLES[settings.track] || MUSIC_STYLES.fiesta;
  const musicBarLen = () => 240 / musicStyle().bpm;
  let melodyIdx = 2;
  let music = null, musicTimer = 0, musicNextBar = 0, musicBarNo = 0;

  function musicNote(dests, f, type, at, attack, hold, release, vol, detune) {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.value = f; o.detune.value = detune || 0;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + attack);
    g.gain.setValueAtTime(vol, at + attack + hold);
    g.gain.linearRampToValueAtTime(0, at + attack + hold + release);
    o.connect(g); dests.forEach(d => g.connect(d));
    o.start(at); o.stop(at + attack + hold + release + 0.05);
  }
  // Percussion straight into the music's volume: a tick (band-passed noise), a kick (a sine
  // dropping fast) and a woodblock (a short high sine).
  function musicTick(at, vol, freq, dur) {
    const src = AC.createBufferSource(); src.buffer = noiseBuffer();
    const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 2600; f.Q.value = 1.2;
    const g = AC.createGain();
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + (dur || 0.06));
    src.connect(f); f.connect(g); g.connect(music.gain); src.start(at); src.stop(at + (dur || 0.06) + 0.01);
  }
  function musicKick(at, vol, hi, lo) {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(hi || 150, at); o.frequency.exponentialRampToValueAtTime(lo || 45, at + 0.12);
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
    o.connect(g); g.connect(music.gain); o.start(at); o.stop(at + 0.2);
  }
  function musicBlock(at, vol) { musicNote([music.gain], 1100, 'sine', at, 0.002, 0.01, 0.06, vol); musicTick(at, vol * 0.6, 4000, 0.02); }

  // The next melody note: mostly steps, a leap now and then; the last bar of eight ends on the root.
  function nextMelody(st, n, i, last) {
    const step = Math.random() < 0.2 ? (Math.random() < 0.5 ? -2 : 3) : (Math.random() < 0.55 ? 1 : -1);
    melodyIdx = clamp(melodyIdx + step, 0, st.scale.length - 1);
    if (n % 8 === 7 && i >= last) melodyIdx = st.root;
    return midiHz(st.scale[melodyIdx]);
  }

  function playBar(n, t) {
    const st = musicStyle(), bar = musicBarLen(), beat = bar / 4;
    const ch = st.chords[n % st.chords.length], pad = ch.slice(0, -1), bass = ch[ch.length - 1];
    const F = [music.filter], FE = [music.filter, music.echo];
    if (settings.track === 'tropical') {
      pad.forEach(p => musicNote(F, midiHz(p), 'sine', t, 0.1, bar - 0.3, 0.3, 0.04));
      // calypso bass: root, root (and of 2), fifth, octave (and of 4)
      [[0, 0], [1.5, 0], [2, 7], [3.5, 12]].forEach(([b, d]) => musicNote(F, midiHz(bass + d), 'triangle', t + b * beat, 0.01, 0.14, 0.2, 0.3));
      // chord skanks on the off-beats
      [0.5, 1.5, 2.5, 3.5].forEach(b => pad.forEach(p => musicNote(F, midiHz(p), 'triangle', t + b * beat, 0.005, 0.05, 0.1, 0.1)));
      // clave (son 3-2) on a woodblock, congas, shaker on sixteenths
      [0, 0.75, 1.5, 2.5, 3].forEach(b => musicBlock(t + b * beat, 0.35));
      [0, 2].forEach(b => musicKick(t + b * beat, 0.6, 220, 90)); musicKick(t + 2.5 * beat, 0.35, 320, 140);
      for (let i = 0; i < 16; i++) musicTick(t + i * beat / 4, i % 4 === 2 ? 0.1 : 0.05, 3000, 0.04);
      // steel-drum melody: bright, quick decay, with its octave
      for (let i = 0; i < 8; i++) {
        if (Math.random() < 0.25) continue;
        const f = nextMelody(st, n, i, 6), at = t + i * beat / 2;
        musicNote(FE, f, 'sine', at, 0.005, 0.02, 0.28, 0.28); musicNote(FE, f * 2, 'sine', at, 0.005, 0.01, 0.12, 0.12);
        if (Math.random() < 0.2) { musicNote(FE, f, 'sine', at + beat / 4, 0.005, 0.02, 0.2, 0.18); } // a quick roll
      }
    } else if (settings.track === 'misterio') {
      // shimmering pad: two slightly detuned sines per note, plus a high quiet fifth
      pad.forEach(p => { musicNote(F, midiHz(p), 'sine', t, 0.3, bar - 0.6, 0.4, 0.05, -7); musicNote(F, midiHz(p), 'sine', t, 0.3, bar - 0.6, 0.4, 0.05, 7); });
      musicNote(F, midiHz(pad[0] + 19), 'sine', t, 0.6, bar - 0.8, 0.5, 0.025);
      const sw = beat * 0.17; // swing: the off-beat eighths come a little late
      // plucked bass: root on 1 and 3, fifth on the swung "and" of 2 and 4
      [[0, 0], [1.5, 7], [2, 0], [3.5, 7]].forEach(([b, d]) => musicNote(F, midiHz(bass + d), 'triangle', t + b * beat + (b % 1 ? sw : 0), 0.005, 0.05, 0.25, 0.3));
      // light kick on 1, finger snaps on 2 and 4, swung hats
      musicKick(t, 0.5, 120, 50);
      [1, 3].forEach(b => musicTick(t + b * beat, 0.35, 1500, 0.04));
      for (let i = 0; i < 8; i++) musicTick(t + i * beat / 2 + (i % 2 ? sw : 0), i % 2 ? 0.1 : 0.05, 5000, 0.03);
      // xylophone melody, swung
      for (let i = 0; i < 8; i++) {
        if (Math.random() < 0.3) continue;
        const f = nextMelody(st, n, i, 6), at = t + i * beat / 2 + (i % 2 ? sw : 0);
        musicNote(FE, f, 'triangle', at, 0.005, 0.02, 0.22, 0.26); musicNote(FE, f * 3, 'sine', at, 0.005, 0.01, 0.08, 0.06);
      }
    } else if (settings.track === 'merengue') {
      // bouncing bass: root and fifth on every beat, octave pickup on the "and" of 4
      [[0, 0], [1, 7], [2, 0], [3, 7], [3.5, 12]].forEach(([b, d]) => musicNote(F, midiHz(bass + d), 'triangle', t + b * beat, 0.005, 0.08, 0.12, 0.3));
      // piano chords on the off-beats
      [0.5, 1.5, 2.5, 3.5].forEach(b => pad.forEach(p => musicNote(F, midiHz(p + 12), 'triangle', t + b * beat, 0.003, 0.04, 0.09, 0.07)));
      // tambora: low drum on 1 and 3, a slap on the "and" of 4
      [0, 2].forEach(b => musicKick(t + b * beat, 0.55, 190, 110));
      musicKick(t + 3.5 * beat, 0.35, 420, 260);
      // güira: a longer scrape on each beat and two short ones after it
      for (let b = 0; b < 4; b++) {
        musicTick(t + b * beat, 0.11, 6500, 0.09);
        musicTick(t + (b + 0.5) * beat, 0.06, 6500, 0.03);
        musicTick(t + (b + 0.75) * beat, 0.06, 6500, 0.03);
      }
      // accordion melody: two slightly detuned reeds, short and lively
      for (let i = 0; i < 8; i++) {
        if (Math.random() < 0.12) continue;
        const f = nextMelody(st, n, i, 6), at = t + i * beat / 2;
        musicNote(FE, f, 'square', at, 0.008, 0.06, 0.08, 0.06, -8); musicNote(FE, f, 'square', at, 0.008, 0.06, 0.08, 0.06, 8);
        if (i % 2 && Math.random() < 0.3) musicNote(FE, f, 'square', at + beat / 4, 0.006, 0.03, 0.06, 0.05); // a quick repeat
      }
    } else if (settings.track === 'bachata') {
      // syncopated bass: root on 1, fifth on the "and" of 2, octave on 3, back to the root on the "and" of 4
      [[0, 0], [1.5, 7], [2, 12], [3.5, 0]].forEach(([b, d]) => musicNote(F, midiHz(bass + d), 'sine', t + b * beat, 0.01, 0.15, 0.25, 0.38));
      // rhythm guitar: the chord picked one note at a time, on eighths
      for (let i = 0; i < 8; i++) musicNote(F, midiHz(pad[[0, 1, 2, 1][i % 4]] + 12), 'triangle', t + i * beat / 2, 0.003, 0.03, 0.18, 0.06);
      // bongo martillo: high and low drums on eighths, the open note on 4
      for (let i = 0; i < 8; i++) musicKick(t + i * beat / 2, i === 6 ? 0.3 : (i % 2 ? 0.12 : 0.2), i % 2 ? 520 : 400, i % 2 ? 420 : 300);
      // güira on eighths, a longer scrape on 4
      for (let i = 0; i < 8; i++) musicTick(t + i * beat / 2, i === 6 ? 0.12 : 0.06, 6000, i === 6 ? 0.12 : 0.035);
      // requinto (lead guitar): plucked, quick decay, with a grace note now and then
      for (let i = 0; i < 8; i++) {
        if (Math.random() < 0.3) continue;
        const f = nextMelody(st, n, i, 6), at = t + i * beat / 2;
        if (Math.random() < 0.2) musicNote(FE, f * 0.944, 'triangle', at - beat / 8, 0.003, 0.01, 0.05, 0.12);
        musicNote(FE, f, 'triangle', at, 0.003, 0.03, 0.3, 0.26); musicNote(FE, f * 2, 'sine', at, 0.003, 0.01, 0.1, 0.07);
      }
    } else { // fiesta
      pad.forEach(p => musicNote(F, midiHz(p), 'sine', t, 0.1, bar - 0.3, 0.3, 0.05));
      [0, 2].forEach(i => musicNote(F, midiHz(bass + (i ? 7 : 0)), 'triangle', t + i * beat, 0.01, 0.12, 0.18, 0.32));
      [1, 3].forEach(i => pad.forEach(p => musicNote(F, midiHz(p), 'triangle', t + i * beat, 0.01, 0.06, 0.12, 0.11)));
      [0, 2].forEach(i => musicKick(t + i * beat, 0.9));
      [1, 3].forEach(i => musicTick(t + i * beat, 0.5, 1800, 0.12));
      for (let i = 0; i < 8; i++) musicTick(t + i * beat / 2, i % 2 ? 0.12 : 0.06);
      for (let i = 0; i < 8; i++) {
        if (Math.random() < 0.15) continue;
        const f = nextMelody(st, n, i, 6);
        musicNote(FE, f, 'triangle', t + i * beat / 2, 0.01, 0.05, 0.3, i % 2 === 0 ? 0.24 : 0.15);
      }
    }
  }
  function scheduleMusic() {
    if (!music || !AC || AC.state !== 'running') return;
    try {
      const bar = musicBarLen();
      if (musicNextBar < AC.currentTime) musicNextBar = AC.currentTime + 0.1;
      while (musicNextBar < AC.currentTime + MUSIC_AHEAD) { playBar(musicBarNo++, musicNextBar); musicNextBar += bar; }
    } catch (e) { stopMusic(); }
  }
  function startMusic() {
    if (!settings.music || !settings.sound || music || !AC || document.hidden) return;
    try {
      const st = musicStyle(), t = AC.currentTime;
      const gain = AC.createGain(); gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(MUSIC_VOLUME, t + 1.5);
      const duck = AC.createGain(); duck.gain.value = 1;
      const filter = AC.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = st.filter; filter.Q.value = 0.5;
      const echo = AC.createDelay(1); echo.delayTime.value = musicBarLen() * st.echo;
      const feedback = AC.createGain(); feedback.gain.value = 0.3;
      const wet = AC.createGain(); wet.gain.value = 0.25;
      filter.connect(gain); echo.connect(feedback); feedback.connect(echo); echo.connect(wet); wet.connect(gain);
      gain.connect(duck); duck.connect(master);
      music = { gain, duck, filter, echo, feedback, wet };
      musicNextBar = t + 0.1; musicBarNo = 0; melodyIdx = Math.min(2, st.scale.length - 1);
      musicTimer = setInterval(scheduleMusic, 250);
      scheduleMusic();
    } catch (e) { music = null; }
  }
  function stopMusic() {
    clearInterval(musicTimer); musicTimer = 0;
    const m = music; music = null;
    if (!m) return;
    try {
      const g = m.gain.gain, t = AC.currentTime;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 1);
    } catch (e) { /* ignore */ }
    setTimeout(() => { [m.filter, m.echo, m.feedback, m.wet, m.gain, m.duck].forEach(n => { try { n.disconnect(); } catch (e) { /* ignore */ } }); }, 1100);
  }
  function duckMusic(secs) {
    if (!music) return;
    try {
      const g = music.duck.gain, t = AC.currentTime;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0.4, t + 0.1); g.setValueAtTime(0.4, t + secs); g.linearRampToValueAtTime(1, t + secs + 0.6);
    } catch (e) { /* ignore */ }
  }
  // Mid-range bell (fundamental 260-800 Hz): easier to hear with age-related high-frequency loss.
  function bell(freq, when, vol) {
    vol = vol || 0.35;
    tone(freq, 0.7, 'sine', vol, when);
    tone(freq * 2, 0.35, 'sine', vol * 0.22, when);
    tone(freq * 3, 0.18, 'triangle', vol * 0.06, when);
  }
  let lastWall = -Infinity, smashNo = 0;
  const click = (vol, when) => puff(vol, 3000, 0.03, when, 'highpass'); // the transient
  const thump = (vol, when) => glide(130, 60, 0.12, 'sine', vol, when);  // the weight
  const sfx = {
    // A brick: click + bell note (rising scale while the ball keeps hitting) + thump.
    brick() { click(0.35); bell(vary(SCALE[Math.min(noteIdx, SCALE.length - 1)], 0.15)); thump(0.3); noteIdx++; },
    // The paddle: G4 in the middle, A4 further out, C5 at the ends (in the music's key), with a pop.
    paddle(rel) {
      const f = vary(Math.abs(rel) < 1 / 3 ? 392 : Math.abs(rel) < 2 / 3 ? 440 : 523.25, 0.25);
      click(0.3); tone(f, 0.12, 'triangle', 0.4); tone(f / 2, 0.1, 'sine', 0.25); thump(0.35);
    },
    wall() { const now = performance.now(); if (now - lastWall < 40) return; lastWall = now; click(0.2); tone(vary(260), 0.07, 'triangle', 0.28); },
    launch() { click(0.2); tone(523.25, 0.1, 'sine', 0.25); tone(783.99, 0.12, 'sine', 0.25, 0.06); },
    net() { click(0.2); tone(330, 0.2, 'triangle', 0.28); thump(0.2); },
    miss() { glide(330, 220, 0.3, 'triangle', 0.28); glide(660, 440, 0.3, 'sine', 0.08); puff(0.2, 500, 0.25, 0.1); },
    cheer() { duckMusic(0.8); bell(523.25, 0, 0.3); bell(659.25, 0.12, 0.3); bell(783.99, 0.24, 0.3); },
    // Catching a capsule: a quick rising arpeggio with a sparkle on top.
    power() {
      duckMusic(1);
      [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { tone(f, 0.18, 'triangle', 0.3, i * 0.06); tone(f, 0.18, 'sine', 0.15, i * 0.06); });
      for (let i = 0; i < 5; i++) puff(0.12, 4000, 0.05, 0.3 + i * 0.05, 'highpass');
    },
    // The hero's entrance: a short brass fanfare ("da-da-da DAAA, da-DAAA") over a drum roll.
    fanfare() {
      duckMusic(2.4);
      const brass = (f, at, dur, vol) => { tone(f, dur, 'sawtooth', vol, at); tone(f / 2, dur, 'triangle', vol * 0.6, at); tone(f * 1.005, dur, 'sawtooth', vol * 0.5, at); };
      brass(392, 0, 0.14, 0.14); brass(392, 0.16, 0.14, 0.14); brass(392, 0.32, 0.14, 0.14); brass(523.25, 0.48, 0.55, 0.18);
      brass(659.25, 1.05, 0.14, 0.14); brass(783.99, 1.2, 0.8, 0.2);
      [523.25, 659.25, 783.99].forEach(f => tone(f, 0.9, 'sine', 0.08, 1.2));
      for (let i = 0; i < 14; i++) puff(0.12 + i * 0.01, 1500, 0.05, i * 0.035);
    },
    // The hero breaking bricks: crash, pum, pam, boom — a different mix each time.
    smash() {
      const v = smashNo++ % 4;
      thump(0.7); glide(90 + v * 20, 35, 0.35, 'sine', 0.6);          // boom
      puff(0.7, 700 + v * 200, 0.22);                                   // pum
      puff(0.45, 2200, 0.06, 0, 'highpass');                            // crash
      tone(vary(180 + v * 40, 1), 0.12, 'square', 0.18);                // pam
      if (v === 3) puff(0.5, 1200, 0.35, 0.05, 'bandpass');            // extra crash on every 4th
    },
    whoosh() { for (let i = 0; i < 6; i++) tone(180 + i * 60, 0.25, 'triangle', 0.12, i * 0.05); puff(0.3, 900, 0.4); },
    slurp() { glide(250, 520, 0.18, 'sine', 0.3); tone(620, 0.08, 'sine', 0.15, 0.18); click(0.15, 0.18); },
    shot() { click(0.3); glide(220, 440, 0.08, 'square', 0.1); puff(0.2, 1200, 0.08); },
    splat() { glide(180, 70, 0.18, 'sine', 0.35); puff(0.35, 600, 0.15); click(0.25); },
    crack() { click(0.4); tone(vary(330), 0.08, 'square', 0.12); puff(0.3, 900, 0.1); thump(0.3); },
    // Level clear: a fanfare (quick run up to a held high note over a C major chord), then a
    // short happy tune, and a final chord. About 5 s; the music steps back meanwhile.
    win() {
      duckMusic(5);
      for (let i = 0; i < 8; i++) puff(0.15, 1500, 0.05, i * 0.055); // drum roll
      [392, 523.25, 659.25, 783.99].forEach((f, i) => tone(f, 0.14, 'triangle', 0.3, i * 0.11));
      tone(1046.5, 0.9, 'triangle', 0.3, 0.46); tone(1046.5, 0.9, 'sine', 0.2, 0.46);
      [523.25, 659.25, 783.99].forEach(f => tone(f, 1.0, 'sine', 0.1, 0.46));
      const tune = [[783.99, 0], [783.99, 0.18], [880, 0.36], [1046.5, 0.54], [880, 0.78], [783.99, 0.96], [659.25, 1.2], [783.99, 1.44], [1046.5, 1.72]];
      tune.forEach(([f, d]) => { tone(f, 0.2, 'triangle', 0.26, 1.5 + d); tone(f / 2, 0.2, 'sine', 0.08, 1.5 + d); });
      [[523.25, 1.5], [392, 1.98], [440, 2.46], [349.23, 2.94]].forEach(([f, d]) => tone(f / 2, 0.45, 'triangle', 0.2, d));
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { bell(f, 3.4 + i * 0.1, 0.3); tone(f, 1.6, 'sine', 0.08, 3.4 + i * 0.1); });
    }
  };
  function buzz(p) { if (settings.vibration && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { /* ignore */ } } }

  // ---------------------------------------------------------------- physics
  const alive = () => bricks.filter(b => b.alive && !b.held);

  function fixVertical(b, sp) {
    // Avoid long, boring, nearly horizontal bounces.
    const minVy = 0.35 * sp;
    if (Math.abs(b.vy) < minVy) {
      b.vy = (b.vy < 0 ? -1 : 1) * minVy;
      b.vx = (b.vx < 0 ? -1 : 1) * Math.sqrt(sp * sp - minVy * minVy);
    }
  }

  function turnToward(b, tx, ty, maxTurn, sp) {
    const want = Math.atan2(ty - b.y, tx - b.x);
    const cur = Math.atan2(b.vy, b.vx);
    let diff = want - cur;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    const a = cur + clamp(diff, -maxTurn, maxTurn);
    b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
  }

  function steerAssist(b, dt, sp) {
    // When few bricks remain (or nothing hit for a while) the ball curves gently toward the nearest brick.
    const targets = alive().filter(k => k.y + k.h / 2 < b.y);
    if (!targets.length || b.vy >= 0) return;
    const stuck = sinceBrick > 12;
    if (!(stuck || alive().length <= 3)) return;
    let best = null, bd = Infinity;
    for (const k of targets) {
      const dx = k.x + k.w / 2 - b.x, dy = k.y + k.h / 2 - b.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = k; }
    }
    turnToward(b, best.x + best.w / 2, best.y + best.h / 2, (stuck ? 1.3 : 0.9) * dt, sp);
  }

  function magnetAssist(b, dt, sp) {
    // Magnet paddle: a ball coming down in the lower half is pulled toward the paddle — toward
    // the nearest part of it, not its middle, so a hit near an end still sends the ball out at an angle.
    if (!(power && power.type === 'multi') || b.vy <= 0 || b.y < H * 0.45) return;
    if (b.y > L.paddleY) return; // already below the paddle: let it go (pulling it back up left it crawling along the bottom)
    const half = paddle.w / 2 - b.r * 0.8;
    turnToward(b, clamp(b.x, paddle.x - half, paddle.x + half), L.paddleY, 2.2 * dt, sp);
  }

  function stepBalls(dt) {
    sinceBrick += dt;
    const sp = currentSpeed();
    for (const b of balls.slice()) {
      steerAssist(b, dt, sp);
      magnetAssist(b, dt, sp);
      const m = Math.hypot(b.vx, b.vy) || 1;
      b.vx = b.vx / m * sp; b.vy = b.vy / m * sp;
      const steps = Math.max(1, Math.ceil(sp * dt / (b.r * 0.4)));
      const sdt = dt / steps;
      for (let i = 0; i < steps && state === 'play' && balls.includes(b); i++) {
        b.x += b.vx * sdt; b.y += b.vy * sdt;
        collideWalls(b); collidePaddle(b, sp); collideBricks(b, sp); collideBottom(b);
      }
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 8) b.trail.shift();
    }
  }

  function collideWalls(b) {
    if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); sfx.wall(); }
    if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); sfx.wall(); }
    if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); sfx.wall(); }
  }

  function collidePaddle(b, sp) {
    const top = L.paddleY - L.paddleH / 2;
    if (b.vy > 0 && b.y + b.r >= top && b.y - b.r <= L.paddleY + L.paddleH / 2 &&
        Math.abs(b.x - paddle.x) <= paddle.w / 2 + b.r * 0.8) {
      const rel = clamp((b.x - paddle.x) / (paddle.w / 2), -1, 1);
      const ang = rel * 1.05; // up to ~60 degrees from vertical
      b.vx = Math.sin(ang) * sp; b.vy = -Math.cos(ang) * sp;
      b.y = top - b.r;
      noteIdx = 0; paddle.squish = 1;
      sfx.paddle(rel); buzz(10);
      const a = progress.adapt;
      a.streakHits = (a.streakHits || 0) + 1;
      if (a.streakHits % 6 === 0) a.speed = Math.min(1, a.speed + 0.03); // slowly back to normal
    }
  }

  function collideBricks(b, sp) {
    const fire = power && power.type === 'fire';
    for (const k of bricks) {
      if (!k.alive || k.held) continue;
      const nx = clamp(b.x, k.x, k.x + k.w), ny = clamp(b.y, k.y, k.y + k.h);
      const dx = b.x - nx, dy = b.y - ny;
      if (dx * dx + dy * dy > b.r * b.r) continue;
      if (fire) { destroyBrick(k); continue; } // fireball passes straight through, stone included
      const cx = k.x + k.w / 2, cy = k.y + k.h / 2;
      const ox = (k.w / 2 + b.r) - Math.abs(b.x - cx);
      const oy = (k.h / 2 + b.r) - Math.abs(b.y - cy);
      if (ox < oy) { b.vx = b.x < cx ? -Math.abs(b.vx) : Math.abs(b.vx); b.x += b.x < cx ? -ox : ox; }
      else { b.vy = b.y < cy ? -Math.abs(b.vy) : Math.abs(b.vy); b.y += b.y < cy ? -oy : oy; }
      fixVertical(b, sp);
      hitBrick(k);
      break;
    }
  }

  function collideBottom(b) {
    if (settings.safetyNet) {
      if (b.vy > 0 && b.y + b.r >= L.netY) {
        b.y = L.netY - b.r; b.vy = -Math.abs(b.vy); netFlash = 0.5; sfx.net();
      }
    } else if (b.y + b.r >= H) { // touched the bottom edge
      if (balls.length > 1) balls.splice(balls.indexOf(b), 1); // an extra ball: gone at once, no penalty
      else miss();
    }
  }

  // One hit on a brick: a stone brick cracks the first time, any other brick breaks.
  function hitBrick(k, at) {
    if (!k.alive) return;
    if (k.hp > 1) {
      k.hp--; sinceBrick = 0;
      const px = at ? at.x : k.x + k.w / 2, py = at ? at.y : k.y + k.h / 2;
      for (let i = 0; i < 5; i++) {
        particles.push({ x: px, y: py, vx: (Math.random() - 0.5) * W * 0.4, vy: -Math.random() * H * 0.2, s: 3 + Math.random() * 4, c: '#dfe5ea', t: 0, life: 0.6 });
      }
      sfx.crack(); buzz(10);
      return;
    }
    destroyBrick(k, at);
  }

  // Removes a brick with all the feedback. `at` = where the particles start (default: the brick).
  // `smash` = the hero did it: bigger burst and a crash instead of the bell.
  function destroyBrick(k, at, smash) {
    if (!k.alive) return;
    k.alive = false; k.held = false; destroyed++; sinceBrick = 0; sinceCapsule++;
    if (!at) dying.push({ b: k, t: 0 });
    const px = at ? at.x : k.x + k.w / 2, py = at ? at.y : k.y + k.h / 2;
    for (let i = 0; i < (smash ? 18 : 10); i++) {
      particles.push({
        x: px, y: py, vx: (Math.random() - 0.5) * W * (smash ? 1 : 0.6),
        vy: -Math.random() * H * (smash ? 0.5 : 0.3), s: 4 + Math.random() * (smash ? 8 : 5), c: k.color, t: 0, life: 0.8 + Math.random() * 0.4
      });
    }
    if (smash) { sfx.smash(); buzz(40); } else { sfx.brick(); buzz(15); }
    reveal = destroyed / total * 0.85;
    if (destroyed === total) { levelClear(); return; }
    const frac = destroyed / total;
    if (cheersGiven < 2 && frac >= (cheersGiven + 1) / 3) {
      cheersGiven++; floaters.push({ text: fmt(pick(T.cheers), { nick: T.nick }), t: 0, dur: 1.8 }); sfx.cheer();
    }
    maybeDropCapsule(k);
  }

  function miss() {
    const a = progress.adapt;
    a.speed = Math.max(0.65, a.speed - 0.08);
    a.paddle = Math.min(0.10, a.paddle + 0.025);
    a.streakHits = 0;
    saveProgress();
    sfx.miss();
    missTimer = 0.9;
    setState('missed');
  }

  function levelClear() {
    setState('clearing');
    reveal = 1;
    capsules = []; power = null; hero = null; frog = null; avocados = [];
    sfx.win(); buzz([30, 60, 30]);
    const PARTY = ['#ff6b9d', '#ffd84d', '#5ed6a0', '#4fb3ff', '#ff8a3d', '#b48bff', '#fff'];
    for (let i = 0; i < 170; i++) {
      const kind = Math.random();
      confetti.push({
        x: Math.random() * W, y: -Math.random() * H * 1.2, vy: H * (0.09 + Math.random() * 0.14),
        sway: Math.random() * 8, ph: Math.random() * 6, s: 8 + Math.random() * 12,
        c: pick(PARTY), heart: kind < 0.25, rect: kind > 0.6, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8,
        t: 0, life: 8 + Math.random() * 3
      });
    }
    for (let i = 0; i < 9; i++) {
      balloons.push({
        x: W * (0.08 + 0.84 * (i + Math.random() * 0.6) / 9), y: H + 60 + Math.random() * H * 0.5,
        vy: H * (0.07 + Math.random() * 0.05), sway: 10 + Math.random() * 14, ph: Math.random() * 6,
        s: clamp(W * 0.07, 22, 44) * (0.85 + Math.random() * 0.4), c: pick(PARTY.slice(0, 6)), t: 0
      });
    }
    progress.revealed++;
    if (currentPhoto) {
      progress.seen.push(currentPhoto.id);
      if (!progress.everShown.includes(currentPhoto.id)) progress.everShown.push(currentPhoto.id);
      progress.lastPhoto = currentPhoto.id;
    }
    progress.current = null;
    progress.level++;
    saveProgress();
  }

  function showComplete() {
    setState('complete');
    $('well').textContent = pick(T.wellDone);
    const cap = currentPhoto ? currentPhoto.caption : '';
    $('caption').textContent = cap; $('caption').style.display = cap ? '' : 'none';
    $('total').textContent = fmt(T.levelDone, { n: progress.level });
    $('complete').classList.add('show');
    requestAnimationFrame(() => { L.panelTop = $('panel').getBoundingClientRect().top; });
    setTimeout(() => $('panel').classList.add('show'), 500);
    setTimeout(() => $('next').classList.add('show'), 2200);
  }

  // ---------------------------------------------------------------- power-ups
  function nextPowerType() {
    if (DEBUG_POWER && POWER_TYPES.includes(DEBUG_POWER) && sinceCapsule < 99) { sinceCapsule = 99; return DEBUG_POWER; }
    if (!bag.length) { bag = POWER_TYPES.slice(); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; } }
    return bag.pop();
  }

  function maybeDropCapsule(k) {
    if (!settings.powerups || power || hero || frog || capsules.length) return;
    if (alive().length < 3) return; // the steering assist handles the end of a level
    const forced = DEBUG_POWER && destroyed === 1;
    if (!forced && (sinceCapsule < 2 || Math.random() > 0.7)) return;
    sinceCapsule = 0;
    const type = forced ? DEBUG_POWER : nextPowerType();
    capsules.push({ x: k.x + k.w / 2, y: k.y + k.h / 2, type, t: 0, face: type === 'hero' ? (faces.length ? pick(facesForPhoto()) : null) : null });
  }

  // The heroes that fit the photo behind the bricks: the grandchildren named in its caption.
  // If the caption names none of them, any grandchild can come.
  const plain = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function facesForPhoto() {
    const cap = ' ' + plain(currentPhoto && currentPhoto.caption).replace(/[^a-z0-9]+/g, ' ') + ' ';
    const named = faces.filter(f => f.name && cap.includes(' ' + plain(f.name).replace(/[^a-z0-9]+/g, ' ') + ' '));
    return named.length ? named : faces;
  }

  function stepCapsules(dt) {
    const r = L.ballR * 1.6, top = L.paddleY - L.paddleH / 2;
    for (const c of capsules.slice()) {
      c.t += dt;
      c.y += H * 0.16 * dt;
      c.x += (paddle.x - c.x) * Math.min(1, dt * 1.6); // drifts to the paddle by itself
      if (c.y + r >= top && c.y - r <= L.paddleY + L.paddleH && Math.abs(c.x - paddle.x) <= paddle.w / 2 + r) {
        capsules.splice(capsules.indexOf(c), 1);
        activatePower(c);
      } else if (c.y - r > H) {
        capsules.splice(capsules.indexOf(c), 1);
      }
    }
  }

  function activatePower(c) {
    sfx.power(); buzz([20, 40, 20]);
    let label = '';
    if (c.type === 'multi') {
      power = { type: 'multi', t: 0, dur: POWER_DUR.multi };
      const b = balls[0], sp = currentSpeed();
      const base = Math.atan2(b.vy, b.vx);
      [-0.5, 0.5].forEach(d => {
        const nb = newBall(); nb.x = b.x; nb.y = b.y;
        let a = base + d;
        nb.vx = Math.cos(a) * sp; nb.vy = Math.sin(a) * sp;
        if (nb.vy > -0.3 * sp) { nb.vy = -Math.abs(nb.vy) - 0.3 * sp; } // extra balls start going up
        balls.push(nb);
      });
      label = T.powerMulti;
    } else if (c.type === 'fire') {
      power = { type: 'fire', t: 0, dur: POWER_DUR.fire };
      label = T.powerFire;
    } else if (c.type === 'hero') {
      startHero(c.face); sfx.fanfare();
      label = c.face && c.face.name ? fmt(T.powerHero, { name: c.face.name }) : T.powerHeroNoName;
    } else if (c.type === 'frog') {
      frog = { t: 0, dur: POWER_DUR.frog, tongue: null, since: 0.4, eaten: 0, blink: 0 };
      label = T.powerFrog;
    } else if (c.type === 'cannon') {
      power = { type: 'cannon', t: 0, dur: POWER_DUR.cannon };
      cannonTimer = 0.3;
      label = T.powerCannon;
    }
    floaters.push({ text: label, t: 0, dur: 1.8 });
  }

  // --- avocado cannon: sits on the paddle and shoots an avocado every half second. Shots
  // lean toward the nearest brick, so he only has to be roughly under the bricks.
  function cannonAim() {
    const x0 = paddle.x, y0 = L.paddleY - L.paddleH;
    const list = alive();
    if (!list.length) return -Math.PI / 2;
    let best = null, bd = Infinity;
    for (const k of list) { const dx = k.x + k.w / 2 - x0, dy = k.y + k.h / 2 - y0, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = k; } }
    return clamp(Math.atan2(best.y + best.h / 2 - y0, best.x + best.w / 2 - x0), -Math.PI / 2 - 0.45, -Math.PI / 2 + 0.45);
  }

  function stepCannon(dt) {
    if (power && power.type === 'cannon') {
      // the barrel turns smoothly toward the nearest brick, then fires along it
      const want = cannonAim();
      cannonAng += (want - cannonAng) * Math.min(1, dt * 8);
      cannonTimer -= dt;
      if (cannonTimer <= 0) {
        cannonTimer = 0.5;
        const sp = H * 0.7, len = L.paddleH * 2.2;
        const x0 = paddle.x + Math.cos(cannonAng) * len, y0 = L.paddleY - L.paddleH * 1.1 + Math.sin(cannonAng) * len; // the muzzle
        avocados.push({ x: x0, y: y0, vx: Math.cos(cannonAng) * sp, vy: Math.sin(cannonAng) * sp, rot: Math.random() * 6, r: L.ballR * 0.9 });
        for (let i = 0; i < 6; i++) { // puff of smoke
          particles.push({ x: x0, y: y0, vx: Math.cos(cannonAng) * 60 + (Math.random() - 0.5) * 80, vy: Math.sin(cannonAng) * 60 - 20, s: 5 + Math.random() * 6, c: 'rgba(230,230,230,.8)', t: 0, life: 0.5 });
        }
        sfx.shot(); buzz(8);
      }
    }
    for (const a of avocados.slice()) {
      a.x += a.vx * dt; a.y += a.vy * dt; a.rot += dt * 6;
      let hit = null;
      for (const k of bricks) {
        if (!k.alive || k.held) continue;
        if (a.x + a.r > k.x && a.x - a.r < k.x + k.w && a.y + a.r > k.y && a.y - a.r < k.y + k.h) { hit = k; break; }
      }
      if (hit) {
        avocados.splice(avocados.indexOf(a), 1);
        for (let i = 0; i < 8; i++) particles.push({ x: a.x, y: a.y, vx: (Math.random() - 0.5) * W * 0.4, vy: -Math.random() * H * 0.2, s: 4 + Math.random() * 4, c: '#7cc242', t: 0, life: 0.6 });
        sfx.splat();
        hitBrick(hit, { x: a.x, y: a.y }); // a stone brick takes two avocados
      } else if (a.y < -a.r * 2 || a.x < -a.r || a.x > W + a.r) {
        avocados.splice(avocados.indexOf(a), 1);
      }
    }
  }

  function stepPower(dt) {
    if (!power) return;
    power.t += dt;
    if (power.t >= power.dur) {
      if (power.type === 'multi' && balls.length > 1) {
        // keep the ball that is highest (safest); the others fade away
        balls.sort((a, b) => a.y - b.y);
        balls.slice(1).forEach(b => ghosts.push({ x: b.x, y: b.y, r: b.r, t: 0 }));
        balls = [balls[0]];
      }
      power = null;
    }
  }

  // --- hero: a grandchild (photo head, cartoon body) flies up through the bricks
  function startHero(face) {
    const counts = new Array(COLS).fill(0);
    alive().forEach(k => { counts[brickCol(k)]++; });
    let best = 0;
    for (let c = 1; c < COLS; c++) if (counts[c] > counts[best]) best = c;
    const h = clamp(W * 0.3, 90, 170);
    hero = { col: best, x: L.side + best * (L.bw + L.gap) + L.bw / 2, y: H + h, h, phase: 'stand', t: 0, face, tilt: 0 };
  }

  function stepHero(dt) {
    if (!hero) return;
    hero.t += dt;
    const groundY = H - 8; // feet
    if (hero.phase === 'stand') {
      // pops up from the bottom and stands for a moment
      hero.y = groundY + hero.h * Math.max(0, 1 - hero.t / 0.35);
      if (hero.t > 1.2) { hero.phase = 'fly'; hero.t = 0; sfx.whoosh(); }
    } else {
      hero.y -= H * 0.55 * dt;
      hero.tilt = Math.sin(hero.t * 6) * 0.05;
      const top = hero.y - hero.h, half = hero.h * 0.32, hx = hero.x, hy = hero.y;
      for (const k of bricks) {
        if (!k.alive || k.held) continue;
        if (k.x < hx + half && k.x + k.w > hx - half && k.y + k.h > top && k.y < hy) destroyBrick(k, null, true);
        if (!hero) return; // that was the last brick: the level is over
      }
      if (hero.y < -10) hero = null;
    }
  }

  // --- frog: sits on the paddle and eats bricks with its tongue
  function frogPos() { return { x: paddle.x, y: L.paddleY - L.paddleH / 2 }; }

  function stepFrog(dt) {
    if (!frog) return;
    frog.t += dt; frog.blink = Math.max(0, frog.blink - dt);
    if (Math.random() < dt * 0.3) frog.blink = 0.15;
    const fp = frogPos();
    if (frog.tongue) {
      const tg = frog.tongue;
      tg.t += dt;
      if (tg.phase === 'out') {
        tg.k = Math.min(1, tg.t / 0.28);
        if (tg.k >= 1) { tg.phase = 'in'; tg.t = 0; tg.b.held = true; }
      } else {
        tg.k = Math.max(0, 1 - tg.t / 0.32);
        if (tg.k <= 0) {
          sfx.slurp();
          destroyBrick(tg.b, { x: fp.x, y: fp.y - L.paddleH * 1.2 });
          if (!frog) return; // that was the last brick: the level is over
          frog.eaten++; frog.tongue = null; frog.since = 0;
        }
      }
    } else {
      frog.since += dt;
      if (frog.since > 0.9 && frog.t < frog.dur) {
        const list = alive();
        if (list.length) {
          let best = null, bd = Infinity;
          for (const k of list) {
            const dx = k.x + k.w / 2 - fp.x, dy = k.y + k.h / 2 - fp.y, d = dx * dx + dy * dy * 0.6;
            if (d < bd) { bd = d; best = k; }
          }
          frog.tongue = { b: best, phase: 'out', t: 0, k: 0 };
        }
      }
    }
    if (frog && frog.t >= frog.dur + 1 && !frog.tongue) frog = null;
  }

  // ---------------------------------------------------------------- update
  function update(dt) {
    stateTime += dt;
    paddle.w = paddleWidth();
    if (AUTO && (state === 'play' || state === 'ready')) {
      const target = balls.filter(b => b.vy > 0).sort((a, b) => b.y - a.y)[0] || balls[0];
      paddle.tx = target.x + Math.sin(stateTime * 1.7) * paddle.w * 0.3;
    }
    paddle.tx = clamp(paddle.tx, paddle.w / 2, W - paddle.w / 2);
    paddle.x += (paddle.tx - paddle.x) * Math.min(1, dt * 20);
    paddle.x = clamp(paddle.x, paddle.w / 2, W - paddle.w / 2);
    paddle.squish = Math.max(0, paddle.squish - dt * 5);
    netFlash = Math.max(0, netFlash - dt);
    revealShown += (reveal - revealShown) * Math.min(1, dt * (state === 'clearing' ? 1.4 : 3));

    if (state === 'play' || state === 'ready') { levelTime += dt; moveBricks(levelTime); }
    if (state === 'ready' || state === 'title') {
      const b = balls[0];
      b.x = paddle.x; b.y = L.paddleY - L.paddleH / 2 - b.r - 1;
      if (state === 'ready') { launchTimer -= dt; if (launchTimer <= 0 || (AUTO && stateTime > 0.8)) launch(); }
    } else if (state === 'play') {
      if (freeze > 0) freeze -= dt;
      else { stepBalls(dt); stepCapsules(dt); stepPower(dt); stepHero(dt); stepFrog(dt); stepCannon(dt); }
    } else if (state === 'missed') {
      missTimer -= dt; if (missTimer <= 0) resetBall();
    } else if (state === 'clearing') {
      if (stateTime > 2.6) showComplete();
    } else if (state === 'complete' && AUTO && stateTime > 4) {
      nextLevel();
    }

    dying.forEach(d => { d.t += dt; }); dying = dying.filter(d => d.t < 0.3);
    particles.forEach(p => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += H * 1.2 * dt; });
    particles = particles.filter(p => p.t < p.life);
    // Messages show one at a time, in order (so two never sit on top of each other).
    if (floaters.length) { floaters[0].t += dt; if (floaters[0].t >= floaters[0].dur) floaters.shift(); }
    ghosts.forEach(g => { g.t += dt; }); ghosts = ghosts.filter(g => g.t < 0.6);
    confetti.forEach(c => { c.t += dt; c.y += c.vy * dt; c.x += Math.sin(c.ph + c.t * 1.5) * c.sway * dt * 10; c.rot += (c.vr || 0) * dt; });
    confetti = confetti.filter(c => c.t < c.life && c.y < H + 40);
    balloons.forEach(b => { b.t += dt; b.y -= b.vy * dt; b.x += Math.sin(b.ph + b.t * 1.2) * b.sway * dt; });
    balloons = balloons.filter(b => b.y > -b.s * 4);
  }

  // ---------------------------------------------------------------- render
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    if (!(w > 0) || !(h > 0)) return; // nothing to draw (e.g. the first frame, before sizes exist)
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function text(str, x, y, size, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.font = `800 ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.2; ctx.strokeStyle = 'rgba(20,10,35,.85)';
    ctx.strokeText(str, x, y);
    ctx.fillStyle = '#fffaf0'; ctx.fillText(str, x, y);
    ctx.restore();
  }

  function drawBackground() {
    if (!layers) { ctx.fillStyle = '#1b1430'; ctx.fillRect(0, 0, W, H); return; }
    if (revealShown >= 0.999) {
      ctx.drawImage(layers.sharp, 0, 0, W, H); // fully revealed: the full-size photo
    } else {
      // Rebuild the mix only when the reveal moved visibly (saves battery).
      if (Math.abs(revealShown - layers.compP) > 0.006) buildComposite(revealShown);
      ctx.drawImage(layers.comp, 0, 0, W, H);
    }
    // Darker band at the bottom so the paddle is always easy to see.
    if (state !== 'clearing') {
      const g = ctx.createLinearGradient(0, L.paddleY - H * 0.15, 0, H);
      g.addColorStop(0, 'rgba(10,6,24,0)'); g.addColorStop(1, 'rgba(10,6,24,.55)');
      ctx.fillStyle = g; ctx.fillRect(0, L.paddleY - H * 0.15, W, H);
    }
  }

  function drawBrickAt(x, y, w, h, color, alpha) {
    const r = Math.min(h * 0.3, 10);
    ctx.globalAlpha = alpha;
    rr(x, y, w, h, r); ctx.fillStyle = color; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(30,15,40,.6)'; ctx.stroke();
    rr(x + 4, y + 3, w - 8, h * 0.34, r * 0.7); ctx.fillStyle = 'rgba(255,255,255,.38)'; ctx.fill();
    ctx.globalAlpha = 1;
  }
  function drawBrick(b, scale, alpha) {
    const w = b.w * scale, h = b.h * scale;
    drawBrickAt(b.x + (b.w - w) / 2, b.y + (b.h - h) / 2, w, h, b.color, alpha);
  }

  // The paddle gets cooler every six levels: 1 wood, 2 chrome, 3 neon with lights, 4 gold with gems.
  const paddleTier = () => Math.floor((progress.level % LEVELS.length) / 6);
  function drawPaddle() {
    const sq = paddle.squish * 0.15;
    const w = paddle.w * (1 + sq * 0.3), h = L.paddleH * (1 - sq);
    const x = paddle.x - w / 2, y = L.paddleY - h / 2;
    const magnet = power && power.type === 'multi';
    const tier = magnet ? -1 : paddleTier(), now = performance.now() / 1000;
    const looks = [
      { stops: ['#fff7e0', '#ffc65c'], line: '#3a2410', glow: 'rgba(0,0,0,.5)', blur: 12 },
      { stops: ['#f4fdff', '#8fd8ea', '#2b8fae', '#5cc3dd'], line: '#0f3d4f', glow: 'rgba(120,220,255,.7)', blur: 16 },
      { stops: ['#ffd9f7', '#c07dff', '#6a2fb5'], line: '#3a1458', glow: 'rgba(255,120,230,.85)', blur: 20 },
      { stops: ['#fff6c9', '#ffd23a', '#c8900d', '#ffe27a'], line: '#5a3e00', glow: 'rgba(255,215,90,1)', blur: 24 + 8 * Math.sin(now * 4) }
    ];
    const lk = magnet ? { stops: ['#e8f6ff', '#6fc3ff'], line: '#17456b', glow: 'rgba(120,200,255,.9)', blur: 22 } : looks[tier];
    ctx.save();
    ctx.shadowColor = lk.glow; ctx.shadowBlur = lk.blur; ctx.shadowOffsetY = tier === 0 ? 4 : 0;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    lk.stops.forEach((c, i) => g.addColorStop(i / (lk.stops.length - 1), c));
    rr(x, y, w, h, h / 2); ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    rr(x, y, w, h, h / 2); ctx.lineWidth = 3; ctx.strokeStyle = lk.line; ctx.stroke();
    if (magnet) { // red/blue magnet tips
      ctx.fillStyle = '#ff5c5c'; rr(x, y, h * 0.9, h, h / 2); ctx.fill();
      rr(x + w - h * 0.9, y, h * 0.9, h, h / 2); ctx.fill();
      return;
    }
    if (tier === 1) { // chrome: a bright streak and darker metal caps
      ctx.fillStyle = 'rgba(255,255,255,.7)'; rr(x + h * 0.9, y + h * 0.18, w - h * 1.8, h * 0.16, h * 0.08); ctx.fill();
      ctx.fillStyle = '#1d6f8c'; rr(x, y, h * 0.8, h, h / 2); ctx.fill(); rr(x + w - h * 0.8, y, h * 0.8, h, h / 2); ctx.fill();
    } else if (tier === 2) { // neon: running lights along the paddle
      const n = Math.max(3, Math.floor(w / (h * 1.2)));
      for (let i = 0; i < n; i++) {
        const on = (Math.floor(now * 6) + i) % n < 2;
        ctx.fillStyle = on ? '#fff6ff' : 'rgba(255,255,255,.3)';
        ctx.beginPath(); ctx.arc(x + h * 0.7 + (w - h * 1.4) * i / (n - 1), y + h / 2, h * 0.14, 0, Math.PI * 2); ctx.fill();
      }
    } else if (tier === 3) { // gold: three gems and twinkling sparkles
      [0.25, 0.5, 0.75].forEach((f, i) => {
        const gx = x + w * f, gy = y + h / 2, r = h * 0.26;
        ctx.fillStyle = ['#3ea1ff', '#ff4d7a', '#3ee07a'][i];
        ctx.beginPath(); ctx.arc(gx, gy, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#5a3e00'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.arc(gx - r * 0.3, gy - r * 0.3, r * 0.3, 0, Math.PI * 2); ctx.fill();
      });
      for (let i = 0; i < 4; i++) {
        const k = (now * 1.5 + i * 0.37) % 1, sx = x + w * ((i * 0.23 + 0.1 + Math.floor(now * 1.5 + i * 0.37) * 0.31) % 0.9 + 0.05), sy = y - h * 0.3 - k * h * 0.6;
        const s = h * 0.25 * Math.sin(k * Math.PI);
        ctx.strokeStyle = '#fffbe0'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx - s, sy); ctx.lineTo(sx + s, sy); ctx.moveTo(sx, sy - s); ctx.lineTo(sx, sy + s); ctx.stroke();
      }
    }
  }

  function drawBall(b, alpha) {
    const fire = power && power.type === 'fire';
    b.trail.forEach((p, i) => {
      ctx.globalAlpha = alpha * (i + 1) / b.trail.length * (fire ? 0.6 : 0.25);
      ctx.beginPath(); ctx.arc(p.x, p.y, b.r * (fire ? 0.7 + 0.6 * i / b.trail.length : 0.5 + 0.5 * i / b.trail.length), 0, Math.PI * 2);
      ctx.fillStyle = fire ? (i % 2 ? '#ff8a2a' : '#ffd23a') : '#fff2b8'; ctx.fill();
    });
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = fire ? 'rgba(255,120,30,1)' : 'rgba(255,220,120,.95)'; ctx.shadowBlur = b.r * (fire ? 2.2 : 1.4);
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = fire ? '#fff1a8' : '#ffffff'; ctx.fill();
    ctx.restore();
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.lineWidth = 3; ctx.strokeStyle = fire ? '#b3400f' : '#1b1430'; ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawFaceOrSmiley(face, cx, cy, r) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
    if (face && face.img) ctx.drawImage(face.img, cx - r, cy - r, 2 * r, 2 * r);
    else {
      ctx.fillStyle = '#ffd9a8'; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
      ctx.fillStyle = '#5a3a1a';
      ctx.beginPath(); ctx.arc(cx - r * 0.35, cy - r * 0.15, r * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + r * 0.35, cy - r * 0.15, r * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = r * 0.12; ctx.strokeStyle = '#5a3a1a'; ctx.beginPath(); ctx.arc(cx, cy + r * 0.15, r * 0.4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.lineWidth = Math.max(2, r * 0.08); ctx.strokeStyle = '#fffaf0'; ctx.stroke();
  }

  function drawCapsule(c) {
    const r = L.ballR * 1.6, bob = Math.sin(c.t * 5) * 3;
    const x = c.x, y = c.y + bob;
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,.8)'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = { multi: '#6fc3ff', fire: '#ff8a2a', hero: '#ffd84d', frog: '#5ed6a0', cannon: '#f3e7a8' }[c.type]; ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = '#1b1430'; ctx.stroke();
    if (c.type === 'multi') {
      ctx.fillStyle = '#fff';
      [[-0.4, 0.15], [0.4, 0.15], [0, -0.35]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, r * 0.26, 0, Math.PI * 2); ctx.fill(); });
    } else if (c.type === 'fire') {
      ctx.fillStyle = '#ffe66b';
      ctx.beginPath(); ctx.moveTo(x, y - r * 0.65); ctx.quadraticCurveTo(x + r * 0.55, y - r * 0.05, x + r * 0.2, y + r * 0.5);
      ctx.quadraticCurveTo(x, y + r * 0.7, x - r * 0.2, y + r * 0.5); ctx.quadraticCurveTo(x - r * 0.55, y - r * 0.05, x, y - r * 0.65); ctx.fill();
    } else if (c.type === 'hero') {
      drawFaceOrSmiley(c.face, x, y, r * 0.78);
    } else if (c.type === 'cannon') {
      drawAvocado(x, y + r * 0.05, r * 0.6, -0.3);
    } else {
      drawFrogFace(x, y, r * 0.85, 0);
    }
  }

  function drawHero() {
    if (!hero) return;
    // Big head, short body (more comical): the head keeps its size, the body is 45% of it.
    const h = hero.h, hu = h / 10, u = hu * 0.45, headR = 1.7 * hu;
    const fly = hero.phase === 'fly';
    const pop = hero.phase === 'stand' ? Math.min(1, hero.t / 0.35) : 1;
    ctx.save();
    ctx.translate(hero.x, hero.y); // feet at (0,0), body goes up (negative y)
    ctx.rotate(fly ? -0.12 + hero.tilt : 0);
    ctx.scale(pop, pop);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const skin = '#f2c9a0', shirt = '#3b7bff', pants = '#2b3a67', cape = '#ff4d4d';
    const shoulderY = -6.5 * u, headY = -7 * u - headR * 0.85;
    // cape
    if (fly) {
      ctx.fillStyle = cape; ctx.beginPath();
      ctx.moveTo(-1.4 * u, -6.6 * u); ctx.lineTo(1.4 * u, -6.6 * u);
      ctx.lineTo(3.2 * u, -0.8 * u + Math.sin(hero.t * 14) * 0.5 * u); ctx.lineTo(-0.4 * u, -1.8 * u + Math.cos(hero.t * 12) * 0.5 * u); ctx.closePath(); ctx.fill();
    }
    // legs
    ctx.strokeStyle = pants; ctx.lineWidth = 1.2 * u;
    ctx.beginPath(); ctx.moveTo(-0.7 * u, -3.4 * u); ctx.lineTo(-0.8 * u, -0.5 * u); ctx.stroke(); // left leg straight
    ctx.beginPath(); ctx.moveTo(0.7 * u, -3.4 * u);
    if (fly) { ctx.lineTo(1.7 * u, -2.3 * u); ctx.lineTo(1.1 * u, -1.0 * u); } else ctx.lineTo(0.8 * u, -0.5 * u);
    ctx.stroke();
    // shoes
    ctx.fillStyle = '#5a2d0c';
    ctx.beginPath(); ctx.ellipse(-0.8 * u, -0.3 * u, 1.0 * u, 0.5 * u, 0, 0, Math.PI * 2); ctx.fill();
    if (fly) { ctx.beginPath(); ctx.ellipse(1.1 * u, -0.9 * u, 1.0 * u, 0.5 * u, -0.6, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.ellipse(0.8 * u, -0.3 * u, 1.0 * u, 0.5 * u, 0, 0, Math.PI * 2); ctx.fill(); }
    // torso (a little wider than tall-ish, for the chubby look)
    ctx.fillStyle = shirt; rr(-1.9 * u, -7 * u, 3.8 * u, 3.8 * u, 1.0 * u); ctx.fill();
    ctx.fillStyle = '#ffd84d'; ctx.beginPath(); ctx.arc(0, -5.3 * u, 0.65 * u, 0, Math.PI * 2); ctx.fill(); // emblem
    // arms
    ctx.strokeStyle = shirt; ctx.lineWidth = 1.0 * u;
    if (fly) {
      // arm raised out to the side (diagonal), so the fist shows clearly beside the big head
      ctx.beginPath(); ctx.moveTo(1.6 * u, shoulderY); ctx.lineTo(headR * 1.25, shoulderY - headR * 0.9); ctx.stroke();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(headR * 1.32, shoulderY - headR * 1.02, 0.75 * u, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-1.4 * u, shoulderY); ctx.lineTo(-2.0 * u, -3.4 * u); ctx.stroke();
      ctx.beginPath(); ctx.arc(-2.05 * u, -3.1 * u, 0.55 * u, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(1.5 * u, shoulderY); ctx.lineTo(2.1 * u, -3.3 * u); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-1.5 * u, shoulderY); ctx.lineTo(-2.1 * u, -3.3 * u); ctx.stroke();
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.arc(2.15 * u, -3.0 * u, 0.55 * u, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-2.15 * u, -3.0 * u, 0.55 * u, 0, Math.PI * 2); ctx.fill();
    }
    // head (photo), big
    drawFaceOrSmiley(hero.face, 0, headY, headR);
    ctx.restore();
    // speed lines when flying
    if (fly) {
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        const lx = hero.x + (i - 1) * u * 1.6, ly = hero.y + u * (1 + i * 0.6);
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, ly + u * 2.2); ctx.stroke();
      }
    }
  }

  function drawFrogFace(cx, cy, r, blink) {
    ctx.fillStyle = '#4cc36b';
    ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.07); ctx.strokeStyle = '#1f6b35'; ctx.stroke();
    [-0.5, 0.5].forEach(s => {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + s * r * 0.9, cy - r * 0.6, r * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1f6b35'; ctx.stroke();
      if (blink > 0) { ctx.strokeStyle = '#1f6b35'; ctx.beginPath(); ctx.moveTo(cx + s * r * 0.9 - r * 0.3, cy - r * 0.6); ctx.lineTo(cx + s * r * 0.9 + r * 0.3, cy - r * 0.6); ctx.stroke(); }
      else { ctx.fillStyle = '#1b1430'; ctx.beginPath(); ctx.arc(cx + s * r * 0.9, cy - r * 0.6, r * 0.18, 0, Math.PI * 2); ctx.fill(); }
    });
    ctx.fillStyle = '#ffb3b3'; // cheeks
    ctx.beginPath(); ctx.arc(cx - r * 0.7, cy + r * 0.15, r * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 0.7, cy + r * 0.15, r * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1f6b35'; ctx.lineWidth = Math.max(2, r * 0.08);
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.05, r * 0.5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }

  // A cartoon frog sitting on the paddle, seen from the front: round body with a pale belly,
  // bent hind legs out to the sides, little hands in front, and the big-eyed face on top.
  function drawFrog() {
    if (!frog) return;
    const fp = frogPos();
    const r = L.paddleH * 1.25 * FROG_SCALE; // head radius
    const baseY = fp.y;                    // where it sits
    const bodyCy = baseY - r * 0.9, headCy = baseY - r * 2.1;
    const mouthY = headCy + r * 0.15;
    const fade = frog.t > frog.dur ? Math.max(0, 1 - (frog.t - frog.dur)) : 1;
    const breathe = 1 + Math.sin(frog.t * 3) * 0.03;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const green = '#4cc36b', dark = '#1f6b35', belly = '#d9f5c4';
    // hind legs (thighs bent out, feet pointing outward)
    ctx.fillStyle = green; ctx.strokeStyle = dark; ctx.lineWidth = Math.max(2, r * 0.08);
    [-1, 1].forEach(s => {
      ctx.beginPath(); ctx.ellipse(fp.x + s * r * 1.25, baseY - r * 0.45, r * 0.6, r * 0.45, s * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); // foot with three toes
      ctx.moveTo(fp.x + s * r * 1.3, baseY - r * 0.1);
      for (let i = -1; i <= 1; i++) { ctx.lineTo(fp.x + s * (r * 1.95 + i * r * 0.1), baseY - r * 0.05 + i * r * 0.22); ctx.lineTo(fp.x + s * r * 1.3, baseY - r * 0.1); }
      ctx.fill(); ctx.stroke();
    });
    // body
    ctx.fillStyle = green;
    ctx.beginPath(); ctx.ellipse(fp.x, bodyCy, r * 1.05 * breathe, r * 0.95, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = belly;
    ctx.beginPath(); ctx.ellipse(fp.x, bodyCy + r * 0.12, r * 0.65 * breathe, r * 0.62, 0, 0, Math.PI * 2); ctx.fill();
    // hands in front
    ctx.fillStyle = green;
    [-1, 1].forEach(s => {
      ctx.beginPath(); ctx.ellipse(fp.x + s * r * 0.55, baseY - r * 0.2, r * 0.32, r * 0.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
    // head, then the open mouth, then the tongue on top of everything so it clearly leaves the mouth
    drawFrogFace(fp.x, headCy, r, frog.blink);
    if (frog.tongue) {
      ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(fp.x, mouthY, r * 0.34, r * 0.26, 0, 0, Math.PI * 2); ctx.fill();
      const tg = frog.tongue, b = tg.b;
      const tx = fp.x + (b.x + b.w / 2 - fp.x) * tg.k, ty = mouthY + (b.y + b.h / 2 - mouthY) * tg.k;
      ctx.strokeStyle = '#ff6f91'; ctx.lineWidth = Math.max(4, r * 0.3);
      ctx.beginPath(); ctx.moveTo(fp.x, mouthY); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.fillStyle = '#ff6f91'; ctx.beginPath(); ctx.arc(tx, ty, Math.max(5, r * 0.32), 0, Math.PI * 2); ctx.fill();
      if (tg.phase === 'in') { // the brick travels back on the tongue, shrinking
        const s = 0.3 + 0.7 * tg.k;
        drawBrickAt(tx - b.w * s / 2, ty - b.h * s / 2, b.w * s, b.h * s, b.color, 1);
      }
    }
    ctx.restore();
  }

  // An avocado: dark green pear shape with a lighter highlight (whole fruit, seen from outside).
  function drawAvocado(x, y, r, rot) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot || 0);
    ctx.fillStyle = '#2f6b2a';
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.1);
    ctx.bezierCurveTo(r * 0.6, -r * 1.1, r * 1.0, -r * 0.2, r * 0.95, r * 0.35);
    ctx.bezierCurveTo(r * 0.85, r * 1.0, -r * 0.85, r * 1.0, -r * 0.95, r * 0.35);
    ctx.bezierCurveTo(-r * 1.0, -r * 0.2, -r * 0.6, -r * 1.1, 0, -r * 1.1);
    ctx.closePath(); ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * 0.12); ctx.strokeStyle = '#17401a'; ctx.stroke();
    ctx.fillStyle = 'rgba(190,230,120,.55)';
    ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.1, r * 0.22, r * 0.5, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6b4a1f'; ctx.beginPath(); ctx.ellipse(0, -r * 1.05, r * 0.14, r * 0.2, 0, 0, Math.PI * 2); ctx.fill(); // stem
    ctx.restore();
  }

  // A cartoon pirate cannon: a wooden carriage with two wheels fixed on the paddle, and a black
  // barrel with bands that tilts toward where the next avocado goes. The barrel kicks back
  // on each shot and the fuse keeps sparking.
  function drawCannon() {
    if (!(power && power.type === 'cannon')) return;
    const u = L.paddleH, x = paddle.x, y = L.paddleY - L.paddleH / 2; // y = top of the paddle
    const kick = cannonTimer > 0.4 ? (cannonTimer - 0.4) / 0.1 : 0;  // recoil just after a shot
    const now = performance.now() / 1000;
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // carriage (wood)
    ctx.fillStyle = '#9a5a2a'; ctx.strokeStyle = '#4a2a0c'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-1.2 * u, -0.1 * u); ctx.lineTo(1.2 * u, -0.1 * u); ctx.lineTo(0.9 * u, -0.9 * u); ctx.lineTo(-0.9 * u, -0.9 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(74,42,12,.5)'; ctx.lineWidth = 1.5; // wood grain
    ctx.beginPath(); ctx.moveTo(-0.8 * u, -0.5 * u); ctx.lineTo(0.8 * u, -0.5 * u); ctx.stroke();
    // wheels
    [-0.75, 0.75].forEach(s => {
      const wx = s * u, wy = -0.1 * u, r = 0.38 * u;
      ctx.fillStyle = '#6b3d14'; ctx.strokeStyle = '#3a1f06'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(wx, wy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#c98a4a'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3 + now * 2 * s; ctx.beginPath(); ctx.moveTo(wx - Math.cos(a) * r * 0.8, wy - Math.sin(a) * r * 0.8); ctx.lineTo(wx + Math.cos(a) * r * 0.8, wy + Math.sin(a) * r * 0.8); ctx.stroke(); }
      ctx.fillStyle = '#3a1f06'; ctx.beginPath(); ctx.arc(wx, wy, r * 0.22, 0, Math.PI * 2); ctx.fill();
    });
    // barrel, turning around the trunnion on the carriage
    ctx.translate(0, -0.6 * u);
    ctx.rotate(cannonAng + Math.PI / 2); // 0 = straight up
    ctx.translate(0, kick * 0.35 * u);   // recoil along the barrel
    const len = 1.9 * u, wb = 0.55 * u, wm = 0.42 * u; // length, width at the breech, at the muzzle
    const g = ctx.createLinearGradient(-wb, 0, wb, 0); g.addColorStop(0, '#2a2a33'); g.addColorStop(0.4, '#6a6a78'); g.addColorStop(1, '#1b1b22');
    ctx.fillStyle = g; ctx.strokeStyle = '#111118'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-wb, 0.35 * u); ctx.lineTo(wb, 0.35 * u); ctx.lineTo(wm, -len); ctx.lineTo(-wm, -len); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#8a8a99'; // bands and the muzzle rim
    [[0.05, wb * 0.95], [-0.6, wb * 0.8], [-len / u + 0.18, wm * 1.15]].forEach(([yy, hw]) => { rr(-hw, yy * u - 0.09 * u, hw * 2, 0.18 * u, 0.05 * u); ctx.fill(); ctx.stroke(); });
    ctx.fillStyle = '#111118'; ctx.beginPath(); ctx.ellipse(0, -len, wm * 0.75, 0.12 * u, 0, 0, Math.PI * 2); ctx.fill(); // the bore
    ctx.fillStyle = '#2a2a33'; ctx.beginPath(); ctx.arc(0, 0.5 * u, 0.2 * u, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); // breech knob
    // fuse with a spark
    ctx.strokeStyle = '#d9b36b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0.1 * u, 0.1 * u); ctx.quadraticCurveTo(0.6 * u, 0.4 * u, 0.7 * u, 0.9 * u); ctx.stroke();
    const sp = 0.09 * u * (1 + 0.5 * Math.sin(now * 25));
    ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(0.7 * u, 0.9 * u, sp * 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(0.7 * u, 0.9 * u, sp, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawConfetti() {
    confetti.forEach(c => {
      ctx.globalAlpha = clamp((c.life - c.t) / 1.5, 0, 1) * 0.9;
      ctx.fillStyle = c.c;
      if (c.heart) {
        ctx.font = `${c.s * 1.6}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('♥', c.x, c.y);
      } else if (c.rect) {
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot);
        ctx.fillRect(-c.s * 0.6, -c.s * 0.25, c.s * 1.2, c.s * 0.5); ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(c.x, c.y, c.s / 2, 0, Math.PI * 2); ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  }

  function drawBalloons() {
    balloons.forEach(b => {
      const s = b.s, tilt = Math.sin(b.ph + b.t * 1.2) * 0.12;
      ctx.save();
      ctx.translate(b.x, b.y); ctx.rotate(tilt);
      // string
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, s * 1.3);
      ctx.quadraticCurveTo(Math.sin(b.t * 3) * s * 0.4, s * 2.4, Math.cos(b.t * 2) * s * 0.3, s * 3.6); ctx.stroke();
      // knot
      ctx.fillStyle = b.c; ctx.beginPath(); ctx.moveTo(-s * 0.18, s * 1.42); ctx.lineTo(s * 0.18, s * 1.42); ctx.lineTo(0, s * 1.15); ctx.closePath(); ctx.fill();
      // body
      ctx.beginPath(); ctx.ellipse(0, 0, s, s * 1.22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(30,15,40,.45)'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(-s * 0.35, -s * 0.45, s * 0.22, s * 0.38, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  }

  // A stone brick: grey rounded block with light speckles. After the first hit it shows cracks.
  function drawStone(b, alpha) {
    const x = b.x, y = b.y, w = b.w, h = b.h, r = Math.min(h * 0.3, 10);
    ctx.globalAlpha = alpha;
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#c9d0d7'); g.addColorStop(1, '#8a939e');
    rr(x, y, w, h, r); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(30,15,40,.6)'; ctx.stroke();
    rr(x + 4, y + 3, w - 8, h * 0.3, r * 0.7); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fill();
    ctx.fillStyle = 'rgba(40,40,60,.22)';
    [[0.2, 0.6], [0.45, 0.4], [0.7, 0.7], [0.85, 0.35], [0.3, 0.8]].forEach(([fx, fy], i) => {
      ctx.beginPath(); ctx.arc(x + w * fx, y + h * fy, 1.5 + ((b.col + b.row + i) % 3) * 0.8, 0, Math.PI * 2); ctx.fill();
    });
    if (b.hp === 1) { // cracked
      ctx.strokeStyle = 'rgba(35,25,45,.85)'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(x + w * 0.15, y + h * 0.1); ctx.lineTo(x + w * 0.35, y + h * 0.45); ctx.lineTo(x + w * 0.28, y + h * 0.7); ctx.lineTo(x + w * 0.5, y + h * 0.95); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + w * 0.35, y + h * 0.45); ctx.lineTo(x + w * 0.6, y + h * 0.3); ctx.lineTo(x + w * 0.85, y + h * 0.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + w * 0.6, y + h * 0.3); ctx.lineTo(x + w * 0.68, y + h * 0.05); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawPolaroid() {
    const src = photoSrc; if (!src) return;
    const k = clamp(stateTime / 0.8, 0, 1), e = 1 - Math.pow(1 - k, 3);
    const top = Math.max(H * 0.04, 20), bottom = (L.panelTop || H * 0.62) - 18;
    const boxW = W * 0.9, boxH = Math.max(80, bottom - top);
    const iw = srcW(src), ih = srcH(src);
    const border = Math.min(boxW, boxH) * 0.035, extra = border * 1.5;
    const s = Math.min((boxW - 2 * border) / iw, (boxH - 2 * border - extra) / ih);
    const pw = iw * s, ph = ih * s, fw = pw + 2 * border, fh = ph + 2 * border + extra;
    ctx.save();
    ctx.globalAlpha = e;
    ctx.translate(W / 2, top + boxH / 2);
    ctx.rotate(-0.025 * e);
    ctx.scale(0.9 + 0.1 * e, 0.9 + 0.1 * e);
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#fffdf7'; ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
    ctx.shadowColor = 'transparent';
    ctx.drawImage(src, -fw / 2 + border, -fh / 2 + border, pw, ph);
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    if (state === 'complete') {
      if (layers) ctx.drawImage(layers.heavy, 0, 0, W, H);
      drawBalloons(); drawPolaroid(); drawConfetti();
      return;
    }
    drawBackground();
    if (state !== 'title' && state !== 'clearing') text(`Nivel ${progress.level + 1}`, W * 0.14, L.top * 0.45, clamp(W * 0.055, 16, 26), 0.85);
    bricks.forEach(b => { if (b.alive && !b.held) { if (b.stone) drawStone(b, 0.96); else drawBrick(b, 1, 0.94); } });
    dying.forEach(d => drawBrick(d.b, 1 + d.t * 1.2, Math.max(0, 1 - d.t / 0.3)));
    particles.forEach(p => {
      ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1);
      ctx.fillStyle = p.c; ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    });
    ctx.globalAlpha = 1;
    capsules.forEach(drawCapsule);
    if (settings.safetyNet && state !== 'clearing') {
      ctx.fillStyle = `rgba(158,231,196,${0.45 + netFlash})`;
      rr(W * 0.02, L.netY, W * 0.96, 6, 3); ctx.fill();
    }
    if (state !== 'clearing') { drawPaddle(); drawCannon(); }
    avocados.forEach(a => drawAvocado(a.x, a.y, a.r, a.rot));
    drawFrog();
    ghosts.forEach(g => {
      ctx.globalAlpha = 1 - g.t / 0.6; ctx.beginPath(); ctx.arc(g.x, g.y, g.r * (1 + g.t), 0, Math.PI * 2);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
    });
    if (state === 'ready' || state === 'title') drawBall(balls[0], state === 'ready' ? clamp(stateTime * 3, 0, 1) : 1);
    else if (state === 'play' || state === 'paused') balls.forEach(b => drawBall(b, freeze > 0 ? 0.6 + 0.4 * Math.sin(stateTime * 12) : 1));
    drawHero();
    if (state === 'ready') {
      const pulse = 0.65 + 0.35 * Math.sin(stateTime * 4);
      text(T.tapToLaunch, W / 2, L.paddleY - H * 0.13, Math.min(W * 0.085, 42), pulse);
      if (showMoveHint) text(T.moveHint, W / 2, L.paddleY + H * 0.065, Math.min(W * 0.065, 32), 0.9);
    }
    if (floaters.length) {
      const f = floaters[0], k = f.t / f.dur, pop = Math.min(1, f.t / 0.25);
      let size = Math.min(W * 0.13, 70);
      ctx.font = `800 ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
      const tw = ctx.measureText(f.text).width;
      if (tw > W * 0.92) size *= W * 0.92 / tw; // long messages shrink to fit the screen
      text(f.text, W / 2, H * 0.58 - k * H * 0.06, size * (0.7 + 0.3 * pop), Math.min(1, (1 - k) * 2.5));
    }
    drawBalloons();
    drawConfetti();
  }

  // ---------------------------------------------------------------- loop
  let last = performance.now(), errors = 0;
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    // An error inside one frame must never stop the game: log it and go on with the next frame.
    try {
      if (state !== 'paused' && state !== 'boot') update(dt);
      render();
    } catch (e) {
      if (errors++ < 5) console.error(e);
      if (errors > 60 && state === 'play') resetBall(); // something is stuck: start the ball again
    }
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- input
  cv.addEventListener('pointerdown', e => {
    audioInit();
    // Mouse click / trackpad tap while playing pauses (computer only; a finger on the phone just moves the paddle).
    if (e.pointerType === 'mouse' && state === 'play' && freeze <= 0) { pause(); return; }
    paddle.tx = e.clientX;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (state === 'ready' && stateTime > 0.3) launch();
  });
  cv.addEventListener('pointermove', e => { paddle.tx = e.clientX; });
  document.addEventListener('keydown', e => {
    if (e.key !== ' ' && e.key !== 'Escape') return;
    // typing in a visible text field (password, menu) must not pause the game
    if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.target.offsetParent !== null) return;
    if ($('menu').classList.contains('show') || $('gallery').classList.contains('show')) return;
    e.preventDefault();
    if (state === 'paused') resume();
    else if (state === 'play') pause();
    else if (state === 'ready' && e.key === ' ') launch();
  });

  // ---------------------------------------------------------------- screens
  function updateTitle() {
    // the game's name as a logo, one brick color per letter
    const logo = $('logo');
    if (logo && !logo.childElementCount) {
      [...String(CFG.title || 'Arkanietos').toUpperCase()].forEach((ch, i) => {
        const sp = document.createElement('span'); sp.textContent = ch; sp.style.color = COLORS[i % COLORS.length];
        logo.appendChild(sp);
      });
    }
    const name = (settings.playerName || '').trim();
    $('greet').textContent = name ? fmt(T.hello, { name }) : fmt(T.hello, { name: '' }).replace(/,\s*!/, '!');
    $('count').textContent = progress.level > 0 ? fmt(T.nextLevel, { n: progress.level + 1 }) : '';
    $('play').textContent = T.play;
    $('next').textContent = T.next;
    $('pause-text').textContent = T.tapToContinue;
    document.title = CFG.title || 'Arkanietos';
  }

  let wakeLock = null;
  async function keepAwake() {
    try {
      if ('wakeLock' in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } catch (e) { /* not supported */ }
  }
  function goFullscreen() {
    const standalone = window.matchMedia && matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
    const d = document.documentElement;
    if (!standalone && !document.fullscreenElement && d.requestFullscreen) {
      d.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    }
    try { screen.orientation.lock('portrait').catch(() => {}); } catch (e) { /* ignore */ }
  }

  $('play').addEventListener('click', () => {
    audioInit(); goFullscreen(); keepAwake();
    $('title').classList.remove('show');
    try { history.pushState({ game: 1 }, ''); } catch (e) { /* ignore */ }
    resetBall();
  });

  function nextLevel() {
    $('complete').classList.remove('show');
    $('panel').classList.remove('show');
    $('next').classList.remove('show');
    setState('boot');
    // a different track for the new level (the choice in the menu stays the one used at start-up)
    const others = Object.keys(MUSIC_STYLES).filter(k => k !== settings.track);
    settings.track = pick(others);
    if (music) { stopMusic(); startMusic(); }
    prepareLevel().then(resetBall);
  }
  $('next').addEventListener('click', () => { audioInit(); nextLevel(); });

  function pause() {
    if (['ready', 'play', 'missed'].includes(state)) {
      prevState = state; setState('paused');
      $('pause').classList.add('show');
      stopMusic();
    }
  }
  function resume() {
    $('pause').classList.remove('show');
    audioInit(); keepAwake(); // audioInit also restarts the music
    if (prevState === 'play') { setState('play'); freeze = 1.0; } // short breather, then the ball goes on
    else resetBall();
  }
  $('pause').addEventListener('click', resume);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause(); stopMusic(); }
    else { if (state !== 'title') keepAwake(); if (AC) startMusic(); }
  });
  // Android back button: pause instead of closing the game by accident.
  window.addEventListener('popstate', () => {
    if (['ready', 'play', 'missed', 'paused'].includes(state)) {
      pause();
      try { history.pushState({ game: 1 }, ''); } catch (e) { /* ignore */ }
    }
  });
  window.addEventListener('resize', resize);

  // ---------------------------------------------------------------- caregiver menu
  let pressTimer = null;
  const greet = $('greet');
  greet.addEventListener('pointerdown', () => { pressTimer = setTimeout(openMenu, 3000); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => greet.addEventListener(ev, () => clearTimeout(pressTimer)));
  greet.addEventListener('contextmenu', e => e.preventDefault());

  async function renderMenuPhotos() {
    const folderCount = pool.filter(p => p.kind === 'folder').length;
    $('m-folder').textContent = !vault ? 'No hay fotos de la familia en el servidor.'
      : photoKey ? `Fotos de la familia (del servidor): ${folderCount}. Caras para el superhéroe: ${faces.length}.`
      : 'Las fotos de la familia están bloqueadas: falta la contraseña. Vuelve a abrir el juego para escribirla.';
    $('m-forget').style.display = vault && photoKey ? '' : 'none';
    const wrap = $('m-photos'); wrap.innerHTML = '';
    const recs = await db.all();
    recs.sort((a, b) => (a.added || 0) - (b.added || 0));
    recs.forEach(r => {
      const d = document.createElement('div'); d.className = 'thumb';
      const img = document.createElement('img'); img.src = deviceUrls[r.id] || URL.createObjectURL(r.blob); img.alt = '';
      const inp = document.createElement('input'); inp.type = 'text'; inp.value = r.caption || ''; inp.placeholder = 'Texto (opcional)';
      inp.addEventListener('change', async () => {
        r.caption = inp.value.trim(); await db.put(r);
        const p = pool.find(x => x.id === r.id); if (p) p.caption = r.caption;
      });
      const del = document.createElement('button'); del.textContent = 'Quitar';
      del.addEventListener('click', async () => {
        if (!confirm('¿Quitar esta foto del juego?')) return;
        await db.del(r.id);
        if (deviceUrls[r.id]) { URL.revokeObjectURL(deviceUrls[r.id]); delete deviceUrls[r.id]; }
        menuChanged = true; await loadPool(); renderMenuPhotos();
      });
      d.append(img, inp, del); wrap.append(d);
    });
    $('m-progress').textContent = `Nivel ${progress.level + 1}. Fotos descubiertas: ${progress.revealed}.`;
  }

  let menuChanged = false;
  function openMenu() {
    if (['ready', 'play', 'missed'].includes(state)) pause();
    $('m-name').value = settings.playerName || '';
    $('m-speed').value = settings.speed; $('m-paddle').value = settings.paddle;
    $('m-net').checked = !!settings.safetyNet; $('m-sound').checked = !!settings.sound; $('m-vibe').checked = !!settings.vibration;
    $('m-power').checked = !!settings.powerups; $('m-music').checked = !!settings.music; $('m-track').value = settings.track;
    $('m-status').textContent = ''; menuChanged = false;
    $('m-version').textContent = 'Versión ' + VERSION + (FILTER_OK ? '' : ' · desenfoque alternativo');
    $('menu').classList.add('show');
    renderMenuPhotos();
  }
  // The gear buttons on the start, pause and level-complete screens open the menu.
  ['gear-title', 'gear-pause', 'gear-complete'].forEach(id => { const b = $(id); if (b) b.addEventListener('click', e => { e.stopPropagation(); audioInit(); openMenu(); }); });

  // --- gallery of the photos discovered so far
  const galleryUrls = {};
  async function photoUrlFor(entry) {
    if (!entry.enc) return entry.src;
    if (!galleryUrls[entry.id]) {
      const bytes = await fetchDecrypted(entry.src);
      galleryUrls[entry.id] = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
    }
    return galleryUrls[entry.id];
  }
  async function openGallery() {
    const wrap = $('g-grid'); wrap.innerHTML = '';
    const ids = progress.everShown.slice().reverse(); // newest first
    const entries = ids.map(id => pool.find(p => p.id === id)).filter(Boolean);
    $('g-title').textContent = `Fotos descubiertas: ${entries.length}`;
    $('gallery').classList.add('show');
    for (const e of entries) {
      const d = document.createElement('div'); d.className = 'g-item';
      const img = document.createElement('img'); img.alt = '';
      const cap = document.createElement('div'); cap.className = 'g-cap'; cap.textContent = e.caption || '';
      d.append(img, cap); wrap.append(d);
      d.addEventListener('click', async () => {
        $('v-img').src = await photoUrlFor(e); $('v-cap').textContent = e.caption || '';
        $('viewer').classList.add('show');
      });
      try { img.src = await photoUrlFor(e); } catch (err) { d.remove(); }
      if (!$('gallery').classList.contains('show')) return; // closed meanwhile
    }
  }
  $('m-gallery').addEventListener('click', openGallery);
  $('g-close').addEventListener('click', () => $('gallery').classList.remove('show'));
  $('viewer').addEventListener('click', () => $('viewer').classList.remove('show'));

  function fileToRecord(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * s), h = Math.round(img.naturalHeight * s);
        const c = mk(w, h); c.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        c.toBlob(b => b ? res({
          id: 'd:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
          caption: captionFromName(file.name), blob: b, added: Date.now()
        }) : rej(new Error('encode')), 'image/jpeg', 0.86);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('decode')); };
      img.src = url;
    });
  }

  $('m-add').addEventListener('click', () => $('m-file').click());
  $('m-file').addEventListener('change', async e => {
    const files = [...e.target.files]; e.target.value = '';
    if (!files.length) return;
    let ok = 0, bad = 0;
    $('m-status').textContent = 'Guardando fotos…';
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (err) { /* ignore */ }
    for (const f of files) {
      try { await db.put(await fileToRecord(f)); ok++; } catch (err) { bad++; }
      $('m-status').textContent = `Guardando fotos… ${ok + bad} de ${files.length}`;
    }
    $('m-status').textContent = `Listo: ${ok} foto(s) añadida(s)` + (bad ? `, ${bad} no se pudieron leer.` : '.');
    menuChanged = true; await loadPool(); renderMenuPhotos();
  });

  $('m-forget').addEventListener('click', () => {
    if (!confirm('¿Olvidar la contraseña en este aparato? El juego la pedirá la próxima vez.')) return;
    try { localStorage.removeItem(keySlot()); } catch (e) { /* ignore */ }
    photoKey = null; menuChanged = true;
    $('m-status').textContent = 'Contraseña olvidada. Se pedirá al abrir el juego.';
    renderMenuPhotos();
  });

  $('m-skip').addEventListener('click', async () => {
    progress.lastPhoto = progress.current; progress.current = null;
    if (progress.lastPhoto) progress.seen.push(progress.lastPhoto);
    saveProgress(); menuChanged = true;
    $('m-status').textContent = 'La foto cambiará al volver.';
  });

  $('m-reset').addEventListener('click', () => {
    if (!confirm('¿Reiniciar el progreso? Las fotos no se borran.')) return;
    progress = JSON.parse(JSON.stringify(DEFAULT_PROGRESS)); saveProgress(); menuChanged = true;
    renderMenuPhotos();
  });

  $('m-close').addEventListener('click', async () => {
    settings.playerName = $('m-name').value.trim();
    settings.speed = $('m-speed').value; settings.paddle = $('m-paddle').value;
    settings.safetyNet = $('m-net').checked; settings.sound = $('m-sound').checked; settings.vibration = $('m-vibe').checked;
    settings.powerups = $('m-power').checked; settings.music = $('m-music').checked;
    const trackChanged = settings.track !== $('m-track').value;
    settings.track = $('m-track').value;
    saveSettings();
    if (!settings.music || !settings.sound || trackChanged) stopMusic();
    if (settings.music && settings.sound && AC && state !== 'paused') startMusic();
    $('menu').classList.remove('show');
    updateTitle();
    if (menuChanged || !pool.find(p => p.id === progress.current)) {
      // photos or progress changed: start again from the start screen
      $('pause').classList.remove('show'); $('complete').classList.remove('show');
      $('panel').classList.remove('show'); $('next').classList.remove('show');
      setState('boot');
      await loadPool(); await prepareLevel(); setState('title');
      $('title').classList.add('show');
    }
  });

  // ---------------------------------------------------------------- boot
  async function warmCache() {
    // Download all folder photos once so the game also works offline.
    for (const p of pool.filter(x => x.kind === 'folder')) {
      try { await fetch(p.src, { cache: 'no-cache' }); } catch (e) { /* offline */ }
    }
  }

  async function boot() {
    resize();
    paddle.x = paddle.tx = W / 2;
    balls = [newBall()];
    updateTitle();
    if (!(await unlockFromStorage())) await askPassword();
    await loadPool();
    await prepareLevel();
    setState('title');
    if (AUTO) { $('title').classList.remove('show'); resetBall(); }
    else $('title').classList.add('show');
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').then(() => setTimeout(warmCache, 3000)).catch(() => {});
    }
  }

  requestAnimationFrame(frame);
  boot();
})();
