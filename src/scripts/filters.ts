export function initFilters({ useUrl = false } = {}) {
  const rows = [...document.querySelectorAll<HTMLElement>('[data-post-row]')];
  if (!rows.length) return;
  const params = new URLSearchParams(window.location.search);
  let tag = useUrl ? params.get('tag') || '' : '';
  const activeTag = document.querySelector<HTMLElement>('[data-active-tag]');
  const activeTagName = document.querySelector<HTMLElement>('[data-active-tag-name]');
  function apply(syncUrl = true) {
    let count = 0;
    rows.forEach((row) => {
      const tags: string[] = JSON.parse(row.dataset.tags || '[]');
      const visible = !tag || tags.includes(tag);
      row.hidden = !visible;
      if (visible) count++;
    });
    document.querySelectorAll('[data-result-count]').forEach((element) => { element.textContent = String(count); });
    document.querySelectorAll<HTMLElement>('[data-year-group]').forEach((group) => {
      const visible = group.querySelectorAll('[data-post-row]:not([hidden])').length;
      group.hidden = !visible;
      const count = group.querySelector('.year-count'); if (count) count.textContent = `${visible} 篇`;
    });
    const empty = document.querySelector<HTMLElement>('[data-filter-empty]'); if (empty) empty.hidden = count > 0;
    if (activeTag) activeTag.hidden = !tag;
    if (activeTagName) activeTagName.textContent = tag;
    document.querySelectorAll<HTMLElement>('[data-tag-filter]').forEach((link) => {
      const active = link.dataset.tagFilter === tag; link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current');
    });
    if (useUrl && syncUrl) {
      const url = new URL(window.location.href);
      url.searchParams.delete('category');
      tag ? url.searchParams.set('tag', tag) : url.searchParams.delete('tag');
      history.pushState({}, '', url);
    }
  }
  document.querySelectorAll<HTMLAnchorElement>('[data-tag-filter]').forEach((link) => link.addEventListener('click', (event) => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); tag = link.dataset.tagFilter || ''; apply(); }));
  document.querySelector('[data-clear-tag]')?.addEventListener('click', () => { tag = ''; apply(); });
  document.querySelector('[data-reset-filters]')?.addEventListener('click', () => { tag = ''; apply(); });
  if (useUrl) window.addEventListener('popstate', () => { const params = new URLSearchParams(window.location.search); tag = params.get('tag') || ''; apply(false); });
  apply(false);
}
