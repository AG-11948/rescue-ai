/**
 * search.js
 * Implementa BFS (no informado) y A* (informado).
 * Permite comparar rendimiento entre ambos.
 */

class SearchAlgorithms {
  constructor(env) {
    this.env = env;
  }

  // ── Heurística Manhattan para A* ─────────────────────────────────────────
  heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  // ── BFS — Búsqueda No Informada ──────────────────────────────────────────
  // Garantiza el camino más corto en grafos no ponderados.
  bfs(start, goal) {
    const t0 = performance.now();
    const visited = new Set();
    const queue = [{ pos: start, path: [start] }];
    let nodesExpanded = 0;
    visited.add(`${start.x},${start.y}`);

    while (queue.length > 0) {
      const { pos, path } = queue.shift();
      nodesExpanded++;

      if (pos.x === goal.x && pos.y === goal.y) {
        return {
          path,
          nodesExpanded,
          timeMs: performance.now() - t0,
          algorithm: 'BFS',
        };
      }

      for (const nb of this.env.neighbors(pos.x, pos.y)) {
        const key = `${nb.x},${nb.y}`;
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({ pos: nb, path: [...path, nb] });
        }
      }
    }

    return { path: [], nodesExpanded, timeMs: performance.now() - t0, algorithm: 'BFS' };
  }

  // ── A* — Búsqueda Informada ──────────────────────────────────────────────
  // Usa f(n) = g(n) + h(n) con heurística Manhattan.
  astar(start, goal) {
    const t0 = performance.now();
    let nodesExpanded = 0;

    // Penalización extra por zonas peligrosas
    const costOf = (x, y) => {
      if (this.env.isDanger(x, y)) {
        return 1 + this.env.getDangerProb(x, y) * 8; // costo mayor = evita peligro
      }
      return 1;
    };

    const open = [];
    const gScore = {};
    const cameFrom = {};
    const key = (p) => `${p.x},${p.y}`;

    gScore[key(start)] = 0;
    open.push({ pos: start, f: this.heuristic(start, goal) });

    while (open.length > 0) {
      // Extrae nodo con menor f (min-heap manual)
      open.sort((a, b) => a.f - b.f);
      const { pos } = open.shift();
      nodesExpanded++;

      if (pos.x === goal.x && pos.y === goal.y) {
        // Reconstruye camino
        const path = [];
        let cur = key(goal);
        while (cur) {
          const [x, y] = cur.split(',').map(Number);
          path.unshift({ x, y });
          cur = cameFrom[cur];
        }
        return {
          path,
          nodesExpanded,
          timeMs: performance.now() - t0,
          algorithm: 'A*',
        };
      }

      for (const nb of this.env.neighbors(pos.x, pos.y)) {
        const nk = key(nb);
        const tentativeG = (gScore[key(pos)] || 0) + costOf(nb.x, nb.y);
        if (gScore[nk] === undefined || tentativeG < gScore[nk]) {
          gScore[nk] = tentativeG;
          cameFrom[nk] = key(pos);
          const f = tentativeG + this.heuristic(nb, goal);
          open.push({ pos: nb, f });
        }
      }
    }

    return { path: [], nodesExpanded, timeMs: performance.now() - t0, algorithm: 'A*' };
  }

  // ── Método unificado ─────────────────────────────────────────────────────
  findPath(start, goal, algorithm = 'astar') {
    return algorithm === 'astar' ? this.astar(start, goal) : this.bfs(start, goal);
  }

  // ── Benchmark comparativo ─────────────────────────────────────────────────
  // Ejecuta ambos algoritmos en el mismo par start→goal y devuelve métricas.
  benchmark(start, goal) {
    const bfsResult   = this.bfs(start, goal);
    const astarResult = this.astar(start, goal);
    return {
      bfs:   { nodes: bfsResult.nodesExpanded,   time: bfsResult.timeMs,   pathLen: bfsResult.path.length },
      astar: { nodes: astarResult.nodesExpanded, time: astarResult.timeMs, pathLen: astarResult.path.length },
    };
  }
}
