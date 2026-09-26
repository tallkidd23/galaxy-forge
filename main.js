/*
  GALAXY FORGE
  Interactive 2D gravity sandbox with particles, stars, and black holes.
*/
(function () {
  'use strict';

  const canvas = document.getElementById('simCanvas');
  const ctx = canvas.getContext('2d');
  const SIZE = canvas.width;
  const SOFTENING = 14;
  const dt = 1;

  let attractors = [];
  let particles = [];
  let G = 9;
  let fadeAlpha = 0.06;
  let spreadDeg = 12;
  let mode = 'stream';
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function addAttractor(x, y, isBlackHole) {
    attractors.push({x, y, mass: isBlackHole ? 26000 : 6000, isBlackHole, eventHorizon: isBlackHole ? 10 : 0, maxMass: isBlackHole ? 120000 : 6000});
  }
  function eraseNearest(x, y) {
    let best = -1, distance = Infinity;
    attractors.forEach((a, i) => { const d = Math.hypot(a.x - x, a.y - y); if (d < distance) { distance = d; best = i; } });
    if (best >= 0 && distance < 60) attractors.splice(best, 1);
  }
  function randomEdgeSpawn() {
    const side = Math.floor(Math.random() * 4);
    if (side === 0) return [Math.random() * SIZE, 4];
    if (side === 1) return [Math.random() * SIZE, SIZE - 4];
    if (side === 2) return [4, Math.random() * SIZE];
    return [SIZE - 4, Math.random() * SIZE];
  }
  function makeParticle() {
    const [x, y] = randomEdgeSpawn();
    const dx = SIZE / 2 - x, dy = SIZE / 2 - y, distance = Math.hypot(dx, dy) || 1;
    const speed = 0.45 + Math.random() * 0.6;
    const tx = -dy / distance, ty = dx / distance, mix = 0.55;
    return {x, y, vx: dx / distance * speed * (1 - mix) + tx * speed * mix, vy: dy / distance * speed * (1 - mix) + ty * speed * mix, hueOffset: Math.random()};
  }
  function setParticleCount(count) {
    if (count > particles.length) while (particles.length < count) particles.push(makeParticle());
    else particles.length = count;
  }
  function spawnStream(x, y, dx, dy) {
    const baseAngle = Math.atan2(dy, dx), spread = spreadDeg * Math.PI / 180;
    const speed = Math.min(6, Math.hypot(dx, dy) * 0.35 + 1.2);
    for (let i = 0; i < 8; i++) {
      const p = particles[Math.floor(Math.random() * particles.length)];
      if (!p) return;
      const angle = baseAngle + (Math.random() - 0.5) * spread;
      p.x = x + (Math.random() - 0.5) * 5; p.y = y + (Math.random() - 0.5) * 5;
      p.vx = Math.cos(angle) * speed; p.vy = Math.sin(angle) * speed;
    }
  }
  function resetParticles() { particles = []; setParticleCount(Number(document.getElementById('particleCount').value)); }
  function stepPhysics() {
    for (const p of particles) {
      let ax = 0, ay = 0;
      for (const a of attractors) {
        const dx = a.x - p.x, dy = a.y - p.y;
        const distanceSquared = dx * dx + dy * dy + SOFTENING * SOFTENING;
        const inverseDistance = 1 / Math.sqrt(distanceSquared);
        const force = G * a.mass * inverseDistance * inverseDistance * inverseDistance;
        ax += force * dx; ay += force * dy;
      }
      p.vx += ax * 0.0016 * dt; p.vy += ay * 0.0016 * dt;
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > 14) { p.vx = p.vx / speed * 14; p.vy = p.vy / speed * 14; }
      p.x += p.vx; p.y += p.vy;
      let consumed = false;
      for (const a of attractors) {
        if (!a.isBlackHole) continue;
        if (Math.hypot(a.x - p.x, a.y - p.y) < a.eventHorizon) { consumed = true; a.mass = Math.min(a.maxMass, a.mass + 12); a.eventHorizon = Math.min(34, a.eventHorizon + 0.02); break; }
      }
      const outside = p.x < -40 || p.x > SIZE + 40 || p.y < -40 || p.y > SIZE + 40;
      if (consumed || outside) Object.assign(p, makeParticle());
    }
  }
  const stops = [[0, [18, 26, 70]], [0.22, [40, 110, 200]], [0.45, [90, 210, 220]], [0.65, [255, 196, 90]], [0.82, [255, 100, 180]], [1, [255, 255, 255]]];
  function particleColor(speed) {
    const t = Math.max(0, Math.min(1, speed / 9));
    let left = stops[0], right = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) if (t >= stops[i][0] && t <= stops[i + 1][0]) { left = stops[i]; right = stops[i + 1]; break; }
    const local = (t - left[0]) / ((right[0] - left[0]) || 1);
    const c = left[1].map((v, i) => Math.round(v + (right[1][i] - v) * local));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  function drawAttractors() {
    for (const a of attractors) {
      if (a.isBlackHole) {
        const radius = a.eventHorizon * 3.4;
        const glow = ctx.createRadialGradient(a.x, a.y, a.eventHorizon * 0.6, a.x, a.y, radius);
        glow.addColorStop(0, 'rgba(255,200,120,0.9)'); glow.addColorStop(0.35, 'rgba(255,120,180,0.4)'); glow.addColorStop(1, 'rgba(255,120,180,0)');
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(a.x, a.y, radius, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(a.x, a.y, a.eventHorizon, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,220,160,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(a.x, a.y, a.eventHorizon + 1.5, 0, Math.PI * 2); ctx.stroke();
      } else {
        const radius = 24, glow = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, radius);
        glow.addColorStop(0, 'rgba(255,255,255,0.95)'); glow.addColorStop(0.3, 'rgba(120,200,255,0.5)'); glow.addColorStop(1, 'rgba(120,200,255,0)');
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(a.x, a.y, radius, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  function render() {
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(0,0,4,${fadeAlpha})`; ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) { ctx.fillStyle = particleColor(Math.hypot(p.vx, p.vy)); ctx.fillRect(p.x, p.y, 1.8, 1.8); }
    drawAttractors(); ctx.globalCompositeOperation = 'source-over';
  }
  function canvasPosition(event) {
    const rect = canvas.getBoundingClientRect(), point = event.touches ? event.touches[0] : event;
    return [(point.clientX - rect.left) * SIZE / rect.width, (point.clientY - rect.top) * SIZE / rect.height];
  }
  function setMode(nextMode) {
    mode = nextMode;
    const buttons = {stream: document.getElementById('modeStream'), blackhole: document.getElementById('modeBlackhole'), star: document.getElementById('modeStar'), erase: document.getElementById('modeErase')};
    Object.entries(buttons).forEach(([key, button]) => button.classList.toggle('active', key === mode));
    const hints = {stream: 'Drag anywhere to launch a stream of stars in that direction.', blackhole: 'Tap to drop a black hole. Matter crossing its event horizon is recycled.', star: 'Tap to place a lighter gravity well that pulls but does not consume.', erase: 'Tap near a well to remove it.'};
    document.getElementById('hintText').textContent = hints[mode];
  }
  function pointerDown(event) {
    event.preventDefault(); const [x, y] = canvasPosition(event);
    if (mode === 'blackhole') return addAttractor(x, y, true);
    if (mode === 'star') return addAttractor(x, y, false);
    if (mode === 'erase') return eraseNearest(x, y);
    dragging = true; lastX = x; lastY = y;
  }
  function pointerMove(event) {
    if (!dragging || mode !== 'stream') return;
    event.preventDefault(); const [x, y] = canvasPosition(event);
    if (Math.hypot(x - lastX, y - lastY) > 1) spawnStream(x, y, x - lastX, y - lastY);
    lastX = x; lastY = y;
  }
  function pointerUp() { dragging = false; }
  canvas.addEventListener('mousedown', pointerDown); canvas.addEventListener('mousemove', pointerMove); window.addEventListener('mouseup', pointerUp);
  canvas.addEventListener('touchstart', pointerDown, {passive: false}); canvas.addEventListener('touchmove', pointerMove, {passive: false}); canvas.addEventListener('touchend', pointerUp);
  document.getElementById('modeStream').onclick = () => setMode('stream'); document.getElementById('modeBlackhole').onclick = () => setMode('blackhole'); document.getElementById('modeStar').onclick = () => setMode('star'); document.getElementById('modeErase').onclick = () => setMode('erase');
  document.getElementById('presetClear').onclick = () => { attractors = []; resetParticles(); };
  document.getElementById('presetBigBang').onclick = () => {
    attractors = []; addAttractor(SIZE / 2, SIZE / 2, true);
    for (const p of particles) { const angle = Math.random() * Math.PI * 2, radius = 40 + Math.random() * 100; p.x = SIZE / 2 + Math.cos(angle) * radius; p.y = SIZE / 2 + Math.sin(angle) * radius; const speed = 2.5 + Math.random() * 1.5; p.vx = -Math.sin(angle) * speed; p.vy = Math.cos(angle) * speed; }
  };
  const gravity = document.getElementById('gravity'); gravity.oninput = () => { G = Number(gravity.value) * 0.9; document.getElementById('gravVal').textContent = (Number(gravity.value) / 10).toFixed(1); };
  const particleSlider = document.getElementById('particleCount'); particleSlider.oninput = () => { setParticleCount(Number(particleSlider.value)); document.getElementById('particleVal').textContent = particleSlider.value; };
  const fadeSlider = document.getElementById('trailFade'); fadeSlider.oninput = () => { fadeAlpha = Number(fadeSlider.value) / 100; document.getElementById('fadeVal').textContent = fadeAlpha.toFixed(2); };
  const spreadSlider = document.getElementById('spread'); spreadSlider.oninput = () => { spreadDeg = Number(spreadSlider.value); document.getElementById('spreadVal').textContent = `${spreadDeg}\u00B0`; };
  setParticleCount(Number(particleSlider.value)); document.getElementById('presetBigBang').click(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SIZE, SIZE);
  function loop() { stepPhysics(); render(); requestAnimationFrame(loop); }
  loop();
})();