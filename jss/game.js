"use strict";

/* ================= DATA & KONSTANTA ================= */
const COLORS = [
  {n:"Putih",  h:"#EDEDED", t:"#000", val:1},
  {n:"Biru",   h:"#1F6FEB", t:"#fff", val:2},
  {n:"Kuning", h:"#F2B705", t:"#000", val:3},
  {n:"Hijau",  h:"#2E9E44", t:"#fff", val:4},
  {n:"Ungu",   h:"#8B3FD1", t:"#fff", val:5},
  {n:"Merah",  h:"#D6373A", t:"#fff", val:6},
  {n:"Hitam",  h:"#1A1A1A", t:"#fff", val:7},
];
const VAL = [1,2,3,4,5,6,7];
const CARD_VALUE = (q) => q.reduce((s,c)=>s+COLORS[c].val, 0);

/* ================= STATISTIK & LOCALSTORAGE ================= */
const STORAGE_KEY = 'quadran_ztratax_stats_v1';

function loadStats() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : defaultStats();
  } catch(e) {
    return defaultStats();
  }
}

function saveStats(stats) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

function defaultStats() {
  return {
    pvp: {
      p1: { playCount:0, winCount:0, totalScore:0, totalCardsPlayedValue:0, totalCardsRemainingValue:0 },
      p2: { playCount:0, winCount:0, totalScore:0, totalCardsPlayedValue:0, totalCardsRemainingValue:0 }
    },
    pve: {
      player: { playCount:0, winCount:0, totalScore:0, totalCardsPlayedValue:0, totalCardsRemainingValue:0 },
      computer: { playCount:0, winCount:0, totalScore:0, totalCardsPlayedValue:0, totalCardsRemainingValue:0 }
    },
    history: []
  };
}

let globalStats = loadStats();

function updateStats(mode, winnerIndex, scoreP1, scoreP2, playedValueP1, playedValueP2, remainingValueP1, remainingValueP2, duration, cluesUsedP1, cluesUsedP2, drawsP1, drawsP2) {
  const stats = globalStats;
  const key = mode === 'pvp' ? 'pvp' : 'pve';
  let p1Key, p2Key;
  if (mode === 'pvp') {
    p1Key = 'p1'; p2Key = 'p2';
  } else {
    p1Key = 'player'; p2Key = 'computer';
  }
  stats[key][p1Key].playCount++;
  stats[key][p2Key].playCount++;
  if (winnerIndex === 0) stats[key][p1Key].winCount++;
  else stats[key][p2Key].winCount++;
  stats[key][p1Key].totalScore += scoreP1;
  stats[key][p2Key].totalScore += scoreP2;
  stats[key][p1Key].totalCardsPlayedValue += playedValueP1;
  stats[key][p2Key].totalCardsPlayedValue += playedValueP2;
  stats[key][p1Key].totalCardsRemainingValue += remainingValueP1;
  stats[key][p2Key].totalCardsRemainingValue += remainingValueP2;

  const historyEntry = {
    timestamp: new Date().toISOString(),
    mode: mode,
    winner: winnerIndex,
    duration: duration,
    scoreP1, scoreP2,
    playedValueP1, playedValueP2,
    remainingValueP1, remainingValueP2,
    cluesUsedP1, cluesUsedP2,
    drawsP1, drawsP2
  };
  stats.history.unshift(historyEntry);
  if (stats.history.length > 50) stats.history = stats.history.slice(0, 50);

  saveStats(stats);
}

