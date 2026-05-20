/**
 * main.js v4
 * Splash, movimiento suave, partículas rescate, highscores,
 * gráfica utilidad, Q-table persistente, drawers móvil.
 */

let env = null, agent = null, simInterval = null, paused = false;
let utilHistory = [], rescueParticles = [], animPos = null;

const canvas    = document.getElementById('game-canvas');
const pCanvas   = document.getElementById('particle-canvas');
const pCtx      = pCanvas.getContext('2d');
const logList   = document.getElementById('log-list');
const kbContent = document.getElementById('kb-content');
const planContent = document.getElementById('plan-content');
const qCanvas   = document.getElementById('qval-canvas');
const utilChart = document.getElementById('util-chart');

// ── SPLASH ────────────────────────────────────────────────────────────────────
const SPLASH_MSGS = [
  'Inicializando módulos IA...','Cargando BFS / A*...',
  'Compilando base de conocimiento...','Activando Q-Learning...','Sistema listo.',
];
let splashIdx = 0;
const splashStatus = document.getElementById('splash-status');
const splashBtn    = document.getElementById('splash-btn');
function tickSplash() {
  if (splashIdx < SPLASH_MSGS.length) {
    splashStatus.textContent = SPLASH_MSGS[splashIdx++];
    setTimeout(tickSplash, 380);
  } else { splashBtn.style.display = 'block'; }
}
setTimeout(tickSplash, 600);
window.hideSplash = function() {
  document.getElementById('splash').classList.add('hidden');
  audio.init();
};

// ── MOBILE ────────────────────────────────────────────────────────────────────
window.toggleDrawer = function(side) {
  const panel   = document.getElementById(side === 'left' ? 'panel-left' : 'panel-right');
  const overlay = document.getElementById('drawer-overlay');
  const open    = panel.classList.contains('open');
  closeDrawers();
  if (!open) { panel.classList.add('open'); overlay.classList.add('open'); }
};
window.closeDrawers = function() {
  ['panel-left','panel-right','drawer-overlay'].forEach(id =>
    document.getElementById(id).classList.remove('open'));
};
function applyMobileUI() {
  const m = window.innerWidth <= 640;
  const b = document.getElementById('btn-info-mobile');
  if (b) b.style.display = m ? 'flex' : 'none';
}
window.addEventListener('resize', applyMobileUI);
applyMobileUI();

// ── CANVAS SIZING ─────────────────────────────────────────────────────────────
function resizeCanvas() {
  const area = document.getElementById('canvas-area');
  const size = Math.max(260, Math.min(area.clientWidth - 20, area.clientHeight - 64, 640));
  canvas.width = canvas.height = size;
  pCanvas.width = pCanvas.height = size;
  pCanvas.style.width = pCanvas.style.height = size + 'px';
  if (env) env.render(canvas, animPos || (agent ? agent.pos : null), agent ? agent.getState().currentPath : []);
}
window.addEventListener('resize', resizeCanvas);

// ── SLIDERS ───────────────────────────────────────────────────────────────────
document.getElementById('speed-slider').addEventListener('input', e => {
  const v = +e.target.value;
  document.getElementById('lbl-speed').textContent = v < 200 ? 'Rápido' : v < 500 ? 'Normal' : 'Lento';
  if (simInterval) { stopSimulation(); startLoop(); }
});
document.getElementById('victims-count').addEventListener('input', e =>
  document.getElementById('lbl-victims').textContent = e.target.value);
document.getElementById('obstacle-density').addEventListener('input', e =>
  document.getElementById('lbl-obs').textContent = e.target.value + '%');
document.getElementById('map-size').addEventListener('change', e =>
  document.getElementById('lbl-size').textContent = `${e.target.value}×${e.target.value}`);

// ── TABS ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
}));

// ── MUSIC ─────────────────────────────────────────────────────────────────────
document.getElementById('btn-music').addEventListener('click', function() {
  const on = audio.toggle();
  this.classList.toggle('active', on);
  this.textContent = on ? '♬' : '♪';
});

