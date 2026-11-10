/* =========================================================
   atelie.js — o pintor passeia pelo ateliê
   - anda de verdade (pernas, braços e corpo articulados)
   - cada passo deixa uma pegada que vai sumindo
   - pinta as obras e deixa marcas de tinta nelas
   - reage a quem visita: vira, acena e fala quando o mouse
     chega perto; some e reaparece quando clicam nele
   - clique no chão: ele vai até lá
   - clique numa obra: ele vai até ela e a obra abre com zoom
   Coordenadas = pixels do PSD original (1080 × 566).
   ========================================================= */
(() => {
  const cena = document.getElementById('cena');
  const palco = document.getElementById('palco');
  if (!cena || !palco) return;
  const $ = (id) => document.getElementById(id);
  const boneco = $('boneco'), sombra = $('sombra'), luz = $('luz');
  const pernaA = $('perna-a'), pernaB = $('perna-b'), tronco = $('tronco');
  const bracoD = $('braco-d'), bracoE = $('braco-e');
  const pegadas = $('pegadas'), rastros = $('rastros'), falas = $('falas'), cursor = $('cursor');
  const claro = document.documentElement.classList.contains('atelie-claro');
  const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- ajustes fáceis de mexer ---------- */
  const W = 1080;
  const PES = { x: 95.5, y: 330 };               // ponto entre os pés, dentro do recorte
  const QUADRIL = { x: 107, y: 236 };
  const PERNA = 94;                               // comprimento da perna (quadril → pé)
  const ABERTURA = 21;                            // ângulo máximo do passo, em graus
  const SOMBRA = { dx: 86 - PES.x, dy: -17 - PES.y };
  const CHAO = { xMin: 240, xMax: 1010, yMin: 515, yMax: 552 };
  const VELOCIDADE = 135;                         // pixels por segundo
  const FRASES = ['ei', 'tá secando ainda', 'não encosta', 'gostou?', 'psiu', 'volta mais tarde', 'essa ainda não tá pronta'];

  const rad = (g) => g * Math.PI / 180;
  const PASSADA = 2 * PERNA * Math.sin(rad(ABERTURA));   // distância de um passo

  /* ---------- escala do palco ---------- */
  // escura: cobre a tela inteira (corta as bordas se precisar, sempre mostrando o chão)
  // clara: ocupa a largura da página, sem a parte preta de cima
  let k = 1, ox = 0, oy = 0;
  const H = 566, TOPO_CLARO = 85;
  function escalar() {
    const vw = cena.clientWidth;
    if (claro) {
      k = vw / W; ox = 0; oy = -TOPO_CLARO * k;
      cena.style.height = ((H - TOPO_CLARO) * k) + 'px';
    } else if (innerWidth / innerHeight < 1.2) {        // celular em pé
      k = vw / W; ox = 0; oy = 60;
      cena.style.height = (H * k + 60) + 'px';
    } else {
      cena.style.height = '';
      const vh = cena.clientHeight;
      k = Math.max(vw / W, vh / H);
      ox = (vw - W * k) / 2;
      oy = vh - H * k;                                  // chão sempre embaixo
    }
    palco.style.transform = `translate(${ox}px, ${oy}px) scale(${k})`;
  }
  addEventListener('resize', escalar);
  escalar();

  /* ---------- estado ---------- */
  const p = {
    x: 556, y: 533, dir: 1, dirVis: 1,
    fase: 0, abertura: 0,          // ciclo e amplitude atual do passo
    modo: 'parado', ate: performance.now() + 1200,
    alvo: null, aoChegar: null,
    pulo: 0, aceno: 0, proxRastro: 0, foco: 0, emFoco: false,
  };
  const profundidade = (y) => 0.95 + (y - CHAO.yMin) / (CHAO.yMax - CHAO.yMin) * 0.08;

  /* ---------- desenho do boneco ---------- */
  function desenhar(t) {
    const s = profundidade(p.y);
    // vira devagar (passa pelo "de lado" em vez de espelhar de uma vez)
    p.dirVis += (p.dir - p.dirVis) * 0.18;
    const dv = Math.abs(p.dirVis) < 0.15 ? 0.15 * Math.sign(p.dirVis || 1) : p.dirVis;

    // pernas em tesoura; o corpo desce quando as pernas abrem (pés sempre no chão)
    const ang = p.abertura * Math.sin(p.fase);
    const desce = PERNA * (1 - Math.cos(rad(ang)));
    const sobe = Math.abs(Math.sin(p.fase * 2)) * 1.5 * (p.abertura / ABERTURA);
    p.pulo *= 0.85;
    p.foco += ((p.emFoco ? 1 : 0) - p.foco) * 0.15;
    const zoom = 1 + p.foco * .05;
    const respira = p.modo === 'parado' ? Math.sin(t / 650) * 1.2 : 0;
    const dy = desce - sobe - p.pulo + respira;

    pernaA.style.transform = `rotate(${ang}deg)`;
    pernaB.style.transform = `rotate(${-ang}deg)`;
    // tronco inclina pra frente ao andar e balança um pouco
    const inclina = (p.modo === 'andando' ? 4 : 0) + Math.sin(p.fase * 2) * 1.2 * (p.abertura / ABERTURA)
                  + (p.modo === 'pintando' ? 3 + Math.sin(t / 140) * 1.5 : 0);
    tronco.style.transform = `rotate(${inclina}deg)`;

    // braços: balançam ao andar, pintam, acenam
    let bd = -Math.sin(p.fase) * 14 * (p.abertura / ABERTURA);
    if (p.modo === 'pintando') bd = -8 + Math.sin(t / 85) * 14;
    if (p.aceno > 0) { bd = -25 + Math.sin(t / 60) * 22; p.aceno -= 1; }
    const be = Math.sin(p.fase) * 10 * (p.abertura / ABERTURA) + Math.sin(t / 900) * 2;
    bracoD.style.transform = `rotate(${bd + inclina}deg)`;
    bracoE.style.transform = `rotate(${be + inclina}deg)`;

    boneco.style.transform =
      `translate(${p.x - PES.x}px, ${p.y - PES.y + dy}px) scale(${s * dv * zoom}, ${s * zoom})`;
    sombra.style.transform =
      `translate(${p.x + SOMBRA.dx - 547}px, ${p.y + SOMBRA.dy + dy * .6 - 186}px) scale(${s}) skewX(${-inclina * .6}deg)`;
  }
  sombra.style.left = '547px'; sombra.style.top = '186px';
  boneco.style.left = '0px'; boneco.style.top = '0px';

  /* ---------- pegadas ---------- */
  let pe = 1;
  function carimbar(x, y) {
    const img = document.createElement('img');
    img.src = 'img/atelie/pegada.png';
    const s = profundidade(y) * 0.62;
    img.style.left = (x - 32) + 'px';
    img.style.top = (y - 10 + pe * 3) + 'px';
    img.style.transform = `scale(${s}) rotate(${(Math.random() - .5) * 8}deg)`;
    pegadas.appendChild(img);
    img.addEventListener('animationend', () => img.remove());
    pe *= -1;
  }

  /* ---------- marcas de tinta na obra ---------- */
  const itens = [...palco.querySelectorAll('.interativo')];
  const telas = [...palco.querySelectorAll('.obra')].map(o => ({
    x: o.parentElement.offsetLeft + o.offsetLeft, y: o.parentElement.offsetTop + o.offsetTop, w: o.offsetWidth, h: o.offsetHeight,
  }));
  function pingarTinta() {
    const s = profundidade(p.y);
    const px = p.x + p.dir * (165 - PES.x) * s, py = p.y - (PES.y - 20) * s;
    const alvo = telas.find(o => px > o.x && px < o.x + o.w && py > o.y && py < o.y + o.h);
    if (!alvo) return;
    const img = document.createElement('img');
    img.src = Math.random() < .5 ? 'img/atelie/rastro-1.png' : 'img/atelie/rastro-2.png';
    img.style.left = (px - 35 + (Math.random() - .5) * 30) + 'px';
    img.style.top = (py - 30 + (Math.random() - .5) * 30) + 'px';
    img.style.transform = `scale(${.6 + Math.random() * .5}) rotate(${(Math.random() - .5) * 60}deg)`;
    rastros.appendChild(img);
    img.addEventListener('animationend', () => img.remove());
  }

  /* ---------- comportamento ---------- */
  const lugares = [
    { x: 330, y: 528, olhar: 1 }, { x: 470, y: 533, olhar: 1 }, { x: 620, y: 530, olhar: 1 },
    { x: 770, y: 541, olhar: -1 }, { x: 945, y: 532, olhar: 1 },
  ];
  function irPara(x, y, aoChegar) {
    p.alvo = { x: Math.max(CHAO.xMin, Math.min(CHAO.xMax, x)), y: Math.max(CHAO.yMin, Math.min(CHAO.yMax, y)) };
    p.aoChegar = aoChegar || null;
    p.modo = 'andando';
  }
  function proximaIdeia() {
    if (Math.random() < .75) {
      const l = lugares[Math.floor(Math.random() * lugares.length)];
      irPara(l.x + (Math.random() - .5) * 30, l.y, () => pintar(l.olhar));
    } else {
      irPara(CHAO.xMin + Math.random() * (CHAO.xMax - CHAO.xMin), CHAO.yMin + Math.random() * (CHAO.yMax - CHAO.yMin));
    }
  }
  function pintar(olhar) { p.dir = olhar || p.dir; p.modo = 'pintando'; p.ate = performance.now() + 2500 + Math.random() * 3000; }
  function parar(ms) { p.modo = 'parado'; p.ate = performance.now() + ms; }

  /* ---------- fala ---------- */
  // a palavra nasce na altura da cabeça, sobe devagar e some
  function falar(texto) {
    const el = document.createElement('span');
    el.className = 'palavra';
    el.textContent = texto;
    const s = profundidade(p.y);
    el.style.left = (ox + p.x * k) + 'px';
    el.style.top = (oy + (p.y - PES.y * s * .98) * k) + 'px';
    el.style.setProperty('--balanco', ((Math.random() - .5) * 40) + 'px');
    falas.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
  const frase = () => FRASES[Math.floor(Math.random() * FRASES.length)];

  /* ---------- laço principal ---------- */
  let anterior = performance.now();
  function quadro(t) {
    const dt = Math.min(.05, (t - anterior) / 1000);
    anterior = t;
    const andando = p.modo === 'andando' && p.alvo;

    // abre/fecha o passo suavemente ao começar e parar
    p.abertura += ((andando ? ABERTURA : 0) - p.abertura) * Math.min(1, dt * 9);

    if (andando) {
      const dx = p.alvo.x - p.x, dy = p.alvo.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1.5) {
        p.alvo = null;
        const fn = p.aoChegar; p.aoChegar = null;
        if (fn) fn(); else parar(1000 + Math.random() * 2000);
      } else {
        const passo = Math.min(dist, VELOCIDADE * dt);
        p.x += dx / dist * passo;
        p.y += dy / dist * passo;
        if (Math.abs(dx) > 2) p.dir = dx > 0 ? 1 : -1;
        const antes = Math.cos(p.fase);
        p.fase += passo / PASSADA * Math.PI;
        // o pé toca o chão quando o passo está mais aberto
        if (Math.sign(Math.cos(p.fase)) !== Math.sign(antes)) {
          const s = profundidade(p.y);
          carimbar(p.x + p.dir * PERNA * Math.sin(rad(p.abertura)) * s * .9, p.y);
        }
      }
    } else {
      // recolhe as pernas até ficarem juntas
      p.fase += (Math.round(p.fase / Math.PI) * Math.PI - p.fase) * Math.min(1, dt * 6);
      if (p.modo === 'pintando' && t > p.proxRastro) { pingarTinta(); p.proxRastro = t + 500 + Math.random() * 500; }
      if (p.modo !== 'sumido' && t > p.ate) proximaIdeia();
    }

    if (!calmo) luz.style.opacity = Math.random() < .03 ? (.75 + Math.random() * .2) : 1;
    desenhar(t);
    requestAnimationFrame(quadro);
  }

  /* ---------- interações ---------- */
  const noPalco = (e) => {
    const r = palco.getBoundingClientRect();
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
  };
  const emCimaDele = (m) => {
    const s = profundidade(p.y);
    return Math.abs(m.x - p.x) < 55 * s && m.y > p.y - PES.y * s && m.y < p.y + 12;
  };
  const obraEm = (m) => itens.find(o => m.x > o.offsetLeft && m.x < o.offsetLeft + o.offsetWidth &&
                                        m.y > o.offsetTop && m.y < o.offsetTop + o.offsetHeight);

  let ultimaOlhada = -1e9;
  cena.addEventListener('pointerleave', () => { p.emFoco = false; });
  cena.addEventListener('pointermove', (e) => {
    const m = noPalco(e);
    // cursor
    const r = cena.getBoundingClientRect();
    cursor.style.left = (e.clientX - r.left) + 'px';
    cursor.style.top = (e.clientY - r.top) + 'px';
    p.emFoco = emCimaDele(m);
    const texto = p.emFoco ? 'oi' : obraEm(m) ? 'ver' : m.y > CHAO.yMin - 30 ? 'ir' : '';
    cursor.firstElementChild.textContent = texto;
    cursor.classList.toggle('com-texto', !!texto);

    // chegou perto: ele vira, acena e fala
    const perto = Math.abs(m.x - p.x) < 110 && m.y > p.y - PES.y && m.y < p.y + 20;
    const t = performance.now();
    if (perto && t - ultimaOlhada > 4500 && p.modo !== 'sumido') {
      ultimaOlhada = t;
      p.modo = 'reagindo'; p.alvo = null;
      p.dir = m.x > p.x ? 1 : -1;
      p.pulo = 7; p.aceno = 70;
      p.ate = t + 1800;
      falar(frase());
    }
  });

  palco.addEventListener('click', (e) => {
    const m = noPalco(e);
    // clique nele: some e reaparece em outro lugar
    if (emCimaDele(m)) {
      falar('tchau');
      boneco.classList.add('sumindo'); sombra.style.opacity = 0;
      p.modo = 'sumido'; p.alvo = null;
      setTimeout(() => {
        const l = lugares[Math.floor(Math.random() * lugares.length)];
        p.x = l.x; p.y = l.y;
        boneco.classList.remove('sumindo'); sombra.style.opacity = '';
        p.pulo = 10;
        parar(1400);
      }, 650);
      return;
    }
    // clique numa obra: ele vai até ela e a obra abre
    const obra = obraEm(m);
    if (obra) {
      abrirObra(obra);
      irPara(Number(obra.dataset.alvo) || p.x, 531, () => pintar(1));
      return;
    }
    // clique no chão: ele anda até lá
    irPara(m.x, Math.max(m.y, CHAO.yMin + 8));
  });

  /* ---------- obra em tela cheia, com zoom saindo do quadro ---------- */
  const fundoZoom = document.createElement('div'); fundoZoom.className = 'zoom-fundo';
  const imgZoom = document.createElement('img'); imgZoom.className = 'zoom-img'; imgZoom.alt = '';
  const textoZoom = document.createElement('div'); textoZoom.className = 'zoom-texto';
  const fecharZoom = document.createElement('button'); fecharZoom.className = 'botao-vidro fechar-zoom';
  fecharZoom.setAttribute('aria-label', 'Fechar');
  fecharZoom.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  let obraAberta = null;

  function retanguloFinal(lw, lh) {
    const maxW = innerWidth * .86, maxH = innerHeight * .74;
    const esc = Math.min(maxW / lw, maxH / lh);
    const w = lw * esc, h = lh * esc;
    return { left: (innerWidth - w) / 2, top: (innerHeight - h) / 2 - 20, width: w, height: h };
  }
  function aplicar(el, r) { Object.assign(el.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }); }

  const imagemDe = (item) => item.querySelector('.obra img') || item.querySelector('img');
  const caixaDe = (item) => (item.querySelector('.obra') || imagemDe(item)).getBoundingClientRect();
  function abrirObra(obra) {
    obraAberta = obra;
    const pequena = imagemDe(obra);
    const ini = caixaDe(obra);
    imgZoom.classList.toggle('recorte', !obra.querySelector('.obra'));
    imgZoom.src = pequena.src;                         // começa com a imagem que já está carregada
    aplicar(imgZoom, ini);
    imgZoom.style.transition = 'none';
    imgZoom.style.filter = getComputedStyle(pequena).filter;
    document.body.append(fundoZoom, imgZoom, textoZoom, fecharZoom);
    textoZoom.innerHTML = `<b>${obra.dataset.titulo || ''}</b>${obra.dataset.info || ''}`;

    const grande = new Image();
    grande.src = obra.dataset.grande || pequena.src;
    const proporcao = () => (grande.naturalWidth ? grande.naturalWidth / grande.naturalHeight : ini.width / ini.height);
    const animar = () => {
      const fim = retanguloFinal(proporcao() * 1000, 1000);
      requestAnimationFrame(() => {
        imgZoom.style.transition = 'left .6s cubic-bezier(.2,.8,.2,1), top .6s cubic-bezier(.2,.8,.2,1), width .6s cubic-bezier(.2,.8,.2,1), height .6s cubic-bezier(.2,.8,.2,1), filter .6s';
        aplicar(imgZoom, fim);
        imgZoom.style.filter = 'none';
        fundoZoom.classList.add('aberto');
        textoZoom.style.top = (fim.top + fim.height + 14) + 'px';
        textoZoom.classList.add('aberto');
        fecharZoom.classList.add('aberto');
      });
      // troca pela versão em alta resolução assim que carregar
      if (grande.complete) imgZoom.src = grande.src; else grande.onload = () => { imgZoom.src = grande.src; };
    };
    if (grande.complete && grande.naturalWidth) animar();
    else { grande.onload = animar; grande.onerror = animar; setTimeout(() => { if (!fundoZoom.classList.contains('aberto')) animar(); }, 350); }
  }

  function fecharObra() {
    if (!obraAberta) return;
    const fim = caixaDe(obraAberta);
    aplicar(imgZoom, fim);
    imgZoom.style.filter = getComputedStyle(imagemDe(obraAberta)).filter;
    fundoZoom.classList.remove('aberto');
    textoZoom.classList.remove('aberto');
    fecharZoom.classList.remove('aberto');
    obraAberta = null;
    setTimeout(() => { fundoZoom.remove(); imgZoom.remove(); textoZoom.remove(); fecharZoom.remove(); }, 600);
  }
  [fundoZoom, imgZoom, fecharZoom].forEach(el => el.addEventListener('click', fecharObra));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharObra(); });

  desenhar(performance.now());
  requestAnimationFrame(quadro);
})();