/* ================= DECK 210 KARTU ================= */
function perms(a){
  if(a.length <= 1) return [a.slice()];
  const r = [];
  for(let i=0;i<a.length;i++){
    const rest = a.slice(0,i).concat(a.slice(i+1));
    for(const p of perms(rest)) r.push([a[i]].concat(p));
  }
  return r;
}
function buildDeck(){
  const deck = [];
  const idx = [0,1,2,3,4,5,6];
  (function comb(start, combo){
    if(combo.length === 4){
      for(const p of perms(combo.slice(1))) deck.push([combo[0], p[0], p[1], p[2]]);
      return;
    }
    for(let i=start;i<idx.length;i++){ combo.push(idx[i]); comb(i+1, combo); combo.pop(); }
  })(0, []);
  return deck;
}
function shuffle(a){
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
const rotCW = q => [q[3], q[0], q[1], q[2]];
function rotated(q, r){ let x=q.slice(); for(let i=0;i<r;i++) x=rotCW(x); return x; }
function cardValue(q){ return CARD_VALUE(q); }
function edges(q){
  return { N:[q[0],q[1]], E:[q[1],q[2]], S:[q[3],q[2]], W:[q[0],q[3]] };
}

/* ================= STATE ================= */
let S = null;
const key = (x,y) => x+","+y;
const DIRS = { N:[0,-1], E:[1,0], S:[0,1], W:[-1,0] };
const OPP  = { N:"S", E:"W", S:"N", W:"E" };

let viewState = { scale: 1, x: 0, y: 0 };
let baseFitScale = 1;

let gamePaused = false;
let gameLogs = [];
let currentScores = { p1:0, p2:0 };
let currentClues = { p1:0, p2:0 };
let currentDraws = { p1:0, p2:0 };
let currentPlayedValue = { p1:0, p2:0 };
let gameStartTime = 0;
let gameDuration = 0;

/* ================= LOG ================= */
function addLog(msg, who){
  const whoLabel = who==="p1" ? "[P1] " : who==="p2" ? "[P2] " : "";
  gameLogs.push(whoLabel + msg);
  if(gameLogs.length > 50) gameLogs.shift();
}
function log(msg, who){
  addLog(msg, who);
}

/* ================= PAUSE MENU ================= */
function openPauseMenu(){
  if(!S) return;
  gamePaused = true;
  const logContent = document.getElementById('logContent');
  logContent.innerHTML = gameLogs.length ? gameLogs.map(l => `<div>${l}</div>`).join('') : '<div>Belum ada aksi.</div>';
  document.getElementById('pauseOverlay').style.display = 'flex';
}
function closePauseMenu(){
  gamePaused = false;
  document.getElementById('pauseOverlay').style.display = 'none';
}
function restartGame(){
  closePauseMenu();
  const mode = S.mode;
  gameLogs = [];
  newGame(mode);
}
function changeMode(){
  closePauseMenu();
  gameLogs = [];
  document.getElementById('gameScreen').style.display = 'none';
  document.getElementById('startScreen').style.display = 'flex';
  playMenuMusic();
}

function openStatsModal(){
  const stats = globalStats;
  const mode = S.mode;
  const key = mode === 'pvp' ? 'pvp' : 'pve';
  let p1Name, p2Name, p1Stats, p2Stats;
  if (mode === 'pvp') {
    p1Name = "Player 1"; p2Name = "Player 2";
    p1Stats = stats.pvp.p1; p2Stats = stats.pvp.p2;
  } else {
    p1Name = "Player"; p2Name = "Computer";
    p1Stats = stats.pve.player; p2Stats = stats.pve.computer;
  }
  const winRate = (st) => st.playCount > 0 ? (st.winCount / st.playCount * 100).toFixed(1) : '0';
  const html = `
    <h3>Statistik ${mode === 'pvp' ? 'PvP' : 'PvE'}</h3>
    <table>
      <tr><th>Metrik</th><th>${p1Name}</th><th>${p2Name}</th></tr>
      <tr><td>Play Count</td><td>${p1Stats.playCount}</td><td>${p2Stats.playCount}</td></tr>
      <tr><td>Win Count</td><td>${p1Stats.winCount}</td><td>${p2Stats.winCount}</td></tr>
      <tr><td>Win Rate</td><td>${winRate(p1Stats)}%</td><td>${winRate(p2Stats)}%</td></tr>
      <tr><td>Total Skor</td><td>${p1Stats.totalScore}</td><td>${p2Stats.totalScore}</td></tr>
      <tr><td>Nilai Kartu Dimainkan</td><td>${p1Stats.totalCardsPlayedValue}</td><td>${p2Stats.totalCardsPlayedValue}</td></tr>
      <tr><td>Nilai Kartu Sisa</td><td>${p1Stats.totalCardsRemainingValue}</td><td>${p2Stats.totalCardsRemainingValue}</td></tr>
    </table>
    <h4>Riwayat (5 terakhir)</h4>
    <ul>
      ${stats.history.slice(0,5).map(h=>`<li>${new Date(h.timestamp).toLocaleString()} - ${h.mode} - Winner: ${h.winner===0?'P1':'P2'}</li>`).join('') || 'Belum ada riwayat'}
    </ul>
  `;
  document.getElementById('statsContent').innerHTML = html;
  document.getElementById('statsOverlay').style.display = 'flex';
}

function closeStatsModal(){
  document.getElementById('statsOverlay').style.display = 'none';
}

/* ================= NEW GAME ================= */
function newGame(mode){
  const deck = shuffle(buildDeck());
  const hands = [];
  for(let i=0;i<2;i++) hands.push(deck.splice(0,8).sort((a,b)=>cardValue(b)-cardValue(a)));
  const board = new Map();
  board.set(key(0,0), { q: deck.shift(), byAI: false });
  
  const handRotations = hands.map(hand => hand.map(() => 0));
  
  S = {
    mode: mode, hands, handRotations, draw: deck, board, turn: 0,
    locked: false, selected: -1, selRot: 0, newCard: null, animating: false,
    showClue: false, clueTimeout: null
  };
  viewState = { scale: 1, x: 0, y: 0 };
  currentScores = { p1:0, p2:0 };
  currentClues = { p1:0, p2:0 };
  currentDraws = { p1:0, p2:0 };
  currentPlayedValue = { p1:0, p2:0 };
  gameStartTime = Date.now();
  addLog("Permainan dimulai! Player 1 jalan pertama.");
  renderAll();
}

/* ================= ATURAN ================= */
function canPlace(x, y, q){
  let contacts = 0;
  for(const d in DIRS){
    const nb = S.board.get(key(x+DIRS[d][0], y+DIRS[d][1]));
    if(nb){
      contacts++;
      const me = edges(q)[d], them = edges(nb.q)[OPP[d]];
      if(me[0]!==them[0] || me[1]!==them[1]) return 0;
    }
  }
  return contacts;
}
function legalMoves(hand){
  const out = [];
  const cand = new Set();
  for(const k of S.board.keys()){
    const [bx,by] = k.split(",").map(Number);
    for(const d in DIRS){
      const nx=bx+DIRS[d][0], ny=by+DIRS[d][1], nk=key(nx,ny);
      if(!S.board.has(nk)) cand.add(nk);
    }
  }
  hand.forEach((card, ci)=>{
    for(const ck of cand){
      const [x,y] = ck.split(",").map(Number);
      for(let rot=0; rot<4; rot++){
        const q = rotated(card, rot);
        const c = canPlace(x, y, q);
        if(c) out.push({ ci, x, y, rot, q, contacts: c });
      }
    }
  });
  return out;
}

/* Deteksi combo untuk kartu terakhir */
function detectCombo(x, y) {
  function hasCells(cells) {
    return cells.every(([cx,cy]) => S.board.has(key(cx,cy)));
  }
  // Persegi 2x2
  if (hasCells([[x,y],[x+1,y],[x,y+1],[x+1,y+1]])) return 10;
  // Persegi panjang 2x3 / 3x2
  if (hasCells([[x,y],[x+1,y],[x+2,y],[x,y+1],[x+1,y+1],[x+2,y+1]])) return 20;
  if (hasCells([[x,y],[x+1,y],[x,y+1],[x+1,y+1],[x,y+2],[x+1,y+2]])) return 20;
  // L shape (8) – berbagai orientasi
  if (hasCells([[x,y],[x+1,y],[x+2,y],[x,y+1],[x+1,y+1],[x+2,y+1],[x,y+2],[x+1,y+2]])) return 30;
  if (hasCells([[x,y],[x+1,y],[x+2,y],[x,y+1],[x+1,y+1],[x+2,y+1],[x+1,y+2],[x+2,y+2]])) return 30;
  // Square 3x3
  if (hasCells([[x,y],[x+1,y],[x+2,y],[x,y+1],[x+1,y+1],[x+2,y+1],[x,y+2],[x+1,y+2],[x+2,y+2]])) return 40;
  return 0;
}

/* ================= RENDER ================= */
const boardEl = document.getElementById("board");
const handP1El = document.getElementById("handPlayer1");
const handP2El = document.getElementById("handPlayer2");
const drawPileCountEl = document.getElementById("drawPileCount");

function quadDivsHTML(q){
  return '<div class="q" style="background:'+COLORS[q[0]].h+'"></div>'+
         '<div class="q" style="background:'+COLORS[q[1]].h+'"></div>'+
         '<div class="q" style="background:'+COLORS[q[3]].h+'"></div>'+
         '<div class="q" style="background:'+COLORS[q[2]].h+'"></div>';
}
function cardHTML(q, cls, style){
  return '<div class="'+cls+'" '+(style||"")+'>'+quadDivsHTML(q)+'</div>';
}

function showClue() {
  if(S.locked || S.animating || gamePaused) return;
  S.showClue = true;
  currentClues[S.turn === 0 ? 'p1':'p2']++;
  currentScores[S.turn === 0 ? 'p1':'p2'] -= 5;
  renderBoard();
  clearTimeout(S.clueTimeout);
  S.clueTimeout = setTimeout(()=>{
    S.showClue = false;
    renderBoard();
  }, 3000);
  SoundEffects.select();
}

function renderBoard(){
  if(gamePaused) return;
  const cells = [...S.board.keys()].map(k=>k.split(",").map(Number));
  const legalSet = new Set();
  if(!S.locked && !S.animating && S.showClue){
    const curPlayer = S.turn;
    const hand = S.hands[curPlayer];
    for(const m of legalMoves(hand)) legalSet.add(key(m.x,m.y));
  }
  
  let xs = cells.map(c=>c[0]), ys = cells.map(c=>c[1]);
  for(const k of legalSet){ const [x,y]=k.split(",").map(Number); xs.push(x); ys.push(y); }
  const minX=Math.min(...xs)-1, maxX=Math.max(...xs)+1, minY=Math.min(...ys)-1, maxY=Math.max(...ys)+1;
  const boardWidth = (maxX-minX+1)*70;
  const boardHeight = (maxY-minY+1)*70;
  boardEl.style.width  = boardWidth + "px";
  boardEl.style.height = boardHeight + "px";
  let h = "";
  for(let y=minY;y<=maxY;y++) for(let x=minX;x<=maxX;x++){
    const k = key(x,y), px=(x-minX)*70, py=(y-minY)*70;
    if(S.board.has(k)){
      let cls = "card";
      if(S.newCard === k) cls += " placing";
      h += cardHTML(S.board.get(k).q, cls, 'style="left:'+px+'px;top:'+py+'px"');
    } else {
      const lg = legalSet.has(k);
      h += '<div class="cellEmpty'+(lg?" legal":"")+'" data-x="'+x+'" data-y="'+y+'" style="left:'+px+'px;top:'+py+'px"></div>';
    }
  }
  boardEl.innerHTML = h;
  S.newCard = null;
  boardEl.querySelectorAll(".cellEmpty.legal").forEach(el=>{
    el.onclick = ()=> onCellClick(+el.dataset.x, +el.dataset.y);
  });
  fitBoard();
  applyTransform();
}

function fitBoard(){
  const wrap = document.getElementById("boardWrap");
  const wrapWidth = wrap.clientWidth - 30;
  const wrapHeight = wrap.clientHeight - 30;
  const boardWidth = boardEl.offsetWidth;
  const boardHeight = boardEl.offsetHeight;
  
  if(boardWidth === 0 || boardHeight === 0) return;
  
  let scale = 1;
  if(boardWidth > wrapWidth || boardHeight > wrapHeight){
    scale = Math.min(wrapWidth / boardWidth, wrapHeight / boardHeight);
    if(scale > 1) scale = 1;
  }
  baseFitScale = scale;
  
  if(viewState.scale === 1 || viewState.scale === baseFitScale) viewState.scale = baseFitScale;
}

function applyTransform(){
  boardEl.style.transform = `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.scale})`;
}

function zoomIn() {
  if(gamePaused) return;
  viewState.scale += 0.1;
  if (viewState.scale > 3) viewState.scale = 3;
  SoundEffects.zoom();
  applyTransform();
}
function zoomOut() {
  if(gamePaused) return;
  viewState.scale -= 0.1;
  if (viewState.scale < 0.5) viewState.scale = 0.5;
  SoundEffects.zoom();
  applyTransform();
}
function pan(dx, dy) {
  if(gamePaused) return;
  viewState.x += dx;
  viewState.y += dy;
  SoundEffects.pan();
  applyTransform();
}
function resetView() {
  if(gamePaused) return;
  viewState.scale = baseFitScale;
  viewState.x = 0;
  viewState.y = 0;
  SoundEffects.zoom();
  applyTransform();
}

function renderHands(){
  if(gamePaused) return;
  let h1 = "";
  S.hands[0].forEach((c,i)=>{
    const rot = S.handRotations[0][i] || 0;
    h1 += cardHTML(rotated(c, rot), "handCard"+(S.turn===0 && S.selected===i?" selected":""), 'data-i="'+i+'"');
  });
  handP1El.innerHTML = h1;
  handP1El.querySelectorAll(".handCard").forEach(el=>{
    attachDrag(el, 0, +el.dataset.i);
  });

  let h2 = "";
  S.hands[1].forEach((c,i)=>{
    const rot = S.handRotations[1][i] || 0;
    h2 += cardHTML(rotated(c, rot), "handCard"+(S.turn===1 && S.selected===i?" selected":""), 'data-i="'+i+'"');
  });
  handP2El.innerHTML = h2;
  if(S.mode === 'pvp') handP2El.querySelectorAll(".handCard").forEach(el=> attachDrag(el, 1, +el.dataset.i));
}

function updateHandSelectionUI(){
  [handP1El, handP2El].forEach((handEl, pid)=>{
    [...handEl.children].forEach((child, i)=>{
      const isSel = (S.turn === pid && S.selected === i);
      child.classList.toggle('selected', isSel);
    });
  });
}

function renderStatus(){
  document.getElementById("opponentInfo").textContent = (S.mode==='pvp' ? "Player 2" : "Komputer") + " (" + S.hands[1].length + " kartu)";
  drawPileCountEl.textContent = S.draw.length + " kartu yang tersisa";

  const btn1 = document.getElementById("btnDraw1");
  const btn2 = document.getElementById("btnDraw2");

  if(S.locked || S.animating || gamePaused){
    btn1.disabled = true; btn2.disabled = true;
    btn1.textContent = "Ambil Kartu"; btn2.textContent = "Ambil Kartu";
  } else {
    const canMove1 = legalMoves(S.hands[0]).length > 0;
    if(S.turn === 0){
      btn1.disabled = canMove1 || S.draw.length === 0;
      btn1.textContent = canMove1 ? "Ambil Kartu" : (S.draw.length > 0 ? "Ambil Kartu ("+S.draw.length+")" : "Pass");
      btn2.disabled = true;
    } else {
      btn2.disabled = legalMoves(S.hands[1]).length > 0 || S.draw.length === 0;
      btn2.textContent = legalMoves(S.hands[1]).length > 0 ? "Ambil Kartu" : (S.draw.length > 0 ? "Ambil Kartu ("+S.draw.length+")" : "Pass");
      btn1.disabled = true;
    }
  }
}

function renderAll(){ renderBoard(); renderHands(); renderStatus(); }

/* ================= ANIMASI ================= */
function animateMoveCard(fromElement, toElement, cardQ, callback){
  const fromRect = fromElement.getBoundingClientRect();
  const toRect = toElement.getBoundingClientRect();

  const fly = document.createElement('div');
  fly.className = 'flying-card';
  fly.style.left = fromRect.left + 'px';
  fly.style.top = fromRect.top + 'px';
  fly.style.width = fromRect.width + 'px';
  fly.style.height = fromRect.height + 'px';
  fly.innerHTML = quadDivsHTML(cardQ);
  fly.style.transform = 'scale(1)';
  
  document.body.appendChild(fly);

  requestAnimationFrame(() => {
    fly.style.left = toRect.left + 'px';
    fly.style.top = toRect.top + 'px';
    fly.style.transform = 'scale(1.15) rotate(5deg)';
    setTimeout(() => { fly.style.transform = 'scale(1) rotate(0deg)'; }, 250);
  });

  setTimeout(() => { fly.remove(); callback(); }, 550);
}

function animateDrawToHand(playerIndex, callback){
  const card = S.draw.shift();
  if(!card) { callback(); return; }
  
  const fromEl = document.getElementById("drawPile").querySelector('img');
  const toEl = playerIndex === 0 ? handP1El : handP2El;
  
  const fly = document.createElement('div');
  fly.className = 'flying-card';
  const fromRect = fromEl.getBoundingClientRect();
  const toRect = toEl.getBoundingClientRect();
  fly.style.left = fromRect.left + 'px';
  fly.style.top = fromRect.top + 'px';
  fly.style.width = '70px';
  fly.style.height = '70px';
  fly.innerHTML = quadDivsHTML(card);
  document.body.appendChild(fly);
  
  SoundEffects.drawCard();
  
  requestAnimationFrame(() => {
    fly.style.left = toRect.left + 'px';
    fly.style.top = toRect.top + 'px';
    fly.style.transform = 'scale(1.2)';
    setTimeout(() => { fly.style.transform = 'scale(1)'; }, 250);
  });
  
  setTimeout(() => {
    fly.remove();
    S.hands[playerIndex].push(card);
    S.handRotations[playerIndex].push(0);
    callback();
  }, 550);
}

/* ================= DRAG & DROP ================= */
function attachDrag(el, pid, cardIndex){
  let isDragging = false;
  let startX, startY;
  let dragCard = null;

  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if(S.locked || S.animating || S.turn !== pid || gamePaused) return;
    startX = e.clientX; startY = e.clientY;
    isDragging = false;
    SoundEffects.click();
    try { el.setPointerCapture(e.pointerId); } catch(err) {}
  });

  el.addEventListener('pointermove', (e) => {
    if(S.locked || S.animating || S.turn !== pid || gamePaused) return;
    if(!isDragging){
      const dx = Math.abs(e.clientX - startX);
      const dy = Math.abs(e.clientY - startY);
      if(dx + dy > 5){
        isDragging = true;
        e.preventDefault();
        if(S.selected !== cardIndex){
          S.selected = cardIndex;
          S.selRot = S.handRotations[pid][cardIndex];
          SoundEffects.dragStart();
        }
        updateHandSelectionUI();
        renderBoard();
        dragCard = document.createElement('div');
        dragCard.className = 'dragging-card';
        const q = S.hands[pid][cardIndex];
        const displayQ = rotated(q, S.selRot);
        dragCard.innerHTML = quadDivsHTML(displayQ);
        dragCard.style.left = (e.clientX - 30) + 'px';
        dragCard.style.top = (e.clientY - 30) + 'px';
        document.body.appendChild(dragCard);
        el.style.opacity = '0';
        document.body.classList.add('interaction-dragging');
      }
    }
    if(isDragging && dragCard){
      dragCard.style.left = (e.clientX - 30) + 'px';
      dragCard.style.top = (e.clientY - 30) + 'px';
    }
  });

  el.addEventListener('pointerup', (e) => {
    if(S.locked || S.animating || S.turn !== pid || gamePaused) return;
    el.style.opacity = '1';
    document.body.classList.remove('interaction-dragging');
    if(!isDragging){ onHandClick(pid, cardIndex); return; }
    isDragging = false;
    if(dragCard) dragCard.remove();
    dragCard = null;

    const targetElement = document.elementFromPoint(e.clientX, e.clientY);
    let targetCell = null;
    if(targetElement){
      let temp = targetElement;
      while(temp && temp !== document.body){
        if(temp.classList && temp.classList.contains('cellEmpty')){
          targetCell = temp;
          break;
        }
        temp = temp.parentElement;
      }
    }
    if(targetCell){
      const x = +targetCell.dataset.x;
      const y = +targetCell.dataset.y;
      const q = rotated(S.hands[pid][cardIndex], S.selRot);
      if(canPlace(x, y, q) > 0){
        SoundEffects.dropValid();
        S.animating = true; S.locked = true;
        document.body.classList.add('interaction-locked');
        animateMoveCard(el, targetCell, q, ()=>{
          document.body.classList.remove('interaction-locked');
          S.animating = false;
          placeCard(pid, cardIndex, x, y, q);
        });
      } else {
        SoundEffects.dropInvalid();
        const fromRect = targetCell.getBoundingClientRect();
        const toRect = el.getBoundingClientRect();
        const fly = document.createElement('div');
        fly.className = 'flying-card';
        fly.style.left = fromRect.left + 'px';
        fly.style.top = fromRect.top + 'px';
        fly.style.width = '70px';
        fly.style.height = '70px';
        fly.innerHTML = quadDivsHTML(q);
        document.body.appendChild(fly);
        requestAnimationFrame(()=>{
          fly.style.left = toRect.left + 'px';
          fly.style.top = toRect.top + 'px';
        });
        setTimeout(()=>{
          fly.remove();
          S.selected = -1;
          renderAll();
        }, 550);
        log("Kartu tidak valid, kembali ke tangan.", pid===0?"p1":"p2");
      }
    } else {
      S.selected = -1;
      renderAll();
    }
  });

  el.addEventListener('pointercancel', ()=>{
    if(dragCard) dragCard.remove();
    dragCard = null;
    el.style.opacity = '1';
    document.body.classList.remove('interaction-dragging');
    isDragging = false;
    S.selected = -1;
    renderAll();
  });
}

