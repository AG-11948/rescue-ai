/**
 * learning.js
 * Aprendizaje por Refuerzo: Q-Learning.
 * El agente aprende qué celdas son más valiosas con la experiencia.
 *
 * Q(s,a) ← Q(s,a) + α[r + γ·max Q(s',a') - Q(s,a)]
 */

class QLearning {
  constructor(env) {
    this.env = env;
    this.Q = {};            // Q[state][action] = valor
    this.alpha = 0.15;      // Tasa de aprendizaje
    this.gamma = 0.9;       // Factor de descuento
    this.epsilon = 0.3;     // Exploración inicial
    this.minEpsilon = 0.05;
    this.epsilonDecay = 0.995;
    this.episodes = 0;
    this.totalReward = 0;
    this.rewardHistory = [];
  }

  // ── Estado: simplificado como "x,y,energy_bucket" ───────────────────────
  stateKey(x, y, energy) {
    const eb = Math.floor(energy / 25); // 0-3 cubos de energía
    return `${x},${y},${eb}`;
  }

  // ── Acciones posibles (índices de dirección) ─────────────────────────────
  // 0=arriba, 1=derecha, 2=abajo, 3=izquierda
  getActions(x, y) {
    const dirs = [
      { dx: 0, dy: -1 }, { dx: 1, dy: 0 },
      { dx: 0, dy: 1  }, { dx: -1, dy: 0 },
    ];
    return dirs.map((d, i) => ({
      idx: i,
      nx: x + d.dx,
      ny: y + d.dy,
      valid: this.env.isWalkable(x + d.dx, y + d.dy),
    })).filter(a => a.valid);
  }

  // ── Obtiene Q-valor (inicializa en 0 si no existe) ───────────────────────
  getQ(state, actionIdx) {
    if (!this.Q[state]) this.Q[state] = {};
    return this.Q[state][actionIdx] ?? 0;
  }

  // ── Actualización Q-Learning ──────────────────────────────────────────────
  update(state, actionIdx, reward, nextState, nextX, nextY, nextEnergy) {
    const currentQ = this.getQ(state, actionIdx);
    const nextActions = this.getActions(nextX, nextY);
    const maxNextQ = nextActions.length
      ? Math.max(...nextActions.map(a => this.getQ(nextState, a.idx)))
      : 0;

    const newQ = currentQ + this.alpha * (reward + this.gamma * maxNextQ - currentQ);
    if (!this.Q[state]) this.Q[state] = {};
    this.Q[state][actionIdx] = newQ;
  }

  // ── Selección de acción: ε-greedy ────────────────────────────────────────
  selectAction(x, y, energy) {
    const state = this.stateKey(x, y, energy);
    const actions = this.getActions(x, y);
    if (!actions.length) return null;

    if (Math.random() < this.epsilon) {
      // Exploración: acción aleatoria
      return actions[Math.floor(Math.random() * actions.length)];
    }

    // Explotación: mejor Q conocido
    return actions.reduce((best, a) =>
      this.getQ(state, a.idx) > this.getQ(state, best.idx) ? a : best
    );
  }

  // ── Función de Recompensa ─────────────────────────────────────────────────
  computeReward(x, y, env, rescuedVictim, receivedDamage, recharged) {
    let r = -0.1; // Costo por paso
    if (rescuedVictim) r += 50;
    if (receivedDamage) r -= 20;
    if (recharged) r += 5;
    if (env.isDanger(x, y)) r -= 5 * env.getDangerProb(x, y);
    return r;
  }

  // ── Registra fin de episodio ──────────────────────────────────────────────
  endEpisode(totalReward) {
    this.episodes++;
    this.totalReward += totalReward;
    this.rewardHistory.push(totalReward);
    if (this.rewardHistory.length > 50) this.rewardHistory.shift();

    // Decae epsilon
    this.epsilon = Math.max(this.minEpsilon, this.epsilon * this.epsilonDecay);
  }

  // ── Exporta mapa de Q-valores para visualización ─────────────────────────
  getQMap(size) {
    const map = [];
    for (let y = 0; y < size; y++) {
      map.push([]);
      for (let x = 0; x < size; x++) {
        const state = this.stateKey(x, y, 50); // energy bucket=2
        const actions = this.getActions(x, y);
        const maxQ = actions.length
          ? Math.max(...actions.map(a => this.getQ(state, a.idx)))
          : 0;
        map[y].push(maxQ);
      }
    }
    return map;
  }

  // ── Dibuja mapa de calor de Q-valores en canvas ───────────────────────────
  renderQMap(canvas, size) {
    const ctx = canvas.getContext('2d');
    const cw = canvas.width / size;
    const ch = canvas.height / size;
    const qmap = this.getQMap(size);

    const allQ = qmap.flat();
    const minQ = Math.min(...allQ);
    const maxQ = Math.max(...allQ);
    const range = maxQ - minQ || 1;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const norm = (qmap[y][x] - minQ) / range; // 0–1
        const r = Math.floor(norm * 0);
        const g = Math.floor(norm * 255);
        const b = Math.floor((1 - norm) * 180);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x * cw, y * ch, cw, ch);
      }
    }

    // Overlay de texto
    ctx.fillStyle = 'rgba(0,229,255,0.7)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Episodios: ${this.episodes} | ε: ${this.epsilon.toFixed(2)}`, canvas.width / 2, canvas.height - 4);
  }

  getSummary() {
    return {
      episodes: this.episodes,
      epsilon: this.epsilon.toFixed(3),
      statesLearned: Object.keys(this.Q).length,
      avgReward: this.rewardHistory.length
        ? (this.rewardHistory.reduce((a, b) => a + b, 0) / this.rewardHistory.length).toFixed(1)
        : 0,
    };
  }
}

// ── Q-Table persistencia en localStorage ───────────────────────────────────
QLearning.prototype.saveToStorage = function(key) {
  try {
    localStorage.setItem(key || 'rescue_qtable', JSON.stringify({
      Q: this.Q, episodes: this.episodes, epsilon: this.epsilon,
    }));
  } catch(e) {}
};

QLearning.prototype.loadFromStorage = function(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key || 'rescue_qtable') || 'null');
    if (data) {
      this.Q        = data.Q || {};
      this.episodes = data.episodes || 0;
      this.epsilon  = data.epsilon  || this.epsilon;
      return true;
    }
  } catch(e) {}
  return false;
};
