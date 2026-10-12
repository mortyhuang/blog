export function initTheme() {
  const root = document.documentElement;
  const button = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = (theme: string) => {
    root.dataset.theme = theme;
    button?.setAttribute('aria-label', `切换到${theme === 'dark' ? '浅色' : '深色'}主题`);
    button?.setAttribute('title', theme === 'dark' ? '切换到浅色主题' : '切换到深色主题');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#111713' : '#f8faf7');
    window.dispatchEvent(new CustomEvent('themechange'));
  };
  apply(root.dataset.theme || 'light');
  button?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    apply(next);
    try { localStorage.setItem('mori-theme', next); } catch {}
  });
  media.addEventListener('change', (event) => {
    try { if (localStorage.getItem('mori-theme')) return; } catch {}
    apply(event.matches ? 'dark' : 'light');
  });
}