// ── GENERATE ─────────────────────────────────────────────────────────────────
document.getElementById('btn-generate').addEventListener('click', () => {
  stopSimulation(); agent = null; animPos = null;
  utilHistory = []; rescueParticles = [];
  const size = +document.getElementById('map-size').value;
  const vict = +document.getElementById('victims-count').value;
  const obs  = +document.getElementById('obstacle-density').value;
  env = new Environment(size, vict, obs);
  env.generate();
  resizeCanvas();
  env.render(canvas, null, []);
  document.getElementById('btn-start').disabled = false;
  setStatus('idle','LISTO');
  addLog('Mapa generado. Presiona Iniciar.','info');
  resetHUD();
  kbContent.innerHTML = '<p class="muted-msg">Inicia el agente.</p>';
  planContent.innerHTML = '<p class="muted-msg">Plan STRIPS aquí.</p>';
  document.getElementById('compare-results').innerHTML = '';
  audio.playMapGenerate();
  drawUtilChart();
  closeDrawers();
});

// ── START ─────────────────────────────────────────────────────────────────────
document.getElementById('btn-start').addEventListener('click', () => {
  if (!env) return;
  stopSimulation(); utilHistory = []; rescueParticles = [];
  const algo = document.getElementById('algo-select').value;
  agent = new RescueAgent(env, algo);
  agent.initialize();
  animPos = { ...agent.pos };
  document.getElementById('btn-start').disabled = true;
  document.getElementById('btn-pause').disabled = false;
  paused = false;
  setStatus('run','EJECUTANDO');
  renderPlan(); startLoop(); closeDrawers();
});

// ── PAUSE ─────────────────────────────────────────────────────────────────────
document.getElementById('btn-pause').addEventListener('click', function() {
  paused = !paused;
  this.textContent = paused ? '▶ Reanudar' : '⏸ Pausa';
  setStatus(paused ? 'idle' : 'run', paused ? 'PAUSADO' : 'EJECUTANDO');
});

// ── RESET ─────────────────────────────────────────────────────────────────────
document.getElementById('btn-reset').addEventListener('click', () => {
  stopSimulation(); agent = env = null; animPos = null;
  utilHistory = []; rescueParticles = [];
  canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
  pCtx.clearRect(0,0,pCanvas.width,pCanvas.height);
  document.getElementById('btn-start').disabled = true;
  document.getElementById('btn-pause').disabled = true;
  setStatus('idle','INACTIVO'); logList.innerHTML = '';
  resetHUD(); drawUtilChart();
});

// ── BENCHMARK ─────────────────────────────────────────────────────────────────
document.getElementById('btn-compare').addEventListener('click', () => {
  if (!env) { addLog('Genera un mapa primero.','warn'); return; }
  const search = new SearchAlgorithms(env);
  const victims = env.getRemainingVictims();
  if (!victims.length) return;
  let nb=0,na=0,tb=0,ta=0;
  victims.forEach(v => {
    const r = search.benchmark({x:0,y:0}, v);
    nb += r.bfs.nodes; na += r.astar.nodes;
    tb += r.bfs.time;  ta += r.astar.time;
  });
  const ratio = (nb / Math.max(na,1)).toFixed(1);
  document.getElementById('compare-results').innerHTML = `
    <table class="cmp-table">
      <tr><th>Métrica</th><th>BFS</th><th>A*</th></tr>
      <tr><td>Nodos</td><td>${nb}</td><td class="win">${na}</td></tr>
      <tr><td>ms</td><td>${tb.toFixed(2)}</td><td class="win">${ta.toFixed(2)}</td></tr>
      <tr><td>Ganador</td><td colspan="2" class="win">⭐ A* (${ratio}x)</td></tr>
    </table>`;
  document.getElementById('m-bfs-n').textContent = nb;
  document.getElementById('m-astar-n').textContent = na;
  addLog(`Benchmark: BFS=${nb} | A*=${na} | A* ${ratio}x más eficiente`,'info');
});

// ── GAME LOOP ─────────────────────────────────────────────────────────────────
function startLoop() {
  const delay = Math.max(50, 850 - +document.getElementById('speed-slider').value);
  simInterval = setInterval(tick, delay);
}

function tick() {
  if (paused || !agent) return;
  const prevPos = { ...agent.pos };
  const alive   = agent.step();
  const state   = agent.getState();
  animateMove(prevPos, state.pos, state);
  updateHUD(state);
  flushLogs(state);
  updateKB();
  updateQMap();
  renderPlan();
  updateUtilChart(state);
  if (!alive || agent.finished) { stopSimulation(); onMissionEnd(state); }
}

