/* 30th Celebration Pack Opening Lab — educational simulator (probability / economics) */
(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const CARDS = window.CARDS;
const BY_ID = Object.fromEntries(CARDS.map(c => [c.id, c]));
const PACK_IMG = 'https://tcgplayer-cdn.tcgplayer.com/product/696613_in_1000x1000.jpg';

/* ---------- rarity model ---------- */
const R = {
  C:   { name: 'Common',                    zh: '普通',       color: '#9aa0b8', tier: 0 },
  R:   { name: 'Rare Holo',                 zh: '稀有闪卡',   color: '#c5d0ff', tier: 1 },
  PK:  { name: 'Pikachu Rare',              zh: '皮卡丘位',   color: '#ffd84a', tier: 1 },
  DR:  { name: 'Double Rare',               zh: '双稀有 ex',  color: '#6fb4ff', tier: 2 },
  IR:  { name: 'Illustration Rare',         zh: '插画稀有',   color: '#45e0bd', tier: 3 },
  CC:  { name: 'Classic Collection',        zh: '经典复刻',   color: '#f0a25a', tier: 3 },
  SIR: { name: 'Special Illustration Rare', zh: '特别插画稀有', color: '#ffb52e', tier: 4 },
  FR:  { name: 'Futuristic Rare',           zh: '未来稀有',   color: '#c77dff', tier: 5 },
  RGB: { name: 'RGB Rare',                  zh: 'RGB 梦幻',   color: '#ff4d6d', tier: 6 },
};
const ORDER = ['C', 'R', 'PK', 'DR', 'IR', 'CC', 'SIR', 'FR', 'RGB'];
const POOL = {}; ORDER.forEach(k => POOL[k] = CARDS.filter(c => c.r === k));
const HIT_SLOT = ['RGB', 'FR', 'SIR', 'IR', 'CC'];
const BASE_RATE = { FR: 0.0083, SIR: 0.0488, IR: 0.1972, CC: 0.1015, DR: 0.2102 };

/* ---------- state ---------- */
const KEY = 'pokepack30.v1';
const fresh = () => ({ coll: {}, packs: 0, spent: 0, value: 0, pulled: {}, best: null, sound: true, price: 4.99, rgbN: 3000 });
let S = fresh();
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

const rates = () => ({ ...BASE_RATE, RGB: 1 / S.rgbN });
/** expected number of cards of each rarity per pack */
function expected() {
  const rt = rates();
  const hit = HIT_SLOT.reduce((a, k) => a + rt[k], 0);
  return { C: 2 + (1 - hit), R: 1 - rt.DR, PK: 1, DR: rt.DR, IR: rt.IR, CC: rt.CC, SIR: rt.SIR, FR: rt.FR, RGB: rt.RGB };
}
const avgPrice = k => POOL[k].reduce((a, c) => a + c.p, 0) / POOL[k].length;
const packEV = () => { const e = expected(); return ORDER.reduce((a, k) => a + e[k] * avgPrice(k), 0); };
/** chance that one pack contains this specific card */
const cardOdds = c => Math.min(1, expected()[c.r] / POOL[c.r].length);

const pick = a => a[Math.random() * a.length | 0];
function rollPack() {
  const rt = rates();
  const a = pick(POOL.C); let b; do { b = pick(POOL.C); } while (b === a);
  let x = Math.random(), hit = null;
  for (const k of HIT_SLOT) { if (x < rt[k]) { hit = pick(POOL[k]); break; } x -= rt[k]; }
  const out = [a, b];
  if (!hit) { let c; do { c = pick(POOL.C); } while (c === a || c === b); out.push(c); }
  out.push(pick(POOL.PK));
  out.push(Math.random() < rt.DR ? pick(POOL.DR) : pick(POOL.R));
  if (hit) out.push(hit);
  return out;
}

/* ---------- helpers ---------- */
const money = x => (x < 0 ? '-$' : '$') + Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = x => (x >= 0 ? '+' : '') + money(x);
const pct = (x, d = 2) => (x * 100).toFixed(x < 0.001 ? 3 : d) + '%';
const oneIn = p => p >= 1 ? '每包' : '1 / ' + (1 / p >= 100 ? Math.round(1 / p).toLocaleString('en-US') : (1 / p).toFixed(1));
const img = (c, hi) => c.img ? `${c.img}/${hi ? 'high' : 'low'}.webp`
  : `https://tcgplayer-cdn.tcgplayer.com/product/${c.tp}_${hi ? 'in_1000x1000' : '200w'}.jpg`;
const numLabel = c => c.r === 'CC' ? `Classic ${c.n}/030` : c.r === 'RGB' ? `${c.n}/RGB` : `${c.n}/128`;
const badge = k => `<span class="badge ${k === 'RGB' ? 'rgb' : ''}" style="--rc:${R[k].color}">${R[k].name}</span>`;
const esc = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const preload = url => { const i = new Image(); i.src = url; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function countUp(el, to, ms = 600, fmt = money) {
  const from = +el.dataset.v || 0, t0 = performance.now(); el.dataset.v = to;
  const step = t => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 1800); }

/* ---------- sound (synthesised, no assets) ---------- */
const sfx = (() => {
  let ctx;
  const ac = () => { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx; };
  function noise(dur, f0, f1, gain, q = 1.2) {
    const a = ac(), n = a.sampleRate * dur | 0, buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource(); src.buffer = buf;
    const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(f0, a.currentTime); bp.frequency.exponentialRampToValueAtTime(f1, a.currentTime + dur);
    const g = a.createGain(); g.gain.setValueAtTime(gain, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    src.connect(bp).connect(g).connect(a.destination); src.start();
  }
  function tone(f, at, dur, type = 'sine', gain = 0.1) {
    const a = ac(), o = a.createOscillator(), g = a.createGain(), t = a.currentTime + at;
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.012); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  const wrap = fn => (...a) => { if (!S.sound) return; try { fn(...a); } catch (e) {} };
  const SCALE = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093, 2637];
  return {
    snip: wrap(() => noise(0.045, 4200, 7000, 0.16, 3)),
    rip: wrap(() => { noise(0.4, 1400, 5200, 0.22); tone(180, 0.28, 0.25, 'triangle', 0.12); }),
    flip: wrap(() => noise(0.16, 700, 2600, 0.1)),
    charge: wrap(tier => { for (let i = 0; i < 8; i++) tone(200 + i * 60 * (tier / 3), i * 0.09, 0.12, 'sawtooth', 0.025); }),
    chime: wrap(tier => {
      if (tier === 0) return tone(660, 0, 0.12, 'sine', 0.05);
      const n = Math.min(SCALE.length, 2 + tier);
      for (let i = 0; i < n; i++) { tone(SCALE[i], i * 0.07, 0.5 + tier * 0.12, 'triangle', 0.09); if (tier >= 4) tone(SCALE[i] * 2, i * 0.07 + 0.03, 0.6, 'sine', 0.04); }
      if (tier >= 4) noise(0.9, 6000, 9000, 0.05, 0.6);
    }),
    keep: wrap(() => { tone(880, 0, 0.09, 'sine', 0.07); tone(1318, 0.06, 0.14, 'sine', 0.07); }),
    skip: wrap(() => tone(196, 0, 0.12, 'triangle', 0.08)),
  };
})();

/* ---------- particles ---------- */
const fx = (() => {
  const cv = $('#fx'), g = cv.getContext('2d'); let P = [], run = false, dpr = 1;
  const size = () => { dpr = Math.min(1.5, devicePixelRatio || 1); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
  addEventListener('resize', size); size();
  function loop() {
    g.clearRect(0, 0, cv.width, cv.height);
    P = P.filter(p => p.life > 0);
    for (const p of P) {
      p.vy += p.g; p.vx *= p.dr; p.vy *= p.dr; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life--;
      const a = Math.min(1, p.life / 25);
      g.save(); g.globalAlpha = a; g.translate(p.x * dpr, p.y * dpr); g.rotate(p.rot); g.fillStyle = p.c;
      if (p.kind === 'spark') { const s = p.s * dpr * a; g.beginPath(); g.moveTo(0, -s); g.lineTo(s * .28, -s * .28); g.lineTo(s, 0); g.lineTo(s * .28, s * .28); g.lineTo(0, s); g.lineTo(-s * .28, s * .28); g.lineTo(-s, 0); g.lineTo(-s * .28, -s * .28); g.fill(); }
      else g.fillRect(-p.s * dpr / 2, -p.s * dpr * .3, p.s * dpr, p.s * dpr * .6);
      g.restore();
    }
    if (P.length) requestAnimationFrame(loop); else { run = false; g.clearRect(0, 0, cv.width, cv.height); }
  }
  const kick = () => { if (P.length > 320) P = P.slice(-320); if (!run) { run = true; requestAnimationFrame(loop); } };
  return {
    burst(x, y, colors, n, power = 9) {
      for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = power * (0.3 + Math.random()); P.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.05, dr: 0.955, s: 3 + Math.random() * 7, c: pick(colors), life: 40 + Math.random() * 50, rot: Math.random() * 3, vr: 0.1 }); }
      kick();
    },
    clear() { P = []; },
    confetti(colors, n) {
      for (let i = 0; i < n; i++) P.push({ kind: 'conf', x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * .5, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 4, g: 0.04, dr: 0.992, s: 6 + Math.random() * 8, c: pick(colors), life: 150 + Math.random() * 90, rot: Math.random() * 6, vr: (Math.random() - .5) * .3 });
      kick();
    },
  };
})();
function flash(color) { const f = $('#flash'); document.documentElement.style.setProperty('--fx', color); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }

