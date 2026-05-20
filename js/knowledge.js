/**
 * knowledge.js
 * Base de Conocimiento con lógica proposicional.
 * El agente almacena hechos sobre el entorno y deriva conclusiones.
 */

class KnowledgeBase {
  constructor() {
    this.facts = new Map();     // "predicado(args)" => true | false
    this.rules = [];            // Reglas de inferencia
    this._initRules();
  }

  // ── Reglas de inferencia ─────────────────────────────────────────────────
  _initRules() {
    this.rules = [
      {
        name: 'safe_to_visit',
        description: 'Una celda es segura si no es peligrosa y no es obstáculo',
        condition: (kb, x, y) =>
          kb.query(`not_danger(${x},${y})`) && kb.query(`not_obstacle(${x},${y})`),
        conclusion: (x, y) => `safe(${x},${y})`,
      },
      {
        name: 'charge_needed',
        description: 'El agente necesita recarga si energía < 25',
        condition: (kb) => kb.query('energy_low'),
        conclusion: () => 'need_charge',
      },
      {
        name: 'victim_reachable',
        description: 'Una víctima es alcanzable si está en celda segura',
        condition: (kb, x, y) => kb.query(`victim_at(${x},${y})`) && kb.query(`safe(${x},${y})`),
        conclusion: (x, y) => `reachable_victim(${x},${y})`,
      },
      {
        name: 'danger_avoidance',
        description: 'Evitar zonas de alto riesgo (prob > 0.5)',
        condition: (kb, x, y) => kb.query(`high_danger(${x},${y})`),
        conclusion: (x, y) => `avoid(${x},${y})`,
      },
    ];
  }

  // ── Gestión de hechos ─────────────────────────────────────────────────────
  tell(fact, value = true) {
    this.facts.set(fact, value);
  }

  query(fact) {
    return this.facts.get(fact) === true;
  }

  retract(fact) {
    this.facts.delete(fact);
  }

  // ── Actualiza KB desde percepción del entorno ────────────────────────────
  updateFromEnvironment(env, agentPos, agentEnergy) {
    const n = env.size;

    // Energía
    this.tell('energy_low', agentEnergy < 25);
    this.tell('energy_critical', agentEnergy < 10);

    // Celdas percibidas (radio de visión del agente)
    const VISION = 3;
    for (let dy = -VISION; dy <= VISION; dy++) {
      for (let dx = -VISION; dx <= VISION; dx++) {
        const x = agentPos.x + dx;
        const y = agentPos.y + dy;
        if (x < 0 || y < 0 || x >= n || y >= n) continue;

        const isObs  = env.grid[y][x] === CELL.OBSTACLE;
        const isDgr  = env.grid[y][x] === CELL.DANGER;
        const isChg  = env.grid[y][x] === CELL.CHARGE;
        const prob   = env.getDangerProb(x, y);

        this.tell(`obstacle(${x},${y})`,     isObs);
        this.tell(`not_obstacle(${x},${y})`, !isObs);
        this.tell(`danger(${x},${y})`,       isDgr);
        this.tell(`not_danger(${x},${y})`,   !isDgr);
        this.tell(`high_danger(${x},${y})`,  isDgr && prob > 0.5);
        this.tell(`charge_at(${x},${y})`,    isChg);

        // Víctimas
        const v = env.getVictimAt(x, y);
        this.tell(`victim_at(${x},${y})`, !!v);
      }
    }

    // Agente
    this.tell(`agent_at(${agentPos.x},${agentPos.y})`, true);

    // Inferencia encadenada
    this._infer(env, agentPos);
  }

  // ── Forward Chaining (encadenamiento hacia adelante) ─────────────────────
  _infer(env, agentPos) {
    const VISION = 3;
    const n = env.size;
    let changed = true;

    // Itera hasta punto fijo
    let iterations = 0;
    while (changed && iterations < 10) {
      changed = false;
      iterations++;

      for (const rule of this.rules) {
        for (let dy = -VISION; dy <= VISION; dy++) {
          for (let dx = -VISION; dx <= VISION; dx++) {
            const x = agentPos.x + dx;
            const y = agentPos.y + dy;
            if (x < 0 || y < 0 || x >= n || y >= n) continue;

            if (rule.condition(this, x, y)) {
              const fact = rule.conclusion(x, y);
              if (!this.query(fact)) {
                this.tell(fact, true);
                changed = true;
              }
            }
          }
        }

        // Regla sin coordenadas (global)
        if (rule.name === 'charge_needed' && rule.condition(this)) {
          const fact = rule.conclusion();
          if (!this.query(fact)) {
            this.tell(fact, true);
            changed = true;
          }
        }
      }
    }
  }

  // ── Exporta hechos para UI ───────────────────────────────────────────────
  getFacts() {
    const result = [];
    this.facts.forEach((val, key) => {
      if (val === true) result.push(key);
    });
    return result.sort();
  }

  getSafeCells() {
    const safe = [];
    this.facts.forEach((val, key) => {
      if (val === true && key.startsWith('safe(')) {
        const match = key.match(/safe\((\d+),(\d+)\)/);
        if (match) safe.push({ x: +match[1], y: +match[2] });
      }
    });
    return safe;
  }

  getReachableVictims() {
    const victims = [];
    this.facts.forEach((val, key) => {
      if (val === true && key.startsWith('reachable_victim(')) {
        const match = key.match(/reachable_victim\((\d+),(\d+)\)/);
        if (match) victims.push({ x: +match[1], y: +match[2] });
      }
    });
    return victims;
  }
}