// ── SMOOTH MOVEMENT ───────────────────────────────────────────────────────────
function animateMove(from, to, state) {
  const STEPS = 8; let frame = 0;
  (function step() {
    frame++;
    const t = frame / STEPS;
    animPos = { x: from.x + (to.x - from.x)*t, y: from.y + (to.y - from.y)*t };
    env.render(canvas, animPos, state.currentPath);
    tickParticles();
    if (frame < STEPS) requestAnimationFrame(step);
    else animPos = { ...to };
  })();
}

// ── RESCUE PARTICLES ─────────────────────────────────────────────────────────
function spawnRescueParticles(gx, gy) {
  const cw = canvas.width / env.size;
  const cx = (gx + 0.5) * cw, cy = (gy + 0.5) * cw;
  for (let i = 0; i < 24; i++) {
    const angle = (Math.PI * 2 * i) / 24 + Math.random() * 0.4;
    const speed = 1.5 + Math.random() * 3;
    rescueParticles.push({
      x: cx, y: cy,
      vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed,
      life: 1, decay: 0.03 + Math.random()*0.02,
      r: 2 + Math.random()*3,
      neon: Math.random() > 0.5,
    });
  }
}

function tickParticles() {
  pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
  rescueParticles = rescueParticles.filter(p => p.life > 0);
  rescueParticles.forEach(p => {
    pCtx.beginPath();
    pCtx.arc(p.x, p.y, p.r * p.life, 0, Math.PI*2);
    pCtx.fillStyle = p.neon
      ? `rgba(0,230,255,${p.life})`
      : `rgba(0,255,157,${p.life})`;
    pCtx.fill();
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.1;
    p.life -= p.decay;
  });
}

function stopSimulation() {
  if (simInterval) { clearInterval(simInterval); simInterval = null; }
  document.getElementById('btn-pause').disabled = true;
  paused = false;
  document.getElementById('btn-pause').textContent = '⏸ Pausa';
}

// ── MISSION END ───────────────────────────────────────────────────────────────
function onMissionEnd(state) {
  const win = state.rescuedCount === state.totalVictims;
  setStatus(win ? 'done' : 'fail', win ? 'COMPLETADO' : 'FALLIDO');
  win ? audio.playComplete() : audio.playFail();
  if (win) env.victims.forEach(v => spawnRescueParticles(v.x, v.y));

  const metrics = agent.decision.getPerformanceMetrics({ ...state, totalVictims: state.totalVictims });
  const sm      = agent.getAvgSearchMetrics();
  document.getElementById('ov-icon').textContent  = win ? '🎖' : '💀';
  document.getElementById('ov-title').textContent = win ? 'MISIÓN COMPLETADA' : 'MISIÓN FALLIDA';
  document.getElementById('ov-stats').innerHTML = [
    ['Rescatados',`${state.rescuedCount}/${state.totalVictims}`],
    ['Pasos',state.steps],['Energía',state.energy],['Daños',state.damageReceived],
    ['Utilidad',metrics.utility],['Q-Epis.',agent.qlearning.episodes],
    ['A* nodos',sm.astarNodes],['BFS nodos',sm.bfsNodes],
  ].map(([l,v]) => `<div class="overlay-stat"><div class="overlay-stat-label">${l}</div><div class="overlay-stat-val">${v}</div></div>`).join('');
  document.getElementById('overlay').classList.remove('hidden');
  saveScore({ date: new Date().toLocaleDateString(), rescued: `${state.rescuedCount}/${state.totalVictims}`, steps: state.steps, utility: +metrics.utility, algo: agent.algorithm.toUpperCase() });
  renderHighscores();
}

// ── HIGHSCORES ────────────────────────────────────────────────────────────────
function saveScore(entry) {
  let s = [];
  try { s = JSON.parse(localStorage.getItem('rescue_scores') || '[]'); } catch(e){}
  s.unshift(entry); s = s.slice(0,5);
  try { localStorage.setItem('rescue_scores', JSON.stringify(s)); } catch(e){}
}
function renderHighscores() {
  let s = [];
  try { s = JSON.parse(localStorage.getItem('rescue_scores') || '[]'); } catch(e){}
  const el = document.getElementById('highscores');
  if (!s.length) { el.innerHTML = '<p class="muted-msg">Sin records.</p>'; return; }
  el.innerHTML = `<div class="score-row"><span>Fecha</span><span>Res.</span><span class="score-val">Util</span></div>` +
    s.map(r => `<div class="score-row"><span>${r.date}</span><span>${r.rescued}</span><span class="score-val">${r.utility}</span></div>`).join('');
}

