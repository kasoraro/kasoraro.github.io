/* =========================================================
   atelie.js — o pintor passeia pelo ateliê
   - anda entre as obras e "trabalha" nelas
   - deixa pegadas que vão sumindo
   - reage a quem visita: olha quando o mouse chega perto,
     fala, some e reaparece quando clicam nele
   - clique no chão: ele vai até lá
   - clique numa obra: ele vai até ela e a obra abre grande
   Coordenadas = pixels do PSD original (1080 × 566).
   ========================================================= */
(() => {
  const cena = document.getElementById('cena');
  const palco = document.getElementById('palco');
  if (!cena || !palco) return;
  const pintor = document.getElementById('pintor');
  const sombra = document.getElementById('sombra');
  const luz = document.getElementById('luz');
  const pegadas = document.getElementById('pegadas');
  const fala = document.getElementById('fala');
  const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- ajustes fáceis de mexer ---------- */
  const W = 1080, H = 566;
  const PINTOR = { w: 191, h: 330 };            // tamanho do recorte do pintor
  const SOMBRA = { dx: 86 - 95.5, dy: -17 - 330 }; // posição da sombra em relação aos pés
  const CHAO = { xMin: 240, xMax: 1010, yMin: 515, yMax: 552 };
  const VELOCIDADE = 70;          // pixels por segundo andando
  const PASSO = 30;               // distância entre pegadas
  const FRASES = ['ei', 'tá secando ainda', 'não encosta', 'gostou?', 'psiu', 'volta mais tarde', 'essa ainda não tá pronta'];

  /* ---------- escala do palco ---------- */
  let k = 1;
  function escalar() {
    k = cena.clientWidth / W;
    palco.style.transform = `scale(${k})`;
  }
  addEventListener('resize', escalar);
  escalar();

  /* ---------- estado do pintor ---------- */
  const p = {
    x: 556, y: 533,           // pés (começa onde está no PSD)
    dir: 1,                   // 1 = virado pra direita, -1 = esquerda
    fase: 0,                  // ciclo da caminhada
    modo: 'parado',
    ate: performance.now() + 1500,
    alvo: null,
    aoChegar: null,
    andado: 0,
    pe: 1,
    pulo: 0,
  };

  function escalaProfundidade(y) { return 0.95 + (y - CHAO.yMin) / (CHAO.yMax - CHAO.yMin) * 0.08; }

  function desenhar(t) {
    const s = escalaProfundidade(p.y);
    const andando = p.modo === 'andando';
    const balanco = andando ? Math.abs(Math.sin(p.fase)) * 4 : Math.sin(t / 600) * 1.2;   // sobe e desce
    const inclina = andando ? Math.sin(p.fase) * 2.2 : p.modo === 'pintando' ? 3 * p.dir + Math.sin(t / 90) * 1.5 : 0;
    const respira = p.modo === 'parado' ? 1 + Math.sin(t / 700) * .008 : 1;
    p.pulo *= 0.88;
    const left = p.x - PINTOR.w / 2, top = p.y - PINTOR.h - balanco - p.pulo;
    pintor.style.left = left + 'px';
    pintor.style.top = top + 'px';
    pintor.style.transform = `scale(${s * p.dir}, ${s * respira}) rotate(${inclina * p.dir}deg)`;
    sombra.style.left = (p.x + SOMBRA.dx) + 'px';
    sombra.style.top = (p.y + SOMBRA.dy - balanco * .5) + 'px';
    sombra.style.transform = `scale(${s}) skewX(${-inclina}deg)`;
  }

  /* ---------- pegadas ---------- */
  function carimbar() {
    const img = document.createElement('img');
    img.src = 'img/atelie/pegada.png';
    const lado = p.pe * 6;
    img.style.left = (p.x - 29 + p.dir * 6) + 'px';
    img.style.top = (p.y - 9 + lado) + 'px';
    img.style.transform = `scale(${escalaProfundidade(p.y) * .8})`;
    pegadas.appendChild(img);
    img.addEventListener('animationend', () => img.remove());
    p.pe *= -1;
  }

  /* ---------- comportamento ---------- */
  const lugares = [
    { x: 330, y: 528, olhar: 1 },
    { x: 560, y: 530, olhar: 1 },
    { x: 770, y: 540, olhar: -1 },
    { x: 945, y: 532, olhar: 1 },
  ];

  function irPara(x, y, aoChegar) {
    p.alvo = { x: Math.max(CHAO.xMin, Math.min(CHAO.xMax, x)), y: Math.max(CHAO.yMin, Math.min(CHAO.yMax, y)) };
    p.aoChegar = aoChegar || null;
    p.modo = 'andando';
  }

  function proximaIdeia() {
    if (Math.random() < .7) {
      const l = lugares[Math.floor(Math.random() * lugares.length)];
      irPara(l.x + (Math.random() - .5) * 40, l.y, () => pintar(l.olhar));
    } else {
      irPara(CHAO.xMin + Math.random() * (CHAO.xMax - CHAO.xMin), CHAO.yMin + Math.random() * (CHAO.yMax - CHAO.yMin));
    }
  }

  function pintar(olhar) {
    p.dir = olhar || p.dir;
    p.modo = 'pintando';
    p.ate = performance.now() + 2500 + Math.random() * 2500;
  }

  function parar(ms) {
    p.modo = 'parado';
    p.ate = performance.now() + ms;
  }

  /* ---------- fala ---------- */
  let tempoFala;
  function falar(texto) {
    fala.textContent = texto;
    const s = escalaProfundidade(p.y);
    fala.style.left = (p.x * k) + 'px';
    fala.style.top = ((p.y - PINTOR.h * s * .95) * k) + 'px';
    fala.classList.add('visivel');
    clearTimeout(tempoFala);
    tempoFala = setTimeout(() => fala.classList.remove('visivel'), 1800);
  }
  const frase = () => FRASES[Math.floor(Math.random() * FRASES.length)];

  /* ---------- laço principal ---------- */
  let anterior = performance.now();
  function quadro(t) {
    const dt = Math.min(.05, (t - anterior) / 1000);
    anterior = t;

    if (p.modo === 'andando' && p.alvo) {
      const dx = p.alvo.x - p.x, dy = p.alvo.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 2) {
        p.alvo = null;
        const fn = p.aoChegar; p.aoChegar = null;
        if (fn) fn(); else parar(1200 + Math.random() * 2000);
      } else {
        const passo = Math.min(dist, VELOCIDADE * dt);
        p.x += dx / dist * passo;
        p.y += dy / dist * passo;
        if (Math.abs(dx) > 1) p.dir = dx > 0 ? 1 : -1;
        p.fase += passo * .11;
        p.andado += passo;
        if (p.andado >= PASSO) { p.andado = 0; carimbar(); }
      }
    } else if ((p.modo === 'parado' || p.modo === 'pintando' || p.modo === 'reagindo') && t > p.ate) {
      proximaIdeia();
    }

    // a luz do projetor dá umas piscadas
    if (!calmo) luz.style.opacity = Math.random() < .03 ? (.75 + Math.random() * .2) : 1;

    desenhar(t);
    requestAnimationFrame(quadro);
  }

  /* ---------- interações ---------- */
  const noPalco = (e) => {
    const r = palco.getBoundingClientRect();
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
  };

  // mouse perto: ele para e olha
  let ultimaOlhada = 0;
  cena.addEventListener('pointermove', (e) => {
    const m = noPalco(e);
    const perto = Math.abs(m.x - p.x) < 90 && m.y > p.y - PINTOR.h && m.y < p.y + 20;
    const t = performance.now();
    if (perto && t - ultimaOlhada > 4000 && p.modo !== 'reagindo') {
      ultimaOlhada = t;
      p.modo = 'reagindo';
      p.alvo = null;
      p.dir = m.x > p.x ? 1 : -1;
      p.pulo = 6;
      p.ate = t + 1600;
      falar(frase());
    }
  });

  // clique nele: some e reaparece em outro lugar
  pintor.addEventListener('click', (e) => {
    e.stopPropagation();
    falar('tchau');
    pintor.classList.add('sumindo');
    sombra.style.opacity = 0;
    p.modo = 'reagindo';
    p.alvo = null;
    p.ate = performance.now() + 99999;
    setTimeout(() => {
      const l = lugares[Math.floor(Math.random() * lugares.length)];
      p.x = l.x; p.y = l.y;
      pintor.classList.remove('sumindo');
      sombra.style.opacity = '';
      for (let i = 0; i < 4; i++) setTimeout(() => { p.pe = (i % 2) ? 1 : -1; carimbar(); }, i * 90);
      parar(1500);
    }, 700);
  });

  // clique numa obra: ele vai até ela e a obra abre grande
  palco.querySelectorAll('.obra').forEach(obra => {
    obra.addEventListener('click', (e) => {
      e.stopPropagation();
      const alvo = Number(obra.dataset.alvo) || p.x;
      irPara(alvo, 530, () => { pintar(1); abrirObra(obra); });
    });
  });

  // clique no chão (ou em qualquer lugar): ele anda até lá
  palco.addEventListener('click', (e) => {
    const m = noPalco(e);
    irPara(m.x, m.y > CHAO.yMin ? m.y : CHAO.yMin + 10);
  });

  /* ---------- obra em tela cheia ---------- */
  const visor = document.createElement('div');
  visor.className = 'visor';
  visor.innerHTML = '<button class="fechar" aria-label="Fechar">×</button><img alt=""><div class="texto"></div>';
  document.body.appendChild(visor);
  function abrirObra(obra) {
    const img = obra.querySelector('img');
    visor.querySelector('img').src = img.src;
    visor.querySelector('img').alt = img.alt;
    visor.querySelector('.texto').innerHTML = `<b>${obra.dataset.titulo || ''}</b>${obra.dataset.info || ''}`;
    visor.classList.add('aberto');
  }
  const fechar = () => visor.classList.remove('aberto');
  visor.addEventListener('click', fechar);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });

  desenhar(performance.now());
  requestAnimationFrame(quadro);
})();
