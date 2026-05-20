/**
 * planner.js
 * Planificador basado en STRIPS.
 * Define acciones con precondiciones y efectos.
 * Genera planes para rescatar múltiples víctimas.
 */

// ── Definición de Acciones STRIPS ────────────────────────────────────────────
const ACTIONS = {
  MOVE: {
    name: 'MOVE',
    preconditions: (state, { to }) =>
      state.walkable[`${to.x},${to.y}`] && state.energy > 0,
    effects: (state, { from, to }) => ({
      ...state,
      agentPos: to,
      energy: state.energy - 1,
      visited: { ...state.visited, [`${to.x},${to.y}`]: true },
    }),
    cost: (state, { to }, uncertainty) => uncertainty
      ? uncertainty.expectedCost(to.x, to.y)
      : 1,
  },
  RESCUE: {
    name: 'RESCUE',
    preconditions: (state, { target }) =>
      state.agentPos.x === target.x &&
      state.agentPos.y === target.y &&
      !state.rescued[target.id],
    effects: (state, { target }) => ({
      ...state,
      rescued: { ...state.rescued, [target.id]: true },
      rescuedCount: state.rescuedCount + 1,
    }),
    cost: () => 0,
  },
  RECHARGE: {
    name: 'RECHARGE',
    preconditions: (state) =>
      state.chargeStations.some(
        cs => cs.x === state.agentPos.x && cs.y === state.agentPos.y
      ),
    effects: (state) => ({
      ...state,
      energy: Math.min(100, state.energy + 50),
    }),
    cost: () => 0,
  },
};

class Planner {
  constructor(env, search, uncertainty) {
    this.env = env;
    this.search = search;
    this.uncertainty = uncertainty;
  }

  // ── Estado inicial STRIPS ─────────────────────────────────────────────────
  buildInitialState(agentPos, energy) {
    const walkable = {};
    const n = this.env.size;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++)
        walkable[`${x},${y}`] = this.env.isWalkable(x, y);

    const rescued = {};
    this.env.victims.forEach(v => { rescued[v.id] = v.rescued; });

    return {
      agentPos: { ...agentPos },
      energy,
      walkable,
      rescued,
      rescuedCount: this.env.victims.filter(v => v.rescued).length,
      chargeStations: this.env.chargeStations.slice(),
      visited: {},
    };
  }

  // ── Genera plan para rescatar todas las víctimas ──────────────────────────
  // Orden greedy: víctima más cercana primero.
  generatePlan(agentPos, energy, algorithm = 'astar') {
    const plan = [];
    const victims = this.env.getRemainingVictims();
    let currentPos = { ...agentPos };
    let currentEnergy = energy;
    const rescued = [];

    // TSP Nearest-Neighbor: minimiza distancia total de rescate
    const sortedVictims = [...victims].sort(
      (a, b) =>
        this._manhattan(currentPos, a) - this._manhattan(currentPos, b)
    );

    for (const victim of sortedVictims) {
      // ¿Necesita recarga antes de ir?
      const dist = this._manhattan(currentPos, victim);
      if (currentEnergy < dist + 10) {
        const nearestCharge = this._nearestCharge(currentPos);
        if (nearestCharge) {
          plan.push({
            type: 'RECHARGE',
            from: currentPos,
            to: nearestCharge,
            description: `Recargar en (${nearestCharge.x},${nearestCharge.y})`,
          });
          currentPos = nearestCharge;
          currentEnergy = Math.min(100, currentEnergy + 50);
        }
      }

      // Ruta hacia víctima
      const result = this.search.findPath(currentPos, { x: victim.x, y: victim.y }, algorithm);
      if (result.path.length > 0) {
        plan.push({
          type: 'MOVE_TO_VICTIM',
          path: result.path,
          victim,
          from: currentPos,
          to: { x: victim.x, y: victim.y },
          nodesExpanded: result.nodesExpanded,
          description: `Moverse a víctima #${victim.id} en (${victim.x},${victim.y}) — ${result.path.length} pasos`,
        });
        currentPos = { x: victim.x, y: victim.y };
        currentEnergy -= result.path.length;
      }

      // Rescate
      plan.push({
        type: 'RESCUE',
        victim,
        description: `Rescatar víctima #${victim.id}`,
      });
      rescued.push(victim.id);
    }

    return plan;
  }

  _manhattan(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

  _nearestCharge(pos) {
    return this.env.chargeStations.reduce((best, cs) => {
      const d = this._manhattan(pos, cs);
      return !best || d < best.dist ? { ...cs, dist: d } : best;
    }, null);
  }

  // ── Formatea plan para UI ─────────────────────────────────────────────────
  formatPlanForUI(plan) {
    return plan.map((step, i) => ({
      index: i + 1,
      description: step.description,
      type: step.type,
      done: false,
    }));
  }

  // ── TSP Nearest-Neighbor ────────────────────────────────────────────────
  // Ordena víctimas minimizando distancia total del recorrido.
  // Siempre elige la víctima no visitada más cercana desde la posición actual.
  _tspNearestNeighbor(victims, startPos) {
    const result = [];
    let current = startPos;
    const remaining = [...victims];
    while (remaining.length > 0) {
      let bestIdx = 0, bestDist = Infinity;
      remaining.forEach((v, i) => {
        const d = this._manhattan(current, v);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      });
      const chosen = remaining.splice(bestIdx, 1)[0];
      result.push(chosen);
      current = chosen;
    }
    return result;
  }
}
