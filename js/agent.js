/**
 * agent.js v4 — Agente con partículas, animación suave y modo manual
 */
class RescueAgent {
  constructor(env, algorithm = 'astar') {
    this.env = env; this.algorithm = algorithm;
    this.search = new SearchAlgorithms(env);
    this.kb = new KnowledgeBase();
    this.uncertainty = new UncertaintyModel(env);
    this.planner = new Planner(env, this.search, this.uncertainty);
    this.decision = new DecisionMaker(env, this.kb, this.uncertainty);
    this.qlearning = new QLearning(env);
    this.pos = { ...env.agentStart };
    this.energy = 100; this.steps = 0;
    this.damageReceived = 0; this.dangerSteps = 0; this.episodeReward = 0;
    this.plan = []; this.planIndex = 0; this.currentPath = []; this.pathIndex = 0;
    this.particles = [];
    this.searchMetrics = { bfsNodes:[], astarNodes:[], bfsTimes:[], astarTimes:[] };
    this.log = []; this.finished = false; this.lastAction = '';
    this.utilityHistory = [];
    this.env.initFog(env.size);
    this.env.updateFog(this.pos.x, this.pos.y, 3);
  }

  initialize() {
    this._addLog('Sistema inicializado. Agente listo.','info');
    this._addLog(`Algoritmo: ${this.algorithm.toUpperCase()} | Víctimas: ${this.env.victims.length}`,'info');
    this.kb.updateFromEnvironment(this.env, this.pos, this.energy);
    this.plan = this.planner.generatePlan(this.pos, this.energy, this.algorithm);
    this._addLog(`Plan STRIPS: ${this.plan.length} acciones`,'plan');
    this._loadNextPlanStep();
  }

  step() {
    if (this.finished) return false;
    if (this.energy <= 0) { this._addLog('⚡ Energía agotada.','error'); this.finished=true; return false; }

    const percept = this.uncertainty.perceive(this.pos.x, this.pos.y);
    this.uncertainty.updateBelief(this.pos.x, this.pos.y, percept);
    this.kb.updateFromEnvironment(this.env, this.pos, this.energy);

    if (this.env.isCharge(this.pos.x, this.pos.y) && this.energy < 60) {
      this.energy = Math.min(100, this.energy + 50);
      this._addLog(`⚡ Recargando → energía: ${this.energy}`,'success');
      this.lastAction='RECHARGE';
    }

    const victim = this.env.getVictimAt(this.pos.x, this.pos.y);
    if (victim) {
      victim.rescued = true;
      this._spawnParticles(this.pos.x, this.pos.y);
      this.episodeReward += this.qlearning.computeReward(this.pos.x, this.pos.y, this.env, true, false, false);
      this._addLog(`🚁 ¡Víctima #${victim.id} rescatada!`,'success');
      this.lastAction='RESCUE';
      if (this.env.getRemainingVictims().length > 0) {
        this.plan = this.planner.generatePlan(this.pos, this.energy, this.algorithm);
        this.planIndex=0; this._loadNextPlanStep();
      }
    }

    if (this.env.getRemainingVictims().length === 0) {
      this._addLog('✅ ¡Todas las víctimas rescatadas!','success');
      this.finished=true; this.qlearning.endEpisode(this.episodeReward);
      this.qlearning.saveToStorage(); // Persiste aprendizaje return false;
    }

    if (this.currentPath.length > 0 && this.pathIndex < this.currentPath.length) {
      const next = this.currentPath[this.pathIndex];
      if (!this.env.isWalkable(next.x, next.y)) {
        this._addLog('⚠ Obstáculo dinámico. Replanificando...','warn');
        this._replan(); return true;
      }
      const prevState = this.qlearning.stateKey(this.pos.x, this.pos.y, this.energy);
      const actionIdx = this._dirToIdx(this.pos, next);
      this.pos = { x:next.x, y:next.y }; this.pathIndex++;
      this.energy = Math.max(0, this.energy-1); this.steps++;
      this.env.updateFog(this.pos.x, this.pos.y, 3);
      const damaged = this.env.tick(this.pos);
      if (damaged) {
        this.energy=Math.max(0,this.energy-10); this.damageReceived++; this.dangerSteps++;
        this._addLog(`💥 Daño en zona peligrosa! E: ${this.energy}`,'error');
      }
      if (this.env.isDanger(this.pos.x, this.pos.y)) this.dangerSteps++;
      const reward = this.qlearning.computeReward(this.pos.x, this.pos.y, this.env, false, damaged, false);
      this.episodeReward += reward;
      const nextState = this.qlearning.stateKey(this.pos.x, this.pos.y, this.energy);
      this.qlearning.update(prevState, actionIdx, reward, nextState, this.pos.x, this.pos.y, this.energy);
      this.lastAction='MOVE';
      const nextTarget = this.env.getRemainingVictims()[0];
      if (nextTarget && this.decision.shouldRecharge(this.pos, this.energy, nextTarget)) {
        this._addLog(`🔋 E: ${this.energy}. Yendo a recarga...`,'warn');
        this._routeToNearestCharge();
      }
      if (this.pathIndex >= this.currentPath.length) { this.planIndex++; this._loadNextPlanStep(); }
    } else { this._replan(); }

    const state = { rescuedCount:this.env.victims.filter(v=>v.rescued).length,
      energy:this.energy, steps:this.steps, damageReceived:this.damageReceived, dangerSteps:this.dangerSteps };
    const utility = this.decision.computeUtility(state);
    this.decision.recordDecision(this.pos, this.lastAction, utility);
    this.utilityHistory.push(Math.round(utility));
    if (this.utilityHistory.length > 200) this.utilityHistory.shift();
    return true;
  }

