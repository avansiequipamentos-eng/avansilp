'use strict';

(() => {
  const hero = document.querySelector('#inicio');
  const stage = hero.querySelector('.hero-stage');
  const tablist = hero.querySelector('[role="tablist"]');
  const pauseButton = hero.querySelector('.hero-pause');
  const counter = hero.querySelector('.hero-counter');
  const announcement = hero.querySelector('.hero-announcement');
  const progressbar = hero.querySelector('[role="progressbar"]');
  const dialog = document.querySelector('#equipment-dialog');
  const settings = window.AVANSI_CONTENT.hero;
  const equipment = window.AVANSI_CONTENT.equipment;
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const panels = [];
  const tabs = [];
  const videos = [];
  const posters = [];
  const failedMedia = new Set();
  const failedPosters = new Set();
  let index = 0;
  let elapsed = 0;
  let lastTime = null;
  let frame = null;
  let playbackAttempt = 0;
  let userPaused = motionPreference.matches || settings.autoplay === false;

  if (!equipment.length) {
    hero.querySelector('.hero-controls').hidden = true;
    tablist.hidden = true;
    return;
  }

  hero.style.setProperty('--hero-transition', `${Math.max(0, settings.transitionMs || 0)}ms`);

  function isPaused() {
    return userPaused || document.hidden || dialog.open;
  }

  function fallbackDuration() {
    const video = videos[index];
    if (video && Number.isFinite(video.duration) && video.duration > 0) return video.duration * 1000;
    const duration = Number(equipment[index].hero?.durationMs ?? settings.durationMs);
    return Number.isFinite(duration) && duration > 0 ? duration : 10000;
  }

  function renderProgress(fraction) {
    const progress = Math.max(0, Math.min(1, fraction));
    tabs[index].style.setProperty('--progress', String(progress));
    const percent = String(Math.round(progress * 100));
    if (progressbar.getAttribute('aria-valuenow') !== percent) {
      progressbar.setAttribute('aria-valuenow', percent);
    }
  }

  function schedule() {
    if (frame === null && !isPaused()) frame = requestAnimationFrame(tick);
  }

  function syncPlayback() {
    const attempt = ++playbackAttempt;
    lastTime = null;
    const paused = isPaused();
    hero.dataset.playback = paused ? 'paused' : 'playing';
    pauseButton.textContent = userPaused ? 'Retomar' : 'Pausar';
    pauseButton.setAttribute('aria-label', userPaused ? 'Retomar apresentações' : 'Pausar apresentações');
    pauseButton.setAttribute('aria-pressed', String(userPaused));
    if (paused && frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
    const video = videos[index];
    if (video && !failedMedia.has(index)) {
      if (paused) video.pause();
      else if (video.paused) {
        video.play().catch(error => {
          // Uma troca rápida ou uma pausa pode cancelar a tentativa anterior.
          if (attempt !== playbackAttempt || error?.name === 'AbortError') return;
          // Autoplay bloqueado: exige retomada explícita e mantém o progresso parado.
          if (videos[index] === video && !failedMedia.has(index) && !isPaused()) {
            userPaused = true;
            video.dataset.playing = 'false';
            announcement.textContent = 'Reprodução pausada. Use Retomar apresentações para continuar.';
            syncPlayback();
          }
        });
      }
    }
    schedule();
  }

  function updateMediaState() {
    const hasPoster = posters[index] && !failedPosters.has(index);
    hero.dataset.hasMedia = String(Boolean(hasPoster || ((videos[index] || equipment[index].hero?.image) && !failedMedia.has(index))));
  }

  function select(nextIndex, manual = false) {
    videos.forEach(video => { if (video) { video.autoplay = false; video.pause(); } });
    index = (nextIndex + equipment.length) % equipment.length;
    elapsed = 0;
    lastTime = null;
    panels.forEach((panel, itemIndex) => {
      const active = itemIndex === index;
      panel.setAttribute('aria-hidden', String(!active));
      panel.inert = !active;
      tabs[itemIndex].setAttribute('aria-selected', String(active));
      tabs[itemIndex].tabIndex = active ? 0 : -1;
      tabs[itemIndex].style.setProperty('--progress', '0');
    });
    const video = videos[index];
    if (video) {
      video.dataset.playing = 'false';
      video.autoplay = !isPaused();
      if (video.readyState) video.currentTime = 0;
    }
    counter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(equipment.length).padStart(2, '0')}`;
    hero.dataset.equipment = equipment[index].id;
    updateMediaState();
    progressbar.setAttribute('aria-label', `Tempo da apresentação de ${equipment[index].title}`);
    renderProgress(0);
    if (manual) announcement.textContent = `${equipment[index].title}. Apresentação ${index + 1} de ${equipment.length}.`;
    syncPlayback();
  }

  function tick(now) {
    frame = null;
    if (isPaused()) {
      syncPlayback();
      return;
    }
    const delta = lastTime === null ? 0 : now - lastTime;
    lastTime = now;
    const video = videos[index];
    if (video && !failedMedia.has(index)) {
      // Nunca usa o relógio provisório para vídeo carregando, pausado ou em buffering.
      const fraction = Number.isFinite(video.duration) && video.duration > 0 ? video.currentTime / video.duration : 0;
      renderProgress(fraction);
      if (video.ended) select(index + 1);
    } else {
      elapsed += delta;
      renderProgress(elapsed / fallbackDuration());
      if (elapsed >= fallbackDuration()) select(index + 1);
    }
    schedule();
  }

  equipment.forEach((item, itemIndex) => {
    const media = item.hero || {};
    const tabId = `hero-tab-${item.id}`;
    const panelId = `hero-panel-${item.id}`;
    const panel = document.createElement('div');
    panel.id = panelId;
    panel.className = 'hero-slide';
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tabId);

    // O poster permanece sob o vídeo, inclusive durante carga, bloqueio e erro.
    // Só mostramos o vídeo depois do evento playing, sem retirar o fundo estático.
    if (media.poster) {
      const poster = document.createElement('img');
      poster.className = 'hero-asset hero-poster';
      poster.alt = '';
      poster.decoding = 'async';
      poster.fetchPriority = itemIndex === 0 ? 'high' : 'auto';
      poster.src = media.poster;
      poster.setAttribute('aria-hidden', 'true');
      poster.style.setProperty('--hero-position', media.objectPosition || '50% 50%');
      poster.style.setProperty('--hero-position-mobile', media.objectPositionMobile || media.objectPosition || '50% 50%');
      poster.addEventListener('error', () => {
        failedPosters.add(itemIndex);
        poster.hidden = true;
        if (itemIndex === index) updateMediaState();
      });
      posters[itemIndex] = poster;
      panel.append(poster);
    }

    let asset;
    if (media.video) {
      asset = document.createElement('video');
      asset.muted = true;
      asset.defaultMuted = true;
      asset.setAttribute('muted', '');
      asset.playsInline = true;
      asset.preload = 'metadata';
      asset.src = media.video;
      if (media.poster) asset.poster = media.poster;
      videos[itemIndex] = asset;
      asset.addEventListener('playing', () => {
        if (itemIndex !== index || isPaused()) { asset.pause(); return; }
        asset.dataset.playing = 'true';
      });
      asset.addEventListener('ended', () => {
        if (itemIndex === index && !isPaused()) select(index + 1);
      });
    } else if (media.image) {
      asset = document.createElement('img');
      asset.src = media.image;
      asset.alt = '';
    }
    if (asset) {
      asset.className = media.video ? 'hero-asset hero-video' : 'hero-asset';
      asset.setAttribute('aria-hidden', 'true');
      asset.style.setProperty('--hero-position', media.objectPosition || '50% 50%');
      asset.style.setProperty('--hero-position-mobile', media.objectPositionMobile || media.objectPosition || '50% 50%');
      asset.addEventListener('error', () => {
        failedMedia.add(itemIndex);
        asset.hidden = true;
        if (itemIndex === index) {
          elapsed = 0;
          updateMediaState();
          syncPlayback();
        }
      });
      panel.append(asset);
    }

    const copy = document.createElement('div');
    copy.className = 'hero-copy';
    const label = document.createElement('p');
    label.className = 'eyebrow';
    label.textContent = 'EQUIPAMENTOS AVANSI';
    const title = document.createElement('h2');
    title.textContent = item.title;
    const description = document.createElement('p');
    description.className = 'hero-description';
    description.textContent = item.description || 'Informações a confirmar.';
    const actions = document.createElement('div');
    actions.className = 'actions';
    const details = document.createElement('button');
    details.type = 'button';
    details.className = 'button';
    details.textContent = 'Conhecer equipamento ↗';
    details.setAttribute('aria-label', `Ver detalhes de ${item.title} no destaque`);
    details.setAttribute('aria-haspopup', 'dialog');
    details.addEventListener('click', () => {
      openEquipmentDialog(item);
      syncPlayback();
    });
    const portfolio = document.createElement('a');
    portfolio.href = '#equipamentos';
    portfolio.className = 'text-link';
    portfolio.textContent = 'Explorar portfólio ↓';
    actions.append(details, portfolio);
    copy.append(label, title, description, actions);
    // Não troca nem oculta o painel enquanto um controle do conteúdo tem foco.
    copy.addEventListener('focusin', () => {
      userPaused = true;
      syncPlayback();
    });
    panel.append(copy);
    stage.append(panel);
    panels.push(panel);

    const tab = document.createElement('button');
    tab.type = 'button';
    tab.id = tabId;
    tab.className = 'hero-tab';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panelId);
    const number = document.createElement('span');
    number.className = 'hero-tab-number';
    number.textContent = String(itemIndex + 1).padStart(2, '0');
    number.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.className = 'hero-tab-name';
    name.textContent = item.title;
    tab.setAttribute('aria-label', item.title);
    tab.append(number, name);
    tab.addEventListener('click', () => select(itemIndex, true));
    tabs.push(tab);
    tablist.append(tab);
  });

  tablist.style.setProperty('--tab-count', String(equipment.length));
  tablist.addEventListener('keydown', event => {
    const current = tabs.indexOf(event.target);
    if (current < 0) return;
    const next = {ArrowRight: (current + 1) % tabs.length, ArrowLeft: (current + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1}[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next, true);
    tabs[next].focus();
  });
  hero.querySelector('.hero-prev').addEventListener('click', () => select(index - 1, true));
  hero.querySelector('.hero-next').addEventListener('click', () => select(index + 1, true));
  pauseButton.addEventListener('click', () => {
    userPaused = !userPaused;
    syncPlayback();
  });
  // O intervalo oculto nunca entra no cálculo do tempo da apresentação.
  document.addEventListener('visibilitychange', syncPlayback);
  dialog.addEventListener('close', syncPlayback);
  dialog.addEventListener('focusin', syncPlayback);
  motionPreference.addEventListener('change', () => {
    if (motionPreference.matches) userPaused = true;
    syncPlayback();
  });
  select(0);
})();
