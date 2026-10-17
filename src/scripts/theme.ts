import {
  SEASON_LABEL,
  isHemisphere,
  isSeason,
  resolveSeason,
  type Hemisphere,
  type Season,
} from '../lib/season';

const THEME_KEY = 'mori-theme';
const SEASON_KEY = 'mori-season';

/** 标签页可能连着开好几天，隔一阵子重新对一次节气。 */
const SEASON_RECHECK_MS = 15 * 60 * 1000;

type SeasonMode = 'auto' | 'manual';

function readStore(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeStore(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

export function initTheme() {
  const root = document.documentElement;
  const themeButton = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
  const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');

  const browserColorMeta = document.querySelector('meta[name="theme-color"]');
  const announce = () => window.dispatchEvent(new CustomEvent('themechange'));

  /** 浏览器 UI 的颜色跟着实际背景走，这样四季与明暗都能对上。 */
  const syncBrowserColor = () => {
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    browserColorMeta?.setAttribute('content', bg || '#f8faf7');
  };

  const applyTheme = (theme: string) => {
    root.dataset.theme = theme;
    themeButton?.setAttribute('aria-label', `切换到${theme === 'dark' ? '浅色' : '深色'}主题`);
    themeButton?.setAttribute('title', theme === 'dark' ? '切换到浅色主题' : '切换到深色主题');
    syncBrowserColor();
    announce();
  };

  themeButton?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    writeStore(THEME_KEY, next);
  });

  colorScheme.addEventListener('change', (event) => {
    if (readStore(THEME_KEY)) return;
    applyTheme(event.matches ? 'dark' : 'light');
  });

  applyTheme(root.dataset.theme || 'light');
  initSeason();

  function initSeason() {
    const seasonButton = document.querySelector<HTMLButtonElement>('[data-season-toggle]');
    const seasonMenu = document.querySelector<HTMLElement>('[data-season-menu]');
    if (!seasonButton || !seasonMenu) return;

    const options = Array.from(seasonMenu.querySelectorAll<HTMLButtonElement>('[data-season-option]'));
    const hemisphere: Hemisphere = isHemisphere(root.dataset.seasonHemisphere)
      ? root.dataset.seasonHemisphere
      : 'auto';
    let current: { season: Season; mode: SeasonMode } | null = null;

    const timeZone = () => {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return undefined; }
    };

    /** ?season=autumn 之类的预览参数，只影响当次加载，不会写进 localStorage。 */
    const previewSeason = (): Season | null => {
      try {
        const value = new URLSearchParams(location.search).get('season');
        return isSeason(value) ? value : null;
      } catch { return null; }
    };

    const lockedSeason = (): Season | null => {
      const value = readStore(SEASON_KEY);
      return isSeason(value) ? value : null;
    };

    /** 预览参数只对本次浏览有效，用户一旦自己选过就从地址栏清掉。 */
    const clearPreview = () => {
      if (!previewSeason()) return;
      try {
        const url = new URL(location.href);
        url.searchParams.delete('season');
        history.replaceState(history.state, '', url);
      } catch {}
    };

    const applySeason = (season: Season, mode: SeasonMode) => {
      current = { season, mode };
      root.dataset.season = season;
      root.dataset.seasonMode = mode;

      const state = mode === 'auto' ? '跟随节气' : '已手动锁定';
      seasonButton.setAttribute('aria-label', `季节主题：${SEASON_LABEL[season]}（${state}）`);
      seasonButton.setAttribute('title', `季节主题：${SEASON_LABEL[season]}（${state}）`);

      // 单选组只能有一项被选中：自动时选中「跟随节气」，手动锁定时才选中具体那一季。
      // 自动模式当前落在哪一季，由按钮上的图标和提示文字表达。
      for (const option of options) {
        const value = option.dataset.seasonOption;
        const checked = mode === 'auto' ? value === 'auto' : value === season;
        option.setAttribute('aria-checked', String(checked));
      }

      syncBrowserColor();
      announce();
    };

    /** 重新判定当前该用哪个季节：预览参数 > 手动锁定 > 按节气自动算。 */
    const refresh = () => {
      const pinned = previewSeason() ?? lockedSeason();
      const mode: SeasonMode = pinned ? 'manual' : 'auto';
      const season = pinned ?? resolveSeason(Date.now(), timeZone(), hemisphere);
      if (current && current.season === season && current.mode === mode) return;
      applySeason(season, mode);
    };

    const openMenu = (target: 'checked' | 'first' | 'last' = 'checked') => {
      seasonMenu.hidden = false;
      seasonButton.setAttribute('aria-expanded', 'true');
      const checked = options.find((option) => option.getAttribute('aria-checked') === 'true');
      const pick = target === 'first' ? options[0] : target === 'last' ? options.at(-1) : checked ?? options[0];
      pick?.focus();
    };

    const closeMenu = (restoreFocus = false) => {
      if (seasonMenu.hidden) return;
      seasonMenu.hidden = true;
      seasonButton.setAttribute('aria-expanded', 'false');
      if (restoreFocus) seasonButton.focus();
    };

    seasonButton.addEventListener('click', () => {
      if (seasonMenu.hidden) openMenu();
      else closeMenu();
    });

    // 上下键直接展开菜单并把焦点送进去，符合菜单按钮的常见预期。
    seasonButton.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      openMenu(event.key === 'ArrowDown' ? 'first' : 'last');
    });

    seasonMenu.addEventListener('keydown', (event) => {
      const index = options.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === 'Escape') { event.preventDefault(); closeMenu(true); return; }
      if (event.key === 'Tab') { closeMenu(); return; }
      if (event.key === 'Home') { event.preventDefault(); options[0]?.focus(); return; }
      if (event.key === 'End') { event.preventDefault(); options.at(-1)?.focus(); return; }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      options[(index + step + options.length) % options.length]?.focus();
    });

    for (const option of options) {
      option.addEventListener('click', () => {
        const value = option.dataset.seasonOption;
        writeStore(SEASON_KEY, value === 'auto' ? null : value ?? null);
        clearPreview();
        refresh();
        closeMenu(true);
      });
    }

    // 点到菜单外面、或者焦点跑掉了就收起来。
    document.addEventListener('pointerdown', (event) => {
      if (seasonMenu.hidden) return;
      const target = event.target as Node;
      if (!seasonMenu.contains(target) && !seasonButton.contains(target)) closeMenu();
    });

    document.addEventListener('focusin', (event) => {
      if (seasonMenu.hidden) return;
      const target = event.target as Node;
      if (!seasonMenu.contains(target) && !seasonButton.contains(target)) closeMenu();
    });

    refresh();

    // 跨过交节时刻就自动换季；标签页回到前台时也补一次判定。
    window.setInterval(() => { if (!document.hidden) refresh(); }, SEASON_RECHECK_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  }
}
