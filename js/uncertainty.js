/**
 * uncertainty.js
 * Manejo de Incertidumbre mediante:
 * - Sensores imperfectos (falsos positivos/negativos)
 * - Modelo de creencias Bayesiano simplificado
 * - Estimación de posición con ruido
 */

class UncertaintyModel {
  constructor(env) {
    this.env = env;
    // Mapa de creencias: prob de que celda sea peligrosa
    this.beliefDanger = {};
    // Mapa de creencias: prob de que haya víctima
    this.beliefVictim = {};
    // Historial de observaciones para actualización Bayesiana
    this.observations = [];
    this.SENSOR_ACCURACY = 0.85; // Sensor correcto 85% del tiempo
  }

  // ── Percepción con ruido ─────────────────────────────────────────────────
  perceive(x, y) {
    if (x < 0 || y < 0 || x >= this.env.size || y >= this.env.size) {
      return { obstacle: true, danger: false, victim: false, charge: false, noisy: false };
    }
    const real = this._realState(x, y);
    const noisy = Math.random() > this.SENSOR_ACCURACY;

    if (noisy) {
      // Introduce ruido: invierte una percepción aleatoria
      const flip = Math.floor(Math.random() * 4);
      return {
        obstacle: flip === 0 ? !real.obstacle : real.obstacle,
        danger:   flip === 1 ? !real.danger   : real.danger,
        victim:   flip === 2 ? !real.victim   : real.victim,
        charge:   flip === 3 ? !real.charge   : real.charge,
        noisy: true,
      };
    }
    return { ...real, noisy: false };
  }

  _realState(x, y) {
    const cell = this.env.grid[y][x];
    return {
      obstacle: cell === CELL.OBSTACLE,
      danger:   cell === CELL.DANGER,
      victim:   !!this.env.getVictimAt(x, y),
      charge:   cell === CELL.CHARGE,
    };
  }

  // ── Actualización Bayesiana de creencias ─────────────────────────────────
  // P(danger|observe) = P(observe|danger)*P(danger) / P(observe)
  updateBelief(x, y, observation) {
    const key = `${x},${y}`;
    const prior = this.beliefDanger[key] ?? this.env.getDangerProb(x, y);

    let likelihood;
    if (observation.danger) {
      // Observamos peligro
      likelihood = observation.noisy
        ? (1 - this.SENSOR_ACCURACY)
        : this.SENSOR_ACCURACY;
    } else {
      // No observamos peligro
      likelihood = observation.noisy
        ? this.SENSOR_ACCURACY
        : (1 - this.SENSOR_ACCURACY);
    }

    const posterior = (likelihood * prior) /
      (likelihood * prior + (1 - likelihood) * (1 - prior));

    this.beliefDanger[key] = Math.max(0.01, Math.min(0.99, posterior));

    // Registro para análisis
    this.observations.push({ x, y, obs: observation.danger, belief: this.beliefDanger[key] });
  }

  // ── Creencia actual sobre peligro en celda ────────────────────────────────
  getDangerBelief(x, y) {
    return this.beliefDanger[`${x},${y}`] ?? this.env.getDangerProb(x, y);
  }

  // ── Estima si vale la pena ir a celda (utilidad esperada bajo incertidumbre)
  expectedCost(x, y) {
    const p = this.getDangerBelief(x, y);
    const damageIfDanger = 20; // energía perdida si es peligrosa
    return 1 + p * damageIfDanger; // costo esperado
  }

  // ── Detecta si hay víctima (sensor imperfecto) ───────────────────────────
  detectVictim(x, y) {
    const hasVictim = !!this.env.getVictimAt(x, y);
    const sensorFired = Math.random() < this.SENSOR_ACCURACY
      ? hasVictim
      : !hasVictim; // ruido del sensor
    return sensorFired;
  }

  // ── Resumen de incertidumbre para UI ─────────────────────────────────────
  getSummary() {
    const beliefs = Object.entries(this.beliefDanger).map(([k, v]) => {
      const [x, y] = k.split(',').map(Number);
      return { x, y, belief: v };
    });
    return {
      totalObservations: this.observations.length,
      noisyObservations: this.observations.filter(o => true).length,
      highRiskCells: beliefs.filter(b => b.belief > 0.5).length,
      averageBelief: beliefs.length
        ? (beliefs.reduce((s, b) => s + b.belief, 0) / beliefs.length).toFixed(3)
        : 0,
    };
  }
}
