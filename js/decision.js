/**
 * decision.js
 * Toma de Decisiones mediante función de utilidad.
 * El agente selecciona la mejor acción evaluando utilidad esperada.
 */

class DecisionMaker {
  constructor(env, kb, uncertainty) {
    this.env = env;
    this.kb = kb;
    this.uncertainty = uncertainty;
    this.totalUtility = 0;
    this.decisions = [];
  }

  // ── Función de Utilidad ───────────────────────────────────────────────────
  // U(estado) = victorias_rescatadas * 100
  //           - energia_usada * 0.5
  //           - penalización_por_daño * 20
  //           - pasos_en_peligro * 10
  computeUtility(state) {
    const rescued  = state.rescuedCount * 100;
    const energyCost = (100 - state.energy) * 0.5;
    const dangerPenalty = state.damageReceived * 20;
    const stepCost = state.steps * 0.1;
    return rescued - energyCost - dangerPenalty - stepCost;
  }

  // ── Evalúa posibles movimientos ───────────────────────────────────────────
  evaluateActions(agentPos, agentEnergy, plannedPath) {
    const neighbors = this.env.neighbors(agentPos.x, agentPos.y);
    const scored = neighbors.map(nb => {
      let score = 0;

      // Bonificación si está en el camino planeado
      if (plannedPath && plannedPath.some(p => p.x === nb.x && p.y === nb.y)) {
        score += 50;
      }

      // Penalización por peligro (ponderada por creencia)
      const dangerBelief = this.uncertainty.getDangerBelief(nb.x, nb.y);
      score -= dangerBelief * 30;

      // Bonificación si hay víctima
      if (this.env.getVictimAt(nb.x, nb.y)) score += 100;

      // Bonificación si es recarga y energía baja
      if (this.env.isCharge(nb.x, nb.y) && agentEnergy < 30) score += 60;

      // Penalización por energía baja al alejarse de recarga
      if (agentEnergy < 15) {
        const nearCharge = this.env.chargeStations.some(
          cs => Math.abs(cs.x - nb.x) + Math.abs(cs.y - nb.y) < 3
        );
        if (!nearCharge) score -= 40;
      }

      return { pos: nb, score };
    });

    return scored.sort((a, b) => b.score - a.score);
  }

  // ── Decisión: ir a recarga o continuar plan ───────────────────────────────
  shouldRecharge(agentPos, agentEnergy, nextTarget) {
    if (!nextTarget) return false;
    const dist = Math.abs(agentPos.x - nextTarget.x) + Math.abs(agentPos.y - nextTarget.y);
    // Recarga si la energía no alcanza para llegar + buffer
    return agentEnergy < dist + 15;
  }

  // ── Registra decisión para análisis ──────────────────────────────────────
  recordDecision(pos, action, utility) {
    this.totalUtility = utility;
    this.decisions.push({ step: this.decisions.length + 1, pos: { ...pos }, action, utility });
    if (this.decisions.length > 100) this.decisions.shift(); // mantiene últimas 100
  }

  // ── Métricas de desempeño ─────────────────────────────────────────────────
  getPerformanceMetrics(state) {
    return {
      utility: this.computeUtility(state).toFixed(1),
      rescuedPct: state.totalVictims
        ? ((state.rescuedCount / state.totalVictims) * 100).toFixed(0) + '%'
        : '0%',
      energyEfficiency: state.steps > 0
        ? ((state.rescuedCount * 100) / (state.steps + 1)).toFixed(2)
        : 0,
      avgDangerExposure: state.dangerSteps > 0
        ? (state.dangerSteps / Math.max(state.steps, 1)).toFixed(2)
        : 0,
    };
  }
}
