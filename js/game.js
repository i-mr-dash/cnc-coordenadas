/* =========================================================================
   CNC COORDENADAS — motor do jogo
   ========================================================================= */
'use strict';

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const KEY = 'cncgame_v3';
const REDUCED = matchMedia('(prefers-reduced-motion:reduce)').matches;
const _MODO   = new URLSearchParams(location.search).get('r');
const HOVER   = _MODO==='touch' ? false : _MODO==='mouse' ? true
              : matchMedia('(hover:hover) and (pointer:fine)').matches;
const TOUCH   = !HOVER;
const APONTE  = TOUCH ? 'Toque nessa linha da tabela (ou no ponto do desenho)'
                      : 'Passe o mouse nessa linha da tabela';

/* ---------------- progressão ---------------- */
const RANKS = [
  [0,'Aprendiz de Torno'], [150,'Operador Júnior'], [400,'Torneiro'],
  [700,'Programador CNC'], [1000,'Mestre CNC'], [1200,'Lenda do Torno']
];
const UNLOCKS = [
  {lvl:2,  id:'shop',        name:'Oficina / Loja',  desc:'Agora você pode gastar moedas em ferramentas.'},
  {lvl:3,  id:'th_blueprint',name:'Tema Blueprint',  desc:'Aquele visual de prancheta azul. Troque na Loja.'},
  {lvl:5,  id:'calc',        name:'Assistente Δ',    desc:'Mostra o ponto anterior enquanto você digita incrementais.'},
  {lvl:8,  id:'reveal',      name:'Revelar célula',  desc:'Compre a resposta de UMA célula por 40 🪙 — a fase passa a valer no máximo 2 ★ (1 ★ da terceira revelação em diante).'},
  {lvl:12, id:'th_neon',     name:'Tema Neon',       desc:'Modo oficina cyberpunk. Troque na Loja.'},
  {lvl:15, id:'endless',     name:'Modo Infinito',   desc:'Peças geradas aleatoriamente, para sempre.'}
];
const SHOP = [
  {id:'pack',   name:'Pacote de 3 dicas', price:40,  repeat:true, desc:'Mais três fichas 💡 para usar em qualquer fase.'},
  {id:'marker', name:'Marcador de cotas', price:100, desc:'Ao focar uma linha da tabela, as cotas daquele ponto acendem no desenho.'},
  {id:'safety', name:'Seguro do Novato',  price:200, desc:'A primeira tentativa errada de cada fase não conta para as estrelas.'}
];
const THEMES = [
  {t:'steel',    name:'Oficina (padrão)', price:0,   desc:'Visual escuro de chão de fábrica.'},
  {t:'blueprint',name:'Blueprint',        price:180, unlock:'th_blueprint', desc:'Prancheta azul. Sai de graça ao completar a fase 3.'},
  {t:'paper',    name:'Impressão',        price:80, desc:'Fundo claro, cara de folha de processo impressa.'},
  {t:'neon',     name:'Neon',             price:250, unlock:'th_neon', desc:'Oficina cyberpunk. Sai de graça ao completar a fase 12.'}
];
const REVEAL_COST = 40;
const TOL = 0.005;
const MAX_STARS  = LEVELS.length*3;
const BOSS_STARS = Math.round(MAX_STARS*0.5);

/* ---------------- estado ---------------- */
const DEF = {xp:0, coins:0, hints:3, stars:{}, unlocked:[], owned:[], theme:'steel',
             tutorial:false, endlessRun:0, best:{}, streak:0, bestStreak:0};
let S = load();
function load(){
  let txt=localStorage.getItem(KEY), legado=false;
  if(txt==null){                                   // migra saves das versões anteriores
    txt=localStorage.getItem('cncgame_v2')||localStorage.getItem('cncgame_v1');
    if(txt!=null) legado=true;
  }
  let raw={}; try{ raw=JSON.parse(txt||'{}')||{}; }catch(e){ raw={}; }
  if(legado){                                      // 12 fases -> 15: reindexa estrelas e recordes
    const MAP={5:6,6:7,7:8,8:10,9:12,10:13,11:14,12:15};
    const re=o=>{ const n={}; for(const k in (o||{})) n[MAP[k]||k]=o[k]; return n; };
    raw.stars=re(raw.stars); raw.best=re(raw.best);
  }
  const s=sanitize(raw);
  if(legado){ try{ localStorage.setItem(KEY, JSON.stringify(s)); }catch(e){} }
  return s;
}
function sanitize(raw){
  const num=(v,d)=> typeof v==='number'&&isFinite(v)?v:d;
  const arr=v=> Array.isArray(v)?v.filter(x=>typeof x==='string'):[];
  const obj=v=> (v&&typeof v==='object'&&!Array.isArray(v))?v:{};
  const s={...DEF};
  const IDS=new Set(LEVELS.map(l=>String(l.id)));
  const cap=(v,d,max)=>Math.max(0,Math.min(Math.floor(num(v,d)),max));
  const clampObj=(v,max)=>{ const o={};
    for(const k in obj(v)){ if(!IDS.has(String(k))) continue;
      const x=+obj(v)[k]; if(isFinite(x)&&x>0) o[k]=Math.min(Math.floor(x),max); }
    return o; };
  const OK_UNLOCK=new Set(UNLOCKS.map(u=>u.id));
  const OK_OWN=new Set([...SHOP.map(i=>i.id), ...THEMES.map(t=>'th_'+t.t)]);
  s.xp=cap(raw.xp,0,999999); s.coins=cap(raw.coins,0,999999); s.hints=cap(raw.hints,3,999);
  s.endlessRun=cap(raw.endlessRun,0,99999); s.bestStreak=cap(raw.bestStreak,0,9999);
  s.streak=Math.min(cap(raw.streak,0,9999), s.bestStreak);
  s.tutorial=!!raw.tutorial;
  s.stars=clampObj(raw.stars,3); s.best=clampObj(raw.best,86400);
  s.unlocked=[...new Set(arr(raw.unlocked))]; s.owned=[...new Set(arr(raw.owned))];
  if(s.unlocked.includes('th_blue')||s.owned.includes('th_blue')){   // tema renomeado
    s.unlocked=s.unlocked.filter(x=>x!=='th_blue'); s.owned=s.owned.filter(x=>x!=='th_blue');
    if(!s.unlocked.includes('th_blueprint')) s.unlocked.push('th_blueprint');
  }
  s.unlocked=s.unlocked.filter(x=>OK_UNLOCK.has(x));
  s.owned=s.owned.filter(x=>OK_OWN.has(x));
  const th = raw.theme==='blue' ? 'blueprint' : raw.theme;
  s.theme = THEMES.some(t=>t.t===th) ? th : 'steel';
  return s;
}
function save(){
  try{ localStorage.setItem(KEY, JSON.stringify(S)); }
  catch(e){ if(!save._warned){ save._warned=1; toast('Não consegui salvar o progresso neste navegador (modo privado?).',5000); } }
}

let P = null;      // partida atual
let CC = null;     // cache das cores do tema
let timer = null;
const HINT_TIER = {};

/* ---------------- util ---------------- */
const totalStars = () => Object.values(S.stars).reduce((a,b)=>a+(+b||0),0);
const rankOf = xp => RANKS.filter(r=>xp>=r[0]).pop();
const nextRank = xp => RANKS.find(r=>xp<r[0]);
const has = id => S.unlocked.includes(id) || S.owned.includes(id);
const done = id => (S.stars[id]||0) > 0;
const fmt = n => { const v=Math.round(n*1000)/1000; return (v===0?0:v).toString(); };
const mmss = s => String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
const eq = (a,b)=> !isNaN(a) && Math.abs(a-b) < TOL;

function countUp(el,from,to,ms=900){
  if(REDUCED||from===to){ el.textContent=to; return; }
  const t0=performance.now();
  (function step(t){ const k=Math.min(1,(t-t0)/ms), e=1-Math.pow(1-k,3);
    el.textContent=Math.round(from+(to-from)*e); if(k<1) requestAnimationFrame(step); })(performance.now());
}
function toast(msg, ms=2400){
  const t=$('#toast'); t.textContent=msg; t.classList.add('on');
  clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('on'), ms);
}
let AC=null;
/* iOS/Safari: o AudioContext nasce suspenso e só liga depois de um gesto real */
function unlockAudio(){
  try{
    AC = AC || new (window.AudioContext||window.webkitAudioContext)();
    if(AC.state!=='running') AC.resume();
    const b=AC.createBuffer(1,1,22050), s=AC.createBufferSource();
    s.buffer=b; s.connect(AC.destination); s.start(0);
  }catch(e){}
}
['touchend','pointerup','mousedown','keydown'].forEach(ev=>
  window.addEventListener(ev, unlockAudio, {passive:true}));
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden && AC && AC.state==='suspended') AC.resume();
});
function beep(freq=660, dur=.09, type='sine', vol=.06){
  try{
    AC = AC || new (window.AudioContext||window.webkitAudioContext)();
    if(AC.state==='suspended') AC.resume();
    const o=AC.createOscillator(), g=AC.createGain();
    o.type=type; o.frequency.value=freq; o.connect(g); g.connect(AC.destination);
    g.gain.setValueAtTime(vol, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001, AC.currentTime+dur);
    o.start(); o.stop(AC.currentTime+dur);
  }catch(e){}
}
const sndOk   = ()=>{beep(880,.08);setTimeout(()=>beep(1320,.12),80);};
const sndErr  = ()=>beep(150,.18,'square',.05);
const sndWin  = ()=>{[523,659,784,1047].forEach((f,i)=>setTimeout(()=>beep(f,.16,'triangle'),i*110));};
const sndCoin = ()=>{beep(1200,.05,'square',.04);setTimeout(()=>beep(1600,.07,'square',.04),60);};

/* ---------------- HUD ---------------- */
function hud(){
  const [minXp,name]=rankOf(S.xp), nx=nextRank(S.xp);
  $('#rankLabel').textContent=name;
  const pct = nx ? (S.xp-minXp)/(nx[0]-minXp)*100 : 100;
  $('#xpFill').style.width=pct+'%';
  $('#xpBar').setAttribute('aria-valuenow', Math.round(pct));
  $('#xpBar').setAttribute('aria-valuetext', $('#xpTxt').textContent);
  $('#xpTxt').textContent = nx ? `${S.xp} / ${nx[0]} XP → ${nx[1]}` : `${S.xp} XP — nível máximo`;
  $('#coinTxt').textContent=S.coins;
  $('#hintTxt').textContent=S.hints;
  $('#starTxt').textContent=totalStars();
  document.body.dataset.theme=S.theme;
  CC=null;
}

/* ---------------- navegação ---------------- */
function closeAllModals(){
  document.body.style.overflow=''; setInert(false);
  $('#overlay').classList.remove('on');
  $$('.modal').forEach(m=>m.classList.remove('on'));
}
function show(id){
  closeAllModals();
  if(id!=='play' && P && !P.won && !P.pausedAt) P.pausedAt=Date.now();      // pausa o cronômetro
  $$('.screen').forEach(s=>{ s.classList.remove('active'); s.setAttribute('aria-hidden','true'); });
  const sc=$('#screen-'+id); sc.classList.add('active'); sc.setAttribute('aria-hidden','false');
  if(id!=='play'&&timer){clearInterval(timer);timer=null;}
  if(id!=='play') clearTimeout(startLevel._tut);
  if(id==='map') renderMap();
  if(id==='shop') renderShop();
  if(id==='help') renderHelp();
  window.scrollTo({top:0,behavior:REDUCED?'auto':'smooth'});
  const h1=sc.querySelector('h1'); if(h1){ h1.tabIndex=-1; h1.focus({preventScroll:true}); }
}
$('#navMap').onclick =()=>show('map');
$('#navShop').onclick=()=>{ if(!has('shop')){toast('A Loja abre ao completar a fase 2.');return;} show('shop'); };
$('#navHelp').onclick=()=>show('help');
$('#btnBack').onclick=()=>show('map');