/* ================= INTERAKSI ================= */
function onHandClick(pid, i){
  if(S.locked || S.animating || gamePaused) return;
  if(S.turn !== pid) return;
  if(S.selected === i){ S.selected = -1; }
  else {
    S.selected = i;
    S.selRot = S.handRotations[pid][i];
    SoundEffects.select();
  }
  renderAll();
}

function onCellClick(x, y){
  if(S.locked || S.animating || S.selected < 0 || gamePaused) return;
  const pid = S.turn;
  const card = S.hands[pid][S.selected];
  const q = rotated(card, S.selRot);
  if(canPlace(x, y, q) > 0){
    const handEl = pid === 0 ? handP1El : handP2El;
    const fromCard = handEl.querySelector('.handCard.selected');
    const boardCells = document.querySelectorAll('.cellEmpty');
    let toCell = null;
    for(const cell of boardCells){
      if(+cell.dataset.x === x && +cell.dataset.y === y){ toCell = cell; break; }
    }
    if(!fromCard || !toCell){ placeCard(pid, S.selected, x, y, q); return; }
    SoundEffects.dropValid();
    S.animating = true; S.locked = true;
    document.body.classList.add('interaction-locked');
    animateMoveCard(fromCard, toCell, q, ()=>{
      document.body.classList.remove('interaction-locked');
      S.animating = false;
      placeCard(pid, S.selected, x, y, q);
    });
  }
}