// ── UTILITY CHART ─────────────────────────────────────────────────────────────
function updateUtilChart(state) {
  if (!agent) return;
  utilHistory.push(agent.decision.computeUtility({ rescuedCount:state.rescuedCount, energy:state.energy, steps:state.steps, damageReceived:state.damageReceived||0, dangerSteps:state.dangerSteps||0 }));
  if (utilHistory.length > 80) utilHistory.shift();
  drawUtilChart();
}
function drawUtilChart() {
  const W = utilChart.offsetWidth || 180, H = 48;
  utilChart.width = W; utilChart.height = H;
  const ctx = utilChart.getContext('2d');
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = 'rgba(0,230,255,0.04)'; ctx.fillRect(0,0,W,H);
  if (utilHistory.length < 2) {
    ctx.fillStyle='#3a6080'; ctx.font='9px monospace'; ctx.textAlign='center';
    ctx.fillText('Sin datos', W/2, H/2+3); return;
  }
  const min = Math.min(...utilHistory), max = Math.max(...utilHistory,1);
  const range = max - min || 1;
  const toY = v => H - ((v-min)/range)*(H-6) - 3;
  // Zero line
  ctx.strokeStyle='rgba(0,230,255,0.1)'; ctx.lineWidth=0.5;
  ctx.beginPath(); ctx.moveTo(0,toY(0)); ctx.lineTo(W,toY(0)); ctx.stroke();
  // Line
  ctx.beginPath();
  utilHistory.forEach((v,i) => {
    const x = (i/(utilHistory.length-1))*W;
    i===0 ? ctx.moveTo(x,toY(v)) : ctx.lineTo(x,toY(v));
  });
  ctx.strokeStyle='#00ff9d'; ctx.lineWidth=1.5; ctx.stroke();
  // Fill
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'rgba(0,255,157,0.25)'); g.addColorStop(1,'rgba(0,255,157,0)');
  ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath(); ctx.fillStyle=g; ctx.fill();
  // Last value
  ctx.fillStyle='#00ff9d'; ctx.font='bold 9px monospace'; ctx.textAlign='right';
  ctx.fillText(Math.round(utilHistory[utilHistory.length-1]), W-3, 10);
}

// ── HUD ───────────────────────────────────────────────────────────────────────
function updateHUD(state) {
  const pct = state.energy;
  const fill = document.getElementById('energy-fill');
  fill.style.width = pct + '%';
  fill.style.background = pct > 50 ? 'linear-gradient(90deg,var(--neon2),var(--neon))' :
    pct > 20 ? 'linear-gradient(90deg,var(--warn),var(--orange))' :
    'linear-gradient(90deg,var(--danger),var(--orange))';
  document.getElementById('energy-val').textContent  = state.energy;
  document.getElementById('rescued-val').textContent = `${state.rescuedCount}/${state.totalVictims}`;
  document.getElementById('steps-val').textContent   = state.steps;
  document.getElementById('algo-val').textContent    = (agent?.algorithm||'?').toUpperCase();
  document.getElementById('m-dmg').textContent       = state.damageReceived;
  document.getElementById('m-qep').textContent       = agent?.qlearning?.episodes ?? 0;
  const util = agent ? agent.decision.computeUtility({...state, damageReceived:state.damageReceived||0}) : 0;
  document.getElementById('utility-top').textContent = Math.round(util);
  document.getElementById('m-util').textContent = Math.round(util);
  document.getElementById('util-fill').style.width = Math.min(100,Math.max(0,(util+100)/7)) + '%';
}
function resetHUD() {
  document.getElementById('energy-fill').style.width='100%';
  document.getElementById('energy-val').textContent='100';
  document.getElementById('rescued-val').textContent='0/0';
  document.getElementById('steps-val').textContent='0';
  document.getElementById('utility-top').textContent='—';
  document.getElementById('m-util').textContent='—';
  document.getElementById('util-fill').style.width='0%';
  document.getElementById('m-dmg').textContent='0';
  document.getElementById('m-qep').textContent='0';
}