/* ---------------- mapa ---------------- */
function isUnlocked(lv){
  const i=LEVELS.indexOf(lv);
  if(i<=0) return true;
  if(S.stars[lv.id]) return true;
  if(!done(LEVELS[i-1].id)) return false;
  if(lv.boss) return totalStars()>=BOSS_STARS;
  return true;
}
function renderMap(){
  const t=$('#mapTrack'); t.innerHTML='';
  const perfect=LEVELS.filter(l=>(S.stars[l.id]||0)===3).length;
  const feitas =LEVELS.filter(l=>done(l.id)).length;
  $('#mapStats').innerHTML =
    `<b>${totalStars()} / ${MAX_STARS} ★</b> · ${feitas} de ${LEVELS.length} fases · ${perfect} peça(s) perfeita(s)`;
  const bossLv=LEVELS.find(l=>l.boss && !isUnlocked(l));
  if(bossLv){
    const faltamEstrelas=Math.max(0,BOSS_STARS-totalStars());
    const txt = faltamEstrelas>0
      ? `Faltam <b>${faltamEstrelas} ★</b> para o CHEFE (fase ${bossLv.id})`
      : `Estrelas suficientes — falta completar as fases até a ${bossLv.id-1} para liberar o CHEFE`;
    $('#mapStats').insertAdjacentHTML('beforeend',
      `<span class="goal"><i style="width:${Math.min(100,totalStars()/BOSS_STARS*100)}%"></i></span>
       <span class="goal-txt">${txt}</span>`);
  }

  if(P && !P.won){
    const d=document.createElement('div');
    d.className='node cur'; d.tabIndex=0; d.setAttribute('role','button');
    d.innerHTML=`<div class="num">EM ANDAMENTO</div><div class="nm">Retomar</div>
      <div class="sb">${P.lv.endless?P.lv.name:'Fase '+P.lv.id+' — '+P.lv.name}</div>
      <div class="st" aria-hidden="true">▶</div>`;
    const act=()=>resumeLevel();
    d.onclick=act;
    d.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); act(); }});
    t.appendChild(d);
  }
  let curMarked=false;
  LEVELS.forEach(lv=>{
    const st=S.stars[lv.id]||0, open=isUnlocked(lv), b=S.best[lv.id];
    const cur = open && st===0 && !curMarked; if(cur) curMarked=true;
    const d=document.createElement('div');
    d.className='node'+(open?'':' locked')+(lv.boss?' boss':'')+(cur?' cur':'');
    d.style.setProperty('--i', LEVELS.indexOf(lv));
    d.tabIndex=0; d.setAttribute('role','button');
    d.setAttribute('aria-disabled', open?'false':'true');
    d.setAttribute('aria-label',`Fase ${lv.id}: ${lv.name}. ${st} de 3 estrelas.${open?'':' Bloqueada.'}`);
    d.innerHTML=`
      <div class="num">FASE ${String(lv.id).padStart(2,'0')}</div>
      <div class="nm">${lv.name}</div>
      <div class="sb">${lv.sub}</div>
      <div class="st" aria-hidden="true">${[1,2,3].map(i=>i<=st?'<b>★</b>':'☆').join('')}</div>
      ${b?`<div class="rec">⏱ ${mmss(b)}</div>`:''}
      ${lv.boss?'<div class="badge">CHEFE</div>':''}
      ${lv.boss&&!open?`<div class="gate">Requer ${BOSS_STARS} ★ — você tem ${totalStars()}</div>`:''}
      ${open?'':'<div class="lock" aria-hidden="true">🔒</div>'}`;
    const act = open
      ? ()=>startLevel(lv)
      : ()=>toast(lv.boss && done(LEVELS[LEVELS.indexOf(lv)-1].id)
          ? `O CHEFE exige ${BOSS_STARS} ★. Você tem ${totalStars()} — refaça fases para pegar 3 ★.`
          : 'Complete a fase anterior primeiro.', 4000);
    d.onclick=act;
    d.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); act(); }});
    t.appendChild(d);
  });

  if(has('endless')){
    const d=document.createElement('div');
    d.className='node boss'; d.tabIndex=0; d.setAttribute('role','button');
    d.innerHTML=`<div class="num">EXTRA</div><div class="nm">Modo Infinito</div>
      <div class="sb">Peças aleatórias sem fim. Rodada ${S.endlessRun+1}.</div>
      <div class="st" aria-hidden="true">∞</div>
      <div class="rec">🔥 sequência ${S.streak} · recorde ${S.bestStreak}</div>
      <div class="badge">∞</div>`;
    const act=()=>startLevel(makeEndlessLevel(S.endlessRun+1));
    d.onclick=act;
    d.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); act(); }});
    t.appendChild(d);
  }
  const prox = UNLOCKS.find(u=>!has(u.id));
  $('#unlockStrip').innerHTML = UNLOCKS.map(u=>
    `<span class="uchip ${has(u.id)?'on':(u===prox?'next':'')}">${has(u.id)?'✓':(u===prox?'▶':'🔒')} ${u.name} <small>(fase ${u.lvl})</small></span>`).join('');
}

/* ---------------- colunas por modo ---------------- */
const KLBL={ax:'X (absoluto)', az:'Z (absoluto)', ix:'ΔX', iz:'ΔZ', g:'função G'};
function colsOf(lv){
  const m=lv.modes[0];
  if(m==='abs')  return [{k:'ax',h:'X',g:'ABSOLUTAS'},{k:'az',h:'Z',g:'ABSOLUTAS'}];
  if(m==='inc')  return [{k:'ix',h:'ΔX (U)',g:'INCREMENTAIS'},{k:'iz',h:'ΔZ (W)',g:'INCREMENTAIS'}];
  if(m==='both') return [{k:'ax',h:'X',g:'ABSOLUTAS'},{k:'az',h:'Z',g:'ABSOLUTAS'},
                         {k:'ix',h:'ΔX',g:'INCREMENTAIS'},{k:'iz',h:'ΔZ',g:'INCREMENTAIS'}];
  if(m!=='gcode') console.warn('modo desconhecido:',m);
  return [{k:'g',h:'Função',g:'BLOCO'},{k:'ax',h:'X',g:'BLOCO'},{k:'az',h:'Z',g:'BLOCO'}];
}
function expected(lv,r,k){
  const p=lv.pts[r], pv=r>0?lv.pts[r-1]:{x:0,z:0};
  if(k==='ax') return p.x;
  if(k==='az') return p.z;
  if(k==='ix') return +(p.x-pv.x).toFixed(3);
  if(k==='iz') return +(p.z-pv.z).toFixed(3);
  if(k==='g')  return p.g || 'G1';
  console.warn('coluna desconhecida:',k); return NaN;
}

/* ---------------- iniciar fase ---------------- */
function startLevel(lv){
  clearTimeout(startLevel._tut);
  P={lv, tries:0, hints:0, revealed:0, borrowed:false, t0:Date.now(),
     assisted:false, safetyUsed:false, won:false, hl:-1};
  for(const k in HINT_TIER) delete HINT_TIER[k];
  $('#lvName').textContent = lv.endless ? lv.name : `Fase ${lv.id} — ${lv.name}`;
  $('#lvSub').textContent=lv.brief;
  $('#chipMode').textContent=MODE_LABEL[lv.modes[0]];
  $('#chipTry').textContent='Tentativas: 0';
  $('#tipLine').textContent=lv.tip;
  $('#feedback').textContent=''; $('#feedback').className='feedback';
  $('#hintBox').innerHTML='';
  $('#btnReveal').style.display = has('reveal')?'':'none';
  buildTable(lv);
  syncExplainBtn();
  show('play');
  resize(); draw();
  cv.setAttribute('aria-label','Desenho técnico da peça. Pontos do perfil: '+
    lv.pts.filter(p=>!p.safe).map(p=>`${p.id} diâmetro ${fmt(p.x)}, Z ${fmt(p.z)}`).join('; '));
  clearInterval(timer);
  $('#chipTime').textContent='00:00';
  timer=setInterval(()=>{
    const s=Math.floor((Date.now()-P.t0)/1000);
    $('#chipTime').textContent=mmss(s);
  },1000);
  if(!S.tutorial && lv.id===1) startLevel._tut=setTimeout(startTutorial,420);
}

function resumeLevel(){
  if(!P) return;
  if(P.pausedAt){ P.t0 += Date.now()-P.pausedAt; P.pausedAt=0; }
  show('play'); resize(); draw();
  clearInterval(timer);
  timer=setInterval(()=>{
    const s=Math.floor((Date.now()-P.t0)/1000);
    $('#chipTime').textContent=mmss(s);
  },1000);
}

/* ---------------- tabela ---------------- */
function buildTable(lv){
  const cols=colsOf(lv), t=$('#coordTable');
  const groups=[]; cols.forEach(c=>{ const g=groups[groups.length-1];
    if(g&&g.n===c.g) g.span++; else groups.push({n:c.g,span:1}); });
  const inc = lv.modes[0]==='inc'||lv.modes[0]==='both';
  let h=`<thead><tr><th rowspan="2">${inc?'De → Para':'Ponto'}</th>`+
        groups.map(g=>`<th class="grp" colspan="${g.span}">${g.n}</th>`).join('')+`</tr><tr>`+
        cols.map(c=>`<th>${c.h}</th>`).join('')+`</tr></thead><tbody>`;
  lv.pts.forEach((p,r)=>{
    const lbl = inc ? ((r>0?lv.pts[r-1].id:'0')+' → '+p.id) : p.id;
    h+=`<tr data-r="${r}"><td class="lbl">${lbl}</td>`+
      cols.map(c=> c.k==='g'
        ? `<td><select aria-label="${lbl} — função G" data-r="${r}" data-k="g"><option value="">--</option><option>G0</option><option>G1</option></select></td>`
        /* colunas de Z pedem sinal negativo: inputmode text traz o teclado com "-" */
        : `<td><input type="text" inputmode="${c.k==='az'||c.k==='iz'?'text':'decimal'}"
             enterkeyhint="next" autocomplete="off" autocorrect="off"
             autocapitalize="off" spellcheck="false" aria-label="${lbl} — ${c.h}"
             data-r="${r}" data-k="${c.k}" placeholder="?"></td>`
      ).join('')+`</tr>`;
  });
  t.innerHTML=h+'</tbody>';
  $('#btnCheck').classList.remove('ready');

  const all=()=>[...t.querySelectorAll('input,select')];
  const lastEl=all().pop();
  if(lastEl) lastEl.setAttribute('enterkeyhint','done');
  t.querySelectorAll('input,select').forEach(el=>{
    el.addEventListener('focus',()=>{
      setHL(+el.dataset.r); assistDelta(el);
      /* iOS: o teclado cobre a parte de baixo — sobe a célula focada */
      setTimeout(()=>{
        const vv=window.visualViewport, r=el.getBoundingClientRect();
        const limite = vv ? vv.height : innerHeight;
        if(r.bottom>limite-20 || r.top<60) el.scrollIntoView({block:'center',behavior:'auto'});
      },300);
    });
    el.addEventListener('blur',()=>{
      if(P && P.hl===+el.dataset.r) setHL(-1);
      if(has('calc')) $('#tipLine').textContent=P.lv.tip;
    });
    el.addEventListener('input',()=>{
      el.classList.remove('ok','err'); el.removeAttribute('aria-invalid'); draw();
      const cheia=all().every(i=>(i.value||'').trim()!=='');
      const btn=$('#btnCheck');
      if(cheia && !btn.classList.contains('ready')){ beep(880,.07); btn.scrollIntoView({block:'nearest'}); }
      btn.classList.toggle('ready', cheia);
    });
    el.addEventListener('keydown',e=>{
      const list=all(), i=list.indexOf(el);
      if(e.key==='Enter'){ e.preventDefault(); if(i===list.length-1) check(); else list[i+1].focus(); }
      else if(e.key==='ArrowDown'){ e.preventDefault(); const n=list[i+cols.length]; if(n) n.focus(); }
      else if(e.key==='ArrowUp'){ e.preventDefault(); const n=list[i-cols.length]; if(n) n.focus(); }
    });
  });
  t.querySelectorAll('tbody tr').forEach(tr=>{
    const r=+tr.dataset.r;
    if(HOVER){
      tr.addEventListener('mouseenter',()=>setHL(r));
      tr.addEventListener('mouseleave',()=>setHL(-1));
    }
    tr.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse') return;
      setHL(P && P.hl===r ? -1 : r);          // toque: acende/apaga
    });
  });
}
function setHL(r){
  if(!P || P.hl===r) return;
  $$('#coordTable tbody tr').forEach(tr=>tr.classList.toggle('hl', +tr.dataset.r===r));
  P.hl=r; draw();
}
function assistDelta(el){
  if(!has('calc')) return;
  const k=el.dataset.k, r=+el.dataset.r;
  if(k!=='ix'&&k!=='iz') return;
  const prev = r>0?P.lv.pts[r-1]:{x:0,z:0,id:'origem'};
  $('#tipLine').textContent=`Assistente Δ — anterior (${prev.id}): X${fmt(prev.x)} Z${fmt(prev.z)}`;
}