function placeCard(pid, cardIndex, x, y, q){
  S.board.set(key(x,y), { q, byAI: (pid===1 && S.mode==='pve') });
  S.newCard = key(x,y);
  S.hands[pid].splice(cardIndex, 1);
  S.handRotations[pid].splice(cardIndex, 1);
  S.selected = -1;
  SoundEffects.place();
  const playerKey = pid === 0 ? 'p1' : 'p2';
  const cardVal = cardValue(q);
  currentScores[playerKey] += cardVal;
  currentPlayedValue[playerKey] += cardVal;
  if (S.hands[pid].length === 0) {
    const comboBonus = detectCombo(x, y);
    if (comboBonus > 0) {
      currentScores[playerKey] += comboBonus;
      log(`Combo! +${comboBonus} poin`, playerKey);
    }
  }
  log("memasang kartu di ("+x+","+y+").", pid===0 ? "p1" : "p2");
  endTurn(pid);
}

/* ================= ROTASI ================= */
function handleRotate(pid){
  if(S.locked || S.animating || S.turn !== pid || S.selected < 0 || gamePaused) return;
  S.selRot = (S.selRot + 1) % 4;
  S.handRotations[pid][S.selected] = S.selRot;
  SoundEffects.rotate();
  renderAll();
  const handEl = pid === 0 ? handP1El : handP2El;
  const selectedEl = handEl.querySelector(".handCard.selected");
  if(selectedEl){
    selectedEl.classList.add("rotate-pulse");
    setTimeout(()=> selectedEl && selectedEl.classList.remove("rotate-pulse"), 250);
  }
}