/* ---------- collection ---------- */
const owned = id => S.coll[id] || 0;
function addCard(id, n = 1) { S.coll[id] = owned(id) + n; if (S.coll[id] <= 0) delete S.coll[id]; save(); renderWallet(); }
function recordPack(cards) {
  S.packs++; S.spent += S.price;
  for (const c of cards) { S.value += c.p; S.pulled[c.r] = (S.pulled[c.r] || 0) + 1; if (!S.best || c.p > S.best.p) S.best = { id: c.id, p: c.p }; }
  save(); renderWallet();
}
function renderWallet() {
  $('#wPacks').textContent = S.packs.toLocaleString('en-US');
  $('#wSpent').textContent = money(S.spent);
  const net = S.value - S.spent, el = $('#wNet');
  el.textContent = signed(net); el.className = S.packs ? (net >= 0 ? 'gain' : 'loss') : '';
  $('#binderCount').textContent = Object.keys(S.coll).length;
  $('#packPriceTag').textContent = money(S.price);
  $('#btnSound').classList.toggle('off', !S.sound);
}

/* ---------- navigation ---------- */
function nav(v) {
  if (!['open', 'binder', 'stats'].includes(v)) v = 'open';
  $$('.view').forEach(el => el.classList.toggle('on', el.id === 'view-' + v));
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.nav === v));
  fx.clear();
  if (v === 'binder') renderBinder();
  if (v === 'stats') renderStats();
  if (location.hash !== '#' + v) history.replaceState(null, '', '#' + v);
  scrollTo(0, 0);
}
document.addEventListener('click', e => { const b = e.target.closest('[data-nav]'); if (b) { e.preventDefault(); nav(b.dataset.nav); } });

/* =====================================================================
   OPEN FLOW
   ===================================================================== */
const stage = $('#stage'), packEl = $('#pack'), cutEl = $('#cut'), stackEl = $('#stack');
let next = null;        // pre-rolled pack (so images can preload)
let cur = [];           // [{c, kept, up, el}]
let idx = 0, busy = false, cutP = 0, cutting = false, multi = 1;
const phase = p => { stage.dataset.phase = p; stage.dataset.tier = 0; stage.dataset.swipe = ''; };

function prepare() { next = rollPack(); next.forEach(c => preload(img(c, true))); }
function resetPack() {
  cutP = 0; cutEl.style.setProperty('--p', 0); packEl.classList.remove('opened'); cutting = false;
  phase('idle'); prepare();
}

