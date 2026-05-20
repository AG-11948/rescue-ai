/**
 * environment.js
 * Modela el entorno como una cuadrícula dinámica.
 * Tipos de celda: EMPTY, OBSTACLE, DANGER, CHARGE, VICTIM, AGENT
 */

const CELL = {
  EMPTY:    0,
  OBSTACLE: 1,
  DANGER:   2,
  CHARGE:   3,
  VICTIM:   4,
  AGENT:    5,
};

class Environment {
  constructor(size, victimCount, obstaclePct) {
    this.size = size;
    this.victimCount = victimCount;
    this.obstaclePct = obstaclePct / 100;
    this.grid = [];          // grid base (obstáculos, peligros, recargas)
    this.victims = [];       // [{x,y,rescued}]
    this.chargeStations = [];
    this.agentStart = { x: 0, y: 0 };
    this.dangerProb = {};    // clave "x,y" => probabilidad de daño [0-1]
    this.dynamicEvents = []; // cambios dinámicos programados
    this.step = 0;
  }

  // ── Generación del mapa ──────────────────────────────────────────────────
  generate() {
    const n = this.size;
    this.grid = Array.from({ length: n }, () => new Array(n).fill(CELL.EMPTY));

    // Coloca obstáculos
    const total = n * n;
    const obstacleCount = Math.floor(total * this.obstaclePct);
    let placed = 0;
    while (placed < obstacleCount) {
      const x = Math.floor(Math.random() * n);
      const y = Math.floor(Math.random() * n);
      if (this.grid[y][x] === CELL.EMPTY && !(x === 0 && y === 0)) {
        this.grid[y][x] = CELL.OBSTACLE;
        placed++;
      }
    }

    // Coloca zonas peligrosas (≈8% del mapa)
    const dangerCount = Math.max(2, Math.floor(total * 0.08));
    for (let i = 0; i < dangerCount; i++) {
      const pos = this._randomEmpty();
      if (pos) {
        this.grid[pos.y][pos.x] = CELL.DANGER;
        this.dangerProb[`${pos.x},${pos.y}`] = 0.2 + Math.random() * 0.4; // 20–60%
      }
    }

    // Coloca estaciones de recarga (2–3)
    const chargeCount = Math.max(2, Math.floor(n / 5));
    this.chargeStations = [];
    for (let i = 0; i < chargeCount; i++) {
      const pos = this._randomEmpty();
      if (pos) {
        this.grid[pos.y][pos.x] = CELL.CHARGE;
        this.chargeStations.push({ x: pos.x, y: pos.y });
      }
    }

    // Coloca víctimas
    this.victims = [];
    for (let i = 0; i < this.victimCount; i++) {
      const pos = this._randomEmpty();
      if (pos) {
        this.victims.push({ x: pos.x, y: pos.y, rescued: false, id: i });
      }
    }

    // Agente en (0,0)
    this.agentStart = { x: 0, y: 0 };
    this.grid[0][0] = CELL.EMPTY; // asegura que sea transitable

    // Valida conectividad básica (BFS rápido)
    if (!this._isConnected()) {
      return this.generate(); // regenera si no hay camino
    }

    this.step = 0;
    return this;
  }

  _randomEmpty() {
    let tries = 0;
    const n = this.size;
    while (tries++ < 500) {
      const x = Math.floor(Math.random() * n);
      const y = Math.floor(Math.random() * n);
      if (this.grid[y][x] === CELL.EMPTY) return { x, y };
    }
    return null;
  }

  _isConnected() {
    // BFS desde (0,0) para verificar que todas las víctimas son alcanzables
    const visited = new Set();
    const queue = [{ x: 0, y: 0 }];
    visited.add('0,0');
    while (queue.length) {
      const cur = queue.shift();
      for (const nb of this.neighbors(cur.x, cur.y)) {
        const k = `${nb.x},${nb.y}`;
        if (!visited.has(k)) {
          visited.add(k);
          queue.push(nb);
        }
      }
    }
    return this.victims.every(v => visited.has(`${v.x},${v.y}`));
  }