/* ================= GILIRAN & AI ================= */
function endTurn(pi){
  renderAll();
  if(S.hands[pi].length === 0){
    gameDuration = Date.now() - gameStartTime;
    const winnerIndex = pi;
    const loserIndex = 1 - pi;
    const remainingValueLoser = S.hands[loserIndex].reduce((s,c)=>s+cardValue(c),0);
    const playerKeyWinner = winnerIndex === 0 ? 'p1' : 'p2';
    const playerKeyLoser = loserIndex === 0 ? 'p1' : 'p2';
    currentScores[playerKeyWinner] += 100;
    currentScores[playerKeyLoser] -= remainingValueLoser;
    const remainingValueP1 = winnerIndex === 0 ? 0 : remainingValueLoser;
    const remainingValueP2 = winnerIndex === 1 ? 0 : remainingValueLoser;
    updateStats(
      S.mode, winnerIndex,
      currentScores.p1, currentScores.p2,
      currentPlayedValue.p1, currentPlayedValue.p2,
      remainingValueP1, remainingValueP2,
      gameDuration,
      currentClues.p1, currentClues.p2,
      currentDraws.p1, currentDraws.p2
    );
    showOverlay("Menang: "+(winnerIndex===0 ? "Player 1" : (S.mode==='pvp' ? "Player 2" : "Komputer")), 
      `<p>Skor: P1 ${currentScores.p1} - ${currentScores.p2} P2</p>
       <p>Nilai kartu dimainkan: ${currentPlayedValue.p1} / ${currentPlayedValue.p2}</p>
       <p>Nilai kartu sisa: ${remainingValueP1} / ${remainingValueP2}</p>`);
    S.locked = true;
    if(pi === 0){ SoundEffects.win(); } else { SoundEffects.lose(); }
    return;
  }
  if(S.draw.length === 0){
    let anyMove = false;
    for(let i=0;i<2;i++) if(legalMoves(S.hands[i]).length > 0){ anyMove = true; break; }
    if(!anyMove){
      gameDuration = Date.now() - gameStartTime;
      const totals = S.hands.map(h => h.reduce((s,c)=> s + cardValue(c), 0));
      const min = Math.min(...totals);
      const winners = totals.map((t,i)=>[t,i]).filter(x=>x[0]===min).map(x=>x[1]);
      const winnerIndex = winners.length === 1 ? winners[0] : (winners.includes(0) ? 0 : 1);
      const winnerKey = winnerIndex === 0 ? 'p1' : 'p2';
      currentScores[winnerKey] += 100;
      const remainingValueP1 = totals[0];
      const remainingValueP2 = totals[1];
      updateStats(
        S.mode, winnerIndex,
        currentScores.p1, currentScores.p2,
        currentPlayedValue.p1, currentPlayedValue.p2,
        remainingValueP1, remainingValueP2,
        gameDuration,
        currentClues.p1, currentClues.p2,
        currentDraws.p1, currentDraws.p2
      );
      const names = i => i===0 ? "Player 1" : (S.mode==='pvp' ? "Player 2" : "Komputer");
      let body = "<p><b>Buntu.</b> Nilai kartu tersisa:</p>";
      totals.forEach((t,i)=> body += "<p>"+names(i)+": <b>"+t+"</b>"+(t===min?" (menang)":"")+"</p>");
      showOverlay("Permainan Berakhir", body + `<p>Skor: ${currentScores.p1} / ${currentScores.p2}</p>`);
      S.locked = true;
      SoundEffects.draw();
      return;
    }
  }
  S.turn = (pi + 1) % 2;
  S.selected = -1;
  clearTimeout(S.clueTimeout);
  S.showClue = false;
  if(S.turn === 1 && S.mode === 'pve'){
    S.locked = true;
    renderAll();
    setTimeout(()=> aiTurn(), 800 + Math.random()*500);
  } else {
    S.locked = false;
    renderAll();
    log("Giliran " + (S.turn === 0 ? "Player 1" : "Player 2") + ".");
  }
}