/* pack tilt */
stage.addEventListener('pointermove', e => {
  if (stage.dataset.phase !== 'idle' || e.pointerType === 'touch') return;
  const r = packEl.getBoundingClientRect();
  const x = (e.clientX - r.left - r.width / 2) / r.width, y = (e.clientY - r.top - r.height / 2) / r.height;
  packEl.style.setProperty('--ry', Math.max(-18, Math.min(18, x * 22)) + 'deg');
  packEl.style.setProperty('--rx', Math.max(-12, Math.min(12, -y * 12)) + 'deg');
});

/* cutting by drag */
let lastSnip = 0;
function setCut(p) {
  if (p <= cutP) return;
  cutP = Math.min(1, p); cutEl.style.setProperty('--p', cutP);
  if (stage.dataset.phase === 'idle') { stage.dataset.phase = 'cut'; packEl.style.setProperty('--ry', '0deg'); packEl.style.setProperty('--rx', '0deg'); }
  const now = performance.now(); if (now - lastSnip > 70) { lastSnip = now; sfx.snip(); }
  const r = cutEl.getBoundingClientRect();
  if (Math.random() < .5) fx.burst(r.left + r.width * cutP, r.top, ['#fff', '#f6c84c'], 1, 3);
  if (cutP >= 0.97) openPack();
}
packEl.addEventListener('pointerdown', e => {
  if (!['idle', 'cut'].includes(stage.dataset.phase) || packEl.classList.contains('opened')) return;
  const r = packEl.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
  if (x > cutP + 0.3) return;              // must start near the scissors
  cutting = true; packEl.setPointerCapture(e.pointerId);
});
packEl.addEventListener('pointermove', e => {
  if (!cutting) return;
  const r = packEl.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
  if (x - cutP < 0.35) setCut(x);
});
const endCut = () => { cutting = false; };
packEl.addEventListener('pointerup', endCut); packEl.addEventListener('pointercancel', endCut);

async function autoCut() {
  if (stage.dataset.phase !== 'idle' && stage.dataset.phase !== 'cut') return;
  if (packEl.classList.contains('opened') || busy) return;
  busy = true;
  const from = cutP, t0 = performance.now(), dur = 650 * (1 - from);
  await new Promise(res => { const step = t => { const k = Math.min(1, (t - t0) / dur); setCut(from + (1 - from) * k); k < 1 && !packEl.classList.contains('opened') ? requestAnimationFrame(step) : res(); }; requestAnimationFrame(step); });
  busy = false;
}

async function openPack() {
  if (packEl.classList.contains('opened')) return;
  packEl.classList.add('opened'); cutting = false; sfx.rip();
  const r = packEl.getBoundingClientRect();
  fx.burst(r.left + r.width / 2, r.top + r.height * .08, ['#fff', '#f6c84c', '#ffe9a8'], 36, 8);
  multi = 1;
  const cards = next; recordPack(cards);
  cur = cards.map(c => ({ c, kept: false, up: false }));
  await sleep(820);
  startReveal();
}

/* ---------- reveal ---------- */
const cardHTML = (c, up) => `<div class="card-tilt"><div class="card-flip"><div class="face back cardback"></div><div class="face front"><img src="${img(c, true)}" alt="${esc(c.name)}" draggable="false"><div class="holo"></div><div class="glare"></div></div></div></div>`;
function styleCard(el, c) {
  const t = R[c.r].tier;
  el.style.setProperty('--holo', [0.1, .28, .42, .5, .62, .75, .9][t]);
  el.style.setProperty('--glow', t * 16);
  el.style.setProperty('--hint', t >= 2 ? R[c.r].color : '#ffffff');
  if (c.r === 'RGB') el.classList.add('rgbfx');
}
function tilt(el, e) {
  const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  el.style.setProperty('--mx', (x * 100).toFixed(1)); el.style.setProperty('--my', (y * 100).toFixed(1));
  el.style.setProperty('--ry', ((x - .5) * 26).toFixed(1) + 'deg'); el.style.setProperty('--rx', ((.5 - y) * 20).toFixed(1) + 'deg');
  el.style.setProperty('--gl', .75);
}
function untilt(el) { ['--ry', '--rx'].forEach(k => el.style.setProperty(k, '0deg')); el.style.setProperty('--gl', .35); el.style.setProperty('--mx', 50); el.style.setProperty('--my', 30); }

