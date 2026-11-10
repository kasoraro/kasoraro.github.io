/* =========================================================
   kaso · script.js
   1. Menu com a aba atual marcada
   2. Visualizador de imagens (clique em qualquer trabalho)
   3. Filtros da loja
   ========================================================= */

/* ---------- 1. Menu: pílula que marca a aba atual ---------- */
(() => {
  const abas = document.querySelector('.abas');
  if (!abas) return;
  const links = [...abas.querySelectorAll('a')];
  const marcador = document.createElement('span');
  marcador.className = 'marcador';
  abas.appendChild(marcador);
  abas.classList.add('com-marcador');

  function marcar(link, animar = true) {
    if (!link) return;
    links.forEach(l => l.classList.toggle('ativo', l === link));
    marcador.style.transition = animar ? '' : 'none';
    marcador.style.left = link.offsetLeft + 'px';
    marcador.style.width = link.offsetWidth + 'px';
  }
  const ativo = () => links.find(l => l.classList.contains('ativo'));
  marcar(ativo(), false);

  // na página inicial, a marcação acompanha a seção visível
  const internos = links.filter(l => l.getAttribute('href').startsWith('#'));
  const secoes = internos.map(l => document.querySelector(l.getAttribute('href'))).filter(Boolean);
  if (secoes.length) {
    const atualizar = () => {
      let atual = secoes[0];
      secoes.forEach(s => { if (s.getBoundingClientRect().top < innerHeight * .35) atual = s; });
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) atual = secoes[secoes.length - 1];
      const link = internos.find(l => l.getAttribute('href') === '#' + atual.id);
      if (link !== ativo()) marcar(link);
    };
    addEventListener('scroll', atualizar, { passive: true });
    atualizar();
  }

  // na loja, o menu filtra os produtos (roupas, acessórios, quadros)
  if (abas.dataset.menu === 'loja') {
    const produtos = document.querySelectorAll('.produto');
    const filtrar = (animar = true) => {
      const filtro = (location.hash || '#tudo').slice(1);
      const link = links.find(l => l.getAttribute('href') === '#' + filtro) || links[0];
      marcar(link, animar);
      produtos.forEach(p => { p.style.display = (filtro === 'tudo' || p.dataset.tipo === filtro) ? '' : 'none'; });
    };
    links.forEach(l => l.addEventListener('click', (e) => {
      e.preventDefault();
      history.replaceState(null, '', l.getAttribute('href'));
      filtrar();
    }));
    addEventListener('hashchange', () => filtrar());
    filtrar(false);
  }

  addEventListener('resize', () => marcar(ativo(), false));
  if (document.fonts) document.fonts.ready.then(() => marcar(ativo(), false));
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

/* ---------- 3. Botão portfólio / loja ---------- */
(() => {
  const modo = document.querySelector('.modo');
  if (!modo) return;
  modo.addEventListener('click', (e) => {
    e.preventDefault();
    modo.classList.add('trocando');          // o pino desliza antes de trocar de página
    setTimeout(() => { location.href = modo.href; }, 320);
  });
  // ao voltar pelo botão "voltar" do navegador, desfaz a animação
  addEventListener('pageshow', () => modo.classList.remove('trocando'));
})();