function aiTurn(){
  const hand = S.hands[1];
  const moves = legalMoves(hand);
  if(moves.length > 0){
    moves.sort((a,b)=> b.contacts - a.contacts);
    const best = moves.filter(m=> m.contacts === moves[0].contacts);
    const m = best[Math.floor(Math.random()*best.length)];
    const card = hand[m.ci];
    const q = rotated(card, m.rot);
    const fromCard = handP2El.children[m.ci];
    const boardCells = document.querySelectorAll('.cellEmpty');
    let toCell = null;
    for(const cell of boardCells){
      if(+cell.dataset.x === m.x && +cell.dataset.y === m.y){ toCell = cell; break; }
    }
    if(fromCard && toCell){
      S.animating = true; S.locked = true;
      document.body.classList.add('interaction-locked');
      animateMoveCard(fromCard, toCell, q, ()=>{
        document.body.classList.remove('interaction-locked');
        S.animating = false;
        placeCard(1, m.ci, m.x, m.y, q);
      });
    } else {
      placeCard(1, m.ci, m.x, m.y, q);
    }
  } else if(S.draw.length > 0){
    S.animating = true; S.locked = true;
    document.body.classList.add('interaction-locked');
    animateDrawToHand(1, ()=>{
      document.body.classList.remove('interaction-locked');
      S.animating = false;
      currentDraws.p2++;
      currentScores.p2 -= 2;
      log("Komputer mengambil 1 kartu.", "p2");
      endTurn(1);
    });
  } else {
    log("Komputer pass.", "p2");
    endTurn(1);
  }
}

