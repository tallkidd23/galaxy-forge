/* ============================================================
   GALAXY FORGE
   N-body gravity sandbox: particles feel Newtonian (softened)
   gravity from user-placed wells. Black holes consume matter
   inside their event horizon and recycle it as fresh particles
   elsewhere, so the population never runs out. Color is a
   false-color gradient in the spirit of JWST/Hubble composites.
   ============================================================

(function () {
  const canvas = document.getElementById('simCanvas');
  const ctx = canvas.getContext('2d');
  const SIZE = canvas.width;
  const SOFTENING = 14;

  let attractors = [];

  function addAttractor(x, y, isBlackHole) {
    attractors.push({
      x, y,
      mass: isBlackHole ? 26000 : 6000,
      isBlackHole,
      eventHorizon: isBlackHole ? 10 : 0,
      maxMass: isBlackHole ? 120000 : 6000
    });
  }

  function eraseNearest(x, y) {
    if (!attractors.length) return;
    let bestIdx = -1, bestDist = Infinity;
    attractors.forEach((a, i) => {
      const d = Math.hypot(a.x - x, a.y - y);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    if (bestIdx >= 0 && bestDist < 60) attractors.splice(bestIdx, 1);
  }

  let particles = [];
  let G = 10 * 0.9;

  function randomEdgeSpawn() {
    const side = Math.floor(Math.random() * 4);
    const margin = 4;
    if (side === 0) return [Math.random() * SIZE, margin];
    if (side === 1) return [Math.random() * SIZE, SIZE - margin];
    if (side === 2) return [margin, Math.random() * SIZE];
    return [SIZE - margin, Math.random() * SIZE];
  }

  function makeDriftingParticle() {
    const [x, y] = randomEdgeSpawn();
    const cx = SIZE / 2, cy = SIZE / 2;
    const dx = cx - x, dy = cy - y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = 0.4 + Math.random() * 0.6;
    const tx = -dy / dist, ty = dx / dist;
    const mix = 0.55;
    return {
      x, y,
      vx: (dx / dist) * speed * (1 - mix) + tx * speed * mix,
      vy: (dy / dist) * speed * (1 - mix) + ty * speed * mix,
      trail: Math.random()
    };
  }

  function setParticleCount(n) {
    if (n > particles.length) {
      while (particles.length < n) particles.push(makeDriftingParticle());
    } else {
      particles.length = n;
    }
  }

  function spawnStream(x, y, dirX, dirY, spreadDeg, count) {
    const baseAngle = Math.atan2(dirY, dirX);
    const spreadRad = (spreadDeg * Math.PI) / 180;
    const speed = Math.min(6, Math.hypot(dirX, dirY) * 0.35 + 1.2);
    for (let k = 0; k < count; k++) {
      const angle = baseAngle + (Math.random() - 0.5) * spreadRad;
      const p = particles[Math.floor(Math.random() * particles.length)];
      if (!p) continue;
      p.x = x + (Math.random() - 0.5) * 4;
      p.y = y + (Math.random() - 0.5) * 4;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.trail = Math.random();
    }
  }

  const dt = 1.0;

  function stepPhysics() {
    for (const p of particles) {
      let ax = 0, ay = 0;
      for (const a of attractors) {
        const dx = a.x - p.x;
        const dy = a.y - p.y;
        const distSq = dx * dx + dy * dy + SOFTENING * SOFTENING;
        const invDist = 1 / Math.sqrt(distSq);
        const invDist3 = invDist * invDist * invDist;
        const f = G * a.mass * invDist3;
        ax += f * dx;
        ay += f * dy;
      }
      p.vx += ax * dt * 0.0016;
      p.vy += ay * dt * 0.0016;

      const speed = Math.hypot(p.vx, p.vy);
      const maxSpeed = 14;
      if (speed > maxSpeed) {
        p.vx = (p.vx / speed) * maxSpeed;
        p.vy = (p.vy / speed) * maxSpeed;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      let consumed = false;
      for (const a of attractors) {
        if (!a.isBlackHole) continue;
        const d = Math.hypot(a.x - p.x, a.y - p.y);
        if (d < a.eventHorizon) {
          consumed = true;
          if (a.mass < a.maxMass) a.mass += 12;
          if (a.eventHorizon < 34) a.eventHorizon += 0.02;
          break;
        }
      }

      const off = p.x < -40 || p.x > SIZE + 40 || p.y < -40 || p.y > SIZE + 40;
      if (consumed || off) Object.assign(p, makeDriftingParticle());
    }
  }

  const stops = [
    { t: 0.00, c: [18, 26, 70] },
    { t: 0.22, c: [40, 110, 200] },
    { t: 0.45, c: [90, 210, 220] },
    { t: 0.65, c: [255, 196, 90] },
    { t: 0.82, c: [255, 100, 180] },
    { t: 1.00, c: [255, 255, 255] }
  ];
  function colorForSpeed(speed) {
    const t = Math.max(0, Math.min(1, speed / 9));
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i].t && t <= stops[i + 1].t) { a = stops[i]; b = stops[i + 1]; break; }
    }
    const localT = (t - a.t) / ((b.t - a.t) || 1);
    const r = Math.round(a.c[0] + (b.c[0] - a.c[0]) * localT);
    const g = Math.round(a.c[1] + (b.c[1] - a.c[1]) * localT);
    const bl = Math.round(a.c[2] + (b.c[2] - a.c[2]) * localT);
    return `rgb(${r},${g},${bl})`;
  }

  let fadeAlpha = 0.06;

  function drawAttractors() {
    for (const a of attractors) {
      if (a.isBlackHole) {
        const glowR = a.eventHorizon * 3.4;
        const grad = ctx.createRadialGradient(a.x, a.y, a.eventHorizon * 0.6, a.x, a.y, glowR);
        grad.addColorStop(0, 'rgba(255,200,120,0.9)');
        grad.addColorStop(0.35, 'rgba(255,120,180,0.4)');
        grad.addColorStop(1, 'rgba(255,120,180,0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(a.x, a.y, glowR, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.eventHorizon, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255,220,160,0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.eventHorizon + 1.5, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const glowR = 24;
        const grad = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, glowR);
        grad.addColorStop(0, 'rgba(255,255,255,0.95)');
        grad.addColorStop(0.3, 'rgba(120,200,255,0.5)');
        grad.addColorStop(1, 'rgba(120,200,255,0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(a.x, a.y, glowR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawParticles() {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      const speed = Math.hypot(p.vx, p.vy);
      ctx.fillStyle = colorForSpeed(speed);
      ctx.fillRect(p.x, p.y, 1.6, 1.6);
    }
  }

  function render() {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(0,0,4,${fadeAlpha})`;
    ctx.fillRect(0, 0, SIZE, SIZE);
    drawParticles();
    drawAttractors();
    ctx.globalCompositeOperation = 'source-over';
  }

  function loop() {
    stepPhysics();
    render();
    requestAnimationFrame(loop);
  }

  let mode = 'stream';
  let dragging = false;
  let lastX = 0, lastY = 0;

  function canvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = SIZE / rect.width;
    const scaleY = SIZE / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return [(clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY];
  }

  let spreadDeg = 12;

  function handleDown(e) {
    e.preventDefault();
    const [x, y] = canvasPos(e);
    if (mode === 'blackhole') { addAttractor(x, y, true); return; }
    if (mode === 'star') { addAttractor(x, y, false); return; }
    if (mode === 'erase') { eraseNearest(x, y); return; }
    dragging = true;
    lastX = x; lastY = y;
  }
  function handleMove(e) {
    if (!dragging || mode !== 'stream') return;
    e.preventDefault();
    const [x, y] = canvasPos(e);
    const dx = x - lastX, dy = y - lastY;
    if (Math.hypot(dx, dy) > 1) spawnStream(x, y, dx, dy, spreadDeg, 6);
    lastX = x; lastY = y;
  }
  function handleUp() { dragging = false; }

  canvas.addEventListener('mousedown', handleDown);
  canvas.addEventListener('mousemove', handleMove);
  window.addEventListener('mouseup', handleUp);
  canvas.addEventListener('touchstart', handleDown, { passive: false });
  canvas.addEventListener('touchmove', handleMove, { passive: false });
  canvas.addEventListener('touchend', handleUp);

  const modeButtons = {
    stream: document.getElementById('modeStream'),
    blackhole: document.getElementById('modeBlackhole'),
    star: document.getElementById('modeStar'),
    erase: document.getElementById('modeErase')
  };
  const hintText = document.getElementById('hintText');
  const hints = {
    stream: 'Drag anywhere to launch a stream of stars in that direction.',
    blackhole: 'Tap to drop a black hole. Matter that crosses its event horizon is consumed and recycled.',
    star: 'Tap to place a lighter gravity well — a star that pulls but does not consume.',
    erase: 'Tap near a well to remove it.'
  };
  function setMode(m) {
    mode = m;
    Object.entries(modeButtons).forEach(([k, btn]) => btn.classList.toggle('active', k === m));
    hintText.textContent = hints[m];
  }
  modeButtons.stream.onclick = () => setMode('stream');
  modeButtons.blackhole.onclick = () => setMode('blackhole');
  modeButtons.star.onclick = () => setMode('star');
  modeButtons.erase.onclick = () => setMode('erase');

  document.getElementById('presetClear').onclick = () => {
    attractors = [];
    setParticleCount(0);
    setParticleCount(+particleSlider.value);
  };

  document.getElementById('presetBigBang').onclick = () => {
    attractors = [];
    addAttractor(SIZE / 2, SIZE / 2, true);
    const cx = SIZE / 2, cy = SIZE / 2;
    for (const p of particles) {
      const angle = Math.random() * Math.PI * 2;
      const r = 40 + Math.random() * 60;
      p.x = cx + Math.cos(angle) * r;
      p.y = cy + Math.sin(angle) * r;
      const speed = 2.5 + Math.random() * 1.5;
      p.vx = -Math.sin(angle) * speed;
      p.vy = Math.cos(angle) * speed;
    }
  };

  const gravSlider = document.getElementById('gravity');
  const gravVal = document.getElementById('gravVal');
  gravSlider.oninput = () => {
    G = (+gravSlider.value) * 0.9;
    gravVal.textContent = (+gravSlider.value / 10).toFixed(1);
  };

  const particleSlider = document.getElementById('particleCount');
  const particleVal = document.getElementById('particleVal');
  particleSlider.oninput = () => {
    setParticleCount(+particleSlider.value);
    particleVal.textContent = particleSlider.value;
  };

  const fadeSlider = document.getElementById('trailFade');
  const fadeVal = document.getElementById('fadeVal');
  fadeSlider.oninput = () => {
    fadeAlpha = (+fadeSlider.value) / 100;
    fadeVal.textContent = fadeAlpha.toFixed(2);
  };

  const spreadSlider = document.getElementById('spread');
  const spreadVal = document.getElementById('spreadVal');
  spreadSlider.oninput = () => {
    spreadDeg = +spreadSlider.value;
    spreadVal.textContent = spreadDeg + '\u00B0';
  };

  setParticleCount(+particleSlider.value);
  document.getElementById('presetBigBang').click();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, SIZE, SIZE);
  loop();
})();
