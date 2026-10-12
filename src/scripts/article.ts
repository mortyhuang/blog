export function initArticle() {
  const content = document.querySelector<HTMLElement>('#article-content');
  const progress = document.querySelector<HTMLElement>('#reading-progress-bar');
  if (!content) return;
  let queued = false;
  const updateProgress = () => {
    const top = content.getBoundingClientRect().top + window.scrollY;
    const distance = Math.max(1, content.offsetHeight - window.innerHeight * .65);
    const value = Math.min(1, Math.max(0, (window.scrollY - top + window.innerHeight * .2) / distance));
    if (progress) progress.style.transform = `scaleX(${value})`;
    queued = false;
  };
  window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(updateProgress); } }, { passive: true });
  window.addEventListener('resize', updateProgress); updateProgress();
  const tocLinks = [...document.querySelectorAll<HTMLAnchorElement>('[data-heading-id]')];
  const headings = [...content.querySelectorAll<HTMLElement>('h2[id], h3[id]')];
  const observer = new IntersectionObserver((entries) => {
    const active = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (active) tocLinks.forEach((link) => { const current = link.dataset.headingId === active.target.id; link.classList.toggle('is-active', current); if (current) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); });
  }, { rootMargin: '-10% 0px -65% 0px' });
  headings.forEach((heading) => observer.observe(heading));

  content.querySelectorAll('pre').forEach((pre) => {
    const button = document.createElement('button');
    button.className = 'code-copy'; button.textContent = '复制'; button.setAttribute('aria-label', '复制代码');
    pre.append(button);
    button.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(pre.querySelector('code')?.textContent || ''); button.textContent = '已复制 ✓'; setTimeout(() => { button.textContent = '复制'; }, 2000); }
      catch { button.textContent = '复制失败'; setTimeout(() => { button.textContent = '复制'; }, 2000); }
    });
  });
  const share = document.querySelector<HTMLButtonElement>('[data-copy-link]');
  share?.addEventListener('click', async () => {
    const label = share.querySelector('span'), status = document.querySelector('[data-copy-status]');
    try { await navigator.clipboard.writeText(window.location.href); if (label) label.textContent = '已复制链接 ✓'; if (status) status.textContent = '文章链接已复制'; }
    catch { if (label) label.textContent = '请复制地址栏链接'; if (status) status.textContent = '无法访问剪贴板，请复制浏览器地址栏链接'; }
    setTimeout(() => { if (label) label.textContent = '复制文章链接'; }, 2400);
  });
}
