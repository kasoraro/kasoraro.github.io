/* =========================================================
   kaso · script.js
   1. Capa interativa (a obra reage ao mouse)
   2. Visualizador de imagens (clique em qualquer trabalho)
   3. Filtros da loja
   ========================================================= */

/* ---------- 1. Capa interativa ---------- */
(() => {
  const capa = document.querySelector('.capa');
  if (!capa) return;
  const obra = capa.querySelector('.obra');
  const titulo = capa.querySelector('h1');
  const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (calmo) return;

  capa.addEventListener('pointermove', (e) => {
    const r = capa.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;   // -1 a 1
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    const d = Math.hypot(nx, ny);
    obra.style.transform = `rotateY(${nx * 12}deg) rotateX(${-ny * 12}deg) scale(${1 + d * .03})`;
    // "fantasmas" magenta e azul separando, como erro de impressão
    obra.style.filter =
      `drop-shadow(${nx * 14}px ${ny * 6}px 0 rgba(255,42,157,.55)) ` +
      `drop-shadow(${-nx * 14}px ${-ny * 6}px 0 rgba(43,60,255,.5)) ` +
      `drop-shadow(${nx * 30}px ${30 + ny * 20}px 30px rgba(30,30,50,.35))`;
    const largura = innerWidth < 700 ? .6 : .9;
    titulo.style.letterSpacing = `${largura + Math.abs(nx) * .35}em`;
    titulo.style.transform = `translate(calc(-50% + ${-nx * 18}px), calc(-50% + ${-ny * 18}px))`;
  });

  capa.addEventListener('pointerleave', () => {
    obra.style.transform = '';
    obra.style.filter = '';
    titulo.style.letterSpacing = '';
    titulo.style.transform = '';
  });
})();

/* ---------- 2. Visualizador ---------- */
(() => {
  const itens = [...document.querySelectorAll('[data-galeria] .trabalho:not(.produto)')];
  if (!itens.length) return;

  const visor = document.createElement('div');
  visor.className = 'visor';
  visor.setAttribute('role', 'dialog');
  visor.innerHTML = `
    <button class="fechar" aria-label="Fechar">×</button>
    <button class="anterior" aria-label="Anterior">‹</button>
    <img alt="">
    <div class="texto"></div>
    <button class="proximo" aria-label="Próximo">›</button>`;
  document.body.appendChild(visor);
  const img = visor.querySelector('img');
  const texto = visor.querySelector('.texto');
  let grupo = [], atual = 0;

  function mostrar(i) {
    atual = (i + grupo.length) % grupo.length;
    const el = grupo[atual];
    const foto = el.querySelector('img');
    img.src = foto.src;
    img.alt = foto.alt;
    const t = el.querySelector('h3'), s = el.querySelector('p');
    texto.innerHTML = t ? `<b>${t.textContent}</b>${s ? s.textContent : ''}` : '';
  }
  function abrir(el) {
    grupo = [...el.closest('[data-galeria]').querySelectorAll('.trabalho')];
    mostrar(grupo.indexOf(el));
    visor.classList.add('aberto');
    document.body.style.overflow = 'hidden';
  }
  function fechar() {
    visor.classList.remove('aberto');
    document.body.style.overflow = '';
  }

  itens.forEach(el => el.addEventListener('click', () => abrir(el)));
  visor.querySelector('.fechar').addEventListener('click', fechar);
  visor.querySelector('.anterior').addEventListener('click', () => mostrar(atual - 1));
  visor.querySelector('.proximo').addEventListener('click', () => mostrar(atual + 1));
  visor.addEventListener('click', (e) => { if (e.target === visor) fechar(); });
  addEventListener('keydown', (e) => {
    if (!visor.classList.contains('aberto')) return;
    if (e.key === 'Escape') fechar();
    if (e.key === 'ArrowLeft') mostrar(atual - 1);
    if (e.key === 'ArrowRight') mostrar(atual + 1);
  });
})();

/* ---------- 3. Filtros da loja ---------- */
(() => {
  const botoes = document.querySelectorAll('.filtros button');
  if (!botoes.length) return;
  const produtos = document.querySelectorAll('.produto');
  botoes.forEach(botao => botao.addEventListener('click', () => {
    botoes.forEach(b => b.classList.remove('ativo'));
    botao.classList.add('ativo');
    const f = botao.dataset.filtro;
    produtos.forEach(p => { p.style.display = (f === 'tudo' || p.dataset.tipo === f) ? '' : 'none'; });
  }));
})();
