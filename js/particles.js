/**
 * particles.js
 * Fondo animado con partículas flotantes (puntos de datos tipo cyberpunk).
 */

(function() {
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');

  let W, H, particles = [], lines = [];
  const N_PARTICLES = 55;
  const MAX_DIST = 120;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function mkParticle() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: 1 + Math.random() * 1.5,
      alpha: 0.15 + Math.random() * 0.35,
      color: Math.random() > 0.6 ? '#00e6ff' : '#00ff9d',
    };
  }

  function init() {
    resize();
    particles = Array.from({ length: N_PARTICLES }, mkParticle);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < MAX_DIST) {
          const alpha = (1 - dist / MAX_DIST) * 0.07;
          ctx.strokeStyle = `rgba(0,230,255,${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Draw particles
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color.replace(')', `,${p.alpha})`).replace('rgb', 'rgba').replace('#00e6ff', 'rgba(0,230,255,').replace('#00ff9d', 'rgba(0,255,157,');
      // simpler approach:
      const hex = p.color === '#00e6ff' ? `rgba(0,230,255,${p.alpha})` : `rgba(0,255,157,${p.alpha})`;
      ctx.fillStyle = hex;
      ctx.fill();

      // Move
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -5) p.x = W + 5;
      if (p.x > W + 5) p.x = -5;
      if (p.y < -5) p.y = H + 5;
      if (p.y > H + 5) p.y = -5;
    });
  }

  function loop() {
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);
  init();
  loop();
})();