/* ---------------- leitura das células ---------------- */
const cellsOf = () => $$('#coordTable input,#coordTable select');
function cellInfo(el){
  const lv=P.lv, r=+el.dataset.r, k=el.dataset.k, exp=expected(lv,r,k), p=lv.pts[r];
  const raw=(el.value||'').trim();
  if(k==='g') return {el,r,k,p,exp,raw,val:raw,blank:!raw,ok:raw===exp};
  const val=parseNum(raw);
  return {el,r,k,p,exp,raw,val,blank:raw==='',bad:raw!==''&&isNaN(val),ok:!isNaN(val)&&Math.abs(val-exp)<=TOL};
}
const firstBadCell = () => cellsOf().map(cellInfo).find(c=>!c.ok) || null;

const NUMRE=/^[+-]?(\d+(\.\d*)?|\.\d+)$/;
function parseNum(v){
  v=String(v==null?'':v).trim().toLowerCase()
     .replace(/^[xzuw]\s*/,'').replace(/^ø\s*/,'').replace(/\s*mm$/,'')
     .replace(',','.').replace(/\s+/g,'');
  if(!NUMRE.test(v)) return NaN;
  return +v;
}

/* ---------------- linguagem didática ---------------- */
function describeMove(a,b){
  if(a.x===b.x && a.z===b.z) return 'a ferramenta não sai do lugar.';
  if(a.x===b.x) return `só o <b>comprimento</b> muda — trecho cilíndrico, o diâmetro continua ø${fmt(b.x)}.`;
  if(a.z===b.z) return `é um <b>degrau reto</b>: só o <b>diâmetro</b> muda, o Z continua ${fmt(b.z)}.`;
  const dz=Math.abs(b.z-a.z), dr=Math.abs(b.x-a.x)/2;
  if(b.arc) return `é uma <b>concordância R${fmt(b.arc)}</b>: o arco consome ${fmt(b.arc)} mm em Z e ${fmt(b.arc)} mm no <b>raio</b> (<b>${fmt(2*b.arc)} mm no diâmetro</b>) — não é chanfro, é arco.`;
  if(Math.abs(dz-dr)<TOL) return `é um <b>chanfro ${fmt(dz)}x45°</b>: anda ${fmt(dz)} mm em Z e ${fmt(dz)} mm no <b>raio</b>, ou seja <b>${fmt(2*dz)} mm no diâmetro</b>.`;
  return `é um <b>cone</b>: X e Z mudam no mesmo trecho (ΔX ${fmt(b.x-a.x)}, ΔZ ${fmt(b.z-a.z)}).`;
}
function diagnose(c){
  const lv=P.lv, r=c.r, p=c.p, pv=r>0?lv.pts[r-1]:{x:0,z:0,id:'a origem'}, nx=lv.pts[r+1];
  const v=c.val, e=c.exp;
  if(c.blank) return {code:'vazio', msg:`A célula <b>${KLBL[c.k]}</b> do ponto <b>${p.id}</b> está vazia. De ${pv.id} para ${p.id} ${describeMove(pv,p)}`};
  if(c.bad)   return {code:'formato', msg:`O valor digitado em <b>${p.id}</b> não é um número. Use só dígitos, ponto ou vírgula e o sinal (ex.: <b>-20</b>).`};
  if(c.k==='g') return {code:'gcode',
    msg:`No bloco <b>${p.id}</b> ${e==='G0'?'a ferramenta se desloca <b>sem tirar cavaco</b>':'a ferramenta está <b>tirando cavaco</b>'} → <b>${e}</b>. Regra: <b>G0</b> só no ar; qualquer contato com o material é <b>G1</b>.`};
  if(r>0 && eq(v, expected(lv,r-1,c.k))) return {code:'linha',
    msg:`Em <b>${p.id}</b> o valor <b>${fmt(v)}</b> é o mesmo da linha de cima (${pv.id}). De ${pv.id} para ${p.id} ${describeMove(pv,p)} Se você quis escrever o raio, lembre que X é sempre <b>diâmetro</b>.`};
  if((c.k==='ax'||c.k==='ix') && e!==0 && eq(v*2,e)) return {code:'raio',
    msg:`No ponto <b>${p.id}</b> você escreveu <b>${fmt(v)}</b>, que é o <b>raio</b>. X é sempre <b>diâmetro</b>: ${fmt(v)} × 2 = <b>ø${fmt(e)}</b>.`};
  if((c.k==='ax'||c.k==='ix') && e!==0 && eq(v,e*2)) return {code:'dobro',
    msg:`No ponto <b>${p.id}</b> o valor ficou o dobro. A cota <b>ø${fmt(e)}</b> do desenho já é o diâmetro — não multiplique por 2.`};
  if(e!==0 && eq(v,-e)) return {code:'sinal',
    msg:`Em <b>${p.id}</b> o número está certo, o <b>sinal</b> não. `+
      (c.k==='az'||c.k==='iz'
        ? (e<0 ? `A peça cresce para a <b>esquerda</b> do zero-peça W: dentro do material é <b>negativo</b> → <b>Z${fmt(e)}</b>.`
               : `Esse ponto está <b>antes</b> da face, no ar → <b>Z+${fmt(e)}</b>.`)
        : c.k==='ax'
          ? `Diâmetro não tem sinal negativo: o X absoluto é sempre positivo (ou X0 na linha de centro) → <b>X${fmt(e)}</b>.`
          : `Aqui o diâmetro ${e>0?'aumenta':'diminui'}, então o Δ é <b>${e>0?'positivo':'negativo'}</b>: <b>${fmt(e)}</b>.`)};
  const twin={ax:'az',az:'ax',ix:'iz',iz:'ix'}[c.k];
  if(twin && eq(v, expected(lv,r,twin))) return {code:'inverteu',
    msg:`Em <b>${p.id}</b> as colunas foram trocadas: <b>${fmt(v)}</b> é o valor de <b>${KLBL[twin]}</b>. X é o diâmetro (vertical); Z é o comprimento (horizontal).`};
  if((c.k==='ax'||c.k==='az') && eq(v, expected(lv,r,c.k==='ax'?'ix':'iz'))){
    const base=c.k==='ax'?pv.x:pv.z;
    return {code:'incAbs', msg: c.k==='ax'
      ? `Você escreveu <b>quanto o diâmetro variou</b> desde ${pv.id}. A coluna absoluta pede o <b>diâmetro cheio</b> naquele ponto: ${fmt(base)} ${v>=0?'+':'−'} ${fmt(Math.abs(v))} = <b>ø${fmt(e)}</b>.`
      : `Você escreveu <b>quanto andou</b> desde ${pv.id}. A coluna absoluta pede a distância até o <b>zero-peça W</b>: ${fmt(base)} ${v>=0?'+':'−'} ${fmt(Math.abs(v))} = <b>${fmt(e)}</b>.`};
  }
  if((c.k==='ix'||c.k==='iz') && eq(v, expected(lv,r,c.k==='ix'?'ax':'az'))){
    const a=c.k==='ix'?p.x:p.z, b=c.k==='ix'?pv.x:pv.z;
    return {code:'absInc', msg:`Você repetiu a coordenada <b>absoluta</b>. A coluna Δ pede a <b>diferença</b>: ${fmt(a)} − ${fmt(b)} = <b>${fmt(e)}</b>.`};
  }
  if(c.k==='ax' && nx){
    const C=Math.abs(nx.z-p.z);
    if(C>0 && eq(e, nx.x-2*C) && eq(v, nx.x-C)) return nx.arc
      ? {code:'chanfro', msg:`Raio <b>R${fmt(nx.arc)}</b>: o arco começa ${fmt(nx.arc)} mm antes no <b>raio</b>, ou seja <b>${fmt(2*nx.arc)} mm no diâmetro</b>. ø${fmt(nx.x)} − 2×${fmt(nx.arc)} = <b>ø${fmt(e)}</b>.`}
      : {code:'chanfro', msg:`Chanfro <b>${fmt(C)}x45°</b> tira ${fmt(C)} mm <b>de cada lado</b> = <b>${fmt(2*C)} mm no diâmetro</b>. ø${fmt(nx.x)} − 2×${fmt(C)} = <b>ø${fmt(e)}</b>.`};
  }
  return {code:'geral', msg:`Ponto <b>${p.id}</b>, coluna <b>${KLBL[c.k]}</b>: de ${pv.id} para ${p.id} ${describeMove(pv,p)} Releia a cota correspondente no desenho.`};
}
const TYPE_LBL={vazio:'campo em branco', formato:'formato inválido', raio:'raio no lugar do diâmetro',
  dobro:'diâmetro dobrado', sinal:'sinal trocado', inverteu:'X trocado com Z', incAbs:'incremental na coluna absoluta',
  absInc:'absoluto na coluna Δ', linha:'copiou a linha anterior', chanfro:'chanfro contado só de um lado',
  gcode:'G0/G1 trocado', geral:'valor fora da medida'};

