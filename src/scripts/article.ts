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
}
