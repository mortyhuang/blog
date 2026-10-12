interface SearchEntry { title: string; description: string; tags: string[]; url: string; date: string; }
export function initSearch() {
  const dialog = document.querySelector<HTMLDialogElement>('#search-dialog');
  const input = document.querySelector<HTMLInputElement>('#search-input');
  const results = document.querySelector<HTMLElement>('#search-results');
  const status = document.querySelector<HTMLElement>('#search-status');
  if (!dialog || !input || !results || !status) return;
  const modal = dialog, field = input, output = results, message = status;
  let entries: SearchEntry[] | undefined;
  let loading: Promise<void> | undefined;
  let failed = false;
  let selected = -1;
  let opener: Element | null = null;

  const load = () => {
    if (loading) return loading;
    message.textContent = '正在打开花园的索引…';
    loading = fetch('/search-index.json')
      .then((response) => { if (!response.ok) throw new Error('Index unavailable'); return response.json(); })
      .then((data: SearchEntry[]) => { entries = data; failed = false; render(); })
      .catch(() => { failed = true; loading = undefined; message.textContent = '搜索索引暂时不可用，请关闭后重试。'; });
    return loading;
  };

  function select(index: number) {
    const links = [...output.querySelectorAll<HTMLAnchorElement>('a')];
    selected = links.length ? (index + links.length) % links.length : -1;
    links.forEach((link, i) => {
      link.classList.toggle('is-selected', i === selected);
      link.tabIndex = i === selected ? 0 : -1;
    });
    if (selected >= 0) links[selected]?.scrollIntoView({ block: 'nearest' });
  }

  function render() {
    if (!entries) return;
    const query = field.value.trim().toLocaleLowerCase();
    const terms = query.split(/\s+/).filter(Boolean);
    const matches = entries.map((entry) => {
      const title = entry.title.toLocaleLowerCase();
      const searchable = `${title} ${entry.description} ${entry.tags.join(' ')}`.toLocaleLowerCase();
      return { entry, score: terms.reduce((score, term) => score + (title.includes(term) ? 3 : 1), 0), matches: terms.every((term) => searchable.includes(term)) };
    }).filter((item) => item.matches).sort((a, b) => b.score - a.score).slice(0, 8);
    message.textContent = query ? (matches.length ? `找到 ${matches.length} 篇相关文章` : `没有找到“${field.value.trim()}”相关的文章，试试其他关键词？`) : '最近的文章 · 输入关键词开始搜索';
    output.replaceChildren();
    for (const { entry } of matches) {
      const link = document.createElement('a');
      link.href = entry.url;
      link.className = 'search-result';
      const content = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = entry.title;
      const description = document.createElement('p');
      description.textContent = entry.description;
      const meta = document.createElement('span');
      meta.className = 'search-result-meta';
      meta.textContent = `${entry.date} · ${entry.tags.join(' / ')}`;
      const arrow = document.createElement('span');
      arrow.className = 'search-result-arrow';
      arrow.textContent = '↗';
      content.append(title, description, meta);
      link.append(content, arrow);
      output.append(link);
    }
    select(0);
  }

  function open() {
    if (modal.open) return;
    opener = document.activeElement;
    modal.showModal();
    document.body.classList.add('dialog-open');
    field.focus();
    if (entries) render(); else void load();
  }
  document.querySelectorAll('[data-search-open]').forEach((button) => button.addEventListener('click', open));
  document.querySelector('[data-search-close]')?.addEventListener('click', () => modal.close());
  modal.addEventListener('click', (event) => { if (event.target === modal) { const rect = modal.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) modal.close(); } });
  modal.addEventListener('close', () => { document.body.classList.remove('dialog-open'); if (opener instanceof HTMLElement) opener.focus(); });
  field.addEventListener('input', () => { if (!failed) render(); });
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (modal.open) modal.close(); else open(); }
    if (!modal.open) return;
    if (event.key === 'Escape') { event.preventDefault(); modal.close(); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); select(selected + (event.key === 'ArrowDown' ? 1 : -1)); }
    if (event.key === 'Enter' && document.activeElement === field) { const link = output.querySelector<HTMLAnchorElement>('a.is-selected'); if (link) { event.preventDefault(); window.location.assign(link.href); } }
  });
}
