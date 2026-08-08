/* =========================================================================
   CNC COORDENADAS — dados das fases
   Convenção (ISO / torno):
     X  = DIÂMETRO (não raio)
     Z0 = face direita acabada (zero-peça W)
     Z  negativo = para dentro da peça (esquerda)
   Cada ponto: {id, x, z, note?, g?, safe?}
   ========================================================================= */

const MODE_LABEL = {
  abs:  'Coordenadas absolutas (X, Z)',
  inc:  'Coordenadas incrementais (U, W)',
  both: 'Absolutas + Incrementais',
  gcode:'Programação G0 / G1'
};
const MODE_LABEL_FRESA = {
  abs:  'Coordenadas absolutas (X, Y)',
  inc:  'Coordenadas incrementais (ΔX, ΔY)',
  both: 'Absolutas + Incrementais',
  gcode:'Programação G0 / G1'
};

const LEVELS_TORNO = [
{
  id:1, name:'Primeiro Contato', sub:'Eixo Z e o diâmetro X', modes:['abs'], boss:false,
  tip:'X é sempre DIÂMETRO. Z anda para a esquerda = negativo.',
  brief:'Eixo simples com um degrau. Leia o diâmetro e o comprimento de cada ponto.',
  pts:[
    {id:'A', x:0,  z:0,   note:'começa no centro da face'},
    {id:'B', x:20, z:0,   note:'ainda na face, mas na ponta do ø20'},
    {id:'C', x:20, z:-20, note:'fim do trecho de 20 mm'},
    {id:'D', x:40, z:-20, note:'sobe o degrau, mesma posição em Z'},
    {id:'E', x:40, z:-40, note:'fim da peça'}
  ],
  hints:[
    'No ponto B a ferramenta está encostada na face: Z ainda vale 0.',
    'De B para C só muda o comprimento. O diâmetro continua ø20.',
    'No degrau (C→D) o Z NÃO muda — só o diâmetro sobe de 20 para 40.'
  ]
},
{
  id:2, name:'Chanfro de Entrada', sub:'Chanfro 2x45° e cone', modes:['abs'], boss:false,
  tip:'Chanfro 2x45°: anda 2 mm em Z e 4 mm em X (2 mm no raio de cada lado).',
  brief:'Mesma peça do exemplo clássico de sala: chanfro na entrada e um cone.',
  pts:[
    {id:'A', x:0,  z:0,   note:'centro da face'},
    {id:'B', x:16, z:0,   note:'ø20 menos 2 mm de raio de CADA lado = ø16'},
    {id:'C', x:20, z:-2,  note:'fim do chanfro 2x45°: 2 mm em Z, ø cheio'},
    {id:'D', x:20, z:-20, note:'fim do cilindro ø20'},
    {id:'E', x:40, z:-32, note:'topo do cone, já no ø40'},
    {id:'F', x:40, z:-50, note:'fim da peça (50 mm total)'}
  ],
  hints:[
    'Chanfro 2x45° começa 2 mm ANTES no diâmetro: 20 − 2·2 = 16.',
    'O cone D→E sobe 20 mm de diâmetro e anda 12 mm em Z.',
    'Comprimento total 50 mm → o último ponto é Z-50.'
  ]
},
{
  id:3, name:'Pensando em Δ', sub:'Coordenadas incrementais', modes:['inc'], boss:false,
  tip:'Incremental = quanto ANDOU desde o ponto anterior. ΔX = X atual − X anterior.',
  brief:'A mesma leitura, mas agora você informa o deslocamento em relação ao ponto anterior.',
  pts:[
    {id:'A', x:0,  z:0},
    {id:'B', x:25, z:0},
    {id:'C', x:25, z:-15},
    {id:'D', x:45, z:-15},
    {id:'E', x:45, z:-40}
  ],
  hints:[
    'O primeiro ponto sai da origem: o incremental é igual ao absoluto.',
    'Se o diâmetro não muda, ΔX = 0. Se o comprimento não muda, ΔZ = 0.',
    'Andar para a esquerda dá ΔZ negativo; aumentar diâmetro dá ΔX positivo.'
  ]
},
{
  id:4, name:'Δ com Chanfro', sub:'Incremental em perfil composto', modes:['inc'], boss:false,
  tip:'Num chanfro 2x45° o ΔX vale 4 e o ΔZ vale −2.',
  brief:'Perfil com chanfro e degrau — só incrementais.',
  pts:[
    {id:'A', x:0,  z:0},
    {id:'B', x:26, z:0},
    {id:'C', x:30, z:-2},
    {id:'D', x:30, z:-22},
    {id:'E', x:50, z:-22},
    {id:'F', x:50, z:-45}
  ],
  hints:[
    'B→C é o chanfro: ΔX = 30 − 26 = 4 e ΔZ = −2.',
    'D→E é degrau reto: ΔZ = 0.',
    'Some todos os ΔZ: o resultado tem que dar −45 (comprimento total).'
  ]
},
{
  id:5, name:'Lado a Lado', sub:'A mesma peça nas duas colunas', modes:['both'], boss:false,
  tip:'X é sempre diâmetro, Z negativo entra na peça — as mesmas regras de sempre, agora nas quatro colunas.',
  brief:'A peça da fase 3 de novo — agora com as quatro colunas. Sem chanfro, sem cone: só o método.',
  pts:[
    {id:'A', x:0,  z:0,   note:'centro da face'},
    {id:'B', x:25, z:0,   note:'ainda na face, já no ø25'},
    {id:'C', x:25, z:-15, note:'fim do trecho de 15 mm'},
    {id:'D', x:45, z:-15, note:'degrau: sobe o diâmetro sem andar em Z'},
    {id:'E', x:45, z:-40, note:'fim da peça (40 mm total)'}
  ],
  hints:[
    'Absoluta = medida a partir do zero-peça (a face). Incremental = a diferença para a linha de cima.',
    'A primeira linha sai da origem, então ΔX = X e ΔZ = Z: 25 e 0.',
    'Controle: ΣΔX = 25+0+20+0 = 45 (último X) e ΣΔZ = 0−15+0−25 = −40 (último Z).'
  ]
},
{
  id:6, name:'Duas Colunas', sub:'Absoluta e incremental juntas', modes:['both'], boss:false,
  tip:'Confira cada ponto com o desenho: qual diâmetro e qual comprimento ele mostra ali?',
  brief:'Agora as duas tabelas ao mesmo tempo, como na folha de processo.',
  pts:[
    {id:'A', x:0,  z:0},
    {id:'B', x:18, z:0},
    {id:'C', x:22, z:-2},
    {id:'D', x:22, z:-18},
    {id:'E', x:36, z:-26},
    {id:'F', x:36, z:-40},
    {id:'G', x:56, z:-40}
  ],
  hints:[
    'Absoluta = medida a partir do zero-peça. Incremental = diferença da linha de cima.',
    'D→E é cone: muda X e Z ao mesmo tempo.',
    'A última linha é um degrau: ΔZ = 0, ΔX = 56 − 36 = 20.'
  ]
},
{
  id:7, name:'Raio de Concordância', sub:'Chanfro, raio R3 e degrau', modes:['abs'], boss:false,
  tip:'Num raio R3 o ponto final fica deslocado 3 mm no raio (6 mm no ø) e 3 mm em Z.',
  brief:'Peça com chanfro, cilindro, raio e ombro. Atenção nos pontos do raio.',
  pts:[
    {id:'A', x:0,  z:0},
    {id:'B', x:14, z:0,   note:'entrada do chanfro 3x45°'},
    {id:'C', x:20, z:-3,  note:'fim do chanfro'},
    {id:'D', x:20, z:-20, note:'fim do ø20'},
    {id:'E', x:26, z:-20, note:'início do raio R3'},
    {id:'F', x:32, z:-23, arc:3, note:'fim do raio, já no ø32'},
    {id:'G', x:32, z:-42},
    {id:'H', x:46, z:-42}
  ],
  hints:[
    'Chanfro 3x45° → começa em ø20 − 2·3 = ø14 e termina em Z−3.',
    'O raio R3 consome 3 mm em Z e 3 mm no RAIO (6 mm no diâmetro).',
    'E→F: X vai de 26 para 32 enquanto Z vai de −20 para −23.'
  ]
},
{
  id:8, name:'Folha de Processo', sub:'Absoluta + incremental, 8 pontos', modes:['both'], boss:false,
  tip:'Confira somando: a soma dos ΔX tem que bater com o último X absoluto.',
  brief:'Perfil longo. Preencha as quatro colunas sem errar o sinal.',
  pts:[
    {id:'A', x:0,  z:0},
    {id:'B', x:24, z:0},
    {id:'C', x:30, z:-3},
    {id:'D', x:30, z:-25},
    {id:'E', x:44, z:-25},
    {id:'F', x:44, z:-48},
    {id:'G', x:60, z:-56},
    {id:'H', x:60, z:-75}
  ],
  hints:[
    'Chanfro 3x45° na entrada: ø30 − 6 = ø24.',
    'F→G é cone: ΔX = 16 e ΔZ = −8.',
    'Soma dos ΔZ = −75. Soma dos ΔX = 60.'
  ]
},
{
  id:9, name:'Antes de Encostar', sub:'Ponto de segurança e Z positivo', modes:['abs'], boss:false,
  tip:'Z positivo = ainda NO AR, à direita da face. Z0 é a face; só depois dela o Z fica negativo.',
  brief:'Peça curta e simples. O que é novo aqui são as duas primeiras linhas: o ponto de troca e a aproximação.',
  pts:[
    {id:'P1', x:120, z:50, safe:true, note:'ponto de segurança/troca — não está no desenho'},
    {id:'P2', x:24,  z:2,  note:'já no ø24, mas 2 mm ANTES da face → Z positivo'},
    {id:'P3', x:24,  z:0,  note:'encosta na face: aqui o Z vale zero'},
    {id:'P4', x:24,  z:-20,note:'fim do cilindro ø24'},
    {id:'P5', x:40,  z:-20,note:'degrau: só o diâmetro sobe'},
    {id:'P6', x:40,  z:-35,note:'fim da peça (35 mm total)'}
  ],
  hints:[
    'P1 é a posição de troca de ferramenta: longe de tudo, ø120 e 50 mm à direita da face → X120 Z50.',
    'P2 está 2 mm antes da face. Antes da face = à direita do zero = Z POSITIVO (+2).',
    'De P3 para P6 é a peça de sempre: ø24 até Z−20, degrau para ø40, e mais 15 mm até Z−35.'
  ]
},
{
  id:10, name:'A Peça do Instrutor', sub:'9 pontos + ponto de segurança', modes:['abs'], boss:false,
  tip:'O ponto de troca/segurança fica longe da peça: X grande e Z positivo.',
  brief:'Aquela peça de prova: ø60 escalonado com chanfros e raio. P1 é o ponto de segurança.',
  pts:[
    {id:'P1', x:150, z:50, safe:true, note:'ponto de segurança/troca de ferramenta'},
    {id:'P2', x:14,  z:3,  note:'aproximação ANTES da face → Z positivo'},
    {id:'P3', x:14,  z:0,  note:'encosta na face'},
    {id:'P4', x:20,  z:-3, note:'fim do chanfro 3x45°'},
    {id:'P5', x:20,  z:-20},
    {id:'P6', x:34,  z:-20, note:'início do raio R3'},
    {id:'P7', x:40,  z:-23, arc:3, note:'fim do raio R3'},
    {id:'P8', x:40,  z:-40},
    {id:'P9', x:54,  z:-40, note:'início do chanfro 3x45° do ø60'},
    {id:'P10',x:60,  z:-43, note:'fim do chanfro'}
  ],
  hints:[
    'P1 não toca a peça: é o ø150 a 50 mm da face (Z+50).',
    'P2 está 3 mm ANTES da face, então Z = +3.',
    'Do ø40 para o ø60 com chanfro 3x45°: começa em ø54 e termina 3 mm depois em Z.'
  ]
},
{
  id:11, name:'Cinco Blocos', sub:'Primeiro programa: G0 e G1', modes:['gcode'], boss:false,
  tip:'G0 = no ar, sem cortar. G1 = cortando. Só a aproximação é G0 aqui.',
  brief:'A peça da fase 1, agora escrita como programa. Cinco blocos, um G0 e quatro G1.',
  pts:[
    {id:'N10', x:20, z:2,   g:'G0', note:'aproxima no ar, 2 mm antes da face'},
    {id:'N20', x:20, z:0,   g:'G1', note:'encosta na face — a partir daqui há material'},
    {id:'N30', x:20, z:-20, g:'G1', note:'torneia os 20 mm do ø20'},
    {id:'N40', x:40, z:-20, g:'G1', note:'degrau: sobe para ø40 sem andar em Z'},
    {id:'N50', x:40, z:-40, g:'G1', note:'termina os 40 mm da peça'}
  ],
  hints:[
    'Só o primeiro bloco é no ar: N10 é G0, todo o resto é G1.',
    'N10 está ANTES da face (Z+2) e N20 encosta nela (Z0) — o X não muda, continua ø20.',
    'N30→N40 é degrau: Z fica em −20 e o X vai de 20 para 40.'
  ]
},
{
  id:12, name:'Escrevendo G-Code', sub:'G0 rápido, G1 usinando', modes:['gcode'], boss:false,
  tip:'G0 = deslocamento rápido, no ar, sem F. G1 = avanço de trabalho, cortando, com F.',
  brief:'Agora vira programa: escolha G0/G1 e preencha X e Z de cada bloco.',
  pts:[
    {id:'N10', x:0,  z:2,  g:'G0', note:'aproxima no ar, 2 mm antes da face'},
    {id:'N20', x:0,  z:0,  g:'G1', note:'posiciona no centro da face'},
    {id:'N30', x:20, z:0,  g:'G1'},
    {id:'N40', x:20, z:-25,g:'G1'},
    {id:'N50', x:40, z:-25,g:'G1'},
    {id:'N60', x:40, z:-45,g:'G1'},
    {id:'N70', x:100,z:50, g:'G0', safe:true, note:'recua para o ponto seguro'}
  ],
  hints:[
    'Movimento no ar (aproximação e recuo) sempre G0; qualquer corte é G1.',
    'A aproximação em Z+2 fica ANTES da face: Z positivo.',
    'O último bloco leva a ferramenta para longe: G0 X100 Z50.'
  ]
},
{
  id:13, name:'Perfil Cônico', sub:'Absoluta + incremental com dois cones', modes:['both'], boss:false,
  tip:'Em cone, X e Z mudam na mesma linha. Calcule um de cada vez.',
  brief:'Dois cones e um degrau. Cada cone muda X e Z na mesma linha.',
  pts:[
    {id:'A', x:0,  z:0},
    {id:'B', x:16, z:0},
    {id:'C', x:20, z:-2},
    {id:'D', x:20, z:-15},
    {id:'E', x:34, z:-30},
    {id:'F', x:34, z:-45},
    {id:'G', x:48, z:-52},
    {id:'H', x:48, z:-70},
    {id:'I', x:64, z:-70}
  ],
  hints:[
    'D→E é cone: ΔX = 14 e ΔZ = −15.',
    'F→G é o segundo cone: ΔX = 14 e ΔZ = −7.',
    'A última linha é degrau reto: ΔZ = 0.'
  ]
},
{
  id:14, name:'Programa Completo', sub:'G-code com chanfro, arco e cone', modes:['gcode'], boss:false,
  tip:'Aproxime sempre no ar (G0). Corte reto é G1; corte em arco é G2 (horário) ou G3 (anti-horário) — o raio não vira número na tabela: quem define o arco são a função e o ponto final (absoluto e incremental).',
  brief:'Programa de acabamento inteiro, do ponto seguro até o recuo — agora com um arco de verdade (G2).',
  pts:[
    {id:'N10', x:120,z:50, g:'G0', safe:true, note:'ponto de troca'},
    {id:'N20', x:14, z:2,  g:'G0', note:'aproximação rápida'},
    {id:'N30', x:14, z:0,  g:'G1'},
    {id:'N40', x:20, z:-3, g:'G1', note:'chanfro 3x45°'},
    {id:'N50', x:20, z:-22,g:'G1'},
    {id:'N60', x:32, z:-28,g:'G2', arc:6, note:'arco R6, sentido horário — liga o ø20 ao ø32'},
    {id:'N70', x:32, z:-46,g:'G1'},
    {id:'N80', x:50, z:-55,g:'G1', note:'cone'},
    {id:'N90', x:50, z:-70,g:'G1'},
    {id:'N100',x:120,z:50, g:'G0', safe:true, note:'recuo'}
  ],
  hints:[
    'Blocos N10, N20 e N100 são no ar → G0. Retas cortando são G1; o arco é G2.',
    'O chanfro 3x45° sai de ø14 (=20−6) na face e termina em ø20 Z−3.',
    'N50→N60 é o arco: função G2 (sentido horário). O raio R6 desloca o ponto final 6 mm no raio (12 no diâmetro) e 6 mm em Z — isso já aparece nas colunas de X e Z, absoluto e incremental, como em qualquer outro ponto.',
    'N70→N80 é cone: X vai a 50 enquanto Z vai a −55.'
  ]
},
{
  id:15, name:'Peça de Prova', sub:'CHEFE — tudo junto', modes:['both'], boss:true,
  tip:'Sem pressa: absoluta primeiro, incremental depois, confira as somas.',
  brief:'11 pontos, chanfro, raio, dois cones e degraus. Prove que virou programador.',
  pts:[
    {id:'A', x:0,  z:0},
    {id:'B', x:12, z:0},
    {id:'C', x:18, z:-3},
    {id:'D', x:18, z:-16},
    {id:'E', x:26, z:-16},
    {id:'F', x:32, z:-19, arc:3},
    {id:'G', x:32, z:-38},
    {id:'H', x:46, z:-48},
    {id:'I', x:46, z:-62},
    {id:'J', x:58, z:-68},
    {id:'K', x:58, z:-88}
  ],
  hints:[
    'Chanfro 3x45° na entrada: ø18 − 6 = ø12.',
    'E→F é raio R3: 3 mm no raio (6 no diâmetro) e 3 mm em Z.',
    'Somas de controle: ΣΔX = 58 e ΣΔZ = −88.'
  ]
}
];

