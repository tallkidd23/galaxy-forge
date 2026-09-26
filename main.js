(function () {
  'use strict';
  const canvas = document.getElementById('simCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const particles = [];
  const wells = [];
  let mode = 'stream';
  let gravity = 9;
  let fade = 0.06;
  let spread = 12;
  let dragging = false;
  let last = null;

  const status = document.getElementById('hintText');
  const countEl = document.getElementById('particleVal');
  const gravityEl = document.getElementById('gravVal');
  const fadeEl = document.getElementById('fadeVal');
  const spreadEl = document.getElementById('spreadVal');
  const countSlider = document.getElementById('particleCount');

  function edgeParticle() {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = Math.random() * W; y = 2; }
    else if (side === 1) { x = Math.random() * W; y = H - 2; }
    else if (side === 2) { x = 2; y = Math.random() * H; }
    else { x = W - 2; y = Math.random() * H; }
    const dx = W / 2 - x;
    const dy = H / 2 - y;
    const d = Math.hypot(dx, dy) || 1;
    const tangentX = -dy / d;
    const tangentY = dx / d;
    const speed = 0.5 + Math.random() * 0.6;
    return { x, y, vx: dx / d * speed * 0.45 + tangentX * speed * 0.55, vy: dy / d * speed * 0.45 + tangentY * speed * 0.55 };
  }

  function setParticleCount(n) {
    while (particles.length < n) particles.push(edgeParticle());
    particles.length = n;
  }

  function addWell(x, y, blackHole) {
    wells.push({ x, y, mass: blackHole ? 26000 : 6000, blackHole, radius: blackHole ? 10 : 0 });
  }

  function removeWell(x, y) {
    let index = -1;
    let best = 60;
    wells.forEach((well, i) => {
      const d = Math.hypot(well.x - x, well.y - y);
      if (d < best) { best = d; index = i; }
    });
    if (index >= 0) wells.splice(index, 1);
  }

  function resetParticles() {
    particles.length = 0;
    setParticleCount(Number(countSlider.value));
  }

  function presetBigBang() {
    wells.length = 0;
    addWell(W / 2, H / 2, true);
    particles.forEach(p => {
      const angle = Math.random() * Math.PI * 2;
      const radius = 35 + Math.random() * 110;
      p.x = W / 2 + Math.cos(angle) * radius;
      p.y = H / 2 + Math.sin(angle) * radius;
      const speed = 2.5 + Math.random() * 1.5;
      p.vx = -Math.sin(angle) * speed;
      p.vy = Math.cos(angle) * speed;
    });
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * W / rect.width, y: (event.clientY - rect.top) * H / rect.height };
  }

  function streamAt(x, y, dx, dy) {
    const angle = Math.atan2(dy, dx);
    const amount = Math.min(6, Math.hypot(dx, dy) * 0.35 + 1.2);
    const cone = spread * Math.PI / 180;
    for (let i = 0; i < 10; i++) {
      const p = particles[Math.floor(Math.random() * particles.length)];
      if (!p) return;
      const a = angle + (Math.random() - 0.5) * cone;
      p.x = x + (Math.random() - 0.5) * 6;
      p.y = y + (Math.random() - 0.5) * 6;
      p.vx = Math.cos(a) * amount;
      p.vy = Math.sin(a) * amount;
    }
  }

  function physics() {
    particles.forEach(p => {
      let ax = 0, ay = 0;
      wells.forEach(well => {
        const dx = well.x - p.x;
        const dy = well.y - p.y;
        const r2 = dx * dx + dy * dy + 14 * 14;
        const invR = 1 / Math.sqrt(r2);
        const force = gravity * well.mass * invR * invR * invR;
        ax += dx * force;
        ay += dy * force;
      });
      p.vx += ax * 0.0016;
      p.vy += ay * 0.0016;
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > 14) { p.vx = p.vx / speed * 14; p.vy = p.vy / speed * 14; }
      p.x += p.vx;
      p.y += p.vy;
      let eaten = false;
      wells.forEach(well => {
        if (well.blackHole && Math.hypot(well.x - p.x, well.y - p.y) < well.radius) {
          eaten = true;
          well.mass = Math.min(120000, well.mass + 12);
          well.radius = Math.min(34, well.radius + 0.02);
        }
      });
      if (eaten || p.x < -40 || p.x > W + 40 || p.y < -40 || p.y > H + 40) Object.assign(p, edgeParticle());
    });
  }

  function color(speed) {
    const t = Math.max(0, Math.min(1, speed / 9));
    const palette = [[18,26,70],[40,110,200],[90,210,220],[255,196,90],[255,100,180],[255,255,255]];
    const position = t * (palette.length - 1);
    const i = Math.min(palette.length - 2, Math.floor(position));
    const f = position - i;
    const a = palette[i], b = palette[i + 1];
    return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
  }

  function render() {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(0,0,4,${fade})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    particles.forEach(p => { ctx.fillStyle = color(Math.hypot(p.vx, p.vy)); ctx.fillRect(p.x, p.y, 2, 2); });
    wells.forEach(well => {
      const r = well.blackHole ? well.radius * 3.5 : 24;
      const glow = ctx.createRadialGradient(well.x, well.y, 0, well.x, well.y, r);
      glow.addColorStop(0, well.blackHole ? 'rgba(255,220,130,.95)' : 'rgba(255,255,255,.95)');
      glow.addColorStop(0.35, well.blackHole ? 'rgba(255,90,180,.45)' : 'rgba(100,200,255,.5)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(well.x, well.y, r, 0, Math.PI * 2); ctx.fill();
      if (well.blackHole) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(well.x, well.y, well.radius, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
      }
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  function setMode(next) {
    mode = next;
    const buttons = { stream: 'modeStream', blackhole: 'modeBlackhole', star: 'modeStar', erase: 'modeErase' };
    Object.entries(buttons).forEach(([key, id]) => document.getElementById(id).classList.toggle('active', key === mode));
    status.textContent = ({stream:'Drag on the canvas to launch stars.', blackhole:'Tap the canvas to place a black hole.', star:'Tap the canvas to place a star.', erase:'Tap near a gravity well to remove it.'})[mode];
  }

  canvas.addEventListener('pointerdown', event => {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    const p = canvasPoint(event);
    if (mode === 'blackhole') return addWell(p.x, p.y, true);
    if (mode === 'star') return addWell(p.x, p.y, false);
    if (mode === 'erase') return removeWell(p.x, p.y);
    dragging = true;
    last = p;
  });
  canvas.addEventListener('pointermove', event => {
    if (!dragging || mode !== 'stream') return;
    event.preventDefault();
    const p = canvasPoint(event);
    streamAt(p.x, p.y, p.x - last.x, p.y - last.y);
    last = p;
  });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointercancel', () => { dragging = false; });

  document.getElementById('modeStream').onclick = () => setMode('stream');
  document.getElementById('modeBlackhole').onclick = () => setMode('blackhole');
  document.getElementById('modeStar').onclick = () => setMode('star');
  document.getElementById('modeErase').onclick = () => setMode('erase');
  document.getElementById('presetClear').onclick = () => { wells.length = 0; resetParticles(); };
  document.getElementById('presetBigBang').onclick = presetBigBang;
  document.getElementById('gravity').oninput = event => { gravity = Number(event.target.value) * 0.9; gravityEl.textContent = (Number(event.target.value) / 10).toFixed(1); };
  countSlider.oninput = event => { setParticleCount(Number(event.target.value)); countEl.textContent = event.target.value; };
  document.getElementById('trailFade').oninput = event => { fade = Number(event.target.value) / 100; fadeEl.textContent = fade.toFixed(2); };
  document.getElementById('spread').oninput = event => { spread = Number(event.target.value); spreadEl.textContent = `${spread}\u00B0`; };

  setParticleCount(Number(countSlider.value));
  presetBigBang();
  status.textContent = 'Ready: drag the canvas, or choose a placement mode.';

  function loop() { physics(); render(); requestAnimationFrame(loop); }
  loop();
})();