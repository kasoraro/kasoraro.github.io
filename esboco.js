/* =========================================================
   esboco.js — faz o site parecer um caderno desenhado a lápis
   - Desenha bordas, sublinhados e círculos "tortos" em volta
     de tudo que tiver o atributo data-esboco.
   - Na página inicial (body com data-abertura), um homenzinho
     aparece e desenha a página antes dela ficar interativa.
   Tipos de data-esboco:
     caixa      → moldura em volta do elemento
     linha      → linha embaixo do elemento
     sublinhado → risco ondulado embaixo (links, palavras)
     circulo    → círculo rabiscado em volta
     escrita    → o texto vai "sendo escrito" da esquerda pra direita
   ========================================================= */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const reduzirMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const html = document.documentElement;
  const sorteio = (a) => (Math.random() * 2 - 1) * a;
  const quadro = () => new Promise(requestAnimationFrame);
  const espera = (ms) => new Promise(r => setTimeout(r, ms));

  /* ---------- Geração dos traços tortos ---------- */
  function curva(x1, y1, x2, y2, j) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const k = Math.min(j, dist * 0.04 + 0.5);
    return ` C ${x1 + (x2 - x1) * .3 + sorteio(k)} ${y1 + (y2 - y1) * .3 + sorteio(k)}, ` +
           `${x1 + (x2 - x1) * .7 + sorteio(k)} ${y1 + (y2 - y1) * .7 + sorteio(k)}, ${x2} ${y2}`;
  }

  function caminhoPorPontos(pontos, j) {
    let d = `M ${pontos[0][0]} ${pontos[0][1]}`;
    for (let i = 1; i < pontos.length; i++) {
      d += curva(pontos[i - 1][0], pontos[i - 1][1], pontos[i][0], pontos[i][1], j);
    }
    return d;
  }

  const formas = {
    caixa(r) {
      const p = 6, j = 3;
      const x0 = r.x - p, y0 = r.y - p, x1 = r.x + r.w + p, y1 = r.y + r.h + p;
      const canto = (x, y, a = 2.5) => [x + sorteio(a), y + sorteio(a)];
      // duas voltas contínuas, com um leve "passar do ponto" no fim
      const pts = [
        canto(x0 - 4, y0), canto(x1, y0), canto(x1, y1), canto(x0, y1), canto(x0, y0 - 3),
        canto(x1 + 3, y0 + 1, 3.5), canto(x1 - 1, y1 + 2, 3.5), canto(x0 + 2, y1 - 1, 3.5), canto(x0 + 1, y0 + 8, 3.5),
      ];
      return caminhoPorPontos(pts, j);
    },
    regua(r) { // linha no topo do elemento
      return caminhoPorPontos([[r.x, r.y + sorteio(1)], [r.x + r.w * .5, r.y + sorteio(2)], [r.x + r.w, r.y + sorteio(1.5)]], 2);
    },
    linha(r) {
      const y = r.y + r.h;
      return caminhoPorPontos([[r.x, y + sorteio(1)], [r.x + r.w * .5, y + sorteio(2)], [r.x + r.w, y + sorteio(1.5)]], 2);
    },
    sublinhado(r) {
      const y = r.y + r.h + 3;
      return caminhoPorPontos([
        [r.x - 4, y + sorteio(1)], [r.x + r.w * .55, y + 2 + sorteio(1.5)], [r.x + r.w + 5, y - 1],
        [r.x + r.w * .4, y + 5 + sorteio(1)], [r.x + r.w * .1, y + 4],
      ], 2.5);
    },
    circulo(r) {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const rx = r.w / 2 + 16, ry = r.h / 2 + 12;
      const pts = [];
      const inicio = -Math.PI * .8;
      for (let i = 0; i <= 28; i++) { // pouco mais de uma volta
        const a = inicio + (i / 24) * Math.PI * 2;
        const f = 1 + sorteio(.025) + (i > 23 ? (i - 23) * .025 : 0);
        pts.push([cx + Math.cos(a) * rx * f, cy + Math.sin(a) * ry * f]);
      }
      return caminhoPorPontos(pts, 1.2);
    },
    escrita(r) {
      // caminho invisível em zigue-zague: é por onde o lápis "escreve"
      const amp = Math.min(r.h * .4, 55), per = Math.max(28, amp * .9);
      const cy = r.y + r.h / 2;
      const pts = [[r.x, cy]];
      let lado = -1;
      for (let x = r.x + per / 2; x < r.x + r.w; x += per / 2) {
        pts.push([x, cy + lado * amp * (.7 + Math.random() * .3)]);
        lado *= -1;
      }
      pts.push([r.x + r.w, cy]);
      return caminhoPorPontos(pts, 4);
    },
  };

  /* ---------- Camada SVG por cima da página ---------- */
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'camada-esboco');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `
    <defs>
      <filter id="grafite" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="ruido"/>
        <feDisplacementMap in="SourceGraphic" in2="ruido" scale="1.6"/>
      </filter>
    </defs>
    <g class="tracos" filter="url(#grafite)"></g>`;
  const grupoTracos = svg.querySelector('.tracos');

  const itens = [];

  function retangulo(el) {
    const b = el.getBoundingClientRect();
    return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height };
  }

  function criarItem(el) {
    const tipo = el.dataset.esboco;
    const caminho = document.createElementNS(NS, 'path');
    caminho.setAttribute('class', 'traco traco-' + tipo);
    grupoTracos.appendChild(caminho);
    const item = { el, tipo, caminho, desenhado: false, soHover: el.hasAttribute('data-so-hover') };
    gerar(item);
    caminho.style.strokeDashoffset = item.comp; // começa "apagado"
    if (item.soHover) caminho.style.opacity = 0;
    itens.push(item);
    return item;
  }

  function gerar(item) {
    if (!item.el.getClientRects().length) { // elemento escondido (ex.: filtro da loja)
      item.caminho.setAttribute('d', '');
      item.comp = 0;
      return;
    }
    item.caminho.setAttribute('d', formas[item.tipo](retangulo(item.el)));
    item.comp = item.caminho.getTotalLength();
    item.caminho.style.strokeDasharray = `${item.comp} ${item.comp}`;
  }

  function ajustarCamada() {
    svg.setAttribute('width', document.documentElement.scrollWidth);
    svg.setAttribute('height', document.documentElement.scrollHeight);
  }

  function desenharRapido(item, duracao = 700) {
    if (item.desenhado) return;
    item.desenhado = true;
    revelar(item);
    item.caminho.style.transition = `stroke-dashoffset ${duracao}ms ease-out`;
    item.caminho.getBoundingClientRect(); // força o navegador a aplicar o estado inicial
    item.caminho.style.strokeDashoffset = 0;
  }

  function revelar(item) {
    item.el.classList.add('revelado');
    if (item.tipo === 'escrita') item.el.style.clipPath = '';
  }

  /* ---------- Rabiscar de novo ao passar o mouse ---------- */
  function ativarHover(item) {
    const alvo = item.el.closest('a, button, .peca') || item.el;
    if (!alvo.matches('a, button, .peca')) return;
    alvo.addEventListener('mouseenter', () => {
      if (!item.desenhado && !item.soHover) return;
      gerar(item);
      item.caminho.style.transition = 'none';
      item.caminho.style.strokeDashoffset = item.comp;
      item.caminho.style.opacity = 1;
      item.caminho.getBoundingClientRect();
      item.caminho.style.transition = 'stroke-dashoffset 280ms ease-out';
      item.caminho.style.strokeDashoffset = 0;
    });
    if (item.soHover) alvo.addEventListener('mouseleave', () => { item.caminho.style.opacity = 0; });
  }

  /* =========================================================
     O homenzinho de grafite
     Coordenadas locais: a ponta do lápis fica em (0,0)
     e o corpo fica à direita.
     ========================================================= */
  function criarHomem() {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'homem');
    g.setAttribute('filter', 'url(#grafite)');
    // cabeça rabiscada
    const cab = [];
    for (let i = 0; i <= 13; i++) {
      const a = (i / 12) * Math.PI * 2;
      cab.push([52 + Math.cos(a) * 11 + sorteio(.8), -84 + Math.sin(a) * 12 + sorteio(.8)]);
    }
    g.innerHTML = `
      <g transform="translate(0 26)">
        <path class="h-parte" d="${caminhoPorPontos(cab, 1.5)}"/>
        <path class="h-parte" d="M43 -90 q4 -9 10 -7 q5 -6 10 1 q2 4 -1 6 M46 -93 l3 -4 M56 -95 l2 -4"/>
        <path class="h-parte h-olho" d="M47 -85 l0.5 1.5 M55 -85 l0.5 1.5"/>
        <path class="h-parte" d="M48 -78 q4 2.5 7 0"/>
        <path class="h-parte h-tronco" d="M52 -72 C 53 -58, 55 -42, 55 -26"/>
        <path class="h-parte h-braco2" d=""/>
        <path class="h-parte h-perna1" d=""/>
        <path class="h-parte h-perna2" d=""/>
      </g>
      <path class="h-parte h-braco" d=""/>
      <line class="h-lapis" x1="3" y1="-3" x2="20" y2="-20"/>
      <line class="h-ponta" x1="0" y1="0" x2="3.5" y2="-3.5"/>`;
    g.querySelectorAll('path, line').forEach(p => p.setAttribute('pathLength', '1'));
    svg.appendChild(g);

    const braco = g.querySelector('.h-braco'), braco2 = g.querySelector('.h-braco2');
    const perna1 = g.querySelector('.h-perna1'), perna2 = g.querySelector('.h-perna2');
    const escala = innerWidth < 640 ? .75 : 1;
    const estado = { x: 0, y: 0, dir: 1, passo: 0, tempo: 0 };

    function pose(andando, rabiscando) {
      estado.tempo += 1;
      const t = estado.tempo;
      const s = Math.sin(estado.passo);
      // pernas
      const pa = andando ? s * 10 : Math.sin(t * .05) * 1.5;
      perna1.setAttribute('d', `M55 -26 Q ${52 + pa * .5} -6, ${48 + pa} 14`);
      perna2.setAttribute('d', `M55 -26 Q ${58 - pa * .5} -6, ${62 - pa} 14`);
      // braço do lápis (cotovelo tremendo quando rabisca)
      const ex = rabiscando ? sorteio(2) : 0, ey = rabiscando ? sorteio(2) : 0;
      braco.setAttribute('d', `M52 -38 Q ${30 + ex} ${-34 + ey}, 18 -18`);
      // outro braço balança
      const bb = andando ? -s * 8 : Math.sin(t * .04) * 2;
      braco2.setAttribute('d', `M52 -64 Q ${64 + bb * .4} -50, ${66 + bb} -34`);
    }

    function posicionar(x, y, andando, rabiscando) {
      const dx = x - estado.x;
      if (Math.abs(dx) > .8) estado.dir = dx > 0 ? -1 : 1; // vira o corpo pro lado certo
      if (andando || Math.abs(dx) > .5) estado.passo += Math.min(Math.hypot(dx, y - estado.y) * .09, .5);
      estado.x = x; estado.y = y;
      const pulo = andando ? -Math.abs(Math.sin(estado.passo)) * 4 : 0;
      g.setAttribute('transform', `translate(${x} ${y + pulo}) scale(${estado.dir * escala} ${escala})`);
      pose(andando, rabiscando);
    }

    async function aparecer() {
      g.classList.add('surgindo');
      await quadro();
      g.classList.add('visivel');
      await espera(700);
    }

    async function andarAte(x, y, vel = 1500) {
      const x0 = estado.x, y0 = estado.y;
      const dur = Math.max(120, Math.hypot(x - x0, y - y0) / vel * 1000);
      const t0 = performance.now();
      while (true) {
        if (abortar) return;
        const k = Math.min(1, (performance.now() - t0) / dur);
        const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        posicionar(x0 + (x - x0) * e, y0 + (y - y0) * e, true, false);
        if (k === 1) break;
        await quadro();
      }
    }

    async function tracar(item, vel) {
      const t0 = performance.now();
      const dur = item.comp / vel * 1000;
      const ret = item.tipo === 'escrita' ? retangulo(item.el) : null;
      if (item.tipo !== 'escrita') revelar(item);
      while (true) {
        if (abortar) return;
        const k = Math.min(1, (performance.now() - t0) / dur);
        const l = item.comp * k;
        const p = item.caminho.getPointAtLength(l);
        item.caminho.style.strokeDashoffset = item.comp - l;
        if (ret) {
          const pct = Math.max(0, Math.min(100, (p.x - ret.x) / ret.w * 100));
          item.el.classList.add('revelado');
          item.el.style.clipPath = `polygon(-40px -40px, calc(${pct}% + 6px) -40px, calc(${pct}% + 6px) calc(100% + 40px), -40px calc(100% + 40px))`;
        }
        posicionar(p.x, p.y, false, true);
        if (k === 1) break;
        await quadro();
      }
      item.desenhado = true;
      if (ret) item.el.style.clipPath = '';
    }

    async function sair() {
      const destino = scrollX + innerWidth + 120;
      await andarAte(destino, estado.y, 1300);
      g.remove();
    }

    return { g, posicionar, aparecer, andarAte, tracar, sair, estado };
  }

  /* ---------- Abertura: o homem desenha a página ---------- */
  let abortar = false;
  const velocidades = { escrita: 3400, caixa: 1800, circulo: 1100, sublinhado: 800, linha: 2200, regua: 2200 };

  async function abertura(alvos) {
    scrollTo(0, 0);
    const pular = document.createElement('button');
    pular.className = 'pular';
    pular.textContent = 'pular ›';
    document.body.appendChild(pular);

    const homem = criarHomem();
    pular.addEventListener('click', () => { abortar = true; });

    const primeiro = alvos[0].caminho.getPointAtLength(0);
    homem.estado.x = primeiro.x + 40;
    homem.posicionar(primeiro.x + 40, primeiro.y + 30, false, false);
    await homem.aparecer();

    for (const item of alvos) {
      if (abortar) break;
      const ini = item.caminho.getPointAtLength(0);
      await homem.andarAte(ini.x, ini.y);
      await homem.tracar(item, velocidades[item.tipo] || 1200);
    }
    if (!abortar) await homem.sair();

    // termina tudo que faltou (caso tenha clicado em "pular")
    homem.g.remove();
    alvos.forEach(item => {
      revelar(item);
      item.desenhado = true;
      item.caminho.style.transition = 'stroke-dashoffset 400ms ease-out';
      item.caminho.style.strokeDashoffset = 0;
    });
    pular.remove();
    html.classList.remove('abrindo');
    try { sessionStorage.setItem('abertura-vista', '1'); } catch (e) {}
  }

  /* ---------- Início ---------- */
  async function iniciar() {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    document.body.appendChild(svg);
    ajustarCamada();

    document.querySelectorAll('[data-esboco]').forEach(el => {
      const item = criarItem(el);
      ativarHover(item);
    });

    const visiveis = itens.filter(i => !i.soHover && retangulo(i.el).y < innerHeight - 20);
    const temAbertura = html.classList.contains('abrindo') && !reduzirMovimento;

    if (temAbertura) {
      await abertura(visiveis);
    } else {
      html.classList.remove('abrindo');
      visiveis.forEach((item, n) => setTimeout(() => desenharRapido(item), n * 60));
    }

    // o resto vai se desenhando conforme a pessoa rola a página
    const observador = new IntersectionObserver(entradas => {
      entradas.forEach(e => {
        if (!e.isIntersecting) return;
        const item = itens.find(i => i.el === e.target);
        if (item && !item.soHover) desenharRapido(item);
        observador.unobserve(e.target);
      });
    }, { threshold: .2 });
    itens.filter(i => !i.desenhado && !i.soHover).forEach(i => observador.observe(i.el));
  }

  // se a página mudar de tamanho ou de layout, redesenha tudo no lugar certo
  function redesenhar() {
    ajustarCamada();
    itens.forEach(item => {
      gerar(item);
      item.caminho.style.transition = 'none';
      item.caminho.style.strokeDashoffset = item.desenhado ? 0 : item.comp;
    });
  }
  window.redesenharEsboco = redesenhar;
  let tempoResize;
  addEventListener('resize', () => {
    clearTimeout(tempoResize);
    tempoResize = setTimeout(redesenhar, 150);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