/* ---------------- verificação ---------------- */
$('#btnCheck').onclick=check;
function check(){
  if(P.won) return;
  const cols=colsOf(P.lv);
  $$('#coordTable thead th').forEach(th=>th.classList.remove('colbad'));
  const infos=cellsOf().map(cellInfo);
  infos.forEach(c=>{
    c.el.classList.toggle('ok',c.ok); c.el.classList.toggle('err',!c.ok);
    c.el.setAttribute('aria-invalid', c.ok?'false':'true');
    c.el.title = c.ok?'Correto':'Valor incorreto';
  });
  draw();
  const bad=infos.filter(c=>!c.ok);
  const fb=$('#feedback');
  if(!bad.length){ win(); return; }
  if(bad.length===infos.length && bad.every(c=>c.blank)){
    fb.className='feedback bad';
    fb.textContent='Preencha a tabela antes de verificar — esta não conta como tentativa.';
    sndErr(); return;
  }
  P.tries++;
  $('#chipTry').textContent='Tentativas: '+P.tries;
  sndErr(); syncExplainBtn();

  const byCol={}, byType={};
  bad.forEach(c=>{ byCol[c.k]=(byCol[c.k]||0)+1; const d=diagnose(c); c._d=d; byType[d.code]=(byType[d.code]||0)+1; });
  const worst=Object.entries(byCol).sort((a,b)=>b[1]-a[1])[0];
  $$('#coordTable thead tr:nth-child(2) th').forEach((th,i)=>
    th.classList.toggle('colbad', !!(cols[i] && cols[i].k===worst[0])));
  const top=Object.entries(byType).filter(([k])=>k!=='geral'&&k!=='vazio').sort((a,b)=>b[1]-a[1])[0];
  fb.className='feedback bad';
  fb.innerHTML = `<b>${bad.length} célula(s) para revisar.</b> A coluna <b>${KLBL[worst[0]]}</b> concentra ${worst[1]}.`
    + (top?`<br>Padrão detectado: <b>${TYPE_LBL[top[0]]}</b> (${top[1]}×).`:'')
    + `<br>${bad[0]._d.msg}`;
}
function syncExplainBtn(){
  const b=$('#btnExplain'), falta=3-P.tries;
  b.disabled=false;                       // sempre tocável: responde explicando a regra
  b.dataset.locked = falta>0 ? '1' : '';
  b.classList.toggle('locked-soft', falta>0);
  b.textContent = falta>0 ? `Explicar (${falta})` : 'Explicar';
  b.title = falta>0 ? `Abre depois de ${falta} tentativa(s).` : 'Passo a passo completo desta peça.';
}

/* ---------------- dicas adaptativas ---------------- */
$('#btnHint').onclick=()=>{
  const box=$('#hintBox'), c=firstBadCell();
  if(!c){ toast('Não há nada errado na tabela — clique em Verificar!'); return; }
  const key=c.r+'|'+c.k, tier=HINT_TIER[key]||0;
  let txt, custa=true, titulo='Dica';

  if(tier===0){
    custa=false; titulo='Onde olhar';
    txt=`Olhe o ponto <b>${c.p.id}</b>, coluna <b>${KLBL[c.k]}</b>. ${APONTE}: o ponto acende no desenho com as linhas de leitura.`;
  }else if(tier===1){
    txt=diagnose(c).msg;
  }else{
    const pv=c.r>0?P.lv.pts[c.r-1]:{x:0,z:0,id:'a origem'};
    const extra=P.lv.hints[Math.min(tier-2, P.lv.hints.length-1)];
    txt=`De ${pv.id} (X${fmt(pv.x)} Z${fmt(pv.z)}) para ${c.p.id} ${describeMove(pv,c.p)}<br><i>${extra}</i>`;
  }
  if(custa){
    if(S.hints>0){ S.hints--; save(); hud(); P.hints++; }
    else { P.borrowed=true; toast('Dica emprestada: sem ficha 💡, esta fase vale 1 ★. Compre um pacote na Loja (40 🪙).',4200); }
  }
  HINT_TIER[key]=tier+1;
  const d=document.createElement('div');
  d.className='hint'; d.innerHTML=`<b>${titulo}:</b> ${txt}`;
  box.appendChild(d); d.scrollIntoView({block:'nearest'}); beep(760,.1);
};

/* ---------------- revelar célula ---------------- */
$('#btnReveal').onclick=()=>{
  if(S.coins<REVEAL_COST){ toast(`Faltam moedas (custa ${REVEAL_COST} 🪙).`); return; }
  const c=firstBadCell();
  if(!c){ toast('Nada para revelar — está tudo certo, clique em Verificar!'); return; }
  c.el.value = c.k==='g'?c.exp:fmt(c.exp);
  c.el.classList.add('given','ok'); c.el.classList.remove('err'); c.el.setAttribute('aria-invalid','false');
  S.coins-=REVEAL_COST; P.revealed++; save(); hud(); sndCoin(); draw();
  toast(`Célula ${c.p.id} revelada. −${REVEAL_COST} 🪙 · a fase agora vale no máximo ${P.revealed>2?1:2} ★`,3400);
};

/* ---------------- explicação ---------------- */
function explainRows(lv){
  const cols=colsOf(lv), hasAbs=cols.some(c=>c.k==='ax'), hasInc=cols.some(c=>c.k==='ix');
  return lv.pts.map((p,r)=>{
    const pv=r>0?lv.pts[r-1]:{x:0,z:0,id:'a origem'};
    const bits=[`<b>O trecho:</b> de ${pv.id} para ${p.id} ${describeMove(pv,p)}`];
    if(p.safe) bits.push('<b>Onde ler:</b> este ponto não está no desenho — é posição de segurança/troca, longe da peça (X grande, Z positivo).');
    if(cols.some(c=>c.k==='g'))
      bits.push(`<b>A função:</b> <em>${p.g}</em> — ${p.g==='G0'?'a ferramenta não toca o material: deslocamento rápido, sem avanço programado':'há material sendo cortado: avanço de trabalho (F)'}.`);
    if(hasAbs){
      bits.push(p.safe
        ? `<b>X:</b> não há cota no desenho — é posição livre, escolhida bem afastada do maior diâmetro para a torre girar sem bater → <em>X${fmt(p.x)}</em>.`
        : p.x===0
        ? '<b>X:</b> ferramenta na linha de centro, diâmetro zero → <em>X0</em>.'
        : `<b>X:</b> a cota que vale aqui é <b>ø${fmt(p.x)}</b>. Como X é diâmetro (nunca raio) → <em>X${fmt(p.x)}</em>, o que no desenho são ${fmt(p.x/2)} mm acima da linha de centro.`);
      bits.push(p.z===0
        ? '<b>Z:</b> encostado na face de referência, que é o próprio zero-peça → <em>Z0</em>.'
        : (p.z>0 ? `<b>Z:</b> está ${fmt(p.z)} mm <u>antes</u> da face, ainda no ar → <em>Z${fmt(p.z)}</em>.`
                 : `<b>Z:</b> a cota de comprimento é ${fmt(-p.z)} mm a partir da face; a peça cresce para a esquerda do W → <em>Z${fmt(p.z)}</em>.`));
    }
    if(hasInc){
      const dx=+(p.x-pv.x).toFixed(3), dz=+(p.z-pv.z).toFixed(3);
      bits.push(`<b>ΔX:</b> ${fmt(p.x)} − ${fmt(pv.x)} = <em>${fmt(dx)}</em>${dx===0?' — o diâmetro não mudou':''}`);
      bits.push(`<b>ΔZ:</b> ${fmt(p.z)} − ${fmt(pv.z)} = <em>${fmt(dz)}</em>${dz===0?' — não andou no comprimento':''}`);
    }
    if(p.note) bits.push('📐 <b>No desenho:</b> '+p.note);
    return `<div class="exrow"><b>${p.id}</b> ${r>0?`<span style="opacity:.6">(vindo de ${pv.id})</span>`:''}<br>${bits.join('<br>')}</div>`;
  }).join('');
}
$('#btnExplain').onclick=()=>{
  if($('#btnExplain').dataset.locked){
    toast(`Tente primeiro! O passo a passo abre depois de mais ${3-P.tries} tentativa(s). Enquanto isso use a Dica — o nível 1 é grátis.`,4600);
    return;
  }
  $('#explainBody').innerHTML =
    `<h4>Regras que resolvem esta peça</h4>
     <div class="exrow">${P.lv.tip}<br>
       <em>X</em> = diâmetro lido no desenho. <em>Z</em> = distância até a face (esquerda = negativo).<br>
       Chanfro <b>C x45°</b>: o diâmetro de entrada é <b>ø − 2C</b> e o Z avança <b>C</b>.<br>
       Raio <b>R</b>: consome <b>R</b> no raio (<b>2R</b> no diâmetro) e <b>R</b> em Z.<br>
       <b>Fechamento:</b> a soma dos ΔX tem que dar o último X absoluto, e a soma dos ΔZ o último Z.</div>
     <h4>Ponto a ponto</h4>${explainRows(P.lv)}`;
  openModal('#modalExplain');
};
$('#expClose').onclick=()=>closeModal('#modalExplain');
$('#expFill').onclick=()=>{
  if(!confirm('Isso preenche a tabela inteira e fecha a fase com 1 ★ (de 3). Você pode repetir a fase depois para recuperar as estrelas. Continuar?')) return;
  cellsOf().forEach(el=>{
    const exp=expected(P.lv,+el.dataset.r,el.dataset.k);
    el.value = el.dataset.k==='g'?exp:fmt(exp);
    el.classList.add('given'); el.classList.remove('err');
  });
  P.assisted=true; closeModal('#modalExplain'); draw();
  toast('Tabela preenchida. Leia as explicações e clique em Verificar — esta fase vale 1 ★.',4200);
};