// ── LOGS ──────────────────────────────────────────────────────────────────────
let lastLogLen = 0;
function flushLogs(state) {
  if (!agent) return;
  const newLogs = agent.log.slice(lastLogLen);
  lastLogLen = agent.log.length;
  newLogs.forEach(l => {
    addLog(l.msg, l.type);
    if (l.type==='success' && l.msg.includes('rescatada')) {
      audio.playRescue();
      const m = l.msg.match(/\((\d+),(\d+)\)/);
      if (m) spawnRescueParticles(+m[1], +m[2]);
    }
    if (l.type==='error'   && l.msg.includes('Daño'))       audio.playDamage();
    if (l.type==='success' && l.msg.includes('Recargando')) audio.playRecharge();
    if (l.type==='warn'    && l.msg.includes('dinámico'))   audio.playDynamic();
  });
}
function addLog(msg, type='info') {
  const el = document.createElement('div');
  el.className = `log-entry ${type}`; el.textContent = msg;
  logList.appendChild(el); logList.scrollTop = logList.scrollHeight;
  while (logList.children.length > 120) logList.removeChild(logList.firstChild);
}

// ── KB, PLAN, Q-MAP ───────────────────────────────────────────────────────────
function updateKB() {
  if (!agent) return;
  const facts=agent.kb.getFacts(), safe=agent.kb.getSafeCells().length;
  const rv=agent.kb.getReachableVictims().length;
  const nc=agent.kb.query('need_charge'), el=agent.kb.query('energy_low');
  const unc=agent.uncertainty.getSummary();
  kbContent.innerHTML = `
    <div class="kb-group"><div class="kb-group-title">Agente</div>
      <div class="kb-fact true">at(${agent.pos.x},${agent.pos.y})</div>
      <div class="kb-fact ${nc?'true':''}">need_charge: ${nc}</div>
      <div class="kb-fact ${el?'true':''}">energy_low: ${el}</div></div>
    <div class="kb-group"><div class="kb-group-title">Inferencias</div>
      <div class="kb-fact true">safe: ${safe}</div>
      <div class="kb-fact true">alcanzables: ${rv}</div>
      <div class="kb-fact true">hechos: ${facts.length}</div></div>
    <div class="kb-group"><div class="kb-group-title">Incertidumbre</div>
      <div class="kb-fact">obs: ${unc.totalObservations}</div>
      <div class="kb-fact">alto_riesgo: ${unc.highRiskCells}</div>
      <div class="kb-fact">creencia: ${unc.averageBelief}</div></div>
    <div class="kb-group"><div class="kb-group-title">Hechos clave</div>
      ${facts.filter(f=>f.startsWith('safe(')||f.startsWith('avoid(')||f.startsWith('reachable')).slice(0,8).map(f=>`<div class="kb-fact true">${f}</div>`).join('')}</div>`;
}
function renderPlan() {
  if (!agent || !agent.plan.length) return;
  planContent.innerHTML = agent.plan.map((s,i) => {
    const done=i<agent.planIndex, cur=i===agent.planIndex;
    return `<div class="plan-step ${done?'done':''} ${cur?'current':''}"><span style="color:var(--text-dim)">${i+1}.</span> ${s.description}</div>`;
  }).join('');
}
function updateQMap() {
  if (!agent || !env) return;
  const s = agent.qlearning.getSummary();
  qCanvas.width = qCanvas.offsetWidth || 240; qCanvas.height = 200;
  agent.qlearning.renderQMap(qCanvas, env.size);
  document.getElementById('q-info').innerHTML =
    `<div class="q-info">Estados: <strong>${s.statesLearned}</strong> | ε: <strong>${s.epsilon}</strong> | Reward: <strong>${s.avgReward}</strong></div>`;
}

// ── STATUS & INIT ─────────────────────────────────────────────────────────────
function setStatus(type, text) {
  document.getElementById('status-dot').className = `status-dot ${type}`;
  document.getElementById('status-text').textContent = text;
}
resizeCanvas(); renderHighscores(); drawUtilChart();
addLog('RESCUE AI v4.0 listo.','info');
addLog('♪ música  |  ☰ controles (móvil)','info');
