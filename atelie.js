/* =========================================================
   atelie.js — o pintor cuida da galeria de arte digital
   - anda pelo chão deixando pegadas que somem
   - carrega a escada de madeira, sobe e trabalha nas obras lá em cima
   - descansa (…), dorme sentado (💤) e tem pressa quando está
     terminando uma peça (💨); as reações aparecem como emojis
   - clique numa obra: ela abre com zoom e ele vai trabalhar nela
   - clique na parede: ele leva a escada e sobe até lá
   - clique no chão: ele anda até lá
   - o interruptor troca entre tema claro e escuro
   Medidas = pixels do PSD (largura 1080). Tudo roda o tempo todo,
   mesmo que quem visita esteja olhando outra parte da parede.
   ========================================================= */
(() => {
  const cena = document.getElementById('cena');
  const palco = document.getElementById('palco');
  if (!cena || !palco) return;
  const $ = (id) => document.getElementById(id);
  const secao = cena.closest('.atelie');
  const boneco = $('boneco'), sombra = $('sombra'), escadaEl = $('escada');
  const pernaA = $('perna-a'), pernaB = $('perna-b'), tronco = $('tronco');
  const bracoD = $('braco-d'), bracoE = $('braco-e');
  const pegadas = $('pegadas'), rastros = $('rastros'), emojis = $('emojis'), cursor = $('cursor');
  const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let VEL = 1;
  try { VEL = Number(new URLSearchParams(location.search).get('vel')) || 1; } catch (e) {}

  /* ---------- ajustes fáceis de mexer ---------- */
  const W = 1080;
  const ALT = palco.offsetHeight;                 // altura total da parede + chão
  const BASE = ALT - 566;                         // onde começa o PSD original
  const LARGURA_MAX = 1000;                       // largura máxima da cena na tela
  const PES = { x: 95.5, y: 330 };                // ponto entre os pés, dentro do recorte
  const PERNA = 94;                               // comprimento da perna (quadril → pé)
  const ABERTURA = 21;                            // ângulo do passo, em graus
  const CHAO = { xMin: 215, xMax: 1010, yMin: BASE + 515, yMax: BASE + 552 };
  const PE_ESCADA = BASE + 522;                   // onde a escada apoia no chão
  const Y_ESCADA = PE_ESCADA + 6;                 // onde ele fica de pé em frente a ela
  const V_ANDAR = 150, V_CARREGAR = 95, V_SUBIR = 135;   // pixels por segundo
  const ALCANCE = { x: 68, y: 305 };              // onde o pincel chega, em relação aos pés

  const rad = (g) => g * Math.PI / 180;
  const limitar = (v, a, b) => Math.max(a, Math.min(b, v));
  const sorteio = (a, b) => a + Math.random() * (b - a);
  const PASSADA = 2 * PERNA * Math.sin(rad(ABERTURA));

  /* ---------- escala do palco ---------- */
  let k = 1, ox = 0;
  function escalar() {
    const vw = cena.clientWidth;
    k = Math.min(vw, LARGURA_MAX) / W;
    ox = (vw - W * k) / 2;
    cena.style.height = (ALT * k) + 'px';
    palco.style.transform = `translate(${ox}px, 0) scale(${k})`;
  }
  addEventListener('resize', escalar);
  escalar();

  /* ---------- estado ---------- */
  const p = {
    x: 556, y: BASE + 533, dir: 1, dirVis: 1,
    modo: 'esperar', vel: 0,
    fase: 0, abertura: 0, subida: 0, senta: 0,
    bd: 0, be: 0, incl: 0,                  // ângulos atuais dos braços e do tronco
    pinc: 0, pulo: 0, aceno: 0, foco: 0, emFoco: false,
    naEscada: false, carregando: false, ergue: 0,
  };
  const escada = { x: 322 };
  escadaEl.style.height = (PE_ESCADA + 60) + 'px';
  let relogio = 0;                               // tempo da cena, em segundos
  const fila = [];                               // passos que ele ainda vai fazer

  const profundidade = (y) => 0.95 + (limitar(y, CHAO.yMin, CHAO.yMax) - CHAO.yMin) / (CHAO.yMax - CHAO.yMin) * 0.08;
  const escalaAtual = () => profundidade(p.naEscada ? Y_ESCADA : p.y);

  /* ---------- obras (retângulos na parede) ---------- */
  const itens = [...palco.querySelectorAll('.interativo')];
  const caixa = (o) => ({ x: o.offsetLeft, y: o.offsetTop, w: o.offsetWidth, h: o.offsetHeight });
  const itemEm = (m) => itens.find(o => { const c = caixa(o); return m.x > c.x && m.x < c.x + c.w && m.y > c.y && m.y < c.y + c.h; });

  /* ---------- emojis ---------- */
  function emoji(simbolo) {
    const el = document.createElement('span');
    if (simbolo === '…') el.className = 'pontinhos';
    el.textContent = simbolo;
    const s = escalaAtual();
    el.style.left = p.x + 'px';
    el.style.top = (p.y - (PES.y - p.senta * 62) * s - 4) + 'px';
    el.style.setProperty('--vai', sorteio(-26, 26) + 'px');
    el.style.setProperty('--gira', sorteio(-18, 18) + 'deg');
    emojis.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
    el.addEventListener('pointerenter', () => {          // estoura onde estiver
      const cs = getComputedStyle(el);
      el.style.transform = cs.transform; el.style.opacity = cs.opacity;
      el.classList.add('estourou');
    });
  }

  /* ---------- pegadas e tinta ---------- */
  let pe = 1;
  function carimbar(x, y) {
    const img = document.createElement('img');
    img.src = 'img/atelie/pegada.png';
    img.style.left = (x - 32) + 'px';
    img.style.top = (y - 10 + pe * 3) + 'px';
    img.style.transform = `scale(${profundidade(y) * 0.62}) rotate(${sorteio(-4, 4)}deg)`;
    pegadas.appendChild(img);
    img.addEventListener('animationend', () => img.remove());
    pe *= -1;
  }
  function pingarTinta() {
    const s = escalaAtual();
    const m = { x: p.x + p.dir * ALCANCE.x * s, y: p.y - ALCANCE.y * s };
    if (!itemEm(m)) return;
    const img = document.createElement('img');
    img.src = Math.random() < .5 ? 'img/atelie/rastro-1.png' : 'img/atelie/rastro-2.png';
    img.style.left = (m.x - 35 + sorteio(-16, 16)) + 'px';
    img.style.top = (m.y - 30 + sorteio(-16, 16)) + 'px';
    img.style.rotate = sorteio(-30, 30) + 'deg';
    rastros.appendChild(img);
    img.addEventListener('animationend', () => img.remove());
  }

  /* =========================================================
     Planos: listas de passos que ele executa em ordem
     ========================================================= */
  const andar = (x, y) => ({ tipo: 'andar', x: limitar(x, CHAO.xMin, CHAO.xMax), y: limitar(y, CHAO.yMin, CHAO.yMax) });
  const descer = () => (p.naEscada ? [{ tipo: 'subir', y: Y_ESCADA }] : []);

  function planoIr(x, y) { return [...descer(), andar(x, y)]; }

  // trabalhar num ponto da parede: do chão se der, senão leva a escada e sobe
  function planoPintar(tx, ty, dir) {
    const pesY = ty + ALCANCE.y;
    const duracao = sorteio(3.2, 5.5);
    if (pesY >= CHAO.yMin) {
      return [...descer(), andar(tx - dir * ALCANCE.x, pesY), { tipo: 'pintar', dir, dur: duracao }];
    }
    const lx = limitar(tx - dir * ALCANCE.x, 50, W - 50);
    const passos = [];
    if (Math.abs(escada.x - lx) > 10) {
      passos.push(...descer(),
        { tipo: 'andar', x: escada.x, y: Y_ESCADA },
        { tipo: 'pegar' },
        { tipo: 'andar', x: lx, y: Y_ESCADA },
        { tipo: 'soltar' });
    } else if (!p.naEscada) {
      passos.push({ tipo: 'andar', x: escada.x, y: Y_ESCADA });
    }
    passos.push({ tipo: 'subir', y: pesY }, { tipo: 'pintar', dir, dur: duracao });
    return passos;
  }

  function planoSozinho() {
    const r = Math.random();
    if (r < .6) {                                                   // trabalhar numa obra
      const c = caixa(itens[Math.floor(Math.random() * itens.length)]);
      const dir = Math.random() < .5 ? 1 : -1;
      return [...planoPintar(c.x + c.w * sorteio(.3, .7), c.y + c.h * sorteio(.35, .65), dir), { tipo: 'esperar', dur: .6 }];
    }
    if (r < .76) return [{ tipo: 'descansar', dur: sorteio(3.5, 5.5) }];
    if (r < .88) return [...planoIr(sorteio(260, 980), sorteio(CHAO.yMin + 8, CHAO.yMax)), { tipo: 'dormir', dur: sorteio(9, 13) }];
    return [...planoIr(sorteio(CHAO.xMin, CHAO.xMax), sorteio(CHAO.yMin, CHAO.yMax)), { tipo: 'esperar', dur: sorteio(.8, 2) }];
  }

  function ordem(passos) {                       // quem visita mandou: larga o que estava fazendo
    if (p.carregando) { p.carregando = false; escada.x = p.x; }
    fila.length = 0;
    fila.push(...passos);
  }

  /* ---------- execução de cada passo ---------- */
  function iniciar(a) {
    a.t = 0; a.proximo = 0;
    p.modo = a.tipo;
    if (a.tipo === 'pegar') p.dir = escada.x >= p.x ? 1 : -1;
    if (a.tipo === 'pintar') { p.dir = a.dir; a.avisos = 0; }
    if (a.tipo === 'soltar') { p.carregando = false; escada.x = p.x; }
  }

  // devolve true quando o passo terminou
  function atualizar(a, dt) {
    a.t += dt;
    switch (a.tipo) {
      case 'andar': {
        const dx = a.x - p.x, dy = a.y - p.y, dist = Math.hypot(dx, dy);
        if (dist < 1.5) { p.vel = 0; return true; }
        const alvo = Math.min(p.carregando ? V_CARREGAR : V_ANDAR, 30 + dist * 3.2);   // freia ao chegar
        p.vel += (alvo - p.vel) * Math.min(1, dt * 5);                                  // e acelera aos poucos
        const passo = Math.min(dist, p.vel * dt);
        p.x += dx / dist * passo; p.y += dy / dist * passo;
        if (Math.abs(dx) > 2) p.dir = dx > 0 ? 1 : -1;
        const antes = Math.cos(p.fase);
        p.fase += passo / PASSADA * Math.PI;
        if (Math.sign(Math.cos(p.fase)) !== Math.sign(antes)) {       // o pé tocou o chão
          carimbar(p.x + p.dir * PERNA * Math.sin(rad(p.abertura)) * profundidade(p.y) * .9, p.y);
        }
        return false;
      }
      case 'subir': {
        p.x += (escada.x - p.x) * Math.min(1, dt * 10);
        const dy = a.y - p.y;
        if (Math.abs(dy) < 1) { p.y = a.y; p.naEscada = p.y < Y_ESCADA - 1; return true; }
        const passo = Math.min(Math.abs(dy), V_SUBIR * dt);
        p.y += Math.sign(dy) * passo;
        p.fase += passo / 30 * Math.PI;                               // um degrau de cada vez
        p.naEscada = p.y < Y_ESCADA - 1;
        return false;
      }
      case 'pegar':
        if (a.t > .25 && !p.carregando) { p.carregando = true; emoji('💦'); }
        return a.t > .55;
      case 'soltar':
        return a.t > .45;
      case 'pintar': {
        const fim = a.t / a.dur;
        p.pressa = fim > .55;                                         // terminando a peça: pressa
        if (a.t > a.proximo) { pingarTinta(); a.proximo = a.t + sorteio(.35, .7) / (p.pressa ? 1.6 : 1); }
        if (p.pressa && a.avisos === 0) { emoji('💨'); a.avisos = 1; }
        if (fim > .8 && a.avisos === 1) { emoji('💨'); a.avisos = 2; }
        if (fim >= 1) { p.pressa = false; emoji('✨'); return true; }
        return false;
      }
      case 'descansar':
        if (a.t > a.proximo) { emoji('…'); a.proximo = a.t + 1.5; }
        return a.t > a.dur;
      case 'dormir':
        if (a.t > a.proximo + .9) { emoji('💤'); a.proximo = a.t + .5; }
        return a.t > a.dur;
      default:
        return a.t > (a.dur || .5);
    }
  }

  /* ---------- desenho: tudo se mexe em direção à pose da vez ---------- */
  function desenhar(dt) {
    const s = escalaAtual();
    const puxa = (atual, alvo, rapidez) => atual + (alvo - atual) * Math.min(1, dt * rapidez);
    const m = p.modo;
    const anda = m === 'andar', sobe = m === 'subir';

    p.abertura = puxa(p.abertura, anda ? ABERTURA : 0, 9);
    p.subida = puxa(p.subida, sobe ? 1 : 0, 8);
    p.senta = puxa(p.senta, m === 'dormir' ? 1 : 0, 3);
    p.ergue = puxa(p.ergue, p.carregando ? 1 : 0, 7);
    p.foco = puxa(p.foco, p.emFoco ? 1 : 0, 9);
    p.dirVis = puxa(p.dirVis, p.dir, 11);
    p.pulo = puxa(p.pulo, 0, 9);
    if (!anda && !sobe) p.fase = puxa(p.fase, Math.round(p.fase / Math.PI) * Math.PI, 7);   // junta as pernas
    const passo = p.abertura / ABERTURA, onda = Math.sin(p.fase);

    // pernas: tesoura ao andar, alternadas na escada, abertas quando senta
    const ang = p.abertura * onda + p.subida * 11 * onda + p.senta * 72;
    pernaA.style.transform = `rotate(${ang}deg)`;
    pernaB.style.transform = `rotate(${-ang}deg)`;
    const desce = PERNA * (1 - Math.cos(rad(ang)));                  // o quadril baixa: os pés ficam no chão

    // pose-alvo dos braços e do tronco
    let bd = Math.sin(relogio * 1.3) * 2, be = Math.sin(relogio * 1.1) * 2, incl = 0, respira = Math.sin(relogio * 1.8) * 1.1;
    if (anda) { bd = -onda * 16 * passo; be = onda * 12 * passo; incl = 4 + Math.sin(p.fase * 2) * 1.2; respira = 0; }
    if (p.carregando) { bd = -6 + Math.sin(p.fase * 2) * 2; be = 14; incl = 2; }
    if (sobe) { bd = -14 + onda * 22; be = -onda * 18; incl = 1; respira = 0; }
    if (m === 'pintar') {
      p.pinc += dt * (p.pressa ? 17 : 9);
      bd = -8 + Math.sin(p.pinc) * (p.pressa ? 17 : 13); be = Math.sin(p.pinc * .5) * 3;
      incl = 3 + Math.sin(p.pinc * .5) * 1.5; respira = 0;
    }
    if (m === 'descansar') { bd = 92; be = -42; incl = Math.sin(relogio * 1.2); }
    if (m === 'dormir') { bd = 100; be = -50; incl = 9 + Math.sin(relogio * 1.2) * 1.6; respira = Math.sin(relogio * 1.2) * 2; }
    if (p.aceno > 0) { p.aceno -= dt; bd = -25 + Math.sin(relogio * 17) * 22; }
    const rapido = (m === 'pintar' || anda || sobe || p.aceno > 0) ? 16 : 6;
    p.bd = puxa(p.bd, bd, rapido); p.be = puxa(p.be, be, rapido); p.incl = puxa(p.incl, incl, 7);

    tronco.style.transform = `rotate(${p.incl}deg)`;
    bracoD.style.transform = `rotate(${p.bd + p.incl}deg)`;
    bracoE.style.transform = `rotate(${p.be + p.incl}deg)`;

    const quique = Math.abs(Math.sin(p.fase * 2)) * 1.5 * passo + Math.abs(onda) * 2.5 * p.subida;
    const dy = desce - quique - p.pulo + respira;
    const dv = Math.abs(p.dirVis) < .15 ? .15 * Math.sign(p.dirVis || 1) : p.dirVis;         // vira passando "de lado"
    const zoom = 1 + p.foco * .05;
    boneco.style.transform = `translate(${p.x - PES.x}px, ${p.y - PES.y + dy}px) scale(${s * dv * zoom}, ${s * zoom})`;
    sombra.style.transform = `translate(${p.x - 9}px, ${p.y - 347 + dy * .6}px) scale(${s}) skewX(${-p.incl * .6}deg)`;
    sombra.style.opacity = p.naEscada ? .3 : 1;

    // escada: parada no chão ou no ombro dele, levemente inclinada e balançando
    if (p.carregando) escada.x = p.x;
    const balanco = p.ergue * (Math.sin(p.fase) * 1.4 + dv * 2.2);
    escadaEl.style.transform = `translate(${escada.x - 23}px, ${-60 - p.ergue * 12}px) rotate(${balanco}deg)`;
  }

  /* ---------- laço principal ---------- */
  let anterior = performance.now();
  function quadro(t) {
    const dt = Math.min(.05, (t - anterior) / 1000) * VEL;
    anterior = t;
    relogio += dt;
    if (!fila.length) fila.push(...planoSozinho());
    const a = fila[0];
    if (!a.iniciado) { a.iniciado = true; iniciar(a); }
    if (atualizar(a, dt)) { fila.shift(); if (!fila.length) p.modo = 'esperar'; }
    desenhar(dt);
    requestAnimationFrame(quadro);
  }

  /* ---------- interações ---------- */
  const noPalco = (e) => {
    const r = palco.getBoundingClientRect();
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
  };
  const emCimaDele = (m) => {
    const s = escalaAtual();
    return Math.abs(m.x - p.x) < 55 * s && m.y > p.y - (PES.y - p.senta * 62) * s && m.y < p.y + 12;
  };

  let ultimaOlhada = -1e9;
  cena.addEventListener('pointerleave', () => { p.emFoco = false; });
  cena.addEventListener('pointermove', (e) => {
    const m = noPalco(e);
    const r = cena.getBoundingClientRect();
    cursor.style.left = (e.clientX - r.left) + 'px';
    cursor.style.top = (e.clientY - r.top) + 'px';
    p.emFoco = emCimaDele(m);
    const texto = p.emFoco ? 'oi' : itemEm(m) ? 'ver' : m.y > CHAO.yMin - 25 ? 'ir' : 'subir';
    cursor.firstElementChild.textContent = texto;
    cursor.classList.toggle('com-texto', true);

    // mouse chegando perto: ele repara
    const perto = Math.abs(m.x - p.x) < 110 && m.y > p.y - PES.y && m.y < p.y + 20;
    const agora = performance.now();
    if (perto && agora - ultimaOlhada > 5000 && p.modo !== 'dormir') {
      ultimaOlhada = agora;
      emoji('👀');
      if (p.modo === 'esperar' || p.modo === 'descansar') p.dir = m.x > p.x ? 1 : -1;
    }
  });

  palco.addEventListener('click', (e) => {
    if (e.target.closest('.emojis')) return;
    const m = noPalco(e);
    if (emCimaDele(m)) {                                   // clique nele
      p.pulo = 12;
      if (p.modo === 'dormir') { ordem([{ tipo: 'esperar', dur: 1.2 }]); emoji('❗'); }
      else { emoji('👋'); p.aceno = 1.1; }
      return;
    }
    const item = itemEm(m);
    const dir = m.x >= p.x ? 1 : -1;
    if (item) {                                            // clique numa obra: abre e ele vai trabalhar nela
      abrirObra(item);
      const c = caixa(item);
      ordem([...planoPintar(c.x + c.w * .5, c.y + c.h * .5, dir), { tipo: 'esperar', dur: 1 }]);
    } else if (m.y > CHAO.yMin - 25) {                     // clique no chão
      ordem([...planoIr(m.x, m.y), { tipo: 'esperar', dur: 1.5 }]);
    } else {                                               // clique na parede: leva a escada e sobe
      ordem([...planoPintar(m.x, m.y, dir), { tipo: 'esperar', dur: 1 }]);
    }
  });

  /* ---------- interruptor: tema claro / escuro ---------- */
  const interruptor = $('interruptor');
  function tema(escuro, avisar) {
    secao.classList.toggle('escuro', escuro);
    interruptor.setAttribute('aria-pressed', String(escuro));
    try { localStorage.setItem('galeria-tema', escuro ? 'escuro' : 'claro'); } catch (e) {}
    if (avisar && p.modo !== 'dormir') emoji(escuro ? '🌙' : '💡');
  }
  let guardado = null;
  try { guardado = localStorage.getItem('galeria-tema'); } catch (e) {}
  if (guardado === 'escuro') {
    secao.classList.add('sem-transicao');
    tema(true, false);
    requestAnimationFrame(() => requestAnimationFrame(() => secao.classList.remove('sem-transicao')));
  }
  interruptor.addEventListener('click', () => tema(!secao.classList.contains('escuro'), true));

  /* ---------- poeira no facho de luz ---------- */
  const poeira = $('poeira');
  if (poeira && !calmo) for (let i = 0; i < 26; i++) {
    const g = document.createElement('i');
    g.style.left = sorteio(0, 100) + '%';
    g.style.top = sorteio(0, 100) + '%';
    g.style.width = g.style.height = sorteio(1, 2.6) + 'px';
    g.style.setProperty('--d', sorteio(7, 16) + 's');
    g.style.setProperty('--a', -sorteio(0, 12) + 's');
    g.style.setProperty('--x', sorteio(-18, 42) + 'px');
    g.style.setProperty('--y', sorteio(-30, 20) + 'px');
    g.style.setProperty('--o', sorteio(.3, .9).toFixed(2));
    poeira.appendChild(g);
  }

  /* ---------- obra em tela cheia, com zoom saindo do quadro ---------- */
  const fundoZoom = document.createElement('div'); fundoZoom.className = 'zoom-fundo';
  const imgZoom = document.createElement('img'); imgZoom.className = 'zoom-img'; imgZoom.alt = '';
  const textoZoom = document.createElement('div'); textoZoom.className = 'zoom-texto';
  const fecharZoom = document.createElement('button'); fecharZoom.className = 'botao-vidro fechar-zoom';
  fecharZoom.setAttribute('aria-label', 'Fechar');
  fecharZoom.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  let obraAberta = null;
  const CURVA = 'cubic-bezier(.2,.8,.2,1)';

  const imagemDe = (item) => item.querySelector('.obra img') || item.querySelector('img');
  const caixaDe = (item) => (item.querySelector('.obra') || imagemDe(item)).getBoundingClientRect();
  const aplicar = (el, r) => Object.assign(el.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  function retanguloFinal(proporcao) {
    const esc = Math.min(innerWidth * .86 / proporcao, innerHeight * .74);
    const w = proporcao * esc, h = esc;
    return { left: (innerWidth - w) / 2, top: (innerHeight - h) / 2 - 20, width: w, height: h };
  }

  function abrirObra(obra) {
    obraAberta = obra;
    const pequena = imagemDe(obra);
    const ini = caixaDe(obra);
    imgZoom.classList.toggle('recorte', !obra.classList.contains('quadro') && !obra.querySelector('.obra'));
    imgZoom.src = pequena.currentSrc || pequena.src;      // começa com a imagem que já está na tela
    imgZoom.style.transition = 'none';
    imgZoom.style.filter = getComputedStyle(pequena).filter;
    aplicar(imgZoom, ini);
    textoZoom.innerHTML = `<b>${obra.dataset.titulo || ''}</b>${obra.dataset.info || ''}`;
    document.body.append(fundoZoom, imgZoom, textoZoom, fecharZoom);

    const grande = new Image();
    grande.src = obra.dataset.grande || pequena.src;
    let animou = false;
    const animar = () => {
      if (animou) return; animou = true;
      const prop = grande.naturalWidth ? grande.naturalWidth / grande.naturalHeight : ini.width / ini.height;
      const fim = retanguloFinal(prop);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        imgZoom.style.transition = `left .6s ${CURVA}, top .6s ${CURVA}, width .6s ${CURVA}, height .6s ${CURVA}, filter .6s`;
        aplicar(imgZoom, fim);
        imgZoom.style.filter = 'none';
        fundoZoom.classList.add('aberto');
        textoZoom.style.top = (fim.top + fim.height + 14) + 'px';
        textoZoom.classList.add('aberto');
        fecharZoom.classList.add('aberto');
      }));
      if (grande.naturalWidth) imgZoom.src = grande.src;   // troca pela alta resolução
      else grande.addEventListener('load', () => { if (obraAberta === obra) imgZoom.src = grande.src; });
    };
    if (grande.complete && grande.naturalWidth) animar();
    else { grande.addEventListener('load', animar); grande.addEventListener('error', animar); setTimeout(animar, 350); }
  }

  function fecharObra() {
    if (!obraAberta) return;
    aplicar(imgZoom, caixaDe(obraAberta));
    imgZoom.style.filter = getComputedStyle(imagemDe(obraAberta)).filter;
    [fundoZoom, textoZoom, fecharZoom].forEach(el => el.classList.remove('aberto'));
    obraAberta = null;
    setTimeout(() => { if (!obraAberta) [fundoZoom, imgZoom, textoZoom, fecharZoom].forEach(el => el.remove()); }, 600);
  }
  [fundoZoom, imgZoom, fecharZoom].forEach(el => el.addEventListener('click', fecharObra));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharObra(); });

  desenhar(0);
  requestAnimationFrame(quadro);
})();