/* ---------------- vitória ---------------- */
function starsFor(){
  if(P.assisted) return 1;
  let tries=P.tries;
  if(has('safety') && tries>0 && !P.safetyUsed){ tries--; P.safetyUsed=true; }
  let st = (tries===0 && P.hints===0) ? 3 : (tries<=2 && P.hints<=2) ? 2 : 1;
  if(P.revealed>2) st=1;
  else if(P.revealed>0) st=Math.min(2,st);
  if(P.borrowed) st=1;
  return st;
}
function win(){
  if(P.won) return;
  P.won=true;
  clearInterval(timer); timer=null;
  sndWin(); if(!REDUCED) confetti();
  const lv=P.lv, st=starsFor();
  const secs=Math.floor((Date.now()-P.t0)/1000);
  const clean = !P.assisted && P.revealed===0;
  let coins=20+st*15, xp=40+st*20+(lv.boss?120:0), first=false, recorde=false;

  if(lv.endless){
    if(st===3){ S.streak++; if(S.streak>S.bestStreak) S.bestStreak=S.streak; } else S.streak=0;
    S.endlessRun++;
    coins = P.assisted?0:8+6*st+Math.min(S.streak,6)*3;
    xp    = P.assisted?0:15+15*st;
  }else{
    const prev=S.stars[lv.id]||0;
    first = prev===0;
    if(st>prev) S.stars[lv.id]=st;
    if(!first || P.assisted){ coins=Math.round(coins*.3); xp=Math.round(xp*.3); }
    if(clean && (!S.best[lv.id] || secs<S.best[lv.id])){ recorde=!!S.best[lv.id]; S.best[lv.id]=secs; }
  }
  S.coins+=coins; S.xp+=xp; S.hints+=first?2:0;
  const newly=[];
  UNLOCKS.forEach(u=>{ if(!S.unlocked.includes(u.id) && (S.stars[u.lvl]||0)>0){
    if(u.id.startsWith('th_') && S.owned.includes(u.id)){
      const th=THEMES.find(t=>'th_'+t.t===u.id);
      if(th){ S.coins+=th.price; toast(`${th.name} veio de graça na fase ${u.lvl} — ${th.price} 🪙 devolvidos.`,4200); }
      S.owned=S.owned.filter(x=>x!==u.id);
    }
    S.unlocked.push(u.id); newly.push(u);
  }});
  save(); hud();

  $('#resStars').setAttribute('aria-label', st+' de 3 estrelas');
  $$('#resStars span').forEach((s,i)=>{ const on=i<st; s.classList.toggle('on',on); s.textContent=on?'★':'☆'; });
  $('#resLine').textContent = st===3?'PEÇA PERFEITA' : st===2?'DENTRO DA TOLERÂNCIA' : 'APROVADA COM RESSALVA';
  const img=$('#resShot');
  if(img){ img.removeAttribute('src'); img.style.display='none'; img.classList.remove('perfect'); }
  $('#resTitle').textContent = st===3?'Peça perfeita!' : st===2?'Peça aprovada!' : 'Passou no controle';
  $('#resText').textContent =
    (lv.endless?'Rodada concluída':'Fase concluída') + ` em ${mmss(secs)} · ` +
    (P.tries===0&&P.hints===0 ? 'sem erros, sem dicas.' : `${P.tries} tentativa(s) · ${P.hints} dica(s) paga(s).`);
  $('#resRewards').innerHTML =
    `<span class="rw">+${xp} XP</span><span class="rw">+${coins} 🪙</span>`+
    (first?'<span class="rw">+2 💡</span>':'')+
    (recorde?'<span class="rw">⏱ NOVO RECORDE</span>':'')+
    (lv.endless&&S.streak>1?`<span class="rw">🔥 sequência ${S.streak}</span>`:'')+
    (!first&&!lv.endless?'<span class="rw dim">30% (repetição)</span>':'');
  const rk=rankOf(S.xp), nxr=nextRank(S.xp);
  const pctR = nxr ? Math.round((S.xp-rk[0])/(nxr[0]-rk[0])*100) : 100;
  const bst = S.best[lv.id];
  const bossLv = LEVELS.find(l=>l.boss && !isUnlocked(l));
  const proxU  = UNLOCKS.find(u=>!has(u.id));
  const faltamEstrelas = bossLv ? Math.max(0,BOSS_STARS-totalStars()) : 0;
  const meta = bossLv ? (faltamEstrelas>0
               ? `Faltam <b>${faltamEstrelas} ★</b> para liberar o CHEFE (fase ${bossLv.id}).`
               : `Estrelas suficientes — falta completar as fases até a ${bossLv.id-1} para liberar o CHEFE.`)
             : proxU  ? `Próximo desbloqueio: <b>${proxU.name}</b> na fase ${proxU.lvl}.` : '';
  $('#resProg').innerHTML =
    `<div class="rp-rank"><span>${rk[1]}</span><span>${nxr?`faltam ${nxr[0]-S.xp} XP → ${nxr[1]}`:'patente máxima'}</span></div>
     <div class="rp-bar"><i style="width:${pctR}%"></i></div>`
    + (!lv.endless && bst ? `<div class="rp-line">⏱ ${mmss(secs)} agora · recorde <b>${mmss(bst)}</b>${
        recorde?' — <b style="color:var(--ok)">novo recorde!</b>' : (secs>bst?` (${mmss(secs-bst)} a mais)`:'')}</div>` : '')
    + (meta?`<div class="rp-line">${meta}</div>`:'');
  const coinsAntes=S.coins-coins;
  countUp($('#coinTxt'), coinsAntes, S.coins);
  const cstat=$('#coinTxt').closest('.stat');
  cstat.classList.remove('bump'); void cstat.offsetWidth; cstat.classList.add('bump');
  const last = !lv.endless && LEVELS.indexOf(lv)===LEVELS.length-1;
  $('#resNext').textContent = lv.endless?'Próxima peça ›' : last?'Ver conclusão ›':'Próxima fase ›';
  openModal('#modalResult');

  $('#resNext').onclick=()=>{
    closeModal('#modalResult');
    if(newly.length) showUnlocks(newly);
    else nextLevel();
  };
  $('#resRepeat').textContent = lv.endless?'Outra peça':'Repetir';
  $('#resRepeat').onclick=()=>{ closeModal('#modalResult'); startLevel(lv.endless?makeEndlessLevel(S.endlessRun+1):lv); };
}
function nextLevel(){
  const lv=P.lv;
  if(lv.endless){ startLevel(makeEndlessLevel(S.endlessRun+1)); return; }
  const i=LEVELS.indexOf(lv), nx=LEVELS[i+1];
  if(nx && isUnlocked(nx)) startLevel(nx);
  else if(nx){ show('map'); toast(`O CHEFE exige ${BOSS_STARS} ★. Você tem ${totalStars()} — refaça fases para pegar 3 ★.`,4500); }
  else showFinish();
}
function showFinish(){
  const perfeitas=LEVELS.filter(l=>(S.stars[l.id]||0)===3);
  const faltam=LEVELS.filter(l=>(S.stars[l.id]||0)<3);
  const tot=totalStars(), pct=Math.round(tot/MAX_STARS*100);
  const soma=LEVELS.reduce((a,l)=>a+(S.best[l.id]||0),0);
  $('#modalUnlock').classList.add('finish');
  $('#unTitle').textContent='Fim da trilha';
  $('#unBody').innerHTML=`
    <div class="diploma">
      <div class="dip-seal">⌖</div>
      <div class="dip-kick">CERTIFICADO DE CONCLUSÃO</div>
      <div class="dip-name">${rankOf(S.xp)[1]}</div>
      <div class="dip-sub">${LEVELS.length} fases concluídas · ${S.xp} XP</div>
      <div class="dip-bar"><i style="width:${pct}%"></i></div>
      <div class="dip-nums">
        <span><b>${tot}</b><small>de ${MAX_STARS} ★</small></span>
        <span><b>${perfeitas.length}</b><small>peças perfeitas</small></span>
        <span><b>${soma?mmss(soma):'—'}</b><small>soma dos recordes</small></span>
      </div>
    </div>`
    + (faltam.length
      ? `<h4>Ainda dá para platinar</h4><div class="exrow">Sem 3 ★: ${faltam.map(l=>`fase ${l.id} ${l.name}`).join(' · ')}.</div>`
      : `<div class="exrow"><b>Platinado.</b> Todas as peças perfeitas — não sobrou nada para o inspetor reclamar.</div>`)
    + (has('endless')?`<div class="exrow">O <b>Modo Infinito</b> continua no mapa, com peças novas a cada rodada.</div>`:'');
  openModal('#modalUnlock');
  sndWin(); if(!REDUCED){ confetti(); setTimeout(confetti,700); }
  $('#unClose').textContent='Voltar ao mapa';
  $('#unClose').onclick=()=>{ closeModal('#modalUnlock'); show('map'); };
}
function showUnlocks(list){
  $('#modalUnlock').classList.remove('finish'); $('#unClose').textContent='Beleza';
  $('#unTitle').textContent = list.length>1?'Novidades desbloqueadas!':'Desbloqueado!';
  $('#unBody').innerHTML = list.map(u=>`<div class="exrow"><b>${u.name}</b><br>${u.desc}</div>`).join('');
  openModal('#modalUnlock'); sndCoin();
  $('#unClose').onclick=()=>{ closeModal('#modalUnlock'); nextLevel(); };
}

/* ---------------- modais ---------------- */
let lastFocus=null;
function setInert(v){ $('#topbar').inert=v; $('#app').inert=v; }
function openModal(sel){
  lastFocus=document.activeElement;
  document.body.style.overflow='hidden';
  setInert(true);
  $('#overlay').classList.add('on');
  const m=$(sel); m.classList.add('on');
  (m.querySelector('.btn.primary')||m.querySelector('.btn')||m).focus();
}
function closeModal(sel){
  document.body.style.overflow=''; setInert(false);
  $('#overlay').classList.remove('on'); $(sel).classList.remove('on');
  if(lastFocus&&document.contains(lastFocus)) lastFocus.focus();
}
$('#overlay').onclick=()=>{
  if($('#modalResult').classList.contains('on')||$('#modalUnlock').classList.contains('on')) return;
  document.body.style.overflow=''; setInert(false);
  $('#overlay').classList.remove('on'); $$('.modal').forEach(m=>m.classList.remove('on'));
  if(lastFocus&&document.contains(lastFocus)) lastFocus.focus();
};

/* ---------------- loja ---------------- */
function renderShop(){
  const tools = SHOP.map(it=>{
    const owned = !it.repeat && has(it.id);
    return `<div class="card ${owned?'owned':''}">
      <h3>${it.name}</h3><p>${it.desc}</p>
      ${owned?`<button class="btn" disabled>Adquirido ✓</button>`
             :`<button class="btn primary" data-buy="${it.id}">Comprar <span class="price">${it.price} 🪙</span></button>`}
    </div>`;
  }).join('');
  const themes = THEMES.map(th=>{
    const id='th_'+th.t;
    const owned = th.price===0 || has(id);
    const active = S.theme===th.t;
    const gratisEm = th.unlock ? UNLOCKS.find(u=>u.id===th.unlock) : null;
    return `<div class="card ${owned?'owned':''}">
      <h3>${th.name}</h3><p>${th.desc}</p>
      ${owned?`<button class="btn ${active?'primary':''}" data-use="${th.t}">${active?'Em uso':'Usar tema'}</button>`
             :`<button class="btn primary" data-buy-theme="${th.t}">Comprar <span class="price">${th.price} 🪙</span></button>
               ${gratisEm?`<p style="margin:8px 0 0;font-size:12px">Grátis ao completar a fase ${gratisEm.lvl}.</p>`:''}`}
    </div>`;
  }).join('');
  $('#shopGrid').innerHTML = `<h2 class="shop-sec">Ferramentas</h2>${tools}<h2 class="shop-sec">Temas</h2>${themes}`;

  $$('#shopGrid [data-buy]').forEach(b=>b.onclick=()=>{
    const it=SHOP.find(i=>i.id===b.dataset.buy);
    if(S.coins<it.price){ toast('Moedas insuficientes.'); sndErr(); return; }
    S.coins-=it.price;
    if(it.id==='pack') S.hints+=3; else S.owned.push(it.id);
    save(); hud(); renderShop(); sndCoin(); toast(it.name+' adquirido!');
  });
  $$('#shopGrid [data-buy-theme]').forEach(b=>b.onclick=()=>{
    const th=THEMES.find(t=>t.t===b.dataset.buyTheme);
    if(S.coins<th.price){ toast('Moedas insuficientes.'); sndErr(); return; }
    S.coins-=th.price; S.owned.push('th_'+th.t); S.theme=th.t;
    save(); hud(); renderShop(); sndCoin(); toast('Tema '+th.name+' em uso!');
  });
  $$('#shopGrid [data-use]').forEach(b=>b.onclick=()=>{
    S.theme=b.dataset.use; save(); hud(); renderShop(); draw();
  });
}

