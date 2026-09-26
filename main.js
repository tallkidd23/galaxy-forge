(function () {
  "use strict";

  const canvas = document.getElementById("simCanvas");
  const ctx = canvas.getContext("2d");

  const W = canvas.width;
  const H = canvas.height;

  const particles = [];
  const wells = [];

  let mode = "stream";
  let gravity = 9;
  let fade = 0.06;
  let spread = 12;
  let dragging = false;
  let lastPoint = null;

  const status = document.getElementById("hintText");
  const countSlider = document.getElementById("particleCount");

  const countValue = document.getElementById("particleVal");
  const gravityValue = document.getElementById("gravVal");
  const fadeValue = document.getElementById("fadeVal");
  const spreadValue = document.getElementById("spreadVal");

  function createEdgeParticle() {
    const side = Math.floor(Math.random() * 4);

    let x;
    let y;

    if (side === 0) {
      x = Math.random() * W;
      y = 2;
    } else if (side === 1) {
      x = Math.random() * W;
      y = H - 2;
    } else if (side === 2) {
      x = 2;
      y = Math.random() * H;
    } else {
      x = W - 2;
      y = Math.random() * H;
    }

    const dx = W / 2 - x;
    const dy = H / 2 - y;
    const distance = Math.hypot(dx, dy) || 1;

    const speed = 0.5 + Math.random() * 0.6;

    const radialX = dx / distance;
    const radialY = dy / distance;

    const tangentX = -dy / distance;
    const tangentY = dx / distance;

    return {
      x,
      y,
      vx: radialX * speed * 0.45 + tangentX * speed * 0.55,
      vy: radialY * speed * 0.45 + tangentY * speed * 0.55,
      heat: 0
    };
  }

  function setParticleCount(amount) {
    while (particles.length < amount) {
      particles.push(createEdgeParticle());
    }

    particles.length = amount;
  }

  function addGravityWell(x, y, blackHole) {
    wells.push({
      x,
      y,
      blackHole,
      mass: blackHole ? 26000 : 6000,
      radius: blackHole ? 10 : 0
    });
  }

  function removeNearestWell(x, y) {
    let nearestIndex = -1;
    let nearestDistance = 60;

    wells.forEach((well, index) => {
      const distance = Math.hypot(well.x - x, well.y - y);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    if (nearestIndex >= 0) {
      wells.splice(nearestIndex, 1);
    }
  }

  function resetParticles() {
    particles.length = 0;
    setParticleCount(Number(countSlider.value));
  }

  function createBigBang() {
    wells.length = 0;

    addGravityWell(W / 2, H / 2, true);

    particles.forEach((particle) => {
      const angle = Math.random() * Math.PI * 2;
      const radius = 35 + Math.random() * 110;

      particle.x = W / 2 + Math.cos(angle) * radius;
      particle.y = H / 2 + Math.sin(angle) * radius;

      const speed = 2.5 + Math.random() * 1.5;

      particle.vx = -Math.sin(angle) * speed;
      particle.vy = Math.cos(angle) * speed;
      particle.heat = 1;
    });
  }

  function getCanvasPoint(event) {
    const rect = canvas.getBoundingClientRect();

    return {
      x: ((event.clientX - rect.left) / rect.width) * W,
      y: ((event.clientY - rect.top) / rect.height) * H
    };
  }

  function injectStream(x, y, dx, dy) {
    const angle = Math.atan2(dy, dx);
    const distance = Math.hypot(dx, dy);

    const speed = Math.min(6, distance * 0.35 + 1.2);
    const spreadRadians = (spread * Math.PI) / 180;

    for (let i = 0; i < 10; i++) {
      const particle =
        particles[Math.floor(Math.random() * particles.length)];

      if (!particle) {
        return;
      }

      const streamAngle =
        angle + (Math.random() - 0.5) * spreadRadians;

      particle.x = x + (Math.random() - 0.5) * 6;
      particle.y = y + (Math.random() - 0.5) * 6;

      particle.vx = Math.cos(streamAngle) * speed;
      particle.vy = Math.sin(streamAngle) * speed;
      particle.heat = 0;
    }
  }

  function updatePhysics() {
    particles.forEach((particle) => {
      let accelerationX = 0;
      let accelerationY = 0;

      let nearestBlackHole = null;
      let nearestBlackHoleDistance = Infinity;

      wells.forEach((well) => {
        const dx = well.x - particle.x;
        const dy = well.y - particle.y;
        const distance = Math.hypot(dx, dy);

        if (
          well.blackHole &&
          distance < nearestBlackHoleDistance
        ) {
          nearestBlackHole = well;
          nearestBlackHoleDistance = distance;
        }

        const softenedDistanceSquared =
          dx * dx + dy * dy + 14 * 14;

        const inverseDistance =
          1 / Math.sqrt(softenedDistanceSquared);

        const force =
          gravity *
          well.mass *
          inverseDistance *
          inverseDistance *
          inverseDistance;

        accelerationX += dx * force;
        accelerationY += dy * force;
      });

      /*
        Accretion disk behavior:
        particles close to a black hole receive tangential
        orbital energy and heat up as they approach it.
      */
      if (
        nearestBlackHole &&
        nearestBlackHoleDistance < 230
      ) {
        const dx = nearestBlackHole.x - particle.x;
        const dy = nearestBlackHole.y - particle.y;
        const distance = Math.max(1, nearestBlackHoleDistance);

        const tangentX = -dy / distance;
        const tangentY = dx / distance;

        const orbitalBoost =
          ((230 - distance) / 230) * 0.065;

        particle.vx += tangentX * orbitalBoost;
        particle.vy += tangentY * orbitalBoost;

        const proximityHeat =
          (230 - distance) / 180;

        const speedHeat =
          Math.hypot(particle.vx, particle.vy) / 18;

        particle.heat = Math.max(
          particle.heat * 0.985,
          Math.min(1, proximityHeat + speedHeat)
        );
      } else {
        particle.heat *= 0.995;
      }

      particle.vx += accelerationX * 0.0016;
      particle.vy += accelerationY * 0.0016;

      const speed = Math.hypot(
        particle.vx,
        particle.vy
      );

      if (speed > 14) {
        particle.vx = (particle.vx / speed) * 14;
        particle.vy = (particle.vy / speed) * 14;
      }

      particle.x += particle.vx;
      particle.y += particle.vy;

      let consumed = false;

      wells.forEach((well) => {
        if (!well.blackHole) {
          return;
        }

        const distance = Math.hypot(
          well.x - particle.x,
          well.y - particle.y
        );

        if (distance < well.radius) {
          consumed = true;

          well.mass = Math.min(
            120000,
            well.mass + 12
          );

          well.radius = Math.min(
            34,
            well.radius + 0.02
          );
        }
      });

      const outside =
        particle.x < -40 ||
        particle.x > W + 40 ||
        particle.y < -40 ||
        particle.y > H + 40;

      if (consumed || outside) {
        Object.assign(particle, createEdgeParticle());
      }
    });
  }

  function particleColor(particle) {
    const velocityHeat = Math.min(
      1,
      Math.hypot(particle.vx, particle.vy) / 10
    );

    const heat =
      particle.heat * 0.75 +
      velocityHeat * 0.25;

    const t = Math.max(0, Math.min(1, heat));

    const palette = [
      [18, 26, 70],
      [35, 110, 210],
      [70, 220, 235],
      [255, 170, 60],
      [255, 80, 160],
      [255, 255, 255]
    ];

    const position = t * (palette.length - 1);
    const index = Math.min(
      palette.length - 2,
      Math.floor(position)
    );

    const amount = position - index;

    const left = palette[index];
    const right = palette[index + 1];

    const r = Math.round(
      left[0] + (right[0] - left[0]) * amount
    );

    const g = Math.round(
      left[1] + (right[1] - left[1]) * amount
    );

    const b = Math.round(
      left[2] + (right[2] - left[2]) * amount
    );

    return `rgb(${r}, ${g}, ${b})`;
  }

  function drawAccretionDisk(blackHole) {
    const innerRadius = Math.max(
      12,
      blackHole.radius * 2
    );

    const outerRadius = 110;

    ctx.globalCompositeOperation = "lighter";

    const halo = ctx.createRadialGradient(
      blackHole.x,
      blackHole.y,
      innerRadius,
      blackHole.x,
      blackHole.y,
      outerRadius
    );

    halo.addColorStop(
      0,
      "rgba(255, 245, 190, 0.42)"
    );

    halo.addColorStop(
      0.22,
      "rgba(255, 130, 70, 0.18)"
    );

    halo.addColorStop(
      0.58,
      "rgba(255, 70, 180, 0.08)"
    );

    halo.addColorStop(
      1,
      "rgba(0, 0, 0, 0)"
    );

    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(
      blackHole.x,
      blackHole.y,
      outerRadius,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.save();

    ctx.translate(blackHole.x, blackHole.y);
    ctx.rotate(-0.2);
    ctx.scale(1, 0.34);

    const disk = ctx.createRadialGradient(
      0,
      0,
      innerRadius,
      0,
      0,
      outerRadius
    );

    disk.addColorStop(
      0,
      "rgba(255, 255, 220, 0.85)"
    );

    disk.addColorStop(
      0.16,
      "rgba(255, 180, 80, 0.5)"
    );

    disk.addColorStop(
      0.42,
      "rgba(255, 70, 170, 0.2)"
    );

    disk.addColorStop(
      1,
      "rgba(0, 0, 0, 0)"
    );

    ctx.fillStyle = disk;
    ctx.beginPath();
    ctx.arc(0, 0, outerRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function render() {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(0, 0, 4, ${fade})`;
    ctx.fillRect(0, 0, W, H);

    ctx.globalCompositeOperation = "lighter";

    particles.forEach((particle) => {
      ctx.fillStyle = particleColor(particle);
      ctx.fillRect(particle.x, particle.y, 2, 2);
    });

    wells.forEach((well) => {
      if (well.blackHole) {
        drawAccretionDisk(well);
      }

      const glowRadius = well.blackHole
        ? well.radius * 3.5
        : 24;

      const glow = ctx.createRadialGradient(
        well.x,
        well.y,
        0,
        well.x,
        well.y,
        glowRadius
      );

      glow.addColorStop(
        0,
        well.blackHole
          ? "rgba(255, 220, 130, 0.95)"
          : "rgba(255, 255, 255, 0.95)"
      );

      glow.addColorStop(
        0.35,
        well.blackHole
          ? "rgba(255, 90, 180, 0.45)"
          : "rgba(100, 200, 255, 0.5)"
      );

      glow.addColorStop(
        1,
        "rgba(0, 0, 0, 0)"
      );

      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(
        well.x,
        well.y,
        glowRadius,
        0,
        Math.PI * 2
      );
      ctx.fill();

      if (well.blackHole) {
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "#000";

        ctx.beginPath();
        ctx.arc(
          well.x,
          well.y,
          well.radius,
          0,
          Math.PI * 2
        );
        ctx.fill();

        ctx.globalCompositeOperation = "lighter";
      }
    });

    ctx.globalCompositeOperation = "source-over";
  }

  function setMode(nextMode) {
    mode = nextMode;

    const buttons = {
      stream: "modeStream",
      blackhole: "modeBlackhole",
      star: "modeStar",
      erase: "modeErase"
    };

    Object.entries(buttons).forEach(([key, id]) => {
      document
        .getElementById(id)
        .classList.toggle("active", key === mode);
    });

    const messages = {
      stream: "Drag on the canvas to launch stars.",
      blackhole: "Tap the canvas to place a black hole.",
      star: "Tap the canvas to place a star.",
      erase: "Tap near a gravity well to remove it."
    };

    status.textContent = messages[mode];
  }

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();

    canvas.setPointerCapture(event.pointerId);

    const point = getCanvasPoint(event);

    if (mode === "blackhole") {
      addGravityWell(point.x, point.y, true);
      return;
    }

    if (mode === "star") {
      addGravityWell(point.x, point.y, false);
      return;
    }

    if (mode === "erase") {
      removeNearestWell(point.x, point.y);
      return;
    }

    dragging = true;
    lastPoint = point;
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!dragging || mode !== "stream") {
      return;
    }

    event.preventDefault();

    const point = getCanvasPoint(event);

    injectStream(
      point.x,
      point.y,
      point.x - lastPoint.x,
      point.y - lastPoint.y
    );

    lastPoint = point;
  });

  canvas.addEventListener("pointerup", () => {
    dragging = false;
  });

  canvas.addEventListener("pointercancel", () => {
    dragging = false;
  });

  document.getElementById("modeStream").onclick =
    () => setMode("stream");

  document.getElementById("modeBlackhole").onclick =
    () => setMode("blackhole");

  document.getElementById("modeStar").onclick =
    () => setMode("star");

  document.getElementById("modeErase").onclick =
    () => setMode("erase");

  document.getElementById("presetClear").onclick = () => {
    wells.length = 0;
    resetParticles();
  };

  document.getElementById("presetBigBang").onclick =
    createBigBang;

  document.getElementById("gravity").oninput = (event) => {
    gravity = Number(event.target.value) * 0.9;

    gravityValue.textContent =
      (Number(event.target.value) / 10).toFixed(1);
  };

  countSlider.oninput = (event) => {
    setParticleCount(Number(event.target.value));
    countValue.textContent = event.target.value;
  };

  document.getElementById("trailFade").oninput =
    (event) => {
      fade = Number(event.target.value) / 100;
      fadeValue.textContent = fade.toFixed(2);
    };

  document.getElementById("spread").oninput =
    (event) => {
      spread = Number(event.target.value);
      spreadValue.textContent = `${spread}°`;
    };

  setParticleCount(Number(countSlider.value));
  createBigBang();

  status.textContent =
    "Accretion disk online: drag, place wells, or adjust the controls.";

  function loop() {
    updatePhysics();
    render();
    requestAnimationFrame(loop);
  }

  loop();
})();