/* ---- gerador do Modo Infinito (desbloqueado após a fase 15) ---- */
function makeEndlessLevel(seedRun){
  const R=(a,b,st=1)=> a + st*Math.floor(Math.random()*((b-a)/st+1));
  const run  = Math.max(1, seedRun|0);
  const tier = Math.min(4, Math.floor((run-1)/4));   // sobe a cada 4 rodadas, sem teto na 8
  const ALPHA='ABCDEFGHIJKLMN';

  /* geometria (perfil sempre monotônico) */
  const nGeo = Math.min(12, 5 + Math.floor(run/2) + tier);
  const ch = R(2,3);
  let d = R(12,26,2), z = 0;
  const geo=[{x:0, z:0, note:'centro da face'}];
  geo.push({x:d-2*ch, z:0,   note:`entrada do chanfro ${ch}x45° (ø${d} − 2·${ch})`});
  geo.push({x:d,      z:-ch, note:'fim do chanfro'});
  z = -ch;
  let lastWasStep = true;
  while(geo.length < nGeo){
    const left = nGeo - geo.length;
    if(lastWasStep || left===1){ z -= R(10,26,1); geo.push({x:d, z}); lastWasStep=false; continue; }
    let grow = R(8,16,2);
    if(d+grow > 80) grow = 80-d;
    if(grow < 8){ z -= R(10,20); geo.push({x:d, z}); lastWasStep=false; continue; }
    const roll = Math.random();
    if(tier>=2 && left>=2 && roll<.30){                // raio de concordância (rodada 9+)
      const r = R(2,3);
      geo.push({x:d+grow-2*r, z, note:`início do raio R${r}`});
      d += grow; z -= r;
      geo.push({x:d, z, arc:r, note:`fim do raio R${r}`});
    } else if(tier>=1 && roll<.60){                    // cone (rodada 5+)
      d += grow; z -= R(4,10);
      geo.push({x:d, z, note:'cone'});
    } else {                                           // degrau reto
      d += grow; geo.push({x:d, z});
    }
    lastWasStep = true;
  }
  if(lastWasStep && geo.length<nGeo){ z -= R(10,20); geo.push({x:d, z, note:'fim da peça'}); }

  /* modo: gcode entra no rodízio a partir da rodada 6 */
  const POOL = run<6 ? ['abs','inc','both','abs','inc','both']
                     : ['both','gcode','abs','both','inc','gcode'];
  const modes = [ POOL[run % POOL.length] ];
  const isG   = modes[0]==='gcode';
  const useSafe = isG || (run>=8 && modes[0]!=='inc');

  /* pontos */
  const pts=[];
  if(isG){
    let n=0;
    const blk = o => pts.push(Object.assign({id:'N'+(10*++n)}, o));
    if(useSafe) blk({x:120, z:50, g:'G0', safe:true, note:'ponto de segurança/troca de ferramenta'});
    blk({x:0, z:2, g:'G0', note:'aproximação no ar, 2 mm antes da face'});
    geo.forEach(p => blk(Object.assign({}, p, {g:'G1'})));
    if(useSafe) blk({x:120, z:50, g:'G0', safe:true, note:'recuo para o ponto seguro'});
  } else if(useSafe){
    let n=2;
    pts.push({id:'P1', x:150, z:50, safe:true, note:'ponto de segurança/troca de ferramenta'});
    pts.push({id:'P2', x:geo[1].x, z:3, note:'aproximação ANTES da face → Z positivo'});
    geo.slice(1).forEach(p => pts.push(Object.assign({}, p, {id:'P'+(++n)})));
  } else {
    geo.forEach((p,i) => pts.push(Object.assign({}, p, {id:ALPHA[i]})));
  }

  const nivel = ['aquecimento','com cone','com raio','longa','completa'][tier];
  return {
    id:'inf', name:'Modo Infinito #'+run, sub:MODE_LABEL[modes[0]], modes, endless:true, boss:false, machine:'torno',
    tip: isG ? 'G0 = no ar (aproximação e recuo). G1 = cortando. X continua sendo diâmetro.'
             : 'Peça gerada na hora. Mesma leitura de sempre: X diâmetro, Z negativo para dentro.',
    brief:`Desafio aleatório (${nivel}) — ${pts.length} linhas nesta rodada.`,
    pts,
    hints:[
      'X é diâmetro, Z é o comprimento medido a partir da face (negativo para a esquerda).',
      isG ? 'Aproximação e recuo não cortam nada → G0. Todo bloco que toca material → G1.'
          : 'Degrau reto: um dos dois eixos não muda entre as linhas.',
      useSafe ? 'O ponto de segurança não aparece no desenho: X grande e Z POSITIVO.'
              : (modes[0]==='inc'||modes[0]==='both') ? 'Confira a soma dos incrementais com o último valor absoluto.'
              : 'X é diâmetro, Z negativo para dentro — sem coluna extra aqui.'
    ]
  };
}