  manualStep(dx, dy) {
    const nx=this.pos.x+dx, ny=this.pos.y+dy;
    if (!this.env.isWalkable(nx,ny)) return false;
    this.pos={x:nx,y:ny}; this.energy=Math.max(0,this.energy-1); this.steps++;
    this.env.updateFog(nx, ny, 3);
    const v = this.env.getVictimAt(nx,ny);
    if (v) { v.rescued=true; this._spawnParticles(nx,ny); this._addLog(`🚁 Víctima #${v.id} rescatada manualmente!`,'success'); }
    this.env.tick(this.pos);
    return true;
  }

  _spawnParticles(x,y) {
    for (let i=0;i<20;i++) {
      const angle=(Math.PI*2*i)/20+Math.random()*.4;
      const speed=1.5+Math.random()*2.5;
      this.particles.push({ x,y, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed,
        life:1.0, decay:.04+Math.random()*.03, color:Math.random()>.5?'#00ff9d':'#00e6ff',
        size:2+Math.random()*3 });
    }
  }

  updateParticles() {
    this.particles = this.particles.filter(p => {
      p.x+=p.vx; p.y+=p.vy; p.vx*=.88; p.vy*=.88; p.life-=p.decay; return p.life>0;
    });
  }

  _loadNextPlanStep() {
    while (this.planIndex < this.plan.length) {
      const step = this.plan[this.planIndex];
      if (step.type==='MOVE_TO_VICTIM'||step.type==='RECHARGE') {
        const result=this.search.findPath(this.pos,step.to,this.algorithm);
        this.currentPath=result.path.slice(1); this.pathIndex=0;
        if (step.type==='MOVE_TO_VICTIM') {
          const bm=this.search.benchmark(this.pos,step.to);
          this.searchMetrics.bfsNodes.push(bm.bfs.nodes); this.searchMetrics.astarNodes.push(bm.astar.nodes);
          this.searchMetrics.bfsTimes.push(bm.bfs.time); this.searchMetrics.astarTimes.push(bm.astar.time);
          this._addLog(`📍 Ruta: ${result.path.length} pasos (${result.nodesExpanded} nodos)`,'plan');
        }
        return;
      }
      this.planIndex++;
    }
    this.currentPath=[];
  }

  _replan() { this.plan=this.planner.generatePlan(this.pos,this.energy,this.algorithm); this.planIndex=0; this._loadNextPlanStep(); }

  _routeToNearestCharge() {
    const n=this.env.chargeStations.reduce((b,cs)=>{const d=Math.abs(cs.x-this.pos.x)+Math.abs(cs.y-this.pos.y);return !b||d<b.dist?{...cs,dist:d}:b;},null);
    if(n){const r=this.search.findPath(this.pos,n,this.algorithm);this.currentPath=r.path.slice(1);this.pathIndex=0;}
  }

  _dirToIdx(f,t){const dx=t.x-f.x,dy=t.y-f.y;if(dy===-1)return 0;if(dx===1)return 1;if(dy===1)return 2;return 3;}
  _addLog(msg,type='info'){this.log.push({msg,type,time:this.steps});if(this.log.length>200)this.log.shift();}

  getAvgSearchMetrics() {
    const avg=arr=>arr.length?(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1):'—';
    return{bfsNodes:avg(this.searchMetrics.bfsNodes),astarNodes:avg(this.searchMetrics.astarNodes),
      bfsTimes:avg(this.searchMetrics.bfsTimes),astarTimes:avg(this.searchMetrics.astarTimes)};
  }

  getState() {
    return{pos:{...this.pos},energy:this.energy,steps:this.steps,
      rescuedCount:this.env.victims.filter(v=>v.rescued).length,totalVictims:this.env.victims.length,
      damageReceived:this.damageReceived,dangerSteps:this.dangerSteps,finished:this.finished,
      currentPath:this.currentPath.slice(this.pathIndex)};
  }
}