  // ── Consultas de celda ───────────────────────────────────────────────────
  isWalkable(x, y) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return false;
    return this.grid[y][x] !== CELL.OBSTACLE;
  }

  isDanger(x, y) { return this.grid[y][x] === CELL.DANGER; }
  isCharge(x, y) { return this.grid[y][x] === CELL.CHARGE; }

  getDangerProb(x, y) { return this.dangerProb[`${x},${y}`] || 0; }

  neighbors(x, y) {
    const dirs = [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }];
    return dirs
      .map(d => ({ x: x + d.dx, y: y + d.dy }))
      .filter(p => this.isWalkable(p.x, p.y));
  }

  getVictimAt(x, y) { return this.victims.find(v => v.x === x && v.y === y && !v.rescued); }

  getRemainingVictims() { return this.victims.filter(v => !v.rescued); }

  // ── Eventos dinámicos ────────────────────────────────────────────────────
  tick(agentPos) {
    this.step++;
    // Cada 15 pasos, algún obstáculo puede aparecer/desaparecer
    if (this.step % 15 === 0) {
      this._triggerDynamicEvent();
    }
    // Probabilidad de daño en zona peligrosa
    if (this.isDanger(agentPos.x, agentPos.y)) {
      const prob = this.getDangerProb(agentPos.x, agentPos.y);
      return Math.random() < prob; // true = daño
    }
    return false;
  }

  _triggerDynamicEvent() {
    const n = this.size;
    const x = 1 + Math.floor(Math.random() * (n - 2));
    const y = 1 + Math.floor(Math.random() * (n - 2));
    if (this.grid[y][x] === CELL.EMPTY) {
      this.grid[y][x] = CELL.OBSTACLE;
      this.dynamicEvents.push({ type: 'block', x, y });
    } else if (this.grid[y][x] === CELL.OBSTACLE) {
      this.grid[y][x] = CELL.EMPTY;
      this.dynamicEvents.push({ type: 'clear', x, y });
    }
  }

  // ── Fog of War: celdas descubiertas ─────────────────────────────────────
  // El agente solo "ve" las celdas dentro del radio de visión.
  // Las celdas visitadas quedan en "memoria" (tono más oscuro).
  initFog(size) {
    this.fogRevealed  = new Set(); // celdas vistas alguna vez
    this.fogVisible   = new Set(); // celdas visibles AHORA
    this.fogSize = size;
  }

  updateFog(agentX, agentY, radius = 3) {
    this.fogVisible = new Set();
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx*dx + dy*dy > radius*radius) continue; // círculo
        const x = agentX + dx, y = agentY + dy;
        if (x < 0 || y < 0 || x >= this.fogSize || y >= this.fogSize) continue;
        const k = `${x},${y}`;
        this.fogVisible.add(k);
        this.fogRevealed.add(k);
      }
    }
  }

  // ── Renderizado en Canvas ────────────────────────────────────────────────
  render(canvas, agent, plannedPath = [], particles = []) {
    const ctx = canvas.getContext('2d');
    const n = this.size;
    const cw = Math.floor(canvas.width / n);
    const ch = Math.floor(canvas.height / n);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pathSet = new Set(plannedPath.map(p => `${p.x},${p.y}`));

    // Fog of War activo solo cuando hay agente
    const fogActive = agent && this.fogRevealed;

    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const px = col * cw;
        const py = row * ch;
        const key = `${col},${row}`;

        // ── Niebla de guerra ───────────────────────────────────────────────
        if (fogActive) {
          const visible  = this.fogVisible.has(key);
          const revealed = this.fogRevealed.has(key);

          if (!revealed) {
            // Totalmente oculto — celda negra
            ctx.fillStyle = '#020509';
            ctx.fillRect(px, py, cw, ch);
            ctx.strokeStyle = '#070f1a';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(px + 0.5, py + 0.5, cw - 1, ch - 1);
            continue; // no dibuja contenido
          }

          if (!visible) {
            // Memoria — celda vista antes, oscurecida
            ctx.globalAlpha = 0.35;
          }
        }

        // Fondo de celda
        let bg;
        switch (this.grid[row][col]) {
          case CELL.OBSTACLE: bg = '#0d0a0a'; break;
          case CELL.DANGER:   bg = '#1a0808'; break;
          case CELL.CHARGE:   bg = '#1a1800'; break;
          default:
            bg = pathSet.has(key) ? '#001a10' : '#0a1525';
        }
        ctx.fillStyle = bg;
        ctx.fillRect(px, py, cw, ch);

        // Borde de celda
        ctx.strokeStyle = '#0f2040';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px + 0.5, py + 0.5, cw - 1, ch - 1);

        // Contenido
        const cx2 = px + cw / 2;
        const cy2 = py + ch / 2;
        const fs = Math.max(10, Math.floor(cw * 0.55));
        ctx.font = `${fs}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        switch (this.grid[row][col]) {
          case CELL.OBSTACLE:
            ctx.fillStyle = '#1a2a3a';
            ctx.fillRect(px + 2, py + 2, cw - 4, ch - 4);
            break;
          case CELL.DANGER: {
            const fogAlpha = ctx.globalAlpha;
            ctx.fillStyle = '#ff3d3d';
            ctx.globalAlpha = fogAlpha * (0.6 + 0.3 * Math.sin(Date.now() / 600));
            ctx.fillText('⚠', cx2, cy2);
            ctx.globalAlpha = fogAlpha;
            break;
          }
          case CELL.CHARGE:
            ctx.fillStyle = '#ffd600';
            ctx.fillText('⚡', cx2, cy2);
            break;
          default:
            if (pathSet.has(key)) {
              ctx.fillStyle = '#00ff8866';
              ctx.beginPath();
              ctx.arc(cx2, cy2, cw * 0.12, 0, Math.PI * 2);
              ctx.fill();
            }
        }
        // Restaura alpha al final de cada celda
        ctx.globalAlpha = 1;
      }
    }

    // Víctimas — solo si visibles (o descubiertas con niebla)
    this.victims.forEach(v => {
      if (v.rescued) return;
      const vKey = `${v.x},${v.y}`;
      if (fogActive && !this.fogRevealed.has(vKey)) return; // oculta en niebla
      const vpx = v.x * cw + cw / 2;
      const vpy = v.y * ch + ch / 2;
      const vfs = Math.max(10, Math.floor(cw * 0.55));
      ctx.font = `${vfs}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = fogActive && !this.fogVisible.has(vKey)
        ? 0.3  // en memoria: semi-transparente
        : 0.8 + 0.2 * Math.sin(Date.now() / 400);
      ctx.fillText('🧍', vpx, vpy);
      ctx.globalAlpha = 1;
    });

    // Agente
    if (agent) {
      const px = agent.x * cw + cw / 2;
      const py2 = agent.y * ch + ch / 2;
      const fs = Math.max(10, Math.floor(cw * 0.65));
      ctx.font = `bold ${fs}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Halo
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#00e5ff';
      ctx.fillText('🚁', px, py2);
      ctx.shadowBlur = 0;
    }

    // ── Partículas de rescate ────────────────────────────────────────────
    particles.forEach(p => {
      const px2 = p.x * cw + cw / 2;
      const py3 = p.y * ch + ch / 2;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(px2 + p.vx * 3, py3 + p.vy * 3, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
}