/* ================= OVERLAY ================= */
function showOverlay(title, body){
  document.getElementById("ovTitle").innerHTML = title;
  document.getElementById("ovBody").innerHTML = body;
  document.getElementById("overlay").style.display = "flex";
}

/* ================= EVENT LISTENERS ================= */
document.getElementById('resumeBtn').onclick = closePauseMenu;
document.getElementById('restartBtn').onclick = restartGame;
document.getElementById('changeModeBtn').onclick = changeMode;
document.getElementById('statsBtn').onclick = openStatsModal;
document.getElementById('closeStatsBtn').onclick = closeStatsModal;

document.getElementById("btnRotate1").onclick = ()=> handleRotate(0);
document.getElementById("btnRotate2").onclick = ()=> handleRotate(1);
document.addEventListener("keydown", e=>{
  if(e.key.toLowerCase()==="r" && !gamePaused) handleRotate(S.turn);
});

document.getElementById("btnDraw1").onclick = ()=>{
  if(S.locked || S.animating || S.turn !== 0 || gamePaused) return;
  const canMove = legalMoves(S.hands[0]).length > 0;
  if(canMove) return;
  if(S.draw.length > 0){
    S.animating = true; S.locked = true;
    document.body.classList.add('interaction-locked');
    animateDrawToHand(0, ()=>{
      document.body.classList.remove('interaction-locked');
      S.animating = false;
      currentDraws.p1++;
      currentScores.p1 -= 2;
      log("mengambil 1 kartu.", "p1");
      endTurn(0);
    });
  } else {
    log("tumpukan habis, pass.", "p1");
    endTurn(0);
  }
};