function startReveal() {
  idx = 0; busy = false; phase('reveal');
  stackEl.innerHTML = '';
  cur.forEach((pc, i) => {
    const el = document.createElement('div'); el.className = 'card3d'; el.style.setProperty('--d', i); el.style.zIndex = 10 - i;
    el.innerHTML = cardHTML(pc.c); styleCard(el, pc.c); pc.el = el; bindCard(el, pc); stackEl.appendChild(el);
  });
  $('#tray').innerHTML = cur.map(() => '<div class="slot"><i></i><span>—</span></div>').join('');
  const tt = $('#trayTotal'); tt.dataset.v = 0; tt.textContent = money(0);
  setTop();
}
function setTop() {
  cur.forEach((pc, i) => { if (i >= idx) { pc.el.style.setProperty('--d', i - idx); pc.el.classList.toggle('top', i === idx); } });
  $('#decide').classList.remove('on');
  $('#info').innerHTML = `<div class="wait">第 <b>${idx + 1}</b> / ${cur.length} 张 · 点击卡牌或按 <kbd>空格</kbd> 翻开</div>`;
  stage.dataset.tier = 0;
}
function bindCard(el, pc) {
  let drag = null;
  el.addEventListener('pointerdown', e => { if (cur[idx] !== pc || busy) return; drag = { x: e.clientX, moved: false }; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => {
    if (cur[idx] !== pc) return;
    if (drag && pc.up) {
      const dx = e.clientX - drag.x; if (Math.abs(dx) > 8) drag.moved = true;
      if (drag.moved) { el.classList.add('dragging'); el.style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`; stage.dataset.swipe = dx > 70 ? 'keep' : dx < -70 ? 'skip' : ''; }
    } else if (pc.up && e.pointerType !== 'touch') tilt(el, e);
  });
  const up = e => {
    if (!drag) return; const d = drag; drag = null; el.classList.remove('dragging');
    const dx = e.clientX - d.x; stage.dataset.swipe = '';
    if (!pc.up) return flip();
    if (!d.moved) return decide(true);
    if (dx > 90) decide(true); else if (dx < -90) decide(false); else el.style.transform = '';
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', () => { drag = null; el.classList.remove('dragging'); el.style.transform = ''; stage.dataset.swipe = ''; });
  el.addEventListener('pointerleave', () => { if (!drag) untilt(el); });
}

async function flip() {
  const pc = cur[idx]; if (!pc || pc.up || busy || stage.dataset.phase !== 'reveal') return;
  busy = true;
  const el = pc.el, k = pc.c.r, tier = R[k].tier, color = R[k].color;
  document.documentElement.style.setProperty('--fx', color);
  if (tier >= 2) { el.classList.add('charging'); sfx.charge(tier); await sleep(tier >= 4 ? 950 : 380); el.classList.remove('charging'); }
  el.classList.add('up'); sfx.flip();
  await sleep(300);
  const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const cols = k === 'RGB' ? ['#ff1744', '#00e676', '#2979ff', '#fff'] : [color, '#fff', '#ffe9a8'];
  stage.dataset.tier = tier; sfx.chime(tier);
  if (tier >= 1) fx.burst(cx, cy, cols, [0, 8, 18, 32, 60, 90, 130][tier], 6 + tier * 2.2);
  if (tier >= 3) flash(color);
  if (tier >= 4) { stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake'); fx.confetti(cols, tier >= 5 ? 140 : 90); }
  if (tier >= 6) { await sleep(350); fx.burst(cx, cy, cols, 120, 20); fx.confetti(cols, 160); }
  pc.up = true;
  $('#info').innerHTML = `<div class="nm">${esc(pc.c.name)} <small>${numLabel(pc.c)}</small></div><div class="row">${badge(k)}<span class="val" id="infoVal">$0.00</span></div>`;
  countUp($('#infoVal'), pc.c.p, tier >= 3 ? 900 : 450);
  $('#decide').classList.add('on');
  busy = false;
}

async function decide(keep, fast) {
  const pc = cur[idx]; if (!pc || !pc.up || busy) return;
  busy = true; pc.kept = keep;
  const el = pc.el; el.classList.add('out'); el.classList.remove('top');
  if (keep) {
    addCard(pc.c.id); sfx.keep();
    const a = el.getBoundingClientRect(), b = $('#tabBinder').getBoundingClientRect();
    el.style.transform = `translate(${b.left + b.width / 2 - a.left - a.width / 2}px,${b.top + b.height / 2 - a.top - a.height / 2}px) scale(.06) rotate(16deg)`;
    setTimeout(() => { const t = $('#tabBinder'); t.classList.remove('bump'); void t.offsetWidth; t.classList.add('bump'); }, 380);
  } else { sfx.skip(); el.style.transform = 'translate(-70vw,30vh) rotate(-40deg) scale(.7)'; }
  el.style.opacity = 0;
  fillSlot(idx);
  await sleep(fast ? 120 : 330);
  el.remove(); idx++; busy = false;
  if (idx >= cur.length) { await sleep(250); showSummary(); } else setTop();
}
function fillSlot(i) {
  const pc = cur[i], s = $$('#tray .slot')[i];
  s.classList.add('fill'); s.classList.toggle('skipped', !pc.kept); s.style.setProperty('--rc', R[pc.c.r].color);
  s.querySelector('i').style.backgroundImage = `url(${img(pc.c)})`;
  s.querySelector('span').textContent = money(pc.c.p);
  countUp($('#trayTotal'), cur.slice(0, i + 1).reduce((a, x) => a + x.c.p, 0), 400);
}
function skipAll() {
  if (busy || stage.dataset.phase !== 'reveal') return;
  for (let i = idx; i < cur.length; i++) { cur[i].kept = true; addCard(cur[i].c.id); }
  showSummary();
}
$('#btnKeep').onclick = () => decide(true);
$('#btnSkip').onclick = () => decide(false);
$('#btnSkipAll').onclick = skipAll;
$('#btnCut').onclick = autoCut;

/* ---------- quick x10 ---------- */
function quick(n = 10) {
  if (busy) return;
  multi = n; cur = [];
  for (let i = 0; i < n; i++) { const p = rollPack(); recordPack(p); p.forEach(c => { cur.push({ c, kept: true, up: true }); addCard(c.id); }); }
  cur.sort((a, b) => b.c.p - a.c.p);
  sfx.rip(); showSummary();
  const top = cur[0].c, t = R[top.r].tier;
  if (t >= 3) { flash(R[top.r].color); sfx.chime(t); fx.confetti([R[top.r].color, '#fff', '#ffe9a8'], 60 + t * 30); }
}
$('#btnQuick').onclick = () => quick(10);
$('#btnAgain10').onclick = () => quick(10);

/* ---------- summary ---------- */
function showSummary() {
  phase('summary');
  const total = cur.reduce((a, x) => a + x.c.p, 0), cost = S.price * multi, net = total - cost;
  $('#sumLabel').textContent = multi > 1 ? `${multi} 包结果 · 共 ${cur.length} 张` : '本包价值';
  const v = $('#sumValue'); v.dataset.v = 0; countUp(v, total, 800);
  $('#sumVs').innerHTML = `<div><small>卡包成本</small><b>${money(cost)}</b></div><div><small>${net >= 0 ? '盈利' : '亏损'}</small><b class="${net >= 0 ? 'gain' : 'loss'}">${net >= 0 ? '▲' : '▼'} ${signed(net)}</b></div><div><small>回报率</small><b class="${net >= 0 ? 'gain' : 'loss'}">${(total / cost * 100).toFixed(0)}%</b></div>`;
  const grid = $('#sumGrid'); grid.classList.toggle('many', cur.length > 8);
  grid.innerHTML = cur.map((pc, i) => `<div class="sum-card ${pc.kept ? '' : 'off'}" data-i="${i}" style="--i:${Math.min(i, 24)};--rc:${R[pc.c.r].color};--t:${R[pc.c.r].tier}">
    <div class="thumb" data-zoom="${pc.c.id}" data-tip="${esc(pc.c.name)} · ${R[pc.c.r].name}"><img src="${img(pc.c, cur.length <= 8)}" alt="${esc(pc.c.name)}" loading="lazy"></div>
    <div class="n">${esc(pc.c.name)}</div><div class="p">${money(pc.c.p)}</div>
    <button class="tog">${pc.kept ? '✓ 已收藏' : '＋ 收藏'}</button></div>`).join('');
  sumText();
  if (net > 0 && multi === 1) fx.confetti(['#4fd69c', '#fff', '#f6c84c'], 50);
}
function sumText() { const k = cur.filter(x => x.kept); $('#sumKeptText').textContent = `已收入 Binder ${k.length} / ${cur.length} 张（${money(k.reduce((a, x) => a + x.c.p, 0))}）`; }
function setKept(i, keep) {
  const pc = cur[i]; if (pc.kept === keep) return;
  pc.kept = keep; addCard(pc.c.id, keep ? 1 : -1);
  const el = $(`.sum-card[data-i="${i}"]`); el.classList.toggle('off', !keep); el.querySelector('.tog').textContent = keep ? '✓ 已收藏' : '＋ 收藏';
}
$('#sumGrid').addEventListener('click', e => {
  const z = e.target.closest('[data-zoom]'); if (z) return openModal(z.dataset.zoom);
  const t = e.target.closest('.tog'); if (t) { const i = +t.closest('.sum-card').dataset.i; setKept(i, !cur[i].kept); sfx[cur[i].kept ? 'keep' : 'skip'](); sumText(); }
});
$$('[data-sum]').forEach(b => b.onclick = () => {
  cur.forEach((pc, i) => setKept(i, b.dataset.sum === 'all' ? true : b.dataset.sum === 'none' ? false : R[pc.c.r].tier >= 2));
  sumText();
});
$('#btnAgain').onclick = () => resetPack();

/* ---------- keyboard ---------- */
addEventListener('keydown', e => {
  if (e.target.matches('input,select,textarea')) return;
  if (!$('#modal').hidden) { if (e.key === 'Escape') closeModal(); return; }
  if (!$('#view-open').classList.contains('on')) return;
  const ph = stage.dataset.phase, k = e.key;
  if (k === ' ' || k === 'Enter') {
    e.preventDefault();
    if (ph === 'idle' || ph === 'cut') autoCut();
    else if (ph === 'reveal') { cur[idx] && cur[idx].up ? decide(true) : flip(); }
    else if (ph === 'summary') resetPack();
  } else if (ph === 'reveal' && cur[idx] && cur[idx].up) {
    if (k === 'ArrowRight') decide(true); else if (k === 'ArrowLeft' || k === 'x') decide(false);
  }
});

/* =====================================================================
   BINDER
   ===================================================================== */
const bf = { own: 'all', r: null, q: '', sort: 'num' };
function renderBinder() {
  const ownedCards = CARDS.filter(c => owned(c.id));
  const uniq = ownedCards.length, total = ownedCards.reduce((a, c) => a + owned(c.id), 0), value = ownedCards.reduce((a, c) => a + owned(c.id) * c.p, 0);
  $('#ringFg').style.strokeDashoffset = 326.7 * (1 - uniq / CARDS.length);
  $('#ringPct').textContent = Math.floor(uniq / CARDS.length * 100) + '%';
  $('#ringTxt').textContent = `${uniq} / ${CARDS.length}`;
  $('#bValue').textContent = money(value); $('#bTotal').textContent = total.toLocaleString('en-US');
  const best = ownedCards.sort((a, b) => b.p - a.p)[0];
  $('#bBest').innerHTML = best ? `${esc(best.name)} <span>${money(best.p)}</span>` : '—';
  $('#chips').innerHTML = ORDER.map(k => `<button class="chip ${bf.r === k ? 'on' : ''}" data-r="${k}" style="--rc:${R[k].color}">${R[k].name} <i>${POOL[k].filter(c => owned(c.id)).length}/${POOL[k].length}</i></button>`).join('');
  let list = CARDS.filter(c => (bf.own === 'all' || (bf.own === 'own') === !!owned(c.id)) && (!bf.r || c.r === bf.r) && (!bf.q || (c.name + ' ' + c.n).toLowerCase().includes(bf.q)));
  if (bf.sort === 'price') list = [...list].sort((a, b) => b.p - a.p);
  if (bf.sort === 'count') list = [...list].sort((a, b) => owned(b.id) - owned(a.id) || b.p - a.p);
  $('#bGrid').innerHTML = list.map(c => { const n = owned(c.id); return `<div class="pocket ${n ? '' : 'miss'}" data-id="${c.id}" style="--rc:${R[c.r].color}">
    <div class="sleeve">${n > 1 ? `<span class="cnt">×${n}</span>` : ''}<img src="${img(c)}" alt="${esc(c.name)}" loading="lazy">${n ? '' : `<span class="no">${c.r === 'CC' ? 'C' : ''}${c.n}</span>`}</div>
    <div class="meta"><span>${esc(c.name)}</span><b>${money(c.p)}</b></div></div>`; }).join('');
  $('#bGrid').hidden = !list.length; $('#bEmpty').hidden = !!list.length;
  $('#bEmpty').textContent = uniq ? '没有符合筛选条件的卡牌。' : '这里还没有卡。去开一包吧！';
}
$('#chips').addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; bf.r = bf.r === c.dataset.r ? null : c.dataset.r; renderBinder(); });
$('#segOwn').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; bf.own = b.dataset.v; $$('#segOwn button').forEach(x => x.classList.toggle('on', x === b)); renderBinder(); });
$('#bSearch').addEventListener('input', e => { bf.q = e.target.value.trim().toLowerCase(); renderBinder(); });
$('#bSort').addEventListener('change', e => { bf.sort = e.target.value; renderBinder(); });
$('#bGrid').addEventListener('click', e => { const p = e.target.closest('.pocket'); if (p) openModal(p.dataset.id); });

/* ---------- modal ---------- */
let modalId = null;
function openModal(id) {
  modalId = id; const c = BY_ID[id];
  const mc = $('#mCard'); mc.innerHTML = `<div class="card3d up top">${cardHTML(c)}</div>`;
  const el = mc.firstChild; styleCard(el, c); el.style.setProperty('--holo', Math.max(.3, +el.style.getPropertyValue('--holo')));
  document.documentElement.style.setProperty('--fx', R[c.r].color);
  mc.onpointermove = e => tilt(el, e); mc.onpointerleave = () => untilt(el);
  modalInfo(); $('#modal').hidden = false;
}
function modalInfo() {
  const c = BY_ID[modalId], p = cardOdds(c), n = owned(c.id), exp = S.price / p;
  $('#mInfo').innerHTML = `${badge(c.r)}<h2>${esc(c.name)}</h2><div class="big">${money(c.p)}</div>
  <dl class="dl"><dt>编号</dt><dd>${numLabel(c)}</dd><dt>系列</dt><dd>${c.r === 'CC' ? '30th Classic Collection' : '30th Celebration'}</dd><dt>属性</dt><dd>${c.t}</dd><dt>画师</dt><dd>${esc(c.ill || '—')}</dd>
  <dt>价格来源</dt><dd>${c.ps} ${c.ps === 'Cardmarket' ? '(换算)' : 'market'}</dd><dt>单包出货率</dt><dd>${pct(p)}（${oneIn(p)} 包）</dd><dt>期望开包成本</dt><dd>${money(exp)}</dd></dl>
  <p class="note" style="margin:0">${exp > c.p ? `开包追这张卡平均要花 <b>${money(exp)}</b>，是单卡市价的 <b>${(exp / c.p).toFixed(1)} 倍</b>。` : `这张卡的市价高于开包期望成本——通常意味着爆率估计偏高，或市场尚未消化。`}</p>
  <div class="own"><span>Binder 中拥有</span><button data-own="-1" aria-label="减少">−</button><b>${n}</b><button data-own="1" aria-label="增加">＋</button></div>`;
}
$('#mInfo').addEventListener('click', e => { const b = e.target.closest('[data-own]'); if (!b) return; if (+b.dataset.own < 0 && !owned(modalId)) return; addCard(modalId, +b.dataset.own); modalInfo(); if ($('#view-binder').classList.contains('on')) renderBinder(); });
function closeModal() { $('#modal').hidden = true; modalId = null; }
$('#modal').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });

/* =====================================================================
   STATS
   ===================================================================== */
function renderStats() {
  const net = S.value - S.spent, ev = packEV();
  const best = S.best && BY_ID[S.best.id];
  $('#sKpis').innerHTML = `
    <div class="kpi"><small>已开包数</small><b>${S.packs.toLocaleString('en-US')}</b><span>${(S.packs * 5).toLocaleString('en-US')} 张卡</span></div>
    <div class="kpi"><small>总花费</small><b>${money(S.spent)}</b><span>按 ${money(S.price)} / 包</span></div>
    <div class="kpi"><small>抽到总价值</small><b>${money(S.value)}</b><span>平均 ${money(S.packs ? S.value / S.packs : 0)} / 包</span></div>
    <div class="kpi"><small>净盈亏</small><b class="${S.packs ? (net >= 0 ? 'gain' : 'loss') : ''}">${S.packs ? (net >= 0 ? '▲ ' : '▼ ') : ''}${signed(net)}</b><span>回报率 ${S.spent ? (S.value / S.spent * 100).toFixed(0) : 0}%</span></div>
    <div class="kpi"><small>最佳单卡</small><b>${best ? money(best.p) : '—'}</b><span>${best ? esc(best.name) + ' · ' + R[best.r].name : '还没开包'}</span></div>`;
  $('#setPrice').value = S.price; $('#setRgb').value = S.rgbN;

  const e = expected(), rows = ORDER.map(k => ({ k, n: POOL[k].length, e: e[k], avg: avgPrice(k), ev: e[k] * avgPrice(k) }));
  const maxEv = Math.max(...rows.map(r => r.ev));
  $('#tblOdds').innerHTML = `<thead><tr><th>稀有度</th><th>卡牌数</th><th>每包期望张数</th><th>约等于</th><th>指定某一张</th><th>平均市价</th><th>对每包 EV 的贡献</th></tr></thead><tbody>` +
    rows.map(r => `<tr><td>${badge(r.k)}</td><td>${r.n}</td><td>${r.e >= 1 ? r.e.toFixed(2) + ' 张' : pct(r.e)}</td><td>${r.e >= 1 ? '每包' : oneIn(r.e) + ' 包'}</td><td>${oneIn(Math.min(1, r.e / r.n))} 包</td><td>${money(r.avg)}</td>
      <td><div class="bar" data-tip="${R[r.k].name}\n${r.e.toFixed(4)} 张 × ${money(r.avg)} = ${money(r.ev)}"><i style="width:${(r.ev / maxEv * 120).toFixed(1)}px"></i>${money(r.ev)}</div></td></tr>`).join('') +
    `</tbody><tfoot><tr><td>每包合计</td><td>${CARDS.length}</td><td>5.00 张</td><td></td><td></td><td></td><td>${money(ev)}</td></tr></tfoot>`;
  const top = [...rows].sort((a, b) => b.ev - a.ev)[0];
  $('#evNote').innerHTML = `每包<b>期望价值（EV）≈ ${money(ev)}</b>，卡包价格 ${money(S.price)}，期望回报率 <b class="${ev >= S.price ? 'gain' : 'loss'}">${(ev / S.price * 100).toFixed(0)}%</b>。
    其中 ${R[top.k].name} 一项就贡献了 ${money(top.ev)}（${(top.ev / ev * 100).toFixed(0)}%）；RGB Mew 虽然几千包才出一张，却贡献了 ${money(rows[8].ev)}——<b>EV 被极少数大奖撑起来</b>。把上面的 RGB 假设爆率改一下，看 EV 会怎么变。
    另外注意：把卡真正卖出还要扣平台手续费、运费和时间成本，低价卡（&lt;$1）基本无法单独变现，所以“可变现 EV”远低于账面 EV。`;

  const hitKeys = ['DR', 'IR', 'CC', 'SIR', 'FR', 'RGB'];
  $('#tblLuck').innerHTML = `<thead><tr><th>稀有度</th><th>理论爆率</th><th>期望张数（${S.packs} 包）</th><th>实际抽到</th><th>实际爆率</th><th>偏差</th></tr></thead><tbody>` +
    hitKeys.map(k => { const ex = e[k] * S.packs, got = S.pulled[k] || 0, d = got - ex;
      return `<tr><td>${badge(k)}</td><td>${pct(e[k])}</td><td>${ex.toFixed(2)}</td><td>${got}</td><td>${S.packs ? pct(got / S.packs) : '—'}</td><td class="${!S.packs ? '' : d >= 0 ? 'gain' : 'loss'}">${S.packs ? (d >= 0 ? '▲ +' : '▼ ') + d.toFixed(2) : '—'}</td></tr>`; }).join('') + '</tbody>';

  if (!$('#hist').children.length) $('#hist').innerHTML = '<div class="hist-empty">点击上方按钮开始模拟</div>';
  const sel = $('#chaseSel');
  if (!sel.options.length) {
    sel.innerHTML = ['RGB', 'SIR', 'FR', 'CC', 'IR', 'DR', 'PK'].map(k => `<optgroup label="${R[k].name}">${[...POOL[k]].sort((a, b) => b.p - a.p).map(c => `<option value="${c.id}">${esc(c.name)} ${c.n} · ${money(c.p)}</option>`).join('')}</optgroup>`).join('');
    sel.value = '30th-150';
  }
  renderChase();
}
$('#setPrice').onchange = e => { S.price = +e.target.value; save(); renderWallet(); renderStats(); };
$('#setRgb').onchange = e => { S.rgbN = +e.target.value; save(); prepare(); renderStats(); };
$('#btnReset').onclick = () => { if (!confirm('确定清空全部收藏与统计数据吗？此操作无法撤销。')) return; const keep = { sound: S.sound, price: S.price, rgbN: S.rgbN }; S = Object.assign(fresh(), keep); save(); renderWallet(); renderStats(); toast('已清空'); };

/* Monte Carlo */
const BINS = [0, 1, 1.5, 2, 3, 5, 10, 25, 50, 100, 1000, Infinity];
function simulate(n) {
  const vals = new Float64Array(n); let sum = 0, max = 0, win = 0;
  for (let i = 0; i < n; i++) { let v = 0; for (const c of rollPack()) v += c.p; vals[i] = v; sum += v; if (v > max) max = v; if (v >= S.price) win++; }
  const sorted = vals.slice().sort(), med = sorted[n >> 1], counts = new Array(BINS.length - 1).fill(0);
  for (const v of vals) { let b = 0; while (v >= BINS[b + 1]) b++; counts[b]++; }
  const mean = sum / n, mx = Math.max(...counts);
  $('#simKpis').innerHTML = `
    <div class="kpi"><small>平均值（样本 EV）</small><b>${money(mean)}</b><span>理论 EV ${money(packEV())}</span></div>
    <div class="kpi"><small>中位数</small><b>${money(med)}</b><span>一半的包低于此值</span></div>
    <div class="kpi"><small>回本概率</small><b>${pct(win / n, 1)}</b><span>单包价值 ≥ ${money(S.price)}</span></div>
    <div class="kpi"><small>最高单包</small><b>${money(max)}</b><span>${n.toLocaleString('en-US')} 包中</span></div>`;
  $('#hist').innerHTML = counts.map((c, i) => {
    const lab = BINS[i + 1] === Infinity ? `$${BINS[i].toLocaleString('en-US')}+` : `$${BINS[i]}–${BINS[i + 1]}`;
    const be = S.price >= BINS[i] && S.price < BINS[i + 1];
    return `<div class="hrow ${be ? 'be' : ''}" data-tip="单包价值 ${lab}\n${c.toLocaleString('en-US')} 包 · ${pct(c / n)}${be ? '\n← 卡包价格落在这一档' : ''}"><span>${lab}</span><div class="track"><i style="width:0" data-w="${(c / mx * 100).toFixed(2)}%"></i></div><b>${c ? pct(c / n, 1) : '0%'}</b></div>`;
  }).join('');
  requestAnimationFrame(() => $$('#hist i').forEach(i => i.style.width = i.dataset.w));
  $('#simNote').innerHTML = `平均值 ${money(mean)} 是中位数 ${money(med)} 的 <b>${(mean / med).toFixed(1)} 倍</b>：分布严重<b>右偏</b>，绝大多数包只值一两美元，平均数被极少数“大奖包”拉高。
    所以“每包 EV 为正”并不意味着你开一包就大概率赚钱——只有 <b>${pct(win / n, 1)}</b> 的包能回本。浅色条是卡包价格所在的区间。多跑几次 1,000 包的模拟，你会发现样本均值本身波动很大（方差巨大）；100,000 包才比较稳定。`;
}
$$('[data-sim]').forEach(b => b.onclick = () => { b.disabled = true; setTimeout(() => { simulate(+b.dataset.sim); b.disabled = false; }, 20); });

/* chase calculator */
function renderChase() {
  const c = BY_ID[$('#chaseSel').value]; if (!c) return;
  const p = cardOdds(c), n50 = Math.ceil(Math.log(.5) / Math.log(1 - p)), n90 = Math.ceil(Math.log(.1) / Math.log(1 - p)), exp = 1 / p;
  $('#chaseImg').src = img(c, true); $('#chaseImg').alt = c.name;
  $('#chaseKpis').innerHTML = `
    <div class="kpi"><small>单包命中率 p</small><b>${pct(p)}</b><span>${oneIn(p)} 包</span></div>
    <div class="kpi"><small>期望包数 1/p</small><b>${Math.round(exp).toLocaleString('en-US')}</b><span>花费 ${money(exp * S.price)}</span></div>
    <div class="kpi"><small>50% 概率抽到</small><b>${n50.toLocaleString('en-US')} 包</b><span>${money(n50 * S.price)}</span></div>
    <div class="kpi"><small>90% 概率抽到</small><b>${n90.toLocaleString('en-US')} 包</b><span>${money(n90 * S.price)}</span></div>
    <div class="kpi"><small>直接买单卡</small><b>${money(c.p)}</b><span>${c.ps} 市价</span></div>`;
  // curve P(n) = 1-(1-p)^n
  const W = 640, H = 220, L = 40, Rm = 14, T = 12, B = 28, nMax = Math.max(10, Math.ceil(Math.log(.02) / Math.log(1 - p)));
  const X = n => L + (W - L - Rm) * n / nMax, Y = q => T + (H - T - B) * (1 - q), P = n => 1 - Math.pow(1 - p, n);
  let d = ''; for (let i = 0; i <= 120; i++) { const n = nMax * i / 120; d += (i ? 'L' : 'M') + X(n).toFixed(1) + ' ' + Y(P(n)).toFixed(1); }
  const grid = [0, .25, .5, .75, 1].map(q => `<line x1="${L}" x2="${W - Rm}" y1="${Y(q)}" y2="${Y(q)}" stroke="#ffffff14"/><text x="${L - 6}" y="${Y(q) + 4}" text-anchor="end">${q * 100}%</text>`).join('');
  const ticks = [0, .25, .5, .75, 1].map(f => `<text x="${X(nMax * f)}" y="${H - 8}" text-anchor="middle">${Math.round(nMax * f).toLocaleString('en-US')} 包</text>`).join('');
  const mark = (n, lab) => `<circle cx="${X(n)}" cy="${Y(P(n))}" r="4.5" fill="#f6c84c" stroke="#10121d" stroke-width="2"/><text x="${X(n) + 8}" y="${Y(P(n)) + 14}" style="fill:#f4f2ea">${lab}</text>`;
  $('#curve').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="开 n 包后至少抽到一张的累计概率">${grid}${ticks}
    <path d="${d}L${X(nMax)} ${Y(0)}L${X(0)} ${Y(0)}Z" fill="#f6c84c14"/><path d="${d}" fill="none" stroke="#f6c84c" stroke-width="2" stroke-linejoin="round"/>
    ${mark(n50, '50%')}${mark(n90, '90%')}
    <g id="cross" visibility="hidden"><line y1="${T}" y2="${H - B}" stroke="#ffffff55" stroke-dasharray="3 3"/><circle r="4.5" fill="#fff" stroke="#10121d" stroke-width="2"/></g>
    <rect x="${L}" y="${T}" width="${W - L - Rm}" height="${H - T - B}" fill="transparent" id="hit"/></svg>`;
  const hit = $('#hit'), cross = $('#cross'), tip = $('#tip');
  hit.onpointermove = e => {
    const r = hit.getBoundingClientRect(), n = Math.max(0, Math.min(nMax, Math.round(nMax * (e.clientX - r.left) / r.width)));
    cross.setAttribute('visibility', 'visible'); cross.querySelector('line').setAttribute('x1', X(n)); cross.querySelector('line').setAttribute('x2', X(n));
    cross.querySelector('circle').setAttribute('cx', X(n)); cross.querySelector('circle').setAttribute('cy', Y(P(n)));
    showTip(`开 ${n.toLocaleString('en-US')} 包（${money(n * S.price)}）\n至少抽到一张的概率：${(P(n) * 100).toFixed(1)}%`, e);
  };
  hit.onpointerleave = () => { cross.setAttribute('visibility', 'hidden'); tip.hidden = true; };
  $('#chaseNote').innerHTML = `曲线是 <b>P(n) = 1 − (1 − p)<sup>n</sup></b>：开 n 包后至少抽到一张的概率。即使开到“期望包数” ${Math.round(exp).toLocaleString('en-US')} 包，也只有约 <b>63%</b> 的概率抽到（1 − 1/e）——运气不记账，之前没中不会让下一包更容易中（赌徒谬误）。
    ${exp * S.price > c.p ? `为了这一张卡去开包，期望花费是单卡市价的 <b>${(exp * S.price / c.p).toFixed(1)} 倍</b>；当然开包途中还会得到其他卡，但这正是“买单卡几乎总是更划算”的原因。` : ''}`;
}
$('#chaseSel').onchange = renderChase;

/* ---------- tooltip ---------- */
function showTip(text, e) {
  const t = $('#tip'); t.textContent = text; t.hidden = false;
  const w = t.offsetWidth, h = t.offsetHeight;
  t.style.left = Math.max(8, Math.min(innerWidth - w - 8, e.clientX + 14)) + 'px';
  t.style.top = Math.max(8, e.clientY - h - 12) + 'px';
}
document.addEventListener('pointermove', e => { if (e.target.closest && e.target.closest('#hit')) return; const el = e.target.closest && e.target.closest('[data-tip]'); if (el) showTip(el.dataset.tip, e); else $('#tip').hidden = true; });

/* ---------- boot ---------- */
$('#btnSound').onclick = () => { S.sound = !S.sound; save(); renderWallet(); if (S.sound) sfx.keep(); };
packEl.style.setProperty('--pack-img', `url(${PACK_IMG})`);
renderWallet(); resetPack();
nav(location.hash.slice(1) || 'open');
addEventListener('hashchange', () => nav(location.hash.slice(1)));
})();