/* ---------------- manual ---------------- */
function renderHelp(){
  $('#helpGrid').innerHTML = `
  <div class="card"><h3>Os eixos do torno</h3><ul>
    <li><code>Z</code> = comprimento, paralelo ao eixo da peça.</li>
    <li><code>Z+</code> afasta da placa (direita); <code>Z−</code> entra na peça.</li>
    <li><code>X</code> = transversal, e vale sempre <b>DIÂMETRO</b>.</li>
    <li>Zero-peça <code>W</code> normalmente na face acabada direita.</li></ul></div>
  <div class="card"><h3>Absoluta × Incremental</h3><ul>
    <li><b>Absoluta (G90)</b>: tudo medido a partir do zero-peça.</li>
    <li><b>Incremental (G91)</b>: quanto andou desde o ponto anterior.</li>
    <li>No torno Fanuc: <code>X/Z</code> absoluto e <code>U/W</code> incremental, misturáveis no mesmo bloco.</li>
    <li><code>U</code> também é <b>diâmetro</b>: tirar 1 mm de raio = <code>U-2</code>.</li>
    <li><code>ΔX = X − X anterior</code> · <code>ΔZ = Z − Z anterior</code></li></ul></div>
  <div class="card"><h3>Chanfro e raio</h3><ul>
    <li>Chanfro <code>C x45°</code>: entra no diâmetro <code>ø − 2C</code> e termina <code>C</code> mm em Z.</li>
    <li>Raio <code>R</code>: consome <code>R</code> no raio → <code>2R</code> no diâmetro, e <code>R</code> em Z.</li>
    <li>Cone: X e Z mudam no mesmo bloco.</li>
    <li>Leitura rápida: só X muda → degrau · só Z muda → cilindro · os dois na mesma proporção → 45° · proporções diferentes → cone.</li></ul></div>
  <div class="card"><h3>Exemplo resolvido</h3>
    <p>Eixo <code>ø20</code> nos primeiros 20 mm e <code>ø40</code> até 40 mm, zero na face direita:</p><ul>
    <li><b>A</b> centro da face → <code>X0 Z0</code></li>
    <li><b>B</b> mesma face, ponta do ø20 → <code>X20 Z0</code></li>
    <li><b>C</b> fim do cilindro, 20 mm → <code>X20 Z-20</code></li>
    <li><b>D</b> degrau reto, sobe o diâmetro → <code>X40 Z-20</code></li>
    <li><b>E</b> fim da peça → <code>X40 Z-40</code></li></ul>
    <p><b>Fechamento:</b> ΣΔX = 40 (último X) e ΣΔZ = −40 (último Z). Se não fecha, o erro está entre duas linhas.</p></div>
  <div class="card"><h3>Funções básicas</h3><ul>
    <li><code>G0</code> rápido, sem cortar. <code>G1</code> avanço de trabalho.</li>
    <li><code>G2/G3</code> arco horário/anti-horário, raio em <code>R</code>.</li>
    <li><code>G90/G91</code> absoluto/incremental · <code>G54</code> zero-peça.</li>
    <li><code>G96 S</code> velocidade de corte constante · <code>G97</code> RPM fixo.</li>
    <li><code>T0101</code> ferramenta · <code>M3/M4</code> giro · <code>M30</code> fim.</li></ul></div>
  <div class="card"><h3>Erros clássicos</h3><ul>
    <li>Escrever o raio no lugar do diâmetro em X.</li>
    <li>Esquecer o sinal negativo em Z.</li>
    <li>No degrau reto mudar os dois eixos (só um muda).</li>
    <li>Começar o chanfro no diâmetro cheio.</li>
    <li>Escrever o incremental na coluna absoluta (ou o contrário).</li>
    <li>Trocar as colunas X e Z.</li></ul></div>
  <div class="card"><h3>Ajuda e estrelas</h3><ul>
    <li>3 ★ = acertou de primeira, sem dica paga.</li>
    <li><b>Dica</b> nível 1 é sempre grátis (mostra onde olhar); aprofundar gasta 💡.</li>
    <li>2 ★ = até 2 tentativas e até 2 dicas pagas.</li>
    <li><b>Revelar célula</b> limita a 2 ★ (da terceira revelação em diante, 1 ★); <b>ver a resposta</b>, 1 ★.</li>
    <li>Pedir dica sem ter ficha 💡 ("dica emprestada") fecha a fase em 1 ★.</li>
    <li>Após 3 tentativas o botão <b>Explicar</b> abre o passo a passo.</li>
    <li>Fase repetida rende 30% da recompensa.</li></ul>
    <button class="btn" id="helpTutor">Rever o tutorial (fase 1)</button></div>
  <div class="card"><h3>Progresso salvo</h3>
    <p>O progresso fica guardado só neste atalho/navegador. Se apagar o ícone da tela de início, ele vai junto — exporte de vez em quando.</p>
    <div class="actions" style="padding:0;border:0">
      <button class="btn" id="btnExport">Exportar save</button>
      <button class="btn" id="btnImport">Importar save</button>
      <button class="btn danger" id="btnReset">Zerar progresso</button>
    </div><input type="file" id="fileImport" accept="application/json" style="display:none"></div>`;

  $('#helpTutor').onclick=()=>{ startLevel(LEVELS[0]); clearTimeout(startLevel._tut); startTutorial(); };
  $('#btnExport').onclick=async ()=>{
    const json=JSON.stringify(S,null,1);
    try{
      const file=new File([json],'cnc-coordenadas-save.json',{type:'application/json'});
      if(navigator.canShare && navigator.canShare({files:[file]})){
        await navigator.share({files:[file], title:'Save CNC Coordenadas'});
        toast('Save exportado.'); return;
      }
    }catch(e){ if(e && e.name==='AbortError') return; }
    const a=document.createElement('a'), url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
    a.href=url; a.download='cnc-coordenadas-save.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast('Save exportado.');
  };
  $('#btnImport').onclick=()=>$('#fileImport').click();
  $('#fileImport').onchange=e=>{
    const f=e.target.files[0]; if(!f) return;
    const rd=new FileReader();
    rd.onload=()=>{
      let raw; try{ raw=JSON.parse(rd.result); }catch(err){ toast('Arquivo inválido.'); return; }
      if(!raw || typeof raw!=='object' || Array.isArray(raw) || !('xp' in raw || 'stars' in raw)){
        toast('Isso não parece um save do jogo.'); return; }
      if(!confirm(`Importar substitui o progresso atual (${totalStars()}★, ${S.coins} moedas). Continuar?`)) return;
      S=sanitize(raw); P=null; save(); hud(); renderHelp(); toast('Progresso importado!');
    };
    rd.readAsText(f);
  };
  $('#btnReset').onclick=()=>{
    if(!confirm('Isso apaga estrelas, moedas, XP e desbloqueios. Não dá para desfazer. Continuar?')) return;
    S={...DEF, stars:{}, best:{}, unlocked:[], owned:[]}; P=null; save(); hud(); renderHelp(); toast('Progresso zerado.');
  };
}

/* =========================================================================
   DESENHO TÉCNICO
   ========================================================================= */
const cv=$('#cv'), ctx=cv.getContext('2d');
const CVFONT='-apple-system, system-ui, "Segoe UI", Roboto, sans-serif';
/* toque/clique no desenho seleciona o ponto mais próximo */
const HIT=[];
cv.addEventListener('pointerdown',e=>{
  if(!P || !HIT.length) return;
  const b=cv.getBoundingClientRect();
  const px=e.clientX-b.left, py=e.clientY-b.top;
  let best=null, bd=Infinity;
  HIT.forEach(h=>{ const d=(h.x-px)**2+(h.y-py)**2; if(d<bd){bd=d; best=h;} });
  if(!best || bd>46*46){ setHL(-1); return; }
  setHL(P.hl===best.r ? -1 : best.r);
  const el=document.querySelector(`#coordTable [data-r="${best.r}"]`);
  if(el) el.scrollIntoView({block:'nearest',behavior:REDUCED?'auto':'smooth'});
});
const view={dims:true, grid:true, axis:true, ghost:true};
function bindToggle(id,key){
  $(id).onclick=e=>{ view[key]=!view[key];
    e.currentTarget.classList.toggle('on',view[key]);
    e.currentTarget.setAttribute('aria-pressed',view[key]); draw(); };
}
function ghostAviso(){
  if(!P) return;
  const g=playerPts(P.lv).filter(p=>p.ok&&!p.safe);
  if(view.ghost && g.length<2) toast('Preencha pelo menos 2 pontos para ver o seu perfil.',2600);
}
bindToggle('#tglDims','dims'); bindToggle('#tglGrid','grid');
bindToggle('#tglAxis','axis'); bindToggle('#tglGhost','ghost');
$('#tglGhost').addEventListener('click',ghostAviso);
$$('.mini').forEach(m=>{m.classList.add('on'); m.setAttribute('aria-pressed','true');});

function resize(){
  const r=cv.getBoundingClientRect(), d=window.devicePixelRatio||1;
  if(r.width<2) return;
  cv.width=r.width*d; cv.height=r.height*d; ctx.setTransform(d,0,0,d,0,0);
}
window.addEventListener('resize',()=>{
  if($('#screen-play').classList.contains('active')){resize();draw();}
});
/* o canvas cresce por flex: window.resize não dispara, então observa o elemento */
if(window.ResizeObserver){
  new ResizeObserver(()=>{ if($('#screen-play').classList.contains('active')){ resize(); draw(); } }).observe(cv);
}
window.addEventListener('orientationchange',()=>
  setTimeout(()=>{ if($('#screen-play').classList.contains('active')){resize();draw();} },350));
function themeColors(){
  const th=document.body.dataset.theme;
  if(CC && CC._t===th) return CC;
  const cs=getComputedStyle(document.body), g=n=>cs.getPropertyValue(n).trim();
  CC={_t:th, paper:g('--paper'), draw:g('--draw'), dim:g('--dim'), pt:g('--pt'),
      line:g('--line'), muted:g('--muted'), acc:g('--acc'), acc2:g('--acc2'),
      ok:g('--ok'), err:g('--err')};
  return CC;
}

/* perfil que os números do jogador desenham */
function playerPts(lv){
  const mode=lv.modes[0], out=[]; let cx=0, cz=0;
  lv.pts.forEach((p,r)=>{
    let x,z;
    if(mode==='inc'){
      const dx=parseNum(val(r,'ix')), dz=parseNum(val(r,'iz'));
      x=cx+dx; z=cz+dz;
    }else{ x=parseNum(val(r,'ax')); z=parseNum(val(r,'az')); }
    const ok=!isNaN(x)&&!isNaN(z);
    out.push({id:p.id, x, z, safe:p.safe, ok,
              hit: ok && Math.abs(x-p.x)<=TOL && Math.abs(z-p.z)<=TOL});
    if(ok){ cx=x; cz=z; }
  });
  return out;
  function val(r,k){ const el=document.querySelector(`#coordTable [data-r="${r}"][data-k="${k}"]`); return el?el.value:''; }
}