document.getElementById("btnDraw2").onclick = ()=>{
  if(S.locked || S.animating || S.turn !== 1 || gamePaused) return;
  const canMove = legalMoves(S.hands[1]).length > 0;
  if(canMove) return;
  if(S.draw.length > 0){
    S.animating = true; S.locked = true;
    document.body.classList.add('interaction-locked');
    animateDrawToHand(1, ()=>{
      document.body.classList.remove('interaction-locked');
      S.animating = false;
      currentDraws.p2++;
      currentScores.p2 -= 2;
      log("mengambil 1 kartu.", "p2");
      endTurn(1);
    });
  } else {
    log("tumpukan habis, pass.", "p2");
    endTurn(1);
  }
};

document.getElementById("btnAgain").onclick = ()=>{
  SoundEffects.click();
  document.getElementById("overlay").style.display = "none";
  document.getElementById("gameScreen").style.display = "none";
  document.getElementById("startScreen").style.display = "flex";
  playMenuMusic();
};

let currentMode = 'pvp';
const modePvP = document.getElementById("modePvP");
const modePvE = document.getElementById("modePvE");
modePvP.onclick = ()=>{
  currentMode='pvp';
  modePvP.classList.add("active");
  modePvE.classList.remove("active");
  SoundEffects.click();
};
modePvE.onclick = ()=>{
  currentMode='pve';
  modePvE.classList.add("active");
  modePvP.classList.remove("active");
  SoundEffects.click();
};

document.getElementById("btnStart").onclick = ()=>{
  stopMenuMusic();
  initAudio();
  SoundEffects.click();
  document.getElementById("startScreen").style.display = "none";
  document.getElementById("gameScreen").style.display = "flex";
  gameLogs = [];
  newGame(currentMode);
};

document.addEventListener('click', function initAudioAndMusic() {
  initAudio();
  playMenuMusic();
  document.removeEventListener('click', initAudioAndMusic);
});

window.addEventListener('resize', ()=>{
  if(S) fitBoard();
  applyTransform();
});

window.addEventListener('beforeunload', stopMenuMusic);

(function test(){
  const d = buildDeck();
  const seen = new Set(d.map(c=>c.join("-")));
  console.log("Deck:", d.length, "unique:", seen.size);
})();