/* =========================================================================
   CNC COORDENADAS — dados das fases (FRESA)
   Convenção (vista de topo / plano XY):
     X, Y = posição da fresa no plano da peça (sem diâmetro — é fresamento, não torno)
     Zero-peça = canto de referência da peça (normalmente um canto do bloco)
     Ponto de aproximação (PA) fica FORA da peça, geralmente com X e/ou Y negativos
   Cada ponto: {id, x, z, note?, g?, safe?, arc?} — reaproveita as mesmas chaves do
   torno (x/z), só que aqui x=X e z=Y (rotulados como X/Y na tela pelo game.js).
   ========================================================================= */
const LEVELS_FRESA = [
{
  id:1, name:'Primeiro Contato', sub:'Os eixos X e Y da fresa', modes:['abs'], boss:false,
  tip:'Aqui não existe diâmetro: X e Y são só a posição da fresa no plano da peça.',
  brief:'Vista de cima de uma peça simples, com um degrau. Leia X e Y de cada canto.',
  pts:[
    {id:'A', x:0,  z:0,  note:'quina inicial — canto de referência da peça'},
    {id:'B', x:30, z:0,  note:'andou em X, o Y não mudou'},
    {id:'C', x:30, z:20, note:'subiu em Y, o X não mudou'},
    {id:'D', x:50, z:20, note:'degrau: X avança, Y fica igual'},
    {id:'E', x:50, z:40, note:'fim do contorno'}
  ],
  hints:[
    'De A para B só X muda — a fresa anda reto num lado do contorno.',
    'De B para C só Y muda — é o lado perpendicular.',
    'Em cada canto reto, um dos dois eixos repete o valor do ponto anterior.'
  ]
},
{
  id:2, name:'Canto Cortado', sub:'Corte 4x45° e trecho diagonal', modes:['abs'], boss:false,
  tip:'Corte de canto 4x45°: anda 4 mm em X e 4 mm em Y ao mesmo tempo.',
  brief:'Mesmo tipo de contorno, agora com um canto cortado a 45° e um trecho diagonal.',
  pts:[
    {id:'A', x:0,  z:0},
    {id:'B', x:20, z:0},
    {id:'C', x:24, z:4,  note:'corte de canto 4x45°: 4 mm em X e 4 mm em Y'},
    {id:'D', x:24, z:24},
    {id:'E', x:44, z:44, note:'trecho diagonal — X e Y mudam juntos'},
    {id:'F', x:44, z:60}
  ],
  hints:[
    'B→C é o corte de canto: ΔX = 4 e ΔY = 4, os dois iguais (45°).',
    'D→E é diagonal: X e Y mudam na mesma proporção, 20 e 20.',
    'Comprimento total 60 mm em Y → o último ponto é Y60.'
  ]
},
{
  id:3, name:'Pensando em Δ', sub:'Coordenadas incrementais em X/Y', modes:['inc'], boss:false,
  tip:'Incremental = quanto a fresa ANDOU desde o ponto anterior, em X e em Y.',
  brief:'A mesma leitura de sempre, mas agora você informa o deslocamento desde o ponto anterior.',
  pts:[
    {id:'A', x:0,  z:0},
    {id:'B', x:35, z:0},
    {id:'C', x:35, z:15},
    {id:'D', x:55, z:15},
    {id:'E', x:55, z:35}
  ],
  hints:[
    'O primeiro ponto sai da origem: o incremental é igual ao absoluto.',
    'Se X não muda, ΔX = 0. Se Y não muda, ΔY = 0.',
    'Andar para cima em Y dá ΔY positivo; andar em X dá ΔX positivo.'
  ]
},
{
  id:4, name:'Δ com Canto', sub:'Incremental em contorno com canto cortado', modes:['inc'], boss:false,
  tip:'No canto cortado 4x45°, ΔX vale 4 e ΔY vale 4.',
  brief:'Contorno com canto cortado e degrau — só incrementais.',
  pts:[
    {id:'A', x:0,  z:0},
    {id:'B', x:26, z:0},
    {id:'C', x:30, z:4},
    {id:'D', x:30, z:24},
    {id:'E', x:50, z:24},
    {id:'F', x:50, z:48}
  ],
  hints:[
    'B→C é o canto cortado: ΔX = 4 e ΔY = 4.',
    'D→E é degrau reto: ΔY = 0.',
    'Some todos os ΔY: o resultado tem que dar 48 (altura total).'
  ]
},
{
  id:5, name:'Lado a Lado', sub:'A mesma peça nas duas colunas', modes:['both'], boss:false,
  tip:'X e Y são só posição no plano — as mesmas regras de sempre, agora nas quatro colunas.',
  brief:'A peça da fase 3 de novo — agora com as quatro colunas. Sem canto cortado: só o método.',
  pts:[
    {id:'A', x:0,  z:0,  note:'canto de referência'},
    {id:'B', x:35, z:0,  note:'andou em X, ainda em Y0'},
    {id:'C', x:35, z:15, note:'fim do trecho de 15 mm'},
    {id:'D', x:55, z:15, note:'degrau: sobe X sem mudar Y'},
    {id:'E', x:55, z:35, note:'fim do contorno'}
  ],
  hints:[
    'Absoluta = medida a partir do canto de referência. Incremental = diferença para a linha de cima.',
    'A primeira linha sai da origem, então ΔX = X e ΔY = Y: 35 e 0.',
    'Controle: ΣΔX = 35+0+20+0 = 55 (último X) e ΣΔY = 0+15+0+20 = 35 (último Y).'
  ]
},
{
  id:6, name:'Duas Colunas', sub:'Absoluta e incremental juntas', modes:['both'], boss:false,
  tip:'Confira cada ponto com o desenho: qual X e qual Y ele mostra ali?',
  brief:'Agora as duas tabelas ao mesmo tempo, como na folha de processo.',
  pts:[
    {id:'A', x:0,  z:0},
    {id:'B', x:18, z:0},
    {id:'C', x:22, z:4},
    {id:'D', x:22, z:18},
    {id:'E', x:36, z:32},
    {id:'F', x:36, z:46},
    {id:'G', x:56, z:46}
  ],
  hints:[
    'Absoluta = medida a partir do canto de referência. Incremental = diferença da linha de cima.',
    'D→E é diagonal: muda X e Y ao mesmo tempo.',
    'A última linha é degrau: ΔY = 0, ΔX = 56 − 36 = 20.'
  ]
},
{
  id:7, name:'Raio de Canto', sub:'Corte, raio R3 e degrau', modes:['abs'], boss:false,
  tip:'Num raio R3 o ponto final fica deslocado 3 mm em X e 3 mm em Y — é curva, não corte reto.',
  brief:'Contorno com canto cortado, trecho reto, raio e degrau. Atenção nos pontos do raio.',
  pts:[
    {id:'A', x:0,  z:0},
    {id:'B', x:14, z:0,  note:'entrada do canto cortado 3x45°'},
    {id:'C', x:17, z:3,  note:'fim do canto cortado'},
    {id:'D', x:17, z:20, note:'fim do lado reto'},
    {id:'E', x:23, z:20, note:'início do raio R3'},
    {id:'F', x:26, z:23, arc:3, note:'fim do raio, já em X26'},
    {id:'G', x:26, z:42},
    {id:'H', x:46, z:42}
  ],
  hints:[
    'Canto cortado 3x45° → anda 3 mm em X e 3 mm em Y.',
    'O raio R3 desloca 3 mm em X e 3 mm em Y — é uma curva, não um corte reto.',
    'E→F: X vai de 23 para 26 enquanto Y vai de 20 para 23.'
  ]
},
{
  id:8, name:'Folha de Processo', sub:'Absoluta + incremental, 8 pontos', modes:['both'], boss:false,
  tip:'Confira somando: a soma dos ΔX tem que bater com o último X absoluto.',
  brief:'Contorno longo. Preencha as quatro colunas sem errar o sinal.',
  pts:[
    {id:'A', x:0,  z:0},
    {id:'B', x:24, z:0},
    {id:'C', x:27, z:3},
    {id:'D', x:27, z:25},
    {id:'E', x:41, z:25},
    {id:'F', x:41, z:48},
    {id:'G', x:57, z:56},
    {id:'H', x:57, z:75}
  ],
  hints:[
    'Canto cortado 3x45° na entrada: 27 = 24 + 3.',
    'F→G é diagonal: ΔX = 16 e ΔY = 8.',
    'Soma dos ΔY = 75. Soma dos ΔX = 57.'
  ]
},
{
  id:9, name:'Antes de Aproximar', sub:'Ponto de aproximação e leitura de sinal', modes:['abs'], boss:false,
  tip:'O ponto de aproximação (PA) fica FORA da peça — X e Y bem afastados, geralmente negativos.',
  brief:'Contorno simples. O que é novo aqui são as duas primeiras linhas: o ponto de aproximação e a entrada na peça.',
  pts:[
    {id:'P1', x:-40, z:-40, safe:true, note:'ponto de aproximação — fora da peça, não está no desenho'},
    {id:'P2', x:0,   z:0,   note:'entrou no canto de referência da peça'},
    {id:'P3', x:24,  z:0},
    {id:'P4', x:24,  z:20},
    {id:'P5', x:40,  z:20},
    {id:'P6', x:40,  z:35}
  ],
  hints:[
    'P1 é o ponto de aproximação: bem longe da peça, X e Y negativos → X-40 Y-40.',
    'P2 já é o canto de referência da peça: X0 Y0.',
    'De P3 a P6 é o contorno de sempre: sobe em X, depois em Y, degrau, e mais um trecho.'
  ]
},
{
  id:10, name:'A Peça do Instrutor', sub:'9 pontos + ponto de aproximação', modes:['abs'], boss:false,
  tip:'O ponto de aproximação fica bem longe do contorno: X e Y bem negativos.',
  brief:'Aquela peça de prova: contorno escalonado com cantos cortados e um raio. P1 é o ponto de aproximação.',
  pts:[
    {id:'P1', x:-50, z:-50, safe:true, note:'ponto de aproximação'},
    {id:'P2', x:0,   z:0,   note:'canto de referência da peça'},
    {id:'P3', x:14,  z:0},
    {id:'P4', x:17,  z:3,  note:'fim do canto cortado 3x45°'},
    {id:'P5', x:17,  z:20},
    {id:'P6', x:23,  z:20, note:'início do raio R3'},
    {id:'P7', x:26,  z:23, arc:3, note:'fim do raio R3'},
    {id:'P8', x:26,  z:40},
    {id:'P9', x:40,  z:40, note:'início do canto cortado do degrau final'},
    {id:'P10',x:46,  z:46, note:'fim do canto cortado, 6 mm em X e Y'}
  ],
  hints:[
    'P1 não toca a peça: está bem longe, em X-50 Y-50.',
    'P2 é o canto de referência: X0 Y0.',
    'No canto entre P9 e P10, X e Y andam juntos 6 mm — outro corte a 45°.'
  ]
},
{
  id:11, name:'Cinco Blocos', sub:'Primeiro programa: G0 e G1', modes:['gcode'], boss:false,
  tip:'G0 = no ar, sem cortar. G1 = cortando. Só a aproximação é G0 aqui.',
  brief:'A peça da fase 1, agora escrita como programa. Cinco blocos, um G0 e quatro G1.',
  pts:[
    {id:'N10', x:30, z:-8, g:'G0', note:'aproxima no ar, 8 mm antes de tocar o contorno'},
    {id:'N20', x:30, z:0,  g:'G1', note:'toca o contorno — a partir daqui há material'},
    {id:'N30', x:30, z:20, g:'G1'},
    {id:'N40', x:50, z:20, g:'G1', note:'degrau: sobe em X sem mudar Y'},
    {id:'N50', x:50, z:40, g:'G1', note:'termina os 40 mm de Y'}
  ],
  hints:[
    'Só o primeiro bloco é no ar: N10 é G0, todo o resto é G1.',
    'N10 está 8 mm ANTES do contorno (Y-8) e N20 já toca nele (Y0) — o X não muda, continua 30.',
    'N30→N40 é degrau: Y fica em 20 e X vai de 30 para 50.'
  ]
},
{
  id:12, name:'Escrevendo G-Code', sub:'G0 rápido, G1 usinando', modes:['gcode'], boss:false,
  tip:'G0 = deslocamento rápido, no ar, sem F. G1 = avanço de trabalho, cortando, com F.',
  brief:'Agora vira programa: escolha G0/G1 e preencha X e Y de cada bloco.',
  pts:[
    {id:'N10', x:0,  z:-8, g:'G0', note:'aproxima no ar, 8 mm antes do canto de referência'},
    {id:'N20', x:0,  z:0,  g:'G1', note:'entra no canto de referência'},
    {id:'N30', x:22, z:0,  g:'G1'},
    {id:'N40', x:22, z:26, g:'G1'},
    {id:'N50', x:42, z:26, g:'G1'},
    {id:'N60', x:42, z:48, g:'G1'},
    {id:'N70', x:-60,z:-60,g:'G0', safe:true, note:'recua para longe da peça'}
  ],
  hints:[
    'Movimento no ar (aproximação e recuo) sempre G0; qualquer corte é G1.',
    'A aproximação em Y-8 fica ANTES do contorno.',
    'O último bloco leva a fresa para longe: G0 X-60 Y-60.'
  ]
},
{
  id:13, name:'Perfil com Dois Cantos', sub:'Absoluta + incremental com duas diagonais', modes:['both'], boss:false,
  tip:'Num trecho diagonal, X e Y mudam na mesma linha. Calcule um de cada vez.',
  brief:'Duas diagonais e um degrau. Cada diagonal muda X e Y na mesma linha.',
  pts:[
    {id:'A', x:0,  z:0},
    {id:'B', x:16, z:0},
    {id:'C', x:20, z:4},
    {id:'D', x:20, z:15},
    {id:'E', x:34, z:30},
    {id:'F', x:34, z:45},
    {id:'G', x:48, z:52},
    {id:'H', x:48, z:70},
    {id:'I', x:64, z:70}
  ],
  hints:[
    'D→E é diagonal: ΔX = 14 e ΔY = 15.',
    'F→G é a segunda diagonal: ΔX = 14 e ΔY = 7.',
    'A última linha é degrau reto: ΔY = 0.'
  ]
},
{
  id:14, name:'Programa Completo', sub:'G-code com canto cortado e diagonal', modes:['gcode'], boss:false,
  tip:'Aproxime sempre no ar (G0) até perto da peça e só depois use G1.',
  brief:'Programa de acabamento inteiro, do ponto de aproximação até o recuo.',
  pts:[
    {id:'N10', x:-60,z:-60,g:'G0', safe:true, note:'ponto de aproximação'},
    {id:'N20', x:14, z:-8, g:'G0', note:'aproximação rápida, perto do contorno'},
    {id:'N30', x:14, z:0,  g:'G1'},
    {id:'N40', x:17, z:3,  g:'G1', note:'canto cortado 3x45°'},
    {id:'N50', x:17, z:24, g:'G1'},
    {id:'N60', x:29, z:24, g:'G1'},
    {id:'N70', x:29, z:48, g:'G1'},
    {id:'N80', x:47, z:57, g:'G1', note:'diagonal'},
    {id:'N90', x:47, z:72, g:'G1'},
    {id:'N100',x:-60,z:-60,g:'G0', safe:true, note:'recuo'}
  ],
  hints:[
    'Blocos N10, N20 e N100 são no ar → G0. Todo o resto é G1.',
    'O canto cortado 3x45° soma 3 mm em X e 3 mm em Y.',
    'N70→N80 é diagonal: X vai a 47 enquanto Y vai a 57.'
  ]
},
{
  id:15, name:'Peça de Prova', sub:'CHEFE — tudo junto', modes:['both'], boss:true,
  tip:'Sem pressa: absoluta primeiro, incremental depois, confira as somas.',
  brief:'11 pontos, canto cortado, raio, duas diagonais e degraus. Prove que virou programador de fresa.',
  pts:[
    {id:'A', x:0,  z:0},
    {id:'B', x:12, z:0},
    {id:'C', x:15, z:3},
    {id:'D', x:15, z:16},
    {id:'E', x:23, z:16},
    {id:'F', x:26, z:19, arc:3},
    {id:'G', x:26, z:38},
    {id:'H', x:40, z:48},
    {id:'I', x:40, z:62},
    {id:'J', x:52, z:68},
    {id:'K', x:52, z:88}
  ],
  hints:[
    'Canto cortado 3x45° na entrada: 15 = 12 + 3.',
    'E→F é raio R3: 3 mm em X e 3 mm em Y (curva, não corte reto).',
    'Somas de controle: ΣΔX = 52 e ΣΔY = 88.'
  ]
}
];

