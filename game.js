'use strict';
(function () {
  // ---------------------------------------------------------------- config
  const CFG = window.GAME_CONFIG || {};
  const T = Object.assign({
    hello: '¡Hola, {name}!', play: 'Jugar', tapToLaunch: 'Toca para lanzar',
    moveHint: '← Mueve el dedo →', next: 'Siguiente', tapToContinue: 'Toca para seguir',
    revealedCount: 'Fotos descubiertas: {n}',
    wellDone: ['¡Lo lograste!'], cheers: ['¡Muy bien!']
  }, CFG.text || {});
  const AUTO = new URLSearchParams(location.search).has('auto'); // demo mode: plays itself

  // Ball speed as a fraction of screen height per second; paddle as fraction of width.
  const SPEEDS = { 'muy-lenta': 0.30, 'lenta': 0.40, 'normal': 0.52 };
  const PADDLES = { 'normal': 0.26, 'grande': 0.34, 'muy-grande': 0.44 };
  const COLORS = ['#ff7a59', '#ffb547', '#ffd84d', '#5ed6a0', '#4fb3ff', '#a88bff'];
  const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];
  const COLS = 7;
  const PATTERNS = [
    ['XXXXXXX', 'XXXXXXX', 'XXXXXXX'],
    ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'],
    ['...X...', '..XXX..', '.XXXXX.', 'XXXXXXX', 'XXXXXXX'],
    ['XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX'],
    ['..XXX..', '.XXXXX.', 'XXXXXXX', '.XXXXX.', '..XXX..'],
    ['X.X.X.X', '.X.X.X.', 'X.X.X.X', '.X.X.X.', 'X.X.X.X'],
    ['XXXXXXX', '.XXXXX.', '..XXX..', '..XXX..', '.XXXXX.', 'XXXXXXX'],
    ['XX.X.XX', 'XX.X.XX', 'XX.X.XX', 'XX.X.XX', 'XX.X.XX'],
    ['XXXXXXX', 'X.....X', 'X.XXX.X', 'X.....X', 'XXXXXXX'],
    ['XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX']
  ];

  // ---------------------------------------------------------------- storage
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };
  const DEFAULT_PROGRESS = { level: 0, revealed: 0, current: null, lastPhoto: null, seen: [], everShown: [], adapt: { speed: 0.9, paddle: 0 } };
  const settings = Object.assign({
    playerName: CFG.playerName || '', speed: 'lenta', paddle: 'grande',
    safetyNet: false, sound: true, vibration: true
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
  const FILTER_OK = (() => {
    try { const c = mk(2, 2).getContext('2d'); c.filter = 'blur(2px)'; return c.filter === 'blur(2px)'; } catch (e) { return false; }
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
      const done = r => { scr.classList.remove('show'); res(r); };
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
    L.paddleY = H * 0.80;
    L.paddleH = clamp(W * 0.05, 18, 34);
    L.ballR = clamp(W * 0.034, 10, 22);
    L.netY = H * 0.94;
    L.panelTop = L.panelTop || H * 0.62;
    bricks.forEach(placeBrick);
    ball.r = L.ballR;
  }

  function placeBrick(b) {
    b.x = L.side + b.col * (L.bw + L.gap);
    b.y = L.top + b.row * (L.bh + L.gap);
    b.w = L.bw; b.h = L.bh;
  }

  // ---------------------------------------------------------------- game state
  let state = 'boot'; // boot | title | ready | play | missed | clearing | complete | paused
  let prevState = 'ready';
  let stateTime = 0;
  const paddle = { x: 0, tx: 0, w: 0, squish: 0 };
  const ball = { x: 0, y: 0, vx: 0, vy: 0, r: 12, trail: [] };
  let bricks = [], dying = [], particles = [], floaters = [], confetti = [];
  let total = 0, destroyed = 0, reveal = 0, revealShown = 0, cheersGiven = 0;
  let launchTimer = 0, sinceBrick = 0, noteIdx = 0, missTimer = 0, netFlash = 0;
  let showMoveHint = true;

  let pool = [];             // [{id, caption, src, kind}]
  const deviceUrls = {};     // id -> object URL
  let currentPhoto = null;   // pool entry
  let photoSrc = null;       // Image or canvas
  let layers = null;         // {heavy, soft, sharp}

  function setState(s) { state = s; stateTime = 0; }

  function paddleWidth() { return Math.min(W * 0.55, W * ((PADDLES[settings.paddle] || 0.34) + progress.adapt.paddle)); }
  function currentSpeed() {
    const lvl = 1 + Math.min(progress.level, 10) * 0.025;
    return H * (SPEEDS[settings.speed] || 0.4) * lvl * progress.adapt.speed;
  }

  function buildBricks() {
    const pat = PATTERNS[progress.level % PATTERNS.length];
    bricks = [];
    pat.forEach((row, ri) => [...row].forEach((ch, ci) => {
      if (ch !== 'X') return;
      const b = { row: ri, col: ci, color: COLORS[ri % COLORS.length], alive: true };
      placeBrick(b); bricks.push(b);
    }));
    total = bricks.length; destroyed = 0; reveal = 0; revealShown = 0; cheersGiven = 0;
    dying = []; particles = []; floaters = []; confetti = [];
    sinceBrick = 0;
  }

  function resetBall() {
    ball.trail.length = 0; ball.vx = 0; ball.vy = 0;
    launchTimer = 3.0;
    setState('ready');
  }

  function launch() {
    const sp = currentSpeed();
    const a = (Math.random() * 50 - 25) * Math.PI / 180;
    ball.vx = Math.sin(a) * sp; ball.vy = -Math.cos(a) * sp;
    sinceBrick = 0; noteIdx = 0; showMoveHint = false;
    setState('play');
  }

  // ---------------------------------------------------------------- photos
  function captionFromName(name) {
    const base = name.replace(/\.[^.]+$/, '');
    if (/^(img|pxl|dsc|dcim|screenshot|whatsapp|vid|photo|image|\d{6,})/i.test(base)) return '';
    return base.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  async function loadPool() {
    const list = [];
    if (vault && photoKey) {
      try {
        const r = await fetch('photos/list.enc', { cache: 'no-cache' });
        if (r.ok) {
          const manifest = JSON.parse(new TextDecoder().decode(await decryptBuf(photoKey, await r.arrayBuffer())));
          manifest.forEach(p => {
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
    const r = await fetch(entry.src);
    if (!r.ok) throw new Error('fetch ' + entry.src);
    const bytes = await decryptBuf(photoKey, await r.arrayBuffer());
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
      const f = Math.max(2, px / 2.5);
      const s = mk(Math.ceil(w / f), Math.ceil(h / f));
      drawCover(s.getContext('2d'), src, s.width, s.height, 1.05);
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      x.drawImage(s, 0, 0, w, h);
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
      heavy: blurredLayer(src, w, h, 26 * DPR, 0.45, 0.4),
      soft: blurredLayer(src, w, h, 9 * DPR, 0.2, 0.22),
      sharp
    };
  }

  // ---------------------------------------------------------------- audio & haptics
  let AC = null, master = null;
  function audioInit() {
    if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = 0.6;
      const comp = AC.createDynamicsCompressor();
      master.connect(comp); comp.connect(AC.destination);
    } catch (e) { AC = null; }
  }
  function tone(freq, dur, type, vol, when) {
    if (!AC || !settings.sound) return;
    const t = AC.currentTime + (when || 0);
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  // Mid-range bell (fundamental 260-800 Hz): easier to hear with age-related high-frequency loss.
  function bell(freq, when, vol) {
    vol = vol || 0.35;
    tone(freq, 0.7, 'sine', vol, when);
    tone(freq * 2, 0.35, 'sine', vol * 0.22, when);
    tone(freq * 3, 0.18, 'triangle', vol * 0.06, when);
  }
  const sfx = {
    brick() { bell(SCALE[Math.min(noteIdx, SCALE.length - 1)]); noteIdx++; },
    paddle() { tone(220, 0.16, 'triangle', 0.32); tone(110, 0.12, 'sine', 0.2); },
    net() { tone(330, 0.2, 'triangle', 0.18); },
    miss() { tone(196, 0.5, 'sine', 0.14); },
    cheer() { bell(523.25, 0, 0.25); bell(659.25, 0.12, 0.25); },
    win() {
      [261.63, 329.63, 392.0, 523.25, 659.25, 783.99].forEach((f, i) => bell(f, i * 0.14, 0.32));
      [261.63, 329.63, 392.0].forEach(f => tone(f, 2.2, 'sine', 0.12, 0.9));
    }
  };
  function buzz(p) { if (settings.vibration && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { /* ignore */ } } }

  // ---------------------------------------------------------------- physics
  function fixVertical(sp) {
    // Avoid long, boring, nearly horizontal bounces.
    const minVy = 0.35 * sp;
    if (Math.abs(ball.vy) < minVy) {
      ball.vy = (ball.vy < 0 ? -1 : 1) * minVy;
      ball.vx = (ball.vx < 0 ? -1 : 1) * Math.sqrt(sp * sp - minVy * minVy);
    }
  }

  function steerAssist(dt, sp) {
    // When few bricks remain (or nothing hit for a while) the ball curves gently toward the nearest brick.
    const alive = bricks.filter(b => b.alive && b.y + b.h / 2 < ball.y);
    if (!alive.length || ball.vy >= 0) return;
    const stuck = sinceBrick > 12;
    if (!(stuck || bricks.filter(b => b.alive).length <= 3)) return;
    let best = null, bd = Infinity;
    for (const b of alive) {
      const dx = b.x + b.w / 2 - ball.x, dy = b.y + b.h / 2 - ball.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = b; }
    }
    const want = Math.atan2(best.y + best.h / 2 - ball.y, best.x + best.w / 2 - ball.x);
    const cur = Math.atan2(ball.vy, ball.vx);
    let diff = want - cur;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    const maxTurn = (stuck ? 1.3 : 0.9) * dt;
    const a = cur + clamp(diff, -maxTurn, maxTurn);
    ball.vx = Math.cos(a) * sp; ball.vy = Math.sin(a) * sp;
  }

  function stepBall(dt) {
    sinceBrick += dt;
    const sp = currentSpeed();
    steerAssist(dt, sp);
    const m = Math.hypot(ball.vx, ball.vy) || 1;
    ball.vx = ball.vx / m * sp; ball.vy = ball.vy / m * sp;
    const steps = Math.max(1, Math.ceil(sp * dt / (ball.r * 0.4)));
    const sdt = dt / steps;
    for (let i = 0; i < steps && state === 'play'; i++) {
      ball.x += ball.vx * sdt; ball.y += ball.vy * sdt;
      collideWalls(); collidePaddle(sp); collideBricks(sp); collideBottom();
    }
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 8) ball.trail.shift();
  }

  function collideWalls() {
    if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
    if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
    if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }
  }

  function collidePaddle(sp) {
    const top = L.paddleY - L.paddleH / 2;
    if (ball.vy > 0 && ball.y + ball.r >= top && ball.y - ball.r <= L.paddleY + L.paddleH / 2 &&
        Math.abs(ball.x - paddle.x) <= paddle.w / 2 + ball.r * 0.8) {
      const rel = clamp((ball.x - paddle.x) / (paddle.w / 2), -1, 1);
      const ang = rel * 1.05; // up to ~60 degrees from vertical
      ball.vx = Math.sin(ang) * sp; ball.vy = -Math.cos(ang) * sp;
      ball.y = top - ball.r;
      noteIdx = 0; paddle.squish = 1;
      sfx.paddle(); buzz(10);
      const a = progress.adapt;
      a.streakHits = (a.streakHits || 0) + 1;
      if (a.streakHits % 6 === 0) a.speed = Math.min(1, a.speed + 0.03); // slowly back to normal
    }
  }

  function collideBricks(sp) {
    for (const b of bricks) {
      if (!b.alive) continue;
      const nx = clamp(ball.x, b.x, b.x + b.w), ny = clamp(ball.y, b.y, b.y + b.h);
      const dx = ball.x - nx, dy = ball.y - ny;
      if (dx * dx + dy * dy > ball.r * ball.r) continue;
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const ox = (b.w / 2 + ball.r) - Math.abs(ball.x - cx);
      const oy = (b.h / 2 + ball.r) - Math.abs(ball.y - cy);
      if (ox < oy) { ball.vx = ball.x < cx ? -Math.abs(ball.vx) : Math.abs(ball.vx); ball.x += ball.x < cx ? -ox : ox; }
      else { ball.vy = ball.y < cy ? -Math.abs(ball.vy) : Math.abs(ball.vy); ball.y += ball.y < cy ? -oy : oy; }
      fixVertical(sp);
      hitBrick(b);
      break;
    }
  }

  function collideBottom() {
    if (settings.safetyNet) {
      if (ball.vy > 0 && ball.y + ball.r >= L.netY) {
        ball.y = L.netY - ball.r; ball.vy = -Math.abs(ball.vy); netFlash = 0.5; sfx.net();
      }
    } else if (ball.y - ball.r > H) {
      miss();
    }
  }

  function hitBrick(b) {
    b.alive = false; destroyed++; sinceBrick = 0;
    dying.push({ b, t: 0 });
    for (let i = 0; i < 10; i++) {
      particles.push({
        x: b.x + b.w / 2, y: b.y + b.h / 2, vx: (Math.random() - 0.5) * W * 0.6,
        vy: -Math.random() * H * 0.3, s: 4 + Math.random() * 5, c: b.color, t: 0, life: 0.8 + Math.random() * 0.4
      });
    }
    sfx.brick(); buzz(15);
    reveal = destroyed / total * 0.85;
    if (destroyed === total) { levelClear(); return; }
    const frac = destroyed / total;
    if (cheersGiven < 2 && frac >= (cheersGiven + 1) / 3) {
      cheersGiven++; floaters.push({ text: pick(T.cheers), t: 0, dur: 1.8 }); sfx.cheer();
    }
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
    sfx.win(); buzz([30, 60, 30]);
    for (let i = 0; i < 60; i++) {
      confetti.push({
        x: Math.random() * W, y: -Math.random() * H * 0.6, vy: H * (0.08 + Math.random() * 0.1),
        sway: Math.random() * 6, ph: Math.random() * 6, s: 10 + Math.random() * 14,
        c: pick(['#ff9bb3', '#ffd84d', '#9be7c4', '#a9d6ff', '#ffc38a', '#d8c2ff']),
        heart: Math.random() < 0.4, t: 0, life: 6 + Math.random() * 2
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
    $('total').textContent = fmt(T.revealedCount, { n: progress.revealed });
    $('complete').classList.add('show');
    requestAnimationFrame(() => { L.panelTop = $('panel').getBoundingClientRect().top; });
    setTimeout(() => $('panel').classList.add('show'), 500);
    setTimeout(() => $('next').classList.add('show'), 2200);
  }

  // ---------------------------------------------------------------- update
  function update(dt) {
    stateTime += dt;
    paddle.w = paddleWidth();
    if (AUTO && (state === 'play' || state === 'ready')) paddle.tx = ball.x + Math.sin(stateTime * 1.7) * paddle.w * 0.3;
    paddle.tx = clamp(paddle.tx, paddle.w / 2, W - paddle.w / 2);
    paddle.x += (paddle.tx - paddle.x) * Math.min(1, dt * 20);
    paddle.x = clamp(paddle.x, paddle.w / 2, W - paddle.w / 2);
    paddle.squish = Math.max(0, paddle.squish - dt * 5);
    netFlash = Math.max(0, netFlash - dt);
    revealShown += (reveal - revealShown) * Math.min(1, dt * (state === 'clearing' ? 1.4 : 3));

    if (state === 'ready' || state === 'title') {
      ball.x = paddle.x; ball.y = L.paddleY - L.paddleH / 2 - ball.r - 1;
      if (state === 'ready') { launchTimer -= dt; if (launchTimer <= 0 || (AUTO && stateTime > 0.8)) launch(); }
    } else if (state === 'play') {
      stepBall(dt);
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
    floaters.forEach(f => { f.t += dt; }); floaters = floaters.filter(f => f.t < f.dur);
    confetti.forEach(c => { c.t += dt; c.y += c.vy * dt; c.x += Math.sin(c.ph + c.t * 1.5) * c.sway * dt * 10; });
    confetti = confetti.filter(c => c.t < c.life && c.y < H + 40);
  }

  // ---------------------------------------------------------------- render
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
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
    const p = revealShown;
    ctx.drawImage(layers.heavy, 0, 0, W, H);
    const a1 = clamp(p / 0.5, 0, 1);
    if (a1 > 0) { ctx.globalAlpha = a1; ctx.drawImage(layers.soft, 0, 0, W, H); }
    const a2 = clamp((p - 0.5) / 0.5, 0, 1);
    if (a2 > 0) { ctx.globalAlpha = a2; ctx.drawImage(layers.sharp, 0, 0, W, H); }
    ctx.globalAlpha = 1;
    // Darker band at the bottom so the paddle is always easy to see.
    if (state !== 'clearing') {
      const g = ctx.createLinearGradient(0, L.paddleY - H * 0.15, 0, H);
      g.addColorStop(0, 'rgba(10,6,24,0)'); g.addColorStop(1, 'rgba(10,6,24,.55)');
      ctx.fillStyle = g; ctx.fillRect(0, L.paddleY - H * 0.15, W, H);
    }
  }

  function drawBrick(b, scale, alpha) {
    const w = b.w * scale, h = b.h * scale, x = b.x + (b.w - w) / 2, y = b.y + (b.h - h) / 2;
    const r = Math.min(h * 0.3, 10);
    ctx.globalAlpha = alpha;
    rr(x, y, w, h, r); ctx.fillStyle = b.color; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(30,15,40,.6)'; ctx.stroke();
    rr(x + 4, y + 3, w - 8, h * 0.34, r * 0.7); ctx.fillStyle = 'rgba(255,255,255,.38)'; ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawPaddle() {
    const sq = paddle.squish * 0.15;
    const w = paddle.w * (1 + sq * 0.3), h = L.paddleH * (1 - sq);
    const x = paddle.x - w / 2, y = L.paddleY - h / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#fff7e0'); g.addColorStop(1, '#ffc65c');
    rr(x, y, w, h, h / 2); ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    rr(x, y, w, h, h / 2); ctx.lineWidth = 3; ctx.strokeStyle = '#3a2410'; ctx.stroke();
  }

  function drawBall(alpha) {
    ball.trail.forEach((p, i) => {
      ctx.globalAlpha = alpha * (i + 1) / ball.trail.length * 0.25;
      ctx.beginPath(); ctx.arc(p.x, p.y, ball.r * (0.5 + 0.5 * i / ball.trail.length), 0, Math.PI * 2);
      ctx.fillStyle = '#fff2b8'; ctx.fill();
    });
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(255,220,120,.95)'; ctx.shadowBlur = ball.r * 1.4;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.restore();
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.lineWidth = 3; ctx.strokeStyle = '#1b1430'; ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawConfetti() {
    confetti.forEach(c => {
      ctx.globalAlpha = clamp((c.life - c.t) / 1.5, 0, 1) * 0.9;
      ctx.fillStyle = c.c;
      if (c.heart) {
        ctx.font = `${c.s * 1.6}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('♥', c.x, c.y);
      } else {
        ctx.beginPath(); ctx.arc(c.x, c.y, c.s / 2, 0, Math.PI * 2); ctx.fill();
      }
    });
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
      drawPolaroid(); drawConfetti();
      return;
    }
    drawBackground();
    bricks.forEach(b => { if (b.alive) drawBrick(b, 1, 0.94); });
    dying.forEach(d => drawBrick(d.b, 1 + d.t * 1.2, Math.max(0, 1 - d.t / 0.3)));
    particles.forEach(p => {
      ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1);
      ctx.fillStyle = p.c; ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    });
    ctx.globalAlpha = 1;
    if (settings.safetyNet && state !== 'clearing') {
      ctx.fillStyle = `rgba(158,231,196,${0.45 + netFlash})`;
      rr(W * 0.02, L.netY, W * 0.96, 6, 3); ctx.fill();
    }
    if (state !== 'clearing') drawPaddle();
    if (state === 'ready' || state === 'title') drawBall(state === 'ready' ? clamp(stateTime * 3, 0, 1) : 1);
    else if (state === 'play' || state === 'paused') drawBall(1);
    if (state === 'ready') {
      const pulse = 0.65 + 0.35 * Math.sin(stateTime * 4);
      text(T.tapToLaunch, W / 2, L.paddleY - H * 0.13, Math.min(W * 0.085, 42), pulse);
      if (showMoveHint) text(T.moveHint, W / 2, L.paddleY + H * 0.09, Math.min(W * 0.065, 32), 0.9);
    }
    floaters.forEach(f => {
      const k = f.t / f.dur, pop = Math.min(1, f.t / 0.25);
      text(f.text, W / 2, H * 0.58 - k * H * 0.06, Math.min(W * 0.13, 70) * (0.7 + 0.3 * pop), Math.min(1, (1 - k) * 2.5));
    });
    drawConfetti();
  }

  // ---------------------------------------------------------------- loop
  let last = performance.now();
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (state !== 'paused' && state !== 'boot') update(dt);
    render();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- input
  cv.addEventListener('pointerdown', e => {
    audioInit();
    paddle.tx = e.clientX;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (state === 'ready' && stateTime > 0.3) launch();
  });
  cv.addEventListener('pointermove', e => { paddle.tx = e.clientX; });

  // ---------------------------------------------------------------- screens
  function updateTitle() {
    const name = (settings.playerName || '').trim();
    $('greet').textContent = name ? fmt(T.hello, { name }) : fmt(T.hello, { name: '' }).replace(/,\s*!/, '!');
    $('count').textContent = progress.revealed > 0 ? fmt(T.revealedCount, { n: progress.revealed }) : '';
    $('play').textContent = T.play;
    $('next').textContent = T.next;
    $('pause-text').textContent = T.tapToContinue;
    document.title = CFG.title || 'Recuerdos';
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
    prepareLevel().then(resetBall);
  }
  $('next').addEventListener('click', () => { audioInit(); nextLevel(); });

  function pause() {
    if (['ready', 'play', 'missed'].includes(state)) {
      prevState = state; setState('paused');
      $('pause').classList.add('show');
    }
  }
  $('pause').addEventListener('click', () => {
    $('pause').classList.remove('show');
    audioInit(); keepAwake();
    resetBall(); // ball comes back to the paddle; no penalty
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause(); else if (state !== 'title') keepAwake();
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
      : photoKey ? `Fotos de la familia (del servidor): ${folderCount}.`
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
    $('m-name').value = settings.playerName || '';
    $('m-speed').value = settings.speed; $('m-paddle').value = settings.paddle;
    $('m-net').checked = !!settings.safetyNet; $('m-sound').checked = !!settings.sound; $('m-vibe').checked = !!settings.vibration;
    $('m-status').textContent = ''; menuChanged = false;
    $('menu').classList.add('show');
    renderMenuPhotos();
  }

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
    saveSettings();
    $('menu').classList.remove('show');
    updateTitle();
    if (menuChanged || !pool.find(p => p.id === progress.current)) {
      await loadPool(); await prepareLevel(); setState('title');
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
