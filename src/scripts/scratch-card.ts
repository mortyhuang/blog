import { createScratchTicket, scratchGames, ticketAward, zoneAward, type GameId, type ScratchZone } from '../lib/scratch-card';

const game = document.querySelector<HTMLElement>('.scratch-game');
if (game) {
  const root = game;
  const get = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const revealButton = get<HTMLButtonElement>('[data-reveal]');
  const nextButton = get<HTMLButtonElement>('[data-next]');
  const status = get('.game-status');
  const zonesContainer = get('.ticket-zones');
  let selected: GameId = 'dragon';
  let ticket = createScratchTicket(selected);
  let serial = 0;
  let cleanup = new AbortController();
  interface ZoneState {
    model: ScratchZone;
    area: HTMLElement;
    value: HTMLElement;
    overlay: HTMLButtonElement;
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D | null;
    progress: number;
    revealed: boolean;
    pointer: number | null;
    lastPoint: { x: number; y: number } | null;
    lastCheck: number;
  }
  let states: ZoneState[] = [];

  function update() {
    const finished = states.every((state) => state.revealed);
    const progress = Math.round(states.reduce((sum, state) => sum + state.progress, 0) / states.length);
    get('.progress-text').textContent = `${progress}%`;
    get('.progress-track > div').style.width = `${progress}%`;
    revealButton.disabled = finished;
    const count = states.filter((state) => state.revealed).length;
    if (finished) {
      const total = ticketAward(ticket);
      for (const state of states) {
        const award = zoneAward(selected, state.model, ticket.winning);
        state.area.classList.toggle('is-win', award > 0);
        if (state.model.kind !== 'reference') {
          const result = document.createElement('small');
          result.textContent = award > 0 ? `中得 ¥${award.toLocaleString()}` : '未中奖';
          state.value.append(result);
        }
      }
      status.textContent = total > 0 ? `本张模拟中奖合计 ¥${total.toLocaleString()}（不可兑换）` : '本张未中奖 · 仅供免费模拟体验';
    } else {
      status.textContent = count ? `已揭晓 ${count} / ${states.length} 区，全部刮开后结算。` : '新的一张，新的体验。先刮哪一区，由你决定。';
    }
  }

  function release(state: ZoneState) {
    const pointer = state.pointer;
    state.pointer = null;
    state.lastPoint = null;
    if (pointer !== null && state.overlay.hasPointerCapture(pointer)) state.overlay.releasePointerCapture(pointer);
  }

  function reveal(state: ZoneState) {
    if (state.revealed) return;
    release(state);
    state.revealed = true;
    state.progress = 100;
    state.context?.clearRect(0, 0, state.canvas.width, state.canvas.height);
    state.canvas.classList.add('revealed');
    state.canvas.hidden = true;
    state.value.removeAttribute('aria-hidden');
    state.overlay.disabled = true;
    state.overlay.setAttribute('aria-label', `${state.model.label}，已揭晓`);
    update();
  }

  function checkProgress(state: ZoneState) {
    if (!state.context || state.revealed) return;
    const pixels = state.context.getImageData(0, 0, state.canvas.width, state.canvas.height).data;
    let cleared = 0;
    let total = 0;
    for (let i = 3; i < pixels.length; i += 32) {
      total++;
      if (pixels[i] < 128) cleared++;
    }
    state.progress = Math.round(cleared / total * 100);
    if (state.progress >= 55) reveal(state);
    else update();
  }

  function scratch(state: ZoneState, event: PointerEvent) {
    const context = state.context;
    if (!context || state.revealed) return;
    const rect = state.canvas.getBoundingClientRect();
    const point = { x: (event.clientX - rect.left) * state.canvas.width / rect.width, y: (event.clientY - rect.top) * state.canvas.height / rect.height };
    // A consistent ~18 CSS-pixel eraser across differently sized regions.
    const radius = 18 * state.canvas.width / rect.width;
    context.lineWidth = radius * 2;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(state.lastPoint?.x ?? point.x, state.lastPoint?.y ?? point.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fill();
    state.lastPoint = point;
    if (performance.now() - state.lastCheck > 100) {
      state.lastCheck = performance.now();
      checkProgress(state);
    }
  }

  function renderZone(model: ScratchZone, container: HTMLElement) {
    const area = document.createElement('div');
    area.className = 'scratch-area';
    area.dataset.zone = model.id;
    const value = document.createElement('div');
    value.className = 'zone-value';
    value.setAttribute('aria-hidden', 'true');
    const main = document.createElement('strong');
    if (model.kind === 'duel') {
      main.className = 'duel-value';
      main.textContent = `${model.values[0]} : ${model.values[1]}`;
    } else {
      main.textContent = model.values.join('  ');
      if (model.kind === 'triple') main.className = 'triple-value';
    }
    value.append(main);
    const caption = document.createElement('small');
    caption.textContent = model.kind === 'reference' ? '中奖号码' : model.kind === 'duel' ? `我的点数 : 对手点数 · 奖金 ¥${model.prize.toLocaleString()}` : model.kind === 'number' || model.kind === 'triple' ? `对应奖金 ¥${model.prize.toLocaleString()}` : model.kind === 'thumb' ? '刮出「赞」得 ¥60' : '玩法一 · 即开即得';
    value.append(caption);
    const overlay = document.createElement('button');
    overlay.type = 'button';
    overlay.className = 'zone-overlay';
    overlay.setAttribute('aria-label', `揭晓${model.label}（可按住刮开）`);
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = model.kind === 'reference' ? 100 : 230;
    canvas.setAttribute('aria-hidden', 'true');
    overlay.append(canvas);
    area.append(value, overlay);
    container.append(area);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const state: ZoneState = { model, area, value, overlay, canvas, context, progress: 0, revealed: false, pointer: null, lastPoint: null, lastCheck: 0 };
    states.push(state);
    if (context) {
      const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#dce0df');
      gradient.addColorStop(0.5, '#b9c2c1');
      gradient.addColorStop(1, '#e0e4df');
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = '#ffffff35';
      for (let x = -230; x < 600; x += 22) {
        context.beginPath(); context.moveTo(x, 0); context.lineTo(x + 230, 230); context.stroke();
      }
      context.fillStyle = '#43524f';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = `${model.kind === 'reference' ? 28 : 38}px sans-serif`;
      context.fillText(`${model.label} · 刮开`, 300, canvas.height / 2);
      context.globalCompositeOperation = 'destination-out';
    } else {
      canvas.hidden = true;
      overlay.textContent = `${model.label} · 点击揭晓`;
      overlay.style.background = '#c8d0cb';
    }
    const options = { signal: cleanup.signal };
    overlay.addEventListener('click', (event) => {
      // Keyboard/assistive clicks reveal; a pointer tap only scratches a dot.
      if (event.detail === 0 || !context) reveal(state);
    }, options);
    overlay.addEventListener('pointerdown', (event) => {
      if (state.revealed || state.pointer !== null || event.button !== 0) return;
      state.pointer = event.pointerId;
      overlay.setPointerCapture(event.pointerId);
      scratch(state, event);
    }, options);
    overlay.addEventListener('pointermove', (event) => {
      if (event.pointerId === state.pointer) scratch(state, event);
    }, options);
    const end = (event: PointerEvent) => {
      if (event.pointerId !== state.pointer) return;
      release(state);
      checkProgress(state);
    };
    overlay.addEventListener('pointerup', end, options);
    overlay.addEventListener('pointercancel', end, options);
    overlay.addEventListener('lostpointercapture', end, options);
  }

  function newTicket() {
    for (const state of states) release(state);
    cleanup.abort();
    cleanup = new AbortController();
    states = [];
    ticket = createScratchTicket(selected);
    serial++;
    const definition = scratchGames.find((item) => item.id === selected)!;
    get('.ticket').style.setProperty('--ticket-color', definition.color);
    get('.ticket-name').textContent = definition.name;
    get('.ticket-meta').textContent = `票面面值 ¥${definition.face} / 官方最高奖 ¥${definition.top.toLocaleString()}`;
    get('.ticket-rule').textContent = definition.rule;
    get('.help-rule').textContent = definition.rule;
    get('.help-tiers').textContent = `官方奖级（元）：${definition.tiers.map((n) => n.toLocaleString()).join('、')}。`;
    get<HTMLAnchorElement>('.rules-source').href = definition.source;
    get('.ticket-number').textContent = `NO. ${String(serial).padStart(6, '0')}`;
    zonesContainer.replaceChildren();
    const groups = new Map<string, HTMLElement>();
    for (const model of ticket.zones) {
      let grid = groups.get(model.group);
      if (!grid) {
        const section = document.createElement('section');
        section.className = `zone-group${model.kind === 'reference' ? ' reference-group' : model.kind === 'cash' || model.kind === 'thumb' ? ' wide-group' : ''}`;
        const heading = document.createElement('h3');
        heading.textContent = model.group;
        grid = document.createElement('div');
        grid.className = 'zone-grid';
        section.append(heading, grid);
        zonesContainer.append(section);
        groups.set(model.group, grid);
      }
      renderZone(model, grid);
    }
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-game]')) {
      button.disabled = false;
      button.setAttribute('aria-pressed', String(button.dataset.game === selected));
    }
    nextButton.disabled = false;
    update();
  }

  revealButton.addEventListener('click', () => {
    for (const state of states) reveal(state);
  });
  nextButton.addEventListener('click', newTicket);
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-game]')) {
    button.addEventListener('click', () => {
      if (selected === button.dataset.game) return;
      selected = button.dataset.game as GameId;
      newTicket();
    });
  }
  newTicket();
}