/* ---- gerador do Modo Infinito (fresa) — mesma lógica do torno, plano XY ---- */
function makeEndlessLevelFresa(seedRun){
  const R=(a,b,st=1)=> a + st*Math.floor(Math.random()*((b-a)/st+1));
  const run  = Math.max(1, seedRun|0);
  const tier = Math.min(4, Math.floor((run-1)/4));
  const ALPHA='ABCDEFGHIJKLMN';

  const nGeo = Math.min(12, 5 + Math.floor(run/2) + tier);
  const ch = R(2,3);
  let x = R(12,26,2), z = 0;
  const geo=[{x:0, z:0, note:'canto de referência'}];
  geo.push({x:x-ch, z:0,  note:`entrada do canto cortado ${ch}x45° (${x} − ${ch})`});
  geo.push({x:x,    z:ch, note:'fim do canto cortado'});
  z = ch;
  let lastWasStep = true;
  while(geo.length < nGeo){
    const left = nGeo - geo.length;
    if(lastWasStep || left===1){ z += R(10,26,1); geo.push({x, z}); lastWasStep=false; continue; }
    let grow = R(8,16,2);
    if(x+grow > 80) grow = 80-x;
    if(grow < 8){ z += R(10,20); geo.push({x, z}); lastWasStep=false; continue; }
    const roll = Math.random();
    if(tier>=2 && left>=2 && roll<.30){                // raio de canto (rodada 9+)
      const r = R(2,3);
      geo.push({x:x+grow-r, z, note:`início do raio R${r}`});
      x += grow; z += r;
      geo.push({x, z, arc:r, note:`fim do raio R${r}`});
    } else if(tier>=1 && roll<.60){                    // diagonal (rodada 5+)
      x += grow; z += R(4,10);
      geo.push({x, z, note:'diagonal'});
    } else {                                           // degrau reto
      x += grow; geo.push({x, z});
    }
    lastWasStep = true;
  }
  if(lastWasStep && geo.length<nGeo){ z += R(10,20); geo.push({x, z, note:'fim do contorno'}); }

  const POOL = run<6 ? ['abs','inc','both','abs','inc','both']
                     : ['both','gcode','abs','both','inc','gcode'];
  const modes = [ POOL[run % POOL.length] ];
  const isG   = modes[0]==='gcode';
  const useSafe = isG || (run>=8 && modes[0]!=='inc');

  const pts=[];
  if(isG){
    let n=0;
    const blk = o => pts.push(Object.assign({id:'N'+(10*++n)}, o));
    if(useSafe) blk({x:-60, z:-60, g:'G0', safe:true, note:'ponto de aproximação'});
    blk({x:geo[1].x, z:-8, g:'G0', note:'aproximação rápida, perto do contorno'});
    geo.forEach(p => blk(Object.assign({}, p, {g:'G1'})));
    if(useSafe) blk({x:-60, z:-60, g:'G0', safe:true, note:'recuo'});
  } else if(useSafe){
    let n=1;
    pts.push({id:'P1', x:-50, z:-50, safe:true, note:'ponto de aproximação'});
    geo.forEach((p,i) => pts.push(Object.assign({}, p, {id:'P'+(++n)})));
  } else {
    geo.forEach((p,i) => pts.push(Object.assign({}, p, {id:ALPHA[i]})));
  }

  const nivel = ['aquecimento','com diagonal','com raio','longa','completa'][tier];
  return {
    id:'inf', name:'Modo Infinito #'+run, sub:MODE_LABEL_FRESA[modes[0]], modes, endless:true, boss:false, machine:'fresa',
    tip: isG ? 'G0 = no ar (aproximação e recuo). G1 = cortando.'
             : 'Contorno gerado na hora. Mesma leitura de sempre: X e Y no plano, sem diâmetro.',
    brief:`Desafio aleatório (${nivel}) — ${pts.length} linhas nesta rodada.`,
    pts,
    hints:[
      'X e Y são só posição no plano — sem diâmetro.',
      isG ? 'Aproximação e recuo não cortam nada → G0. Todo bloco que toca material → G1.'
          : 'Degrau reto: um dos dois eixos não muda entre as linhas.',
      useSafe ? 'O ponto de aproximação não aparece no desenho: bem longe do contorno, geralmente negativo.'
              : (modes[0]==='inc'||modes[0]==='both') ? 'Confira a soma dos incrementais com o último valor absoluto.'
              : 'X e Y são posição no plano — sem coluna extra aqui.'
    ]
  };
}