let _rafDraw=0;
function draw(){                      // coalesce vários pedidos no mesmo frame
  if(_rafDraw) return;
  _rafDraw=requestAnimationFrame(()=>{ _rafDraw=0; _draw(); });
}
function _draw(){
  HIT.length=0;
  if(!P) return;
  const W=cv.clientWidth, H=cv.clientHeight;
  if(W<2||H<2) return;
  const C=themeColors();
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle=C.paper; ctx.fillRect(0,0,W,H);

  const path=P.lv.pts.filter(p=>!p.safe);      // marcadores
  const pts =path.filter(p=>p.z<=0);           // sólido
  if(!pts.length) return;
  const zmin=Math.min(...pts.map(p=>p.z));
  const zmax=Math.max(0,...path.map(p=>p.z));
  const xmax=Math.max(...pts.map(p=>p.x))||10;
  const zneg=[...new Set(pts.map(p=>p.z).filter(z=>z<0))].sort((a,b)=>b-a);
  const zpos=[...new Set(path.map(p=>p.z).filter(z=>z>0))];

  const dstep=Math.max(24, Math.min(28, (H*0.48)/Math.max(1,zneg.length)));
  const botPad=view.dims? 22+zneg.length*dstep : 26;
  const padL=Math.min(60,W*0.14), padR=Math.min(36,W*0.09), topPad=Math.min(44,H*0.11);
  const availW=Math.max(60, W-padL-padR), availH=Math.max(60, H-topPad-botPad);
  const sc=Math.min(availW/((zmax-zmin)||1), availH/xmax)*0.94;
  const cy=topPad+availH/2;
  const sx=z=> padL+(z-zmin)*sc;
  const sy=x=> cy-(x/2)*sc;
  const hlPt = P.hl>=0 ? P.lv.pts[P.hl] : null;
  const mark = has('marker') && hlPt;

  /* grade ancorada no zero */
  if(view.grid){
    ctx.strokeStyle=C.line; ctx.globalAlpha = document.body.dataset.theme==='paper' ? .16 : .35; ctx.lineWidth=1;
    const vline=X=>{ if(X>=0&&X<=W){ctx.beginPath();ctx.moveTo(X,0);ctx.lineTo(X,H);ctx.stroke();} };
    const hline=Y=>{ if(Y>=0&&Y<=H){ctx.beginPath();ctx.moveTo(0,Y);ctx.lineTo(W,Y);ctx.stroke();} };
    for(let z=0; z>=zmin-5; z-=5) vline(sx(z));
    for(let z=5; z<=zmax+5; z+=5) vline(sx(z));
    for(let r=0; r<=xmax/2+5; r+=5){ hline(cy-r*sc); if(r) hline(cy+r*sc); }
    ctx.globalAlpha=1;
  }

  /* placa */
  const cx0=sx(zmin), jaw=Math.max(xmax/2*sc+26,40);
  ctx.fillStyle=C.muted; ctx.globalAlpha=.30;
  ctx.fillRect(cx0-28, cy-jaw, 26, jaw-8);
  ctx.fillRect(cx0-28, cy+8, 26, jaw-8);
  ctx.globalAlpha=.75; ctx.lineWidth=1.2; ctx.strokeStyle=C.muted;
  ctx.strokeRect(cx0-28, cy-jaw, 26, jaw-8); ctx.strokeRect(cx0-28, cy+8, 26, jaw-8);
  ctx.globalAlpha=1;
  ctx.fillStyle=C.muted; ctx.font='11px '+CVFONT; ctx.textAlign='right';
  ctx.fillText('placa', cx0-4, cy-jaw-4);

  /* corpo */
  ctx.lineWidth=2.4; ctx.strokeStyle=C.draw; ctx.lineJoin='round';
  ctx.beginPath();
  ctx.moveTo(sx(pts[0].z), sy(pts[0].x));
  pts.forEach(p=>ctx.lineTo(sx(p.z),sy(p.x)));
  const last=pts[pts.length-1];
  ctx.lineTo(sx(last.z), cy+(last.x/2)*sc);
  [...pts].reverse().forEach(p=>ctx.lineTo(sx(p.z), cy+(p.x/2)*sc));
  ctx.closePath();
  ctx.save(); ctx.globalAlpha=.13; ctx.fillStyle=C.draw; ctx.fill();
  ctx.clip(); ctx.globalAlpha=.07; ctx.strokeStyle=C.draw; ctx.lineWidth=1;
  for(let k=-H;k<W+H;k+=9){ ctx.beginPath(); ctx.moveTo(k,0); ctx.lineTo(k+H,H); ctx.stroke(); }
  ctx.restore();
  ctx.stroke();

  /* linha de centro */
  ctx.setLineDash([12,4,3,4]); ctx.strokeStyle=C.dim; ctx.lineWidth=1; ctx.globalAlpha=.8;
  ctx.beginPath(); ctx.moveTo(sx(zmin)-30,cy); ctx.lineTo(sx(zmax)+34,cy); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha=1;

  /* zero-peça W */
  const zx=sx(0);
  ctx.strokeStyle=C.acc; ctx.lineWidth=1.6;
  ctx.beginPath(); ctx.arc(zx,cy,7,0,7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(zx-11,cy);ctx.lineTo(zx+11,cy);ctx.moveTo(zx,cy-11);ctx.lineTo(zx,cy+11);ctx.stroke();
  ctx.fillStyle=C.acc; ctx.font='bold 11px '+CVFONT; ctx.textAlign='left';
  ctx.fillText('W', zx+13, cy+18);

  if(view.axis){
    const ax=W-58, ay=Math.min(50,topPad+8);
    ctx.strokeStyle=C.acc2; ctx.lineWidth=1.6; ctx.fillStyle=C.acc2; ctx.font='bold 11px '+CVFONT;
    arrow(ctx,ax,ay,ax,ay-26); ctx.textAlign='center'; ctx.fillText('X+',ax,ay-32);
    arrow(ctx,ax,ay,ax+26,ay); ctx.textAlign='left'; ctx.fillText('Z+',ax+30,ay+4);
    ctx.globalAlpha=.45; arrow(ctx,ax,ay,ax-26,ay); ctx.textAlign='right'; ctx.fillText('Z−',ax-30,ay+4);
    ctx.globalAlpha=1;
  }

  if(view.dims){
    ctx.font='12px '+CVFONT; ctx.lineWidth=1.2;
    /* diâmetros */
    const dias=[...new Set(pts.map(p=>p.x).filter(x=>x>0))];
    dias.forEach(d=>{
      let best=null;
      for(let i=1;i<pts.length;i++){
        if(pts[i].x===d&&pts[i-1].x===d){ const len=Math.abs(pts[i].z-pts[i-1].z);
          if(!best||len>best.len) best={z:(pts[i].z+pts[i-1].z)/2,len}; }
      }
      if(!best){ const p=pts.filter(p=>p.x===d).pop(); best={z:p.z,len:0}; }
      const on = mark && hlPt.x===d;
      ctx.strokeStyle=on?C.acc:C.dim; ctx.fillStyle=on?C.acc:C.dim; ctx.lineWidth=on?2:1;
      const X=sx(best.z), y1=sy(d), y2=cy+(d/2)*sc;
      ctx.globalAlpha=.9;
      arrow(ctx,X,cy,X,y1); arrow(ctx,X,cy,X,y2);
      const txt='ø'+fmt(d), ty=(y1+cy)/2;
      ctx.save(); ctx.translate(X-6,ty); ctx.rotate(-Math.PI/2);
      const w=ctx.measureText(txt).width;
      ctx.globalAlpha=1; ctx.fillStyle=C.paper; ctx.fillRect(-w/2-3,-8,w+6,14);
      ctx.fillStyle=on?C.acc:C.dim; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(txt,0,0); ctx.restore(); ctx.textBaseline='alphabetic';
      ctx.globalAlpha=1; ctx.lineWidth=1;
    });

    /* anotações de chanfro / raio 45° */
    ctx.fillStyle=C.dim; ctx.strokeStyle=C.dim; ctx.textAlign='left';
    for(let i=1;i<pts.length;i++){
      const a=pts[i-1], b=pts[i];
      const dz=Math.abs(b.z-a.z), dr=Math.abs(b.x-a.x)/2;
      if(dz>0 && Math.abs(dz-dr)<TOL && dz<=6){
        const mx=(sx(a.z)+sx(b.z))/2, my=(sy(a.x)+sy(b.x))/2;
        ctx.fillText(b.arc?('R'+fmt(b.arc)):(fmt(dz)+'x45°'), mx+9, 2*cy-my+4);
      }
    }
    /* comprimentos negativos */
    const y0=cy+xmax/2*sc+22;
    zneg.forEach((z,i)=>{
      const on = mark && hlPt.z===z;
      ctx.strokeStyle=on?C.acc:C.dim; ctx.fillStyle=on?C.acc:C.dim; ctx.lineWidth=on?2:1;
      const Y=y0+i*dstep, X=sx(z), X0=sx(0);
      const pAt=pts.find(p=>p.z===z), yBot=cy+((pAt?pAt.x:xmax)/2)*sc;
      ctx.globalAlpha=.35;
      ctx.beginPath(); ctx.moveTo(X,yBot+3); ctx.lineTo(X,Y+4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X0,cy); ctx.lineTo(X0,Y+4); ctx.stroke();
      ctx.globalAlpha=1;
      arrow(ctx,X0,Y,X,Y); arrow(ctx,X,Y,X0,Y);
      ctx.textAlign='center';
      const txt=fmt(-z), tw=ctx.measureText(txt).width, mxx=(X+X0)/2;
      ctx.save(); ctx.fillStyle=C.paper; ctx.fillRect(mxx-tw/2-3, Y-14, tw+6, 13); ctx.restore();
      ctx.fillText(txt, mxx, Y-4);
      ctx.lineWidth=1;
    });
    /* aproximações com Z positivo */
    zpos.forEach(z=>{
      const Y=cy-xmax/2*sc-16, X=sx(z), X0=sx(0);
      ctx.strokeStyle=C.acc2; ctx.fillStyle=C.acc2; ctx.globalAlpha=.9;
      arrow(ctx,X0,Y,X,Y); arrow(ctx,X,Y,X0,Y);
      ctx.textAlign='center'; ctx.fillText('+'+fmt(z),(X+X0)/2,Y-4);
      ctx.globalAlpha=1;
    });
  }

  /* perfil-fantasma do jogador */
  if(view.ghost){
    const g=playerPts(P.lv).filter(p=>p.ok&&!p.safe);
    if(g.length>1){
      ctx.save(); ctx.beginPath(); ctx.rect(0,0,W,H); ctx.clip();
      ctx.setLineDash([10,6]); ctx.strokeStyle=C.acc;
      ctx.beginPath();
      g.forEach((p,i)=> i?ctx.lineTo(sx(p.z),sy(p.x)):ctx.moveTo(sx(p.z),sy(p.x)));
      ctx.lineWidth=7; ctx.globalAlpha=.12; ctx.stroke();
      ctx.lineWidth=2.6; ctx.globalAlpha=.9;  ctx.stroke();
      ctx.setLineDash([]);
      g.forEach(p=>{ ctx.beginPath(); ctx.arc(sx(p.z),sy(p.x),4.5,0,7);
        ctx.fillStyle=p.hit?C.ok:C.err; ctx.fill(); });
      ctx.restore(); ctx.globalAlpha=1;
    }
  }

  /* pontos + rótulos */
  const boxes=[];
  path.forEach(p=>{
    const X=sx(p.z), Y=sy(p.x);
    HIT.push({r:P.lv.pts.indexOf(p), x:X, y:Y});
    const on = hlPt===p;
    if(p.z>0){ ctx.setLineDash([3,3]); ctx.strokeStyle=C.acc2; ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.arc(X,Y,8,0,7); ctx.stroke(); ctx.setLineDash([]); }
    if(on){
      ctx.strokeStyle=C.acc2; ctx.setLineDash([4,4]); ctx.lineWidth=1.2; ctx.globalAlpha=.9;
      ctx.beginPath(); ctx.moveTo(X,Y); ctx.lineTo(X,cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X,Y); ctx.lineTo(sx(0),Y); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha=1;
      ctx.beginPath(); ctx.arc(X,Y,11,0,7); ctx.strokeStyle=C.acc2; ctx.lineWidth=2; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(X,Y,on?6:4.5,0,7);
    ctx.fillStyle= on?C.acc2:C.pt; ctx.fill();

    ctx.font='bold 13px '+CVFONT; ctx.textAlign='center';
    const w=ctx.measureText(p.id).width+8;
    let lx=X, ly=Y-13, t=0;
    while(boxes.some(b=>Math.abs(b.x-lx)<(b.w+w)/2 && Math.abs(b.y-ly)<15) && t<8){
      ly-=15; if(t%2===1) lx += (w/2+4)*(t%4===1?1:-1); t++;
    }
    ly=Math.max(14,ly); lx=Math.min(W-w/2-4, Math.max(w/2+4, lx));
    boxes.push({x:lx,y:ly,w});
    if(ly<Y-16){ ctx.strokeStyle=on?C.acc2:C.muted; ctx.globalAlpha=.35; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(X,Y-6); ctx.lineTo(lx,ly+4); ctx.stroke(); ctx.globalAlpha=1; }
    ctx.fillStyle=C.paper; ctx.fillRect(lx-w/2,ly-11,w,15);
    ctx.fillStyle= on?C.acc2:C.draw;
    ctx.fillText(p.id, lx, ly);
  });

  const safes=P.lv.pts.filter(p=>p.safe);
  if(safes.length){
    ctx.fillStyle=C.muted; ctx.font='11px '+CVFONT; ctx.textAlign='right';
    const rotulo = safes.length>1 ? 'pontos de segurança' : 'ponto de segurança';
    const lista = safes.map(s=>`${s.id} (X${fmt(s.x)} Z${fmt(s.z)})`).join(', ');
    ctx.fillText('⌖ '+lista+' = '+rotulo+' (fora do desenho)', W-14, H-8);
  }
}
function arrow(c,x1,y1,x2,y2){
  c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke();
  const a=Math.atan2(y2-y1,x2-x1), s=6;
  c.beginPath(); c.moveTo(x2,y2);
  c.lineTo(x2-s*Math.cos(a-.4), y2-s*Math.sin(a-.4));
  c.lineTo(x2-s*Math.cos(a+.4), y2-s*Math.sin(a+.4));
  c.closePath(); c.fill();
}

/* =========================================================================
   TUTORIAL DINÂMICO
   ========================================================================= */
const tutCell=(r,k)=>document.querySelector(`#coordTable [data-r="${r}"][data-k="${k}"]`);
function tutFill(r){
  colsOf(P.lv).forEach(c=>{
    const el=tutCell(r,c.k); if(!el) return;
    const exp=expected(P.lv,r,c.k);
    el.value = c.k==='g'?exp:fmt(exp);
    el.classList.add('given','ok'); el.classList.remove('err');
  });
  _draw();
}
function tutCheckRow(r){
  const bad=[];
  colsOf(P.lv).forEach(c=>{
    const el=tutCell(r,c.k); if(!el) return;
    const exp=expected(P.lv,r,c.k);
    const v = c.k==='g'?el.value:parseNum(el.value);
    const ok = c.k==='g'? v===exp : Math.abs(v-exp)<=TOL;
    el.classList.toggle('ok',ok); el.classList.toggle('err',!ok);
    if(!ok) bad.push({k:c.k,h:c.h,v,exp});
  });
  draw();
  if(!bad.length) return {ok:true};
  const b=bad[0];
  let msg;
  if(b.k!=='g' && isNaN(b.v)) msg=`Falta preencher <b>${b.h}</b>.`;
  else if(b.k==='ax') msg = Math.abs(b.v-b.exp/2)<TOL
      ? 'Quase! Você escreveu o <b>raio</b>. No torno X é sempre <b>diâmetro</b> — o dobro do raio.'
      : 'Em X vai o diâmetro que o desenho mostra <b>nesse ponto</b> (a cota com ø).';
  else msg = Math.abs(b.v+b.exp)<TOL && b.exp!==0
      ? 'O número está certo, faltou o <b>sinal</b>: andando para dentro da peça, Z é <b>negativo</b>.'
      : 'Z é a distância até a face de referência (W). Encostado na face, Z vale <b>0</b>.';
  return {ok:false,msg};
}
const TUT=[
 {sel:'.drawpanel', txt:'Este é o <b>desenho técnico</b> da peça. Cada ponto marcado no perfil (A, B, C…) vira uma linha da tabela — é a sequência que a ferramenta vai percorrer.'},
 {sel:'#cv', txt:'O alvo marcado com <b>W</b> é o <b>zero-peça</b>: o ponto de onde a máquina conta todas as medidas. Fica na <b>face</b> (a superfície plana da ponta direita), como o zero de uma régua encostado ali.'},
 {sel:'#cv', txt:'As <b>cotas</b> (as medidas anotadas no desenho) com <b>ø</b> são <b>diâmetros</b> — e a coluna <b>X</b> é sempre diâmetro, nunca raio. Se o desenho diz ø20, escreva <b>20</b>.'},
 {sel:'#cv', txt:'As cotas de baixo medem o <b>comprimento a partir da face</b>. Como a ferramenta caminha da face <b>para dentro</b> da peça, esses valores entram <b>negativos</b>: Z−20, Z−40. Regra de bolso: <b>entrou na peça, ficou negativo</b>.'},
 {sel:'#coordTable', txt:`Cada ponto vira uma linha aqui. ${TOUCH?'Toque numa linha — ou no próprio ponto do desenho — e ele <b>acende</b>':'Passe o mouse numa linha e o ponto correspondente <b>acende no desenho</b>'}, com as linhas de leitura até os eixos.`},
 {sel:'#coordTable tr[data-r="0"]', onEnter:()=>tutFill(0),
  txt:'Vou resolver o <b>ponto A</b> com você. A ferramenta está no <b>centro da face</b>: no centro o diâmetro é zero → <b>X0</b>. E encostada na face de referência → <b>Z0</b>. Primeira linha preenchida.'},
 {sel:'#coordTable tr[data-r="1"]', gate:true, check:()=>tutCheckRow(1),
  txt:'Sua vez. O <b>ponto B</b> está na quina do ø20, <b>ainda encostado na face</b>.<br>Qual diâmetro o desenho mostra aí? E quanto a ferramenta andou para a esquerda?<br>Preencha X e Z desta linha e clique em <b>Conferir</b>.'},
 {sel:'#btnHint', txt:'Empacou? A <b>Dica</b> olha o que você digitou e aponta a célula errada — o primeiro nível é grátis, aprofundar gasta uma ficha 💡. E depois de 3 tentativas o botão <b>Explicar</b> abre o passo a passo completo.'},
 {sel:'#btnCheck', txt:'Quando terminar, clique em <b>Verificar</b>. Acertar de primeira, sem dica paga, vale <b>3 ★</b>. O ponto A já saiu e você fez o B — siga o mesmo raciocínio de C até o fim.'}
];
let tstep=0, tutTarget=null, tutRAF=0, tutFails=0;
function startTutorial(){
  tstep=0; tutTarget=null; tutFails=0;
  window.scrollTo({top:0,behavior:'auto'});
  $('#tutor').classList.add('on');
  addEventListener('scroll', tutReflow, true);
  addEventListener('resize', tutReflow);
  tutShow();
}
function tutReflow(){ cancelAnimationFrame(tutRAF); tutRAF=requestAnimationFrame(()=>tutPlace(tutTarget)); }
function tutShow(){
  if(!$('#screen-play').classList.contains('active')){ endTutorial(); return; }
  const s=TUT[tstep], el=$(s.sel);
  if(!el){ endTutorial(); return; }
  tutTarget=el; tutFails=0;
  $('#tutStep').textContent=`PASSO ${tstep+1}/${TUT.length}`;
  $('#tutText').innerHTML=s.txt;
  $('#tutErr').textContent='';
  $('#tutGive').style.display='none';
  $('#tutBack').disabled = tstep===0;
  $('#tutNext').textContent = s.gate?'Conferir' : (tstep===TUT.length-1?'Começar a preencher':'Próximo ›');
  $('#tutor').classList.toggle('interactive', !!s.gate);
  if(s.onEnter) s.onEnter();
  const r0=el.getBoundingClientRect();
  if(r0.top<90 || r0.bottom>innerHeight-40) el.scrollIntoView({block:'center',behavior:'auto'});
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    tutPlace(el);
    $('#tutNext').focus({preventScroll:true});
  }));
  beep(520,.05);
}
function tutPlace(el){
  if(!el || !$('#tutor').classList.contains('on')) return;
  const pad=8, r=el.getBoundingClientRect(), sp=$('#tutSpot'), b=$('#tutBubble');
  sp.style.left=(r.left-pad)+'px'; sp.style.top=(r.top-pad)+'px';
  sp.style.width=(r.width+pad*2)+'px'; sp.style.height=(r.height+pad*2)+'px';
  const bb=b.getBoundingClientRect(), bw=bb.width, bh=bb.height;
  let bx=r.left+r.width/2-bw/2, by=r.bottom+16;
  if(by+bh>innerHeight-10) by=r.top-bh-16;
  by=Math.max(10, Math.min(by, innerHeight-bh-10));
  bx=Math.max(10, Math.min(bx, innerWidth-bw-10));
  b.style.left=bx+'px'; b.style.top=by+'px';
}
$('#tutNext').onclick=()=>{
  const s=TUT[tstep];
  if(s.gate){
    const res=s.check();
    if(!res.ok){
      tutFails++; sndErr();
      $('#tutErr').innerHTML=res.msg;
      const b=$('#tutBubble'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
      if(tutFails>=2) $('#tutGive').style.display='';
      tutPlace(tutTarget); return;
    }
    sndOk(); $('#tutErr').textContent='';
  }
  tstep++; tstep>=TUT.length?endTutorial():tutShow();
};
$('#tutGive').onclick=()=>{ tutFill(1); $('#tutErr').textContent=''; $('#tutGive').style.display='none'; };
$('#tutBack').onclick=()=>{ if(tstep>0){ tstep--; tutShow(); } };
$('#tutBubble').addEventListener('keydown',e=>{
  if(e.key!=='Tab' || $('#tutor').classList.contains('interactive')) return;
  const f=[...$('#tutBubble').querySelectorAll('button')].filter(b=>b.offsetParent&&!b.disabled);
  if(!f.length) return;
  e.preventDefault();
  f[(f.indexOf(document.activeElement)+(e.shiftKey?-1:1)+f.length)%f.length].focus();
});
$('#tutSkip').onclick=()=>{ endTutorial(); toast('Sem problema — o Manual tem o botão “Rever o tutorial”.',4000); };
$('#tutor').addEventListener('click',e=>{
  if(TOUCH) return;                                   // no toque, só o botão avança
  if(e.target.id==='tutor' && !TUT[tstep].gate) $('#tutNext').click();
});
function endTutorial(){
  $('#tutor').classList.remove('on','interactive');
  removeEventListener('scroll', tutReflow, true);
  removeEventListener('resize', tutReflow);
  tutTarget=null; S.tutorial=true; save();
}

/* =========================================================================
   CONFETE
   ========================================================================= */
const fx=$('#fx'), fctx=fx.getContext('2d');
let fxRAF=0;
function fxResize(){
  const d=window.devicePixelRatio||1;
  fx.width=innerWidth*d; fx.height=innerHeight*d;
  fctx.setTransform(d,0,0,d,0,0);
}
function confetti(){
  cancelAnimationFrame(fxRAF);
  fxResize();
  const cols=['#ffb020','#43d0ff','#31d07a','#ff5d5d','#ffffff'];
  const ps=[...Array(140)].map(()=>({
    x:innerWidth/2+(Math.random()-.5)*260, y:innerHeight/2,
    vx:(Math.random()-.5)*11, vy:-Math.random()*13-4,
    s:4+Math.random()*7, c:cols[(Math.random()*cols.length)|0], r:Math.random()*7, vr:(Math.random()-.5)*.4, a:1
  }));
  let f=0;
  (function loop(){
    fctx.clearRect(0,0,innerWidth,innerHeight);
    ps.forEach(p=>{ p.vy+=.32; p.x+=p.vx; p.y+=p.vy; p.r+=p.vr; p.a-=.008;
      fctx.save(); fctx.globalAlpha=Math.max(0,p.a); fctx.translate(p.x,p.y); fctx.rotate(p.r);
      fctx.fillStyle=p.c; fctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6); fctx.restore(); });
    if(++f<170) fxRAF=requestAnimationFrame(loop);
    else { fctx.clearRect(0,0,innerWidth,innerHeight); fx.width=fx.height=0; }
  })();
}

/* =========================================================================
   TECLADO GLOBAL / BOOT
   ========================================================================= */
window.addEventListener('keydown',e=>{
  if($('#tutor').classList.contains('on')){
    if(e.key==='Escape'){ e.preventDefault(); endTutorial(); }
    else if(e.key==='ArrowLeft'){ $('#tutBack').click(); }
    return;
  }
  if(e.key!=='Escape') return;
  const open=$$('.modal.on');
  if(open.length){
    e.preventDefault();
    if($('#modalResult').classList.contains('on')||$('#modalUnlock').classList.contains('on')) return;
    document.body.style.overflow=''; setInert(false);
    $('#overlay').classList.remove('on'); open.forEach(m=>m.classList.remove('on'));
    if(lastFocus&&document.contains(lastFocus)) lastFocus.focus();
    return;
  }
  if(!$('#screen-play').classList.contains('active')) return;
  if(document.activeElement && document.activeElement.closest('#coordTable')){ document.activeElement.blur(); return; }
  show('map');
});
/* app instalado na tela de início: sinal confiável no iOS é navigator.standalone */
if(navigator.standalone || matchMedia('(display-mode:standalone)').matches)
  document.documentElement.classList.add('standalone');

hud(); show('map');
